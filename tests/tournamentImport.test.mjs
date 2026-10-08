import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseTournamentImport,replaceTournamentMatches} from '../src/utils/tournamentImport.ts';

// Contract fixtures; these are synthetic test data, not scraped SSTZ results.
const duel={id:'event-1-1',date:'2026-09-10',tournamentName:'Test tournament',opponentName:'Test opponent',result:'WIN',score:'3:1',sets:['11:8','8:11','11:7','11:9']};
const payload=()=>({id:'18534',name:'Test player',complete:true,matches:[{...duel}],doublesMatches:[{...duel,id:'event-1-2',partnerName:'Test partner',opponentPair:'Test pair'}]});

test('tournament import separates league identity, singles and doubles and keeps official scores',()=>{
 const result=parseTournamentImport(payload(),'18534');
 assert.equal(result.matches[0].source,'SSTZ_TOURNAMENT');
 assert.equal(result.matches[0].id,'sstz-tournament-18534-s-event-1-1');
 assert.equal(result.doublesMatches[0].id,'sstz-tournament-18534-d-event-1-2');
 assert.equal(result.matches[0].competition,duel.tournamentName);
 assert.deepEqual(result.matches[0].sets,duel.sets);
 assert.equal(result.profile.id,'18534');
});

test('incomplete, wrong-player and malformed imports are rejected before state changes',()=>{
 for(const change of [{complete:false},{id:'999'}, {matches:null},{name:''}]){
  assert.throws(()=>parseTournamentImport({...payload(),...change},'18534'));
 }
 for(const change of [{date:undefined},{score:undefined},{result:'DRAW'},{sets:[123]},{opponentName:''}]){
  const data=payload();data.matches=[{...duel,...change}];
  assert.throws(()=>parseTournamentImport(data,'18534'));
 }
 const data=payload();data.matches.push({...duel});
 assert.throws(()=>parseTournamentImport(data,'18534'),/duplicitný/);
});

test('repeat imports do not duplicate duels and preserve league, manual and user annotations',()=>{
 const imported=parseTournamentImport(payload(),'18534');
 const league={id:'league-duel',source:'SSTZ'};const manual={id:'manual-duel',source:'manual'};
 const previous=[league,manual,{...imported.matches[0],notes:'My scouting',tacticsNote:'Short serve',racketId:'my-racket'}];
 const next=replaceTournamentMatches(previous,imported.matches);
 assert.equal(next.length,3);
 assert.deepEqual(next.slice(0,2),[league,manual]);
 assert.equal(next[2].notes,'My scouting');assert.equal(next[2].tacticsNote,'Short serve');assert.equal(next[2].racketId,'my-racket');
 assert.deepEqual(replaceTournamentMatches(next,imported.matches),next);
 assert.deepEqual(replaceTournamentMatches(next,[]),[league,manual]);
});
