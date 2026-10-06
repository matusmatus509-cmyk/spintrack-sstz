#!/usr/bin/env node
/**
 * Rýchla diagnostika: má toto prostredie prístup na portál stolnytenis.info?
 * Spustenie: npm run sstz:check
 */
import { fetchPage, BASE_URL } from '../server/sstzScraper.js';

console.log(`Kontrolujem spojenie na ${BASE_URL} …`);
try {
  const { status } = await fetchPage('/', { retries: 0 });
  console.log(`✓ Portál odpovedal (HTTP ${status}). Živé dáta sa dajú sťahovať.`);
  process.exit(0);
} catch (err) {
  console.error(`✗ Portál nedostupný: ${err.message}`);
  console.error(`
Toto prostredie (napr. sandbox bez prístupu na internet) nedokáže otvoriť stolnytenis.info.
Možnosti:
  1) Spusti aplikáciu lokálne (npm start) alebo ju nasaď (Vercel/Netlify) – tam sa dáta načítajú naživo.
  2) Na stroji s internetom spusti: npm run sstz:sync -- <ID hráča> --all
     Vznikne snapshot v data/sstz/<id>.json, ktorý appka použije aj offline (vždy s dátumom a odkazom na overenie).
`);
  process.exit(1);
}
