/**
 * Snapshot store pre SSTZ dáta.
 *
 * Prečo: aplikácia nikdy nesmie zobrazovať vymyslené dáta. Ak sa nedá spojiť
 * so stolnytenis.info (napr. sandbox bez internetu, výpadok portálu), použije sa
 * POSLEDNÝ REÁLNE STIAHNUTÝ snapshot – vždy s dátumom stiahnutia a odkazom na
 * overenie. Ak snapshot neexistuje, UI zobrazí jasné upozornenie a nič nevymýšľa.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const SNAPSHOT_DIR = process.env.SSTZ_SNAPSHOT_DIR
  ? path.resolve(process.env.SSTZ_SNAPSHOT_DIR)
  : path.join(__dirname, '..', 'data', 'sstz');

function ensureDir() {
  try {
    fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
  } catch {
    /* ignore */
  }
}

function snapshotPath(playerId, dir = SNAPSHOT_DIR) {
  return path.join(dir, `${String(playerId).replace(/[^\w.-]/g, '_')}.json`);
}

export function saveSnapshot(profile, dir = SNAPSHOT_DIR) {
  if (!profile?.id) return null;
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {
    /* ignore */
  }
  const file = snapshotPath(profile.id, dir);
  const payload = {
    ...profile,
    source: {
      ...(profile.source || {}),
      mode: 'snapshot',
      snapshotSavedAt: new Date().toISOString(),
    },
  };
  fs.writeFileSync(file, JSON.stringify(payload, null, 2), 'utf8');
  return file;
}

export function loadSnapshot(playerId) {
  const file = snapshotPath(playerId);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

export function listSnapshots() {
  ensureDir();
  let files = [];
  try {
    files = fs.readdirSync(SNAPSHOT_DIR).filter((f) => f.endsWith('.json'));
  } catch {
    return [];
  }
  return files
    .map((file) => {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(SNAPSHOT_DIR, file), 'utf8'));
        return {
          id: data.id,
          name: data.name,
          file,
          syncedAt: data.syncedAt || data.source?.snapshotSavedAt || null,
          matches: (data.matches || []).length,
          doubles: (data.doublesMatches || []).length,
          verified: data.verification?.status === 'verified',
          seasons: (data.seasons || []).length,
          profileUrl: data.profileUrl || data.source?.profileUrl || null,
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => String(b.syncedAt).localeCompare(String(a.syncedAt)));
}

/**
 * Obalí sťahovanie: najprv skúsi živé dáta, pri zlyhaní vráti snapshot
 * (označený ako snapshot) alebo vyhodí zrozumiteľnú chybu.
 */
export async function fetchWithSnapshotFallback(playerId, liveFn) {
  try {
    const profile = await liveFn();
    if (!profile) throw new Error('Portál nevrátil žiadne dáta pre tohto hráča.');
    saveSnapshot(profile);
    return { ...profile, source: { ...profile.source, mode: 'live' } };
  } catch (err) {
    const cached = loadSnapshot(playerId);
    if (cached) {
      return {
        ...cached,
        source: {
          ...(cached.source || {}),
          mode: 'snapshot',
          liveError: err.message,
        },
        warnings: [
          ...(cached.warnings || []),
          `Živé spojenie so stolnytenis.info zlyhalo (${err.message}). Zobrazujú sa uložené dáta zo dňa ${cached.syncedAt || 'neznámeho dňa'}.`,
        ],
      };
    }
    throw err;
  }
}
