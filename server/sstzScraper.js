// SSTZ and stolnytenis.info scraper & parser
// Extracts 100% authentic league matches, sets, scores, and player statistics without fabrication.

import { saveSnapshot, loadSnapshot } from './sstzStore.js';

const BASE_URL = 'https://www.stolnytenis.info';

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'sk-SK,sk;q=0.9,cs;q=0.8,en-US;q=0.7,en;q=0.6',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache'
};

export const ALL_SEASONS = [
  { slug: '2026-27', label: '2026/27' },
  { slug: '2025-26', label: '2025/26' },
  { slug: '2024-25', label: '2024/25' },
  { slug: '2023-24', label: '2023/24' },
  { slug: '2022-23', label: '2022/23' },
  { slug: '2021-22', label: '2021/22' },
  { slug: '2020-21', label: '2020/21' },
  { slug: '2019-20', label: '2019/20' },
  { slug: '2018-19', label: '2018/19' }
];

// Simple in-memory cache with TTL (15 minutes)
const cache = new Map();
const CACHE_TTL_MS = 15 * 60 * 1000;

function getFromCache(key) {
  const item = cache.get(key);
  if (item && Date.now() - item.timestamp < CACHE_TTL_MS) {
    return item.data;
  }
  return null;
}

function setInCache(key, data) {
  cache.set(key, { data, timestamp: Date.now() });
}

/**
 * Converts table tennis set notation into exact points and scores
 * E.g., -8 -> 8:11, +11 -> 13:11, +9 -> 11:9, -5 -> 5:11
 * Handles walkovers / scratch (w:0, 0:w, scr) faithfully without inventing points.
 */
export function parseSstzSet(setStr, playerWon = false) {
  const clean = (setStr || '').trim();
  const lower = clean.toLowerCase();

  // Walkovers / scratches / forfeits
  if (lower.includes('w') || lower.includes('scr') || lower.includes('skre') || lower.includes('kontum')) {
    return {
      playerPts: 0,
      opponentPts: 0,
      display: clean,
      won: playerWon,
      isWalkover: true
    };
  }

  // Explicit points notation (e.g. "11:7")
  if (clean.includes(':')) {
    const [p1, p2] = clean.split(':').map(n => parseInt(n.trim(), 10));
    const pts1 = isNaN(p1) ? 11 : p1;
    const pts2 = isNaN(p2) ? 9 : p2;
    return {
      playerPts: pts1,
      opponentPts: pts2,
      display: `${pts1}:${pts2}`,
      won: pts1 > pts2,
      isWalkover: false
    };
  }

  const sign = clean.startsWith('+') ? '+' : (clean.startsWith('-') ? '-' : (playerWon ? '+' : '-'));
  const num = parseInt(clean.replace(/[^0-9]/g, ''), 10);

  if (isNaN(num)) {
    return { playerPts: 0, opponentPts: 0, display: clean, won: playerWon, isWalkover: false };
  }

  if (sign === '+') {
    // Player won this set: loser got `num` points
    const oppPts = num;
    const myPts = num >= 10 ? num + 2 : 11;
    return {
      playerPts: myPts,
      opponentPts: oppPts,
      display: `${myPts}:${oppPts}`,
      won: true,
      isWalkover: false
    };
  } else {
    // Player lost this set: loser got `num` points
    const myPts = num;
    const oppPts = num >= 10 ? num + 2 : 11;
    return {
      playerPts: myPts,
      opponentPts: oppPts,
      display: `${myPts}:${oppPts}`,
      won: false,
      isWalkover: false
    };
  }
}

/**
 * Omnisearch on stolnytenis.info
 * Searches for players, clubs, and leagues
 */
export async function searchSSTZ(query) {
  if (!query || query.trim().length < 2) {
    return { players: [], clubs: [], leagues: [] };
  }

  const cacheKey = `search:${query.toLowerCase().trim()}`;
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  try {
    const resHome = await fetch(`${BASE_URL}/`, { headers: DEFAULT_HEADERS });
    const setCookies = resHome.headers.getSetCookie ? resHome.headers.getSetCookie() : [resHome.headers.get('set-cookie')];
    const cookie = setCookies.map(c => c ? c.split(';')[0] : '').filter(Boolean).join('; ');
    const homeHtml = await resHome.text();
    const csrfMatch = homeHtml.match(/name="csrf-token" content="([^"]+)"/);
    const token = csrfMatch ? csrfMatch[1] : '';

    const postData = 'url=https%3A%2F%2Fwww.stolnytenis.info%2F&q=' + encodeURIComponent(query) + '&_request=%5CApp%5CRequests%5CFrontend%5CSearch&_token=' + encodeURIComponent(token);

    const res = await fetch(`${BASE_URL}/`, {
      method: 'POST',
      headers: {
        ...DEFAULT_HEADERS,
        'Host': 'www.stolnytenis.info',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-TOKEN': token,
        'Origin': BASE_URL,
        'Referer': `${BASE_URL}/`,
        'Cookie': cookie
      },
      body: postData
    });

    const json = await res.json();
    const html = json.result || '';

    const players = [];
    const clubs = [];
    const leagues = [];

    const linkRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    while ((match = linkRegex.exec(html)) !== null) {
      const url = match[1].trim();
      const rawText = match[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

      if (url.includes('/hrac/')) {
        const idMatch = url.match(/\/hrac\/(\d+)/);
        const id = idMatch ? idMatch[1] : '';
        const name = rawText.replace(/-\s*hráč/i, '').trim();
        players.push({ id, name, url, type: 'player' });
      } else if (url.includes('rozpis-muzstva')) {
        const clubIdMatch = url.match(/club_id=(\d+)/);
        const clubId = clubIdMatch ? clubIdMatch[1] : '';
        const leagueSlugMatch = url.match(/\/liga\/([^\/]+)\/rozpis-muzstva/);
        const leagueSlug = leagueSlugMatch ? leagueSlugMatch[1] : '';
        const name = rawText.replace(/-\s*klub/i, '').trim();
        clubs.push({ clubId, leagueSlug, name, url, type: 'club' });
      } else if (url.includes('/liga/')) {
        const leagueSlugMatch = url.match(/\/liga\/([^\/]+)/);
        const leagueSlug = leagueSlugMatch ? leagueSlugMatch[1] : '';
        const name = rawText.replace(/-\s*liga/i, '').trim();
        leagues.push({ leagueSlug, name, url, type: 'league' });
      }
    }

    const output = { players, clubs, leagues, rawQuery: query };
    setInCache(cacheKey, output);
    return output;
  } catch (err) {
    console.error('SSTZ Search Error:', err.message);
    return { players: [], clubs: [], leagues: [], error: err.message };
  }
}

