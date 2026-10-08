import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const BASE_URL = 'https://www.stolnytenis.info';
const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'sk-SK,sk;q=0.9,cs;q=0.8,en-US;q=0.7,en;q=0.6'
};

const SEASONS = [
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

function parseSstzSet(setStr, playerWon) {
  const clean = setStr.trim();
  const lower = clean.toLowerCase();
  if (lower.includes('w') || lower.includes('scr') || lower.includes('skre') || lower.includes('kontum')) {
    return { playerPts: 0, opponentPts: 0, display: clean, won: playerWon, isWalkover: true };
  }
  if (clean.includes(':')) {
    const [p1, p2] = clean.split(':').map(n => parseInt(n.trim(), 10));
    const pts1 = isNaN(p1) ? 11 : p1;
    const pts2 = isNaN(p2) ? 9 : p2;
    return { playerPts: pts1, opponentPts: pts2, display: `${pts1}:${pts2}`, won: pts1 > pts2, isWalkover: false };
  }

  const sign = clean.startsWith('+') ? '+' : (clean.startsWith('-') ? '-' : (playerWon ? '+' : '-'));
  const num = parseInt(clean.replace(/[^0-9]/g, ''), 10);
  if (isNaN(num)) {
    return { playerPts: 0, opponentPts: 0, display: clean, won: playerWon, isWalkover: false };
  }

  if (sign === '+') {
    const oppPts = num;
    const myPts = num >= 10 ? num + 2 : 11;
    return { playerPts: myPts, opponentPts: oppPts, display: `${myPts}:${oppPts}`, won: true, isWalkover: false };
  } else {
    const myPts = num;
    const oppPts = num >= 10 ? num + 2 : 11;
    return { playerPts: myPts, opponentPts: oppPts, display: `${myPts}:${oppPts}`, won: false, isWalkover: false };
  }
}

function parsePlayerDuelsFromHtml(html, playerId, seasonLabel, tabLeagueName = '', tabTeamName = '') {
  const singlesMatches = [];
  const doublesMatches = [];

  const sectionRegex = /<section\s+id="tml2-(\d+)"[^>]*>([\s\S]*?)<\/section>/gi;
  let secMatch;

  while ((secMatch = sectionRegex.exec(html)) !== null) {
    const matchId = secMatch[1];
    const sectionHtml = secMatch[2];
    const secIndex = secMatch.index;

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
          const myTeam = isPlayerHome ? item1Players : item2Players;
          const oppTeam = isPlayerHome ? item2Players : item1Players;
          const partner = myTeam.find(p => p.id !== playerId) || { id: '', name: 'Neznámy spoluhráč' };

          const setDetails = [];
          let totalPtsWon = 0;
          let totalPtsLost = 0;

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
            isPlayerHome
          });
        } else {
          const p1 = item1Players[0];
          const p2 = item2Players[0];
          const opp = isPlayerHome ? p2 : p1;

          if (opp) {
            const setDetails = [];
            let totalPtsWon = 0;
            let totalPtsLost = 0;

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
              isPlayerHome
            });
          }
        }
      }
    }
  }

  return { singles: singlesMatches, doubles: doublesMatches };
}

