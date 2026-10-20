import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pairSstzPlayers,loadSstzAccountImport} from '../src/utils/sstzAccountImport.ts';
const official={id:'123',name:'Novák Ján',clubName:'Test Club'};
const league={id:'456',name:'Ján Novák'};
const choice={name:official.name,registryId:'123',leagueId:'456'};
const tournament=()=>({id:'123',name:'Novák Ján',complete:true,matches:[{id:'t1',date:'2026-10-10',tournamentName:'Test Open',opponentName:'Test opponent',result:'WIN',score:'3:1',sets:[]}],doublesMatches:[]});
const career=()=>({id:'456',name:'Ján Novák',isAllSeasons:true,matches:[{id:'l1',date:'2026-10-11',opponentName:'Test league opponent',result:'WIN',score:'3:0'}],doublesMatches:[]});
const signal=()=>new AbortController().signal;
test('one full-name choice joins different source IDs, accents and name order',()=>{
 assert.deepEqual(pairSstzPlayers([official],[league]),[{name:official.name,registryId:'123',clubName:'Test Club',leagueId:'456'}]);
 assert.equal(pairSstzPlayers([official],[{...league,name:'Jan Novak'}])[0].leagueId,'456');
 const collision=pairSstzPlayers([official],[{id:'123',name:'Other Player'}]);assert.equal(collision[0].leagueId,undefined);assert.equal(collision[1].leagueId,'123');
});
test('homonyms require an explicit selection; the first matching name is never chosen',()=>{
 const names=pairSstzPlayers([official],[league,{...league,id:'789'}]);assert.equal(names[0].leagueId,undefined);assert.equal(names[0].leagueCandidates.length,2);
 const duplicateRegistry=pairSstzPlayers([official,{...official,id:'124',clubName:'Other Club'}],[league]);assert(duplicateRegistry.every(p=>!p.leagueId&&p.leagueCandidates.length===1));
 assert.equal(pairSstzPlayers([official,official],[league,league])[0].leagueId,'456');
});
test('combined import loads both histories before returning any changes and validates independent identities',async()=>{
 const paths=[];let pending;const wait=new Promise(resolve=>pending=resolve);let returned=false;
 const request=loadSstzAccountImport(choice,async url=>{paths.push(url);if(url.includes('/tournaments/')){await wait;return tournament();}return career();},signal()).then(result=>{returned=true;return result;});
 await new Promise(resolve=>setImmediate(resolve));assert.equal(paths.length,2);assert.equal(returned,false);pending();const result=await request;
 assert.equal(result.league.id,'456');assert.equal(result.tournaments.profile.id,'123');assert.equal(result.tournaments.matches[0].source,'SSTZ_TOURNAMENT');assert(paths.some(p=>p.includes('allSeasons=true')));
});
test('a failed, incomplete, wrong-player or renamed second source prevents the combined result',async()=>{
 for(const change of [{complete:false},{id:'456'},{name:'Other Person'}])await assert.rejects(()=>loadSstzAccountImport(choice,async url=>url.includes('/tournaments/')?{...tournament(),...change}:career(),signal()));
 for(const change of [{isAllSeasons:false},{id:'123'},{name:'Other Person'},{matches:null}])await assert.rejects(()=>loadSstzAccountImport(choice,async url=>url.includes('/tournaments/')?tournament():{...career(),...change},signal()));
 await assert.rejects(()=>loadSstzAccountImport(choice,async url=>{if(url.includes('/tournaments/'))throw new Error('offline');return career();},signal()),/offline/);
 const c=new AbortController();c.abort();await assert.rejects(()=>loadSstzAccountImport(choice,async url=>url.includes('/tournaments/')?tournament():career(),c.signal));
});
test('a player present in only one source imports available records without pretending both sources exist',async()=>{
 const candidates=pairSstzPlayers([official],[]);assert.equal(candidates[0].leagueId,undefined);
 const result=await loadSstzAccountImport(candidates[0],async()=>tournament(),signal());assert.equal(result.league,null);assert.equal(result.tournaments.profile.id,'123');
 await assert.rejects(()=>loadSstzAccountImport({name:'Test'},async()=>null,signal()));
});

test('malformed or duplicate league rows cannot produce a partially applied account import',async()=>{
 for(const rows of [[null],[{id:'x',date:'2026-10-11',score:'3:0',result:'DRAW'}],[...career().matches,...career().matches]])await assert.rejects(()=>loadSstzAccountImport(choice,async url=>url.includes('/tournaments/')?tournament():{...career(),matches:rows},signal()));
});
