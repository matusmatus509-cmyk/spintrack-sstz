/**
 * Test nového „ligového" pipeline-u (bez siete): celá kariéra pre ľubovoľného
 * hráča cez deterministické routy portálu.
 *
 * Používa VERBATIM zachytené stránky portálu (fixtures) + jeden syntetický
 * protokol 1. ligy, aby sa dal overiť scenár „hráč hral v sezóne DVE ligy".
 *
 * Overuje sa:
 *  – nájdenie hráča vo všetkých ligách sezóny (indexy úspešnosti),
 *  – viac súťaží v jednej sezóne (2. liga + 1. liga) a žiadne duplicity,
 *  – presné sety z protokolov (vrátane preklopenia pri vonkajších zápasoch),
 *  – krížové overenie voči oficiálnym súhrnom ligy,
 *  – hráč, ktorý v lige nie je, sa nenačíta (falošné zápasy sa nevymýšľajú).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseLeagueNavLines,
  parseUspesnostLines,
  resolveIndexTeam,
  parseLeagueClubsLines,
  parseTeamScheduleLines,
  parseMatchProtocolLines,
  protocolDuelsForPlayer,
  syncPlayerCareer,
} from '../server/sstzScraper.js';
import { loadFixtureLines } from './helpers/markdownToLines.mjs';
import { createFixtureFetch, LEAGUE_FIXTURE_ROUTES_5723_2026_27 } from './helpers/fixtureFetch.mjs';

const PLAYER_ID = '5723';
const SEASON = '2026-27';

const FIXTURE_ROUTES = LEAGUE_FIXTURE_ROUTES_5723_2026_27;

function fixtureLines(name) {
  return loadFixtureLines(name);
}

/** Mock fetch – podáva fixtures podľa routy; všetko ostatné je prázdna stránka. */
function mockFetch() {
  return createFixtureFetch(FIXTURE_ROUTES);
}

test('parseLeagueNavLines: zo sezónnej stránky vytiahne všetky ligy sezóny', () => {
  const ba = parseLeagueNavLines(fixtureLines('sezona-2026-27-ba.txt'), SEASON);
  const svk = parseLeagueNavLines(fixtureLines('sezona-2026-27-svk.txt'), SEASON);

  assert.ok(ba.some((l) => l.slug === 'sezona-2026-27-2-liga-muzi-kstz-bratislava'));
  assert.equal(ba.length, 9, 'KSTZ Bratislava má v sezóne 9 líg (2. – 10.)');
  assert.ok(ba.every((l) => l.region === 'KSTZ Bratislava'));

  assert.ok(svk.some((l) => l.slug === 'sezona-2026-27-1-liga-zapad-muzi-sstz'));
  assert.ok(svk.every((l) => l.region === 'SSTZ'));

  // ligy z inej sezóny sa nesmú nachádzať
  assert.equal(ba.some((l) => !l.slug.startsWith(`sezona-${SEASON}-`)), false);
});

test('parseUspesnostLines: index jednotlivcov aj štvorhier (oficiálne čísla portálu)', () => {
  const singles = parseUspesnostLines(fixtureLines('uspesnost-2liga-2026-27.txt'), { kind: 'singles' });
  const doubles = parseUspesnostLines(fixtureLines('uspesnost-stvorhry-2liga-2026-27.txt'), { kind: 'doubles' });

  assert.equal(singles.length, 8);
  const lesnak = singles.find((r) => r.playerId === PLAYER_ID);
  assert.ok(lesnak, 'hráč 5723 musí byť v indexe 2. ligy');
  assert.equal(lesnak.played, 12);
  assert.equal(lesnak.won, 10);
  assert.equal(lesnak.lost, 2);
  assert.deepEqual(lesnak.sets, { won: 34, lost: 15 });
  assert.equal(lesnak.rawLinkText, 'Lesňák Dominik ŠKST Bratislava B');

  const dLesnak = doubles.find((r) => r.playerId === PLAYER_ID);
  assert.ok(dLesnak, 'hráč 5723 musí byť v indexe štvorhier');
  assert.equal(dLesnak.name, 'Lesňák Dominik');
  assert.equal(dLesnak.team, 'ŠKST Bratislava B');
  assert.deepEqual(dLesnak.sets, { won: 9, lost: 0 });

  // tím určený presne podľa tabuľky, meno bez názvu tímu
  const clubs = parseLeagueClubsLines(fixtureLines('tabulka-2liga-2026-27.txt'), 'sezona-2026-27-2-liga-muzi-kstz-bratislava');
  const resolved = resolveIndexTeam(lesnak, clubs.map((c) => c.clubName));
  assert.equal(resolved.team, 'ŠKST Bratislava B');
  assert.equal(resolved.name, 'Lesňák Dominik');
});

