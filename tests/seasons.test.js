import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weekKey,weekLabel } from '../src/seasons.js';

test('ranking week changes exactly at Monday 00:00 UTC',()=>{
  assert.equal(weekKey('2026-09-13T23:59:59Z'),'2026-W37');
  assert.equal(weekKey('2026-09-14T00:00:00Z'),'2026-W38');
  assert.equal(weekLabel('2026-W38'),'WEEK 38 · 2026');
});

test('ISO year boundaries use the correct week-year',()=>{
  assert.equal(weekKey('2027-01-01T12:00:00Z'),'2026-W53');
  assert.equal(weekKey('2027-01-04T00:00:00Z'),'2027-W01');
});
