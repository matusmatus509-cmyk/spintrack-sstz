#!/usr/bin/env node
/**
 * SpinTrack SSTZ – diagnostická sonda (READ-ONLY).
 *
 * Zisťuje, ako portál stolnytenis.info prepína sezónu, a to výhradne
 * pozorovaním odpovedí portálu. Nič sa nedomýšľa – skript vypíše surové
 * dôkazy (text sezóny, dátumy zápasov, nájdené atribúty) a jasne povie,
 * ktorý spôsob prepnutia naozaj funguje.
 *
 * Použitie:
 *   node scripts/sstz-probe.mjs <ID hráča | URL profilu> [--season=2025-26]
 *   npm run sstz:probe -- 5723
 *
 * Výstup sa ukladá aj do `data/sstz/probe-<id>.json`, aby sa dal poslať ďalej.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  BASE_URL,
  SEASON_SLUGS,
  SEASON_SCOPE,
  fetchPage,
  ensureSession,
  htmlToAtoms,
  atomsToLines,
  parsePlayerPage,
  parsePlayerLines,
  seasonLabelToSlug,
  seasonSlugToLabel,
} from '../server/sstzScraper.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(process.env.SSTZ_SNAPSHOT_DIR || path.join(__dirname, '..', 'data', 'sstz'));

function parseArgs(argv) {
  const args = { target: null, season: null };
  for (const arg of argv) {
    if (arg.startsWith('--season=')) args.season = arg.split('=')[1].trim();
    else if (!arg.startsWith('--')) args.target = arg;
  }
  return args;
}

const playerId = (() => {
  const target = parseArgs(process.argv.slice(2)).target;
  if (!target) return null;
  const fromUrl = String(target).match(/\/hrac\/(\d+)/);
  if (fromUrl) return fromUrl[1];
  const digits = String(target).replace(/\D/g, '');
  return digits.length >= 2 ? digits : null;
})();

const wantedSeason = parseArgs(process.argv.slice(2)).season;

if (!playerId) {
  console.error('Chyba: zadaj ID hráča alebo URL profilu, napr.:');
  console.error('  node scripts/sstz-probe.mjs 5723');
  process.exit(2);
}

const line = (char = '─') => console.log(char.repeat(72));
const fingerprint = (page) => ({
  season: page.seasonLabel,
  name: page.name,
  duels: page.duels.length,
  singles: page.duels.filter((d) => d.type === 'singles').length,
  doubles: page.duels.filter((d) => d.type === 'doubles').length,
  firstDates: [...new Set(page.duels.map((d) => d.date).filter(Boolean))].slice(0, 4),
});

async function fetchPlayer(cookie) {
  const res = await fetchPage(`/hrac/${playerId}`, { cookie });
  return { page: parsePlayerPage(res.html, playerId), html: res.html, status: res.status };
}

console.log(`\n🔎 SpinTrack SSTZ sonda – hráč #${playerId}`);
console.log(`   Zdroj: ${BASE_URL}/hrac/${playerId}\n`);

const report = {
  playerId,
  profileUrl: `${BASE_URL}/hrac/${playerId}`,
  probedAt: new Date().toISOString(),
  steps: [],
};

try {
  const { cookie } = await ensureSession();
  line();
  console.log('1) AKTUÁLNY STAV PROFILU (bez prepínania sezóny)');
  line();
  const first = await fetchPlayer(cookie);
  const baseFp = fingerprint(first.page);
  console.log(`   Sezóna na stránke : ${baseFp.season || '(nepodarilo sa prečítať)'}`);
  console.log(`   Hráč              : ${baseFp.name || '?'}`);
  console.log(`   Duely             : ${baseFp.duels} (dvojhry ${baseFp.singles}, štvorhry ${baseFp.doubles})`);
  console.log(`   Prvé dátumy       : ${baseFp.firstDates.join(', ') || '—'}`);
  report.steps.push({ step: 'baseline', fingerprint: baseFp });

  line();
  console.log('2) ČO PORTÁL PONÚKA (sezóny v menu + odkazy s "sezona")');
  line();
  const atoms = htmlToAtoms(first.html);
  const seasonAttrs = atoms
    .filter((a) => a.type === 'attr' && /season/i.test(a.name))
    .map((a) => ({ name: a.name, value: String(a.value).slice(0, 120) }));
  const seasonLinks = [...new Set(
    atoms.filter((a) => a.type === 'link' && /sezona|season/i.test(String(a.href))).map((a) => String(a.href).slice(0, 160))
  )];

  // Surové dôkazy priamo z HTML (aby bolo vidieť, ako portál sezónu adresuje)
  const rawSeasonSnippets = [...String(first.html).matchAll(/<[^>]{0,200}(?:season|sezona)[^>]{0,200}>/gi)]
    .map((m) => m[0].replace(/\s+/g, ' ').slice(0, 220))
    .slice(0, 25);

  console.log(`   Sezóny prečítané parserom: ${first.page.availableSeasons.map((s) => s.label || s.slug).join(', ') || '(žiadne)'}`);
  console.log(`   Atribúty s "season"      : ${seasonAttrs.length}`);
  for (const a of seasonAttrs.slice(0, 25)) console.log(`     • data-${a.name}="${a.value}"`);
  console.log(`   Odkazy so sezónou        : ${seasonLinks.length}`);
  for (const href of seasonLinks.slice(0, 15)) console.log(`     • ${href}`);
  console.log(`   Surové značky s "season" : ${rawSeasonSnippets.length}`);
  for (const snippet of rawSeasonSnippets.slice(0, 15)) console.log(`     • ${snippet}`);
  report.steps.push({ step: 'markup', seasonAttrs, seasonLinks, rawSeasonSnippets, availableSeasons: first.page.availableSeasons });

  const currentSlug = seasonLabelToSlug(baseFp.season);
  const offered = first.page.availableSeasons.map((s) => s.slug || String(s.id)).filter(Boolean);
  const candidates = (offered.length > 0 ? offered : SEASON_SLUGS).filter((slug) => slug !== currentSlug);
  const targetSlug = wantedSeason
    ? (/^\d{4}\/\d{2}$/.test(wantedSeason) ? wantedSeason.replace('/', '-') : wantedSeason)
    : candidates[candidates.length - 1];

  line();
  console.log(`3) TESTOVANÝ SPÔSOB: otvorenie ${BASE_URL}/sezona/${targetSlug}/${SEASON_SCOPE}`);
  line();
  const targetLabel = seasonSlugToLabel(targetSlug);
  await fetchPage(`/sezona/${targetSlug}/${SEASON_SCOPE}`, { cookie });
  const after = await fetchPlayer(cookie);
  const afterFp = fingerprint(after.page);
  console.log(`   Očakávaná sezóna  : ${targetLabel}`);
  console.log(`   Sezóna po otvorení: ${afterFp.season || '(nepodarilo sa prečítať)'}`);
  console.log(`   Duely             : ${afterFp.duels} (dvojhry ${afterFp.singles}, štvorhry ${afterFp.doubles})`);
  console.log(`   Prvé dátumy       : ${afterFp.firstDates.join(', ') || '—'}`);
  const urlScopeWorks = afterFp.season === targetLabel && targetLabel !== baseFp.season;
  console.log(
    urlScopeWorks
      ? '   ✅ VÝSLEDOK: routa /sezona/<sezóna>/svk PREPNE profil hráča na zvolenú sezónu.'
      : '   ❌ VÝSLEDOK: po otvorení routy sa profil NEprepol – portál drží sezónu inde (pravdepodobne v session/AJAX).'
  );
  report.steps.push({ step: 'url-scope', targetSlug, targetLabel, after: afterFp, urlScopeWorks });

  if (!urlScopeWorks) {
    line();
    console.log('4) DOPLNKOVÝ TEST: GET parametre na profile hráča');
    line();
    for (const param of [`?season=${targetSlug}`, `?season_id=${targetSlug}`, `?s=&sezona=${targetSlug}`]) {
      try {
        const res = await fetchPage(`/hrac/${playerId}${param}`, { cookie });
        const fp = fingerprint(parsePlayerPage(res.html, playerId));
        const changed = fp.season === targetLabel;
        console.log(`   ${param.padEnd(24)} → sezóna ${fp.season || '?'} ${changed ? '(PREPNUTÉ ✅)' : '(bez zmeny)'}`);
        report.steps.push({ step: 'query-param', param, season: fp.season, changed });
      } catch (err) {
        console.log(`   ${param.padEnd(24)} → chyba: ${err.message}`);
        report.steps.push({ step: 'query-param', param, error: err.message });
      }
    }
  }

  line();
  console.log('ZHRNUTIE');
  line();
  console.log(`   Aktuálna sezóna profilu : ${baseFp.season}`);
  console.log(`   Prepnutie cez URL routu : ${urlScopeWorks ? 'FUNGUJE' : 'NEFUNGUJE'}`);
  console.log(`   Počet sezón v menu      : ${offered.length || 0}`);
  console.log('   Poznámka: sonda nič nezapisuje do portálu, iba číta.');

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outFile = path.join(OUT_DIR, `probe-${playerId}.json`);
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2), 'utf8');
  console.log(`\n   📄 Protokol: ${outFile}\n`);
} catch (err) {
  console.error(`\n❌ Sonda zlyhala: ${err.message}`);
  console.error('   Skontroluj internetové pripojenie (portál stolnytenis.info musí byť dostupný).\n');
  process.exitCode = 1;
}

// Pomocné exporty (aby sa dali použiť aj z iných skriptov bez duplikácie logiky)
export { parsePlayerLines };
