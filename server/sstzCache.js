/**
 * Disková cache pre dáta z portálu stolnytenis.info.
 *
 * Prečo:
 *  – Minulé sezóny sú na portáli NEMENNÉ (výsledky sa už nemenia), takže raz
 *    stiahnuté údaje (zoznamy líg, indexy hráčov v ligách, protokoly zápasov)
 *    sa dajú bezpečne použiť navždy.
 *  – Vďaka tomu je synchronizácia kariéry druhého a ďalšieho hráča takmer
 *    okamžitá – zdieľajú už stiahnuté ligové indexy.
 *  – Aktuálna sezóna sa cacheuje len krátkodobo (TTL), pretože tam ešte
 *    pribúdajú zápasy.
 *
 * Cache nikdy nevymýšľa dáta: obsahuje presne to, čo vrátil portál (parsed).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const CACHE_DIR = process.env.SSTZ_CACHE_DIR
  ? path.resolve(process.env.SSTZ_CACHE_DIR)
  : path.join(__dirname, '..', 'data', 'sstz', 'cache');

/** Aktuálna sezóna podľa dátumu (sezóna prechádza 1. júla). */
export function currentSeasonSlug(date = new Date()) {
  const y = date.getFullYear();
  const m = date.getMonth() + 1; // 1-12
  if (m >= 7) return `${y}-${String((y + 1) % 100).padStart(2, '0')}`;
  return `${y - 1}-${String(y % 100).padStart(2, '0')}`;
}

function safeKey(key) {
  return String(key)
    .replace(/\\/g, '/')
    .split('/')
    .map((part) => part.replace(/[^\w.\-]+/g, '_'))
    .join('/');
}

function cachePath(key) {
  return path.join(CACHE_DIR, `${safeKey(key)}.json`);
}

export function cacheEnabled() {
  return process.env.SSTZ_NO_CACHE !== '1' && process.env.SSTZ_NO_CACHE !== 'true';
}

/**
 * Prečíta cache položku.
 * @param {string} key
 * @param {{maxAgeMs?: number|null}} opts – null/undefined = bez expirácie (nemenné dáta)
 */
export function readCache(key, { maxAgeMs = undefined } = {}) {
  if (!cacheEnabled()) return null;
  const file = cachePath(key);
  if (!fs.existsSync(file)) return null;
  try {
    if (maxAgeMs != null && Number.isFinite(maxAgeMs)) {
      const age = Date.now() - fs.statSync(file).mtimeMs;
      if (age > maxAgeMs) return null;
    }
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return parsed?.value ?? parsed;
  } catch {
    return null;
  }
}

export function writeCache(key, value) {
  if (!cacheEnabled()) return null;
  try {
    const file = cachePath(key);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ value, cachedAt: new Date().toISOString() }, null, 1), 'utf8');
    return file;
  } catch {
    return null;
  }
}
