import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAvailableSeasons, parsePlayerTabs, parsePlayerDuelsFromHtml, assertCompleteDuels, getPlayerProfile } from '../server/sstzScraper.js';

const archive = `<a onclick="Gss.setSeason(40)">2029/30</a><a onclick="Gss.setSeason(10)">2017/18</a>`;
const tab = (id, league, selection = '') => `<div class="other tabs2__nav__item"><a href="/hrac/${id}${selection}" class="active tabs2__nav__link"><span class="fw-bold d-block">${league}</span><span class="d-block">Team</span></a></div>`;
const duel = (id, encounter, opponent = '123') => `
<div class="media-body"><h4>Základná časť</h4><h4>1. kolo / 18.09.2029</h4><p class="m-0">Team A - Team B</p></div>
<section id="tml2-${encounter}"><div class="tml2-block tml2-block-success">
<div class="tml2__match__item"><div class="tml2__match__player"><a href="/hrac/${id}">Player</a></div><div class="tml2__match__score"><span>3</span></div></div>
<div class="tml2__match__item"><div class="tml2__match__player"><a href="/hrac/${opponent}">Opponent</a></div><div class="tml2__match__score"><span>0</span></div></div>
</div></section>`;
const totals = count => `<h4>Úspešnosť - Dvojhry</h4><h4>Celkom ${count} z ${count}</h4><h4>Úspešnosť - Štvorhry</h4><h4>Celkom 0 z 0</h4>`;

test('discovers archive years outside the former hardcoded range', () => {
  assert.deepEqual(parseAvailableSeasons(archive).map(s => s.slug), ['2029-30', '2017-18']);
});
test('discovers every league/team tab despite changed class order and active links', () => {
  const tabs = parsePlayerTabs(tab('42','League A') + tab('42','League B','?s=2') + tab('42','Play-off','?s=3'), '42');
  assert.equal(tabs.length, 3);
  assert.deepEqual(tabs.map(t => t.league), ['League A','League B','Play-off']);
});
test('does not import another player’s singles or doubles', () => {
  const parsed = parsePlayerDuelsFromHtml(duel('42',1), '99');
  assert.deepEqual(parsed, { singles: [], doubles: [] });
});
test('detects missing matches across stages instead of silently claiming completeness', () => {
  assert.throws(() => assertCompleteDuels(totals(1) + duel('42',1) + totals(2), {singles:[{}],doubles:[]}), /Neúplný import/);
});
test('career sync visits every season and concurrent league, keeps stages, deduplicates encounters', async t => {
  const id = '991001';
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (input, opts = {}) => {
    const url = new URL(input); calls.push(url.href);
    if (url.pathname.startsWith('/sezona/')) {
      return new Response('season', {headers:{'set-cookie':`season=${url.pathname.split('/')[2]}; Path=/`}});
    }
    if (!opts.headers?.Cookie) return new Response(archive);
    const old = opts.headers.Cookie.includes('2017-18');
    if (old) return new Response(totals(1) + duel(id, 4));
    const tabs = tab(id,'League A') + tab(id,'League B','?s=2') + tab(id,'Play-off','?s=3');
    const encounter = Number(url.searchParams.get('s') || 1);
    // A duplicate tab is also returned by SSTZ, but cannot duplicate its matches.
    return new Response(tabs + totals(1) + duel(id, encounter));
  });
  const profile = await getPlayerProfile(id,{persist:false});
  assert.equal(profile.isAllSeasons,true);
  assert.equal(profile.totalMatches,4);
  assert.equal(profile.syncedSeasonsCount,2);
  assert.deepEqual(profile.seasonsBreakdown[0].leagues,['League A','League B','Play-off']);
  assert.equal(profile.seasonsBreakdown[1].season,'2017/18');
  assert.ok(calls.some(url=>url.endsWith('?s=2')));
  assert.ok(calls.some(url=>url.endsWith('?s=3')));
});
test('a failed secondary league fails the sync, without returning a partial career', async t => {
  const id='991002';
  t.mock.method(globalThis,'fetch',async (input,opts={}) => {
    const url=new URL(input);
    if(url.pathname.startsWith('/sezona/')) return new Response('',{headers:{'set-cookie':'season=current; Path=/'}});
    if(!opts.headers?.Cookie) return new Response(archive);
    if(url.search) return new Response('unavailable',{status:503});
    return new Response(tab(id,'League A')+tab(id,'League B','?s=2')+totals(1)+duel(id,1));
  });
  await assert.rejects(getPlayerProfile(id,{persist:false}), /HTTP 503/);
});
test('keeps protocol walkovers even when official success totals exclude them', () => {
  const html=totals(0)+duel('42',1).replace('tml2__match__item', 'tml2__match__item tml2__match__is-wo');
  const duels=parsePlayerDuelsFromHtml(html,'42');
  assert.equal(duels.singles.length,1);
  assert.equal(duels.singles[0].isWalkover,true);
  assert.doesNotThrow(()=>assertCompleteDuels(html,duels));
});
test('empty career imports work for players with no league participation', async t => {
  const id='991003';
  t.mock.method(globalThis,'fetch',async (input,opts={}) => {
    if(new URL(input).pathname.startsWith('/sezona/')) return new Response('',{headers:{'set-cookie':'season=current; Path=/'}});
    return new Response(opts.headers?.Cookie ? totals(0) : archive);
  });
  const profile=await getPlayerProfile(id,{persist:false});
  assert.equal(profile.id,id);
  assert.deepEqual(profile.matches,[]);
  assert.deepEqual(profile.doublesMatches,[]);
  assert.equal(profile.syncedSeasonsCount,2);
});
