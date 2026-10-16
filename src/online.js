// Frontend WebSocket client for GameAdda multiplayer.
// Deployment requires src/online-config.js to point to a real Cloudflare Worker.
import { WORKER_URL } from "./online-config.js";

let socket=null;
let phase="idle";
let snapshot=null;
let message="";
let mode=null;
let lastCode="";
let lastName="";
const subscribers=new Set();
const notify=()=>subscribers.forEach(fn=>fn());

export function configured(){ return /^https:\/\/[^/]+/i.test(WORKER_URL.trim()) }
export function onlineState(){ return {phase,snapshot,message,mode,lastCode,configured:configured()} }
export function onOnlineChange(fn){subscribers.add(fn);return()=>subscribers.delete(fn)}
function identity(){
  try {
    let token=sessionStorage.getItem("gameadda-guest-token");
    if (!token){token=crypto.randomUUID();sessionStorage.setItem("gameadda-guest-token",token)}
    return token;
  } catch {return crypto.randomUUID()}
}
export function leaveOnline(silent=false){
  const previous=socket;socket=null;
  if(previous){try{previous.close(1000,"Leaving")}catch{}}
  phase="idle";snapshot=null;message="";mode=null;lastCode="";
  if(!silent)notify();
}
export function connectOnline(nextMode,{code="",name="Guest"}={}){
  if(!configured()){
    phase="error";message="The multiplayer backend has not been deployed yet.";notify();return false;
  }
  if(!["create","join","random"].includes(nextMode))return false;
  leaveOnline(true);
  mode=nextMode;lastCode=code.toUpperCase().replace(/[^A-Z2-9]/g,"").slice(0,8);lastName=name;
  phase="connecting";message="Connecting to the GameAdda server…";notify();
  const wsUrl=new URL(WORKER_URL.trim().replace(/^http/i,"ws").replace(/\/$/,"")+"/ws");
  wsUrl.searchParams.set("mode",nextMode);
  wsUrl.searchParams.set("name",name.slice(0,18));
  wsUrl.searchParams.set("token",identity());
  if(nextMode==="join")wsUrl.searchParams.set("room",lastCode);
  const ws=new WebSocket(wsUrl);
  socket=ws;
  ws.onopen=()=>{if(socket!==ws)return;phase="connecting";message="Connected. Finding your game…";notify()};
  ws.onmessage=event=>{
    if(socket!==ws)return;
    let data;try{data=JSON.parse(event.data)}catch{return}
    if(data.type==="waiting"){phase="waiting";message=data.message||"Waiting for a player…";notify()}
    if(data.type==="state"){
      snapshot=data;phase=data.players?.X && data.players?.O ? "playing" : "waiting";message="";notify();
    }
    if(data.type==="error"){phase="error";message=data.message||"Something went wrong.";notify()}
  };
  ws.onerror=()=>{if(socket!==ws)return;phase="error";message="Unable to reach multiplayer server. Check the Worker deployment and try again.";notify()};
  ws.onclose=()=>{if(socket!==ws)return;socket=null;if(phase!=="error"){phase="disconnected";message="Connection lost. Reconnect to resume your room."}notify()};
  return true;
}
function transmit(payload){
  if(!socket || socket.readyState!==WebSocket.OPEN)return false;
  socket.send(JSON.stringify(payload));return true;
}
export function onlineMove(cell){if(Number.isInteger(cell)&&cell>=0&&cell<=8)transmit({type:"move",cell})}
export function onlineRematch(){transmit({type:"rematch"})}
export function reconnectOnline(){if(mode)connectOnline(snapshot?.room?"join":mode,{code:snapshot?.room||lastCode,name:lastName})}
export function roomLink(room){
  const url=new URL(location.href);url.search="?room="+encodeURIComponent(room);return url.toString();
}
