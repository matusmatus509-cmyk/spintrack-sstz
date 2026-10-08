import { getPlayerProfile } from '../server/sstzScraper.js';

// Use the same complete importer as the API, for any SSTZ player.
const playerId = process.argv[2];
if (!playerId || !/^\d+$/.test(playerId)) {
  console.error('Použitie: node scripts/generate-snapshot.mjs <SSTZ ID hráča>');
  process.exitCode = 1;
} else {
  try {
    const profile = await getPlayerProfile(playerId);
    console.log(`${profile.name}: ${profile.totalMatches} dvojhier, ${profile.totalDoublesMatches} štvorhier; ${profile.syncedSeasonsCount} overených sezón.`);
  } catch (error) {
    console.error(`Snapshot nebol aktualizovaný: ${error.message}`);
    process.exitCode = 1;
  }
}
