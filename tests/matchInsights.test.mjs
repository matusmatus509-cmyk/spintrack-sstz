import { test } from "node:test";
import assert from "node:assert/strict";
import {
  allInsightMatches,
  summarizeMatches,
  groupMatchResults,
  matchSeason,
  matchCompetition,
} from "../src/utils/matchInsights.ts";
const single = {
  id: "a",
  date: "9.10.2026",
  season: "2026/27",
  leagueName: "3. liga",
  competition: "Liga",
  result: "WIN",
  opponentName: "Súper",
  score: "3:0",
  sets: [],
};
const double = {
  ...single,
  date: "2026-10-10",
  result: "LOSS",
  opponentPair: "A / B",
  partnerName: "Partner",
  type: "doubles",
};
test("results include singles and doubles, deduplicate within discipline and sort both date formats", () => {
  const matches = allInsightMatches([single, single], [double]);
  assert.equal(matches.length, 2);
  assert.equal(matches[0], double);
  assert.deepEqual(summarizeMatches(matches), {
    played: 2,
    wins: 1,
    losses: 1,
    rate: 50,
  });
});
test("parallel leagues in one season remain separate and tournaments use their event name", () => {
  const second = { ...single, id: "b", leagueName: "4. liga", result: "LOSS" };
  const tournament = {
    ...single,
    id: "c",
    source: "SSTZ_TOURNAMENT",
    tournamentName: "Open",
    season: undefined,
  };
  const rows = [single, second, tournament];
  assert.deepEqual(
    groupMatchResults(rows, matchCompetition).map((row) => row.label),
    ["3. liga", "4. liga", "Open"],
  );
  assert.equal(
    groupMatchResults(rows, matchSeason).find((row) => row.label === "2026/27")
      .rate,
    50,
  );
  assert.equal(matchSeason(tournament), "Bez sezóny");
  assert.equal(summarizeMatches([]).rate, null);
});
