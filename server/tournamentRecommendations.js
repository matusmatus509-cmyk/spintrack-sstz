import {participationPolicy, categoryParticipation, rulesForCategory} from './tournamentEligibility.js';
export {minimumYear} from './tournamentEligibility.js';
import * as http from 'node:http';
if (typeof http.setGlobalProxyFromEnv === 'function') http.setGlobalProxyFromEnv();
const PORTAL = 'https://turnaje.sstz.sk';
const norm = s => String(s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
const text = s => String(s || '').replace(/<script\b[\s\S]*?<\/script>/gi, '').replace(/<style\b[\s\S]*?<\/style>/gi, '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/&#0*39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
const iso = s => { const m = s?.match(/\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/); if (!m) return ''; const result = `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`; const parsed = new Date(`${result}T12:00:00Z`); return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,10) === result ? result : ''; };
async function load(url, {signal} = {}) {
  const u = new URL(url);
  if (!['turnaje.sstz.sk','www.sstz.sk'].includes(u.hostname) || u.protocol !== 'https:') throw new Error('Neplatný zdroj SSTZ.');
  const response = await fetch(u, {redirect:'error', headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36', 'Accept-Language':'sk-SK'}, signal:signal ? AbortSignal.any([signal,AbortSignal.timeout(14000)]) : AbortSignal.timeout(14000)});
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
  const explicitGender = norm(value('Pohlavie'));
  const gender = /^(muz|muzi|muzske|chlapec|chlapci)$/.test(explicitGender) ? 'male' : /^(zena|zeny|zenske|dievca|dievcata)$/.test(explicitGender) ? 'female' : male !== female ? (male ? 'male':'female') : null;
  return { name:value('Hráč'), birthYear:Number(value('Rok narodenia')) || null, club:value('Aktuálny klub'), licenseUntil:iso(value('Licencia')), gender, region:null };
}
export function parseCategories(html) {
  return html.split(/<div class="card-header">/).slice(1).flatMap(block => {
    const label = text(block.match(/<h5[^>]*>([\s\S]*?)<\/h5>/)?.[1]);
    const age = text(block.match(/Veková kategória:<\/span>([\s\S]*?)<\/p>/)?.[1]);
    const gender = norm(text(block.match(/Pohlavie:<\/span>([\s\S]*?)<\/p>/)?.[1]));
    const type = norm(text(block.match(/Typ:<\/span>([\s\S]*?)<\/p>/)?.[1]));
    return label && age ? [{label, age, gender:/^(muzi|muz|muzske|chlapci)$/.test(gender) ? 'male' : /^(zeny|zena|zenske|dievcata)$/.test(gender) ? 'female' : /^(zmiesane|mixed|muzi a zeny|chlapci a dievcata)$/.test(gender) ? 'mixed' : null, singles:/singles|dvojhra|jednotliv/.test(type)}] : [];
  });
}
export function eligibleCategories(event, player, categories, rules = '', today = new Date().toLocaleDateString('sv-SE', {timeZone:'Europe/Bratislava'}), nowTime = new Date().toLocaleTimeString('sv-SE', {timeZone:'Europe/Bratislava', hour12:false})) {
  if (!event.registrationUrl || event.date < today || !player.birthYear || !player.gender || !player.licenseUntil || player.licenseUntil < event.date) return [];
  const publishedRules = norm(rules).replace(/\s+/g,' ');
  // Propositions also publish the time BEFORE the date (18,00 hod.24.10. 2026).
  const deadlineSection = publishedRules.replace(/(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/g,'$1.$2.$3').match(/(?:uzavierka|prihlasky|do terminu)(.{0,200})/i)?.[1];
  const deadline = deadlineSection?.match(/(\d{1,2}\.\d{1,2}\.\d{4})/);
  if (deadline) {
    const deadlineDate = iso(deadline[1]);
    const before = deadlineSection.slice(0,deadline.index);
    const after = deadlineSection.slice(deadline.index+deadline[0].length);
    const time = before.match(/(\d{1,2})[:.,](\d{2})\s*(?:hod\.?|h\b)/) || after.match(/^\s*,?\s*(\d{1,2}):(\d{2})/);
    const deadlineTime = time && Number(time[1]) < 24 && Number(time[2]) < 60 ? `${time[1].padStart(2,'0')}:${time[2]}` : null;
    if (!deadlineDate || deadlineDate < today || (deadlineDate === today && deadlineTime && deadlineTime <= nowTime)) return [];
  }
  return categories.flatMap(category => {
    if (!category.singles || !category.gender || (category.gender !== 'mixed' && category.gender !== player.gender)) return [];
    const scopedRules = rulesForCategory(category,categories,rules);
    const policy = participationPolicy(scopedRules,event.title);
    const conditions = norm(event.title)+' '+policy.generalRules;
    const open = /\bopen\b/.test(norm(event.title));
    if (!open && policy.regionalTitle && !policy.allowedRegions.length && !policy.publicParticipation) return [];
    if (/skolsk|majstrovstv|pozvank|nominovan|kvalifik|len pre|vyhradne|iba pre|rebric.{0,40}(?:do |nad |prvych|top|[0-9])|vykonnostn|bodov.{0,20}limit|(?:do|nad|top|prvych).{0,30}\d.{0,30}rebric/.test(conditions)) return [];
    const participation = categoryParticipation(category,player,categories,event,scopedRules,policy);
    if (!participation) return [];
    return [{...category,reason:`Ročník ${player.birthYear} · ${category.label}`,minimumBirthYear:participation.minimumBirthYear,maximumBirthYear:participation.maximumBirthYear,ageVerified:participation.known,eligibility:participation.eligibility,conditions:participation.conditions}];
  });
}
async function propositions(url, options = {}, depth = 0) {
  options.signal?.throwIfAborted();
  if (depth > 2) throw new Error("Nečitateľné propozície turnaja.");
  const response = await load(url, options);
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
      for(let i=1;i<=doc.numPages;i++) { options.signal?.throwIfAborted(); const page=await doc.getPage(i); const content=await page.getTextContent(); lines.push(content.items.map(item=>item.str+(item.hasEOL?'\n':' ')).join('')); }
      return lines.join('\n');
    } finally {await task.destroy();}
  }
  const html=await response.text();
  const pdf=html.match(/href="([^"?#]+\.pdf)"/);
  return pdf ? propositions(new URL(pdf[1],PORTAL).href, options, depth+1) : text(html.split('min-vh-100')[1] || '');
}
// Read the upcoming section first and stop at the upcoming/past boundary. The
// published total includes the archive and must never drive this scan or its UI.
export async function collectTournamentCatalogue(readPage = load, today = new Date().toLocaleDateString('sv-SE', {timeZone:'Europe/Bratislava'}), {signal} = {}) {
  const events = new Map();
  let pageCount = 0;
  let duplicate = false;
  const scan = async pageSize => {
    let pastSeen = false;
    for (let page = 1; ; page++) {
      signal?.throwIfAborted();
      const url = new URL('/turnaje', PORTAL);
      url.search = new URLSearchParams({onpage:String(pageSize),sorting:'date-desc',page:String(page)}).toString();
      const html = await (await readPage(url.href, {signal})).text();
      pageCount++;
      const upcoming = parseUpcoming(html, today);
      const cards = html.split(/<div class="card card-hover grd-trn__wrap[^>]*>/).slice(1);
      const dates = cards.map(block => iso(text(block.match(/icon-calendar[\s\S]*?<\/svg>([\s\S]*?)<\/div>/)?.[1])));
      if (dates.some(date => !date)) throw new Error('SSTZ vrátilo nečitateľný dátum. Nadchádzajúce turnaje sa nedajú úplne overiť.');
      for (const date of dates) {
        // SSTZ pins upcoming events first (ascending), followed by its archive.
        if (date < today) pastSeen = true;
        else if (pastSeen) throw new Error('SSTZ zmenilo poradie termínov. Skús obnoviť nadchádzajúce turnaje.');
      }
      if (upcoming.length !== dates.filter(date=>date >= today).length) throw new Error('SSTZ vrátilo neúplné údaje nadchádzajúceho turnaja.');
      for (const event of upcoming) {
        if (pageSize === 60 && events.has(event.id)) duplicate = true;
        events.set(event.id,event);
      }
      // A mixed boundary page is normal: never follow it into the archive.
      if (dates.some(date => date < today)) return;
      const pages = [...html.matchAll(/<ul\b[^>]*class="[^"]*pagination[^"]*"[^>]*>([\s\S]*?)<\/ul>/gi)].flatMap(m => [...m[1].matchAll(/href="([^"]+)"/g)].flatMap(link => {
        try {
          const next = new URL(link[1].replace(/&amp;/g,'&'),PORTAL);
          const n = Number(next.searchParams.get('page') || 1);
          return next.origin === PORTAL && next.pathname === '/turnaje' && Number.isSafeInteger(n) && n > page ? [n] : [];
        } catch { return []; }
      }));
      if (!pages.length) return;
      if (!cards.length) throw new Error('SSTZ vrátilo prázdnu stranu pred koncom nadchádzajúcich turnajov.');
    }
  };
  await scan(60);
  if (duplicate) await scan(48);
  return {events:[...events.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id)),scannedCount:events.size,pageCount,unreadableCount:0};
}

const timeoutMessage = 'SSTZ nestihlo overiť turnaje do 15 sekúnd. Skús obnoviť zoznam.';
async function withinDeadline(operation, milliseconds) {
  const controller = new AbortController();
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(()=>operation(controller.signal)),
      new Promise((_,reject)=>{timer=setTimeout(()=>{const error=new Error(timeoutMessage);controller.abort(error);reject(error);},milliseconds);}),
    ]);
  } finally { clearTimeout(timer); controller.abort(); }
}

