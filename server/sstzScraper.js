// SSTZ and stolnytenis.info scraper & parser
const BASE_URL = 'https://www.stolnytenis.info';

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'sk-SK,sk;q=0.9,cs;q=0.8,en-US;q=0.7,en;q=0.6',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache'
};

const ALL_SEASONS = [
  { id: 37, label: '2026/27' },
  { id: 36, label: '2025/26' },
  { id: 35, label: '2024/25' },
  { id: 34, label: '2023/24' },
  { id: 33, label: '2022/23' },
  { id: 32, label: '2021/22' },
  { id: 31, label: '2020/21' },
  { id: 30, label: '2019/20' },
  { id: 29, label: '2018/19' },
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

// Helper to get session cookie & CSRF token from homepage
let sessionCookie = '';
let csrfToken = '';
let sessionTimestamp = 0;

async function getSession() {
  if (sessionCookie && csrfToken && Date.now() - sessionTimestamp < 30 * 60 * 1000) {
    return { cookie: sessionCookie, token: csrfToken };
  }

  try {
    const res = await fetch(`${BASE_URL}/`, {
      headers: DEFAULT_HEADERS
    });
    const setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie')];
    if (setCookies && setCookies.length > 0) {
      sessionCookie = setCookies.map(c => c ? c.split(';')[0] : '').filter(Boolean).join('; ');
    }
    const html = await res.text();
    const csrfMatch = homeHtml.match(/name="csrf-token" content="([^"]+)"/);
    if (csrfMatch) {
      csrfToken = csrfMatch[1];
    }
    sessionTimestamp = Date.now();
    return { cookie: sessionCookie, token: csrfToken };
  } catch (err) {
    console.error('Error fetching SSTZ session:', err.message);
    return { cookie: '', token: '' };
  }
}

/**
 * Converts table tennis set notation into exact points and scores
 * E.g., -8 -> 8:11, +11 -> 13:11, +9 -> 11:9, -5 -> 5:11
 */
