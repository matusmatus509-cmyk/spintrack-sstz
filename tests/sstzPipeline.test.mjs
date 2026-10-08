import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseSstzSet, parsePlayerDuelsFromHtml } from '../server/sstzScraper.js';
import { loadSnapshot, listSnapshots } from '../server/sstzStore.js';

describe('SSTZ Set Parser (Strict Truth & No Fabrication)', () => {
  test('parses winning standard set (+5 -> 11:5)', () => {
    const parsed = parseSstzSet('+5', true);
    assert.equal(parsed.playerPts, 11);
    assert.equal(parsed.opponentPts, 5);
    assert.equal(parsed.display, '11:5');
    assert.equal(parsed.won, true);
    assert.equal(parsed.isWalkover, false);
  });

  test('parses losing standard set (-8 -> 8:11)', () => {
    const parsed = parseSstzSet('-8', false);
    assert.equal(parsed.playerPts, 8);
    assert.equal(parsed.opponentPts, 11);
    assert.equal(parsed.display, '8:11');
    assert.equal(parsed.won, false);
    assert.equal(parsed.isWalkover, false);
  });

  test('parses winning overtime set (+11 -> 13:11)', () => {
    const parsed = parseSstzSet('+11', true);
    assert.equal(parsed.playerPts, 13);
    assert.equal(parsed.opponentPts, 11);
    assert.equal(parsed.display, '13:11');
    assert.equal(parsed.won, true);
  });

  test('parses losing overtime set (-10 -> 10:12)', () => {
    const parsed = parseSstzSet('-10', false);
    assert.equal(parsed.playerPts, 10);
    assert.equal(parsed.opponentPts, 12);
    assert.equal(parsed.display, '10:12');
    assert.equal(parsed.won, false);
  });

  test('handles walkovers without fabricating points (w:0, scr)', () => {
    const wo = parseSstzSet('w:0', false);
    assert.equal(wo.isWalkover, true);
    assert.equal(wo.playerPts, 0);
    assert.equal(wo.opponentPts, 0);

    const scr = parseSstzSet('scr.', true);
    assert.equal(scr.isWalkover, true);
    assert.equal(scr.playerPts, 0);
    assert.equal(scr.opponentPts, 0);
  });
});

describe('SSTZ Snapshot Store', () => {
  test('loads authentic snapshot for player 5353024', () => {
    const snapshot = loadSnapshot('5353024');
    assert.ok(snapshot, 'Snapshot 5353024 must exist');
    assert.equal(snapshot.id, '5353024');
    assert.equal(snapshot.name, 'Očovan Matúš');
    assert.ok(snapshot.matches.length > 0, 'Must have singles matches');
    assert.ok(snapshot.doublesMatches.length > 0, 'Must have doubles matches');
    assert.equal(snapshot.totalMatches + snapshot.totalDoublesMatches, 405);
    assert.equal(snapshot.isAllSeasons, true);
    assert.ok(snapshot.seasonsBreakdown.length >= 5, 'Must have at least 5 seasons');
  });

  test('lists snapshots including player 5353024', () => {
    const list = listSnapshots();
    assert.ok(Array.isArray(list));
    const found = list.find(s => s.id === '5353024');
    assert.ok(found, 'Player 5353024 must be listed');
    assert.equal(found.name, 'Očovan Matúš');
  });
});

describe('SSTZ Duels Protocol Parser', () => {
  test('correctly parses home/away player, scores, and sets', () => {
    const sampleHtml = `
      <div class="media-body">
        <h4 class="text-white m-0">Základná časť</h4>
        <h4 class="text-white m-0">1. kolo / 18.09.2026</h4>
        <p class="m-0">ŠKST B. Štiavnica - MŠK Žiar nad Hronom A (11:7)</p>
      </div>
      <section id="tml2-164138" class="tml2">
        <div class="tml2-block tml2-block-danger">
          <div class="tml2-score tml2-score-lost"><span>11:6</span></div>
          <div class="tml2-content border-danger tml2-content-lost">
            <div class="tml2__match text-desc">
              <div class="tml2__match__item fw-bold">
                <div class="tml2__match__player"><a href="/hrac/1214"><span>Coplák Peter</span></a></div>
                <div class="tml2__match__score"><span>3</span></div>
                <div class="tml2__match__info">B-Z<span class="tml2__match__sets"><div class="tml2__match__set tml2__match__set-win">+5</div><div class="tml2__match__set tml2__match__set-win">+9</div><div class="tml2__match__set tml2__match__set-win">+7</div></span></div>
              </div>
              <div class="tml2__match__item">
                <div class="tml2__match__player"><a href="/hrac/5353024"><span>Očovan Matúš</span></a></div>
                <div class="tml2__match__score"><span>0</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>
    `;

    const parsed = parsePlayerDuelsFromHtml(sampleHtml, '5353024', '2026/27', '3. liga', 'MŠK Žiar nad Hronom A');
    assert.equal(parsed.singles.length, 1);
    assert.equal(parsed.doubles.length, 0);

    const m = parsed.singles[0];
    assert.equal(m.opponentName, 'Coplák Peter');
    assert.equal(m.opponentId, '1214');
    assert.equal(m.result, 'LOSS');
    assert.equal(m.score, '0:3');
    assert.equal(m.leagueName, '3. liga');
    assert.equal(m.round, '1. kolo');
    assert.equal(m.date, '18.09.2026');
    assert.equal(m.isPlayerHome, false);
    assert.equal(m.setDetails.length, 3);
    assert.equal(m.setDetails[0].display, '5:11');
    assert.equal(m.setDetails[1].display, '9:11');
    assert.equal(m.setDetails[2].display, '7:11');
  });
});
