// Rebuild the name-only catalog from the MIT-licensed TableTennisDB archive.
import fs from 'node:fs/promises';
import http from 'node:http';
if (typeof http.setGlobalProxyFromEnv === 'function') http.setGlobalProxyFromEnv();

const revision = process.argv[2] || '3ea1f733057e09d9c66e242a2e3b73b81b6464b0';
const base = `https://raw.githubusercontent.com/zerebos/TableTennisDB/${revision}`;
const multiwordBrands = ['Der Materialspezialist', 'Sauer & Troger', 'Dr. Neubauer', 'Giant Dragon', '61 Second', 'Double Fish', 'Xi Enting', 'Xi Up', 'Guo Qiu', 'Best of Five', 'Three Sword', 'American Hinoki', 'Pro Power', 'Ross Leidy'];
const normalize = value => value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const rows = new Map();
const counts = {};
for (const category of ['rubber', 'pips', 'blade']) {
  const response = await fetch(`${base}/src/legacy/revspin/cache/${category}.json`, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Catalog source HTTP ${response.status}`);
  const data = await response.json();
  if (!Array.isArray(data) || data.length < 100) throw new Error('Unexpected catalog source. Existing catalog was not replaced.');
  counts[category] = data.length;
  for (const item of data) {
    let name = item.name?.replace(/\s+/g, ' ').trim();
    if (!name || name.startsWith('(No Brand)') || name.includes('\uFFFD')) continue;
    // Repair reversible UTF-8/Latin-1 mojibake in the historical source.
    if (/[ÃÂ]/.test(name)) {
      const repaired = Buffer.from(name, 'latin1').toString('utf8');
      if (!repaired.includes('\uFFFD')) name = repaired;
    }
    let brand = multiwordBrands.find(brand => name.startsWith(`${brand} `)) || name.split(' ')[0];
    const model = name.slice(brand.length).trim();
    if (!model) continue;
    if (brand === 'Sauer & Troger') brand = 'Sauer & Tröger';
    const kind = category === 'blade' ? 'blade' : 'rubber';
    rows.set(`${kind}:${normalize(brand)}:${normalize(model)}`, [kind, brand, model, item.href]);
  }
}
const entries = [...rows.values()].sort((a, b) => `${a[1]} ${a[2]}`.localeCompare(`${b[1]} ${b[2]}`, 'en'));
const output = { source: 'TableTennisDB', sourceUrl: 'https://github.com/zerebos/TableTennisDB', revision, retrievedAt: new Date().toISOString().slice(0, 10), sourceCounts: counts, entries };
const license = await fetch(`${base}/LICENSE`);
if (!license.ok) throw new Error('Cannot load source license');
const licenseText = await license.text();
await fs.writeFile(new URL('../src/data/equipmentNames.json', import.meta.url), JSON.stringify(output, null, 0) + '\n');
await fs.mkdir(new URL('../licenses/', import.meta.url), { recursive: true });
await fs.writeFile(new URL('../licenses/TableTennisDB-MIT.txt', import.meta.url), licenseText);
console.log(`Catalog: ${entries.filter(row => row[0] === 'rubber').length} rubbers, ${entries.filter(row => row[0] === 'blade').length} blades.`);
