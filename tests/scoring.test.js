import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateScore } from '../src/scoring.js';

test('score combines progress, normalized pace, survival and exploration',()=>{
  const score=calculateScore({level:9,difficulty:'easy',time:110.5,baseTime:221,lives:2,items:{coin:4,key:2,fruit:1,time:0}});
  assert.deepEqual(score,{completion:1450,collectibles:1400,pace:750,survival:300,multiplier:1,subtotal:3900,total:3900,counts:{coin:4,key:2,fruit:1,time:0}});
});

test('Extreme applies a 35 percent premium and time bonus is capped',()=>{
  const easy=calculateScore({level:0,difficulty:'easy',time:999,baseTime:150,lives:3});
  const extreme=calculateScore({level:0,difficulty:'extreme',time:999,baseTime:150,lives:3});
  assert.equal(easy.pace,1500);assert.equal(easy.total,3250);assert.equal(extreme.total,4388);
});

test('a clock extends available time instead of granting an inflated pace ratio',()=>{
  const score=calculateScore({time:90,baseTime:150,lives:1,items:{time:1}});
  assert.equal(score.pace,750);assert.equal(score.collectibles,50);
});
