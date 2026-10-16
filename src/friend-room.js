// Casual friend matches over WebRTC. The host owns the game state.
export const roomPattern = /^[a-f0-9]{12}$/;
const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
export function result(board) {
  for (const [a,b,c] of lines) if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  return board.every(Boolean) ? 'draw' : null;
}
export function freshGame(game) {
  return game === 'tic' ? {game, round:0, board:Array(9).fill(''), turn:0, outcome:null} :
    {game, round:0, phase:'idle', goAt:0, results:[null,null], wins:[0,0]};
}
export function applyAction(state, player, action, now = Date.now()) {
  if (!action || ![0,1].includes(player)) return false;
  if (action.type === 'reset' && player === 0) {
    if (state.game === 'tic') Object.assign(state, freshGame('tic'), {round:state.round+1});
    else if (state.phase !== 'wait') Object.assign(state, {round:state.round+1, phase:'wait', goAt:now+2000+Math.random()*3000, results:[null,null]});
    else return false;
    return true;
  }
  if (action.round !== state.round) return false;
  if (state.game === 'tic' && action.type === 'move') {
    if (state.outcome || player !== state.turn || !Number.isInteger(action.cell) || action.cell<0 || action.cell>8 || state.board[action.cell]) return false;
    state.board[action.cell] = player === 0 ? 'X' : 'O';
    state.outcome = result(state.board); state.turn = 1-state.turn; return true;
  }
  if (state.game === 'reaction' && action.type === 'tap' && state.phase === 'wait' && state.results[player] === null) {
    if (action.value !== 'early' && action.value !== 'dnf' && (!Number.isFinite(action.value) || action.value < 0 || action.value > 10000 || now < state.goAt-100)) return false;
    state.results[player] = action.value;
    if (state.results.every(x=>x!==null)) {
      state.phase = 'done';
      const scores=state.results.map(x=>typeof x==='number'?x:Infinity);
      if (scores[0]<scores[1]) state.wins[0]++;
      if (scores[1]<scores[0]) state.wins[1]++;
    }
    return true;
  }
  if (state.game === 'reaction' && action.type === 'abort' && state.phase === 'wait') {
    state.phase='idle'; state.results=[null,null]; return true;
  }
  return false;
}
let loading;
function loadPeer() {
  if (globalThis.Peer) return Promise.resolve(globalThis.Peer);
  if (!loading) loading=new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src=new URL('./vendor/peerjs-1.5.5.min.js',import.meta.url).href;
    const timeout=setTimeout(()=>{script.remove();loading=null;reject(new Error('Online play took too long to load. Check your connection and try again.'));},15000);
    script.onload=()=>{clearTimeout(timeout);resolve(globalThis.Peer);};
    script.onerror=()=>{clearTimeout(timeout);script.remove();loading=null;reject(new Error('Could not load online play. Check your internet and try again.'));};
    document.head.append(script);
  });
  return loading;
}
export class OnlineRoom {
  constructor(onChange, peerLoader=loadPeer) {
    this.onChange=onChange; this.peerLoader=peerLoader; this.status='off'; this.generation=0; this.timers=new Set();
  }
  changed() { this.onChange(this); }
  later(fn, delay) { const t=setTimeout(()=>{this.timers.delete(t);fn();},delay);this.timers.add(t);return t; }
  send(message) { if(this.conn?.open) this.conn.send(message); }
  fail(message) { this.leave(false);this.status='error';this.error=message;this.changed(); }
  async open(game, code) {
    this.leave(false); const generation=this.generation;
    this.game=game;this.host=!code;this.code=code||Array.from(crypto.getRandomValues(new Uint8Array(6)),x=>x.toString(16).padStart(2,'0')).join('');
    this.status='connecting';this.error='';this.state=null;this.remoteName='Friend';this.offset=0;this.samples=0;this.bestRtt=Infinity;this.revision=0;
    this.changed();
    try {
      const Peer=await this.peerLoader(); if(generation!==this.generation)return;
      this.peer=new Peer(this.host?'gameadda-v1-'+this.code:undefined);
      this.later(()=>{if(this.status==='connecting')this.fail('Connection timed out. Check the room code, keep the host tab open, or try a different network.');},25000);
      this.peer.on('open',()=>{
        if(generation!==this.generation)return;
        if(this.host){this.status='waiting';this.state=freshGame(game);this.changed();}
        else this.attach(this.peer.connect('gameadda-v1-'+this.code,{reliable:true,serialization:'json'}),generation);
      });
      this.peer.on('connection',conn=>{
        if(!this.host || this.conn){conn.on('open',()=>{conn.send({type:'full'});this.later(()=>conn.close(),150);});return;}
        this.attach(conn,generation);
      });
      this.peer.on('error',()=>{if(generation===this.generation)this.fail('Online connection failed. The room may be closed, full, or blocked by your network. Try creating a new room.');});
      this.peer.on('disconnected',()=>{if(generation===this.generation && this.status!=='connected')this.fail('The room service disconnected. Please create or join again.');});
    } catch(err) {if(generation===this.generation)this.fail(err.message);}
  }
  attach(conn,generation) {
    this.conn=conn;
    this.later(()=>{if(generation===this.generation && !conn.open)this.fail('Could not connect the two devices. Try a new room or a different network.');},25000);
    const live=()=>generation===this.generation;
    conn.on('open',()=>{
      if(!live())return;
      this.lastSeen=Date.now();this.status='connected';
      this.send({type:'hello',name:this.name||'Guest'});
      if(this.host)this.broadcast(); else this.ping();
      this.heartbeat();this.changed();
    });
    conn.on('data',data=>{if(live())this.receive(data);});
    conn.on('close',()=>{if(live())this.fail('Your friend disconnected. Create or join a new room to play again.');});
    conn.on('error',()=>{if(live())this.fail('Connection interrupted. Try a new room or a different network.');});
  }
  ping() { this.send({type:'ping',at:Date.now()}); }
  heartbeat() {
    this.later(()=>{
      if(this.status!=='connected')return;
      if(Date.now()-this.lastSeen>20000){this.fail('Your friend stopped responding. Create or join a new room.');return;}
      this.ping();this.heartbeat();
    },5000);
  }
  receive(data) {
    if(!data || typeof data!=='object')return;
    this.lastSeen=Date.now();
    if(data.type==='full'){this.fail('This room already has two players. Ask for a new room link.');return;}
    if(data.type==='hello') {this.remoteName=typeof data.name==='string'?data.name.slice(0,18):'Friend';this.changed();}
    if(data.type==='ping' && Number.isFinite(data.at))this.send({type:'pong',at:data.at,now:Date.now()});
    if(data.type==='pong' && Number.isFinite(data.at) && Number.isFinite(data.now)) {
      const rtt=Date.now()-data.at;
      if(!this.host && rtt>=0 && rtt<this.bestRtt){this.bestRtt=rtt;this.offset=data.now-(data.at+rtt/2);}
      if(!this.host && this.samples<5){this.samples++;this.later(()=>this.ping(),120);}
    }
    if(data.type==='state' && !this.host && Number.isInteger(data.revision) && data.revision>this.revision && ['tic','reaction'].includes(data.state?.game)) {
      this.revision=data.revision;this.state=data.state;this.game=data.state.game;this.changed();
    }
    if(data.type==='action' && this.host)this.action(data.action,1);
  }
  broadcast() {this.send({type:'state',state:this.state,revision:++this.revision});}
  action(action, player=this.host?0:1) {
    if(this.status!=='connected' || !this.state)return;
    if(!this.host) {this.send({type:'action',action});return;}
    if(applyAction(this.state,player,action)) {
      if(this.state.game==='reaction' && action.type==='reset') {
        const round=this.state.round;
        this.later(()=>{
          if(this.status!=='connected'||this.state.round!==round||this.state.phase!=='wait')return;
          for(let p=0;p<2;p++)if(this.state.results[p]===null)applyAction(this.state,p,{type:'tap',round,value:'dnf'});
          this.broadcast();this.changed();
        },this.state.goAt-Date.now()+10500);
      }
      this.broadcast();this.changed();
    }
  }
  leave(notify=true) {
    this.generation++;for(const t of this.timers)clearTimeout(t);this.timers.clear();
    const peer=this.peer;this.peer=null;this.conn=null;this.status='off';this.state=null;peer?.destroy();
    if(notify)this.changed();
  }
}
