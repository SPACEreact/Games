import { onlineState } from "./online.js";

const escapeHTML=(v)=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

export function onlineTicHtml(){
  const s=onlineState(),m=s.snapshot;
  const warning=!s.configured
    ? '<div class="online-warning"><b>⚙ Online server needs connecting</b><p>The backend is saved in GitHub. Deploy it on Cloudflare, then set the URL in src/online-config.js.</p></div>'
    : s.phase==="error"||s.phase==="disconnected"
    ? '<div class="online-warning"><b>⚠ '+escapeHTML(s.message)+'</b><p>Reconnect from this browser to resume your room.</p><button class="secondary" data-action="online-reconnect">↻ Reconnect</button></div>'
    : "";
  if(!m) {
    const waiting=s.configured && s.phase!=="error" && s.phase!=="disconnected"
      ? '<div class="online-standby"><span>🕹️</span><h2>'+(s.phase==="waiting"?"Looking for an opponent…":"Connecting…")+'</h2><p>'+escapeHTML(s.message||"Preparing your match…")+'</p></div>' : "";
    return '<div class="game-layout"><section class="play-surface">'+warning+waiting+'<div class="panel-actions"><button class="secondary" data-action="online-leave">← Back to the lobby</button></div></section><aside><div class="tip"><b>🔗 Invite or match</b><p>Create a private room, send the room link, or find a random stranger online.</p></div></aside></div>';
  }
  const ready=!!m.players?.O,finished=!!m.winner;
  const other=m.you==="X"?"O":"X";
  const turn=ready && m.turn===m.you && !finished && m.online?.X && m.online?.O;
  let label=!ready ? "Waiting for a friend to join…" : !m.online?.[other] ? "Opponent offline. Waiting for reconnect…" : finished
    ? m.winner==="draw" ? "It's a draw!" : m.winner===m.you ? "You won! 🎉" : "Your opponent won this round."
    : turn ? "Your turn — make a move!" : "Waiting for your opponent's turn…";
  const board=m.board.map((v,i)=>'<button class="ttt-cell '+(v==="O"?"o":"")+'" data-online-cell="'+i+'" aria-label="Square '+(i+1)+'" '+(v||!turn?"disabled":"")+'>'+(v==="X"?"×":v==="O"?"○":"")+'</button>').join("");
  const rematch=finished ? '<button class="primary" data-action="online-rematch" '+(m.rematch?.[m.you]?"disabled":"")+'>'+(m.rematch?.[m.you]?"Waiting for rematch…":"↻ Request rematch")+'</button>' : "";
  return '<div class="game-layout"><section class="play-surface">'
    +'<div class="panel-meta"><span class="ready">LIVE MULTIPLAYER</span><span>ROOM '+escapeHTML(m.room)+'</span></div>'
    +'<div class="online-player-row"><div><b>'+escapeHTML(m.players.X||"Player X")+'</b><small>× '+(m.online.X?"Online":"Away")+(m.you==="X"?" (you)":"")+'</small></div><span>VS</span><div><b>'+escapeHTML(m.players.O||"Waiting…")+'</b><small>○ '+(m.online.O?"Online":"Away")+(m.you==="O"?" (you)":"")+'</small></div></div>'
    +'<div class="ttt-grid">'+board+'</div><div class="ttt-status" role="status">'+escapeHTML(label)+'</div>'
    +'<div class="panel-actions">'+rematch+'<button class="secondary" data-action="online-leave">Leave game</button></div>'+warning+'</section>'
    +'<aside><div class="side-box"><h3>🔗 Online room</h3><div class="room-code">'+escapeHTML(m.room)+'</div>'
    +'<p class="side-description">Share your room link with a friend to connect across the internet.</p><button class="primary online-wide" data-action="share">Share room link ↗</button></div>'
    +'<div class="tip"><b>🛡 Fair play</b><p>The game server validates each move. Both players play from their own phone or computer.</p></div></aside></div>';
}
export function onlineLobbyHtml(){
  const online=onlineState().configured;
  return '<main class="inner"><div class="eyebrow">THE SOCIAL SIDE</div><h1>Play with anyone<span class="period">.</span></h1>'
    +'<p class="page-sub">Online Tic-Tac-Toe. Two people, anywhere in the world, without accounts.</p>'
    +'<div class="online-cards"><article class="side-box"><div class="online-card-emoji">🌍</div><h2>Random opponent</h2><p>Join the queue and match with another visitor who is also looking for a game.</p><button class="primary online-wide" data-online-action="random">Find opponent ↗</button></article>'
    +'<article class="side-box"><div class="online-card-emoji">🔗</div><h2>Private room</h2><p>Make a room, share the link, and play live with a friend.</p><button class="primary online-wide" data-online-action="create">Create private room ↗</button></article>'
    +'<article class="side-box"><div class="online-card-emoji">🎟️</div><h2>Join room</h2><p>Already have a room code? Paste it below.</p><form id="room-code-form"><input id="room-code-input" maxlength="8" placeholder="8-character code" aria-label="Room code" autocomplete="off" required><button class="secondary online-wide" type="submit">Join room →</button></form></article></div>'
    +(online?'<div class="notice">🛡️ <span><strong>For guest players:</strong> your nickname is not a verified identity. No chat, no profile, and no password needed.</span></div>'
     :'<div class="notice">⚙ <span><strong>Server not live yet:</strong> the multiplayer code needs a Cloudflare deployment and a Worker URL in <code>src/online-config.js</code>. Solo games continue to work.</span></div>')
    +'</main>';
}
