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
