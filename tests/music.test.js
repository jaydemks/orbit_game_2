import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ShuffleBag } from '../src/music.js';
test('music shuffle visits every song and never repeats at bag boundaries', () => {
  const tracks = Array.from({length:10}, (_, i) => `Track_${i+1}`);
  const bag = new ShuffleBag(tracks, () => .42);
  const played = Array.from({length:100}, () => bag.next());
  for (let i=1;i<played.length;i++) assert.notEqual(played[i], played[i-1]);
  for (let i=0;i<100;i+=10) assert.equal(new Set(played.slice(i,i+10)).size,10);
});
test('absent music uses fallback; a single song is never immediately repeated', () => {
  assert.equal(new ShuffleBag([]).next(),null);
  const bag = new ShuffleBag(['one']); assert.equal(bag.next(),'one'); assert.equal(bag.next(),null);
});
