import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const PRIMARY_DATA_DIR = path.join(PROJECT_ROOT, 'data', 'sstz');
const FALLBACK_DATA_DIR = path.join(os.tmpdir(), 'sstz-snapshots');

// In-memory snapshot fallback
const memorySnapshots = new Map();

function ensureDir(dir) {
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Saves a player profile snapshot to disk (with safe fallback for read-only environments)
 */
export function saveSnapshot(playerId, profile) {
  if (!playerId || !profile) return false;

  memorySnapshots.set(playerId.toString(), profile);

  // Try primary directory first
  const filename = `${playerId}.json`;
  if (ensureDir(PRIMARY_DATA_DIR)) {
    try {
      const filePath = path.join(PRIMARY_DATA_DIR, filename);
      fs.writeFileSync(filePath, JSON.stringify(profile, null, 2), 'utf-8');
      return true;
    } catch {
      // primary dir might be read-only on serverless
    }
  }

  // Fallback to /tmp
  if (ensureDir(FALLBACK_DATA_DIR)) {
    try {
      const filePath = path.join(FALLBACK_DATA_DIR, filename);
      fs.writeFileSync(filePath, JSON.stringify(profile, null, 2), 'utf-8');
      return true;
    } catch {
      // ignore
    }
  }

  return false;
}

/**
 * Loads a player snapshot by ID
 */
export function loadSnapshot(playerId) {
  if (!playerId) return null;
  const idStr = playerId.toString();

  // 1. In-memory
  if (memorySnapshots.has(idStr)) {
    return memorySnapshots.get(idStr);
  }

  // 2. Primary directory
  const primaryPath = path.join(PRIMARY_DATA_DIR, `${idStr}.json`);
  if (fs.existsSync(primaryPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(primaryPath, 'utf-8'));
      memorySnapshots.set(idStr, data);
      return data;
    } catch (e) {
      console.warn(`Error reading primary snapshot for ${idStr}:`, e.message);
    }
  }

  // 3. Fallback /tmp directory
  const fallbackPath = path.join(FALLBACK_DATA_DIR, `${idStr}.json`);
  if (fs.existsSync(fallbackPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(fallbackPath, 'utf-8'));
      memorySnapshots.set(idStr, data);
      return data;
    } catch (e) {
      console.warn(`Error reading fallback snapshot for ${idStr}:`, e.message);
    }
  }

  return null;
}

/**
 * Lists all available snapshot player IDs and basic info
 */
export function listSnapshots() {
  const result = [];
  const seen = new Set();

  const scanDir = (dir) => {
    if (fs.existsSync(dir)) {
      try {
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
        for (const file of files) {
          const id = file.replace('.json', '');
          if (!seen.has(id)) {
            seen.add(id);
            try {
              const content = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8'));
              result.push({
                id,
                name: content.name || `Hráč #${id}`,
                clubName: content.clubName || '',
                totalMatches: content.totalMatches || 0,
                syncedAt: content.syncedAt || null
              });
            } catch {
              result.push({ id, name: `Hráč #${id}` });
            }
          }
        }
      } catch {
        // ignore
      }
    }
  };

  scanDir(PRIMARY_DATA_DIR);
  scanDir(FALLBACK_DATA_DIR);

  for (const [id, content] of memorySnapshots.entries()) {
    if (!seen.has(id)) {
      seen.add(id);
      result.push({
        id,
        name: content.name || `Hráč #${id}`,
        clubName: content.clubName || '',
        totalMatches: content.totalMatches || 0,
        syncedAt: content.syncedAt || null
      });
    }
  }

  return result;
}
