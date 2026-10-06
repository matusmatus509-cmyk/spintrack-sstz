/**
 * Test celého pipeline „stránka → profil" (bez siete), nad reálnymi stránkami:
 *  – dvojhry/štvorhry
 *  – oficiálne súhrny a overenie
 *  – poradie zápasov, väzby na klub/súťaž
 *  – jasné pravidlo: nič sa nedopĺňa, čo na stránke nie je
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  parsePlayerLines,
  composeProfile,
  SEASON_SLUGS,
  SEASON_SCOPE,
  seasonSlugToLabel,
  seasonLabelToSlug,
} from '../server/sstzScraper.js';
import { loadFixtureLines } from './helpers/markdownToLines.mjs';

const PLAYER_ID = '5723';

function buildPages() {
  const liga1 = parsePlayerLines(loadFixtureLines('hrac-5723-1liga-2026-27.txt'), PLAYER_ID);
  const liga2 = parsePlayerLines(loadFixtureLines('hrac-5723-2liga-2026-27.txt'), PLAYER_ID);
  return [
    { seasonLabel: '2026/27', seasonId: null, competition: liga1.competitions[0], page: liga1 },
    { seasonLabel: '2026/27', seasonId: null, competition: liga2.competitions[1], page: liga2 },
  ];
}

test('composeProfile: spojí dve súťaže jednej sezóny bez duplikátov', () => {
  const profile = composeProfile({
    playerId: PLAYER_ID,
    name: 'Lesňák Dominik',
    pages: buildPages(),
  });

  assert.equal(profile.id, PLAYER_ID);
  assert.equal(profile.matches.length, 15, '12 dvojhier z 2. ligy + 3 z 1. ligy');
  assert.equal(profile.doublesMatches.length, 3);
  assert.equal(profile.singlesStats.won, 12);
  assert.equal(profile.singlesStats.played, 15);
  assert.equal(profile.doublesStats.played, 3);
  assert.equal(profile.doublesStats.won, 3);
  assert.equal(profile.seasons.length, 1);
  assert.equal(profile.seasons[0].label, '2026/27');
  assert.equal(profile.seasons[0].matches, 18, 'všetky duely vrátane štvorhier');
});

test('composeProfile: overenie voči oficiálnym súhrnom má konkrétne kontroly', () => {
  const profile = composeProfile({ playerId: PLAYER_ID, name: 'Lesňák Dominik', pages: buildPages() });

  assert.equal(profile.verification.status, 'verified');
  assert.ok(profile.verification.seasons[0].checks.length >= 4);
  for (const check of profile.verification.seasons[0].checks) {
    assert.equal(check.ok, true, `kontrola zlyhala: ${check.name}`);
  }
});

test('každý duel má presnú väzbu na oficiálne údaje (žiadne dopočítané hodnoty)', () => {
  const profile = composeProfile({ playerId: PLAYER_ID, name: 'Lesňák Dominik', pages: buildPages() });

  for (const match of [...profile.matches, ...profile.doublesMatches]) {
    assert.ok(match.season, 'sezóna musí byť vyplnená');
    assert.ok(match.round, 'kolo musí byť vyplnené');
    assert.match(match.date, /^\d{1,2}\.\d{1,2}\.\d{4}$/, 'dátum musí byť z portálu');
    assert.ok(match.homeTeam && match.awayTeam, 'tímy musia byť z portálu');
    assert.match(match.result, /^(WIN|LOSS)$/);
    assert.ok(
      match.score === 'wo' || /^\d:\d$/.test(match.score),
      `skóre duelu má byť v tvare 3:1 alebo wo (má: ${match.score})`
    );
    for (const set of match.setDetails) {
      assert.match(set.officialValue, /^[+-]\d{1,3}$/, 'oficiálna hodnota setu musí byť zachovaná');
      assert.equal(set.derived, true);
      assert.ok(set.playerPoints >= 0 && set.opponentPoints >= 0);
      const winner = Math.max(set.playerPoints, set.opponentPoints);
      const loser = Math.min(set.playerPoints, set.opponentPoints);
      assert.ok(winner >= 11 && winner - loser >= 2, `neplatný set: ${set.display}`);
      assert.ok(
        winner === 11 ? loser <= 9 : winner === loser + 2,
        `set ${set.display} nezodpovedá pravidlám stolného tenisu`
      );
    }
    assert.equal(match.setDetails.length, match.sets.length, 'počet setov musí sedieť s oficiálnymi hodnotami');
  }
});

test('kontumácie (wo) sa neprezentujú ako odohrané sety', () => {
  const lines = loadFixtureLines('hrac-5723-2liga-2026-27.txt');
  const page = parsePlayerLines(lines, PLAYER_ID);
  // vo fixture nie je wo duel; overíme, že parser vie wo rozpoznať aspoň na syntetickom vstupe
  const synthetic = [
    { atoms: [], text: '3. kolo / 05.10.2026', links: [], nums: [], signed: [], attrs: [] },
    { atoms: [], text: 'A - B (10:8)', links: [], nums: [], signed: [], attrs: [] },
    {
      atoms: [
        { type: 'link', href: '/hrac/5723', text: 'Hráč Testovací' },
        { type: 'num', raw: '3', value: 3 },
      ],
      text: 'Hráč Testovací 3',
      links: [{ href: '/hrac/5723', text: 'Hráč Testovací' }],
      nums: [{ type: 'num', raw: '3', value: 3 }],
      signed: [],
      attrs: [],
    },
    { atoms: [], text: 'A-X', links: [], nums: [], signed: [], attrs: [] },
    { atoms: [], text: 'wo', links: [], nums: [], signed: [], attrs: [] },
    {
      atoms: [{ type: 'link', href: '/hrac/999', text: 'Súper Testovací' }],
      text: 'Súper Testovací',
      links: [{ href: '/hrac/999', text: 'Súper Testovací' }],
      nums: [],
      signed: [],
      attrs: [],
    },
  ];
  const parsed = parsePlayerLines(synthetic, PLAYER_ID);
  assert.equal(parsed.duels.length, 1);
  assert.equal(parsed.duels[0].walkover, true);
  assert.equal(parsed.duels[0].setDetails.length, 0, 'pri kontumácii sa žiadne sety nevymýšľajú');
  assert.equal(page.duels[0].walkover, false);
});

test('sezóny sa adresujú slugom (2025-26) a vypisujú ako 2025/26 – bez vymyslených ID', () => {
  assert.equal(seasonSlugToLabel('2025-26'), '2025/26');
  assert.equal(seasonLabelToSlug('2025/26'), '2025-26');
  assert.equal(seasonSlugToLabel('nezmysel'), null);
  assert.ok(SEASON_SLUGS.includes('2018-19') && SEASON_SLUGS.includes('2026-27'));
  assert.equal(SEASON_SCOPE, 'svk');
});

test('súťaž sa určí z reálneho tímu, za ktorý hráč nastúpil (nie z odhadu)', () => {
  const page = parsePlayerLines(loadFixtureLines('hrac-5723-2liga-2026-27.txt'), PLAYER_ID);
  const twoLigaTab = page.competitions.find((c) => /2\.\s*liga/i.test(c.label || ''));
  assert.ok(twoLigaTab, 'fixture musí obsahovať tab 2. ligy');

  const profile = composeProfile({
    playerId: PLAYER_ID,
    name: 'Lesňák Dominik',
    pages: [{ seasonLabel: '2026/27', seasonId: null, competition: twoLigaTab, page }],
  });

  const competitions = [...new Set(profile.matches.map((m) => m.competition))];
  assert.deepEqual(competitions, ['2. liga']);
  assert.equal(profile.matches[0].clubName, 'ŠKST Bratislava B');
  // žiadne varovanie o nesediacej súťaži
  assert.equal(profile.warnings.some((w) => w.includes('nesedí s tímom')), false);
});
