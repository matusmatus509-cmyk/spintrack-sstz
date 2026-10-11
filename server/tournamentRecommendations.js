import * as http from 'node:http';
if (typeof http.setGlobalProxyFromEnv === 'function') http.setGlobalProxyFromEnv();
const PORTAL = 'https://turnaje.sstz.sk';
const norm = s => String(s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
const text = s => String(s || '').replace(/<script\b[\s\S]*?<\/script>/gi, '').replace(/<style\b[\s\S]*?<\/style>/gi, '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/&#0*39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
const iso = s => { const m = s?.match(/\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/); if (!m) return ''; const result = `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`; const parsed = new Date(`${result}T12:00:00Z`); return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,10) === result ? result : ''; };
async function load(url) {
  const u = new URL(url);
  if (!['turnaje.sstz.sk','www.sstz.sk'].includes(u.hostname) || u.protocol !== 'https:') throw new Error('Neplatný zdroj SSTZ.');
  const response = await fetch(u, {redirect:'error', headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36', 'Accept-Language':'sk-SK'}, signal:AbortSignal.timeout(20000)});
  if (!response.ok) throw new Error(`SSTZ neodpovedá (HTTP ${response.status}). Skús obnoviť turnaje neskôr.`);
  return response;
}
export function parseUpcoming(html, today) {
  if (!html.includes('grd-trn') && !/0 turnajov/.test(text(html))) throw new Error('SSTZ zmenilo formát zoznamu turnajov.');
  return html.split(/<div class="card card-hover grd-trn__wrap[^>]*>/).slice(1).flatMap(block => {
    const match = block.match(/href="(\/turnaj\/[^"?#]+)"[^>]*>\s*<h3[^>]*>([\s\S]*?)<\/h3>/);
    const date = iso(text(block.match(/icon-calendar[\s\S]*?<\/svg>([\s\S]*?)<\/div>/)?.[1]));
    if (!match || !date || date < today) return [];
    const slug = match[1];
    const registration = [...block.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].find(m => m[1].includes(`${slug}/registration`) && /text-success/.test(m[1]));
    return [{id:slug.split('/').pop(), title:text(match[2]), date, url:PORTAL+slug, registrationUrl:registration ? PORTAL+slug+'/registration' : '', propositionUrl: new URL(block.match(/href="([^"?#]+\.pdf)"/)?.[1] || slug+'/proposition', PORTAL).href}];
  });
}
export function parsePlayerEligibility(html, ranks) {
  const content = html.split('Základné informácie')[1] || '';
  const value = label => text(content.match(new RegExp(`${label}<\\/p>\\s*<p[^>]*>([\\s\\S]*?)<\\/p>`))?.[1]);
  const rankText = norm(text(ranks.split('Rebríčky</h')[1] || ''));
  const male = /slovensky rebricek - (dorastenci|juniori|muzi|(?:najmladsi|mladsi|starsi) ziaci)/.test(rankText);
  const female = /slovensky rebricek - (dorastenky|juniorky|zeny|(?:najmladsie|mladsie|starsie) ziacky)/.test(rankText);
  return { name:value('Hráč'), birthYear:Number(value('Rok narodenia')) || null, club:value('Aktuálny klub'), licenseUntil:iso(value('Licencia')), gender:male !== female ? (male ? 'male':'female') : null, region:null };
}
export function parseCategories(html) {
  return html.split(/<div class="card-header">/).slice(1).flatMap(block => {
    const label = text(block.match(/<h5[^>]*>([\s\S]*?)<\/h5>/)?.[1]);
    const age = text(block.match(/Veková kategória:<\/span>([\s\S]*?)<\/p>/)?.[1]);
    const gender = norm(text(block.match(/Pohlavie:<\/span>([\s\S]*?)<\/p>/)?.[1]));
    const type = norm(text(block.match(/Typ:<\/span>([\s\S]*?)<\/p>/)?.[1]));
    return label && age ? [{label, age, gender:gender === 'muzi' ? 'male' : gender === 'zeny' ? 'female' : gender === 'zmiesane' ? 'mixed' : null, singles:type.includes('singles')}] : [];
  });
}
// Published SSTZ 2026/27 year limits. After this season, require explicit limits in propositions.
// https://turnaje.sstz.sk/data/files/propozicie_1pspm_pstz-2026_27-2000-1791564739.pdf
export function minimumYear(category, date, rules = '') {
  const label = norm(category);
  const line = norm(rules).match(new RegExp(`\\b${label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\b[^\\n]{0,70}?\\b((?:19|20)\\d{2})\\s*(?:a|i)\\s*mlad`));
  if (line) return Number(line[1]);
  if (date < '2026-07-01' || date >= '2027-07-01') return null;
  if (/najmlads/.test(label)) return 2016;
  if (/mlads/.test(label)) return 2014;
  if (/stars.*zi/.test(label)) return 2012;
  if (/dorast/.test(label)) return 2008;
  return null;
}
export function eligibleCategories(event, player, categories, rules = '', today = new Date().toLocaleDateString('sv-SE', {timeZone:'Europe/Bratislava'}), nowTime = new Date().toLocaleTimeString('sv-SE', {timeZone:'Europe/Bratislava', hour12:false})) {
  if (!event.registrationUrl || event.date < today || !player.birthYear || !player.gender || !player.licenseUntil || player.licenseUntil < event.date) return [];
  const conditions = norm(event.title+' '+rules);
  // Closed regional/school/championship events require an affiliation or qualification we cannot verify.
  const open = /\bopen\b/.test(norm(event.title));
  const publicParticipation = /turnaja sa mozu zucastnit hraci s platnym registracnym preukazom/.test(norm(rules).replace(/\s+/g,' '));
  if (!open && (!publicParticipation || /krajsk|regionu|oblastn|orav/.test(norm(event.title)))) return [];
  if (/skolsk|majstrovstv|pozvank|nominovan|kvalifik|len pre|vyhradne|iba pre|rebric.{0,40}(?:do |nad |prvych|top|[0-9])|vykonnostn|bodov.{0,20}limit|(?:do|nad|top|prvych).{0,30}\d.{0,30}rebric/.test(conditions)) return [];
  const deadline = norm(rules).replace(/\s+/g,' ').match(/(?:uzavierka|prihlasky|do terminu)[^\d]{0,100}?(\d{1,2}\.\d{1,2}\.\d{4})(?:\s*,?\s*(\d{1,2}):(\d{2}))?/i);
  if (deadline) {
    const deadlineDate = iso(deadline[1]);
    if (!deadlineDate || deadlineDate < today || (deadlineDate === today && deadline[2] && `${deadline[2].padStart(2,'0')}:${deadline[3]}` <= nowTime)) return [];
  }
  return categories.filter(category => {
    if (!category.singles || !category.gender || (category.gender !== 'mixed' && category.gender !== player.gender)) return false;
    const min = minimumYear(category.age,event.date,rules);
    // Adult/veteran/unknown categories need an explicit age rule; never assume youth may enter.
    return min !== null && player.birthYear >= min;
  }).map(category => ({...category, reason:`Ročník ${player.birthYear} · ${category.label} · otvorená účasť`, minimumBirthYear:minimumYear(category.age,event.date,rules)}));
}
async function propositions(url) {
  const response = await load(url);
  if (new URL(url).pathname.endsWith('.pdf')) {
    if (Number(response.headers.get('content-length')) > 8_000_000) throw new Error('Príliš veľké propozície.');
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length > 8_000_000) throw new Error('Príliš veľké propozície.');
    const [{getDocument}, {WorkerMessageHandler}] = await Promise.all([import('pdfjs-dist/legacy/build/pdf.mjs'), import('pdfjs-dist/legacy/build/pdf.worker.mjs')]);
    globalThis.pdfjsWorker = {WorkerMessageHandler};
    const task = getDocument({data:bytes, useSystemFonts:true, isEvalSupported:false, verbosity:0});
    const doc = await task.promise;
    try {
      if (doc.numPages > 20) throw new Error('Príliš dlhé propozície.');
      const lines=[];
      for(let i=1;i<=doc.numPages;i++) { const page=await doc.getPage(i); const content=await page.getTextContent(); lines.push(content.items.map(item=>item.str+(item.hasEOL?'\n':' ')).join('')); }
      return lines.join('\n');
    } finally {await task.destroy();}
  }
  const html=await response.text();
  const pdf=html.match(/href="([^"?#]+\.pdf)"/);
  return pdf ? propositions(new URL(pdf[1],PORTAL).href) : text(html.split('min-vh-100')[1] || '');
}
let cache;
export async function recommendations(playerId) {
  if (!/^\d{1,10}$/.test(playerId)) throw new Error('Najprv pripoj svoj profil hráča zo sstz.sk v sekcii Turnaje.');
  const today=new Date().toLocaleDateString('sv-SE',{timeZone:'Europe/Bratislava'});
  const [profile,ranks]=await Promise.all([load(`https://www.sstz.sk/hraci/${playerId}`),load(`https://www.sstz.sk/hraci/${playerId}/rebricky`)]);
  const player=parsePlayerEligibility(await profile.text(),await ranks.text());
  if (!player.name || !player.birthYear) throw new Error('SSTZ profil neobsahuje overiteľný ročník hráča.');
  if (!cache || cache.today !== today || Date.now()-cache.at>300000) {
    const events=[];
    for(let page=1;page<=25;page++) {
      const list=await load(`${PORTAL}/turnaje?onpage=60&sorting=date-desc&page=${page}`);
      const html=await list.text();
      const upcoming=parseUpcoming(html,today);
      events.push(...upcoming);
      const allCount=html.split(/<div class="card card-hover grd-trn__wrap[^>]*>/).length-1;
      const hasNext=new RegExp(`href="[^"]*[?&](?:amp;)?page=${page+1}(?:&|")`).test(html);
      if(upcoming.length < allCount || !hasNext) break;
      if(page===25) throw new Error('SSTZ má príliš veľa strán. Úplný zoznam sa nepodarilo overiť.');
    }
    const unique=[...new Map(events.map(event=>[event.id,event])).values()];
    const details=[]; let unavailable=0;
    // Bound requests and retain explicit incompleteness rather than inventing missing events.
    for (let i=0;i<unique.length;i+=3) {
      await Promise.all(unique.slice(i,i+3).map(async event=>{
        try {const detail=await load(event.url);const categories=parseCategories(await detail.text());const rules=await propositions(event.propositionUrl);details.push({...event,categories,rules});}
        catch (error) {unavailable++; console.warn(`SSTZ turnaj ${event.id}: ${error.message}`);}
      }));
    }
    cache={today,at:Date.now(),details,unavailable,total:unique.length};
  }
  const tournaments=cache.details.flatMap(event=>{
    const categories=eligibleCategories(event,player,event.categories,event.rules,today);
    return categories.length ? [{id:event.id,title:event.title,date:event.date,url:event.url,registrationUrl:event.registrationUrl,propositionUrl:event.propositionUrl,categories}] : [];
  }).sort((a,b)=>a.date.localeCompare(b.date));
  return {player,tournaments,checkedAt:new Date().toISOString(),checkedCount:cache.total,unavailableCount:cache.unavailable,sourceUrl:PORTAL+'/turnaje', note:'Odporúčame mládežnícke kategórie s otvorenou účasťou s overiteľným ročníkom, pohlavím a platnou licenciou. Uzavreté regionálne, školské a kvalifikačné turnaje ani neoverené podmienky sa nezobrazujú. Pridanie do kalendára nie je registrácia.'};
}
