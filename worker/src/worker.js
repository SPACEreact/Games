// GameAdda multiplayer server — Cloudflare Worker + one SQLite Durable Object.
// Single lobby coordinator for small hobby traffic; no account or persistent player profiles.
// All game state changes are server-authoritative. WebSockets use hibernation.
import { DurableObject } from "cloudflare:workers";
import { winner, cleanName, validCode } from "./rules.js";

const ROOM_TTL = 2 * 60 * 60 * 1000;
const IDLE_TTL = 30 * 60 * 1000;
const MAX_SOCKETS = 300;
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function code() {
  const bytes = new Uint8Array(8); crypto.getRandomValues(bytes);
  return [...bytes].map(v=>CODE_CHARS[v % CODE_CHARS.length]).join("");
}
function json(data,status=200) {
  return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","Access-Control-Allow-Origin":"*"}});
}
function originAllowed(request,env) {
  const origin=request.headers.get("Origin");
  // Non-browser clients cannot be protected by Origin checks. Apply socket caps in the lobby.
  if (!origin) return true;
  const permitted=(env.ALLOWED_ORIGINS || "https://spacereact.github.io,http://localhost:8000,http://127.0.0.1:8000").split(",").map(x=>x.trim());
  return permitted.includes(origin);
}
export default {
  async fetch(request,env) {
    const url=new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") return json({ok:true,service:"gameadda-multiplayer",game:"tic-tac-toe"});
    if (request.method !== "GET" || url.pathname !== "/ws") return json({error:"Not found. Use /health or WebSocket /ws."},404);
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") return json({error:"Expected WebSocket upgrade"},426);
    if (!originAllowed(request,env)) return json({error:"Origin not allowed"},403);
    return env.LOBBY.getByName("gameadda-global-lobby-v1").fetch(request);
  }
};

