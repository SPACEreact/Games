import { configured, onlineState, onOnlineChange, connectOnline, leaveOnline, onlineMove, onlineRematch, reconnectOnline } from "./online.js";
import { onlineTicHtml, onlineLobbyHtml } from "./online-view.js";

// GameAdda — dependency-free, client-side game playground.
// To add a game, register it in GAMES and add its renderer/handler below.
// Real-time multiplayer requires deploying the Cloudflare Worker in /worker.

const GAMES = [
  { id:"tic", title:"Tic-Tac-Toe", emoji:"⭕", tag:"CLASSIC", color:"lilac", description:"A tiny classic. Outsmart the board.", players:"Solo or local two-player" },
  { id:"rps", title:"Rock Paper Scissors", emoji:"✊", tag:"QUICK", color:"peach", description:"Three moves. One winner. Again?", players:"Solo vs computer" },
  { id:"memory", title:"Memory Flip", emoji:"🧠", tag:"BRAINY", color:"mint", description:"Turn cards over and find every matching pair.", players:"Solo challenge" },
  { id:"reaction", title:"Reaction Test", emoji:"⚡", tag:"FAST", color:"blue", description:"Wait for green. Then tap as fast as you can.", players:"Solo challenge" }
];
const $ = (sel) => document.querySelector(sel);
const e = (s) => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const read = (key) => { try { return localStorage.getItem(key) } catch { return null } };
const save = (key, value) => { try { localStorage.setItem(key, value) } catch {} };
let nick = read("gameadda-name") || "";
let menuOpen = false, modalOpen = false, pendingOnline = null;
const incomingRoom = (new URLSearchParams(location.search).get("room") || "").toUpperCase();
let active = incomingRoom ? "tic" : new URLSearchParams(location.search).get("game");
if (!GAMES.some(g => g.id === active)) active = "";
let view = active ? "game" : "home";
let tic = { board:Array(9).fill(""), turn:"X", mode:"cpu", busy:false };
let cpuTimer = null;
let rps = { you:null, cpu:null, wins:0, losses:0, draws:0 };
const FACES = ["🍋","🍓","🐸","🌈","🍉","🦊"];
let memory = newMemory();
let memoryTimer = null;
let reaction = { phase:"idle", started:0, last:null, best:read("gameadda-best-reaction") === null ? null : Number(read("gameadda-best-reaction")) };
let reactionTimer = null;
const WINS = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
const gameById = (id) => GAMES.find(g => g.id === id) || GAMES[0];

