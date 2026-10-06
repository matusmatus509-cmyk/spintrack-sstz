/**
 * SSTZ / stolnytenis.info scraper — REAL DATA ONLY.
 *
 * Zásady (dôležité kvôli dôveryhodnosti dát v aplikácii):
 *  1. Nikdy sa nevymýšľajú hodnoty. Ak niečo na stránke nie je, je to `null` a v UI sa
 *     to zobrazí ako „—" alebo sa zápas vôbec nezobrazí.
 *  2. Každý odohraný duel sa berie presne tak, ako ho zverejňuje stolnytenis.info,
 *     vrátane „oficiálnej" skrátenej hodnoty setu (`+9`, `-10`, ...).
 *  3. Presné skóre setu (`11:9`) sa dá z oficiálnej hodnoty odvodiť jednoznačne:
 *     veľkosť čísla = počet bodov prehrávajúceho, znamienko = kto set vyhral.
 *     Odvodené hodnoty sú vždy označené príznakom `derived: true` + je uložená
 *     oficiálna hodnota (`officialValue`), takže sa dá všetko spätne overiť na webe.
 *  4. Po stiahnutí sa dáta automaticky krížovo overia voči oficiálnym súhrnom,
 *     ktoré zverejňuje priamo SSTZ (Úspešnosť - Dvojhry/Štvorhry: Celkom/Doma/Vonku).
 *     Ak nesúhlasia, výsledok je označený ako neverejný (`verified: false`) a
 *     aplikácia to zobrazí ako upozornenie — nič sa „nedopĺňa" umelo.
 */

export const BASE_URL = 'https://www.stolnytenis.info';

import { readCache, writeCache, currentSeasonSlug } from './sstzCache.js';

const DEFAULT_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'sk-SK,sk;q=0.9,cs;q=0.8,en-US;q=0.7,en;q=0.6',
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
};

// ---------------------------------------------------------------------------
// Jednoduchý HTTP klient so session (cookies + CSRF), rate-limitom a retry
// ---------------------------------------------------------------------------

const MIN_GAP_MS = Number(process.env.SSTZ_MIN_GAP_MS || 400);
const REQUEST_TIMEOUT_MS = Number(process.env.SSTZ_TIMEOUT_MS || 25000);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let lastRequestAt = 0;

async function throttle() {
  const wait = lastRequestAt + MIN_GAP_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();
}

export class SstzError extends Error {
  constructor(message, { status, url, kind } = {}) {
    super(message);
    this.name = 'SstzError';
    this.status = status;
    this.url = url;
    this.kind = kind || 'http';
  }
}

function parseSetCookies(res) {
  let raw = [];
  if (typeof res.headers.getSetCookie === 'function') {
    raw = res.headers.getSetCookie();
  } else {
    const single = res.headers.get('set-cookie');
    if (single) raw = [single];
  }
  return raw.map((c) => (c ? c.split(';')[0] : '')).filter(Boolean);
}

function mergeCookies(existing, incoming) {
  const jar = new Map();
  for (const part of `${existing || ''}; ${(incoming || []).join('; ')}`.split(';')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    jar.set(trimmed.slice(0, eq).trim(), trimmed.slice(eq + 1));
  }
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
}

let session = { cookie: '', csrf: '', fetchedAt: 0 };

export function getSessionInfo() {
  return { cookie: session.cookie, csrf: session.csrf };
}

