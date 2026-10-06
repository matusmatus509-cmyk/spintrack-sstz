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
 * Kompletná synchronizácia hráča z portálu (sieťová časť).
 * @param {string|number} playerId
 * @param {{allSeasons?: boolean, seasonSlugs?: string[], includeDoubles?: boolean, onProgress?: (p:any)=>void}} options
 */
export async function syncPlayerCareer(playerId, options = {}) {
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

// ---------------------------------------------------------------------------
// Vyhľadávanie hráčov / klubov / líg (POST na portál, ako to robí samotná stránka)
// ---------------------------------------------------------------------------

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
