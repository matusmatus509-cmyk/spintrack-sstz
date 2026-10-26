import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startSstzAutoRefresh } from '../src/utils/sstzAutoRefresh.ts';
test('refreshes on opening, periodically and after focus/reconnection; throttles and cleans up', () => {
 let now=0, visible=true, online=true, calls=0, interval, stopped=false;
 const listeners=new Map();
 const stop=startSstzAutoRefresh(()=>calls++, { now:()=>now, visible:()=>visible, online:()=>online,
 every:(callback,ms)=>{assert.equal(ms,300000);interval=callback;return()=>stopped=true;},
 listen:(event,callback)=>{listeners.set(event,callback);return()=>listeners.delete(event);},
 });
 assert.equal(calls,1);listeners.get('focus')();assert.equal(calls,1);
 now=300000;interval();assert.equal(calls,2);
 visible=false;now+=300000;interval();assert.equal(calls,2);
 visible=true;listeners.get('visibilitychange')();assert.equal(calls,3);
 online=false;now+=60000;listeners.get('focus')();assert.equal(calls,3);
 online=true;listeners.get('online')();assert.equal(calls,4);
 now+=60000;listeners.get('focus')();assert.equal(calls,5);
 stop();assert(stopped);assert.equal(listeners.size,0);
});
