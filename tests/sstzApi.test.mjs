import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import { once } from 'node:events';

const get = (server, path) => new Promise((resolve,reject) => {
  http.get({hostname:'127.0.0.1',port:server.address().port,path}, response => {
    let body=''; response.on('data',chunk=>body+=chunk);
    response.on('end',()=>resolve({status:response.statusCode,body:JSON.parse(body)}));
  }).on('error',reject);
});

test('player API defaults to the full archive and propagates upstream failures', async t => {
  const previousNodeEnv=process.env.NODE_ENV;
  process.env.NODE_ENV='test';
  const {default:app}=await import('../server/index.js');
  if(previousNodeEnv===undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV=previousNodeEnv;
  const server=app.listen(0,'127.0.0.1');
  await once(server,'listening');
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const id='991004';
  const snapshot=new URL(`../data/sstz/${id}.json`,import.meta.url);
  assert.equal(fs.existsSync(snapshot),false);
  t.after(()=>{if(fs.existsSync(snapshot)) fs.unlinkSync(snapshot);});
  const seasons=[];
  t.mock.method(globalThis,'fetch',async(input,opts={})=>{
    const url=new URL(input);
    if(url.pathname.startsWith('/sezona/')){
      seasons.push(url.pathname.split('/')[2]);
      return new Response('',{headers:{'set-cookie':'season=current; Path=/'}});
    }
    if(url.pathname.endsWith('/991005')) return new Response('unavailable',{status:503});
    if(!opts.headers?.Cookie) return new Response('<a onclick="Gss.setSeason(40)">2029/30</a><a onclick="Gss.setSeason(10)">2017/18</a>');
    return new Response('<title>Test Player | SSTZ</title><h4>Úspešnosť - Dvojhry</h4>Celkom 0 z 0<h4>Úspešnosť - Štvorhry</h4>Celkom 0 z 0');
  });
  const result=await get(server,`/api/sstz/player/${id}`);
  assert.equal(result.status,200);
  assert.equal(result.body.isAllSeasons,true);
  assert.deepEqual(seasons,['2029-30','2017-18']);
  assert.equal(JSON.parse(fs.readFileSync(snapshot,'utf8')).id,id);
  const error=await get(server,'/api/sstz/player/991005');
  assert.equal(error.status,502);
  assert.match(error.body.error,/HTTP 503/);
});
