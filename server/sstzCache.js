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
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function isWritable(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    const probe = path.join(dir, `.probe-${process.pid}-${Date.now()}`);
    fs.writeFileSync(probe, 'ok', 'utf8');
    fs.unlinkSync(probe);
    return true;
  } catch {
    return false;
  }
}

function resolveCacheDir() {
  const preferred = process.env.SSTZ_CACHE_DIR
    ? path.resolve(process.env.SSTZ_CACHE_DIR)
    : path.join(__dirname, '..', 'data', 'sstz', 'cache');
  if (isWritable(preferred)) return preferred;
  // Read-only filesystem (napr. Vercel/AWS Lambda: /var/task) – cache sa
  // presunie do /tmp, aby fungovala aspoň v rámci bežiacej inštancie.
  const tmp = path.join(os.tmpdir(), 'sstz-cache');
  if (isWritable(tmp)) return tmp;
  return preferred; // zápisy budú ticho padať (writeCache má try/catch)
}

export const CACHE_DIR = resolveCacheDir();

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
