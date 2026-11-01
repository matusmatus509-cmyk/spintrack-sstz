import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSstzGuard} from '../server/sstzRequestGuard.js';
import {refreshFailure, refreshSuccess} from '../src/utils/sstzRefreshPolicy.ts';
test('429 respects Retry-After and blocks further same-origin requests without blocking other sources',async()=>{
 let now=0,calls=0;
 const guard=createSstzGuard({now:()=>now,request:async()=>{calls++;return new Response('',{status:429,headers:{'retry-after':'3600'}});}});
 await guard.fetch('https://www.sstz.sk/first');
 await assert.rejects(guard.fetch('https://www.sstz.sk/page2'),e=>e.status===429);assert.equal(calls,1);
 await guard.fetch('https://www.stolnytenis.info/other');assert.equal(calls,2);
 now=3600001;await guard.fetch('https://www.sstz.sk/first');assert.equal(calls,3);
});
test('concurrent career imports share one request, successful imports are cached, failures can retry',async()=>{
 let now=0,calls=0;const guard=createSstzGuard({now:()=>now});const load=async()=>{calls++;return {complete:true};};
 const values=await Promise.all([guard.load('player',load),guard.load('player',load)]);assert.equal(calls,1);assert.deepEqual(values[0],values[1]);
 await guard.load('player',load);assert.equal(calls,1);now=900001;await guard.load('player',load);assert.equal(calls,2);
 await assert.rejects(guard.load('broken',async()=>{throw Error('failure');}));assert.equal(await guard.load('broken',async()=>42),42);
});
test('persistent client policy backs off failures and resets on success',()=>{
 const first=refreshFailure(undefined,'HTTP 429',100);assert.equal(first.next,1800100);assert(first.limited);
 const persisted=JSON.parse(JSON.stringify(first));const second=refreshFailure(persisted,'HTTP 429',200);assert.equal(second.next,3600200);
 assert.equal(refreshFailure(undefined,'HTTP 502',0).next,900000);
 assert.deepEqual(refreshSuccess(123),{next:900123,failures:0});
});
