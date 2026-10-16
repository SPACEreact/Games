import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshGame, applyAction, OnlineRoom, roomPattern } from '../src/friend-room.js';

test('tic enforces ownership, legal cells, round identity, wins and host reset',()=>{
  const s=freshGame('tic');
  const move=(p,cell,round=0)=>applyAction(s,p,{type:'move',cell,round});
  assert.equal(move(1,0),false); assert.equal(move(0,-1),false);assert.equal(move(0,0,3),false);
  assert.equal(move(0,0),true);assert.equal(move(1,0),false);
  move(1,3);move(0,1);move(1,4);move(0,2);
  assert.equal(s.outcome,'X');assert.equal(move(1,8),false);
  assert.equal(applyAction(s,1,{type:'reset'}),false);
  assert.equal(applyAction(s,0,{type:'reset'}),true);assert.equal(s.round,1);assert.deepEqual(s.board,Array(9).fill(''));
});
test('reaction rejects duplicate, stale, premature and invalid scores; counts wins once',()=>{
  const s=freshGame('reaction');applyAction(s,0,{type:'reset'},1000);
  const tap=(p,value,round=s.round,now=s.goAt+1000)=>applyAction(s,p,{type:'tap',value,round},now);
  assert.equal(tap(0,200,0),false);assert.equal(tap(0,-1),false);assert.equal(tap(0,NaN),false);
  assert.equal(tap(0,100,1,1000),false);
  assert.equal(tap(0,240),true);assert.equal(tap(0,100),false);assert.equal(tap(1,310),true);
  assert.equal(s.phase,'done');assert.deepEqual(s.wins,[1,0]);assert.equal(tap(1,200),false);
  applyAction(s,0,{type:'reset'},1000);tap(0,'early');tap(1,400);assert.deepEqual(s.wins,[1,1]);
  applyAction(s,0,{type:'reset'},1000);tap(0,'dnf');tap(1,'dnf');assert.deepEqual(s.wins,[1,1]);
  applyAction(s,0,{type:'reset'},1000);assert.equal(applyAction(s,1,{type:'abort',round:s.round}),true);assert.equal(s.phase,'idle');
});
class Emitter { constructor(){this.listeners={};} on(k,fn){(this.listeners[k]??=[]).push(fn);} emit(k,v){for(const fn of this.listeners[k]||[])fn(v);} }
const peers=new Map();
class FakePeer extends Emitter {
  constructor(id='guest-'+Math.random()){super();this.id=id;peers.set(id,this);queueMicrotask(()=>this.emit('open',id));}
  connect(id){
    const a=new Emitter(),b=new Emitter();a.open=b.open=false;
    a.send=d=>queueMicrotask(()=>b.emit('data',structuredClone(d)));b.send=d=>queueMicrotask(()=>a.emit('data',structuredClone(d)));
    a.close=b.close=()=>{a.open=b.open=false;a.emit('close');b.emit('close');};this.conn=a;
    queueMicrotask(()=>{peers.get(id).conn=b;peers.get(id).emit('connection',b);a.open=b.open=true;b.emit('open');a.emit('open');});return a;
  }
  destroy(){peers.delete(this.id);if(this.conn?.open)this.conn.close();}
}
const flush=()=>new Promise(r=>setImmediate(r));
test('two rooms synchronize moves/rematches and notify on disconnect',async()=>{
  const host=new OnlineRoom(()=>{},async()=>FakePeer),guest=new OnlineRoom(()=>{},async()=>FakePeer);
  try {
    host.name='Host';guest.name='Friend';await host.open('tic');await flush();assert.match(host.code,roomPattern);
    await guest.open('tic',host.code);await flush();assert.equal(host.status,'connected');assert.equal(guest.remoteName,'Host');
    host.action({type:'move',cell:0,round:0});await flush();assert.equal(guest.state.board[0],'X');
    guest.action({type:'move',cell:4,round:0});await flush();assert.equal(host.state.board[4],'O');assert.deepEqual(host.state,guest.state);
    host.action({type:'reset'});await flush();assert.equal(guest.state.round,1);
    guest.leave();await flush();assert.equal(host.status,'error');
  } finally {host.leave();guest.leave();}
});
