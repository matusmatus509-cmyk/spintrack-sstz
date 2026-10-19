import {test} from 'node:test';
import assert from 'node:assert/strict';
import {eligibleCategories,minimumYear,parsePlayerEligibility,parseCategories,parseUpcoming} from '../server/tournamentRecommendations.js';
const player={birthYear:2011,gender:'male',licenseUntil:'2031-06-30',region:null};
const event={title:'Open turnaj',date:'2026-10-24',registrationUrl:'https://turnaje.sstz.sk/turnaj/test/registration'};
const categories=['Najmladší žiaci','Mladší žiaci','Starší žiaci','Dorastenci'].map(label=>({label,age:label,gender:'male',singles:true}));
const eligible=(e=event,p=player,c=categories,rules='')=>eligibleCategories(e,p,c,rules,'2026-10-11');
test('2011 player qualifies for dorast, never younger or older pupils in 2026/27',()=>{
 assert.deepEqual(eligible().map(c=>c.label),['Dorastenci']);
 assert.deepEqual(eligible(event,{...player,birthYear:2012}).map(c=>c.label),['Starší žiaci','Dorastenci']);
 assert.equal(minimumYear('Mladšie žiačky','2026-10-24'),2014);
 assert.equal(minimumYear('Najmladší žiaci','2026-10-24'),2016);
 assert.equal(minimumYear('Mladší žiaci','2026-10-24','Najmladší žiaci 2016 a mladší\nMladší žiaci 2014 a mladší'),2014);
});
test('closed Orava and school events are never recommended to an unverified outsider',()=>{
 for(const title of ['Krajská bodovačka Oravy','1. žiacky turnaj regiónu Turiec','Vranovská školská liga','Majstrovstvá Slovenska']) assert.deepEqual(eligible({...event,title}),[]);
 assert.deepEqual(eligible({...event,title:'Orava OPEN'}).map(c=>c.label),['Dorastenci']);
 assert.deepEqual(eligible(event,player,categories,'Účasť len pre členov Oravy'),[]);
 assert.deepEqual(eligible(event,player,categories,'Nominovaní hráči'),[]);
});
test('no recommendations with unknown gender or birth year, expired licence, closed registration or past dates',()=>{
 for(const p of [{...player,gender:null},{...player,birthYear:null},{...player,licenseUntil:''},{...player,licenseUntil:'2026-10-23'}]) assert.deepEqual(eligible(event,p),[]);
 assert.deepEqual(eligible({...event,registrationUrl:''}),[]);
 assert.deepEqual(eligible({...event,date:'2026-10-10'}),[]);
 assert.deepEqual(eligible(event,player,categories,'Uzávierka: 10.10.2026'),[]);
 assert.deepEqual(eligibleCategories(event,player,categories,'Prihlášky do 11.10.2026, 18:00','2026-10-11','18:01'),[]);
 assert.equal(eligibleCategories(event,player,categories,'Prihlášky do 11.10.2026, 18:00','2026-10-11','17:59').length,1);
});
test('propositions override standard birth-year rule, sex and unknown future seasons are respected',()=>{
 assert.deepEqual(eligible(event,player,categories,'Dorastenci – 2012 a mladší'),[]);
 assert.deepEqual(eligible(event,{...player,gender:'female'}),[]);
 assert.deepEqual(eligible(event,player,[{label:'Open',age:'Neznáma',gender:'male',singles:true}]),[]);
 assert.equal(minimumYear('Dorastenci','2027-07-01'),null);
 assert.equal(minimumYear('Dorastenci','2027-07-01','Dorastenci 2009 a mladší'),2009);
 assert.deepEqual(eligible(event,player,categories,'Do 50. miesta v rebríčku'),[]);
});
test('explicit unrestricted licence condition admits a non-Open tournament, not a closed regional tournament',()=>{
 const rules='Turnaja sa môžu zúčastniť hráči s platným registračným preukazom';
 assert.deepEqual(eligible({...event,title:'Podtatranský pohár mládeže'},player,categories,rules).map(c=>c.label),['Dorastenci']);
 assert.deepEqual(eligible({...event,title:'Krajský turnaj Oravy'},player,categories,rules),[]);
});
test('parses official structured profile and category fields, never infers sex from a name',()=>{
 const html='<h2>Základné informácie</h2>'+['Hráč','Test Player','Rok narodenia','2011','Licencia','30.06.2031','Aktuálny klub','Test Club'].map((v,i)=>`<p class="${i%2?'value':'label'}">${v}</p>`).join('');
 const ranks='<h2>Rebríčky</h2><h3>Slovenský rebríček - Dorastenci</h3>';
 assert.equal(parsePlayerEligibility(html,ranks).gender,'male');
 assert.equal(parsePlayerEligibility(html,'').gender,null);
 assert.equal(parsePlayerEligibility(html,ranks).birthYear,2011);
 assert.equal(parsePlayerEligibility(html,ranks).licenseUntil,'2031-06-30');
 const detail='<div class="card-header"><h5>Dorastenci</h5></div><p><span>Veková kategória:</span>Dorastenci</p><p><span>Typ:</span>Jednotlivci (singles)</p><p><span>Pohlavie:</span>Muži</p>';
 assert.equal(parseCategories(detail)[0].age,'Dorastenci');
});
test('upcoming list requires official dates and green registration link, drops past and invalid dates',()=>{
 const block=(date,registration)=>`<div class="card card-hover grd-trn__wrap shadow-lg"><a href="/turnaj/test"><h3>Test Open</h3></a><svg class="icon-calendar"></svg>${date}</div><a class="${registration?'text-success':'text-danger'}" href="/turnaj/test/registration">Registrácia</a>`;
 const rows=parseUpcoming(block('24.10.2026',true)+block('10.10.2026',true)+block('32.10.2026',true)+block('25.10.2026',false),'2026-10-11');
 assert.equal(rows.length,2);assert.ok(rows[0].registrationUrl);assert.equal(rows[1].registrationUrl,'');
 assert.throws(()=>parseUpcoming('<html>unavailable</html>','2026-10-11'));
});

