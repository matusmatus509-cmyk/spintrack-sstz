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
test('scans beyond 25 pages and past events, with at most three concurrent requests',async()=>{
 const visited=[]; let active=0,maxActive=0;
 const result=await collectTournamentCatalogue(async url=>{
  const page=Number(new URL(url).searchParams.get('page'));visited.push(page);active++;maxActive=Math.max(maxActive,active);
  await new Promise(resolve=>setTimeout(resolve,1));active--;
  return response(catalogue(card(`event-${page}`,page===27?'24.10.2026':'01.01.2025'),27,27));
 },'2026-10-19');
 assert.equal(result.scannedCount,27);assert.equal(result.pageCount,27);assert.equal(result.events.length,1);assert.equal(result.events[0].id,'event-27');assert.equal(visited.length,27);assert.equal(maxActive,3);
});
test('recovers duplicate date boundaries with another page size and deduplicates events',async()=>{
 const result=await collectTournamentCatalogue(async url=>{
  const u=new URL(url),size=u.searchParams.get('onpage'),page=u.searchParams.get('page');
  return response(catalogue(card(size==='60'?'a':page==='1'?'a':'b'),2,2));
 },'2026-10-19');
 assert.equal(result.scannedCount,2);assert.equal(result.pageCount,4);assert.deepEqual(result.events.map(e=>e.id),['a','b']);
});
test('rejects failed or missing pages and reports incomplete unique coverage honestly',async()=>{
 await assert.rejects(()=>collectTournamentCatalogue(async url=>{
  if(new URL(url).searchParams.get('page')==='2')throw new Error('offline');
  return response(catalogue(card('a'),2,2));
 },'2026-10-19'),/offline/);
 const partial=await collectTournamentCatalogue(async()=>response(catalogue(card('a'),2,2)),'2026-10-19');
 assert.equal(partial.missingCount,1);assert.equal(partial.scannedCount,1);assert.equal(partial.catalogueCount,2);
 await assert.rejects(()=>collectTournamentCatalogue(async()=>response(catalogue(card('a'),3,2)),'2026-10-19'),/neúplné/);
});
test('returns every suitable tournament, shares catalogue cache, and manual refresh scans anew',async()=>{
 let scans=0,rules=0;
 const profile='<h2>Základné informácie</h2>'+['Hráč','Test Player','Rok narodenia','2011','Licencia','30.06.2031'].map(v=>`<p>${v}</p>`).join('');
 const detail='<div class="card-header"><h5>Dorastenci</h5></div><p><span>Veková kategória:</span>Dorastenci</p><p><span>Typ:</span>singles</p><p><span>Pohlavie:</span>Muži</p>';
 const service=createRecommendationService({now:()=>new Date('2026-10-19T09:00:00Z'),readRules:async()=>{rules++;return '';},readSource:async url=>{
  const path=new URL(url).pathname;
  if(path.endsWith('/rebricky'))return response('<h2>Rebríčky</h2>Slovenský rebríček - Dorastenci');
  if(path.startsWith('/hraci/'))return response(profile);
  if(path==='/turnaje'){scans++;await new Promise(resolve=>setTimeout(resolve,2));return response(catalogue(Array.from({length:12},(_,i)=>card(`event-${i}`)).join(''),12,1));}
  return response(detail);
 }});
 const [first,second]=await Promise.all([service('123'),service('456')]);
 assert.equal(first.tournaments.length,12);assert.equal(second.tournaments.length,12);assert.equal(first.scannedCount,12);assert.equal(scans,1);assert.equal(rules,12);
 await service('123');assert.equal(scans,1);
 await service('123',{refresh:true});assert.equal(scans,2);assert.equal(rules,24);
});
