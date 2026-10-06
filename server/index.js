/**
 * Server API pre SpinTrack SSTZ.
 *
 * Všetky dáta o hráčoch, ligách a zápasoch pochádzajú výhradne z oficiálneho
 * portálu stolnytenis.info (SSTZ). Ak portál nie je dostupný, server vráti buď
 * posledný reálny snapshot (s vyznačeným dátumom), alebo jasnú chybu – nikdy
 * nezobrazuje vymyslené hodnoty.
 */
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

import {
  searchSSTZ,
  getTeamSchedule,
  getLeagueData,
  getAllSlovakLeagues,
  syncPlayerCareer,
  fetchPage,
  SstzError,
  BASE_URL,
} from './sstzScraper.js';
import { loadSnapshot, saveSnapshot, listSnapshots, fetchWithSnapshotFallback } from './sstzStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '25mb' }));

// ---------------------------------------------------------------------------
// Jednoduchá pamäťová cache (aby sa portál nezaťažoval opakovanými požiadavkami)
// ---------------------------------------------------------------------------
const cache = new Map();
const CACHE_TTL_MS = Number(process.env.SSTZ_CACHE_TTL_MS || 15 * 60 * 1000);

function cached(key, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;
  const value = fn();
  cache.set(key, { at: Date.now(), value });
  if (value && typeof value.catch === 'function') {
    value.catch(() => cache.delete(key));
  }
  return value;
}

// ---------------------------------------------------------------------------
// Diagnostika dostupnosti portálu (UI vie vysvetliť, prečo sa nič nenačítalo)
// ---------------------------------------------------------------------------
let connectivity = { online: null, checkedAt: 0, error: null };

async function checkConnectivity(force = false) {
  if (!force && connectivity.checkedAt && Date.now() - connectivity.checkedAt < 60 * 1000) {
    return connectivity;
  }
  try {
    await fetchPage('/', { retries: 0 });
    connectivity = { online: true, checkedAt: Date.now(), error: null };
  } catch (err) {
    connectivity = { online: false, checkedAt: Date.now(), error: err.message };
  }
  return connectivity;
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.get('/api/sstz/status', async (req, res) => {
  const state = await checkConnectivity(req.query.force === 'true');
  res.json({
    online: state.online,
    checkedAt: new Date(state.checkedAt).toISOString(),
    error: state.error,
    source: { name: 'stolnytenis.info', url: BASE_URL, publisher: 'SSTZ' },
    snapshots: listSnapshots(),
    dataDir: 'data/sstz',
  });
});

// ---------------------------------------------------------------------------
// Vyhľadávanie
// ---------------------------------------------------------------------------
app.get('/api/sstz/search', async (req, res) => {
  const q = req.query.q;
  if (!q) return res.status(400).json({ error: 'Chýba parameter "q".' });
  try {
    const results = await searchSSTZ(q.toString());
    res.json(results);
  } catch (err) {
    res.status(503).json({
      error: err.message,
      hint: 'Vyhľadávanie beží priamo na portáli stolnytenis.info. Skontroluj internetové pripojenie servera.',
    });
  }
});

// ---------------------------------------------------------------------------
// Profil hráča – synchronne (vhodné pre CLI / menšie synchronizácie)
// ---------------------------------------------------------------------------
app.get('/api/sstz/player/:id', async (req, res) => {
  const { id } = req.params;
  const allSeasons = req.query.allSeasons === 'true';
  const includeDoubles = req.query.doubles !== 'false';

  try {
    const profile = await cached(`player:${id}:${allSeasons}:${includeDoubles}`, () =>
      fetchWithSnapshotFallback(id, () =>
        syncPlayerCareer(id, { allSeasons, includeDoubles })
      )
    );
    res.json(await profile);
  } catch (err) {
    const status = err instanceof SstzError && err.kind === 'rate-limit' ? 429 : 503;
    res.status(status).json({
      error: err.message,
      offline: true,
      hint:
        'Portál stolnytenis.info je dostupný len z prostredia s prístupom na internet. ' +
        'Spusti aplikáciu lokálne (npm start) alebo ju nasaď (napr. Vercel) – tam sa dáta načítajú naživo.',
    });
  }
});

// ---------------------------------------------------------------------------
// Synchronizácia na pozadí (kvôli viacerým sezónam – môže to trvať desiatky sekúnd)
// ---------------------------------------------------------------------------
const jobs = new Map();
let jobCounter = 0;

function startSyncJob(playerId, options) {
  const jobId = `job-${Date.now()}-${(jobCounter += 1)}`;
  const job = {
    id: jobId,
    playerId: String(playerId),
    status: 'running',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    progress: { phase: 'start', message: 'Spúšťam synchronizáciu…' },
    result: null,
    error: null,
    warnings: [],
  };
  jobs.set(jobId, job);

  (async () => {
    try {
      const profile = await syncPlayerCareer(playerId, {
        ...options,
        onProgress: (patch) => {
          job.progress = { ...job.progress, ...patch };
        },
      });
      saveSnapshot(profile);
      job.status = 'done';
      job.result = profile;
      job.warnings = profile.warnings || [];
    } catch (err) {
      job.status = 'error';
      job.error = err.message;
      const snapshot = loadSnapshot(job.playerId);
      if (snapshot) {
        job.status = 'done';
        job.result = {
          ...snapshot,
          source: { ...(snapshot.source || {}), mode: 'snapshot', liveError: err.message },
        };
        job.warnings = [
          `Živé spojenie zlyhalo (${err.message}) – zobrazujú sa uložené dáta zo dňa ${snapshot.syncedAt}.`,
        ];
      }
    } finally {
      job.finishedAt = new Date().toISOString();
      // držíme posledných 20 jobov
      if (jobs.size > 20) {
        const oldest = [...jobs.keys()].slice(0, jobs.size - 20);
        oldest.forEach((key) => jobs.delete(key));
      }
    }
  })();

  return jobId;
}

app.post('/api/sstz/sync', (req, res) => {
  const raw = req.body?.playerId || req.body?.playerUrl || req.body?.url;
  const playerId = String(raw || '').match(/(\d{2,})/)?.[1];
  if (!playerId) {
    return res.status(400).json({ error: 'Zadaj ID hráča alebo odkaz na profil (napr. /hrac/5723).' });
  }
  const jobId = startSyncJob(playerId, {
    allSeasons: req.body?.allSeasons !== false,
    includeDoubles: req.body?.includeDoubles !== false,
    seasonSlugs: (req.body?.seasonSlugs || req.body?.seasonIds || [])
      .map((v) => String(v).trim())
      .map((v) => (/^\d{4}\/\d{2}$/.test(v) ? v.replace('/', '-') : v))
      .filter((v) => /^\d{4}-\d{2}$/.test(v)),
  });
  res.json({ jobId, playerId });
});

app.get('/api/sstz/sync/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Neznáma úloha.' });
  res.json(job);
});

