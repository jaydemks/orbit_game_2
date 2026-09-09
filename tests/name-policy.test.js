import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeName,validateAlias } from '../src/name-policy.js';

test('nickname policy accepts a simple public identity',()=>{
  assert.deepEqual(validateAlias('Star Pilot'),{ok:true,alias:'Star Pilot'});
  assert.equal(validateAlias('').ok,true);
});

test('nickname policy rejects markup, impersonation and obfuscated abuse',()=>{
  for(const alias of ['<script>','Orbit Admin','m3rda','f.u.c.k','shiiit'])assert.equal(validateAlias(alias).ok,false,alias);
  assert.equal(normalizeName('M_3-R.D A'),'merda');
});
