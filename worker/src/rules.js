// Pure, testable Tic-Tac-Toe rules. Never trust a browser-reported win or move.
const WINS=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];

export function winner(board) {
  for (const [a,b,c] of WINS) if (board[a] && board[a]===board[b] && board[a]===board[c]) return board[a];
  return board.every(Boolean) ? "draw" : null;
}
export function cleanName(value) {
  if (typeof value !== "string") return "Guest";
  const name=value.replace(/[\u0000-\u001F\u007F<>]/g,"").replace(/\s+/g," ").trim().slice(0,18);
  return name || "Guest";
}
export function validCode(code) {
  return typeof code==="string" && /^[A-HJ-NP-Z2-9]{8}$/.test(code);
}