// ---------------------------------------------------------------------------
// Snapshots – možno ich načítať aj nahrať (napr. keď server nemá internet)
// ---------------------------------------------------------------------------
app.get('/api/sstz/snapshots', (req, res) => {
  res.json(listSnapshots());
});

app.get('/api/sstz/snapshot/:playerId', (req, res) => {
  const snapshot = loadSnapshot(req.params.playerId);
  if (!snapshot) return res.status(404).json({ error: 'Snapshot pre tohto hráča neexistuje.' });
  res.json({ ...snapshot, source: { ...(snapshot.source || {}), mode: 'snapshot' } });
});

app.post('/api/sstz/snapshot', (req, res) => {
  const profile = req.body;
  if (!profile?.id) return res.status(400).json({ error: 'Snapshot musí obsahovať "id" hráča.' });
  const file = saveSnapshot(profile);
  res.json({ ok: true, file, id: profile.id });
});

// ---------------------------------------------------------------------------
// Ligy, tabuľky, rozpisy
// ---------------------------------------------------------------------------
app.get('/api/sstz/all-leagues', async (req, res) => {
  try {
    const leagues = await cached('leagues', () => getAllSlovakLeagues());
    res.json(await leagues);
  } catch (err) {
    res.status(503).json({ error: err.message, offline: true });
  }
});

// spätná kompatibilita s pôvodným frontendom
app.get('/api/sstz/popular-leagues', (req, res) => {
  res.json([]);
});

app.get('/api/sstz/team-schedule', async (req, res) => {
  const { leagueSlug, clubId } = req.query;
  if (!leagueSlug) return res.status(400).json({ error: 'Chýba parameter: leagueSlug' });
  try {
    const data = await cached(`schedule:${leagueSlug}:${clubId || 'all'}`, () =>
      getTeamSchedule(leagueSlug.toString(), clubId ? clubId.toString() : null)
    );
    const result = await data;
    if (!result) return res.status(404).json({ error: 'Rozpis sa nenašiel.' });
    res.json(result);
  } catch (err) {
    res.status(503).json({ error: err.message, offline: true });
  }
});

app.get('/api/sstz/league/:slug', async (req, res) => {
  const { slug } = req.params;
  try {
    const data = await cached(`league:${slug}`, () => getLeagueData(slug));
    const result = await data;
    if (!result) return res.status(404).json({ error: `Liga ${slug} sa nenašla.` });
    res.json(result);
  } catch (err) {
    res.status(503).json({ error: err.message, offline: true });
  }
});

// ---------------------------------------------------------------------------
// Systémové info
// ---------------------------------------------------------------------------
app.get('/api/info', (req, res) => {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const k in interfaces) {
    for (const addr of interfaces[k]) {
      if (addr.family === 'IPv4' && !addr.internal) addresses.push(addr.address);
    }
  }
  const mainIp = addresses[0] || '127.0.0.1';
  res.json({
    status: 'ok',
    networkIp: mainIp,
    port: PORT,
    mobileViteUrl: `http://${mainIp}:5173/`,
    mobileServerUrl: `http://${mainIp}:${PORT}/`,
    sstz: { baseUrl: BASE_URL, online: connectivity.online, checkedAt: connectivity.checkedAt ? new Date(connectivity.checkedAt).toISOString() : null },
  });
});

// ---------------------------------------------------------------------------
// Frontend (dist) – ak existuje build
// ---------------------------------------------------------------------------
const distPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, '0.0.0.0', async () => {
    console.log(`SpinTrack SSTZ backend running on http://0.0.0.0:${PORT}`);
    const state = await checkConnectivity(true);
    if (state.online) {
      console.log(`SSTZ portál dostupný: ${BASE_URL}`);
    } else {
      console.warn(
        `SSTZ portál NEDOSTUPNÝ z tohto prostredia: ${state.error}\n` +
          'Aplikácia bude pracovať s uloženými snapshotmi (data/sstz) alebo zobrazí jasné upozornenie.'
      );
    }
  });
}

export default app;