export function parseSstzSet(setStr, fallbackIsWin = false) {
  const clean = setStr.trim();
  if (clean.includes(':')) {
    const [p1, p2] = clean.split(':').map(n => parseInt(n.trim(), 10));
    return {
      playerPts: isNaN(p1) ? 11 : p1,
      opponentPts: isNaN(p2) ? 9 : p2,
      display: clean,
      won: p1 > p2
    };
  }

  const sign = clean.startsWith('+') ? '+' : (clean.startsWith('-') ? '-' : (fallbackIsWin ? '+' : '-'));
  const num = parseInt(clean.replace(/[^0-9]/g, ''), 10);

  if (isNaN(num)) {
    return { playerPts: 11, opponentPts: 9, display: clean, won: fallbackIsWin };
  }

  if (sign === '+') {
    // Player won this set
    const opponentPts = num;
    const playerPts = num >= 10 ? num + 2 : 11;
    return {
      playerPts,
      opponentPts,
      display: `${playerPts}:${opponentPts}`,
      won: true
    };
  } else {
    // Player lost this set
    const playerPts = num;
    const opponentPts = num >= 10 ? num + 2 : 11;
    return {
      playerPts,
      opponentPts,
      display: `${playerPts}:${opponentPts}`,
      won: false
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
 * Parses individual duels and match protocols from a player profile HTML page,
 * separating singles (1v1) from doubles (štvorhry)
 */
function parsePlayerDuelsFromHtml(html, playerId, seasonLabel = '2026/27') {
  function parseDuelSet(setStr, playerWon) {
    const clean = setStr.trim();
    const sign = clean.startsWith('+') ? '+' : (clean.startsWith('-') ? '-' : (playerWon ? '+' : '-'));
    const num = parseInt(clean.replace(/[^0-9]/g, ''), 10);
    if (isNaN(num)) return { playerPts: 11, opponentPts: 9, display: clean, won: playerWon };
    if (sign === '+') {
      const oppPts = num;
      const myPts = num >= 10 ? num + 2 : 11;
      return { playerPts: myPts, opponentPts: oppPts, display: `${myPts}:${oppPts}`, won: true };
    } else {
      const myPts = num;
      const oppPts = num >= 10 ? num + 2 : 11;
      return { playerPts: myPts, opponentPts: oppPts, display: `${myPts}:${oppPts}`, won: false };
    }
  }

  const singlesMatches = [];
  const doublesMatches = [];

  const encounterRegex = /<div class="media-body">([\s\S]*?)<\/div>[\s\S]*?<section\s+id="tml2-(\d+)"[^>]*>([\s\S]*?)<\/section>/gi;
  let encMatch;

  while ((encMatch = encounterRegex.exec(html)) !== null) {
    const headerText = encMatch[1];
    const matchId = encMatch[2];
    const sectionHtml = encMatch[3];

    const allH4s = [...headerText.matchAll(/<h4[^>]*>([\s\S]*?)<\/h4>/gi)].map(m => m[1].replace(/<[^>]+>/g, '').trim());
    let leagueName = '';
    let round = 'Liga';
    let date = '';

    if (allH4s.length >= 2) {
      leagueName = allH4s[0];
      round = allH4s[1].split('/')[0]?.trim() || allH4s[1];
      const dMatch = allH4s[1].match(/(\d{1,2}\.\d{1,2}\.\d{4})/);
      date = dMatch ? dMatch[1] : '';
    } else if (allH4s.length === 1) {
      leagueName = allH4s[0];
      const rMatch = allH4s[0].match(/(\d+\.\s*kolo)/i);
      round = rMatch ? rMatch[1] : allH4s[0];
      const dMatch = allH4s[0].match(/(\d{1,2}\.\d{1,2}\.\d{4})/);
      date = dMatch ? dMatch[1] : '';
    }

    if (!round || round === 'Liga') {
      const rMatch = headerText.match(/(\d+\.\s*kolo)/i);
      if (rMatch) round = rMatch[1];
    }
    if (!date) {
      const dMatch = headerText.match(/(\d{1,2}\.\d{1,2}\.\d{4})/);
      if (dMatch) date = dMatch[1];
    }

    // Find preceding H2 or stage heading if available
    const encIndex = encMatch.index || 0;
    const beforeHtml = html.substring(Math.max(0, encIndex - 2500), encIndex);
    const lastH2Match = [...beforeHtml.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)];
    const sectionCompetition = lastH2Match.length > 0 ? lastH2Match[lastH2Match.length - 1][1].replace(/<[^>]+>/g, '').trim() : '';

    let fullLeagueName = leagueName;
    if (sectionCompetition && sectionCompetition !== 'Základná časť' && sectionCompetition !== leagueName) {
      fullLeagueName = `${sectionCompetition}${leagueName && leagueName !== sectionCompetition ? ` • ${leagueName}` : ''}`;
    } else if (!fullLeagueName && sectionCompetition) {
      fullLeagueName = sectionCompetition;
    }
    if (!fullLeagueName) fullLeagueName = 'SSTZ Liga';

    const teamsMatch = headerText.match(/<p class="m-0">(.*?)<\/p>/i);
    const teams = teamsMatch ? teamsMatch[1].replace(/<[^>]+>/g, '').trim() : '';

    const blockRegex = /<div\s+class="tml2-block\s+([^"]+)">([\s\S]*?)(?=<div\s+class="tml2-block|$)/gi;
    let bMatch;
    let duelIndex = 0;

    while ((bMatch = blockRegex.exec(sectionHtml)) !== null) {
      duelIndex++;
      const blockClass = bMatch[1];
      const blockHtml = bMatch[2];
      const isWin = blockClass.includes('tml2-block-success');
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

        if (isDoubles || item1Players.length > 1 || item2Players.length > 1) {
          // --- DOUBLES MATCH ---
          const inItem1 = item1Players.some(p => p.id === playerId);
          const myTeam = inItem1 ? item1Players : item2Players;
          const oppTeam = inItem1 ? item2Players : item1Players;
          const partner = myTeam.find(p => p.id !== playerId) || { id: '', name: 'Neznámy spoluhráč' };
          const myScore = inItem1 ? s1 : s2;
          const oppScore = inItem1 ? s2 : s1;

          const setDetails = [];
          let totalPtsWon = 0;
          let totalPtsLost = 0;

          for (let sIdx = 0; sIdx < rawSetsMatches.length; sIdx++) {
            const item1SetWon = rawSetsMatches[sIdx][1].includes('tml2__match__set-win');
            const item1RawVal = rawSetsMatches[sIdx][2].trim();
            const targetWonThisSet = inItem1 ? item1SetWon : !item1SetWon;

            let targetRawVal = item1RawVal;
            if (!inItem1) {
              targetRawVal = item1RawVal.startsWith('+') ? `-${item1RawVal.slice(1)}` : (item1RawVal.startsWith('-') ? `+${item1RawVal.slice(1)}` : item1RawVal);
            }

            const parsed = parseDuelSet(targetRawVal, targetWonThisSet);
            totalPtsWon += parsed.playerPts;
            totalPtsLost += parsed.opponentPts;

            setDetails.push({
              setNumber: sIdx + 1,
              playerPoints: parsed.playerPts,
              opponentPoints: parsed.opponentPts,
              display: parsed.display,
              won: parsed.won
            });
          }

          doublesMatches.push({
            id: `${seasonLabel.replace('/', '-')}-${matchId}-doubles-${duelIndex}`,
            teamMatchId: matchId,
            season: seasonLabel,
            leagueName: fullLeagueName,
            date,
            round,
            teams,
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
            type: 'doubles'
          });
        } else {
          // --- SINGLES MATCH (1v1) ---
          const p1 = item1Players[0];
          const p2 = item2Players[0];
          if (p1 && p2) {
            const isP1 = p1.id === playerId;
            const opp = isP1 ? p2 : p1;
            const myScore = isP1 ? s1 : s2;
            const oppScore = isP1 ? s2 : s1;

            const setDetails = [];
            let totalPtsWon = 0;
            let totalPtsLost = 0;

            for (let sIdx = 0; sIdx < rawSetsMatches.length; sIdx++) {
              const item1SetWon = rawSetsMatches[sIdx][1].includes('tml2__match__set-win');
              const item1RawVal = rawSetsMatches[sIdx][2].trim();
              const targetWonThisSet = isP1 ? item1SetWon : !item1SetWon;

              let targetRawVal = item1RawVal;
              if (!isP1) {
                targetRawVal = item1RawVal.startsWith('+') ? `-${item1RawVal.slice(1)}` : (item1RawVal.startsWith('-') ? `+${item1RawVal.slice(1)}` : item1RawVal);
              }

              const parsed = parseDuelSet(targetRawVal, targetWonThisSet);
              totalPtsWon += parsed.playerPts;
              totalPtsLost += parsed.opponentPts;

              setDetails.push({
                setNumber: sIdx + 1,
                playerPoints: parsed.playerPts,
                opponentPoints: parsed.opponentPts,
                display: parsed.display,
                won: parsed.won
              });
            }

            singlesMatches.push({
              id: `${seasonLabel.replace('/', '-')}-${matchId}-${duelIndex}`,
              teamMatchId: matchId,
              season: seasonLabel,
              leagueName: fullLeagueName,
              competition: 'SSTZ Liga',
              date,
              round,
              teams,
              opponentName: opp.name,
              opponentId: opp.id,
              result: isWin ? 'WIN' : 'LOSS',
              score: `${myScore}:${oppScore}`,
              sets: setDetails.map(s => s.won ? `+${s.opponentPoints}` : `-${s.playerPoints}`),
              setDetails,
              totalPointsWon: totalPtsWon,
              totalPointsLost: totalPtsLost,
              source: 'SSTZ',
              type: 'singles'
            });
          }
        }
      }
    }
  }

  return { singles: singlesMatches, doubles: doublesMatches };
}