const card=(id,date='24.10.2026')=>`<div class="card card-hover grd-trn__wrap"><a href="/turnaj/${id}"><h3>${id} Open</h3></a><svg class="icon-calendar"></svg>${date}</div><a class="text-success" href="/turnaj/${id}/registration">Registrácia</a>`;
const catalogue=(cards,total,pages)=>`${cards}<div>${total} turnajov</div><ul class="pagination"><a href="/turnaje?page=${pages}">last</a></ul>`;
const response=html=>({text:async()=>html});
const {collectTournamentCatalogue,createRecommendationService}=await import('../server/tournamentRecommendations.js');
test('only follows upcoming pages and stops on a mixed page without reading the archive',async()=>{
 const visited=[];
 const result=await collectTournamentCatalogue(async url=>{
  const page=Number(new URL(url).searchParams.get('page'));visited.push(page);
  assert.equal(new URL(url).searchParams.get('sorting'),'date-desc');
  if(page>2)throw new Error('archive must not be requested');
  return response(catalogue(page===1?card('a','25.10.2026'):card('b','24.10.2026')+card('today','19.10.2026')+card('old','18.10.2026'),1423,24));
 },'2026-10-19');
 assert.deepEqual(visited,[1,2]);assert.equal(result.scannedCount,3);assert.equal(result.pageCount,2);assert.deepEqual(result.events.map(e=>e.id),['today','b','a']);
});
test('no upcoming tournaments ends on the first page even with a large archive',async()=>{
 let calls=0;
 const result=await collectTournamentCatalogue(async()=>{calls++;return response(catalogue(card('old','18.10.2026'),1423,24));},'2026-10-19');
 assert.equal(calls,1);assert.equal(result.scannedCount,0);assert.deepEqual(result.events,[]);
});
test('recovers duplicate future boundaries without scanning old pages',async()=>{
 const visited=[];
 const result=await collectTournamentCatalogue(async url=>{
  const u=new URL(url),size=u.searchParams.get('onpage'),page=Number(u.searchParams.get('page'));visited.push([size,page]);
  assert.ok(page<=2);
  return response(catalogue(size==='60'?card('a')+(page===2?card('old','18.10.2026'):''):card('a')+card('b')+card('old','18.10.2026'),1423,24));
 },'2026-10-19');
 assert.equal(result.scannedCount,2);assert.deepEqual(visited,[['60',1],['60',2],['48',1]]);
});
test('rejects unreadable dates, missing event links, incorrect source sorting and failed upcoming pages',async()=>{
 await assert.rejects(()=>collectTournamentCatalogue(async()=>response(catalogue(card('a').replace('href="/turnaj/a"','href="/invalid"'),1,1)),'2026-10-19'),/neúplné údaje/);
 await assert.rejects(()=>collectTournamentCatalogue(async()=>response(catalogue(card('a','32.10.2026'),1,1)),'2026-10-19'),/nečitateľný dátum/);
 await assert.rejects(()=>collectTournamentCatalogue(async()=>response(catalogue(card('old','18.10.2026')+card('a'),2,1)),'2026-10-19'),/poradie/);
 await assert.rejects(()=>collectTournamentCatalogue(async url=>{
  if(new URL(url).searchParams.get('page')==='2')throw new Error('offline');
  return response(catalogue(card('a'),1423,24));
 },'2026-10-19'),/offline/);
});
test('returns every suitable tournament, shares catalogue cache, and manual refresh scans anew',async()=>{
 let scans=0,rules=0;
 const profile='<h2>Základné informácie</h2>'+['Hráč','Test Player','Rok narodenia','2011','Licencia','30.06.2031'].map(v=>`<p>${v}</p>`).join('');
 const detail='<div class="card-header"><h5>Dorastenci</h5></div><p><span>Veková kategória:</span>Dorastenci</p><p><span>Typ:</span>singles</p><p><span>Pohlavie:</span>Muži</p>';
 const service=createRecommendationService({now:()=>new Date('2026-10-19T09:00:00Z'),readRules:async()=>{rules++;return '';},readSource:async url=>{
  const path=new URL(url).pathname;
  if(path.endsWith('/rebricky'))return response('<h2>Rebríčky</h2>Slovenský rebríček - Dorastenci');
  if(path.startsWith('/hraci/'))return response(profile);
  if(path==='/turnaje'){scans++;await new Promise(resolve=>setTimeout(resolve,2));const page=Number(new URL(url).searchParams.get('page'));const offset=(page-1)*60;return response(catalogue(Array.from({length:Math.min(60,137-offset)},(_,i)=>card(`event-${offset+i}`)).join('')+(page===3?card('old','18.10.2026'):''),1423,24));}
  return response(detail);
 }});
 const [first,second]=await Promise.all([service('123'),service('456')]);
 assert.equal(first.tournaments.length,137);assert.equal(second.tournaments.length,137);assert.equal(first.scannedCount,137);assert.equal(scans,3);assert.equal(rules,137);
 await service('123');assert.equal(scans,3);
 await service('123',{refresh:true});assert.equal(scans,6);assert.equal(rules,274);
});