test('parseTeamScheduleLines: rozpis družstva deduplikuje a označí odohrané zápasy', () => {
  const list = parseTeamScheduleLines(fixtureLines('rozpis-muzstva-skst-b-2026-27.txt'));
  const ids = list.map((m) => m.id);
  assert.deepEqual(ids, ['161962', '161971', '161975', '161982', '161988'], '5 unikátnych zápasov (duplikáty prehliada)');

  const first = list.find((m) => m.id === '161962');
  assert.equal(first.round, '1. kolo');
  assert.equal(first.dateTime, '24.9.2026');
  assert.equal(first.homeTeam, 'ŠKST Bratislava B');
  assert.equal(first.awayTeam, 'Spoje A');
  assert.equal(first.homeScore, '13');
  assert.equal(first.awayScore, '5');
  assert.equal(first.isPlayed, true);

  const away = list.find((m) => m.id === '161975');
  assert.equal(away.homeTeam, 'Malacky A');
  assert.equal(away.awayTeam, 'ŠKST Bratislava B');
  assert.equal(away.homeScore, '5');
  assert.equal(away.awayScore, '13');
});

test('parseMatchProtocolLines: protokol obsahuje hlavičku a všetky duely (bez duplikátov z „Priebehu")', () => {
  const { header, duels } = parseMatchProtocolLines(fixtureLines('zapas-161975.txt'), '161975');
  assert.equal(header.season, '2026/27');
  assert.equal(header.round, '3. kolo');
  assert.equal(header.date, '05.10.2026');
  assert.equal(header.homeTeam, 'Malacky A');
  assert.equal(header.awayTeam, 'ŠKST Bratislava B');
  assert.equal(header.league, '2. Liga');
  assert.equal(header.association, 'KSTZ Bratislava');
  assert.equal(duels.length, 18, 'protokol má 18 duelov (2 štvorhry + 16 dvojhier)');

  const first = duels[0];
  assert.equal(first.type, 'doubles');
  assert.deepEqual(first.homePlayers.map((p) => p.id), ['7306429', '2370573']);
  assert.deepEqual(first.awayPlayers.map((p) => p.id), [PLAYER_ID, '11093']);
  assert.deepEqual(first.officialSetsHome, ['-14', '-7', '-6']);
  assert.equal(first.homeSetsWon, 0);
  assert.equal(first.awaySetsWon, 3);
});

test('protocolDuelsForPlayer: vonkajší hráč dostane sety preklopené na svoju stranu', () => {
  const protocol = parseMatchProtocolLines(fixtureLines('zapas-161975.txt'), '161975');
  const duels = protocolDuelsForPlayer(protocol, PLAYER_ID);
  assert.equal(duels.length, 5, 'hráč 5723 hral v zápase 5 duelov (štvorhra + 4 dvojhry)');

  const doubles = duels.find((d) => d.type === 'doubles');
  assert.equal(doubles.playerIsHome, false);
  assert.deepEqual(doubles.officialSets, ['+14', '+7', '+6']);
  assert.equal(doubles.playerSetsWon, 3);
  assert.equal(doubles.opponentSetsWon, 0);
  assert.equal(doubles.partner.id, '11093');
  assert.deepEqual(doubles.opponents.map((o) => o.id), ['7306429', '2370573']);

  const bx = duels.find((d) => d.duelCode === 'B-X');
  assert.deepEqual(bx.officialSets, ['+13', '-9', '+5', '+3']);
  assert.equal(bx.playerSetsWon, 3);
  assert.equal(bx.opponentSetsWon, 1);
});