function newMemory() {
  const cards = [...FACES,...FACES].map((face,id)=>({face,id}));
  for (let i=cards.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [cards[i],cards[j]]=[cards[j],cards[i]] }
  return { cards, open:[], matched:[], moves:0, locked:false };
}
function winner(board) {
  for (const [a,b,c] of WINS) if (board[a] && board[a] === board[b] && board[b] === board[c]) return board[a];
  return board.every(Boolean) ? "draw" : null;
}
function stopTimers() {
  clearTimeout(cpuTimer); clearTimeout(memoryTimer); clearTimeout(reactionTimer);
  tic.busy = false;
  reaction.phase = reaction.phase === "wait" ? "idle" : reaction.phase;
}
function navigate(dest,id) {
  stopTimers();leaveOnline(true);pendingOnline=null;
  view=dest;active=dest==="game" ? id : "";
  if(dest==="game" && id==="tic")tic.mode="cpu";
  history.pushState({}, "", active ? "?game="+encodeURIComponent(active) : location.pathname);
  menuOpen=false;render();window.scrollTo({top:0,behavior:"instant"});
}
function beginOnlineGame(mode,room="") {
  if (!nick){pendingOnline={mode,room};modalOpen=true;render();return}
  stopTimers();tic.mode="online";view="game";active="tic";modalOpen=false;pendingOnline=null;
  history.replaceState({}, "", mode==="join" ? "?room="+encodeURIComponent(room) : "?game=tic");
  if(configured())connectOnline(mode,{code:room,name:nick});
  render();window.scrollTo({top:0,behavior:"instant"});
}
function brand() {
  return `<button class="brand" data-action="home" aria-label="GameAdda home"><span class="brand-icon">🎮</span><span><span class="brand-title">game<span>adda</span></span><span class="brand-sub">TINY GAMES. BIG FUN.</span></span></button>`;
}
function header() {
  return `<header class="site-header">
    ${brand()}
    <nav class="top-nav ${menuOpen?'open':''}" aria-label="Main navigation">
      <button class="nav-btn ${view==='home'?'active':''}" data-action="home">⌂ &nbsp; Games</button>
      <button class="nav-btn ${view==='rooms'?'active':''}" data-action="rooms">♧ &nbsp; Public rooms</button>
      <button class="nav-btn ${view==='about'?'active':''}" data-action="about">ⓘ &nbsp; How it works</button>
    </nav>
    <div style="display:flex;align-items:center;gap:8px"><button class="name-btn" data-action="nickname"><span class="online-dot"></span>${nick ? e(nick) : "Pick a nickname"} &nbsp;⌄</button><button class="menu-btn" data-action="menu" aria-label="Toggle navigation">☰</button></div>
  </header>`;
}
function footer() {
  return `<footer class="footer">${brand()}<span>Made for the little breaks in life. ✦</span><span>GameAdda · Browser games, no sign-up</span></footer>`;
}
function cardsHtml(filter="") {
  const list = GAMES.filter(g=>[g.title,g.description,g.tag].join(" ").toLowerCase().includes(filter.trim().toLowerCase()));
  if (!list.length) return '<div class="no-results">No games match that search yet. Try another word.</div>';
  return list.map(g=>`<article class="game-card ${g.color}">
    <div class="card-row"><span class="tag">${g.tag}</span><button class="round-link" data-game="${g.id}" aria-label="Play ${g.title}">↗</button></div>
    <button class="game-illustration" data-game="${g.id}" aria-label="Play ${g.title}">${g.emoji}</button>
    <div class="card-end"><h3>${g.title}</h3><p>${g.description}</p><span class="players-tag">♙ ${g.players}</span><button class="play-card-btn" data-game="${g.id}">Play now <span>↗</span></button></div>
  </article>`).join("");
}
function home() {
  return `<main><section class="hero">
    <div><div class="eyebrow">✦ YOUR NEW LITTLE HAPPY PLACE</div><h1>Got a minute?<br><em>Make it fun.</em></h1>
    <p>Quick little games for tiny breaks, big laughs, and friendly rivalries. No account. No fuss. Just play.</p>
    <div class="action-row"><button class="primary" data-game="tic">Play a game ↗</button><button class="secondary" data-action="rooms">♧ Find people to play with</button></div>
    <div class="benefits"><span><b>⚡</b>Instant play</span><span><b>◇</b>No account needed</span><span><b>◷</b>1–5 minute games</span></div></div>
    <div class="hero-art" aria-hidden="true"><div class="orbit"></div><div class="orbit b"></div><div class="art-chip one">✦</div><div class="art-chip two">✌️</div><div class="art-chip three">🎲</div><div class="art-controller">🎮</div><div class="art-note top"><span class="emoji">🎯</span><span><b>One more round?</b><small>Obviously.</small></span></div><div class="art-note bottom"><span class="emoji">💜</span><span><b>Good vibes only</b><small>Bring your best move.</small></span></div></div>
  </section>
  <section id="games"><div class="games-head"><div><div class="eyebrow">THE PLAYGROUND</div><h2>Pick your kind of fun<span class="period">.</span></h2><p>Little games, no big commitment.</p></div><label class="search-box">⌕ <input id="game-search" type="search" placeholder="Find a game..." aria-label="Find a game" autocomplete="off"></label></div>
  <div id="game-grid" class="game-grid">${cardsHtml()}</div>
  <div class="coming"><span class="coming-emoji">✨</span><div><b>More tiny games are on the way.</b><p>We keep adding playful little ideas. Bookmark your favourites!</p></div><span class="coming-label">MORE SOON</span></div>
  </section></main>`;
}
function currentStatus() {
  const result=winner(tic.board);
  if (result==="draw") return "It's a draw! Great game.";
  if (result==="X") return `${e(nick||"Player X")} wins! 🎉`;
  if (result==="O") return tic.mode==="cpu" ? "Computer wins this round!" : "Player O wins! 🎉";
  return tic.busy ? "Computer is thinking…" : (tic.turn==="X" ? e(nick||"Player X") : tic.mode==="cpu" ? "Computer" : "Player O") + "'s turn";
}
function ticHtml() {
  return `<div class="game-layout"><section class="play-surface"><div class="panel-meta"><span class="ready">READY TO PLAY</span><span>THREE IN A ROW</span></div>
    <div class="ttt-grid">${tic.board.map((cell,i)=>`<button data-cell="${i}" class="ttt-cell ${cell==='O'?'o':''}" ${cell||winner(tic.board)||tic.busy?'disabled':''} aria-label="Square ${i+1}">${cell==='X'?'×':cell==='O'?'○':''}</button>`).join("")}</div>
    <div class="ttt-status" role="status">${currentStatus()}</div>
    <div class="panel-actions"><button class="secondary" data-action="ttt-reset">↺ Reset board</button><button class="primary" data-action="ttt-reset">Play again ↗</button></div></section>
    <aside><div class="side-box"><h3>⚔ Game mode</h3><button class="mode-button ${tic.mode==='cpu'?'current':''}" data-mode="cpu"><span class="mode-icon">🤖</span><span><b>Vs computer</b><small>Play a solo round</small></span></button><button class="mode-button ${tic.mode==='local'?'current':''}" data-mode="local"><span class="mode-icon">👥</span><span><b>Two players</b><small>Pass and play on one device</small></span></button></div>
    <div class="tip"><b>💡 Little tip</b><p>Take the middle square early. It opens the most ways to make a line.</p></div></aside></div>`;
}
function rpsHtml() {
  const signs={rock:"✊",paper:"✋",scissors:"✌️"};
  let message="";
  if(rps.you){message=rps.you===rps.cpu ? "It's a draw!" : (rps.you==="rock"&&rps.cpu==="scissors")||(rps.you==="paper"&&rps.cpu==="rock")||(rps.you==="scissors"&&rps.cpu==="paper") ? "You win! 🎉" : "Computer wins!";
  }
  return `<div class="game-layout"><section class="play-surface"><div class="rps-scores"><div><small>WINS</small><b>${rps.wins}</b></div><div><small>DRAWS</small><b>${rps.draws}</b></div><div><small>LOSSES</small><b>${rps.losses}</b></div></div>
    <h2 class="rps-title">Make your move.</h2><p class="rps-desc">Rock beats scissors. Scissors beats paper. Paper beats rock.</p>
    <div class="rps-choices">${Object.entries(signs).map(([id,face])=>`<button data-rps="${id}" class="rps-choice ${id===rps.you?'chosen':''}"><span>${face}</span><b>${id[0].toUpperCase()+id.slice(1)}</b></button>`).join("")}</div>
    ${rps.you ? `<div class="rps-outcome"><div class="faceoff">${signs[rps.you]} &nbsp; VS &nbsp; ${signs[rps.cpu]}</div><strong>${message}</strong></div>` : ""}
    <div class="panel-actions"><button class="secondary" data-action="rps-reset">↺ Reset scores</button></div></section><aside><div class="tip"><b>🎲 Just one more?</b><p>Each round is a new chance to outguess the computer.</p></div></aside></div>`;
}
function memoryHtml() {
  const done=memory.matched.length===memory.cards.length;
  return `<section class="play-surface memory-wrap"><div class="memory-top"><span>Moves: <b>${memory.moves}</b></span><span>Pairs: <b>${memory.matched.length/2}/6</b></span></div>
    <p class="rps-desc">Flip two cards. Remember where the matching pictures are hiding.</p>
    <div class="memory-grid">${memory.cards.map((c,i)=>`<button class="memory-card ${memory.open.includes(i)||memory.matched.includes(i)?'revealed':''}" data-memory="${i}" aria-label="Memory card ${i+1}" ${memory.matched.includes(i)?'disabled':''}>${memory.open.includes(i)||memory.matched.includes(i)?c.face:"✦"}</button>`).join("")}</div>
    ${done ? `<div class="memory-success">🎉 All pairs found in ${memory.moves} moves!</div>` : ""}
    <button class="primary" data-action="memory-reset">↺ New shuffle</button></section>`;
}
function reactionHtml() {
  const text={idle:["👆","Tap to start","Wait for green. Then tap as fast as you can."],wait:["🟡","Wait for green…","Get ready. Don't tap early!"],go:["🟢","TAP NOW!","Go go go!"],early:["😅","Too early!","False start. Tap to try again."],done:["⚡",reaction.last+" ms","Tap to try again."]}[reaction.phase];
  return `<div class="reaction-wrap"><button class="reaction-pad ${reaction.phase}" data-action="reaction"><span class="reaction-emoji">${text[0]}</span><strong>${text[1]}</strong><small>${text[2]}</small></button><div class="reaction-metrics"><div><small>LAST RESULT</small><b>${reaction.last===null?'—':reaction.last+' ms'}</b></div><div><small>PERSONAL BEST</small><b>${reaction.best===null?'—':reaction.best+' ms'}</b></div></div></div>`;
}
function gamePage() {
  const game=gameById(active);
  const content=game.id==="tic"?ticHtml():game.id==="rps"?rpsHtml():game.id==="memory"?memoryHtml():reactionHtml();
  return `<main class="inner"><button class="back" data-action="home">← All games</button><div class="page-heading"><div><div class="eyebrow">NOW PLAYING</div><h1>${game.emoji} ${game.title}</h1><p>${game.description}</p></div><button class="secondary" data-action="share">↗ Share game link</button></div>
    ${content}<div class="notice"><span>🛡️</span><span><strong>First release:</strong> these games run in your browser. Sharing a game link opens the same game for a friend; it does not connect your two devices. Live rooms and stranger matchmaking will be added in a future update.</span></div></main>`;
}
function roomsPage() {
  return `<main class="inner"><div class="eyebrow">THE SOCIAL SIDE</div><h1>Public rooms<span class="period">.</span></h1><p class="page-sub">Quick games with other people, without accounts or passwords.</p>
  <section class="empty-lobby"><div class="big-icon">👥</div><h2>The lobby is warming up.</h2><p>Public matchmaking is not connected in this version yet. Our four solo and local games are ready right now.</p><button class="primary" data-action="home">Explore games ↗</button></section>
  <div class="notice">🛡️ Guest nicknames are stored in your browser only. We don't ask for an email or password.</div></main>`;
}
function aboutPage() {
  return `<main class="inner"><div class="eyebrow">SIMPLE BY DESIGN</div><h1>How GameAdda works<span class="period">.</span></h1><p class="page-sub">Open the site. Pick a game. Have a little fun. That's it.</p>
  <div class="how-grid"><article class="how-card"><span>01</span><h3>Pick a nickname</h3><p>Choose any display name. No email, password, or profile is required.</p></article><article class="how-card"><span>02</span><h3>Find a tiny game</h3><p>Easy to learn, quick to finish, and fun to replay.</p></article><article class="how-card"><span>03</span><h3>Share a link</h3><p>Send a direct link to your favourite game. Real-time rooms are planned for later.</p></article></div>
  <div class="notice"><span>🔒</span><span><strong>Privacy:</strong> This version keeps your nickname and Reaction Test personal best in your device's local storage. It doesn't have accounts, analytics, advertising, chat, or a server database. If ads or analytics are added later, the privacy information will be updated before launch.</span></div></main>`;
}
function dialog() {
  return `<div class="dialog-shade" data-action="shade"><div class="dialog" role="dialog" aria-modal="true" aria-labelledby="nickname-title"><button class="close-dialog" data-action="close-modal" aria-label="Close">×</button><div class="dialog-emoji">👋</div><h2 id="nickname-title">What should we call you?</h2><p>Pick a fun nickname. No signup, no password.</p><form id="nick-form"><input id="nickname-input" maxlength="18" autocomplete="nickname" placeholder="e.g. Tiger27" value="${e(nick)}" aria-label="Nickname" required><button class="primary" type="submit">Let's play ↗</button></form><small class="dialog-foot">Your nickname stays on this device.</small></div></div>`;
}
function render() {
  const container=$("#app");
  container.innerHTML=`<div class="wrap">${header()}${view==="home"?home():view==="game"?gamePage():view==="rooms"?roomsPage():aboutPage()}${footer()}</div>${modalOpen?dialog():""}`;
  if(modalOpen) $("#nickname-input")?.focus();
}
function resetTic(mode=tic.mode) {clearTimeout(cpuTimer);tic={board:Array(9).fill(""),turn:"X",mode,busy:false};render()}
function strategicChoice(board,mark) {
  for(const [a,b,c] of WINS) {const cells=[a,b,c], taken=cells.filter(i=>board[i]===mark), empty=cells.filter(i=>!board[i]);if(taken.length===2&&empty.length===1)return empty[0]}
  return -1;
}
function cpuMove() {
  if(view!=="game"||active!=="tic"||tic.mode!=="cpu"||winner(tic.board))return;
  const open=tic.board.map((x,i)=>x?-1:i).filter(i=>i!==-1);
  if(!open.length)return;
  let chosen=strategicChoice(tic.board,"O");
  if(chosen<0)chosen=strategicChoice(tic.board,"X");
  if(chosen<0 && !tic.board[4])chosen=4;
  if(chosen<0)chosen=open[Math.floor(Math.random()*open.length)];
  tic.board[chosen]="O";tic.turn="X";tic.busy=false;render();
}
function ticMove(pos) {
  if(tic.board[pos]||winner(tic.board)||tic.busy)return;
  tic.board[pos]=tic.turn;
  if(!winner(tic.board)) {
    tic.turn=tic.turn==="X"?"O":"X";
    if(tic.mode==="cpu"){tic.busy=true;cpuTimer=setTimeout(cpuMove,420)}
  }
  render();
}
function rpsMove(choice) {
  const options=["rock","paper","scissors"];
  const comp=options[Math.floor(Math.random()*3)];
  rps.you=choice;rps.cpu=comp;
  if(choice===comp)rps.draws++;
  else if((choice==="rock"&&comp==="scissors")||(choice==="paper"&&comp==="rock")||(choice==="scissors"&&comp==="paper"))rps.wins++;
  else rps.losses++;
  render();
}
function memoryFlip(i) {
  if(memory.locked||memory.open.includes(i)||memory.matched.includes(i))return;
  memory.open.push(i);
  if(memory.open.length===2){
    memory.moves++;
    const [a,b]=memory.open;
    memory.locked=true;
    if(memory.cards[a].face===memory.cards[b].face){
      memoryTimer=setTimeout(()=>{memory.matched.push(a,b);memory.open=[];memory.locked=false;render()},380);
    } else memoryTimer=setTimeout(()=>{memory.open=[];memory.locked=false;render()},850);
  }
  render();
}
function reactionTap(){
  if(reaction.phase==="idle"||reaction.phase==="early"||reaction.phase==="done"){
    clearTimeout(reactionTimer);reaction.phase="wait";reaction.last=null;
    reactionTimer=setTimeout(()=>{reaction.phase="go";reaction.started=performance.now();render()},1200+Math.random()*2400);
  } else if(reaction.phase==="wait"){
    clearTimeout(reactionTimer);reaction.phase="early";
  } else if(reaction.phase==="go"){
    reaction.last=Math.round(performance.now()-reaction.started);reaction.phase="done";
    if(reaction.best===null||reaction.last<reaction.best){reaction.best=reaction.last;save("gameadda-best-reaction",String(reaction.last))}
  }
  render();
}
async function shareGame() {
  const g=gameById(active),url=new URL(location.href);url.search="?game="+encodeURIComponent(g.id);
  try {
    if(navigator.share){await navigator.share({title:"Play "+g.title+" on GameAdda",url:url.toString()});return}
    if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(url.toString());alert("Game link copied!");return}
  } catch(err){if(err.name==="AbortError")return}
  prompt("Copy this game link:",url.toString());
}
document.addEventListener("click",event=>{
  const target=event.target.closest("button,[data-action]");
  if(!target)return;
  const game=target.getAttribute("data-game");
  const action=target.getAttribute("data-action");
  const cell=target.getAttribute("data-cell");
  const rpsOpt=target.getAttribute("data-rps");
  const mem=target.getAttribute("data-memory");
  const mode=target.getAttribute("data-mode");
  if(game){navigate("game",game);return}
  if(cell!==null){ticMove(Number(cell));return}
  if(rpsOpt){rpsMove(rpsOpt);return}
  if(mem!==null){memoryFlip(Number(mem));return}
  if(mode){resetTic(mode);return}
  if(action==="home"||action==="rooms"||action==="about")navigate(action);
  else if(action==="menu"){menuOpen=!menuOpen;render()}
  else if(action==="nickname"){modalOpen=true;render()}
  else if(action==="close-modal"||action==="shade"&&target===event.target){modalOpen=false;render()}
  else if(action==="share")shareGame();
  else if(action==="ttt-reset")resetTic();
  else if(action==="rps-reset"){rps={you:null,cpu:null,wins:0,losses:0,draws:0};render()}
  else if(action==="memory-reset"){clearTimeout(memoryTimer);memory=newMemory();render()}
  else if(action==="reaction")reactionTap();
});
document.addEventListener("submit",event=>{
  if(event.target.id!=="nick-form")return;
  event.preventDefault();
  const input=$("#nickname-input"),clean=input.value.trim().replace(/\s+/g," ").slice(0,18);
  if(!clean)return;
  nick=clean;save("gameadda-name",nick);modalOpen=false;render();
});
document.addEventListener("input",event=>{
  if(event.target.id==="game-search")$("#game-grid").innerHTML=cardsHtml(event.target.value);
});
document.addEventListener("keydown",event=>{if(event.key==="Escape"&&modalOpen){modalOpen=false;render()}});
window.addEventListener("popstate",()=>{
  stopTimers();
  const id=new URLSearchParams(location.search).get("game");
  active=GAMES.some(g=>g.id===id)?id:"";
  view=active?"game":"home";render();
});
render();
