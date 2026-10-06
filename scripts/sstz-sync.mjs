#!/usr/bin/env node
/**
 * SpinTrack SSTZ – synchronizácia reálnych dát z portálu stolnytenis.info.
 *
 * Použitie:
 *   node scripts/sstz-sync.mjs <ID hráča alebo URL profilu> [--all] [--season=2025-26] [--out data/sstz] [--json]
 *
 * Príklady:
 *   node scripts/sstz-sync.mjs 5723 --all
 *   node scripts/sstz-sync.mjs https://www.stolnytenis.info/hrac/5723 --all
 *   npm run sstz:sync -- 5723 --all
 *
 * Skript nič nevymýšľa: stiahne presne to, čo zverejňuje SSTZ, a výsledok
 * skrížovo overí voči oficiálnym súhrnom (Úspešnosť – Dvojhry/Štvorhry).
 */
import path from 'path';
import { fileURLToPath } from 'url';
import { syncPlayerCareer } from '../server/sstzScraper.js';
import { saveSnapshot, SNAPSHOT_DIR } from '../server/sstzStore.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const args = { all: false, seasons: null, out: SNAPSHOT_DIR, json: false, doubles: true, quiet: false };
  const positional = [];
  for (const arg of argv) {
    if (arg === '--all') args.all = true;
    else if (arg === '--json') args.json = true;
    else if (arg === '--no-doubles') args.doubles = false;
    else if (arg === '--quiet') args.quiet = true;
    else if (arg.startsWith('--season=')) args.seasons = arg.split('=')[1].split(',').map((s) => s.trim());
    else if (arg.startsWith('--out=')) args.out = path.resolve(arg.split('=')[1]);
    else if (!arg.startsWith('--')) positional.push(arg);
  }
  args.target = positional[0];
  return args;
}

function extractPlayerId(target) {
  if (!target) return null;
  const fromUrl = String(target).match(/\/hrac\/(\d+)/);
  if (fromUrl) return fromUrl[1];
  const digits = String(target).replace(/\D/g, '');
  return digits.length >= 2 ? digits : null;
}

const args = parseArgs(process.argv.slice(2));
const playerId = extractPlayerId(args.target);

if (!playerId) {
  console.error('Chyba: zadaj ID hráča alebo URL profilu, napr.:');
  console.error('  node scripts/sstz-sync.mjs 5723 --all');
  process.exit(2);
}

const startedAt = Date.now();
if (!args.quiet) {
  console.log(`\n🏓 SpinTrack SSTZ → synchronizujem hráča #${playerId}`);
  console.log(`   Zdroj: https://www.stolnytenis.info/hrac/${playerId}`);
  console.log(`   Režim: ${args.all ? 'celá kariéra (všetky dostupné sezóny)' : 'aktuálna sezóna'}\n`);
}

let lastMessage = '';
const profile = await syncPlayerCareer(playerId, {
  allSeasons: args.all,
  includeDoubles: args.doubles,
  seasonSlugs: args.seasons
    ? args.seasons
        .map((v) => String(v).trim())
        .map((v) => (/^\d{4}\/\d{2}$/.test(v) ? v.replace('/', '-') : v))
        .filter((v) => /^\d{4}-\d{2}$/.test(v))
    : undefined,
  onProgress: (patch) => {
    if (args.quiet) return;
    const message = patch.message || patch.phase;
    if (message && message !== lastMessage) {
      lastMessage = message;
      process.stdout.write(`   • ${message}\n`);
    }
  },
});

const file = saveSnapshot({ ...profile, source: { ...profile.source } }, args.out);
const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);

console.log(`\n✅ Hotovo za ${seconds}s`);
console.log(`   Hráč:            ${profile.name} (#${profile.id})`);
console.log(`   Dvojhry:         ${profile.singlesStats.won} z ${profile.singlesStats.played} (${profile.singlesStats.winRate} %)`);
console.log(`   Štvorhry:        ${profile.doublesStats.won} z ${profile.doublesStats.played} (${profile.doublesStats.winRate} %)`);
console.log('   Sezóny:');
for (const season of profile.seasons) {
  console.log(
    `     – ${season.label || '(neznáma)'}: ${season.matches} duelov, overenie: ${season.verification.verified ? 'OK ✓' : 'NEPREŠLO ✗'}`
  );
}
console.log(`\n   Overenie voči oficiálnym súhrnom SSTZ: ${profile.verification.status === 'verified' ? 'SEDÍ ✓' : 'NEPODARILO SA ✗'}`);
for (const check of profile.verification.seasons) {
  for (const item of check.checks) {
    const mark = item.ok ? '✓' : '✗';
    const expected = item.expected ? ` (web: ${item.expected}, appka: ${item.actual})` : '';
    console.log(`     ${mark} ${check.label || ''} ${item.name}${expected}`);
  }
}
if (profile.warnings?.length) {
  console.log('\n⚠️  Upozornenia:');
  for (const warning of profile.warnings) console.log(`   – ${warning}`);
}
console.log(`\n💾 Snapshot uložený: ${file}`);
console.log('   (Appka ho použije vtedy, keď nemá priame spojenie na portál – vždy s dátumom a odkazom na overenie.)\n');

if (args.json) {
  process.stdout.write(`${JSON.stringify(profile, null, 2)}\n`);
}

process.exit(profile.verification.status === 'verified' ? 0 : 1);