export class GameLobby extends DurableObject {
  constructor(ctx,env) {
    super(ctx,env);
    this.rooms=new Map();
    this.people=new Map();
    this.queue=[];
    this.ready=ctx.blockConcurrencyWhile(async () => {
      const old = await ctx.storage.get("rooms");
      this.rooms = new Map(Array.isArray(old)?old:[]);
      for (const socket of ctx.getWebSockets()) {
        const meta=socket.deserializeAttachment();
        if (meta && socket.readyState === 1) {
          this.people.set(socket,meta);
          if (meta.waiting) this.queue.push(socket);
        }
      }
    });
  }
  async save() {
    await this.ctx.storage.put("rooms",[...this.rooms]);
    if (this.rooms.size) await this.ctx.storage.setAlarm(Date.now()+60*60*1000);
  }
  prune() {
    const now=Date.now();
    for (const [id,room] of this.rooms) {
      const online=this.liveCount(id);
      if (now-room.updated>ROOM_TTL || (!online && now-room.updated>IDLE_TTL)) this.rooms.delete(id);
    }
    this.queue=this.queue.filter(s=>s.readyState===1 && this.people.get(s)?.waiting);
  }
  liveCount(roomCode) {
    let count=0;
    for (const [ws,p] of this.people) if (ws.readyState===1 && p.room===roomCode) count++;
    return count;
  }
  activeSocket(roomCode,seat) {
    for (const [ws,p] of this.people) if (ws.readyState===1 && p.room===roomCode && p.seat===seat) return ws;
    return null;
  }
  send(ws,payload) {
    if (ws.readyState!==1) return;
    try { ws.send(JSON.stringify(payload)); } catch { /* socket closed mid-send */ }
  }
  fail(ws,message) { this.send(ws,{type:"error",message}); }
  attach(ws,p) { this.people.set(ws,p);ws.serializeAttachment(p); }
  state(room,seat) {
    return {type:"state",room:room.id,you:seat,board:room.board,turn:room.turn,winner:winner(room.board),
      players:{X:room.X?.name || null,O:room.O?.name || null},
      online:{X:!!this.activeSocket(room.id,"X"),O:!!this.activeSocket(room.id,"O")},
      rematch:room.rematch};
  }
  publish(room) {
    for (const [ws,p] of this.people) if (p.room===room.id) this.send(ws,this.state(room,p.seat));
  }
  newRoom() {
    let id;
    do { id=code() } while (this.rooms.has(id));
    return {id,X:null,O:null,board:Array(9).fill(""),turn:"X",rematch:{X:false,O:false},updated:Date.now()};
  }
  occupy(ws,p,room,seat) {
    // A reconnect replaces the previous socket for the same guest token and seat.
    for (const [old,meta] of this.people) {
      if (old!==ws && meta.room===room.id && meta.seat===seat && meta.token===p.token) {
        this.people.delete(old);
        try{old.close(4000,"Reconnected in another tab")}catch{}
      }
    }
    p.room=room.id;p.seat=seat;p.waiting=false;
    this.attach(ws,p);
    room.updated=Date.now();
  }
  async fetch(request) {
    await this.ready;
    this.prune();
    if (this.people.size >= MAX_SOCKETS) return json({error:"Server busy. Please retry later."},503);
    const url=new URL(request.url);
    const mode=url.searchParams.get("mode");
    const name=cleanName(url.searchParams.get("name"));
    const token=url.searchParams.get("token");
    const id=(url.searchParams.get("room")||"").toUpperCase();
    if (!["create","join","random"].includes(mode) || typeof token!=="string" || !/^[0-9a-f-]{36}$/.test(token))
      return json({error:"Invalid connection parameters"},400);
    if (mode==="join" && !validCode(id)) return json({error:"Invalid room code"},400);
    // Basic abuse protection. It is not a full bot/WAF solution.
    const ip=request.headers.get("CF-Connecting-IP");
    if (ip && [...this.people.values()].filter(p=>p.ip===ip).length>=8) return json({error:"Too many simultaneous connections"},429);
    const pair=new WebSocketPair();
    const [client,server]=Object.values(pair);
    this.ctx.acceptWebSocket(server);
    const p={token,name,ip:ip||null,room:null,seat:null,waiting:false,last:0};
    this.attach(server,p);
    try {
      if (mode==="create") {
        const room=this.newRoom();room.X={token,name};this.rooms.set(room.id,room);
        this.occupy(server,p,room,"X"); await this.save();this.publish(room);
      } else if (mode==="join") {
        const room=this.rooms.get(id);
        if (!room) {this.fail(server,"Room not found or expired.");this.people.delete(server);server.close(4004,"Room not found");}
        else {
          const seat=room.X?.token===token ? "X" : room.O?.token===token ? "O" : !room.O ? "O" : null;
          if (!seat) {this.fail(server,"This room already has two players.");this.people.delete(server);server.close(4009,"Room full");}
          else {
            if (!room[seat]) room[seat]={token,name};
            this.occupy(server,p,room,seat);await this.save();this.publish(room);
          }
        }
      } else {
        // Public matchmaking is strictly one waiting player to one opponent.
        const opponent=this.queue.find(ws=>{
          const other=this.people.get(ws);
          return ws!==server && ws.readyState===1 && other?.waiting && other.token!==token;
        });
        if (opponent) {
          this.queue=this.queue.filter(s=>s!==opponent);
          const other=this.people.get(opponent);
          const room=this.newRoom();room.X={token:other.token,name:other.name};room.O={token,name};
          this.rooms.set(room.id,room);
          this.occupy(opponent,other,room,"X");this.occupy(server,p,room,"O");
          await this.save();this.publish(room);
        } else {
          p.waiting=true;this.attach(server,p);this.queue.push(server);
          this.send(server,{type:"waiting",message:"Searching for a player…"});
        }
      }
    } catch(err) {
      this.fail(server,"Unable to set up the match. Please reconnect.");
    }
    return new Response(null,{status:101,webSocket:client});
  }
  async webSocketMessage(ws,message) {
    await this.ready;
    const p=this.people.get(ws);
    if (!p || typeof message!=="string" || message.length>400) return;
    let msg;try{msg=JSON.parse(message)}catch{return}
    if (!msg || typeof msg.type!=="string") return;
    if (msg.type==="ping"){this.send(ws,{type:"pong"});return}
    const now=Date.now();
    if (now-p.last<120) return;
    p.last=now;this.attach(ws,p);
    if (msg.type==="leave") {try{ws.close(1000,"Left room")}catch{};await this.disconnect(ws);return}
    if (!p.room || !p.seat) return;
    const room=this.rooms.get(p.room);
    if (!room || room[p.seat]?.token!==p.token) return this.fail(ws,"The match has expired.");
    if (msg.type==="move") {
      if (!room.O || !this.activeSocket(room.id,"X") || !this.activeSocket(room.id,"O")) return this.fail(ws,"Waiting for both players to connect.");
      if (winner(room.board)) return this.fail(ws,"This game is finished.");
      if (room.turn!==p.seat) return this.fail(ws,"It's not your turn.");
      if (!Number.isInteger(msg.cell) || msg.cell<0 || msg.cell>8 || room.board[msg.cell]) return this.fail(ws,"Invalid move.");
      room.board[msg.cell]=p.seat;
      if (!winner(room.board)) room.turn=p.seat==="X"?"O":"X";
      room.updated=now;await this.save();this.publish(room);
    }
    if (msg.type==="rematch") {
      if (!winner(room.board)) return this.fail(ws,"Finish this game first.");
      room.rematch[p.seat]=true;
      if (room.rematch.X && room.rematch.O) {
        room.board=Array(9).fill("");room.turn="X";room.rematch={X:false,O:false};
      }
      room.updated=now;await this.save();this.publish(room);
    }
  }
  async disconnect(ws) {
    await this.ready;
    const p=this.people.get(ws);
    if (!p) return;
    this.people.delete(ws);
    this.queue=this.queue.filter(s=>s!==ws);
    if (p.room) {
      const room=this.rooms.get(p.room);
      if (room) {room.updated=Date.now();await this.save();this.publish(room)}
    }
  }
  async webSocketClose(ws) {await this.disconnect(ws)}
  async webSocketError(ws) {await this.disconnect(ws)}
  async alarm() {
    await this.ready;this.prune();await this.save();
  }
}
