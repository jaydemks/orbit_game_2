import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyModeration } from '../scripts/moderate-rankings.mjs';
import { emptyModeration,moderateIdentity } from '../scripts/moderation-policy.mjs';

const board={runs:[{userId:7,username:'player',alias:'Bright Star',score:10},{userId:8,username:'other',alias:'Cloud Nine',score:20}]};

test('owner can ban a GitHub identity or replace and remove its nickname',()=>{
  let state=applyModeration(board,emptyModeration(),'force_alias',7,'Safe Pilot');
  assert.equal(state.board.runs[0].alias,'Safe Pilot');
  assert.deepEqual(moderateIdentity({id:7,alias:'Anything'},state.policy),{ok:true,alias:'Safe Pilot',forced:true});
  state=applyModeration(state.board,state.policy,'remove_alias',7,'');
  assert.equal(state.board.runs[0].alias,'');
  state=applyModeration(state.board,state.policy,'ban',7,'');
  assert.equal(state.board.runs.some(run=>run.userId===7),false);
  assert.equal(moderateIdentity({id:7,alias:''},state.policy).ok,false);
});

test('owner can remove one run without removing the player',()=>{
  const runs=[...board.runs,{userId:7,username:'player',alias:'Bright Star',score:30,level:1,difficulty:'extreme'}];
  const state=applyModeration({runs},emptyModeration(),'remove_run',7,'',{difficulty:'extreme',level:'2'});
  assert.equal(state.board.runs.some(run=>run.userId===7&&run.difficulty==='extreme'&&run.level===1),false);
  assert.equal(state.board.runs.some(run=>run.userId===7),true);
});

test('a blacklisted term is hashed, removed from existing names and blocked in future names',()=>{
  const state=applyModeration(board,emptyModeration(),'blacklist_term','', 'bright');
  assert.equal(state.board.runs[0].alias,'');
  assert.equal(JSON.stringify(state.policy).includes('bright'),false);
  assert.equal(moderateIdentity({id:99,alias:'Bright Future'},state.policy).ok,false);
  assert.equal(moderateIdentity({id:99,alias:'Cloud Rider'},state.policy).ok,true);
});
