import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeDiaryDate,getDiaryEntries,filterDiaryEntries,emptyDiaryFilters,compareOccurrenceDesc,occurrenceTime} from '../src/utils/diary.ts';
const activity={id:'activity',date:'2026-10-08',category:'tréning',durationMinutes:60,focusDrills:['Podanie'],location:'Žiar nad Hronom',publicNote:'Technika',visibility:'private',addEquipmentWear:false};
const match={id:'league',date:'9.10.2026',source:'SSTZ',opponentName:'Šouc Karol',competition:'3. liga',score:'3:1',result:'WIN',sets:[]};
const double={id:'double',date:'2026-10-10',source:'SSTZ',opponentPair:'Opponent A / B',partnerName:'Partner',competition:'3. liga',score:'1:3',result:'LOSS',sets:[],type:'doubles'};

test('diary calendar dates accept both source formats and reject impossible days',()=>{
 assert.equal(normalizeDiaryDate('9.10.2026'),'2026-10-09');
 assert.equal(normalizeDiaryDate('2026-10-09T18:00:00Z'),'2026-10-09');
 assert.equal(normalizeDiaryDate('31.02.2026'),'');
 assert.equal(normalizeDiaryDate('not a date'),'');
});

test('all sources sort by when the event occurred, independent of import time and input order', () => {
 const items = [
  {...activity,id:'old-imported-today',date:'18.09.2026',createdAt:'2030-01-01T12:00:00Z'},
  {...activity,id:'morning',date:'2026-10-15',startTime:'09:00',createdAt:'2030-01-01T18:00:00Z'},
  {...activity,id:'evening',date:'15.10.2026 18:30',createdAt:'2020-01-01T01:00:00Z'},
  {...activity,id:'unknown-date',date:'',createdAt:'2099-01-01T12:00:00Z'},
 ];
 const singles=[{...match,id:'october-league',date:'9.10.2026',createdAt:'2035-01-01T00:00:00Z'}];
 const doubles=[{...double,id:'latest-double',date:'2026-10-16T19:00:00+02:00',createdAt:'2020-01-01T00:00:00Z'}];
 const expected=['doubles-latest-double','activity-evening','activity-morning','match-october-league','activity-old-imported-today','activity-unknown-date'];
 assert.deepEqual(getDiaryEntries(items,singles,doubles).map(row=>row.id),expected);
 assert.deepEqual(getDiaryEntries([...items].reverse(),singles,doubles).map(row=>row.id),expected);
 assert.equal(items[0].id,'old-imported-today','sorting never changes stored source arrays');
});

test('same-day ties use a stable identity instead of arrival order or imported timestamp', () => {
 const a={id:'a',date:'2026-10-15',createdAt:'2099-01-01'};
 const b={id:'b',date:'15.10.2026',createdAt:'2000-01-01'};
 assert.deepEqual([b,a].sort(compareOccurrenceDesc).map(row=>row.id),['a','b']);
 assert.deepEqual([a,b].sort(compareOccurrenceDesc).map(row=>row.id),['a','b']);
});

test('occurrence dates and times normalize legacy formats without using metadata as a fallback', () => {
 assert.equal(normalizeDiaryDate(' 2026-2-9T18:30:00Z '),'2026-02-09');
 assert.equal(normalizeDiaryDate('9. 2. 2026, 18:30'),'2026-02-09');
 assert.equal(normalizeDiaryDate(null),'');
 assert.equal(occurrenceTime({date:'9.2.2026 9:05'}),'09:05:00');
 assert.equal(occurrenceTime({date:'2026-02-09T18:30:25+02:00'}),'18:30:25');
 assert.equal(occurrenceTime({date:'2026-02-09',startTime:'25:00'}),'');
 assert.equal(occurrenceTime({createdAt:'2099-01-01T19:00:00Z'}),'');
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
