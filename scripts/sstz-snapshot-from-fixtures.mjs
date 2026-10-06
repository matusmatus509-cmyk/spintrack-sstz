#!/usr/bin/env node
/**
 * Vytvorí snapshot z VERBATIM zachytených stránok portálu (tests/fixtures).
 *
 * Slúži na to, aby aplikácia vedela zobraziť reálne dáta (hráč 5723, sezóna
 * 2026/27) aj v prostredí bez prístupu na stolnytenis.info. Nevymýšľa nič:
 * berie presne tie stránky, ktoré boli stiahnuté z portálu a uložené ako
 * fixtures, a zapíše ich obsah vrátane pôvodných hodnôt setov.
 *
 * Použitie: node scripts/sstz-snapshot-from-fixtures.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { parsePlayerLines, composeProfile } from '../server/sstzScraper.js';
import { saveSnapshot, SNAPSHOT_DIR } from '../server/sstzStore.js';
import { loadFixtureLines } from '../tests/helpers/markdownToLines.mjs';


const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(__dirname, '..', 'tests', 'fixtures');
const PLAYER_ID = process.argv[2] || '5723';

const FILES = [
  { file: `hrac-${PLAYER_ID}-2liga-2026-27.txt`, season: '2026/27' },
  { file: `hrac-${PLAYER_ID}-1liga-2026-27.txt`, season: '2026/27' },
];

const pages = [];
const missing = [];

for (const { file, season } of FILES) {
  const full = path.join(FIXTURES, file);
  if (!fs.existsSync(full)) {
    missing.push(file);
    continue;
  }
  const page = parsePlayerLines(loadFixtureLines(file), PLAYER_ID);
  // Fixture bol zachytený z konkrétneho tabu profilu – vyberieme presne ten tab,
  // aby sa zápasy nepriradili k inej súťaži (žiiadne skreslenie).
  const wanted = file.includes('-2liga-') ? /2\.\s*liga/i : /1\.?\s*liga/i;
  const competition =
    page.competitions.find((c) => wanted.test(c.label || '')) ||
    page.competitions[0] ||
    null;
  pages.push({
    seasonLabel: page.seasonLabel || season,
    seasonId: null,
    competition,
    page,
  });
  console.log(
    `   • ${file}: sezóna ${page.seasonLabel || season}, duely ${page.duels.length} (dvojhry ${page.duels.filter((d) => d.type === 'singles').length})`
  );
}

if (pages.length === 0) {
  console.error(`Chyba: pre hráča ${PLAYER_ID} sa nenašli žiadne fixtures${missing.length ? ` (${missing.join(', ')})` : ''}.`);
  process.exit(1);
}

const profile = composeProfile({
  playerId: PLAYER_ID,
  name: pages[0].page.name,
  pages,
  includeDoubles: true,
  warnings: [
    'Snapshot bol vytvorený z verbatim zachytených stránok portálu stolnytenis.info (priečinok tests/fixtures).',
    `Obsahuje len sezóny, ktoré boli zachytené: ${[...new Set(pages.map((p) => p.seasonLabel))].join(', ')}.`,
    'Pre úplnú kariéru (2018/19 – 2026/27) spusti na stroji s internetom: npm run sstz:sync -- ' + PLAYER_ID + ' --all',
  ],
  ...(missing.length > 0 ? { warnings2: undefined } : {}),
});

profile.source = {
  ...profile.source,
  live: false,
  mode: 'snapshot',
  note:
    'Réžim snapshot: obsahuje presne to, čo bolo zachytené z portálu stolnytenis.info. ' +
    'Hodnoty setov sú pôvodné (±N z portálu), skóre setov je z nich odvodené a označené ako „derived".',
  capturedPages: FILES.map((f) => `tests/fixtures/${f.file}`),
};

const saved = saveSnapshot(profile);
console.log(`\n✅ Snapshot uložený: ${saved}`);
console.log(`   Hráč: ${profile.name} (#${profile.id})`);
console.log(`   Sezóny: ${profile.seasons.map((s) => s.label).join(', ')}`);
console.log(`   Duely: ${profile.matches.length} dvojhier + ${profile.doublesMatches.length} štvorhier`);
console.log(`   Overenie voči oficiálnym súhrnom: ${profile.verification.status === 'verified' ? 'SEDÍ ✓' : 'NESEDÍ ✗'}`);
for (const season of profile.verification.seasons) {
  for (const check of season.checks) {
    console.log(`     - ${check.name}: portál ${check.expected ?? '—'} | aplikácia ${check.actual ?? '—'} ${check.ok ? '✓' : '✗'}`);
  }
}
console.log(`   Uložené do: ${SNAPSHOT_DIR}`);