test('shared deadline covers the profile, list, categories and propositions and permits retry',async()=>{
 const profile='<h2>Základné informácie</h2>'+['Hráč','Test Player','Rok narodenia','2011','Licencia','30.06.2031'].map(v=>`<p>${v}</p>`).join('');
 const ranks='<h2>Rebríčky</h2>Slovenský rebríček - Dorastenci';
 const detail='<div class="card-header"><h5>Dorastenci</h5></div><p><span>Veková kategória:</span>Dorastenci</p><p><span>Typ:</span>singles</p><p><span>Pohlavie:</span>Muži</p>';
 for(const phase of ['profile','list','categories','rules']) {
  let blocked=true,aborted=false;
  const stall=signal=>new Promise((resolve,reject)=>{signal.addEventListener('abort',()=>{aborted=true;reject(signal.reason);},{once:true});});
  const service=createRecommendationService({timeoutMs:250,now:()=>new Date('2026-10-19T09:00:00Z'),readRules:async(_url,{signal})=>blocked&&phase==='rules'?stall(signal):'',readSource:async(url,{signal})=>{
   const path=new URL(url).pathname;
   if(blocked&&((phase==='profile'&&path==='/hraci/123')||(phase==='list'&&path==='/turnaje')||(phase==='categories'&&path==='/turnaj/a')))return stall(signal);
   return response(path.endsWith('/rebricky')?ranks:path.startsWith('/hraci/')?profile:path==='/turnaje'?catalogue(card('a')+card('old','18.10.2026'),1423,24):detail);
  }});
  const start=performance.now();await assert.rejects(()=>service('123'),/do 15 sekúnd/);assert.ok(performance.now()-start<500,phase);assert.equal(aborted,true,phase);
  blocked=false;const recovered=await service('123',{refresh:true});assert.equal(recovered.tournaments.length,1,phase);
 }
});
