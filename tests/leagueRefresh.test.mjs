import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeLeagueRefresh } from "../src/utils/leagueRefresh.ts";
test("current-season replacement retains history, removes outdated current results and deduplicates", () => {
  const profile = {
    id: "1",
    isAllSeasons: true,
    seasonsBreakdown: [{ season: "2025/26" }, { season: "2026/27" }],
  };
  const old = [
    {
      id: "sstz-old",
      sstzMatchId: "old",
      source: "SSTZ",
      season: "2025/26",
      result: "LOSS",
    },
    { id: "sstz-obsolete", source: "SSTZ", season: "2026/27", result: "WIN" },
    { id: "manual", source: "manual", season: "2025/26", result: "WIN" },
  ];
  const data = {
    id: 1,
    seasonsBreakdown: [{ season: "2026/27" }],
    matches: [{ id: "new", season: "2026/27", result: "WIN" }],
    doublesMatches: [],
  };
  const r = mergeLeagueRefresh(data, profile, old, []);
  assert.deepEqual(
    r.matches.map((m) => m.id),
    ["old", "new"],
  );
  assert.equal(r.singlesStats.played, 2);
  assert.equal(r.singlesStats.winRate, 50);
  assert.equal(r.isAllSeasons, true);
  assert.equal(r.seasonsBreakdown.length, 2);
  assert.throws(() =>
    mergeLeagueRefresh({ ...data, seasonsBreakdown: [] }, profile, old, []),
  );
  assert.throws(() => mergeLeagueRefresh({ ...data, id: 2 }, profile, old, []));
});
