import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeDiaryDate,getDiaryEntries,filterDiaryEntries,emptyDiaryFilters} from '../src/utils/diary.ts';
const activity={id:'activity',date:'2026-10-08',category:'tréning',durationMinutes:60,focusDrills:['Podanie'],location:'Žiar nad Hronom',publicNote:'Technika',visibility:'private',addEquipmentWear:false};
const match={id:'league',date:'9.10.2026',source:'SSTZ',opponentName:'Šouc Karol',competition:'3. liga',score:'3:1',result:'WIN',sets:[]};
const double={id:'double',date:'2026-10-10',source:'SSTZ',opponentPair:'Opponent A / B',partnerName:'Partner',competition:'3. liga',score:'1:3',result:'LOSS',sets:[],type:'doubles'};

test('diary calendar dates accept both source formats and reject impossible days',()=>{
 assert.equal(normalizeDiaryDate('9.10.2026'),'2026-10-09');
 assert.equal(normalizeDiaryDate('2026-10-09T18:00:00Z'),'2026-10-09');
 assert.equal(normalizeDiaryDate('31.02.2026'),'');
 assert.equal(normalizeDiaryDate('not a date'),'');
});
test('diary combines singles, league doubles and activities without duplicating manual duel records',()=>{
 const entries=getDiaryEntries([activity],[match,{...match,id:'manual',source:'manual'}],[double]);
 assert.deepEqual(entries.map(e=>e.date),['2026-10-10','2026-10-09','2026-10-08']);
 assert.equal(entries.length,3);
 assert.equal(entries[0].category,'liga');
});
test('diary applies combined category, result, source, inclusive date range and accent-insensitive search',()=>{
 const entries=getDiaryEntries([activity],[match],[double]);
 const filters={...emptyDiaryFilters,category:'liga',source:'sstz',result:'WIN',query:'souc karol',from:'2026-10-09',to:'2026-10-09'};
 assert.deepEqual(filterDiaryEntries(entries,filters).map(e=>e.id),['match-league']);
 assert.equal(filterDiaryEntries(entries,{...filters,result:'LOSS'}).length,0);
 assert.equal(filterDiaryEntries(entries,{...emptyDiaryFilters,query:'ziar podanie'}).length,1);
 assert.equal(filterDiaryEntries(entries,{...emptyDiaryFilters,source:'manual'}).length,1);
});