export async function fetchFullPlayerProfile(playerId) {
  let allSingles = [];
  let allDoubles = [];
  let playerName = '';
  let primaryClub = '';
  let primaryClubId = '';
  let association = 'SSTZ';
  let seasonsBreakdown = [];

  const seenIds = new Set();

  for (const season of SEASONS) {
    const resSeason = await fetch(`${BASE_URL}/sezona/${season.slug}/svk`, {
      headers: DEFAULT_HEADERS,
      redirect: 'manual'
    });
    const cookies = resSeason.headers.getSetCookie ? resSeason.headers.getSetCookie() : [resSeason.headers.get('set-cookie')];
    const cookieHeader = cookies.map(c => c ? c.split(';')[0] : '').filter(Boolean).join('; ');

    const resPlayer = await fetch(`${BASE_URL}/hrac/${playerId}`, {
      headers: { ...DEFAULT_HEADERS, 'Cookie': cookieHeader }
    });
    if (!resPlayer.ok) continue;

    const html = await resPlayer.text();
    if (!playerName) {
      const titleMatch = html.match(/<title>([^|]+)\|/);
      if (titleMatch) playerName = titleMatch[1].trim();
    }

    const clubRegex = /<a[^>]*href="\/liga\/[^\/]+\/rozpis-muzstva\?club_id=(\d+)"[^>]*>(.*?)<\/a>/i;
    const clubMatch = html.match(clubRegex);
    if (!primaryClubId && clubMatch) {
      primaryClubId = clubMatch[1];
      if (!primaryClub) primaryClub = clubMatch[2].replace(/<[^>]+>/g, '').trim();
    }

    const tabRegex = /<div class="swiper-slide w-auto tabs2__nav__item[^"]*">([\s\S]*?)<\/div>/gi;
    const tabMatches = [...html.matchAll(tabRegex)];

    let seasonSingles = 0;
    let seasonDoubles = 0;
    let seasonSinglesWon = 0;
    let seasonDoublesWon = 0;
    let seasonLeagues = new Set();

    if (tabMatches.length === 0) {
      const duels = parsePlayerDuelsFromHtml(html, playerId, season.label, '', '');
      for (const m of duels.singles) {
        if (!seenIds.has(m.id)) {
          seenIds.add(m.id);
          allSingles.push(m);
          seasonSingles++;
          if (m.result === 'WIN') seasonSinglesWon++;
        }
      }
      for (const m of duels.doubles) {
        if (!seenIds.has(m.id)) {
          seenIds.add(m.id);
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
          const resTab = await fetch(url, {
            headers: { ...DEFAULT_HEADERS, 'Cookie': cookieHeader }
          });
          if (resTab.ok) tabHtml = await resTab.text();
        }

        const duels = parsePlayerDuelsFromHtml(tabHtml, playerId, season.label, league, team);
        for (const m of duels.singles) {
          if (!seenIds.has(m.id)) {
            seenIds.add(m.id);
            allSingles.push(m);
            seasonSingles++;
            if (m.result === 'WIN') seasonSinglesWon++;
          }
        }
        for (const m of duels.doubles) {
          if (!seenIds.has(m.id)) {
            seenIds.add(m.id);
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

  const careerSinglesPlayed = allSingles.length;
  const careerSinglesWon = allSingles.filter(m => m.result === 'WIN').length;
  const careerSinglesLost = careerSinglesPlayed - careerSinglesWon;
  const careerSinglesWinRate = careerSinglesPlayed > 0 ? Math.round((careerSinglesWon / careerSinglesPlayed) * 100) : 0;

  const careerDoublesPlayed = allDoubles.length;
  const careerDoublesWon = allDoubles.filter(m => m.result === 'WIN').length;
  const careerDoublesLost = careerDoublesPlayed - careerDoublesWon;
  const careerDoublesWinRate = careerDoublesPlayed > 0 ? Math.round((careerDoublesWon / careerDoublesPlayed) * 100) : 0;

  return {
    id: playerId,
    name: playerName || `Hráč #${playerId}`,
    association,
    clubName: primaryClub,
    clubId: primaryClubId,
    singlesStats: {
      played: careerSinglesPlayed,
      won: careerSinglesWon,
      lost: careerSinglesLost,
      winRate: careerSinglesWinRate
    },
    doublesStats: {
      played: careerDoublesPlayed,
      won: careerDoublesWon,
      lost: careerDoublesLost,
      winRate: careerDoublesWinRate
    },
    matches: allSingles,
    doublesMatches: allDoubles,
    totalMatches: allSingles.length,
    totalDoublesMatches: allDoubles.length,
    isAllSeasons: true,
    syncedSeasonsCount: seasonsBreakdown.length,
    seasonsBreakdown,
    source: 'SSTZ',
    syncedAt: new Date().toISOString()
  };
}

// Generate snapshot for 5353024
console.log('Generating authentic snapshot for 5353024...');
const profile = await fetchFullPlayerProfile('5353024');
fs.mkdirSync('./data/sstz', { recursive: true });
fs.writeFileSync('./data/sstz/5353024.json', JSON.stringify(profile, null, 2), 'utf-8');
console.log(`Saved snapshot: ${profile.matches.length} singles, ${profile.doublesMatches.length} doubles to data/sstz/5353024.json!`);
