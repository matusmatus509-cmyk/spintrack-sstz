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

    // Prázdny výsledok (žiadna sezóna ani zápas) znamená, že živé spojenie
    // zlyhalo (napr. offline) alebo hráč nemá dáta. Nikdy nesmieme prepísať
    // existujúci REÁLNY snapshot prázdnym výsledkom – radšej vrátime snapshot.
    const isEmpty =
      (!Array.isArray(profile.seasons) || profile.seasons.length === 0) &&
      (!Array.isArray(profile.matches) || profile.matches.length === 0) &&
      (!Array.isArray(profile.doublesMatches) || profile.doublesMatches.length === 0);
    if (isEmpty) {
      const ws = profile.warnings || [];
      // Ak sa sezóna nedala vôbec načítať (offline/výpadok), výsledok nie je
      // dôveryhodný – použijeme snapshot namiesto prázdnych „živých“ dát.
      const loadFailed = ws.some((w) => /nepodarilo sa načítať|neuvádza žiadne súťaže/i.test(w));
      const legitEmpty = !loadFailed && ws.some((w) => /nenašli žiadne zápasy/i.test(w));
      if (!legitEmpty) {
        throw new Error('Živé sťahovanie nevrátilo žiadne sezóny ani zápasy (portál nedostupný?).');
      }
      // Legitímne prázdny výsledok (hráč nemá v indexoch žiadne zápasy) –
      // vraciame ho, ale nič neukladáme, aby sa nič reálne neprepísalo.
      return { ...profile, source: { ...profile.source, mode: 'live' } };
    }

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