/** Načíta cookies + CSRF token. Token sa používa pri POST požiadavkách (zmena sezóny). */
export async function ensureSession(force = false) {
  if (!force && session.cookie && Date.now() - session.fetchedAt < 20 * 60 * 1000) {
    return session;
  }
  try {
    await throttle();
    const res = await fetch(`${BASE_URL}/`, {
      headers: DEFAULT_HEADERS,
      redirect: 'follow',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const cookie = mergeCookies(session.cookie, parseSetCookies(res));
    const html = await res.text();
    const csrfMatch =
      html.match(/<meta\s+name=["']csrf-token["']\s+content=["']([^"']+)["']/i) ||
      html.match(/name=["']csrf-token["'][^>]*content=["']([^"']+)["']/i);
    session = { cookie, csrf: csrfMatch ? csrfMatch[1] : '', fetchedAt: Date.now() };
  } catch (err) {
    // Session nie je kritická pre GET požiadavky – pokračujeme bez nej.
    session = { ...session, fetchedAt: Date.now() };
  }
  return session;
}

/** GET so zachovaním session, retry na 429/5xx a jasnými chybami pre UI. */
export async function fetchPage(pathOrUrl, { cookie, retries = 2 } = {}) {
  const url = pathOrUrl.startsWith('http') ? pathOrUrl : `${BASE_URL}${pathOrUrl}`;
  let attempt = 0;

  for (;;) {
    await throttle();
    try {
      const res = await fetch(url, {
        headers: { ...DEFAULT_HEADERS, ...(cookie ? { Cookie: cookie } : {}) },
        redirect: 'follow',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (res.status === 429 || res.status === 503) {
        const retryAfter = Number(res.headers.get('retry-after') || 0);
        if (attempt < retries) {
          attempt += 1;
          await sleep(Math.max(retryAfter * 1000, 1500 * attempt));
          continue;
        }
        throw new SstzError(
          'Server stolnytenis.info vrátil 429 (príliš veľa požiadaviek). Skús synchronizáciu o chvíľu.',
          { status: res.status, url, kind: 'rate-limit' }
        );
      }

      if (!res.ok) {
        if (res.status >= 500 && attempt < retries) {
          attempt += 1;
          await sleep(800 * attempt);
          continue;
        }
        throw new SstzError(`Server vrátil HTTP ${res.status}.`, {
          status: res.status,
          url,
          kind: 'http',
        });
      }

      return { html: await res.text(), url, status: res.status };
    } catch (err) {
      if (err instanceof SstzError) throw err;
      if (attempt < retries) {
        attempt += 1;
        await sleep(700 * attempt);
        continue;
      }
      throw new SstzError(
        `Nepodarilo sa spojiť so stolnytenis.info (${err?.cause?.message || err.message}).`,
        { url, kind: 'network' }
      );
    }
  }
}

/** POST (napr. prepnutie sezóny). */
export async function postForm(pathOrUrl, body, { cookie, csrf, referer } = {}) {
  const url = pathOrUrl.startsWith('http') ? pathOrUrl : `${BASE_URL}${pathOrUrl}`;
  await throttle();
  const params = new URLSearchParams(body);
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      ...DEFAULT_HEADERS,
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      Accept: 'application/json, text/javascript, */*; q=0.01',
      ...(csrf ? { 'X-CSRF-TOKEN': csrf } : {}),
      ...(referer ? { Referer: referer.startsWith('http') ? referer : `${BASE_URL}${referer}` } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: params.toString(),
    redirect: 'follow',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const text = await res.text();
  return { status: res.status, text, cookies: parseSetCookies(res), url };
}

// ---------------------------------------------------------------------------
// HTML -> atómy (token stream). Zámerne NEpoužívame CSS triedy (tie sa menia),
// ale poradie textov, odkazov a čísel – presne tak, ako ich stránka zobrazuje.
// ---------------------------------------------------------------------------

const ENTITIES = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&ndash;': '–',
  '&mdash;': '—',
  '&hellip;': '…',
};

export function decodeEntities(str) {
  if (!str) return '';
  return str
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&[a-z]+;/gi, (m) => ENTITIES[m.toLowerCase()] ?? m);
}

const BLOCK_TAGS = new Set([
  'div', 'p', 'li', 'ul', 'ol', 'tr', 'td', 'th', 'table', 'tbody', 'thead', 'tfoot',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'section', 'article', 'header', 'footer', 'nav',
  'form', 'main', 'aside', 'figure', 'figcaption', 'br', 'hr', 'option', 'select', 'dl', 'dt', 'dd',
]);

/**
 * Rozloží HTML na atómy: {type:'link'|'text'|'num'|'signed'|'break'|'attr'}
 *  - 'break' = hranica bloku (nový riadok)
 *  - 'attr'  = dôležitý data-* atribút (napr. data-season_id)
 */
export function htmlToAtoms(html) {
  const cleaned = String(html)
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|svg|noscript|template)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ');

  const atoms = [];
  const tagRe = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^'">])*)>/g;
  let cursor = 0;
  let match;
  const linkStack = [];

  const pushText = (raw) => {
    const text = decodeEntities(raw).replace(/\s+/g, ' ').trim();
    if (!text) return;
    const tokens = text.split(' ');
    for (const token of tokens) {
      if (/^[+-]\d{1,3}$/.test(token)) {
        atoms.push({ type: 'signed', raw: token, value: parseInt(token.slice(1), 10), win: token[0] === '+' });
      } else if (/^\d{1,3}$/.test(token)) {
        atoms.push({ type: 'num', raw: token, value: parseInt(token, 10) });
      } else {
        atoms.push({ type: 'text', text: token });
      }
    }
  };

  const pushBreak = () => {
    if (atoms.length === 0) return;
    if (atoms[atoms.length - 1].type === 'break') return;
    atoms.push({ type: 'break' });
  };

  const emitText = (raw) => {
    const text = decodeEntities(raw).replace(/\s+/g, ' ').trim();
    if (!text) return;
    if (linkStack.length > 0) {
      const current = linkStack[linkStack.length - 1];
      current.text = current.text ? `${current.text} ${text}` : text;
      return;
    }
    pushText(raw);
  };

  while ((match = tagRe.exec(cleaned)) !== null) {
    emitText(cleaned.slice(cursor, match.index));
    cursor = tagRe.lastIndex;

    const [, closing, rawName, rawAttrs] = match;
    const name = rawName.toLowerCase();

    if (name === 'a' && !closing) {
      const hrefMatch = rawAttrs.match(/href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i);
      linkStack.push({
        href: decodeEntities((hrefMatch && (hrefMatch[1] || hrefMatch[2] || hrefMatch[3])) || '').trim(),
        text: '',
      });
    } else if (name === 'a' && closing) {
      const link = linkStack.pop();
      if (link) {
        atoms.push({ type: 'link', href: link.href, text: link.text });
      }
      pushBreak();
    } else if (BLOCK_TAGS.has(name)) {
      pushBreak();
    } else if (!closing) {
      // Zaujímavé atribúty (sezóny, id zápasov, ...)
      const attrMatch = rawAttrs.match(/data-(season[-_]?id|season|id|match[-_]?id|club[-_]?id)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i);
      if (attrMatch) {
        atoms.push({
          type: 'attr',
          name: attrMatch[1].toLowerCase(),
          value: decodeEntities(attrMatch[2] || attrMatch[3] || attrMatch[4] || ''),
        });
      }
    }
  }
  emitText(cleaned.slice(cursor));
  pushBreak();

  return atoms;
}

/** Atómy rozdelí na riadky: { atoms, text, links, nums, signed } */
export function atomsToLines(atoms) {
  const lines = [];
  let current = [];

  const flush = () => {
    if (current.length === 0) return;
    const links = current.filter((a) => a.type === 'link');
    const text = current
      .map((a) => {
        if (a.type === 'link') return a.text;
        if (a.type === 'attr') return '';
        return a.raw || a.text || '';
      })
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    lines.push({
      atoms: current,
      text,
      links,
      nums: current.filter((a) => a.type === 'num'),
      signed: current.filter((a) => a.type === 'signed'),
      attrs: current.filter((a) => a.type === 'attr'),
    });
    current = [];
  };

  for (const atom of atoms) {
    if (atom.type === 'break') flush();
    else current.push(atom);
  }
  flush();

  return lines;
}

export function parseHtmlLines(html) {
  return atomsToLines(htmlToAtoms(html));
}

// ---------------------------------------------------------------------------
// Parsovanie profilu hráča
// ---------------------------------------------------------------------------

const PLAYER_HREF_RE = /^\/?hrac\/(\d+)/i;

export function playerIdFromHref(href) {
  const m = String(href || '').match(/\/?hrac\/(\d+)/i);
  return m ? m[1] : null;
}

export function clubIdFromHref(href) {
  const m = String(href || '').match(/club_id=(\d+)/i);
  return m ? m[1] : null;
}

export function seasonFromHref(href) {
  const m = String(href || '').match(/season_id=(\d+)/i);
  return m ? m[1] : null;
}

export function matchIdFromHref(href) {
  const m = String(href || '').match(/\/zapas\/(\d+)/i);
  return m ? m[1] : null;
}

export function leagueSlugFromHref(href) {
  const m = String(href || '').match(/\/liga\/([^/?#]+)/i);
  return m ? m[1] : null;
}

/** Prevedie oficiálnu skrátenú hodnotu setu na presné skóre (vždy s príznakom derived). */
export function setValueToDetail(officialValue, setNumber) {
  const raw = String(officialValue || '').trim();
  const m = raw.match(/^([+-])(\d{1,3})$/);
  if (!m) return null;
  const playerWon = m[1] === '+';
  const loserPoints = parseInt(m[2], 10);
  const winnerPoints = loserPoints >= 10 ? loserPoints + 2 : 11;
  const playerPoints = playerWon ? winnerPoints : loserPoints;
  const opponentPoints = playerWon ? loserPoints : winnerPoints;
  return {
    setNumber,
    playerPoints,
    opponentPoints,
    display: `${playerPoints}:${opponentPoints}`,
    won: playerWon,
    officialValue: raw,
    derived: true,
  };
}

const ROUND_RE = /^(\d+)\.\s*kolo\s*(?:\/\s*(\d{1,2}\.\d{1,2}\.\d{4}))?$/i;
const STAGE_RE = /^(základná časť|nadstavba|play[\s-]?off|skupina|baráž|o umiestnenie|predkolo|osemfinále|štvrťfinále|semifinále|finále)/i;
const DUEL_LABEL_RE = /^(štvorhra|[A-D]-[U-Z])$/i;
const TEAM_PAIR_RE = /^(.*\S)\s+-\s+(\S.*?)\s*\((\d{1,2})\s*:\s*(\d{1,2})\)$/;

function isPlayerLink(line, playerId) {
  return line.links.some((l) => playerIdFromHref(l.href) === playerId);
}

function linkAtomsOf(line, playerId) {
  return line.atoms.filter((a) => a.type === 'link' && playerIdFromHref(a.href));
}

/**
 * Z jednej stránky hráča vytiahne: meno, dostupné sezóny, súťaže (taby ?s=),
 * oficiálne súhrny a všetky duely (dvojhry aj štvorhry).
 */
export function parsePlayerPage(html, playerId) {
  return parsePlayerLines(parseHtmlLines(html), playerId);
}

/**
 * Jadro parsera – pracuje s riadkami (atómy), takže sa dá testovať aj bez HTML.
 */
export function parsePlayerLines(lines, playerId) {
  const result = {
    playerId: String(playerId),
    name: null,
    seasonLabel: null,
    availableSeasons: [],
    competitions: [],
    stats: {
      singles: { played: null, won: null, home: null, away: null },
      doubles: { played: null, won: null, home: null, away: null },
    },
    duels: [],
    warnings: [],
  };

  // Meno hráča (nadpis stránky / h1)
  for (const line of lines) {
    if (line.links.some((l) => playerIdFromHref(l.href) === String(playerId))) continue;
    if (/^[A-ZČŠŽÁÄÉÍÓÔÚÝĽĹŔŇ][\p{L}'-]+(\s+[A-ZČŠŽÁÄÉÍÓÔÚÝĽĹŔŇ][\p{L}.'-]+){1,3}$/u.test(line.text) && line.text.length < 60) {
      result.name = line.text;
      break;
    }
  }

  // Sezóna: 1) text „Sezóna 2025/26" (prepínač sezón / breadcrumb)
  //         2) slugy líg v navigácii („sezona-2025-26-…") – vždy ide o aktuálnu sezónu session
  for (const line of lines) {
    const m = line.text.match(/Sezóna\s+(\d{4}\/\d{2})/i);
    if (m) {
      result.seasonLabel = m[1];
      break;
    }
  }
  if (!result.seasonLabel) {
    const counters = new Map();
    for (const line of lines) {
      for (const link of line.links) {
        const m = String(link.href || '').match(/\/liga\/sezona-(\d{4})-(\d{2})-/);
        if (!m) continue;
        const label = `${m[1]}/${m[2]}`;
        counters.set(label, (counters.get(label) || 0) + 1);
      }
    }
    const best = [...counters.entries()].sort((a, b) => b[1] - a[1])[0];
    if (best) result.seasonLabel = best[0];
  }

  // Sezóny ponúkané v menu portálu – portál ich adresuje slugom „2025-26"
  // (text v menu je „2025/26"). Nič sa nedopočítava, len sa prepisuje tvar.
  const seasonsSeen = new Map();
  for (const line of lines) {
    for (const match of line.text.matchAll(/\b(20\d{2})\/(\d{2})\b/g)) {
      const slug = `${match[1]}-${match[2]}`;
      seasonsSeen.set(slug, `${match[1]}/${match[2]}`);
    }
  }
  result.availableSeasons = [...seasonsSeen.entries()].map(([slug, label]) => ({
    id: slug,
    slug,
    label,
  }));

  // Súťaže / družstvá hráča = taby profilu (odkazy na ten istý profil).
  // Skenujeme až ZA menom hráča, aby sa nezachytil breadcrumb („Profil").
  const competitionsSeen = new Map();
  const nameIdx = lines.findIndex((l) => l.text && l.text === result.name);
  const tabScanStart = nameIdx >= 0 ? nameIdx + 1 : 0;
  for (let i = tabScanStart; i < lines.length; i += 1) {
    const line = lines[i];
    for (const link of line.links) {
      if (playerIdFromHref(link.href) !== String(playerId)) continue;
      const text = (link.text || '').trim();
      if (!text || text === result.name || /^(profil|späť|domov|prihlásenie)$/i.test(text)) continue;
      const q = link.href.match(/[?&]s=(\d+)/);
      const key = q ? q[1] : null;
      const mapKey = key || 'default';
      if (competitionsSeen.has(mapKey)) continue;
      competitionsSeen.set(mapKey, {
        key,
        label: text,
        competition: text,
        clubName: '',
        url: key ? `${BASE_URL}/hrac/${playerId}?s=${key}` : `${BASE_URL}/hrac/${playerId}`,
      });
    }
    // Taby sa nachádzajú hneď na začiatku profilu – ďalej už začína zoznam zápasov.
    if (competitionsSeen.size > 0 && i > tabScanStart + 12) break;
  }
  result.competitions = [...competitionsSeen.values()];

  // Oficiálne súhrny (Úspešnosť - Dvojhry / Štvorhry)
  let section = null;
  for (let i = 0; i < lines.length; i += 1) {
    const text = lines[i].text;
    if (/^Úspešnosť\s*-\s*Dvojhry/i.test(text)) {
      section = 'singles';
      continue;
    }
    if (/^Úspešnosť\s*-\s*Štvorhry/i.test(text)) {
      section = 'doubles';
      continue;
    }
    if (!section) continue;
    const m = text.match(/^(Celkom|Doma|Vonku)\s+(\d+)\s+z\s+(\d+)$/i);
    if (!m) continue;
    const scope = m[1].toLowerCase();
    const won = parseInt(m[2], 10);
    const played = parseInt(m[3], 10);
    const target = result.stats[section];
    if (scope === 'celkom') {
      target.won = won;
      target.played = played;
    } else if (scope === 'doma') {
      target.home = { won, played };
    } else {
      target.away = { won, played };
    }
  }

  // Duely – najprv nájdeme všetky riadky s označením duelu („A-X", „Štvorhra"),
  // potom pre každý z nich určíme presné hranice bloku (strana hráča pred
  // označením, sety a strana súpera za označením). Hranice sa počítajú z oboch
  // strán, aby sa odkazy nasledujúceho duelu nepripísali predošlému.
  const labelIndexes = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (DUEL_LABEL_RE.test(lines[i].text)) labelIndexes.push(i);
  }

  const backScan = (labelIdx) => {
    // Vráti { links, setsWon, startIndex } pre stranu hráča pred označením
    const links = [];
    let setsWon = null;
    let startIndex = labelIdx;
    let j = labelIdx - 1;
    while (j >= 0 && labelIdx - j <= 8) {
      const prev = lines[j];
      if (prev.links.length > 0) {
        links.unshift(...prev.links);
        startIndex = j;
        j -= 1;
        continue;
      }
      if (/^\d{1,3}$/.test(prev.text)) {
        if (setsWon === null) setsWon = parseInt(prev.text, 10);
        startIndex = j;
        j -= 1;
        continue;
      }
      break;
    }
    return { links, setsWon, startIndex };
  };

  // Kontext (etapa, kolo, dátum, tímy) držíme priebežne počas jedného prechodu
  const context = { stage: null, round: null, roundDate: null, teams: null };
  const labelIndexSet = new Set(labelIndexes);
  const nextLabelIndex = new Map();
  for (let li = 0; li < labelIndexes.length; li += 1) {
    nextLabelIndex.set(labelIndexes[li], li + 1 < labelIndexes.length ? labelIndexes[li + 1] : lines.length);
  }

  for (let labelIdx = 0; labelIdx < lines.length; labelIdx += 1) {
    const currentText = lines[labelIdx].text;
    if (currentText) {
      if (STAGE_RE.test(currentText) && currentText.length < 60 && lines[labelIdx].links.length === 0) {
        context.stage = currentText;
      }
      const rm = currentText.match(ROUND_RE);
      if (rm) {
        context.round = `${rm[1]}. kolo`;
        context.roundDate = rm[2] || null;
      } else if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(currentText)) {
        context.roundDate = currentText;
      }
      const tm = currentText.match(TEAM_PAIR_RE);
      if (tm) {
        context.teams = {
          homeTeam: tm[1].trim(),
          awayTeam: tm[2].trim(),
          homeScore: parseInt(tm[3], 10),
          awayScore: parseInt(tm[4], 10),
        };
      }
    }

    if (!labelIndexSet.has(labelIdx)) continue;

    const li = labelIndexes.indexOf(labelIdx);
    const label = currentText;

    const firstSide = backScan(labelIdx);
    const nextLabelIdx = li + 1 < labelIndexes.length ? labelIndexes[li + 1] : lines.length;
    const nextFirstSideStart = li + 1 < labelIndexes.length ? backScan(nextLabelIdx).startIndex : lines.length;

    // Región za označením: od labelIdx+1 po nextFirstSideStart-1
    const officialSetsHome = [];
    const secondSideLinks = [];
    let secondSideCount = null;
    let walkover = false;
    let regionEnd = nextFirstSideStart;
    if (regionEnd <= labelIdx) regionEnd = nextLabelIdx;

    for (let k = labelIdx + 1; k < regionEnd; k += 1) {
      const next = lines[k];
      if (!next.text) continue;
      if (next.signed.length > 0) {
        officialSetsHome.push(...next.signed.map((a) => a.raw));
        continue;
      }
      if (next.links.length > 0) {
        secondSideLinks.push(...next.links);
        continue;
      }
      if (/\bwo\b|kontum|vzdal/i.test(next.text)) {
        walkover = true;
        continue;
      }
      if (/^\d{1,2}:\d{1,3}$/.test(next.text)) continue; // priebežné skóre stretnutia
      if (/^\d{1,3}$/.test(next.text)) {
        if (secondSideCount === null) secondSideCount = parseInt(next.text, 10);
        continue;
      }
    }

    // Na stránke hráča je vždy ako prvé uvedené domáce družstvo (Domáci = A)
    // a znamienka setov sú z pohľadu domácich. Ak hráč hral vonku, znamienka
    // obrátime, aby boli z pohľadu hráča.
    const playerInFirstSide = firstSide.links.some((l) => playerIdFromHref(l.href) === String(playerId));
    const playerInSecondSide = secondSideLinks.some((l) => playerIdFromHref(l.href) === String(playerId));
    if (!playerInFirstSide && !playerInSecondSide) continue;

    const playerIsFirstSide = playerInFirstSide;
    const playerCount = playerIsFirstSide ? firstSide.setsWon : secondSideCount;
    const opponentCount = playerIsFirstSide ? secondSideCount : firstSide.setsWon;

    const invert = !playerIsFirstSide;
    const officialSets = officialSetsHome.map((value) => {
      if (!invert) return value;
      if (value.startsWith('+')) return `-${value.slice(1)}`;
      if (value.startsWith('-')) return `+${value.slice(1)}`;
      return value;
    });

    const playerSideLinks = playerIsFirstSide ? firstSide.links : secondSideLinks;
    const opponentLinks = playerIsFirstSide ? secondSideLinks : firstSide.links;

    const partnerLinks = playerSideLinks.filter((l) => playerIdFromHref(l.href) !== String(playerId));
    const isDoubles = /^štvorhra$/i.test(label) || playerSideLinks.length + opponentLinks.length > 2;

    const setsSeenForPlayer = officialSets.filter((s) => s.startsWith('+')).length;
    const setsSeenAgainst = officialSets.filter((s) => s.startsWith('-')).length;

    const detailSets = officialSets.map((value, idx) => setValueToDetail(value, idx + 1)).filter(Boolean);

    result.duels.push({
      label,
      type: isDoubles ? 'doubles' : 'singles',
      stage: context.stage,
      round: context.round,
      date: context.roundDate,
      teams: context.teams,
      playerIsFirstSide,
      playerSetsWon: playerCount != null ? playerCount : setsSeenForPlayer,
      opponentSetsWon: opponentCount != null ? opponentCount : setsSeenAgainst,
      officialSets,
      officialSetsHome,
      setDetails: detailSets,
      walkover,
      partner: partnerLinks[0] ? { id: playerIdFromHref(partnerLinks[0].href), name: partnerLinks[0].text } : null,
      opponents: opponentLinks.map((l) => ({ id: playerIdFromHref(l.href), name: l.text })),
      sourceLine: label,
    });
  }

  return result;
}


/** Skontroluje duely voči oficiálnym súhrnom SSTZ. Nič sa nedopĺňa, len sa porovnáva. */
export function verifyPlayerSeason(duels, stats, context = {}) {
  const singles = duels.filter((d) => d.type === 'singles');
  const doubles = duels.filter((d) => d.type === 'doubles');

  const setCountMismatches = duels.filter((d) => {
    if (d.walkover) return false;
    const won = d.officialSets.filter((s) => s.startsWith('+')).length;
    const lost = d.officialSets.filter((s) => s.startsWith('-')).length;
    return won !== d.playerSetsWon || lost !== d.opponentSetsWon;
  });

  const singlesWon = singles.filter((d) => d.playerSetsWon > d.opponentSetsWon).length;
  const doublesWon = doubles.filter((d) => d.playerSetsWon > d.opponentSetsWon).length;

  const checks = [
    {
      name: 'Počty setov v každom dueli sedia s oficiálnym záznamom',
      ok: setCountMismatches.length === 0,
      detail:
        setCountMismatches.length === 0
          ? 'každý duel má rovnaký počet vyhraných/prehraných setov, ako uvádza web'
          : `nesúlad pri ${setCountMismatches.length} dueloch`,
    },
  ];

  if (stats?.singles?.played != null) {
    checks.push({
      name: 'Dvojhry – súčet voči oficiálnej úspešnosti',
      ok: singles.length === stats.singles.played && singlesWon === stats.singles.won,
      expected: `${stats.singles.won} z ${stats.singles.played}`,
      actual: `${singlesWon} z ${singles.length}`,
    });
  }
  if (stats?.doubles?.played != null) {
    checks.push({
      name: 'Štvorhry – súčet voči oficiálnej úspešnosti',
      ok: doubles.length === stats.doubles.played && doublesWon === stats.doubles.won,
      expected: `${stats.doubles.won} z ${stats.doubles.played}`,
      actual: `${doublesWon} z ${doubles.length}`,
    });
  }

  const verified = checks.every((c) => c.ok);
  return {
    verified,
    checks,
    aggregate: {
      singles: { played: singles.length, won: singlesWon },
      doubles: { played: doubles.length, won: doublesWon },
      // Sety sa počítajú oddelene – presne tak, ako ich zverejňuje portál
      // (oficiálna kolónka „Sety" pri úspešnosti jednotlivcov = len dvojhry).
      sets: {
        won: singles.reduce((acc, d) => acc + (d.playerSetsWon || 0), 0),
        lost: singles.reduce((acc, d) => acc + (d.opponentSetsWon || 0), 0),
      },
      setsAll: {
        won: duels.reduce((acc, d) => acc + (d.playerSetsWon || 0), 0),
        lost: duels.reduce((acc, d) => acc + (d.opponentSetsWon || 0), 0),
      },
    },
    context,
  };
}

// ---------------------------------------------------------------------------
// Verejné API scrapera
// ---------------------------------------------------------------------------

/**
 * Zoznam sezón presne tak, ako ich ponúka menu portálu (sezóna 2018/19 → 2026/27).
 * Portál adresuje sezónu SLUGOM v tvare `2025-26` (napr. /sezona/2025-26/svk,
 * /liga/sezona-2025-26-2-liga-muzi-kstz-bratislava/...). Žiadne vymyslené ID.
 */
export const SEASON_SLUGS = [
  '2018-19', '2019-20', '2020-21', '2021-22', '2022-23',
  '2023-24', '2024-25', '2025-26', '2026-27',
];

/** `2025-26` → `2025/26` (tvar, v akom sezónu vypisuje portál v texte). */
export function seasonSlugToLabel(slug) {
  const m = String(slug || '').match(/^(\d{4})-(\d{2})$/);
  return m ? `${m[1]}/${m[2]}` : null;
}

/** `2025/26` → `2025-26` (tvar, v akom sezónu adresuje portál v URL). */
export function seasonLabelToSlug(label) {
  const m = String(label || '').match(/^(\d{4})\/(\d{2})$/);
  return m ? `${m[1]}-${m[2]}` : null;
}

/** Scope portálu pre celé Slovensko (súčasť reálnej routy /sezona/<sezóna>/<scope>). */
export const SEASON_SCOPE = 'svk';

/**
 * Prepne sezónu v rámci session. Vráti true, ak sa podarilo (obsah sa zmenil na
 * požadovanú sezónu) – overuje sa podľa textu „Sezóna RRRR/RR" na stránke.
 */
/**
 * Prepne sezónu v rámci session na portáli.
 *
 * Portál má reálnu routu `/sezona/<sezóna>/<scope>` (overené: /sezona/2025-26/svk
 * vykreslí sezónu 2025/26, breadcrumb „Sezóna 2025/26"). Používame výhradne túto
 * adresu – žiadne vymyslené AJAX endpointy. Či sa sezóna naozaj prepnula, sa
 * NIKDY nepredpokladá: overuje sa podľa textu, ktorý vráti portál (seasonLabel).
 */
async function openSeason(seasonSlug, { cookie }) {
  if (!seasonSlug || !/^\d{4}-\d{2}$/.test(seasonSlug)) {
    return { ok: false, error: `Neplatný slug sezóny: ${seasonSlug}` };
  }
  try {
    const res = await fetchPage(`/sezona/${seasonSlug}/${SEASON_SCOPE}`, { cookie, retries: 1 });
    if (res.status && res.status >= 400) {
      return { ok: false, status: res.status, error: `Portál vrátil HTTP ${res.status}` };
    }
    return { ok: true, status: res.status || 200, url: `${BASE_URL}/sezona/${seasonSlug}/${SEASON_SCOPE}` };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function buildSeasonResult({ seasonId, requestedLabel, page, playerId, competition, cookie }) {
  // Klub hráča v tejto súťaži určíme z reálnych názvov družstiev v zápasoch
  // (nie z odhadu) – vyhráva ten názov, na ktorého strane hráč naozaj nastúpil.
  const clubCounts = new Map();
  for (const d of page.duels) {
    if (!d.teams) continue;
    const own = d.playerIsFirstSide ? d.teams.homeTeam : d.teams.awayTeam;
    if (!own) continue;
    clubCounts.set(own, (clubCounts.get(own) || 0) + 1);
  }
  const detectedClub = [...clubCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  const competitionLabel = competition?.label || competition?.competition || null;
  let competitionName = competition?.competition || null;
  // Portál lepí názov súťaže a klub do jedného textu („2. liga ŠKST Bratislava B").
  // Ak text končí presne názvom tímu, za ktorý hráč nastúpil, súťaž je zvyšok.
  if (detectedClub && competitionLabel && competitionLabel.endsWith(detectedClub)) {
    const stripped = competitionLabel.slice(0, -detectedClub.length).trim();
    if (stripped) competitionName = stripped;
  }

  const duels = page.duels.map((d) => {
    const playerWon =
      d.playerSetsWon != null && d.opponentSetsWon != null
        ? d.playerSetsWon > d.opponentSetsWon
        : null;
    const idParts = [
      seasonId != null ? `s${seasonId}` : page.seasonLabel || 'season',
      competition?.key || 'all',
      d.round || 'r',
      d.date || 'd',
      d.label,
      d.opponents.map((o) => o.id).join('+') || 'x',
    ];
    return {
      id: idParts.join('-').replace(/\s+/g, ''),
      sstzMatchId: null,
      season: page.seasonLabel || requestedLabel || null,
      seasonId: seasonId != null ? String(seasonId) : null,
      competition: competitionName,
      competitionLabel,
      clubName: detectedClub,
      stage: d.stage,
      round: d.round,
      date: d.date,
      homeTeam: d.teams?.homeTeam || null,
      awayTeam: d.teams?.awayTeam || null,
      teamScore:
        d.teams != null ? `${d.teams.homeScore}:${d.teams.awayScore}` : null,
      playerIsHome: d.teams ? d.playerIsFirstSide : null,
      type: d.type,
      duelLabel: d.label,
      opponentName: d.opponents[0]?.name || null,
      opponentId: d.opponents[0]?.id || null,
      opponents: d.opponents,
      partnerName: d.partner?.name || null,
      partnerId: d.partner?.id || null,
      result: playerWon == null ? null : playerWon ? 'WIN' : 'LOSS',
      score:
        d.playerSetsWon != null && d.opponentSetsWon != null
          ? `${d.playerSetsWon}:${d.opponentSetsWon}`
          : d.walkover
            ? 'wo'
            : '—',
      sets: d.officialSets,
      setDetails: d.setDetails,
      walkover: d.walkover,
      totalPointsWon: d.setDetails.reduce((acc, s) => acc + s.playerPoints, 0),
      totalPointsLost: d.setDetails.reduce((acc, s) => acc + s.opponentPoints, 0),
      source: 'SSTZ',
      profileUrl: `${BASE_URL}/hrac/${playerId}`,
    };
  });

  const verification = verifyPlayerSeason(page.duels, page.stats, {
    season: page.seasonLabel,
    competition: competition?.label || null,
  });

  return { duels, verification, stats: page.stats };
}

/**
 * Poskladá profil hráča z už načítaných stránok (bez prístupu na sieť).
 * Vďaka tomu sa dá celý pipeline otestovať nad reálnymi zachytenými stránkami.
 *
 * @param {{playerId: string, name: string|null, profileUrl: string, pages: Array<{seasonLabel: string|null, seasonId: string|null, competition: object|null, page: object}>, includeDoubles?: boolean, warnings?: string[]}} input
 */
export function composeProfile(input) {
  const {
    playerId,
    name,
    profileUrl = `${BASE_URL}/hrac/${playerId}`,
    pages = [],
    includeDoubles = true,
    warnings = [],
  } = input;

  const matches = [];
  const seasonOrder = [];
  const seasonReports = new Map();

  for (const entry of pages) {
    const { page, competition = null, seasonId = null } = entry;
    const seasonLabel = page.seasonLabel || entry.seasonLabel || null;
    const built = buildSeasonResult({
      seasonId,
      requestedLabel: seasonLabel,
      page,
      playerId,
      competition,
    });

    matches.push(...built.duels);

    // Poistka: ak sa label súťaže nezhoduje s tímom, za ktorý hráč naozaj nastúpil,
    // upozorníme – nič sa nemaskuje ani neprepisuje.
    const mismatch = built.duels.find(
      (d) => d.clubName && d.competitionLabel && !String(d.competitionLabel).includes(d.clubName)
    );
    if (mismatch) {
      warnings.push(
        `Súťaž „${mismatch.competitionLabel}" nesedí s tímom „${mismatch.clubName}" (sezóna ${seasonLabel || '?'}, kolo ${mismatch.round || '?'}) – skontroluj priradenie tímu na portáli.`
      );
    }

    const label = seasonLabel || '(neznáma sezóna)';
    if (!seasonReports.has(label)) {
      seasonOrder.push(label);
      seasonReports.set(label, {
        seasonId: seasonId != null ? String(seasonId) : null,
        label,
        competitions: [],
        matches: 0,
        verification: { verified: true, checks: [] },
      });
    }
    const report = seasonReports.get(label);
    report.competitions.push(competition?.label || competition?.key || 'celý profil');
    report.verification.checks.push(...built.verification.checks);
    report.verification.verified = report.verification.verified && built.verification.verified;
  }

  // Deduplikácia – ten istý duel sa môže objaviť vo viacerých taboch
  const unique = new Map();
  for (const match of matches) {
    if (!unique.has(match.id)) unique.set(match.id, match);
  }
  const dateKey = (duel) => {
    const m = String(duel.date || '').match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (!m) return 0;
    return Number(`${m[3]}${m[2].padStart(2, '0')}${m[1].padStart(2, '0')}`);
  };
  const allDuels = [...unique.values()].sort((a, b) => {
    const diff = dateKey(b) - dateKey(a); // najnovšie prvé
    if (diff !== 0) return diff;
    const roundA = parseInt(String(a.round || '').replace(/\D/g, ''), 10) || 0;
    const roundB = parseInt(String(b.round || '').replace(/\D/g, ''), 10) || 0;
    if (roundA !== roundB) return roundB - roundA;
    return String(a.label).localeCompare(String(b.label));
  });

  const singles = allDuels.filter((d) => d.type === 'singles');
  const doubles = includeDoubles ? allDuels.filter((d) => d.type === 'doubles') : [];
  const counted = (list) => list.filter((d) => d.result === 'WIN' || d.result === 'LOSS');
  const singlesWon = counted(singles).filter((d) => d.result === 'WIN').length;
  const doublesWon = counted(doubles).filter((d) => d.result === 'WIN').length;

  // Doma/Vonku podľa toho, na ktorej strane tímového stretnutia hráč naozaj
  // nastúpil (údaj pochádza z protokolu, nič sa neodhaduje).
  const homeAway = (list) => {
    const known = counted(list).filter((d) => d.playerIsHome === true || d.playerIsHome === false);
    const home = known.filter((d) => d.playerIsHome === true);
    const away = known.filter((d) => d.playerIsHome === false);
    return {
      home: { won: home.filter((d) => d.result === 'WIN').length, total: home.length },
      away: { won: away.filter((d) => d.result === 'WIN').length, total: away.length },
    };
  };

  const seasons = seasonOrder.map((label) => {
    const report = seasonReports.get(label);
    report.matches = allDuels.filter((d) => (d.season || '(neznáma sezóna)') === label).length;
    return report;
  });

  const allVerified = seasons.length > 0 && seasons.every((s) => s.verification.verified);

  return {
    id: String(playerId),
    name: name || null,
    profileUrl,
    source: {
      name: 'stolnytenis.info',
      publisher: 'SSTZ (Slovenský stolnotenisový zväz)',
      profileUrl,
      fetchedAt: new Date().toISOString(),
      live: true,
      note:
        'Všetky zápasy, skóre setov a úspešnosť pochádzajú výhradne z oficiálneho portálu stolnytenis.info.',
    },
    seasons,
    singlesStats: {
      played: counted(singles).length,
      won: singlesWon,
      lost: counted(singles).length - singlesWon,
      winRate: counted(singles).length ? Math.round((singlesWon / counted(singles).length) * 100) : 0,
      ...homeAway(singles),
      // oficiálne súčty presne tak, ako ich zverejňuje portál („Celkom N z M")
      official: pages.map((entry) => ({
        season: entry.page.seasonLabel || entry.seasonLabel || null,
        competition: entry.competition?.label || entry.competition?.competition || null,
        singles: entry.page.stats?.singles || null,
        doubles: entry.page.stats?.doubles || null,
      })),
    },
    doublesStats: {
      played: counted(doubles).length,
      won: doublesWon,
      lost: counted(doubles).length - doublesWon,
      winRate: counted(doubles).length ? Math.round((doublesWon / counted(doubles).length) * 100) : 0,
      ...homeAway(doubles),
    },
    matches: singles,
    doublesMatches: doubles,
    verification: {
      status: allVerified ? 'verified' : 'unverified',
      allSeasonsVerified: allVerified,
      seasons: seasons.map((s) => ({
        label: s.label,
        verified: s.verification.verified,
        matches: s.matches,
        checks: s.verification.checks,
      })),
    },
    warnings,
    syncedAt: new Date().toISOString(),
  };
}

/**
 * LEGACY: synchronizácia cez profil hráča a prepínanie sezóny v session portálu.
 *
 * Historicky prvý spôsob. Problém: profil `/hrac/<id>` zobrazuje len sezónu,
 * ktorú portál práve drží, a prepínanie cez `/sezona/<slug>/svk` závisí od
 * session portálu – preto to „fungovalo len pre niektorých hráčov“. Tento
 * kód ponechávame ako zálohu, primárny je `syncPlayerCareer` (ligový pipeline),
 * ktorý je deterministický pre každého hráča.
 */
export async function syncPlayerCareerViaProfilePages(playerId, options = {}) {
  const id = String(playerId).replace(/\D/g, '');
  if (!id) throw new SstzError('Neplatné ID hráča.', { kind: 'input' });

  const { allSeasons = false, seasonSlugs, includeDoubles = true, onProgress = () => {} } = options;

  const { cookie, csrf } = await ensureSession();
  const progress = (patch) => {
    try {
      onProgress(patch);
    } catch {
      /* ignore */
    }
  };

  const pages = [];
  const warnings = [];

  /** Načíta profil vrátane všetkých družstiev (tabov ?s=…) pre aktuálnu sezónu session. */
  const loadSeasonPages = async (seasonRef, labelHint) => {
    const base = await fetchPage(`/hrac/${id}`, { cookie });
    const defaultPage = parsePlayerPage(base.html, id);

    if (labelHint && defaultPage.seasonLabel && defaultPage.seasonLabel !== labelHint) {
      warnings.push(
        `Portál vrátil sezónu ${defaultPage.seasonLabel} namiesto ${labelHint} (${seasonRef}). Dáta sa ukladajú pod sezónu, ktorú uvádza portál – nič sa nepriraďuje nasilu.`
      );
    }

    const tabs = defaultPage.competitions.length > 0
      ? defaultPage.competitions
      : [{ key: null, label: 'celý profil', url: `${BASE_URL}/hrac/${id}` }];

    pages.push({ seasonLabel: defaultPage.seasonLabel, seasonId: seasonRef, competition: tabs[0], page: defaultPage });

    for (const tab of tabs.slice(1)) {
      if (!tab.key) continue;
      progress({
        phase: 'competition',
        season: defaultPage.seasonLabel,
        message: `Sťahujem družstvo ${tab.label || tab.key} (${defaultPage.seasonLabel || 'sezóna'})…`,
      });
      const res = await fetchPage(`/hrac/${id}?s=${tab.key}`, { cookie });
      const tabPage = parsePlayerPage(res.html, id);
      if (tabPage.seasonLabel && defaultPage.seasonLabel && tabPage.seasonLabel !== defaultPage.seasonLabel) {
        warnings.push(
          `Družstvo ${tab.label || tab.key} vrátilo inú sezónu (${tabPage.seasonLabel}) – preskakujem, aby sa dáta nemiešali.`
        );
        continue;
      }
      pages.push({ seasonLabel: tabPage.seasonLabel || defaultPage.seasonLabel, seasonId: seasonRef, competition: tab, page: tabPage });
    }

    return defaultPage;
  };

  progress({ phase: 'current-season', message: 'Načítavam profil hráča z stolnytenis.info…' });
  const firstPage = await loadSeasonPages(null, null);

  const seenSeasonLabels = new Set([firstPage.seasonLabel].filter(Boolean));

  if (allSeasons) {
    const offered = firstPage.availableSeasons.filter((s) => s.id);
    const currentSlug = seasonLabelToSlug(firstPage.seasonLabel);

    // Cieľové sezóny: buď ich zadá volajúci (slugy v tvare `2025-26`), alebo
    // použijeme presne tie, ktoré ponúka menu portálu.
    const requested = Array.isArray(seasonSlugs) && seasonSlugs.length > 0
      ? seasonSlugs.map((slug) => String(slug))
      : null;
    const targetSlugs = (requested && requested.length > 0
      ? requested
      : offered.length > 0
        ? offered.map((s) => s.slug || String(s.id))
        : SEASON_SLUGS
    )
      .filter((slug) => /^\d{4}-\d{2}$/.test(String(slug)))
      .filter((slug) => slug !== currentSlug);

    if (offered.length === 0) {
      warnings.push(
        'Z menu portálu sa nepodarilo prečítať zoznam sezón – skúšam oficiálne slugy 2018-19 … 2026-27. Každá sezóna sa musí potvrdiť textom priamo na stránke.'
      );
    }

    for (const slug of targetSlugs) {
      const expectedLabel = seasonSlugToLabel(slug) || slug;
      progress({
        phase: 'season',
        season: expectedLabel,
        message: `Otváram sezónu ${expectedLabel} na portáli…`,
      });

      const opened = await openSeason(slug, { cookie });
      if (!opened.ok) {
        warnings.push(
          `Sezónu ${expectedLabel} sa nepodarilo otvoriť (${opened.error || `HTTP ${opened.status}`}).`
        );
        continue;
      }

      const before = pages.length;
      const page = await loadSeasonPages(slug, expectedLabel);
      if (!page.seasonLabel) {
        pages.length = before;
        warnings.push(`Sezónu ${expectedLabel} sa nepodarilo jednoznačne identifikovať (chýba text sezóny).`);
        continue;
      }

      if (page.seasonLabel !== expectedLabel) {
        pages.length = before; // nič sa nepriradí nasilu
        warnings.push(
          `Portál po otvorení sezóny ${expectedLabel} stále zobrazuje sezónu ${page.seasonLabel} – zápasy sa NEpriradili k sezóne ${expectedLabel}. Portál pravdepodobne drží sezónu v session; otvor aplikáciu v prehliadači a skús sync znova.`
        );
        continue;
      }

      if (seenSeasonLabels.has(page.seasonLabel)) {
        pages.length = before;
        warnings.push(
          `Sezóna ${expectedLabel} vrátila rovnaké dáta ako už načítaná sezóna ${page.seasonLabel} – preskakujem, aby sa zápasy nezdvojili.`
        );
        continue;
      }
      seenSeasonLabels.add(page.seasonLabel);
    }
  }

  const profile = composeProfile({
    playerId: id,
    name: firstPage.name,
    profileUrl: `${BASE_URL}/hrac/${id}`,
    pages,
    includeDoubles,
    warnings,
  });

  progress({ phase: 'done', message: 'Hotovo.' });
  return profile;
}

/** Jednosezónny režim (rýchla kontrola aktuálneho stavu). */
export async function getPlayerProfile(playerId, options = {}) {
  if (options.allSeasons) return syncPlayerCareer(playerId, options);
  return syncPlayerCareer(playerId, { ...options, allSeasons: false });
}

export async function searchSSTZ(query) {
  const q = String(query || '').trim();
  if (q.length < 2) return { players: [], clubs: [], leagues: [], query: q };

  const { cookie, csrf } = await ensureSession();
  const body = new URLSearchParams({
    url: `${BASE_URL}/`,
    q,
    _request: '\\App\\Requests\\Frontend\\Search',
    _token: csrf || '',
  });

  let html = '';
  try {
    const res = await postForm(`${BASE_URL}/`, body, { cookie, csrf, referer: `${BASE_URL}/` });
    const text = res.text || '';
    // Odpoveď môže byť JSON {"result": "<html>…"} alebo rovno HTML fragment
    try {
      const parsed = JSON.parse(text);
      html = parsed.result || parsed.html || '';
    } catch {
      html = text;
    }
  } catch (err) {
    throw new SstzError(`Vyhľadávanie na stolnytenis.info zlyhalo: ${err.message}`, {
      kind: err.kind || 'search',
    });
  }

  const atoms = htmlToAtoms(html);
  const lines = atomsToLines(atoms);
  const players = [];
  const clubs = [];
  const leagues = [];

  for (const line of lines) {
    for (const link of line.links) {
      const href = link.href;
      const name = (link.text || '').replace(/-\s*(hráč|klub|liga|líga)$/i, '').trim();
      if (!href || !name) continue;

      const pid = playerIdFromHref(href);
      if (pid) {
        if (!players.some((p) => p.id === pid)) {
          players.push({ id: pid, name, url: `${BASE_URL}/hrac/${pid}`, type: 'player' });
        }
        continue;
      }
      const slug = leagueSlugFromHref(href);
      const clubId = clubIdFromHref(href);
      if (slug && clubId) {
        if (!clubs.some((c) => c.clubId === clubId && c.leagueSlug === slug && c.name === name)) {
          clubs.push({ clubId, leagueSlug: slug, name, url: href.startsWith('http') ? href : `${BASE_URL}${href}`, type: 'club' });
        }
        continue;
      }
      if (slug) {
        if (!leagues.some((l) => l.leagueSlug === slug)) {
          leagues.push({ leagueSlug: slug, name, url: `${BASE_URL}/liga/${slug}/tabulka`, type: 'league' });
        }
      }
    }
  }

  return { players, clubs, leagues, query: q };
}

// ---------------------------------------------------------------------------
// Ligy (reálne slugy z oficiálneho webu – žiadne vymyslené zoznamy)
// ---------------------------------------------------------------------------

function humanizeRegion(segment) {
  const map = {
    sstz: 'SSTZ',
    vsstz: 'VSSTZ',
    'kstz-bratislava': 'KSTZ Bratislava',
    'kstz-trnava': 'KSTZ Trnava',
    'kstz-nitra': 'KSTZ Nitra',
    'kstz-trencin': 'KSTZ Trenčín',
    'kstz-zilina': 'KSTZ Žilina',
    'kstz-banska-bystrica': 'KSTZ Banská Bystrica',
    'obstz-trnava': 'ObSTZ Trnava',
    'ostz-senica': 'OSTZ Senica',
    'ostz-galanta': 'OSTZ Galanta',
    'coop-liga-dunajska-streda': 'COOP liga Dunajská Streda',
    'ostz-nitra': 'OSTZ Nitra',
    'ostz-nove-zamky': 'OSTZ Nové Zámky',
    'ostz-komarno': 'OSTZ Komárno',
    'ostz-trencin': 'OSTZ Trenčín',
    'ostz-banska-bystrica': 'OSTZ Banská Bystrica',
    'ostz-ziar-nad-hronom': 'OSTZ Žiar nad Hronom',
    'ostz-martin': 'OSTZ Martin',
    'ostz-zilina': 'OSTZ Žilina',
    'ostz-presov': 'OSTZ Prešov',
  };
  if (map[segment]) return map[segment];
  return segment
    .split('-')
    .map((part) => (part.length <= 3 ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(' ');
}

/**
 * Vráti všetky ligy tak, ako sú na webe (slug + názov + región + sezóna).
 * Slugy sú reálne odkazy zo stránky, nie odhadnuté.
 */
export async function getAllSlovakLeagues() {
  const { cookie } = await ensureSession();
  const { html } = await fetchPage('/', { cookie });
  const lines = parseHtmlLines(html);

  const leagues = new Map();
  let lastCategory = null;

  for (const line of lines) {
    const plain = line.text.trim();
    if (
      plain &&
      line.links.length === 0 &&
      plain.length < 40 &&
      /^(SSTZ|KSTZ|ObSTZ|OSTZ|VSSTZ|COOP)/i.test(plain)
    ) {
      lastCategory = plain;
    }
    for (const link of line.links) {
      const slug = leagueSlugFromHref(link.href);
      if (!slug || !/^sezona-\d{4}-\d{2}-/.test(slug)) continue;
      if (leagues.has(slug)) continue;
      const seasonMatch = slug.match(/^sezona-(\d{4}-\d{2})-/);
      const rest = slug.replace(/^sezona-\d{4}-\d{2}-/, '');
      const regionSegment = rest.split('-').slice(-1)[0];
      const category = lastCategory || humanizeRegion(regionSegment);
      const tabIndex = String(link.href).indexOf('/tabulka');
      leagues.set(slug, {
        name: link.text.replace(/\s+/g, ' ').trim() || rest,
        slug,
        season: seasonMatch ? seasonMatch[1].replace('-', '/') : null,
        region: category,
        url: `/liga/${slug}/tabulka${tabIndex >= 0 ? '' : ''}`,
      });
    }
  }

  const grouped = new Map();
  for (const league of leagues.values()) {
    const key = league.region || 'Iné';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(league);
  }

  const result = [...grouped.entries()]
    .map(([category, list]) => ({
      category,
      leagues: list.sort((a, b) => a.name.localeCompare(b.name, 'sk')),
    }))
    .sort((a, b) => a.category.localeCompare(b.category, 'sk'));

  return result;
}

/** Spätná kompatibilita – už nevraciame vymyslené ligy, ale prázdny zoznam (naplní ho web). */
export function getPopularLeagues() {
  return [];
}

// ---------------------------------------------------------------------------
// Tabuľka + rozpis súťaže
// ---------------------------------------------------------------------------

export async function getLeagueData(leagueSlug) {
  if (!leagueSlug) return null;
  const { cookie } = await ensureSession();

  const { html } = await fetchPage(`/liga/${leagueSlug}/tabulka`, { cookie });
  const lines = parseHtmlLines(html);

  let title = null;
  const titleLine = lines.find((l) => /-\s*[0-9]+\.\s*liga|Extraliga|liga,/i.test(l.text) && l.text.length < 80);
  if (titleLine) title = titleLine.text;

  const clubs = [];
  const standings = [];
  const seen = new Set();

  for (const line of lines) {
    for (const link of line.links) {
      const clubId = clubIdFromHref(link.href);
      const slug = leagueSlugFromHref(link.href);
      if (!clubId || slug !== leagueSlug) continue;
      if (seen.has(clubId)) continue;
      seen.add(clubId);
      clubs.push({ clubId, clubName: link.text.trim() });
    }
  }

  // Rozpis (všetky zápasy súťaže, vrátane odkazov na oficiálne zápisy)
  const matches = await getTeamSchedule(leagueSlug, null);

  return {
    slug: leagueSlug,
    title: title || leagueSlug,
    url: `${BASE_URL}/liga/${leagueSlug}/tabulka`,
    clubs,
    standings,
    matches: matches?.matches || [],
    syncedAt: new Date().toISOString(),
    source: { name: 'stolnytenis.info', url: `${BASE_URL}/liga/${leagueSlug}/tabulka` },
  };
}

/**
 * Rozpis súťaže alebo konkrétneho družstva.
 * Zápasy sa čítajú z odkazov na oficiálne zápisy (`/zapas/<id>`) – tie sú vždy reálne.
 */
export async function getTeamSchedule(leagueSlug, clubId) {
  if (!leagueSlug) return null;
  const { cookie } = await ensureSession();
  const path = clubId
    ? `/liga/${leagueSlug}/rozpis-muzstva?club_id=${clubId}`
    : `/liga/${leagueSlug}/rozpis`;

  const { html } = await fetchPage(path, { cookie });
  const lines = parseHtmlLines(html);

  const matches = new Map();
  let currentRound = null;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const roundMatch = line.text.match(/^(\d+)\.\s*kolo$/i);
    if (roundMatch) {
      currentRound = `${roundMatch[1]}. kolo`;
      continue;
    }

    const matchLink = line.links.find((l) => matchIdFromHref(l.href));
    if (!matchLink) continue;
    const id = matchIdFromHref(matchLink.href);
    if (!id || matches.has(id)) continue;

    // V okolí odkazu hľadáme dátum, družstvá a skóre (text v tom istom alebo susedných riadkoch)
    const window = [lines[i - 2], lines[i - 1], line, lines[i + 1]].filter(Boolean);
    const windowText = window.map((w) => w.text).join(' ');
    const dateMatch = windowText.match(/(\d{1,2}\.\d{1,2}\.\d{4})(?:\s+(\d{1,2}:\d{2}))?/);
    const homeLink = window
      .flatMap((w) => w.links)
      .find((l) => clubIdFromHref(l.href) && l.text.trim().length > 1);
    const teamLinks = window.flatMap((w) => w.links).filter((l) => clubIdFromHref(l.href));

    const scoreText = windowText.match(/(\d{1,2})\s*:\s*(\d{1,2})/);

    matches.set(id, {
      id,
      round: currentRound || '',
      dateTime: dateMatch ? `${dateMatch[1]}${dateMatch[2] ? ` ${dateMatch[2]}` : ''}` : '',
      homeTeam: teamLinks[0]?.text.trim() || '',
      awayTeam: teamLinks[1]?.text.trim() || '',
      homeScore: scoreText ? scoreText[1] : '',
      awayScore: scoreText ? scoreText[2] : '',
      isPlayed: Boolean(scoreText) && !/wo/i.test(windowText) ? true : Boolean(scoreText),
      walkover: /wo/i.test(windowText),
      protocolUrl: `${BASE_URL}/zapas/${id}`,
      leagueSlug,
      _homeLink: homeLink?.href,
    });
  }

  const list = [...matches.values()].map(({ _homeLink, ...rest }) => rest);

  return {
    leagueSlug,
    clubId: clubId || '',
    url: `${BASE_URL}${path}`,
    matches: list,
    syncedAt: new Date().toISOString(),
    source: { name: 'stolnytenis.info', url: `${BASE_URL}${path}` },
  };
}

/**
 * Detail oficiálneho zápisu (protokol) – používa sa na krížové overenie duelov hráča.
 */
export async function getMatchProtocol(matchId) {
  const id = String(matchId).replace(/\D/g, '');
  if (!id) return null;
  const { cookie } = await ensureSession();
  const { html, url } = await fetchPage(`/zapas/${id}`, { cookie });
  const lines = parseHtmlLines(html);

  const header = { matchId: id, url };
  const page = parsePlayerPage(html, '__none__');

  for (const line of lines) {
    const m = line.text.match(/^Zápas č\.:\s*(\d+)/i);
    if (m) header.matchNumber = m[1];
    const k = line.text.match(/^Kolo:\s*(.+)$/i);
    if (k) header.round = `${k[1].trim()}. kolo`;
    const d = line.text.match(/^Dátum:\s*(\d{1,2}\.\d{1,2}\.\d{4}\s*\d{1,2}:\d{2})/i);
    if (d) header.dateTime = d[1];
    const l = line.text.match(/^Liga:\s*(.+)$/i);
    if (l) header.league = l[1].trim();
    const c = line.text.match(/^Kategória:\s*(.+)$/i);
    if (c) header.category = c[1].trim();
    const z = line.text.match(/^Zväz:\s*(.+)$/i);
    if (z) header.association = z[1].trim();
  }

  return { ...header, duels: page.duels, duelsRaw: page.duels.length ? undefined : null };
}

// ===========================================================================
// NOVÝ PIPELINE: celá kariéra pre KAŽDÉHO hráča (bez prepínania sezóny v session)
// ---------------------------------------------------------------------------
// Profil `/hrac/<id>` zobrazuje len aktuálnu sezónu portálu, preto starý
// prístup zlyhával pri hráčoch bez aktuálnych zápasov a pri historických
// sezónach. Tento pipeline používa výhradne DETERMINISTICKÉ routy portálu:
//
//   /sezona/<sezóna>/<región>                 → zoznam všetkých líg sezóny
//   /liga/<slug>/uspesnost(+stvo)rhry         → kto hral danú ligu (oficiálne údaje)
//   /liga/<slug>/tabulka                      → club_id družstiev
//   /liga/<slug>/rozpis-muzstva?club_id=<id>  → zápasy družstva (odkazy /zapas/<id>)
//   /zapas/<id>                               → oficiálny protokol so všetkými duelmi
//
// Z toho sa poskladá kompletná kariéra: všetky sezóny, všetky ligy, ktoré
// hráč v sezóne hral (aj keď hral viac líg naraz), všetky dvojhry aj štvorhry.
// ===========================================================================

/** Regióny portálu – /sezona/<sezóna>/<scope> (overené na portáli). */
export const REGION_SCOPES = ['svk', 'ba', 'tt', 'tn', 'nr', 'bb', 'za', 'po', 'ke'];

/** Jednoduchý pool s obmedzeným počtom paralelných požiadaviek. */
async function pMap(items, fn, concurrency = 3) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, async () => {
    for (;;) {
      const i = next;
      next += 1;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

// ---------------------------------------------------------------------------
// 1) Zoznam všetkých líg sezóny (národné + krajské/okresné zväzy)
// ---------------------------------------------------------------------------

/**
 * Z riadkov stránky (návrhové menu portálu) vytiahne ligy sezóny.
 * Kategória (zväz) sa odvodí z nadpisu pred skupinou odkazov.
 */
export function parseLeagueNavLines(lines, seasonSlug = null) {
  const leagues = new Map();
  let lastCategory = null;
  const seasonRe = seasonSlug
    ? new RegExp(`^sezona-${seasonSlug}-`)
    : /^sezona-\d{4}-\d{2}-/;

  for (const line of lines) {
    const plain = line.text.trim().replace(/^[-*\s\d.)#]+/, '').trim();
    if (
      plain &&
      line.links.length === 0 &&
      plain.length < 50 &&
      /^(SSTZ|VSSTZ|KSTZ|ObSTZ|OSTZ|COOP|Západoslovenský|Stredoslovenský|Východoslovenský|Slovenská republika)/i.test(plain)
    ) {
      lastCategory = plain;
    }
    for (const link of line.links) {
      const slug = leagueSlugFromHref(link.href);
      if (!slug || !seasonRe.test(slug)) continue;
      if (leagues.has(slug)) continue;
      const rest = slug.replace(/^sezona-\d{4}-\d{2}-/, '');
      const regionSegment = rest.split('-').slice(-1)[0];
      const seasonMatch = slug.match(/^sezona-(\d{4}-\d{2})-/);
      leagues.set(slug, {
        slug,
        name: (link.text || '').replace(/\s+/g, ' ').trim() || rest,
        season: seasonMatch ? seasonMatch[1].replace('-', '/') : null,
        region: lastCategory || humanizeRegion(regionSegment),
      });
    }
  }
  return [...leagues.values()];
}

/**
 * Všetky ligy sezóny naprieč všetkými regiónmi (9 stránok – dá sa cacheovať,
 * minulá sezóna sa už nemení).
 */
export async function getSeasonUniverse(seasonSlug, { fetchImpl = fetchPage, cookie = '', useCache = true, onProgress } = {}) {
  if (!/^\d{4}-\d{2}$/.test(seasonSlug || '')) {
    throw new SstzError(`Neplatná sezóna: ${seasonSlug}`, { kind: 'input' });
  }
  if (useCache) {
    const cached = readCache(`universe/${seasonSlug}`);
    if (cached?.leagues?.length) return cached;
  }

  const merged = new Map();
  await pMap(REGION_SCOPES, async (scope) => {
    try {
      const res = await fetchImpl(`/sezona/${seasonSlug}/${scope}`, { cookie });
      for (const league of parseLeagueNavLines(parseHtmlLines(res.html), seasonSlug)) {
        if (!merged.has(league.slug)) merged.set(league.slug, league);
      }
    } catch (err) {
      /* región bez ligového menu – preskočíme, nič sa nevymýšľa */
    }
  }, 4);

  const result = {
    season: seasonSlug,
    leagues: [...merged.values()].sort((a, b) => a.slug.localeCompare(b.slug)),
    fetchedAt: new Date().toISOString(),
  };
  if (useCache && result.leagues.length > 0) writeCache(`universe/${seasonSlug}`, result);
  if (onProgress) onProgress({ phase: 'universe', season: seasonSlug, leagues: result.leagues.length });
  return result;
}

// ---------------------------------------------------------------------------
// 2) Kto hral danú ligu – oficiálne indexy úspešnosti (jednotlivci + štvorhry)
// ---------------------------------------------------------------------------

const STAT_LABELS = ['Stret', 'Zápasy', 'Zapasy', 'Výhry', 'Vyhry', 'Prehry', 'Sety', 'Úspešn', 'Uspešn', 'Mužstvo', 'Muzstvo', 'Hráč', 'Hrac'];

function normalizeStatToken(token) {
  return String(token || '').replace(/\s+/g, ' ').trim();
}

/**
 * Rozdelí text odkazu „Meno Priezvisko NázovTímu" na meno a tím.
 * Ak sú známe tímy (z tabuľky), použije sa presný suffix; inak heuristika
 * (meno = prvé dva tokeny).
 */
export function splitPlayerTeamText(text, knownTeams = []) {
  const clean = normalizeStatToken(text);
  if (!clean) return { name: null, team: null };
  for (const team of [...knownTeams].sort((a, b) => b.length - a.length)) {
    if (team && clean.endsWith(team) && clean.length > team.length) {
      return { name: clean.slice(0, clean.length - team.length).trim(), team };
    }
    if (team && clean === team) return { name: null, team };
  }
  const tokens = clean.split(' ');
  if (tokens.length <= 2) return { name: clean, team: null };
  return { name: tokens.slice(0, 2).join(' '), team: tokens.slice(2).join(' ') };
}

/**
 * Parsovanie stránky úspešnosti (jednotlivcov alebo štvorhier) na zoznam hráčov.
 * Výstup: [{ playerId, name, team, rawLinkText, meetings, played, won, lost,
 *            sets: {won,lost}|null, pct }]
 * Pri jednotlivcoch je meno+tím v texte odkazu – tím sa dořešuje až proti
 * tabuľke (pozri `resolveIndexTeam`), preto sa tu ponecháva `rawLinkText`.
 */
export function parseUspesnostLines(lines, { kind = 'singles' } = {}) {
  const entries = [];
  let current = null;
  let pendingLabel = null;
  let collectingTeam = false;
  let teamTokens = [];

  const flushTeam = () => {
    if (current && teamTokens.length > 0) {
      const team = teamTokens.join(' ').replace(/\s+/g, ' ').trim();
      if (team) current.team = team;
    }
    teamTokens = [];
    collectingTeam = false;
  };

  const atoms = lines.flatMap((l) => l.atoms || []);

  for (const atom of atoms) {
    if (atom.type === 'link') {
      const pid = playerIdFromHref(atom.href);
      if (pid) {
        flushTeam();
        current = {
          playerId: pid,
          name: null,
          team: null,
          meetings: null,
          played: null,
          won: null,
          lost: null,
          sets: null,
          pct: null,
          rawLinkText: normalizeStatToken(atom.text),
        };
        entries.push(current);
        pendingLabel = null;
      }
      continue;
    }
    if (!current) continue;

    const token = normalizeStatToken(atom.type === 'text' ? atom.text : atom.raw);
    if (!token) continue;

    // skupinovanie hráčov ("Od 100% do 40%...") a poradie – preskakujeme
    if (/^Od$/.test(token) || /^do$/.test(token)) { pendingLabel = null; collectingTeam && flushTeam(); continue; }
    if (/^\d{1,3}\.$/.test(token)) { pendingLabel = null; continue; }

    if (collectingTeam) {
      if (/^(Stret|Zápasy|Zapasy|Výhry|Vyhry|Prehry|Sety|Úspešn|Uspešn)\.?/i.test(token)) {
        flushTeam();
      } else {
        teamTokens.push(token);
        continue;
      }
    }

    let m;
    if (/^Stret\.?$/i.test(token)) { pendingLabel = 'meetings'; continue; }
    if ((m = token.match(/^Stret\.?\s*(\d+)$/i))) { current.meetings = parseInt(m[1], 10); pendingLabel = null; continue; }
    if (/^(Zápasy|Zapasy)\.?$/i.test(token)) { pendingLabel = 'played'; continue; }
    if ((m = token.match(/^(?:Zápasy|Zapasy)\s*(\d+)$/i))) { current.played = parseInt(m[1], 10); pendingLabel = null; continue; }
    if (/^(Výhry|Vyhry)\.?$/i.test(token)) { pendingLabel = 'won'; continue; }
    if ((m = token.match(/^(?:Výhry|Vyhry)\s*(\d+)$/i))) { current.won = parseInt(m[1], 10); pendingLabel = null; continue; }
    if (/^Prehry\.?$/i.test(token)) { pendingLabel = 'lost'; continue; }
    if ((m = token.match(/^Prehry\s*(\d+)$/i))) { current.lost = parseInt(m[1], 10); pendingLabel = null; continue; }
    if (/^Sety\.?$/i.test(token)) { pendingLabel = 'sets'; continue; }
    if ((m = token.match(/^Sety\s*(\d+)\s*:\s*(\d+)$/i))) { current.sets = { won: parseInt(m[1], 10), lost: parseInt(m[2], 10) }; pendingLabel = null; continue; }
    if ((m = token.match(/^(\d+)\s*:\s*(\d+)$/) ) && pendingLabel === 'sets') { current.sets = { won: parseInt(m[1], 10), lost: parseInt(m[2], 10) }; pendingLabel = null; continue; }
    if (/^(Úspešn|Uspešn)\.?$/i.test(token)) { pendingLabel = 'pct'; continue; }
    if ((m = token.match(/^(?:Úspešn|Uspešn)\.?\s*([\d.,]+)\s*%?$/i))) { current.pct = m[1]; pendingLabel = null; continue; }
    if ((m = token.match(/^([\d.,]+)\s*%$/) ) && pendingLabel === 'pct') { current.pct = m[1]; pendingLabel = null; continue; }

    if ((m = token.match(/^Mužstvo\.?\s*(.*)$/i))) {
      // „MužstvoŠKST Bratislava B" aj „Mužstvo" + ďalšie tokeny
      flushTeam();
      if (m[1].trim()) teamTokens.push(m[1].trim());
      collectingTeam = true;
      continue;
    }
    if (/^Hráč\.?$/i.test(token)) { continue; }

    if (pendingLabel && /^\d+$/.test(token)) {
      const value = parseInt(token, 10);
      if (pendingLabel === 'meetings') current.meetings = value;
      else if (pendingLabel === 'played') current.played = value;
      else if (pendingLabel === 'won') current.won = value;
      else if (pendingLabel === 'lost') current.lost = value;
      pendingLabel = null;
      continue;
    }

    if (pendingLabel === 'sets' && (m = token.match(/^(\d+)\s*:\s*(\d+)$/))) {
      current.sets = { won: parseInt(m[1], 10), lost: parseInt(m[2], 10) };
      pendingLabel = null;
      continue;
    }
    if (pendingLabel === 'pct' && (m = token.match(/^([\d.,]+)\s*%?$/))) {
      current.pct = m[1];
      pendingLabel = null;
      continue;
    }
  }
  flushTeam();

  // Mená: na stránke jednotlivcov je meno+tím v texte odkazu (tím sa dořešuje
  // až proti tabuľke); pri štvorhrách je v odkaze len meno a tím je v „Mužstvo".
  for (const entry of entries) {
    if (kind !== 'singles') {
      if (!entry.name && entry.rawLinkText) entry.name = entry.rawLinkText;
    }
  }
  return entries;
}

/**
 * Určí meno a tím hráča z textu odkazu v úspešnosti (napr. „Lesňák Dominik
 * ŠKST Bratislava B") – prioritne podľa presných názvov družstiev z tabuľky.
 */
export function resolveIndexTeam(entry, knownTeams = []) {
  if (!entry) return { name: null, team: null };
  if (entry.team) {
    const fuzzy = knownTeams.find(
      (t) => t === entry.team || t.replace(/\s+/g, '') === String(entry.team).replace(/\s+/g, '')
    );
    return { name: entry.name || (entry.rawLinkText || null), team: fuzzy || entry.team };
  }
  const split = splitPlayerTeamText(entry.rawLinkText || '', knownTeams);
  return { name: entry.name || split.name, team: split.team };
}

/**
 * Indexy hráčov ligy (jednotlivci + štvorhry) s cache. Minulé sezóny sú
 * nemenné → cache bez expirácie; aktuálna sezóna má TTL.
 */
export async function getLeaguePlayerIndexes(leagueSlug, { fetchImpl = fetchPage, cookie = '', useCache = true, ttlMs = null } = {}) {
  if (useCache) {
    const cached = readCache(`index/${leagueSlug}`, { maxAgeMs: ttlMs });
    if (cached && (Array.isArray(cached.singles) || Array.isArray(cached.doubles))) return cached;
  }

  const load = async (subpage, kind) => {
    try {
      const res = await fetchImpl(`/liga/${leagueSlug}/${subpage}`, { cookie });
      return parseUspesnostLines(parseHtmlLines(res.html), { kind });
    } catch {
      return [];
    }
  };

  const [singles, doubles] = await Promise.all([
    load('uspesnost', 'singles'),
    load('uspesnost-stvorhry', 'doubles'),
  ]);

  const result = { leagueSlug, singles, doubles, fetchedAt: new Date().toISOString() };
  if (useCache && (singles.length > 0 || doubles.length > 0)) writeCache(`index/${leagueSlug}`, result);
  return result;
}

// ---------------------------------------------------------------------------
// 3) Družstvá ligy (club_id) + rozpis družstva
// ---------------------------------------------------------------------------

export function parseLeagueClubsLines(lines, leagueSlug) {
  const clubs = [];
  const seen = new Set();
  for (const line of lines) {
    for (const link of line.links) {
      const clubId = clubIdFromHref(link.href);
      const slug = leagueSlugFromHref(link.href);
      if (!clubId || slug !== leagueSlug) continue;
      if (seen.has(clubId)) continue;
      const name = (link.text || '').replace(/\s+/g, ' ').trim();
      if (!name) continue;
      seen.add(clubId);
      clubs.push({ clubId, clubName: name });
    }
  }
  return clubs;
}

export async function getLeagueClubs(leagueSlug, { fetchImpl = fetchPage, cookie = '', useCache = true, ttlMs = null } = {}) {
  if (useCache) {
    const cached = readCache(`clubs/${leagueSlug}`, { maxAgeMs: ttlMs });
    if (cached?.clubs?.length) return cached;
  }
  const res = await fetchImpl(`/liga/${leagueSlug}/tabulka`, { cookie });
  const clubs = parseLeagueClubsLines(parseHtmlLines(res.html), leagueSlug);
  const result = { leagueSlug, clubs, fetchedAt: new Date().toISOString() };
  if (useCache && clubs.length > 0) writeCache(`clubs/${leagueSlug}`, result);
  return result;
}

/**
 * Rozpis družstva – zápasy tímu v lige. Stránka renderuje každý zápas dvakrát
 * (desktop/mobil), preto sa deduplikuje podľa ID zápasu. Tímy a skóre môžu byť
 * na viacerých riadkoch – zbierajú sa z okna okolo odkazu na zápas.
 */
export function parseTeamScheduleLines(lines) {
  const matches = new Map();
  let currentRound = null;
  const dateRe = /(\d{1,2}\.\d{1,2}\.\d{4})/;

  const roundLine = (text) => /^(\d{1,3})\.\s*kolo$/i.test(String(text || '').trim());

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const roundMatch = line.text.match(/^(\d{1,3})\.\s*kolo$/i);
    if (roundMatch) {
      currentRound = `${roundMatch[1]}. kolo`;
      continue;
    }

    const zapasLinks = line.links.filter((l) => matchIdFromHref(l.href));
    if (zapasLinks.length === 0) continue;
    const id = matchIdFromHref(zapasLinks[0].href);
    if (!id || matches.has(id)) continue;

    // Okno: dozadu (dátum) aj dopredu (tímy/skóre na ďalších riadkoch), až po
    // ďalšie kolo alebo blok iného zápasu.
    const windowLines = [line];
    for (let k = i + 1; k < lines.length && k <= i + 12; k += 1) {
      const t = (lines[k].text || '').trim();
      if (roundLine(t)) break;
      const otherId = lines[k].links.map((l) => matchIdFromHref(l.href)).find(Boolean);
      if (otherId && otherId !== id) break;
      windowLines.push(lines[k]);
    }
    const backWindow = [lines[i - 3], lines[i - 2], lines[i - 1]].filter(Boolean);

    const allLinks = windowLines.flatMap((l) => l.links);
    const teamLinks = [];
    for (const l of allLinks) {
      if (!clubIdFromHref(l.href) || matchIdFromHref(l.href)) continue;
      const clubId = clubIdFromHref(l.href);
      if (!teamLinks.some((t) => t.clubId === clubId)) {
        teamLinks.push({ clubId, name: (l.text || '').replace(/\s+/g, ' ').trim() });
      }
    }
    const scoreLinks = allLinks.filter(
      (l) => matchIdFromHref(l.href) === id && /^\d{1,3}$/.test((l.text || '').trim())
    );

    const windowText = [...backWindow, ...windowLines].map((w) => w.text).join(' ');
    const dateMatch = windowText.match(dateRe);

    let homeScore = scoreLinks[0] ? scoreLinks[0].text.trim() : '';
    let awayScore = scoreLinks[1] ? scoreLinks[1].text.trim() : '';
    if (!homeScore || !awayScore) {
      const scoreText = windowText.match(/(\d{1,3})\s*:\s*(\d{1,3})/);
      if (scoreText) {
        homeScore = homeScore || scoreText[1];
        awayScore = awayScore || scoreText[2];
      }
    }

    matches.set(id, {
      id,
      round: currentRound || '',
      dateTime: dateMatch ? dateMatch[1] : '',
      homeTeam: teamLinks[0] ? teamLinks[0].name : '',
      awayTeam: teamLinks[1] ? teamLinks[1].name : '',
      homeScore,
      awayScore,
      isPlayed: homeScore !== '' && awayScore !== '',
      walkover: false,
      protocolUrl: `${BASE_URL}/zapas/${id}`,
    });
  }

  return [...matches.values()];
}

export async function getTeamScheduleCached(leagueSlug, clubId, { fetchImpl = fetchPage, cookie = '', useCache = true, ttlMs = null } = {}) {
  const key = `schedule/${leagueSlug}/${clubId || 'all'}`;
  if (useCache) {
    const cached = readCache(key, { maxAgeMs: ttlMs });
    if (cached?.matches) return cached;
  }
  const path = clubId
    ? `/liga/${leagueSlug}/rozpis-muzstva?club_id=${clubId}`
    : `/liga/${leagueSlug}/rozpis`;
  const res = await fetchImpl(path, { cookie });
  const list = parseTeamScheduleLines(parseHtmlLines(res.html));
  const result = { leagueSlug, clubId: clubId || '', matches: list, fetchedAt: new Date().toISOString() };
  if (useCache && list.length > 0) writeCache(key, result);
  return result;
}

// ---------------------------------------------------------------------------
// 4) Protokol zápasu (/zapas/<id>) – všetky duely stretnutia
// ---------------------------------------------------------------------------

/**
 * Parsovanie oficiálneho protokolu zápasu.
 * Vráti { header, duels: [{ order, label, duelCode, type, homePlayers, awayPlayers,
 * officialSetsHome, homeSetsWon, awaySetsWon, walkover }] }.
 */
export function parseMatchProtocolLines(lines, matchId = null) {
  const header = { matchId: matchId ? String(matchId) : null };
  const duels = [];

  const DUEL_ROW_RE = /^(\d{1,3})\.\s*(štvorhra|dvojhra)\s*([A-Z]-[U-Z])?\s*$/i;
  const PLAYER_PREFIX_RE = /^\d{1,2}\/\d{1,2}\s*/;

  for (let i = 0; i < lines.length; i += 1) {
    const text = (lines[i].text || '').trim();
    let m;
    if ((m = text.match(/^Sezóna\s*:\s*(\d{4}\/\d{2})$/i))) { header.season = m[1]; continue; }
    if ((m = text.match(/^Zápas č\.?\s*:\s*(\d+)$/i))) { header.matchNumber = m[1]; continue; }
    if ((m = text.match(/^Kolo\s*:\s*(.+)$/i))) { header.round = `${m[1].trim().replace(/\.+$/, '')}. kolo`; continue; }
    if ((m = text.match(/^Dátum\s*:\s*(\d{1,2}\.\d{1,2}\.\d{4})(?:\s+(\d{1,2}:\d{2}))?/i))) {
      header.date = m[1];
      header.time = m[2] || null;
      continue;
    }
    if ((m = text.match(/^Liga\s*:\s*(.+)$/i))) { header.league = m[1].trim(); continue; }
    if ((m = text.match(/^Kategória\s*:\s*(.+)$/i))) { header.category = m[1].trim(); continue; }
    if ((m = text.match(/^Zväz\s*:\s*(.+)$/i))) { header.association = m[1].trim(); continue; }
    if ((m = text.match(/^Domáci\s*:\s*(.+)$/i)) && !header.homeTeam && m[1].trim().length > 2) {
      header.homeTeam = m[1].trim();
      continue;
    }
    if ((m = text.match(/^Hostia\s*:\s*(.+)$/i)) && !header.awayTeam && m[1].trim().length > 2) {
      header.awayTeam = m[1].trim();
      continue;
    }
  }

  // Duely – číslované riadky tabuľky protokolu; sekcia „Priebeh stretnutia" sa
  // preskakuje, aby sa duely nezdvojili.
  let stop = false;
  for (let i = 0; i < lines.length && !stop; i += 1) {
    const text = (lines[i].text || '').trim();
    if (/^Priebeh stretnutia$/i.test(text)) break;
    const dm = text.match(DUEL_ROW_RE);
    if (!dm) continue;

    const duel = {
      order: parseInt(dm[1], 10),
      label: dm[2].toLowerCase() === 'štvorhra' ? 'Štvorhra' : dm[3] ? dm[3].toUpperCase() : 'Dvojhra',
      duelCode: dm[3] ? dm[3].toUpperCase() : null,
      type: dm[2].toLowerCase() === 'štvorhra' ? 'doubles' : 'singles',
      homePlayers: [],
      awayPlayers: [],
      officialSetsHome: [],
      homeSetsWon: null,
      awaySetsWon: null,
      walkover: false,
    };
    const perSide = duel.type === 'doubles' ? 2 : 1;

    // región za riadkom duelu: hráči, sety, výsledok – po ďalší duel/koniec
    for (let k = i + 1; k < lines.length; k += 1) {
      const nextText = (lines[k].text || '').trim();
      if (/^Priebeh stretnutia$/i.test(nextText)) { stop = true; break; }
      if (DUEL_ROW_RE.test(nextText)) break;
      if (/^(Hlavný rozhodca|Posledná editácia|Predchádzajúci zápas|Nasledujúci zápas)/i.test(nextText)) { stop = true; break; }

      const playerLinks = lines[k].links
        .map((l) => ({ id: playerIdFromHref(l.href), name: (l.text || '').replace(PLAYER_PREFIX_RE, '').replace(/\s+/g, ' ').trim() }))
        .filter((p) => p.id);
      if (playerLinks.length > 0) {
        const side = duel.homePlayers.length < perSide ? duel.homePlayers : duel.awayPlayers;
        for (const p of playerLinks) {
          if (side === duel.homePlayers && duel.homePlayers.length < perSide) duel.homePlayers.push(p);
          else duel.awayPlayers.push(p);
        }
        continue;
      }

      if (lines[k].signed && lines[k].signed.length > 0) {
        duel.officialSetsHome.push(...lines[k].signed.map((a) => a.raw));
        continue;
      }

      if (/^wo\b|kontum|vzdal/i.test(nextText)) { duel.walkover = true; continue; }

      const rm = nextText.match(/^(\d{1,2})\s*:\s*(\d{1,2})$/);
      if (rm) {
        duel.homeSetsWon = parseInt(rm[1], 10);
        duel.awaySetsWon = parseInt(rm[2], 10);
        continue;
      }
    }

    // výsledok sa dá odvodiť aj zo setov, ak portál „X : Y" neuviedol
    if (duel.homeSetsWon == null && duel.officialSetsHome.length > 0) {
      duel.homeSetsWon = duel.officialSetsHome.filter((s) => s.startsWith('+')).length;
      duel.awaySetsWon = duel.officialSetsHome.filter((s) => s.startsWith('-')).length;
    }

    duels.push(duel);
  }

  return { header, duels };
}

/**
 * Z protokolu vytiahne duely konkrétneho hráča (z pohľadu hráča – sety sa
 * v prípade potreby preklopia, lebo portál ich uvádza z pohľadu domácich).
 */
export function protocolDuelsForPlayer(protocol, playerId) {
  const id = String(playerId);
  const out = [];
  for (const duel of protocol.duels || []) {
    const inHome = duel.homePlayers.some((p) => p.id === id);
    const inAway = duel.awayPlayers.some((p) => p.id === id);
    if (!inHome && !inAway) continue;

    const playerIsHome = inHome;
    const ownSide = playerIsHome ? duel.homePlayers : duel.awayPlayers;
    const otherSide = playerIsHome ? duel.awayPlayers : duel.homePlayers;
    const invert = !playerIsHome;

    const officialSets = duel.officialSetsHome.map((value) => {
      if (!invert) return value;
      if (value.startsWith('+')) return `-${value.slice(1)}`;
      if (value.startsWith('-')) return `+${value.slice(1)}`;
      return value;
    });

    const playerSetsWon = playerIsHome ? duel.homeSetsWon : duel.awaySetsWon;
    const opponentSetsWon = playerIsHome ? duel.awaySetsWon : duel.homeSetsWon;
    const partner = ownSide.find((p) => p.id !== id) || null;

    out.push({
      order: duel.order,
      label: duel.label,
      duelCode: duel.duelCode,
      type: duel.type,
      playerIsHome,
      playerSetsWon: playerSetsWon != null ? playerSetsWon : officialSets.filter((s) => s.startsWith('+')).length,
      opponentSetsWon: opponentSetsWon != null ? opponentSetsWon : officialSets.filter((s) => s.startsWith('-')).length,
      officialSets,
      officialSetsHome: duel.officialSetsHome,
      setDetails: officialSets.map((value, idx) => setValueToDetail(value, idx + 1)).filter(Boolean),
      walkover: duel.walkover,
      partner,
      opponents: otherSide,
    });
  }
  return out;
}

export async function getMatchProtocolCached(matchId, { fetchImpl = fetchPage, cookie = '', useCache = true, ttlMs = null } = {}) {
  const id = String(matchId).replace(/\D/g, '');
  if (!id) return null;
  const key = `protocol/${id}`;
  if (useCache) {
    const cached = readCache(key, { maxAgeMs: ttlMs });
    if (cached?.duels) return cached;
  }
  const res = await fetchImpl(`/zapas/${id}`, { cookie });
  const parsed = parseMatchProtocolLines(parseHtmlLines(res.html), id);
  const result = { ...parsed, url: `${BASE_URL}/zapas/${id}`, fetchedAt: new Date().toISOString() };
  if (useCache) writeCache(key, result);
  return result;
}

// ---------------------------------------------------------------------------
// 5) Hlavná funkcia – kompletná kariéra hráča cez ligový pipeline
// ---------------------------------------------------------------------------

function seasonCacheTtl(seasonSlug) {
  // minulé sezóny sú nemenné (null = bez expirácie), aktuálna má TTL 15 min
  return seasonSlug === currentSeasonSlug() ? 15 * 60 * 1000 : null;
}

function normalizeSeasonInput(value) {
  const v = String(value || '').trim();
  if (/^\d{4}\/\d{2}$/.test(v)) return v.replace('/', '-');
  return /^\d{4}-\d{2}$/.test(v) ? v : null;
}

/**
 * Kompletná synchronizácia hráča – funguje pre ĽUBOVOĽNÉHO hráča SSTZ:
 *  – všetky sezóny (alebo len vybrané / aktuálna),
 *  – všetky ligy, ktoré hráč v sezóne hral (aj viac líg naraz),
 *  – všetky dvojhry aj štvorhry z oficiálnych protokolov zápasov.
 *
 * Žiadne prepínanie sezóny v session – len deterministické routy portálu.
 */
export async function syncPlayerCareer(playerId, options = {}) {
  const id = String(playerId).replace(/\D/g, '');
  if (!id) throw new SstzError('Neplatné ID hráča.', { kind: 'input' });

  const {
    allSeasons = false,
    seasonSlugs,
    includeDoubles = true,
    useCache = true,
    fetchImpl = fetchPage,
    onProgress = () => {},
  } = options;

  const liveFetch = fetchImpl === fetchPage;
  let cookie = '';
  if (liveFetch) {
    try {
      ({ cookie } = await ensureSession());
    } catch {
      cookie = '';
    }
  }

  const progress = (patch) => {
    try { onProgress(patch); } catch { /* ignore */ }
  };
  const warnings = [];

  // Cieľové sezóny: explicitný zoznam > všetky > aktuálna
  let targets;
  if (Array.isArray(seasonSlugs) && seasonSlugs.length > 0) {
    targets = seasonSlugs.map(normalizeSeasonInput).filter(Boolean);
  } else if (allSeasons) {
    targets = [...SEASON_SLUGS];
  } else {
    targets = [currentSeasonSlug()];
  }
  targets = [...new Set(targets)];

  const getPage = (path) => fetchImpl(path, { cookie });

  const allMatches = [];
  const seasonReports = [];
  let playerName = null;
  const playerTeams = new Map(); // season -> Set(team names)

  for (const seasonSlug of targets) {
    const seasonLabel = seasonSlugToLabel(seasonSlug) || seasonSlug;
    const ttl = seasonCacheTtl(seasonSlug);
    progress({ phase: 'season', season: seasonLabel, message: `Otváram sezónu ${seasonLabel} (zoznam súťaží)…` });

    let universe;
    try {
      universe = await getSeasonUniverse(seasonSlug, { fetchImpl, cookie, useCache });
    } catch (err) {
      warnings.push(`Sezónu ${seasonLabel} sa nepodarilo načítať (${err.message}).`);
      continue;
    }
    if (!universe.leagues.length) {
      warnings.push(`Sezóna ${seasonLabel}: portál neuvádza žiadne súťaže.`);
      continue;
    }

    // Kde všade hráč v sezóne hral? – oficiálne indexy úspešnosti každej ligy
    const hits = [];
    let scanned = 0;
    await pMap(universe.leagues, async (league) => {
      const idx = await getLeaguePlayerIndexes(league.slug, { fetchImpl, cookie, useCache, ttlMs: ttl });
      scanned += 1;
      if (scanned % 10 === 0 || scanned === universe.leagues.length) {
        progress({
          phase: 'scan',
          season: seasonLabel,
          message: `Sezóna ${seasonLabel}: skúšam ${scanned}/${universe.leagues.length} súťaží…`,
        });
      }
      const singlesRow = idx.singles.find((r) => r.playerId === id) || null;
      const doublesRow = idx.doubles.find((r) => r.playerId === id) || null;
      if (singlesRow || doublesRow) {
        hits.push({ league, idx, singlesRow, doublesRow });
        if (!playerName) playerName = doublesRow?.name || null;
      }
    }, 4);

    if (hits.length === 0) continue;

    const seasonCompetitions = [];
    const seasonChecks = [];
    let seasonVerified = true;

    for (const hit of hits) {
      const { league, singlesRow, doublesRow } = hit;
      progress({
        phase: 'competition',
        season: seasonLabel,
        message: `${seasonLabel}: sťahujem zápasy – ${league.name} (${league.region})…`,
      });

      // družstvo hráča + club_id pre rozpis (tím sa určí presne podľa tabuľky)
      let team = null;
      let clubId = null;
      try {
        const { clubs } = await getLeagueClubs(league.slug, { fetchImpl, cookie, useCache, ttlMs: ttl });
        const names = clubs.map((c) => c.clubName);
        const resolvedSingles = singlesRow ? resolveIndexTeam(singlesRow, names) : null;
        const resolvedDoubles = doublesRow ? resolveIndexTeam(doublesRow, names) : null;
        team = resolvedSingles?.team || resolvedDoubles?.team || null;
        if (!playerName) playerName = resolvedSingles?.name || resolvedDoubles?.name || null;
        const club = clubs.find((c) => c.clubName === team);
        clubId = club ? club.clubId : null;
      } catch {
        clubId = null;
      }

      if (!team || !clubId) {
        warnings.push(
          `${seasonLabel} / ${league.name}: hráč figuruje v úspešnosti, ale družstvo sa nepodarilo jednoznačne určiť z tabuľky – zápasy tejto súťaže sa nenačítali.`
        );
        seasonVerified = false;
        continue;
      }

      if (!playerTeams.has(seasonLabel)) playerTeams.set(seasonLabel, new Set());
      playerTeams.get(seasonLabel).add(team);

      const schedule = await getTeamScheduleCached(league.slug, clubId, { fetchImpl, cookie, useCache, ttlMs: ttl });
      const played = schedule.matches.filter((m) => m.isPlayed);

      let leagueMatches = [];
      await pMap(played, async (entry) => {
        const protocol = await getMatchProtocolCached(entry.id, { fetchImpl, cookie, useCache, ttlMs: ttl });
        if (!protocol) return;
        const duels = protocolDuelsForPlayer(protocol, id);
        if (duels.length === 0) return;

        const header = protocol.header || {};
        const date = header.date || entry.dateTime.split(' ')[0] || '';
        const round = header.round || entry.round || null;
        const homeTeam = header.homeTeam || entry.homeTeam || null;
        const awayTeam = header.awayTeam || entry.awayTeam || null;
        const teamScore =
          entry.homeScore !== '' && entry.awayScore !== '' ? `${entry.homeScore}:${entry.awayScore}` : null;
        const playerIsHome = header.homeTeam && team
          ? header.homeTeam === team
          : homeTeam && team
            ? homeTeam === team
            : null;

        for (const d of duels) {
          const playerWon =
            d.playerSetsWon != null && d.opponentSetsWon != null && !d.walkover
              ? d.playerSetsWon > d.opponentSetsWon
              : null;
          const match = {
            id: `z${entry.id}-${d.order}-${d.duelCode || d.type}`,
            sstzMatchId: entry.id,
            season: header.season || seasonLabel,
            seasonId: seasonSlug,
            competition: league.name,
            competitionLabel: `${league.region} / ${league.name}`,
            clubName: team,
            stage: null,
            round,
            date,
            homeTeam,
            awayTeam,
            teamScore,
            playerIsHome: playerIsHome != null ? playerIsHome : d.playerIsHome,
            type: d.type,
            duelLabel: d.duelCode || d.label,
            playerSetsWon: d.playerSetsWon,
            opponentSetsWon: d.opponentSetsWon,
            opponentName: d.opponents[0]?.name || null,
            opponentId: d.opponents[0]?.id || null,
            opponents: d.opponents,
            partnerName: d.partner?.name || null,
            partnerId: d.partner?.id || null,
            result: playerWon == null ? null : playerWon ? 'WIN' : 'LOSS',
            score:
              d.playerSetsWon != null && d.opponentSetsWon != null
                ? `${d.playerSetsWon}:${d.opponentSetsWon}`
                : d.walkover
                  ? 'wo'
                  : '—',
            sets: d.officialSets,
            setDetails: d.setDetails,
            walkover: d.walkover,
            totalPointsWon: d.setDetails.reduce((acc, s) => acc + s.playerPoints, 0),
            totalPointsLost: d.setDetails.reduce((acc, s) => acc + s.opponentPoints, 0),
            source: 'SSTZ',
            profileUrl: `${BASE_URL}/hrac/${id}`,
          };
          leagueMatches.push(match);
        }
      }, 3);

      allMatches.push(...leagueMatches);
      seasonCompetitions.push(`${league.name} (${team})`);

      // Overenie voči oficiálnym súhrnom ligy (úspešnosť jednotlivcov/štvorhier)
      const singles = leagueMatches.filter((m) => m.type === 'singles');
      const doubles = leagueMatches.filter((m) => m.type === 'doubles');
      const singlesWon = singles.filter((m) => m.result === 'WIN').length;
      const doublesWon = doubles.filter((m) => m.result === 'WIN').length;

      seasonChecks.push({
        name: 'Počty setov v každom dueli sedia s oficiálnym záznamom',
        ok: leagueMatches.every((m) => {
          if (m.walkover || m.sets.length === 0) return true;
          const won = m.sets.filter((s) => s.startsWith('+')).length;
          const lost = m.sets.filter((s) => s.startsWith('-')).length;
          return won === m.playerSetsWon && lost === m.opponentSetsWon;
        }),
        detail: 'každý duel má rovnaký počet vyhraných/prehraných setov, ako uvádza web',
      });

      if (singlesRow && singlesRow.played != null) {
        const ok = singles.length === singlesRow.played && singlesWon === singlesRow.won;
        seasonChecks.push({
          name: `Dvojhry – súčet voči oficiálnej úspešnosti (${league.name})`,
          ok,
          expected: `${singlesRow.won} z ${singlesRow.played}`,
          actual: `${singlesWon} z ${singles.length}`,
        });
        if (singlesRow.sets) {
          const setsWon = singles.reduce((acc, m) => acc + (m.playerSetsWon || 0), 0);
          const setsLost = singles.reduce((acc, m) => acc + (m.opponentSetsWon || 0), 0);
          seasonChecks.push({
            name: `Sety dvojhier – voči oficiálnemu súhrnu (${league.name})`,
            ok: setsWon === singlesRow.sets.won && setsLost === singlesRow.sets.lost,
            expected: `${singlesRow.sets.won}:${singlesRow.sets.lost}`,
            actual: `${setsWon}:${setsLost}`,
          });
        }
      } else if (singles.length > 0) {
        seasonVerified = false;
      }

      if (includeDoubles && doublesRow && doublesRow.played != null) {
        const ok = doubles.length === doublesRow.played && doublesWon === doublesRow.won;
        seasonChecks.push({
          name: `Štvorhry – súčet voči oficiálnej úspešnosti (${league.name})`,
          ok,
          expected: `${doublesRow.won} z ${doublesRow.played}`,
          actual: `${doublesWon} z ${doubles.length}`,
        });
      }

      const leagueOk = seasonChecks.every((c) => c.ok);
      seasonVerified = seasonVerified && leagueOk;
      if (!leagueOk) {
        warnings.push(
          `${seasonLabel} / ${league.name}: načítané zápasy sa nezhodujú s oficiálnou úspešnosťou portálu – skontroluj protokol.`
        );
      }
    }

    seasonReports.push({
      seasonId: seasonSlug,
      label: seasonLabel,
      competitions: seasonCompetitions,
      matches: 0, // doplní sa po deduplikácii
      verification: { verified: seasonVerified, checks: seasonChecks },
    });
  }

  // Meno hráča – ak ho indexy neobsahujú (napr. hráč bez zápasov), skúsime profil
  if (!playerName && liveFetch) {
    try {
      const res = await getPage(`/hrac/${id}`);
      playerName = parsePlayerPage(res.html, id).name || null;
    } catch {
      /* meno nie je kritické */
    }
  }

  // Deduplikácia (ten istý duel cez viac sezón líg nemôže nastať, istota však istí)
  const unique = new Map();
  for (const match of allMatches) {
    if (!unique.has(match.id)) unique.set(match.id, match);
  }
  const dateKey = (duel) => {
    const m = String(duel.date || '').match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    return m ? Number(`${m[3]}${m[2].padStart(2, '0')}${m[1].padStart(2, '0')}`) : 0;
  };
  const sorted = [...unique.values()].sort((a, b) => {
    const diff = dateKey(b) - dateKey(a);
    if (diff !== 0) return diff;
    const roundA = parseInt(String(a.round || '').replace(/\D/g, ''), 10) || 0;
    const roundB = parseInt(String(b.round || '').replace(/\D/g, ''), 10) || 0;
    if (roundA !== roundB) return roundB - roundA;
    return String(a.duelLabel || '').localeCompare(String(b.duelLabel || ''));
  });

  const singles = sorted.filter((m) => m.type === 'singles');
  const doubles = includeDoubles ? sorted.filter((m) => m.type === 'doubles') : [];
  const counted = (list) => list.filter((m) => m.result === 'WIN' || m.result === 'LOSS');
  const singlesWon = counted(singles).filter((m) => m.result === 'WIN').length;
  const doublesWon = counted(doubles).filter((m) => m.result === 'WIN').length;

  const homeAway = (list) => {
    const known = counted(list).filter((m) => m.playerIsHome === true || m.playerIsHome === false);
    const home = known.filter((m) => m.playerIsHome === true);
    const away = known.filter((m) => m.playerIsHome === false);
    return {
      home: { won: home.filter((m) => m.result === 'WIN').length, total: home.length },
      away: { won: away.filter((m) => m.result === 'WIN').length, total: away.length },
    };
  };

  for (const report of seasonReports) {
    report.matches = sorted.filter((m) => m.season === report.label).length;
  }

  const allVerified = seasonReports.length > 0 && seasonReports.every((s) => s.verification.verified);
  if (seasonReports.length === 0) {
    warnings.push(
      `Pre hráča #${id} sa nenašli žiadne zápasy v sezónach ${targets.map((s) => seasonSlugToLabel(s)).join(', ')}. Buď v nich nehral, alebo portál nezverejnil protokoly.`
    );
  }

  const mostRecentTeam = (() => {
    for (const m of sorted) if (m.clubName) return m.clubName;
    return null;
  })();

  return {
    id,
    name: playerName || `Hráč #${id}`,
    clubName: mostRecentTeam || undefined,
    profileUrl: `${BASE_URL}/hrac/${id}`,
    source: {
      name: 'stolnytenis.info',
      publisher: 'SSTZ (Slovenský stolnotenisový zväz)',
      profileUrl: `${BASE_URL}/hrac/${id}`,
      fetchedAt: new Date().toISOString(),
      live: liveFetch,
      mode: 'live',
      note:
        'Všetky zápasy pochádzajú z oficiálnych protokolov zápasov stolnytenis.info; úspešnosť je overená voči oficiálnym ligovým súhrnom.',
    },
    seasons: seasonReports,
    singlesStats: {
      played: counted(singles).length,
      won: singlesWon,
      lost: counted(singles).length - singlesWon,
      winRate: counted(singles).length ? Math.round((singlesWon / counted(singles).length) * 100) : 0,
      ...homeAway(singles),
    },
    doublesStats: {
      played: counted(doubles).length,
      won: doublesWon,
      lost: counted(doubles).length - doublesWon,
      winRate: counted(doubles).length ? Math.round((doublesWon / counted(doubles).length) * 100) : 0,
      ...homeAway(doubles),
    },
    matches: singles,
    doublesMatches: doubles,
    verification: {
      status: allVerified ? 'verified' : 'unverified',
      allSeasonsVerified: allVerified,
      seasons: seasonReports.map((s) => ({
        label: s.label,
        verified: s.verification.verified,
        matches: s.matches,
        checks: s.verification.checks,
      })),
    },
    warnings,
    syncedAt: new Date().toISOString(),
  };
}