test('syncPlayerCareer: všetky ligy sezóny, všetky zápasy, overené voči oficiálnym súhrnom', async () => {
  process.env.SSTZ_NO_CACHE = '1';
  const { impl, calls } = mockFetch();

  const profile = await syncPlayerCareer(PLAYER_ID, {
    seasonSlugs: [SEASON],
    fetchImpl: impl,
    useCache: false,
  });

  assert.equal(profile.id, PLAYER_ID);
  assert.equal(profile.name, 'Lesňák Dominik');
  assert.equal(profile.seasons.length, 1);
  assert.equal(profile.seasons[0].label, '2026/27');
  assert.equal(profile.seasons[0].competitions.length, 2, 'hráč hral v sezóne DVE ligy');

  // 12 dvojhier z 2. ligy + 3 z 1. ligy
  assert.equal(profile.matches.length, 15);
  assert.equal(profile.singlesStats.played, 15);
  assert.equal(profile.singlesStats.won, 12);
  assert.equal(profile.doublesStats.played, 3);
  assert.equal(profile.doublesStats.won, 3);

  // zápasy majú väzbu na oficiálny protokol
  for (const m of profile.matches) {
    assert.match(m.id, /^z\d+-\d+-/);
    assert.ok(m.sstzMatchId, 'každý duel vie, z ktorého zápasu pochádza');
    assert.equal(m.season, '2026/27');
    assert.match(m.date, /^\d{1,2}\.\d{1,2}\.\d{4}$/);
    assert.ok(m.homeTeam && m.awayTeam);
    assert.match(m.result, /^(WIN|LOSS)$/);
  }
  assert.ok(profile.matches.some((m) => m.competition === '2. liga, Muži' || /2\. liga/i.test(m.competition)));
  assert.ok(profile.matches.some((m) => /1\.liga - Západ/i.test(m.competition)));

  // vonkajší zápas (Malacky) – hráč nie je doma
  const awayDuel = profile.matches.find((m) => m.duelLabel === 'B-X' && m.awayTeam === 'ŠKST Bratislava B');
  assert.ok(awayDuel, 'duel B-X z vonkajšieho zápasu musí byť v zozname');
  assert.equal(awayDuel.playerIsHome, false);
  assert.deepEqual(awayDuel.sets, ['+13', '-9', '+5', '+3']);

  // overenie voči oficiálnym ligovým súhrnom musí prejsť
  assert.equal(profile.verification.status, 'verified', JSON.stringify(profile.verification, null, 1));
  assert.equal(profile.warnings.length, 0, JSON.stringify(profile.warnings, null, 1));

  // ligy bez hráča sa neťahajú ďalej (tabuľka/rozpis len pre zásahy)
  assert.equal(calls.some((c) => c.includes('3-liga-muzi-kstz-bratislava/tabulka')), false);
  assert.equal(calls.some((c) => c.includes('3-liga-muzi-kstz-bratislava/rozpis')), false);
});

test('syncPlayerCareer: hráč, ktorý v lige nie je, nedostane vymyslené zápasy', async () => {
  process.env.SSTZ_NO_CACHE = '1';
  const { impl } = mockFetch();

  const profile = await syncPlayerCareer('999999', {
    seasonSlugs: [SEASON],
    fetchImpl: impl,
    useCache: false,
  });

  assert.equal(profile.matches.length, 0);
  assert.equal(profile.doublesMatches.length, 0);
  assert.ok(profile.warnings.some((w) => /nenašli žiadne zápasy/i.test(w)));
});

test('syncPlayerCareer: budúce kolá (0:0 bez protokolov) nepridávajú zápasy', async () => {
  process.env.SSTZ_NO_CACHE = '1';
  const { impl } = mockFetch();

  const profile = await syncPlayerCareer(PLAYER_ID, {
    seasonSlugs: [SEASON],
    fetchImpl: impl,
    useCache: false,
  });

  const ids = profile.matches.map((m) => m.sstzMatchId);
  assert.equal(ids.includes('161982'), false, 'budúci zápas nesmie byť vo výsledkoch');
  assert.equal(ids.includes('161988'), false);
});