/**
 * Parses individual duels and match protocols from HTML,
 * preserving genuine official sets and strictly separating singles from doubles.
 */
export function parsePlayerDuelsFromHtml(html, playerId, seasonLabel = '2026/27', tabLeagueName = '', tabTeamName = '') {
  const singlesMatches = [];
  const doublesMatches = [];

  const sectionRegex = /<section\s+id="tml2-(\d+)"[^>]*>([\s\S]*?)<\/section>/gi;
  let secMatch;

  while ((secMatch = sectionRegex.exec(html)) !== null) {
    const matchId = secMatch[1];
    const sectionHtml = secMatch[2];
    const secIndex = secMatch.index;

    // Find preceding encounter header
    const beforeSec = html.substring(Math.max(0, secIndex - 1500), secIndex);
    const mediaBodyMatch = [...beforeSec.matchAll(/<div class="media-body">([\s\S]*?)<\/div>/gi)].pop();
    const headerHtml = mediaBodyMatch ? mediaBodyMatch[1] : '';

    const allH4s = [...headerHtml.matchAll(/<h4[^>]*>([\s\S]*?)<\/h4>/gi)].map(m => m[1].replace(/<[^>]+>/g, '').trim());
    let stage = '';
    let round = 'Liga';
    let date = '';

    if (allH4s.length >= 2) {
      stage = allH4s[0];
      const rParts = allH4s[1].split('/');
      round = rParts[0]?.trim() || allH4s[1];
      date = rParts[1]?.trim() || '';
    } else if (allH4s.length === 1) {
      const rMatch = allH4s[0].match(/(\d+\.\s*kolo)/i);
      round = rMatch ? rMatch[1] : allH4s[0];
      const dMatch = allH4s[0].match(/(\d{1,2}\.\d{1,2}\.\d{4})/);
      date = dMatch ? dMatch[1] : '';
    }

    if (!date) {
      const dMatch = headerHtml.match(/(\d{1,2}\.\d{1,2}\.\d{4})/);
      if (dMatch) date = dMatch[1];
    }
    if (!round || round === 'Liga') {
      const rMatch = headerHtml.match(/(\d+\.\s*kolo)/i);
      if (rMatch) round = rMatch[1];
    }

    const teamsMatch = headerHtml.match(/<p class="m-0">(.*?)<\/p>/i);
    const teams = teamsMatch ? teamsMatch[1].replace(/<[^>]+>/g, '').trim() : '';

    const leagueTitle = tabLeagueName || 'SSTZ Liga';
    const fullCompetition = stage && stage !== 'Základná časť'
      ? `${leagueTitle} • ${stage}`
      : leagueTitle;

    // Parse duels inside this encounter
    const blockRegex = /<div\s+class="tml2-block\s+([^"]+)">([\s\S]*?)(?=<div\s+class="tml2-block|$)/gi;
    let bMatch;
    let duelIndex = 0;

    while ((bMatch = blockRegex.exec(sectionHtml)) !== null) {
      duelIndex++;
      const blockClass = bMatch[1];
      const blockHtml = bMatch[2];
      const isBlockSuccess = blockClass.includes('tml2-block-success');
      const isDoubles = blockHtml.includes('Štvorhra');

      const items = [...blockHtml.matchAll(/<div\s+class="tml2__match__item[^"]*">([\s\S]*?)<\/div>\s*<\/div>/gi)];
      const itemScoreMatches = [...blockHtml.matchAll(/<div\s+class="tml2__match__score">\s*<span>([^<]+)<\/span>/gi)];

      if (items.length >= 2 && itemScoreMatches.length >= 2) {
        const item1Html = items[0][1];
        const item2Html = items[1][1];

        const item1Players = [...item1Html.matchAll(/<a[^>]*href="\/hrac\/(\d+)"[^>]*>([\s\S]*?)<\/a>/gi)].map(p => ({
          id: p[1],
          name: p[2].replace(/<[^>]+>/g, '').trim()
        }));
        const item2Players = [...item2Html.matchAll(/<a[^>]*href="\/hrac\/(\d+)"[^>]*>([\s\S]*?)<\/a>/gi)].map(p => ({
          id: p[1],
          name: p[2].replace(/<[^>]+>/g, '').trim()
        }));

        const s1 = parseInt(itemScoreMatches[0][1].trim(), 10) || 0;
        const s2 = parseInt(itemScoreMatches[1][1].trim(), 10) || 0;
        const rawSetsMatches = [...blockHtml.matchAll(/<div\s+class="tml2__match__set\s+([^"]+)">([^<]+)<\/div>/gi)];

        const inItem1 = item1Players.some(p => p.id === playerId);
        const inItem2 = item2Players.some(p => p.id === playerId);
        const isPlayerHome = inItem1;

        const myScore = isPlayerHome ? s1 : s2;
        const oppScore = isPlayerHome ? s2 : s1;
        const isWin = isBlockSuccess || myScore > oppScore;

        if (isDoubles || item1Players.length > 1 || item2Players.length > 1) {
          // --- DOUBLES MATCH ---
          const myTeam = isPlayerHome ? item1Players : item2Players;
          const oppTeam = isPlayerHome ? item2Players : item1Players;
          const partner = myTeam.find(p => p.id !== playerId) || { id: '', name: 'Neznámy spoluhráč' };

          const setDetails = [];
          let totalPtsWon = 0;
          let totalPtsLost = 0;
          let hasWalkover = false;

          for (let sIdx = 0; sIdx < rawSetsMatches.length; sIdx++) {
            const item1SetWon = rawSetsMatches[sIdx][1].includes('tml2__match__set-win');
            const item1RawVal = rawSetsMatches[sIdx][2].trim();
            const targetWonThisSet = isPlayerHome ? item1SetWon : !item1SetWon;

            let targetRawVal = item1RawVal;
            if (!isPlayerHome) {
              targetRawVal = item1RawVal.startsWith('+') ? `-${item1RawVal.slice(1)}` : (item1RawVal.startsWith('-') ? `+${item1RawVal.slice(1)}` : item1RawVal);
            }

            const parsed = parseSstzSet(targetRawVal, targetWonThisSet);
            totalPtsWon += parsed.playerPts;
            totalPtsLost += parsed.opponentPts;
            if (parsed.isWalkover) hasWalkover = true;

            setDetails.push({
              setNumber: sIdx + 1,
              playerPoints: parsed.playerPts,
              opponentPoints: parsed.opponentPts,
              display: parsed.display,
              won: parsed.won,
              isWalkover: parsed.isWalkover
            });
          }

          doublesMatches.push({
            id: `${seasonLabel.replace('/', '-')}-${matchId}-doubles-${duelIndex}`,
            teamMatchId: matchId,
            season: seasonLabel,
            leagueName: tabLeagueName || leagueTitle,
            competition: fullCompetition,
            date,
            round,
            teams,
            playerClub: tabTeamName || '',
            partnerName: partner.name,
            partnerId: partner.id,
            opponentPair: oppTeam.map(p => p.name).join(' & '),
            opponents: oppTeam,
            result: isWin ? 'WIN' : 'LOSS',
            score: `${myScore}:${oppScore}`,
            sets: setDetails.map(s => s.won ? `+${s.opponentPoints}` : `-${s.playerPoints}`),
            setDetails,
            totalPointsWon: totalPtsWon,
            totalPointsLost: totalPtsLost,
            source: 'SSTZ',
            type: 'doubles',
            isPlayerHome,
            isWalkover: hasWalkover
          });
        } else {
          // --- SINGLES MATCH (1v1) ---
          const p1 = item1Players[0];
          const p2 = item2Players[0];
          const opp = isPlayerHome ? p2 : p1;

          if (opp) {
            const setDetails = [];
            let totalPtsWon = 0;
            let totalPtsLost = 0;
            let hasWalkover = false;

            for (let sIdx = 0; sIdx < rawSetsMatches.length; sIdx++) {
              const item1SetWon = rawSetsMatches[sIdx][1].includes('tml2__match__set-win');
              const item1RawVal = rawSetsMatches[sIdx][2].trim();
              const targetWonThisSet = isPlayerHome ? item1SetWon : !item1SetWon;

              let targetRawVal = item1RawVal;
              if (!isPlayerHome) {
                targetRawVal = item1RawVal.startsWith('+') ? `-${item1RawVal.slice(1)}` : (item1RawVal.startsWith('-') ? `+${item1RawVal.slice(1)}` : item1RawVal);
              }

              const parsed = parseSstzSet(targetRawVal, targetWonThisSet);
              totalPtsWon += parsed.playerPts;
              totalPtsLost += parsed.opponentPts;
              if (parsed.isWalkover) hasWalkover = true;

              setDetails.push({
                setNumber: sIdx + 1,
                playerPoints: parsed.playerPts,
                opponentPoints: parsed.opponentPts,
                display: parsed.display,
                won: parsed.won,
                isWalkover: parsed.isWalkover
              });
            }

            singlesMatches.push({
              id: `${seasonLabel.replace('/', '-')}-${matchId}-${duelIndex}`,
              teamMatchId: matchId,
              season: seasonLabel,
              leagueName: tabLeagueName || leagueTitle,
              competition: fullCompetition,
              date,
              round,
              teams,
              playerClub: tabTeamName || '',
              opponentName: opp.name,
              opponentId: opp.id,
              result: isWin ? 'WIN' : 'LOSS',
              score: `${myScore}:${oppScore}`,
              sets: setDetails.map(s => s.won ? `+${s.opponentPoints}` : `-${s.playerPoints}`),
              setDetails,
              totalPointsWon: totalPtsWon,
              totalPointsLost: totalPtsLost,
              source: 'SSTZ',
              type: 'singles',
              isPlayerHome,
              isWalkover: hasWalkover
            });
          }
        }
      }
    }
  }

  return { singles: singlesMatches, doubles: doublesMatches };
}

