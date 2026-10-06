/**
 * Testy parsera nad REÁLNYMI zachytenými stránkami stolnytenis.info.
 *
 * Fixture `hrac-5723-2liga-2026-27.txt` je presný text profilu hráča
 * (https://www.stolnytenis.info/hrac/5723?s=789) zo dňa 6. 10. 2026.
 * Oficiálne súhrny na stránke vtedy uvádzali:
 *   Dvojhry: Celkom 10 z 12 (Doma 6 z 8, Vonku 4 z 4)
 *   Štvorhry: Celkom 3 z 3
 * Presne to musí parser z duelu vysčítať – inak je niečo zle.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parsePlayerLines, verifyPlayerSeason, setValueToDetail, htmlToAtoms, atomsToLines } from '../server/sstzScraper.js';
import { loadFixtureLines } from './helpers/markdownToLines.mjs';

const PLAYER_ID = '5723';

test('2. liga 2026/27 – parser nájde všetkých 12 dvojhier a 3 štvorhry', () => {
  const lines = loadFixtureLines('hrac-5723-2liga-2026-27.txt');
  const page = parsePlayerLines(lines, PLAYER_ID);

  assert.equal(page.seasonLabel, '2026/27');
  assert.equal(page.name, 'Lesňák Dominik');

  const singles = page.duels.filter((d) => d.type === 'singles');
  const doubles = page.duels.filter((d) => d.type === 'doubles');

  assert.equal(singles.length, 12, 'počet dvojhier musí sedieť s oficiálnou štatistikou (12)');
  assert.equal(doubles.length, 3, 'počet štvorhier musí sedieť s oficiálnou štatistikou (3)');

  // oficiálne súhrny zo stránky
  assert.deepEqual(page.stats.singles.played, 12);
  assert.deepEqual(page.stats.singles.won, 10);
  assert.deepEqual(page.stats.singles.home, { won: 6, played: 8 });
  assert.deepEqual(page.stats.singles.away, { won: 4, played: 4 });
  assert.deepEqual(page.stats.doubles.played, 3);
  assert.deepEqual(page.stats.doubles.won, 3);
});

test('2. liga 2026/27 – výsledky duelu sedia na oficiálnu úspešnosť (overenie bez vymýšľania)', () => {
  const lines = loadFixtureLines('hrac-5723-2liga-2026-27.txt');
  const page = parsePlayerLines(lines, PLAYER_ID);

  const verification = verifyPlayerSeason(page.duels, page.stats, {});
  assert.equal(verification.verified, true, JSON.stringify(verification.checks, null, 2));
  assert.equal(verification.aggregate.singles.won, 10);
  assert.equal(verification.aggregate.singles.played, 12);
  assert.equal(verification.aggregate.doubles.won, 3);
  assert.equal(verification.aggregate.sets.won, 34, 'sety: 34 vyhraných (oficiálne Sety 34:15)');
  assert.equal(verification.aggregate.sets.lost, 15);
});

test('sety sú z pohľadu hráča aj keď hral vonku (3. kolo, Malacky A – ŠKST Bratislava B)', () => {
  const lines = loadFixtureLines('hrac-5723-2liga-2026-27.txt');
  const page = parsePlayerLines(lines, PLAYER_ID);

  const duel = page.duels.find((d) => d.round === '3. kolo' && d.label === 'B-X');
  assert.ok(duel, 'duel B-X z 3. kola musí existovať');
  assert.equal(duel.teams.homeTeam, 'Malacky A');
  assert.equal(duel.teams.awayTeam, 'ŠKST Bratislava B');
  assert.equal(duel.playerIsFirstSide, false, 'hráč hral vonku');
  assert.equal(duel.opponentSetsWon, 1);
  assert.equal(duel.playerSetsWon, 3);
  // na webe je uvedené -13, +9, -5, -3 (z pohľadu domácich) → z pohľadu hráča +13, -9, +5, +3
  assert.deepEqual(duel.officialSets, ['+13', '-9', '+5', '+3']);
  assert.deepEqual(duel.officialSetsHome, ['-13', '+9', '-5', '-3']);
  // „+13" znamená, že prehrávajúci získal 13 bodov → set skončil 15:13
  assert.deepEqual(
    duel.setDetails.map((s) => s.display),
    ['15:13', '9:11', '11:5', '11:3']
  );
});

test('set detail: oficiálna hodnota + odvodené skóre a príznak derived', () => {
  assert.deepEqual(setValueToDetail('+9', 1), {
    setNumber: 1,
    playerPoints: 11,
    opponentPoints: 9,
    display: '11:9',
    won: true,
    officialValue: '+9',
    derived: true,
  });
  assert.deepEqual(setValueToDetail('-10', 2), {
    setNumber: 2,
    playerPoints: 10,
    opponentPoints: 12,
    display: '10:12',
    won: false,
    officialValue: '-10',
    derived: true,
  });
  // dlhší set: prehrávajúci získal 14 bodov → 16:14 (web zobrazuje „-14")
  assert.deepEqual(setValueToDetail('-14', 3), {
    setNumber: 3,
    playerPoints: 14,
    opponentPoints: 16,
    display: '14:16',
    won: false,
    officialValue: '-14',
    derived: true,
  });
  assert.equal(setValueToDetail('', 1), null);
});

test('1. liga 2026/27 – 3 dvojhry, 2 výhry (oficiálne „Celkom 2 z 3")', () => {
  const lines = loadFixtureLines('hrac-5723-1liga-2026-27.txt');
  const page = parsePlayerLines(lines, PLAYER_ID);

  const singles = page.duels.filter((d) => d.type === 'singles');
  assert.equal(singles.length, 3);
  assert.equal(singles.filter((d) => d.playerSetsWon > d.opponentSetsWon).length, 2);

  const verification = verifyPlayerSeason(page.duels, page.stats, {});
  assert.equal(verification.verified, true, JSON.stringify(verification.checks, null, 2));

  // zápas A-U: oficiálne „+18" znamená, že prehrávajúci získal 18 bodov → 20:18
  const au = singles.find((d) => d.label === 'A-U');
  assert.deepEqual(au.setDetails.map((s) => s.display), ['20:18', '11:9', '3:11', '11:8']);
  assert.equal(au.setDetails[0].officialValue, '+18');
  assert.equal(au.setDetails[0].derived, true);
});

test('HTML → atómy: odkazy, čísla a znamienka sa rozpoznajú (tokenizer)', () => {
  const html = `
    <div class="tml2-block tml2-block-success">
      <div class="tml2__match__item">
        <a href="/hrac/5723">Lesňák Dominik</a>
        <div class="tml2__match__score"><span>3</span></div>
      </div>
      <div class="tml2__match__label">A-X</div>
      <div class="tml2__match__set tml2__match__set-win">+4</div>
      <div class="tml2__match__set">-10</div>
      <div class="tml2__match__item">
        <a href="/hrac/479810">Foltin Filip</a>
        <div class="tml2__match__score"><span>1</span></div>
      </div>
    </div>`;
  const lines = atomsToLines(htmlToAtoms(html));
  const flatText = lines.map((l) => l.text).join(' | ');
  assert.match(flatText, /Lesňák Dominik/);
  assert.match(flatText, /Foltin Filip/);
  assert.ok(lines.some((l) => l.signed.map((s) => s.raw).includes('+4')));
  assert.ok(lines.some((l) => l.signed.map((s) => s.raw).includes('-10')));
  assert.ok(lines.some((l) => l.links.some((k) => k.href === '/hrac/5723')));
});

test('parser ignoruje duely iných hráčov', () => {
  const lines = loadFixtureLines('hrac-5723-2liga-2026-27.txt');
  const page = parsePlayerLines(lines, '999999');
  assert.equal(page.duels.length, 0);
});
