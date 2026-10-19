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
// Scan the whole catalogue; older or invalid dates never terminate pagination.
export async function collectTournamentCatalogue(readPage = load, today = new Date().toLocaleDateString('sv-SE', {timeZone:'Europe/Bratislava'})) {
  const firstUrl = `${PORTAL}/turnaje?onpage=60&sorting=date-desc&page=1`;
  const parse = html => {
    const cards = html.split(/<div class="card card-hover grd-trn__wrap[^>]*>/).slice(1);
    const events = parseUpcoming(html, today);
    const ids = cards.map(block => block.match(/href="\/turnaj\/([^"?#/]+)"[^>]*>\s*<h3[^>]*>/)?.[1]);
    if (ids.some(id => !id)) throw new Error('SSTZ vrátilo nečitateľný turnaj. Úplnosť zoznamu sa nedá potvrdiť.');
    const totals = [...html.matchAll(/>([\d\s\u00a0]+)\s+turnaj(?:ov|e)?\s*</gi)].map(m => Number(m[1].replace(/\s/g, '')));
    if (new Set(totals).size > 1) throw new Error('SSTZ zmenilo počet turnajov počas načítania. Skús obnoviť zoznam.');
    const pages = [...html.matchAll(/<ul\b[^>]*class="[^"]*pagination[^"]*"[^>]*>([\s\S]*?)<\/ul>/gi)].flatMap(m => [...m[1].matchAll(/href="([^"]+)"/g)].flatMap(link => {
      try {
        const url = new URL(link[1].replace(/&amp;/g, '&'), PORTAL);
        const page = Number(url.searchParams.get('page') || 1);
        return url.origin === PORTAL && url.pathname === '/turnaje' && Number.isSafeInteger(page) && page > 0 ? [page] : [];
      } catch { return []; }
    }));
    const unreadable = cards.flatMap((block,index) => !iso(text(block.match(/icon-calendar[\s\S]*?<\/svg>([\s\S]*?)<\/div>/)?.[1])) ? [ids[index]] : []);
    return {ids, events, total:totals[0] ?? null, lastPage:Math.max(1, ...pages), unreadable};
  };
  const scan = async (pageSize, sorting = "date-desc") => {
    const startUrl = new URL(firstUrl); startUrl.searchParams.set('onpage', String(pageSize)); startUrl.searchParams.set('sorting', sorting);
    const first = parse(await (await readPage(startUrl.href)).text());
    const pageCount = Math.max(first.lastPage, first.total == null ? 1 : Math.ceil(first.total / pageSize));
    if (pageCount > 1000 || (pageCount > 1 && first.total == null)) throw new Error('SSTZ neposkytlo overiteľné stránkovanie celého zoznamu.');
    const rows = [first];
    for (let page = 2; page <= pageCount; page += 3) {
      const batch = await Promise.all(Array.from({length:Math.min(3, pageCount-page+1)}, async (_, index) => {
        const url = new URL(startUrl); url.searchParams.set('page', String(page+index));
        const result = parse(await (await readPage(url.href)).text());
        if (result.total !== first.total || result.lastPage > pageCount) throw new Error('Počet turnajov sa počas načítania zmenil. Obnov zoznam.');
        if (!result.ids.length) throw new Error('SSTZ vrátilo prázdnu stranu pred koncom zoznamu.');
        return result;
      }));
      rows.push(...batch);
    }
    if (first.total !== null && rows.reduce((sum,row) => sum+row.ids.length,0) !== first.total) throw new Error('SSTZ vrátilo neúplné stránky zoznamu.');
    return {rows, total:first.total, pageCount};
  };
  const first = await scan(60);
  let rows = first.rows;
  let pageCount = first.pageCount;
  let ids = new Set(rows.flatMap(row => row.ids));
  // Equal-date ordering on SSTZ can repeat boundary rows. A different supported
  // page size recovers those boundaries; verify unique coverage before claiming success.
  if (first.total !== null && ids.size !== first.total) {
    const recovery = await scan(48, 'date-asc');
    if (recovery.total !== first.total) throw new Error('Počet turnajov sa počas načítania zmenil. Obnov zoznam.');
    rows = [...rows,...recovery.rows];
    pageCount += recovery.pageCount;
    ids = new Set(rows.flatMap(row => row.ids));
  }
  const missingCount = first.total === null ? 0 : Math.max(0, first.total - ids.size);
  const events = [...new Map(rows.flatMap(row => row.events).map(event => [event.id,event])).values()];
  return {events,scannedCount:ids.size,catalogueCount:first.total ?? ids.size,missingCount,pageCount,unreadableCount:new Set(rows.flatMap(row => row.unreadable)).size};
}

export function createRecommendationService({readSource = load, readRules = propositions, now = () => new Date()} = {}) {
  let cache;
  let inFlight;
  return async function recommendations(playerId, {refresh = false} = {}) {
    if (!/^\d{1,10}$/.test(playerId)) throw new Error('Najprv pripoj svoj profil hráča zo sstz.sk v sekcii Turnaje.');
    const today=now().toLocaleDateString('sv-SE',{timeZone:'Europe/Bratislava'});
    const [profile,ranks]=await Promise.all([readSource(`https://www.sstz.sk/hraci/${playerId}`),readSource(`https://www.sstz.sk/hraci/${playerId}/rebricky`)]);
    const player=parsePlayerEligibility(await profile.text(),await ranks.text());
    if (!player.name || !player.birthYear) throw new Error('SSTZ profil neobsahuje overiteľný ročník hráča.');
    if (refresh || !cache || cache.today !== today || now().getTime()-cache.at>300000) {
      if (!inFlight || inFlight.today !== today) {
        const job = {today, promise:null};
        job.promise = (async () => {
          const catalogue = await collectTournamentCatalogue(readSource, today);
          const details=[]; let unavailable=catalogue.unreadableCount;
          for (let i=0;i<catalogue.events.length;i+=3) {
            await Promise.all(catalogue.events.slice(i,i+3).map(async event=>{
              try {
                const detail=await readSource(event.url);
                const categories=parseCategories(await detail.text());
                if (!categories.length) throw new Error('Kategórie turnaja sa nedajú overiť.');
                const rules=await readRules(event.propositionUrl);
                details.push({...event,categories,rules});
              } catch (error) {unavailable++; console.warn(`SSTZ turnaj ${event.id}: ${error.message}`);}
            }));
          }
          const result = {today,at:now().getTime(),details,unavailable,total:catalogue.events.length,scannedCount:catalogue.scannedCount,pageCount:catalogue.pageCount,catalogueCount:catalogue.catalogueCount,missingCount:catalogue.missingCount,catalogueCheckedAt:now().toISOString()};
          cache=result;
          return result;
        })().finally(() => {if(inFlight===job) inFlight=null;});
        inFlight=job;
      }
      await inFlight.promise;
    }
    const nowTime=now().toLocaleTimeString('sv-SE',{timeZone:'Europe/Bratislava',hour12:false});
    const tournaments=cache.details.flatMap(event=>{
      const categories=eligibleCategories(event,player,event.categories,event.rules,today,nowTime);
      return categories.length ? [{id:event.id,title:event.title,date:event.date,url:event.url,registrationUrl:event.registrationUrl,propositionUrl:event.propositionUrl,categories}] : [];
    }).sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
    return {player,tournaments,checkedAt:now().toISOString(),catalogueCheckedAt:cache.catalogueCheckedAt,scannedCount:cache.scannedCount,pageCount:cache.pageCount,catalogueCount:cache.catalogueCount,missingCount:cache.missingCount,checkedCount:cache.total,unavailableCount:cache.unavailable,sourceUrl:PORTAL+'/turnaje',note:'Zobrazujeme všetky overené vhodné mládežnícke kategórie s otvorenou účasťou podľa ročníka, pohlavia a platnosti licencie. Pri každom turnaji sa kontrolujú propozície. Uzavreté regionálne, školské a kvalifikačné súťaže ani neoverené podmienky sa neodporúčajú. Pridanie do kalendára nie je registrácia.'};
  };
}
export const recommendations = createRecommendationService();