/**
 * Get detailed player profile including real duels, sets, points, stats, and win rates
 * Supports fetching all historical seasons if options.allSeasons is true
 */
export async function getPlayerProfile(playerId, options = { allSeasons: false }) {
  if (!playerId) return null;

  const shouldFetchAllSeasons = !!options?.allSeasons;
  const cacheKey = `player:${playerId}:allSeasons=${shouldFetchAllSeasons}`;
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  try {
    const resHome = await fetch(`${BASE_URL}/`, { headers: DEFAULT_HEADERS });
    const setCookies = resHome.headers.getSetCookie ? resHome.headers.getSetCookie() : [resHome.headers.get('set-cookie')];
    let cookie = setCookies.map(c => c ? c.split(';')[0] : '').filter(Boolean).join('; ');
    const homeHtml = await resHome.text();
    const csrfMatch = homeHtml.match(/name="csrf-token" content="([^"]+)"/);
    const token = csrfMatch ? csrfMatch[1] : '';

    // Fetch current season profile first
    const resCurr = await fetch(`${BASE_URL}/hrac/${playerId}`, {
      headers: { ...DEFAULT_HEADERS, 'Cookie': cookie }
    });

    if (!resCurr.ok) {
      throw new Error(`HTTP ${resCurr.status} fetching player ${playerId}`);
    }

    const htmlCurr = await resCurr.text();

    // Name
    const titleMatch = htmlCurr.match(/<title>([^|]+)\|/);
    const name = titleMatch ? titleMatch[1].trim() : `Hráč #${playerId}`;

    // Region / Category heading
    const regMatch = htmlCurr.match(/<h2[^>]*class="[^"]*text-uppercase[^"]*"[^>]*>(.*?)<\/h2>/i);
    const association = regMatch ? regMatch[1].trim() : 'SSTZ';

    // Singles stats current season
    let singles = { played: 0, won: 0, lost: 0, winRate: 0, home: { won: 0, total: 0 }, away: { won: 0, total: 0 } };
    const singlesBlock = htmlCurr.match(/Úspešnosť\s*-\s*Dvojhry[\s\S]*?(?=Úspešnosť\s*-\s*Štvorhry|$)/i);
    if (singlesBlock) {
      const celkom = singlesBlock[0].match(/Celkom\s*(\d+)\s*z\s*(\d+)/i);
      if (celkom) {
        singles.won = parseInt(celkom[1], 10);
        singles.played = parseInt(celkom[2], 10);
        singles.lost = singles.played - singles.won;
        singles.winRate = singles.played > 0 ? Math.round((singles.won / singles.played) * 100) : 0;
      }
      const doma = singlesBlock[0].match(/Doma\s*(\d+)\s*z\s*(\d+)/i);
      if (doma) {
        singles.home = { won: parseInt(doma[1], 10), total: parseInt(doma[2], 10) };
      }
      const vonku = singlesBlock[0].match(/Vonku\s*(\d+)\s*z\s*(\d+)/i);
      if (vonku) {
        singles.away = { won: parseInt(vonku[1], 10), total: parseInt(vonku[2], 10) };
      }
    }

    // Doubles stats current season
    let doubles = { played: 0, won: 0, lost: 0, winRate: 0 };
    const doublesBlock = htmlCurr.match(/Úspešnosť\s*-\s*Štvorhry[\s\S]*?(?=<div class="tml2|$)/i);
    if (doublesBlock) {
      const celkom = doublesBlock[0].match(/Celkom\s*(\d+)\s*z\s*(\d+)/i);
      if (celkom) {
        doubles.won = parseInt(celkom[1], 10);
        doubles.played = parseInt(celkom[2], 10);
        doubles.lost = doubles.played - doubles.won;
        doubles.winRate = doubles.played > 0 ? Math.round((doubles.won / doubles.played) * 100) : 0;
      }
    }

    // Parse duels for current season (2026/27)
    const currExtracted = parsePlayerDuelsFromHtml(htmlCurr, playerId, '2026/27');
    let allSingles = [...currExtracted.singles];
    let allDoubles = [...currExtracted.doubles];

    // If requested, fetch historical seasons (from 2025/26 down to 2018/19)
    if (shouldFetchAllSeasons) {
      const pastSeasons = ALL_SEASONS.filter(s => s.id !== 37);

      for (const s of pastSeasons) {
        try {
          const postData = 'url=' + encodeURIComponent(`${BASE_URL}/hrac/${playerId}`) +
                           '&season_id=' + s.id +
                           '&_request=%5CApp%5CRequests%5CFrontend%5CSeasonSet' +
                           '&_token=' + encodeURIComponent(token);

          const resSet = await fetch(`${BASE_URL}/`, {
            method: 'POST',
            headers: {
              ...DEFAULT_HEADERS,
              'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
              'X-Requested-With': 'XMLHttpRequest',
              'X-CSRF-TOKEN': token,
              'Origin': BASE_URL,
              'Referer': `${BASE_URL}/hrac/${playerId}`,
              'Cookie': cookie
            },
            body: postData
          });

          const setCookies2 = resSet.headers.getSetCookie ? resSet.headers.getSetCookie() : [resSet.headers.get('set-cookie')];
          if (setCookies2 && setCookies2.length > 0) {
            const newCookies = setCookies2.map(c => c ? c.split(';')[0] : '').filter(Boolean).join('; ');
            if (newCookies) cookie = `${cookie}; ${newCookies}`;
          }

          const resSeasonPlayer = await fetch(`${BASE_URL}/hrac/${playerId}`, {
            headers: { ...DEFAULT_HEADERS, 'Cookie': cookie }
          });

          if (resSeasonPlayer.ok) {
            const seasonHtml = await resSeasonPlayer.text();
            const seasonExtracted = parsePlayerDuelsFromHtml(seasonHtml, playerId, s.label);
            if (seasonExtracted.singles.length > 0) {
              allSingles.push(...seasonExtracted.singles);
            }
            if (seasonExtracted.doubles.length > 0) {
              allDoubles.push(...seasonExtracted.doubles);
            }
          }
        } catch (seasonErr) {
          console.warn(`Error fetching season ${s.label} for player ${playerId}:`, seasonErr.message);
        }
      }
    }

    // Detect player's club from match encounters
    let detectedClub = '';
    const allMatchesCombined = [...allSingles, ...allDoubles];
    if (allMatchesCombined.length > 0) {
      const allEncounterTeams = allMatchesCombined.map(m => m.teams.replace(/\s*\(\d+:\d+\)$/, '').split(/\s*-\s*/));
      if (allEncounterTeams.length > 0) {
        const firstPair = allEncounterTeams[0];
        for (const candidate of firstPair) {
          const trimmed = candidate.trim();
          if (trimmed && allEncounterTeams.every(pair => pair.some(p => p.trim().toLowerCase() === trimmed.toLowerCase()))) {
            detectedClub = trimmed;
            break;
          }
        }
      }
    }

    // Also look for club in club links
    const clubRegex = /<a[^>]*href="\/liga\/[^\/]+\/rozpis-muzstva\?club_id=(\d+)"[^>]*>(.*?)<\/a>/i;
    const clubMatch = htmlCurr.match(clubRegex);
    const clubName = detectedClub || (clubMatch ? clubMatch[2].replace(/<[^>]+>/g, '').trim() : '');
    const clubId = clubMatch ? clubMatch[1] : '';

    // Calculate career totals from allSingles (pure singles)
    const careerSinglesPlayed = allSingles.length;
    const careerSinglesWon = allSingles.filter(m => m.result === 'WIN').length;
    const careerSinglesLost = careerSinglesPlayed - careerSinglesWon;
    const careerSinglesWinRate = careerSinglesPlayed > 0 ? Math.round((careerSinglesWon / careerSinglesPlayed) * 100) : 0;

    // Calculate career totals from allDoubles (pure doubles)
    const careerDoublesPlayed = allDoubles.length;
    const careerDoublesWon = allDoubles.filter(m => m.result === 'WIN').length;
    const careerDoublesLost = careerDoublesPlayed - careerDoublesWon;
    const careerDoublesWinRate = careerDoublesPlayed > 0 ? Math.round((careerDoublesWon / careerDoublesPlayed) * 100) : 0;

    const profile = {
      id: playerId,
      name,
      association,
      clubName,
      clubId,
      singles,
      doubles,
      singlesStats: shouldFetchAllSeasons ? {
        played: careerSinglesPlayed,
        won: careerSinglesWon,
        lost: careerSinglesLost,
        winRate: careerSinglesWinRate,
        home: singles.home,
        away: singles.away
      } : singles,
      doublesStats: shouldFetchAllSeasons ? {
        played: careerDoublesPlayed,
        won: careerDoublesWon,
        lost: careerDoublesLost,
        winRate: careerDoublesWinRate
      } : doubles,
      matches: allSingles, // Pure singles matches
      doublesMatches: allDoubles, // Pure doubles matches
      totalMatches: allSingles.length,
      totalDoublesMatches: allDoubles.length,
      syncedSeasonsCount: shouldFetchAllSeasons ? ALL_SEASONS.length : 1,
      isAllSeasons: shouldFetchAllSeasons,
      syncedAt: new Date().toISOString()
    };

    setInCache(cacheKey, profile);
    return profile;
  } catch (err) {
    console.error(`Error loading player ${playerId}:`, err.message);
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

    // If no standings rows were matched (e.g. before season starts), fallback to parsing any club links in the page
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

    // Also fetch league matches from rozpis
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

    // Match dropdown menus: <a ... class="...dropdown-toggle..."><span class="name">CATEGORY</span></a><div class="dropdown-menu...">(leagues)</div>
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
