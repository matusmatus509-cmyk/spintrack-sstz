import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import {
  searchSSTZ,
  getPlayerProfile,
  getTeamSchedule,
  getLeagueData,
  getPopularLeagues,
  getAllSlovakLeagues
} from './sstzScraper.js';
import { loadSnapshot, listSnapshots } from './sstzStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Omnisearch
app.get('/api/sstz/search', async (req, res) => {
  const query = req.query.q;
  if (!query) {
    return res.status(400).json({ error: 'Missing query parameter "q"' });
  }
  try {
    const results = await searchSSTZ(query.toString());
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Player profile (supports ?allSeasons=true)
app.get('/api/sstz/player/:id', async (req, res) => {
  const { id } = req.params;
  const allSeasons = req.query.allSeasons === 'true';
  try {
    const profile = await getPlayerProfile(id, { allSeasons });
    if (!profile) {
      return res.status(404).json({ error: `Player ${id} not found` });
    }
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Team schedule / calendar (supports specific club or entire league)
app.get('/api/sstz/team-schedule', async (req, res) => {
  const { leagueSlug, clubId } = req.query;
  if (!leagueSlug) {
    return res.status(400).json({ error: 'Missing parameter: leagueSlug' });
  }
  try {
    const schedule = await getTeamSchedule(leagueSlug.toString(), clubId ? clubId.toString() : null);
    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    res.json(schedule);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// League info & standings
app.get('/api/sstz/league/:slug', async (req, res) => {
  const { slug } = req.params;
  try {
    const data = await getLeagueData(slug);
    if (!data) {
      return res.status(404).json({ error: `League ${slug} not found` });
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// All leagues grouped by region
app.get('/api/sstz/all-leagues', async (req, res) => {
  try {
    const leagues = await getAllSlovakLeagues();
    res.json(leagues);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Default player profile (Matúš Očovan #5353024)
app.get('/api/sstz/default-player', (req, res) => {
  const snapshot = loadSnapshot('5353024');
  if (snapshot) {
    return res.json(snapshot);
  }
  res.status(404).json({ error: 'Default player snapshot not found' });
});

// Direct snapshot by player ID
app.get('/api/sstz/snapshot/:id', (req, res) => {
  const { id } = req.params;
  const snapshot = loadSnapshot(id);
  if (snapshot) {
    return res.json(snapshot);
  }
  res.status(404).json({ error: `Snapshot for player ${id} not found` });
});

// List all available snapshots
app.get('/api/sstz/snapshots', (req, res) => {
  res.json(listSnapshots());
});

// System info & local mobile IP detection
app.get('/api/info', (req, res) => {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const k in interfaces) {
    for (const addr of interfaces[k]) {
      if (addr.family === 'IPv4' && !addr.internal) {
        addresses.push(addr.address);
      }
    }
  }
  const mainIp = addresses[0] || '127.0.0.1';
  res.json({
    status: 'ok',
    networkIp: mainIp,
    port: PORT,
    mobileViteUrl: `http://${mainIp}:5173/`,
    mobileServerUrl: `http://${mainIp}:${PORT}/`
  });
});

// Popular leagues list
app.get('/api/sstz/popular-leagues', (req, res) => {
  res.json(getPopularLeagues());
});

// Serve frontend dist if available
const distPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SpinTrack SSTZ backend running on http://0.0.0.0:${PORT}`);
    console.log(`Mobile access ready: http://localhost:${PORT}`);
  });
}

export default app;