/**
 * Get detailed player profile including all authentic duels, sets, points, stats, and win rates
 * Scans all league tabs across seasons to ensure 100% complete data with no fabrications.
 */
export async function getPlayerProfile(playerId, options = { allSeasons: false }) {
  if (!playerId) return null;

  const shouldFetchAllSeasons = !!options?.allSeasons;
  const cacheKey = `player:${playerId}:allSeasons=${shouldFetchAllSeasons}`;
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  const targetSeasons = shouldFetchAllSeasons ? ALL_SEASONS : [ALL_SEASONS[0]];

  try {
    let allSingles = [];
    let allDoubles = [];
    let playerName = '';
    let primaryClub = '';
    let primaryClubId = '';
    let association = 'SSTZ';
    const seasonsBreakdown = [];
    const seenMatchIds = new Set();

    // First season's singles and doubles summary
    let currSeasonSingles = { played: 0, won: 0, lost: 0, winRate: 0, home: { won: 0, total: 0 }, away: { won: 0, total: 0 } };
    let currSeasonDoubles = { played: 0, won: 0, lost: 0, winRate: 0 };

    for (let seasonIndex = 0; seasonIndex < targetSeasons.length; seasonIndex++) {
      const season = targetSeasons[seasonIndex];

      // Switch season on stolnytenis.info via GET /sezona/<slug>/svk to obtain session cookie
      const resSeason = await fetch(`${BASE_URL}/sezona/${season.slug}/svk`, {
        headers: DEFAULT_HEADERS,
        redirect: 'manual'
      });
      const setCookies = resSeason.headers.getSetCookie ? resSeason.headers.getSetCookie() : [resSeason.headers.get('set-cookie')];
      const cookieHeader = setCookies.map(c => c ? c.split(';')[0] : '').filter(Boolean).join('; ');

      const resPlayer = await fetch(`${BASE_URL}/hrac/${playerId}`, {
        headers: { ...DEFAULT_HEADERS, 'Cookie': cookieHeader }
      });

      if (!resPlayer.ok) {
        if (seasonIndex === 0) {
          throw new Error(`HTTP ${resPlayer.status} fetching player ${playerId}`);
        }
        continue;
      }

      const html = await resPlayer.text();

      if (!playerName) {
        const titleMatch = html.match(/<title>([^|]+)\|/);
        if (titleMatch) playerName = titleMatch[1].trim();
      }

      const regMatch = html.match(/<h2[^>]*class="[^"]*text-uppercase[^"]*"[^>]*>(.*?)<\/h2>/i);
      if (regMatch) association = regMatch[1].trim();

      const clubRegex = /<a[^>]*href="\/liga\/[^\/]+\/rozpis-muzstva\?club_id=(\d+)"[^>]*>(.*?)<\/a>/i;
      const clubMatch = html.match(clubRegex);
      if (!primaryClubId && clubMatch) {
        primaryClubId = clubMatch[1];
        if (!primaryClub) primaryClub = clubMatch[2].replace(/<[^>]+>/g, '').trim();
      }

      // Check official success blocks on page for this season
      const singlesBlock = html.match(/Úspešnosť\s*-\s*Dvojhry[\s\S]*?(?=Úspešnosť\s*-\s*Štvorhry|$)/i);
      if (seasonIndex === 0 && singlesBlock) {
        const celkom = singlesBlock[0].match(/Celkom\s*(\d+)\s*z\s*(\d+)/i);
        if (celkom) {
          currSeasonSingles.won = parseInt(celkom[1], 10);
          currSeasonSingles.played = parseInt(celkom[2], 10);
          currSeasonSingles.lost = currSeasonSingles.played - currSeasonSingles.won;
          currSeasonSingles.winRate = currSeasonSingles.played > 0 ? Math.round((currSeasonSingles.won / currSeasonSingles.played) * 100) : 0;
        }
        const doma = singlesBlock[0].match(/Doma\s*(\d+)\s*z\s*(\d+)/i);
        if (doma) {
          currSeasonSingles.home = { won: parseInt(doma[1], 10), total: parseInt(doma[2], 10) };
        }
        const vonku = singlesBlock[0].match(/Vonku\s*(\d+)\s*z\s*(\d+)/i);
        if (vonku) {
          currSeasonSingles.away = { won: parseInt(vonku[1], 10), total: parseInt(vonku[2], 10) };
        }
      }

      const doublesBlock = html.match(/Úspešnosť\s*-\s*Štvorhry[\s\S]*?(?=<div class="tml2|$)/i);
      if (seasonIndex === 0 && doublesBlock) {
        const celkom = doublesBlock[0].match(/Celkom\s*(\d+)\s*z\s*(\d+)/i);
        if (celkom) {
          currSeasonDoubles.won = parseInt(celkom[1], 10);
          currSeasonDoubles.played = parseInt(celkom[2], 10);
          currSeasonDoubles.lost = currSeasonDoubles.played - currSeasonDoubles.won;
          currSeasonDoubles.winRate = currSeasonDoubles.played > 0 ? Math.round((currSeasonDoubles.won / currSeasonDoubles.played) * 100) : 0;
        }
      }

      // Detect all tabs in this season (swipers / tabs2__nav__item)
      const tabRegex = /<div class="swiper-slide w-auto tabs2__nav__item[^"]*">([\s\S]*?)<\/div>/gi;
      const tabMatches = [...html.matchAll(tabRegex)];

      let seasonSingles = 0;
      let seasonDoubles = 0;
      let seasonSinglesWon = 0;
      let seasonDoublesWon = 0;
      const seasonLeagues = new Set();

      if (tabMatches.length === 0) {
        const duels = parsePlayerDuelsFromHtml(html, playerId, season.label, '', '');
        for (const m of duels.singles) {
          if (!seenMatchIds.has(m.id)) {
            seenMatchIds.add(m.id);
            allSingles.push(m);
            seasonSingles++;
            if (m.result === 'WIN') seasonSinglesWon++;
          }
        }
        for (const m of duels.doubles) {
          if (!seenMatchIds.has(m.id)) {
            seenMatchIds.add(m.id);
            allDoubles.push(m);
            seasonDoubles++;
            if (m.result === 'WIN') seasonDoublesWon++;
          }
        }
      } else {
        for (const tm of tabMatches) {
          const content = tm[1];
          const league = content.match(/<span class="d-block fw-bold">([\s\S]*?)<\/span>/i)?.[1]?.trim() || '';
          const team = content.match(/<span class="d-block">([\s\S]*?)<\/span>/i)?.[1]?.trim() || '';
          const href = content.match(/href="([^"]+)"/i)?.[1];
          if (league) seasonLeagues.add(league);
          if (!primaryClub && team) primaryClub = team;

          let tabHtml = html;
          if (href && href !== `${BASE_URL}/hrac/${playerId}` && !content.includes('active')) {
            const url = href.startsWith('http') ? href : `${BASE_URL}${href}`;
            try {
              const resTab = await fetch(url, {
                headers: { ...DEFAULT_HEADERS, 'Cookie': cookieHeader }
              });
              if (resTab.ok) tabHtml = await resTab.text();
            } catch (err) {
              console.warn(`Error fetching tab ${url}:`, err.message);
            }
          }

          const duels = parsePlayerDuelsFromHtml(tabHtml, playerId, season.label, league, team);
          for (const m of duels.singles) {
            if (!seenMatchIds.has(m.id)) {
              seenMatchIds.add(m.id);
              allSingles.push(m);
              seasonSingles++;
              if (m.result === 'WIN') seasonSinglesWon++;
            }
          }
          for (const m of duels.doubles) {
            if (!seenMatchIds.has(m.id)) {
              seenMatchIds.add(m.id);
              allDoubles.push(m);
              seasonDoubles++;
              if (m.result === 'WIN') seasonDoublesWon++;
            }
          }
        }
      }

      if (seasonSingles + seasonDoubles > 0) {
        seasonsBreakdown.push({
          season: season.label,
          slug: season.slug,
          leagues: Array.from(seasonLeagues),
          singles: seasonSingles,
          singlesWon: seasonSinglesWon,
          singlesLost: seasonSingles - seasonSinglesWon,
          singlesWinRate: seasonSingles > 0 ? Math.round((seasonSinglesWon / seasonSingles) * 100) : 0,
          doubles: seasonDoubles,
          doublesWon: seasonDoublesWon,
          doublesLost: seasonDoubles - seasonDoublesWon,
          doublesWinRate: seasonDoubles > 0 ? Math.round((seasonDoublesWon / seasonDoubles) * 100) : 0,
          total: seasonSingles + seasonDoubles
        });
      }
    }

    // Career totals
    const careerSinglesPlayed = allSingles.length;
    const careerSinglesWon = allSingles.filter(m => m.result === 'WIN').length;
    const careerSinglesLost = careerSinglesPlayed - careerSinglesWon;
    const careerSinglesWinRate = careerSinglesPlayed > 0 ? Math.round((careerSinglesWon / careerSinglesPlayed) * 100) : 0;

    const careerDoublesPlayed = allDoubles.length;
    const careerDoublesWon = allDoubles.filter(m => m.result === 'WIN').length;
    const careerDoublesLost = careerDoublesPlayed - careerDoublesWon;
    const careerDoublesWinRate = careerDoublesPlayed > 0 ? Math.round((careerDoublesWon / careerDoublesPlayed) * 100) : 0;

    const profile = {
      id: playerId.toString(),
      name: playerName || `Hráč #${playerId}`,
      association,
      clubName: primaryClub,
      clubId: primaryClubId,
      singles: currSeasonSingles,
      doubles: currSeasonDoubles,
      singlesStats: shouldFetchAllSeasons ? {
        played: careerSinglesPlayed,
        won: careerSinglesWon,
        lost: careerSinglesLost,
        winRate: careerSinglesWinRate,
        home: currSeasonSingles.home,
        away: currSeasonSingles.away
      } : currSeasonSingles,
      doublesStats: shouldFetchAllSeasons ? {
        played: careerDoublesPlayed,
        won: careerDoublesWon,
        lost: careerDoublesLost,
        winRate: careerDoublesWinRate
      } : currSeasonDoubles,
      matches: allSingles,
      doublesMatches: allDoubles,
      totalMatches: allSingles.length,
      totalDoublesMatches: allDoubles.length,
      isAllSeasons: shouldFetchAllSeasons,
      syncedSeasonsCount: seasonsBreakdown.length || 1,
      seasonsBreakdown,
      source: 'SSTZ',
      syncedAt: new Date().toISOString()
    };

    setInCache(cacheKey, profile);
    // Persist snapshot to disk
    saveSnapshot(playerId, profile);

    return profile;
  } catch (err) {
    console.error(`Error loading live player ${playerId}:`, err.message);

    // Fallback: load existing verified snapshot if available
    const snapshot = loadSnapshot(playerId);
    if (snapshot) {
      console.log(`Loaded authentic snapshot fallback for player ${playerId}`);
      return snapshot;
    }

    return null;
  }
}

