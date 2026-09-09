import { test } from 'node:test';
import assert from 'node:assert/strict';
import { updateBoard,storeVerified } from '../scripts/rankings-store.mjs';
import { processSubmission } from '../scripts/validate-submission.mjs';
import { Game } from '../src/game.js';
import { RunRecorder } from '../src/replay.js';
import { submissionBody } from '../src/leaderboard.js';
const identity={id:123,login:'player',alias:'Star Pilot'};
const result={score:100,level:0,difficulty:'easy',ticks:120,version:'test'};
test('rankings count one best per level, identity, ruleset and difficulty; no replay farming',()=>{
  const first=updateBoard({runs:[]},result,identity,1,'digest');
  const worse=updateBoard(first.board,{...result,score:90},identity,2,'digest2');
  assert.equal(worse.improved,false);assert.equal(worse.board.runs.length,1);
  const improved=updateBoard(first.board,{...result,score:120},identity,3,'digest3');
  assert.equal(improved.board.runs.length,1);assert.equal(improved.board.runs[0].score,120);
  const other=updateBoard(improved.board,{...result,difficulty:'extreme'},identity,4,'digest4');
  assert.equal(other.board.runs.length,2);
});
test('a concurrent write retries from the latest board and preserves the other player',async()=>{
  let writes=0;const other={...result,userId:999,username:'other'};
  const api=async(method,path,data)=>{
    if(method==='GET')return {sha:String(writes),content:Buffer.from(JSON.stringify({runs:writes?[other]:[]})).toString('base64')};
    writes++;if(writes===1){const error=Error('conflict');error.status=409;throw error;}
    const saved=JSON.parse(Buffer.from(data.content,'base64'));
    assert.equal(saved.runs.length,2);assert.equal(saved.runs[0].userId,999);assert.equal(data.sha,'1');
  };
  assert.equal(await storeVerified(api,result,identity,3,'hash'),true);assert.equal(writes,2);
});

test('submission handler binds scores to GitHub author, validates and closes; forged score is never written',async()=>{
  const game=new Game();game.start(0);const recorder=new RunRecorder(game);recorder.start();
  for(let i=0;i<5;i++){while(game.cooldown>0)recorder.update();recorder.action('forward');}
  const replay={...recorder.export(),username:'someone-else',score:999999999};
  const calls=[],api=async(method,path,data)=>{
    calls.push({method,path,data});
    if(method==='GET')return {sha:'current',content:Buffer.from('{"runs":[]}').toString('base64')};
    return {};
  };
  const issue={number:42,title:'[ORBIT RUN] level 1',user:{type:'User',id:123,login:'real-author'},body:submissionBody(replay,'Star Pilot')};
  const accepted=await processSubmission({issue},api);assert.equal(accepted.status,'verified');
  const saved=JSON.parse(Buffer.from(calls.find(c=>c.method==='PUT').data.content,'base64'));
  assert.equal(saved.runs[0].username,'real-author');assert.equal(saved.runs[0].score,game.score);
  assert.equal(calls.at(-1).data.state,'closed');
  calls.length=0;
  const rejected=await processSubmission({issue:{...issue,body:submissionBody({...replay,events:[]})}},api);
  assert.equal(rejected.status,'rejected');assert.equal(calls.some(c=>c.method==='PUT'),false);
});
