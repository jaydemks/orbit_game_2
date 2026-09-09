import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../src/levels.js';
import {readProgress,saveProgress,awardCompletion} from '../src/progress.js';
test('corrupt saves fall back to valid playable defaults',()=>{
  assert.equal(readProgress({getItem:()=>'{broken'}).unlocked,1);
  const p=readProgress({getItem:()=>JSON.stringify({bank:-9,unlocked:100,owned:['fake'],skin:'fake',quality:'ultra'})});
  assert.equal(p.bank,0);assert.equal(p.unlocked,LEVELS.length);assert.deepEqual(p.owned,['glacier']);assert.equal(p.skin,'glacier');assert.equal(p.quality,'high');
});
test('completion persists earnings and unlocks sequential levels; replay cannot reduce record',()=>{
  const p=readProgress({getItem:()=>null});
  const first=awardCompletion(p,0,{coins:8,time:100,score:900,lives:3});
  assert.equal(first,53);assert.equal(p.unlocked,2);assert.equal(p.bank,53);
  awardCompletion(p,0,{coins:1,time:30,score:20,lives:1});
  assert.equal(p.best[0].score,900);assert.equal(p.best[0].stars,3);
  let saved;assert.equal(saveProgress(p,{setItem:(key,value)=>saved=value}),true);
  assert.equal(readProgress({getItem:()=>saved}).bank,p.bank);
});
test('storage unavailable returns false instead of breaking the game',()=>{
  assert.equal(saveProgress({}, {setItem:()=>{throw Error('Quota')}}),false);
});

test('ORBIT 2 owns its save namespace and keeps Extreme records separate',()=>{
  const readKeys=[],written=[];
  const p=readProgress({getItem:key=>{readKeys.push(key);return null;}});
  awardCompletion(p,0,{difficulty:'extreme',score:100,time:60,lives:3});
  assert.equal(p.best[0],undefined);assert.equal(p.extremeBest[0].score,100);
  saveProgress(p,{setItem:key=>written.push(key)});
  assert.deepEqual(readKeys,['orbit2.progress.v1']);assert.deepEqual(written,['orbit2.progress.v1']);
});

test('players who finished the former final level unlock the new expedition and preserve independent volumes',()=>{
  const p=readProgress({getItem:()=>JSON.stringify({unlocked:32,best:{31:{score:1200}},musicVolume:0,effectsVolume:.8})});
  assert.equal(p.unlocked,33);assert.equal(p.musicVolume,0);assert.equal(p.effectsVolume,.8);
});
