/**
 * Snapshot store pre SSTZ dáta.
 *
 * Prečo: aplikácia nikdy nesmie zobrazovať vymyslené dáta. Ak sa nedá spojiť
 * so stolnytenis.info (napr. sandbox bez internetu, výpadok portálu), použije sa
 * POSLEDNÝ REÁLNE STIAHNUTÝ snapshot – vždy s dátumom stiahnutia a odkazom na
 * overenie. Ak snapshot neexistuje, UI zobrazí jasné upozornenie a nič nevymýšľa.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const SNAPSHOT_DIR = process.env.SSTZ_SNAPSHOT_DIR
  ? path.resolve(process.env.SSTZ_SNAPSHOT_DIR)
  : path.join(__dirname, '..', 'data', 'sstz');

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

/**
 * Adresár na ZÁPIS snapshotov. Na serverless (Vercel/Lambda) je /var/task
 * read-only – vtedy zapisujeme do /tmp (platí pre životnosť inštancie).
 * Ak sa nedá zapisovať nikam, je null (uloženie sa ticho preskočí,
 * živé dáta sa aj tak vrátia používateľovi).
 */
export const WRITABLE_SNAPSHOT_DIR = (() => {
  if (isWritable(SNAPSHOT_DIR)) return SNAPSHOT_DIR;
  const tmp = path.join(os.tmpdir(), 'sstz-snapshots');
  if (isWritable(tmp)) return tmp;
  return null;
})();

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

let snapshotWriteWarned = false;

export function saveSnapshot(profile, dir = WRITABLE_SNAPSHOT_DIR || SNAPSHOT_DIR) {
  if (!profile?.id) return null;
  if (!dir) {
    if (!snapshotWriteWarned) {
      snapshotWriteWarned = true;
      console.warn('[sstz] Snapshot sa nedá uložiť (read-only filesystem) – dáta sa vracajú bez uloženia.');
    }
    return null;
  }
  const file = snapshotPath(profile.id, dir);
  try {
    fs.mkdirSync(dir, { recursive: true });
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
  } catch (err) {
    // Read-only FS, plný disk a pod. – uloženie je len optimalizácia,
    // živý sync nesmie kvôli nemu zlyhať.
    if (!snapshotWriteWarned) {
      snapshotWriteWarned = true;
      console.warn(`[sstz] Snapshot sa nepodarilo uložiť (${err.code || err.message}) – pokračujem bez uloženia.`);
    }
    return null;
  }
}

export function loadSnapshot(playerId) {
  // Najprv čerstvo uložené (napr. /tmp na serverless), potom pribalené.
  const dirs = [WRITABLE_SNAPSHOT_DIR, SNAPSHOT_DIR].filter(Boolean);
  for (const dir of new Set(dirs)) {
    const file = snapshotPath(playerId, dir);
    if (!fs.existsSync(file)) continue;
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      /* poškodený súbor – skús ďalší adresár */
    }
  }
  return null;
}

export function listSnapshots() {
  ensureDir();
  const dirs = [...new Set([WRITABLE_SNAPSHOT_DIR, SNAPSHOT_DIR].filter(Boolean))];
  const seen = new Map(); // id → položka (novší adresár má prednosť)
  for (const dir of dirs) {
    let files = [];
    try {
      files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
    } catch {
      continue;
    }
    for (const file of files) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
        if (!data?.id || seen.has(String(data.id))) continue;
        seen.set(String(data.id), {
          id: data.id,
          name: data.name,
          file,
          syncedAt: data.syncedAt || data.source?.snapshotSavedAt || null,
          matches: (data.matches || []).length,
          doubles: (data.doublesMatches || []).length,
          verified: data.verification?.status === 'verified',
          seasons: (data.seasons || []).length,
          profileUrl: data.profileUrl || data.source?.profileUrl || null,
        });
      } catch {
        /* poškodený súbor ignorujeme */
      }
    }
  }
  return [...seen.values()].sort((a, b) => String(b.syncedAt).localeCompare(String(a.syncedAt)));
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
