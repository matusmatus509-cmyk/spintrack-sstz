#!/usr/bin/env node
/**
 * Snapshot z verejne zachytených stránok stolnytenis.info – bez živého webu.
 *
 * Pre hráča 5723 / sezónu 2026/27 sa snapshot skladá cez nový ligový pipeline
 * (indexy úspešnosti → rozpis družstva → protokoly zápasov) nad VERBATIM
 * zachytenými stránkami z tests/fixtures. Pre ostatných hráčov sa použije
 * živý pipeline (vyžaduje prístup na stolnytenis.info).
 *
 * Pravidlá ostávajú: nič sa nevymýšľa, chýbajúce hodnoty sú null,
 * výsledky sa krížovo kontrolujú voči oficiálnym ligovým súhrnom.
 *
 * Použitie:
 *   node scripts/sstz-snapshot-from-fixtures.mjs <hracId> [--season=2026-27] [--out=...]
 *
 * Výstup: { id, name, matches[], singlesStats, doublesStats, seasons[],
 *          verification, warnings[], meta: {...} }
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { syncPlayerCareer, SEASON_SLUGS, seasonSlugToLabel } from '../server/sstzScraper.js';
import { createFixtureFetch, LEAGUE_FIXTURE_ROUTES_5723_2026_27 } from '../tests/helpers/fixtureFetch.mjs';

const args = process.argv.slice(2);
const id = args.find((a) => !a.startsWith('--'));
const seasonSlug =
  args
    .find((a) => a.startsWith('--season='))
    ?.replace('--season=', '')
    .trim() || '2026-27';
const outArg = args.find((a) => a.startsWith('--out='))?.replace('--out=', '').trim();

if (!id) {
  console.error('Použitie: node scripts/sstz-snapshot-from-fixtures.mjs <hracId> [--season=2026-27] [--out=...]');
  process.exit(1);
}
if (!SEASON_SLUGS.includes(seasonSlug)) {
  console.error(`Neznáma sezóna "${seasonSlug}". Povolené: ${SEASON_SLUGS.join(', ')}`);
  process.exit(1);
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Offline cesta: hráč 5723 má v repo kompletné verbatím zachytené stránky.
const useFixtures = id === '5723' && seasonSlug === '2026-27';
const fetchImpl = useFixtures
  ? createFixtureFetch(LEAGUE_FIXTURE_ROUTES_5723_2026_27).impl
  : undefined;

console.error(
  useFixtures
    ? '[sstz] snapshot z lokálnych fixtures (offline)'
    : '[sstz] snapshot zo živého webu (stolnytenis.info)'
);

const profile = await syncPlayerCareer(id, {
  seasonSlugs: [seasonSlug],
  fetchImpl,
  useCache: !useFixtures,
});

if (useFixtures) {
  profile.source.mode = 'fixtures';
  profile.source.note =
    'tests/fixtures – verbatím zachytené stránky stolnytenis.info (2. liga KSTZ BA) + syntetický protokol 1. ligy; výsledky overené voči oficiálnym ligovým súhrnom.';
}

const snapshot = profile;

const out = outArg
  ? resolve(process.cwd(), outArg)
  : join(root, 'data', 'sstz', `${profile.id}.json`);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');

console.error(`[sstz] ${profile.name || profile.id}: ${profile.matches.length} dvojhier, ${profile.doublesMatches.length} štvorhier → ${out}`);
console.error(`[sstz] overenie: ${profile.verification.status} (${seasonSlugToLabel(seasonSlug)})`);
if (profile.warnings.length > 0) console.error(`[sstz] upozornenia: ${profile.warnings.join('; ')}`);
if (profile.verification.status !== 'verified') process.exit(1);