export function createRecommendationService({readSource = load, readRules = propositions, now = () => new Date(), timeoutMs = 14000} = {}) {
  let cache;
  let inFlight;
  const snapshot = (today, refresh) => {
    if (!refresh && cache?.today === today && now().getTime()-cache.at <= 300000) return Promise.resolve(cache);
    if (inFlight?.today === today) return inFlight.promise;
    const job = {today,promise:null};
    job.promise = withinDeadline(async signal => {
      const catalogue = await collectTournamentCatalogue(readSource,today,{signal});
      const details = [];
      let unavailable = 0;
      let cursor = 0;
      // Bounded parallelism keeps the complete upcoming set fast without
      // dropping later matches or limiting the number of recommendations.
      await Promise.all(Array.from({length:Math.min(6,catalogue.events.length)},async()=>{
        while (cursor < catalogue.events.length) {
          signal.throwIfAborted();
          const event = catalogue.events[cursor++];
          if (!event.registrationUrl) continue;
          try {
            const [detail,rules] = await Promise.all([
              readSource(event.url,{signal}).then(response=>response.text()),
              readRules(event.propositionUrl,{signal}),
            ]);
            signal.throwIfAborted();
            const categories = parseCategories(detail);
            if (!categories.length) throw new Error('Kategórie turnaja sa nedajú overiť.');
            details.push({...event,categories,rules});
          } catch (error) {
            signal.throwIfAborted();
            unavailable++;
            console.warn(`SSTZ turnaj ${event.id}: ${error.message}`);
          }
        }
      }));
      signal.throwIfAborted();
      const result = {today,at:now().getTime(),details,unavailable,total:catalogue.events.length,scannedCount:catalogue.scannedCount,pageCount:catalogue.pageCount,catalogueCheckedAt:now().toISOString()};
      cache = result;
      return result;
    }, Math.max(1,timeoutMs-100)).finally(()=>{if(inFlight===job)inFlight=null;});
    inFlight = job;
    return job.promise;
  };
  return async function recommendations(playerId, {refresh = false} = {}) {
    if (!/^\d{1,10}$/.test(playerId)) throw new Error('Najprv pripoj svoj profil hráča zo sstz.sk v sekcii Turnaje.');
    return withinDeadline(async signal => {
      const today=now().toLocaleDateString('sv-SE',{timeZone:'Europe/Bratislava'});
      const [profile,ranks,source]=await Promise.all([
        readSource(`https://www.sstz.sk/hraci/${playerId}`,{signal}).then(response=>response.text()),
        readSource(`https://www.sstz.sk/hraci/${playerId}/rebricky`,{signal}).then(response=>response.text()),
        snapshot(today,refresh),
      ]);
      signal.throwIfAborted();
      const player=parsePlayerEligibility(profile,ranks);
      if (!player.name || !player.birthYear) throw new Error('SSTZ profil neobsahuje overiteľný ročník hráča.');
      const nowTime=now().toLocaleTimeString('sv-SE',{timeZone:'Europe/Bratislava',hour12:false});
      const tournaments=source.details.flatMap(event=>{
        const categories=eligibleCategories(event,player,event.categories,event.rules,today,nowTime);
        return categories.length ? [{id:event.id,title:event.title,date:event.date,url:event.url,registrationUrl:event.registrationUrl,propositionUrl:event.propositionUrl,categories}] : [];
      }).sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
      return {player,tournaments,checkedAt:now().toISOString(),catalogueCheckedAt:source.catalogueCheckedAt,scannedCount:source.scannedCount,pageCount:source.pageCount,checkedCount:source.total,unavailableCount:source.unavailable,sourceUrl:PORTAL+'/turnaje?sorting=date-desc',note:'Kontrolujeme iba nadchádzajúce turnaje SSTZ. Kategórie vyhodnocujeme z aktuálnych údajov každého turnaja a jeho propozícií podľa ročníka, pohlavia a platnosti licencie. Regionálne a rebríčkové podmienky uvádzame pri konkrétnej kategórii. Pri každom turnaji sa kontrolujú propozície. Podmienečné možnosti sú označené a ich účasť si over v propozíciách. Školské, nominačné a iné neoveriteľné obmedzenia sa neodporúčajú. Pridanie do kalendára nie je registrácia.'};
    },timeoutMs);
  };
}
export const recommendations = createRecommendationService();
