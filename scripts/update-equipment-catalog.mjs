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
// ITTF publishes its current List of Authorised Racket Coverings through the
// same public export endpoint used by its equipment site. Keep this snapshot
// separate from the historical name archive so the UI can label it accurately.
const ittfUrl = 'https://ittf-admin-api.azurewebsites.net/api/Export/Equipment_RacketCoverings?limit=10000&skip=0';
const ittfResponse = await fetch(ittfUrl, { signal: AbortSignal.timeout(30000) });
if (!ittfResponse.ok) throw new Error(`ITTF equipment source HTTP ${ittfResponse.status}`);
const ittfPayload = await ittfResponse.json();
const ittfRows = Array.isArray(ittfPayload) ? ittfPayload.flatMap(page => page?.rows ?? []) : [];
if (ittfRows.length < 1000) throw new Error('Unexpected ITTF export. Existing catalog was not replaced.');
const currentCoverings = new Map();
for (const item of ittfRows) {
  const brand = item.BrandName?.replace(/\s+/g, ' ').trim();
  const model = item.EquipmentName?.replace(/\s+/g, ' ').trim();
  if (item.ApprovalStatus !== true || item.IsExpired !== 'No' || !brand || !model || /^\*+$/u.test(model)) continue;
  const key = `${normalize(brand)}:${normalize(model)}`;
  if (!currentCoverings.has(key)) currentCoverings.set(key, [brand, model, item.EquipmentRacketCoveringId]);
}
if (currentCoverings.size < 1000) throw new Error('Unexpected current ITTF covering count. Existing catalog was not replaced.');
const decodeHtml = value => value.replace(/&#x([\da-f]+);/giu, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/gu, (_, code) => String.fromCodePoint(Number(code)))
  .replace(/&amp;/gu, '&').replace(/&quot;/gu, '"').replace(/&#39;/gu, "'").replace(/&nbsp;/gu, ' ');
const butterflyProducts = new Map();
for (let page = 1; page <= 20; page += 1) {
  const pageUrl = new URL('https://en.butterfly.tt/blades');
  if (page > 1) pageUrl.searchParams.set('p', String(page));
  const response = await fetch(pageUrl, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Butterfly blade source HTTP ${response.status}`);
  const html = await response.text();
  const products = [...html.matchAll(/<a class="product-item-link[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gs)]
    .map(([, url, label]) => ({ url: decodeHtml(url), model: decodeHtml(label.replace(/<[^>]*>/gu, ' ')).replace(/\s+/gu, ' ').trim() }))
    .filter(item => item.model && /^https:\/\/en\.butterfly\.tt\/[a-z0-9-]+\.html$/iu.test(item.url));
  for (const product of products) {
    const key = `${normalize('Butterfly')}:${normalize(product.model)}`;
    if (!butterflyProducts.has(key)) butterflyProducts.set(key, ['Butterfly', product.model, product.url]);
  }
  if (products.length < 48) break;
  if (page === 20) throw new Error('Butterfly blade listing exceeded the expected page limit.');
}
if (butterflyProducts.size < 20) throw new Error('Unexpected Butterfly blade listing. Existing catalog was not replaced.');
const output = {
  source: 'TableTennisDB', sourceUrl: 'https://github.com/zerebos/TableTennisDB', revision,
  retrievedAt: new Date().toISOString().slice(0, 10), sourceCounts: counts, entries,
  currentApproval: {
    source: 'ITTF List of Authorised Racket Coverings', sourceUrl: ittfUrl.split('?')[0],
    retrievedAt: new Date().toISOString().slice(0, 10),
    entries: [...currentCoverings.values()].sort((a, b) => `${a[0]} ${a[1]}`.localeCompare(`${b[0]} ${b[1]}`, 'en'))
  },
  currentBladeCatalog: {
    source: 'Butterfly official shop', sourceUrl: 'https://en.butterfly.tt/blades',
    retrievedAt: new Date().toISOString().slice(0, 10),
    entries: [...butterflyProducts.values()].sort((a, b) => a[1].localeCompare(b[1], 'en'))
  }
};
const license = await fetch(`${base}/LICENSE`);
if (!license.ok) throw new Error('Cannot load source license');
const licenseText = await license.text();
await fs.writeFile(new URL('../src/data/equipmentNames.json', import.meta.url), JSON.stringify(output, null, 0) + '\n');
await fs.mkdir(new URL('../licenses/', import.meta.url), { recursive: true });
await fs.writeFile(new URL('../licenses/TableTennisDB-MIT.txt', import.meta.url), licenseText);
console.log(`Catalog: ${entries.filter(row => row[0] === 'rubber').length} historical rubbers, ${output.currentApproval.entries.length} current ITTF-authorised rubbers, ${entries.filter(row => row[0] === 'blade').length} historical blades, ${output.currentBladeCatalog.entries.length} blades listed in the Butterfly shop.`);
