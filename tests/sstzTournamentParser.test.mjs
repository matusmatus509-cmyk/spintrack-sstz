import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTournamentPage, getSstzTournamentProfile } from '../server/sstzTournaments.js';
import { parseTournamentImport } from '../src/utils/tournamentImport.ts';

// Synthetic protocol cards with the same structure as SSTZ tournament records.
const heading = '<h4>Test tournament - 07.03.2026</h4>';
const card = (score, outcome = 'success', category = 'Jednotlivci', partner = '') => `
<div class="mb-3 border-bottom"><div class="gridc gridc-trn pb-3">
  <div class="gridc__c1"><span class="g3__value">${category}</span>${partner ? `<br/><span class="fs small text-muted">${partner}</span>` : ''}</div>
  <div class="gridc__c2"><span class="g3__value">Test opponent<br/><span class="fs small text-muted">Test club</span></span></div>
  <div class="gridc__c3"><span class="g3__value">QF</span></div>
  <div class="gridc__c4"><span class="fw-bold text-${outcome}">${score}</span></div>
</div></div>`;

test('imports official WO and retirement notation without inventing set points', () => {
  for (const score of ['3 : 0 wo.', '3:0 wo', '3:0 (W.O.)', '0:3 W/O', 'WO', 'w:0', '0:w', '0:2 scr.', '2:1 ret.']) {
    const outcome = score.startsWith('0') ? 'danger' : 'success';
    const [match] = parseTournamentPage(heading + card(score, outcome), '42');
    assert.equal(match.score, score.replace(/\s*:\s*/g, ':'), score);
    assert.equal(match.result, outcome === 'success' ? 'WIN' : 'LOSS', score);
    assert.equal(match.isWalkover, true, score);
    assert.deepEqual(match.sets, [], score);
    assert.equal(match.totalPointsWon, undefined, score);
  }
  const [regular] = parseTournamentPage(heading + card('3 : 2'), '42');
  assert.equal(regular.score, '3:2');
  assert.equal(regular.isWalkover, false);
});

test('an unknown or empty result still prevents a falsely complete import', () => {
  for (const score of ['', '3:0 pending', '?', 'wo 3:?']) {
    assert.throws(() => parseTournamentPage(heading + card(score), '42'), /výsledok/);
  }
});

test('complete paginated history survives WO records and unpublished doubles partners', async t => {
  const id = '991020';
  const config = {
    fetchUrl: `/hraci/${id}/turnaje`, name: 'player_tournament', fetchMethod: 'POST',
    fetchData: { _request: 'App\\Requests\\Frontend\\PlayerTournamentFilterRequest', iid: id },
    pagination: { page: 1, perPage: 2, firstPagePerPage: 2, strategy: 'loadMore' }
  };
  const pages = [];
  t.mock.method(globalThis, 'fetch', async (url, options = {}) => {
    if (!options.method) return new Response(`<title>Test Player | SSTZ</title><div data-provider="ajaxContent" data-config="${JSON.stringify(config).replaceAll('"', '&quot;')}"></div>`);
    const page = Number(options.body.get('pagination[page]'));
    pages.push(page);
    return Response.json({
      content: heading + (page === 1 ? card('3:0 wo.') + card('1:3', 'danger', 'Zmiešaná štvorhra') : card('3:2', 'success', 'Štvorhra', 'Test partner')),
      paginator: { total: 3, pageCurrent: page, pageNext: page === 1 ? 2 : null }
    });
  });
  const payload = await getSstzTournamentProfile(id);
  const imported = parseTournamentImport(payload, id);
  assert.deepEqual(pages, [1, 2]);
  assert.equal(imported.profile.complete, true);
  assert.equal(imported.matches.length + imported.doublesMatches.length, 3);
  assert.equal(imported.matches[0].isWalkover, true);
  assert.equal(imported.doublesMatches[0].partnerName, '');
  assert.equal(imported.doublesMatches[1].partnerName, 'Test partner');
  assert.equal(imported.doublesMatches[0].opponentPair, 'Test opponent');
});
