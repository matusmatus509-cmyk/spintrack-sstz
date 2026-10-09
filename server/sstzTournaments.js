// Scraper for official SSTZ tournament player records on sstz.sk.
// The portal exposes these through a paginated AJAX collection, not the initial HTML.
import * as http from 'node:http';
import { createHash } from 'node:crypto';

if (typeof http.setGlobalProxyFromEnv === 'function') http.setGlobalProxyFromEnv();

const BASE_URL = 'https://www.sstz.sk';
const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept-Language': 'sk-SK,sk;q=0.9,en-US;q=0.7,en;q=0.6',
  'Cache-Control': 'no-cache'
};

function decodeHtml(value = '') {
  return value
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

function htmlText(value = '') {
  return decodeHtml(value.replace(/<br\s*\/?\s*>/gi, ' ').replace(/<[^>]*>/g, ' '))
    .replace(/[\u00a0\s]+/g, ' ').trim();
}

function getAttribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, 'i'));
  return match ? decodeHtml(match[2]) : '';
}

async function fetchSstz(url, { cookie = '', referer = `${BASE_URL}/`, xhr = false } = {}) {
  const headers = { ...DEFAULT_HEADERS, Referer: referer };
  if (cookie) headers.Cookie = cookie;
  if (xhr) headers['X-Requested-With'] = 'XMLHttpRequest';
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(30000) });
  if (!response.ok) {
    const error = new Error(`SSTZ HTTP ${response.status}: ${url}`);
    error.status = response.status;
    throw error;
  }
  return response;
}

function sessionCookie(response) {
  const cookies = response.headers.getSetCookie?.() || [];
  return cookies.map(cookie => cookie.split(';', 1)[0]).filter(Boolean).join('; ');
}

function profileName(html) {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  if (!title) throw new Error('SSTZ stránka neobsahuje meno hráča.');
  const name = htmlText(title).replace(/\s*\|\s*SSTZ\s*$/i, '').trim();
  if (!name || /^(SSTZ|Hráči)$/i.test(name)) throw new Error('SSTZ stránka neobsahuje platný profil hráča.');
  return name;
}

