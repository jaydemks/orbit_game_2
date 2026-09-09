import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';
import { RunRecorder,validateReplay,parseSubmission,RULESET,MAX_TICKS } from '../src/replay.js';
import { submissionBody } from '../src/leaderboard.js';

function finishFirst(difficulty='easy') {
  const game=new Game();game.setDifficulty(difficulty);game.start(0);
  const recorder=new RunRecorder(game);recorder.start();
  if(difficulty==='easy')for(let i=0;i<5;i++){while(game.cooldown>0)recorder.update();recorder.action('forward');}
  else {
    for(let i=0;i<600&&game.state==='playing';i++){recorder.input({forward:game.physics.position[2]>-4.4});recorder.update();}
  }
  assert.equal(game.state,'won');return {game,recorder,replay:recorder.export()};
}
test('fixed-step Easy replay reproduces authoritative score and ignores client-claimed points',()=>{
  const {game,replay}=finishFirst();
  const result=validateReplay({...replay,score:999999999});
  assert.equal(result.score,game.score);assert.equal(result.lives,3);
  assert.equal(parseSubmission(submissionBody(replay,'Star Pilot')).alias,'Star Pilot');
});
test('fixed-step Extreme input replay completes with identical score',()=>{
  const {game,replay}=finishFirst('extreme');assert.equal(validateReplay(replay).score,game.score);
});
test('forged wins, impossible timing, malicious data and old rulesets are rejected',()=>{
  const {replay}=finishFirst();
  for(const forged of [{...replay,events:[]},{...replay,ticks:0},{...replay,version:'old'},{...replay,ticks:MAX_TICKS+1},{...replay,events:[[NaN,0]]},{...replay,events:[[1,0],[0,0]]},{...replay,events:[[0,999]]}])assert.throws(()=>validateReplay(forged));
  assert.throws(()=>parseSubmission(submissionBody(replay).replace('"alias":""','"alias":"<script>alert(1)</script>"')));
  assert.throws(()=>parseSubmission('x'.repeat(60001)));
  assert.throws(()=>validateReplay({version:RULESET,level:0,difficulty:'easy',ticks:0,events:Array.from({length:5},()=>[0,0])}));
});
test('failed controls do not grow the replay; pause does not advance its clock',()=>{
  const game=new Game();game.start(0);const recorder=new RunRecorder(game);recorder.start();
  recorder.action('forward');for(let i=0;i<100;i++)recorder.action('forward');assert.equal(recorder.events.length,1);
  game.pause(true);recorder.update();assert.equal(recorder.tick,0);
});