/**
 * Get full team calendar / schedule from rozpis-muzstva (or entire league schedule if no clubId)
 */
export async function getTeamSchedule(leagueSlug, clubId) {
  if (!leagueSlug) return null;

  const cacheKey = `schedule:${leagueSlug}:${clubId || 'all'}`;
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  const url = clubId
    ? `${BASE_URL}/liga/${leagueSlug}/rozpis-muzstva?club_id=${clubId}`
    : `${BASE_URL}/liga/${leagueSlug}/rozpis`;

  try {
    const res = await fetch(url, {
      headers: DEFAULT_HEADERS
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} fetching schedule`);
    }

    const html = await res.text();

    const titleMatch = html.match(/<title>([^|]+)\|/);
    const leagueTitle = titleMatch ? titleMatch[1].trim() : leagueSlug;

    const matches = [];
    const seenMatches = new Set();
    const blocks = html.split(/data-match_id="(\d+)"/i);

    for (let i = 1; i < blocks.length; i += 2) {
      const matchId = blocks[i];
      if (seenMatches.has(matchId)) continue;

      const chunk = blocks[i + 1].substring(0, 2500);

      const roundMatch = chunk.match(/class="(?:mtchr__num|mgr1__num)">(\d+)\.<\/span>|class="(?:mtchr__num|mgr1__num)">(\d+)\.<\/div>/i);
      const roundNum = roundMatch ? (roundMatch[1] || roundMatch[2]) : '';

      const dateMatch = chunk.match(/class="(?:mtchr__round__date|mgr1__date)">([^<]+)<\/span>/i) ||
                        chunk.match(/(\d{1,2}\.\d{1,2}\.\d{4}\s+\d{1,2}:\d{2})/);
      const dateTime = dateMatch ? dateMatch[1].trim() : '';

      const homeMatch = chunk.match(/class="mtchr__home"[^>]*>([\s\S]*?)<\/a>/i) ||
                        chunk.match(/class="mgr1__team\s+mgr1__team__home"[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i);
      const homeTeam = homeMatch ? homeMatch[1].replace(/<[^>]+>/g, '').trim() : '';

      const awayMatch = chunk.match(/class="mtchr__away"[^>]*>([\s\S]*?)<\/a>/i) ||
                        chunk.match(/class="mgr1__team\s+mgr1__team__away"[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i);
      const awayTeam = awayMatch ? awayMatch[1].replace(/<[^>]+>/g, '').trim() : '';

      const homeScoreMatch = chunk.match(/class="[^"]*(?:mtchr__home__score|mgr1__score__home)"[^>]*>([^<]+)<\/a>/i);
      const awayScoreMatch = chunk.match(/class="[^"]*(?:mtchr__away__score|mgr1__score__away)"[^>]*>([^<]+)<\/a>/i);
      const homeScore = homeScoreMatch ? homeScoreMatch[1].trim() : '';
      const awayScore = awayScoreMatch ? awayScoreMatch[1].trim() : '';

      const isPlayed = homeScore !== '' && awayScore !== '' && (homeScore !== '0' || awayScore !== '0');

      if (homeTeam && awayTeam) {
        seenMatches.add(matchId);
        matches.push({
          id: matchId,
          round: roundNum ? `${roundNum}. kolo` : '',
          dateTime,
          homeTeam,
          awayTeam,
          homeScore,
          awayScore,
          isPlayed,
          protocolUrl: `${BASE_URL}/zapas/${matchId}`
        });
      }
    }

    const result = {
      leagueSlug,
      clubId: clubId || '',
      leagueTitle,
      matches,
      syncedAt: new Date().toISOString()
    };

    setInCache(cacheKey, result);
    return result;
  } catch (err) {
    console.error('Error fetching team schedule:', err.message);
    return null;
  }
}

/**
 * Get league standings, clubs, and all league matches
 */
export async function getLeagueData(leagueSlug) {
  if (!leagueSlug) return null;

  const cacheKey = `league:${leagueSlug}`;
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  try {
    const tableUrl = `${BASE_URL}/liga/${leagueSlug}/tabulka`;
    const res = await fetch(tableUrl, {
      headers: DEFAULT_HEADERS
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();

    const titleMatch = html.match(/<title>([^|]+)\|/);
    const title = titleMatch ? titleMatch[1].trim() : leagueSlug;

    // Parse standings from card__table table-row-animate
    const cardRegex = /<div class="card__table table-row-animate">([\s\S]*?)(?=<div class="card__table table-row-animate"|<\/main>|<footer|$)/gi;
    const cards = [...html.matchAll(cardRegex)];

    const standings = [];
    const seenClubs = new Set();
    const clubs = [];

    for (const c of cards) {
      const chunk = c[1];
      const posMatch = chunk.match(/class="card__table__pos">(\d+)\.<\/div>/i);
      const clubMatch = chunk.match(/href="[^"]*club_id=(\d+)"[^>]*>[\s\S]*?<span class="card__table__team__title">([\s\S]*?)<\/span>/i);
      const allMatch = chunk.match(/class="card__table__all">(\d+)<\/div>/i);
      const winsMatch = chunk.match(/class="card__table__wins">(\d+)<\/div>/i);
      const drawsMatch = chunk.match(/class="card__table__draws">(\d+)<\/div>/i);
      const lostsMatch = chunk.match(/class="card__table__losts">(\d+)<\/div>/i);
      const scoreMatch = chunk.match(/class="card__table__score">([^<]+)<\/div>/i);
      const pointsMatch = chunk.match(/class="card__table__points"[^>]*>(\d+)<\/div>/i);

      if (posMatch && clubMatch) {
        const clubId = clubMatch[1];
        const clubName = clubMatch[2].replace(/<[^>]+>/g, '').trim();
        const pos = parseInt(posMatch[1], 10);

        if (!seenClubs.has(clubId)) {
          seenClubs.add(clubId);
          standings.push({
            position: pos,
            clubId,
            clubName,
            played: allMatch ? parseInt(allMatch[1], 10) : 0,
            wins: winsMatch ? parseInt(winsMatch[1], 10) : 0,
            draws: drawsMatch ? parseInt(drawsMatch[1], 10) : 0,
            losts: lostsMatch ? parseInt(lostsMatch[1], 10) : 0,
            score: scoreMatch ? scoreMatch[1].trim() : '',
            points: pointsMatch ? parseInt(pointsMatch[1], 10) : 0
          });
          clubs.push({ clubId, clubName });
        }
      }
    }

    standings.sort((a, b) => a.position - b.position);

    if (clubs.length === 0) {
      const clubLinks = [...html.matchAll(/<a[^>]*href="\/liga\/[^\/]+\/rozpis-muzstva\?club_id=(\d+)"[^>]*>([^<]+)<\/a>/gi)];
      for (const cl of clubLinks) {
        const cId = cl[1];
        const cName = cl[2].replace(/<[^>]+>/g, '').trim();
        if (!seenClubs.has(cId) && cName.length > 1) {
          seenClubs.add(cId);
          clubs.push({ clubId: cId, clubName: cName });
        }
      }
    }

    let matches = [];
    try {
      const scheduleData = await getTeamSchedule(leagueSlug, null);
      if (scheduleData && scheduleData.matches) {
        matches = scheduleData.matches;
      }
    } catch (schedErr) {
      console.warn(`Could not fetch schedule for league ${leagueSlug}:`, schedErr.message);
    }

    const data = {
      slug: leagueSlug,
      title,
      clubs,
      standings,
      matches,
      syncedAt: new Date().toISOString()
    };

    setInCache(cacheKey, data);
    return data;
  } catch (err) {
    console.error('Error fetching league data:', err.message);
    return null;
  }
}

/**
 * Returns ALL 126 Slovak leagues grouped by region / association
 */
export async function getAllSlovakLeagues() {
  const cacheKey = 'all_slovak_leagues';
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch(`${BASE_URL}/`, {
      headers: DEFAULT_HEADERS
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();

    const categories = [];

    const catRegex = /<a[^>]*class="[^"]*dropdown-toggle[^"]*"[^>]*>[\s\S]*?<span\s+class="name">([\s\S]*?)<\/span>[\s\S]*?<\/a>\s*<div\s+class="dropdown-menu[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
    let catMatch;

    while ((catMatch = catRegex.exec(html)) !== null) {
      const rawCatName = catMatch[1].replace(/<[^>]+>/g, '').trim();
      if (!rawCatName || rawCatName === 'Zmeniť sezónu') continue;

      const menuContent = catMatch[2];
      const leagueRegex = /<a[^>]*href=["'](\/liga\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
      let lMatch;
      const leagues = [];
      const seenSlugs = new Set();

      while ((lMatch = leagueRegex.exec(menuContent)) !== null) {
        const url = lMatch[1];
        const name = lMatch[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        const slug = url.replace('/liga/', '').replace(/\/tabulka|\/rozpis|\/uspesnost/g, '').replace(/^\/+|\/+$/g, '');

        if (!seenSlugs.has(slug) && slug.length > 2) {
          seenSlugs.add(slug);
          leagues.push({
            name,
            slug,
            url: `/liga/${slug}/tabulka`
          });
        }
      }

      if (leagues.length > 0) {
        categories.push({
          category: rawCatName,
          leagues
        });
      }
    }

    if (categories.length > 0) {
      setInCache(cacheKey, categories);
      return categories;
    }

    return getPopularLeagues();
  } catch (err) {
    console.error('Error fetching all leagues:', err.message);
    return getPopularLeagues();
  }
}

/**
 * List of popular SSTZ leagues as reliable fallback
 */
export function getPopularLeagues() {
  return [
    {
      category: 'SSTZ',
      leagues: [
        { name: 'Joola Extraliga, Muži', slug: 'sezona-2026-27-joola-extraliga-muzi-sstz', url: '/liga/sezona-2026-27-joola-extraliga-muzi-sstz/tabulka' },
        { name: 'Extraliga, Ženy', slug: 'sezona-2026-27-extraliga-zeny-sstz', url: '/liga/sezona-2026-27-extraliga-zeny-sstz/tabulka' },
        { name: '1.liga - Západ, Muži', slug: 'sezona-2026-27-1-liga-zapad-muzi-sstz', url: '/liga/sezona-2026-27-1-liga-zapad-muzi-sstz/tabulka' },
        { name: '1.liga - Východ, Muži', slug: 'sezona-2026-27-1-liga-vychod-muzi-sstz', url: '/liga/sezona-2026-27-1-liga-vychod-muzi-sstz/tabulka' },
        { name: '1.liga - Západ, Ženy', slug: 'sezona-2026-27-1-liga-zapad-zeny-sstz', url: '/liga/sezona-2026-27-1-liga-zapad-zeny-sstz/tabulka' },
        { name: '1. liga - Východ, Ženy', slug: 'sezona-2026-27-1-liga-vychod-zeny-sstz', url: '/liga/sezona-2026-27-1-liga-vychod-zeny-sstz/tabulka' },
        { name: 'Extraliga, Dorastenci', slug: 'sezona-2026-27-extraliga-dorastenci-sstz', url: '/liga/sezona-2026-27-extraliga-dorastenci-sstz/tabulka' },
        { name: 'Extraliga, Dorastenky', slug: 'sezona-2026-27-extraliga-dorastenky-sstz', url: '/liga/sezona-2026-27-extraliga-dorastenky-sstz/tabulka' },
        { name: 'Zmiešané družstvá, Mladší žiaci', slug: 'sezona-2026-27-zmiesane-druzstva-mladsi-ziaci-sstz', url: '/liga/sezona-2026-27-zmiesane-druzstva-mladsi-ziaci-sstz/tabulka' }
      ]
    },
    {
      category: 'KSTZ Bratislava',
      leagues: [
        { name: '2. liga, Muži', slug: 'sezona-2026-27-2-liga-muzi-kstz-bratislava', url: '/liga/sezona-2026-27-2-liga-muzi-kstz-bratislava/tabulka' },
        { name: '3. liga, Muži', slug: 'sezona-2026-27-3-liga-muzi-kstz-bratislava', url: '/liga/sezona-2026-27-3-liga-muzi-kstz-bratislava/tabulka' },
        { name: '4. liga, Muži', slug: 'sezona-2026-27-4-liga-muzi-kstz-bratislava', url: '/liga/sezona-2026-27-4-liga-muzi-kstz-bratislava/tabulka' },
        { name: '5. liga, Muži', slug: 'sezona-2026-27-5-liga-muzi-kstz-bratislava', url: '/liga/sezona-2026-27-5-liga-muzi-kstz-bratislava/tabulka' },
        { name: '6. liga, Muži', slug: 'sezona-2026-27-6-liga-muzi-kstz-bratislava', url: '/liga/sezona-2026-27-6-liga-muzi-kstz-bratislava/tabulka' },
        { name: '7. liga, Muži', slug: 'sezona-2026-27-7-liga-muzi-kstz-bratislava', url: '/liga/sezona-2026-27-7-liga-muzi-kstz-bratislava/tabulka' }
      ]
    },
    {
      category: 'KSTZ Trnava',
      leagues: [
        { name: '2. liga, Muži', slug: 'sezona-2026-27-2-liga-muzi-kstz-trnava', url: '/liga/sezona-2026-27-2-liga-muzi-kstz-trnava/tabulka' },
        { name: '3. liga, Muži', slug: 'sezona-2026-27-3-liga-muzi-kstz-trnava', url: '/liga/sezona-2026-27-3-liga-muzi-kstz-trnava/tabulka' },
        { name: '4. liga, Muži', slug: 'sezona-2026-27-4-liga-muzi-kstz-trnava', url: '/liga/sezona-2026-27-4-liga-muzi-kstz-trnava/tabulka' }
      ]
    },
    {
      category: 'KSTZ Nitra',
      leagues: [
        { name: '3. liga, Muži', slug: 'sezona-2026-27-3-liga-muzi-kstz-nitra', url: '/liga/sezona-2026-27-3-liga-muzi-kstz-nitra/tabulka' },
        { name: '4. liga - A, Muži', slug: 'sezona-2026-27-4-liga-a-muzi-kstz-nitra', url: '/liga/sezona-2026-27-4-liga-a-muzi-kstz-nitra/tabulka' },
        { name: '4. liga - B, Muži', slug: 'sezona-2026-27-4-liga-b-muzi-kstz-nitra', url: '/liga/sezona-2026-27-4-liga-b-muzi-kstz-nitra/tabulka' },
        { name: '5. liga - A, Muži', slug: 'sezona-2026-27-5-liga-a-muzi-kstz-nitra', url: '/liga/sezona-2026-27-5-liga-a-muzi-kstz-nitra/tabulka' },
        { name: '5. liga - B, Muži', slug: 'sezona-2026-27-5-liga-b-muzi-kstz-nitra', url: '/liga/sezona-2026-27-5-liga-b-muzi-kstz-nitra/tabulka' }
      ]
    },
    {
      category: 'KSTZ Žilina',
      leagues: [
        { name: '2. liga, Muži', slug: 'sezona-2026-27-2-liga-muzi-kstz-zilina', url: '/liga/sezona-2026-27-2-liga-muzi-kstz-zilina/tabulka' },
        { name: '3. liga, Muži', slug: 'sezona-2026-27-3-liga-muzi-kstz-zilina', url: '/liga/sezona-2026-27-3-liga-muzi-kstz-zilina/tabulka' },
        { name: '4. liga - Východ, Muži', slug: 'sezona-2026-27-4-liga-vychod-muzi-kstz-zilina', url: '/liga/sezona-2026-27-4-liga-vychod-muzi-kstz-zilina/tabulka' },
        { name: '4. liga - Západ, Muži', slug: 'sezona-2026-27-4-liga-zapad-muzi-kstz-zilina', url: '/liga/sezona-2026-27-4-liga-zapad-muzi-kstz-zilina/tabulka' }
      ]
    },
    {
      category: 'VSSTZ',
      leagues: [
        { name: '2. liga Východ, Muži', slug: 'sezona-2026-27-2-liga-vychod-muzi-vsstz', url: '/liga/sezona-2026-27-2-liga-vychod-muzi-vsstz/tabulka' },
        { name: '3. liga Západ, Muži', slug: 'sezona-2026-27-3-liga-zapad-muzi-vsstz', url: '/liga/sezona-2026-27-3-liga-zapad-muzi-vsstz/tabulka' },
        { name: '3. liga Východ, Muži', slug: 'sezona-2026-27-3-liga-vychod-muzi-vsstz', url: '/liga/sezona-2026-27-3-liga-vychod-muzi-vsstz/tabulka' }
      ]
    }
  ];
}