function parsePlayerSearchResults(html, limit = 100) {
  const cards = [];
  const marker = /<div\b(?=[^>]*\brole=["']button["'])(?=[^>]*\bclass=["'][^"']*\bplrs-card\b)([^>]*)>/gi;
  const starts = [...html.matchAll(marker)];
  for (let i = 0; i < starts.length && cards.length < limit; i++) {
    const opening = starts[i][0];
    const start = starts[i].index + opening.length;
    const end = starts[i + 1]?.index ?? html.indexOf('class="sidebar col-lg', start);
    const card = html.slice(start, end < 0 ? html.length : end);
    const href = getAttribute(opening, 'onclick').match(/(?:window\.)?location\.href\s*=\s*["'](\/hraci\/(\d+))(?:["'])/i);
    const id = href?.[2];
    const name = htmlText(card.match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/i)?.[1] || '');
    const clubBlock = card.match(/class=["'][^"']*plrs-card__club_current[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1];
    const club = htmlText(clubBlock?.match(/<span\b[^>]*class=["'][^"']*fs-14[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1] || '');
    if (id && name) cards.push({ id, name, ...(club ? { clubName: club } : {}), url: `${BASE_URL}/hraci/${id}/turnaje` });
  }
  return cards;
}

export async function searchSstzTournamentPlayers(query) {
  const term = String(query || '').trim().replace(/\s+/g, ' ');
  if (term.length < 2) return { players: [] };
  const searchUrl = `${BASE_URL}/hraci`;
  const initial = await fetchSstz(searchUrl);
  const cookie = sessionCookie(initial);
  const page = await initial.text();
  const form = page.match(/<form\b(?=[^>]*\bid=["']mainFilterForm["'])([^>]*)>([\s\S]*?)<\/form>/i);
  if (!form) throw new Error('Nepodarilo sa načítať vyhľadávanie hráčov na SSTZ.');
  const action = new URL(getAttribute(form[1], 'action') || '/hraci', BASE_URL);
  if (action.origin !== BASE_URL) throw new Error('SSTZ vrátilo neplatný odkaz na vyhľadávanie.');
  const body = new URLSearchParams();
  for (const input of form[2].matchAll(/<input\b[^>]*>/gi)) {
    const tag = input[0];
    if (getAttribute(tag, 'type').toLowerCase() !== 'hidden') continue;
    const name = getAttribute(tag, 'name');
    if (name) body.append(name, getAttribute(tag, 'value'));
  }
  body.set('fulltext', term);
  const filtered = await fetch(action, {
    method: 'POST',
    headers: { ...DEFAULT_HEADERS, Cookie: cookie, Referer: searchUrl, Origin: BASE_URL, 'X-Requested-With': 'XMLHttpRequest', 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', Accept: 'application/json, text/javascript, */*; q=0.01' },
    body,
    signal: AbortSignal.timeout(30000)
  });
  if (!filtered.ok) throw new Error(`SSTZ vyhľadávanie zlyhalo (HTTP ${filtered.status}).`);
  const result = await filtered.json();
  if (typeof result.url !== 'string' || typeof result.content !== 'string') throw new Error('SSTZ vrátilo neúplné výsledky vyhľadávania.');
  const resultsUrl = new URL(result.url, searchUrl);
  if (resultsUrl.origin !== BASE_URL || resultsUrl.pathname !== '/hraci') throw new Error('SSTZ vrátilo neplatnú adresu výsledkov.');
  resultsUrl.searchParams.set('onpage', '240');
  const resultsPage = await fetchSstz(resultsUrl, { cookie, referer: searchUrl });
  return { players: parsePlayerSearchResults(await resultsPage.text()) };
}

function parseDate(eventTitle) {
  const match = eventTitle.match(/\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/);
  if (!match) return '';
  return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
}

function seasonFromDate(date) {
  const year = Number(date.slice(0, 4));
  const seasonStart = Number(date.slice(5, 7)) >= 7 ? year : year - 1;
  return `${seasonStart}/${String((seasonStart + 1) % 100).padStart(2, '0')}`;
}

function classBlock(html, className) {
  const match = html.match(new RegExp(`<div\\b(?=[^>]*\\bclass=["'][^"']*\\b${className}\\b)[^>]*>([\\s\\S]*?)<\\/div>`, 'i'));
  return match?.[1] || '';
}

function gridValue(html) {
  return htmlText(html.match(/<span\b(?=[^>]*\bclass=["'][^"']*\bg3__value\b)[^>]*>([\s\S]*?)<\/span>/i)?.[1] || '');
}

function parseScore(html) {
  const match = html.match(/<span\b(?=[^>]*\bclass=["'][^"']*\b(text-success|text-danger)\b)[^>]*>([\s\S]*?)<\/span>/i);
  if (!match) throw new Error('SSTZ turnajový duel nemá overený výsledok.');
  const score = htmlText(match[2]).replace(/\s*:\s*/g, ':');
  const values = score.match(/^(\d+)\s*:\s*(\d+)$/);
  if (!values) throw new Error(`SSTZ vrátilo neznámy výsledok turnaja: ${score || 'prázdny'}.`);
  return { score, result: match[1].toLowerCase() === 'text-success' ? 'WIN' : 'LOSS' };
}

export function parseTournamentPage(html, playerId) {
  const headings = [...html.matchAll(/<h4\b[^>]*>([\s\S]*?)<\/h4>/gi)];
  const duels = [];
  const seenIds = new Map();
  for (let i = 0; i < headings.length; i++) {
    const eventName = htmlText(headings[i][1]);
    const eventDate = parseDate(eventName);
    const start = headings[i].index + headings[i][0].length;
    const end = headings[i + 1]?.index ?? html.length;
    const section = html.slice(start, end);
    const cards = [...section.matchAll(/<div\b(?=[^>]*\bclass=["'][^"']*\bmb-3\s+border-bottom\b)[^>]*>/gi)];
    for (let j = 0; j < cards.length; j++) {
      const cardStart = cards[j].index + cards[j][0].length;
      const cardEnd = cards[j + 1]?.index ?? section.length;
      const card = section.slice(cardStart, cardEnd);
      const categoryHtml = classBlock(card, 'gridc__c1');
      const opponentHtml = classBlock(card, 'gridc__c2');
      const roundHtml = classBlock(card, 'gridc__c3');
      const scoreHtml = classBlock(card, 'gridc__c4');
      const category = gridValue(categoryHtml);
      const opponentName = htmlText(opponentHtml.match(/<span\b(?=[^>]*\bclass=["'][^"']*\bg3__value\b)[^>]*>([\s\S]*?)<br\s*\/?\s*>/i)?.[1] || gridValue(opponentHtml));
      const round = gridValue(roundHtml);
      if (!eventName || !eventDate || !category || !opponentName || !round) {
        throw new Error('SSTZ turnajový duel nemá kompletné údaje o turnaji, dátume, kategórii alebo súperovi.');
      }
      const { score, result } = parseScore(scoreHtml);
      const clubName = htmlText(opponentHtml.match(/<span\b(?=[^>]*\bclass=["'][^"']*\bfs\s+small\s+text-muted\b)[^>]*>([\s\S]*?)<\/span>/i)?.[1] || '');
      const additionalTeam = htmlText(categoryHtml.match(/<span\b(?=[^>]*\bclass=["'][^"']*\bfs\s+small\s+text-muted\b)[^>]*>([\s\S]*?)<\/span>/i)?.[1] || '');
      const rowKey = [eventDate, eventName, category, additionalTeam, round, opponentName, clubName, score].join('|');
      const occurrence = seenIds.get(rowKey) || 0;
      seenIds.set(rowKey, occurrence + 1);
      const id = createHash('sha256').update(`${playerId}|${rowKey}|${occurrence}`).digest('hex').slice(0, 24);
      const matchType = /(?:štvorhr|dvojice|doubles?|double)/i.test(category) ? 'doubles' : 'singles';
      const duel = { id, date: eventDate, season: seasonFromDate(eventDate), tournamentName: eventName, category, round, opponentName, result, score, matchType, sets: [] };
      if (clubName) duel.opponentClub = clubName;
      if (additionalTeam) {
        if (matchType === 'doubles') duel.partnerName = additionalTeam;
        else duel.teamName = additionalTeam;
      }
      duels.push(duel);
    }
  }
  return duels;
}

function parseAjaxConfig(html, playerId) {
  const block = html.match(/<div\b(?=[^>]*\bdata-provider=["']ajaxContent["'])([^>]*)>/i);
  if (!block) throw new Error('SSTZ stránka neobsahuje turnajový zoznam.');
  let config;
  try { config = JSON.parse(decodeHtml(getAttribute(block[0], 'data-config'))); }
  catch { throw new Error('SSTZ turnajový zoznam má neplatné nastavenia stránkovania.'); }
  const url = new URL(config.fetchUrl || '', BASE_URL);
  if (url.origin !== BASE_URL || url.pathname !== `/hraci/${playerId}/turnaje` || config.name !== 'player_tournament' || config.fetchMethod !== 'POST') {
    throw new Error('SSTZ turnajový zoznam vrátil neočakávaný zdroj.');
  }
  const data = config.fetchData;
  if (!data || data._request !== 'App\\Requests\\Frontend\\PlayerTournamentFilterRequest' || String(data.iid || '') === '') {
    throw new Error('SSTZ turnajový zoznam nemá identifikáciu profilu.');
  }
  return { config, url };
}

async function fetchTournamentPage(url, cookie, config, page, counter) {
  const form = new FormData();
  form.append('provider', config.provider || 'ajaxContent');
  for (const [key, value] of Object.entries(config.fetchData)) form.append(key, String(value ?? ''));
  const p = config.pagination;
  form.append('pagination[page]', String(page));
  form.append('pagination[perPage]', String(p.perPage));
  form.append('pagination[firstPagePerPage]', String(p.firstPagePerPage));
  form.append('pagination[offset]', page === 1 ? (p.offset == null ? 'null' : String(p.offset)) : '-1');
  form.append('pagination[firstOffset]', String(p.firstOffset ?? (Number(p.perPage) * Number(p.page || 1))));
  form.append('pagination[strategy]', String(p.strategy));
  form.append('pagination[counter]', String(counter));
  form.append('qs', String(config.fetchQueryString || ''));
  const response = await fetch(url, {
    method: config.fetchMethod,
    headers: { ...DEFAULT_HEADERS, Cookie: cookie, Referer: url.href, Origin: BASE_URL, 'X-Requested-With': 'XMLHttpRequest', Accept: 'application/json, text/javascript, */*; q=0.01' },
    body: form,
    signal: AbortSignal.timeout(30000)
  });
  if (!response.ok) throw new Error(`SSTZ načítanie turnajovej strany ${page} zlyhalo (HTTP ${response.status}).`);
  const data = await response.json();
  const total = Number(data.paginator?.total);
  const pageCurrent = Number(data.paginator?.pageCurrent);
  const pageNext = data.paginator?.pageNext == null ? null : Number(data.paginator.pageNext);
  if (typeof data.content !== 'string' || !Number.isInteger(total) || total < 0 || pageCurrent !== page
    || (pageNext !== null && (!Number.isInteger(pageNext) || pageNext !== page + 1))) {
    throw new Error(`SSTZ stránka ${page} vrátila neúplné alebo neplatné stránkovanie.`);
  }
  return { html: data.content, total, pageNext };
}

export async function getSstzTournamentProfile(playerId) {
  playerId = String(playerId);
  if (!/^\d+$/.test(playerId)) throw new Error('Zadaj platné SSTZ ID hráča.');
  const url = `${BASE_URL}/hraci/${playerId}/turnaje`;
  const initial = await fetchSstz(url);
  const cookie = sessionCookie(initial);
  const profileHtml = await initial.text();
  const name = profileName(profileHtml);
  const ajax = parseAjaxConfig(profileHtml, playerId);
  const first = await fetchTournamentPage(ajax.url, cookie, ajax.config, 1, 1);
  const duels = [...parseTournamentPage(first.html, playerId)];
  let next = first.pageNext;
  let page = 2;
  while (next !== null) {
    if (next !== page || page > 500) throw new Error('SSTZ vrátilo neplatnú alebo príliš dlhú históriu stránkovania.');
    const result = await fetchTournamentPage(ajax.url, cookie, ajax.config, page, page);
    if (result.total !== first.total) throw new Error('Počet turnajových zápasov sa počas importu zmenil. Skús import zopakovať.');
    duels.push(...parseTournamentPage(result.html, playerId));
    next = result.pageNext;
    page++;
  }
  if (duels.length !== first.total) throw new Error(`Neúplná SSTZ história: načítané ${duels.length} z ${first.total} turnajových duelov.`);
  const ids = new Set();
  for (const duel of duels) {
    if (ids.has(duel.id)) throw new Error('SSTZ vrátilo duplicitný turnajový duel. Import bol zrušený.');
    ids.add(duel.id);
  }
  return {
    id: playerId, name, complete: true,
    singlesStats: { played: duels.filter(m => m.matchType === 'singles').length },
    doublesStats: { played: duels.filter(m => m.matchType === 'doubles').length },
    matches: duels.filter(m => m.matchType === 'singles'),
    doublesMatches: duels.filter(m => m.matchType === 'doubles').map(({ opponentName, ...m }) => ({
      ...m, opponentPair: opponentName, partnerId: '', type: 'doubles'
    }))
  };
}
