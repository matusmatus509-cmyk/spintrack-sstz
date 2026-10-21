import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRecaps, currentMonth } from "../src/utils/recaps.ts";
const activity = (id, date, extra = {}) => ({
  id,
  date,
  category: "tréning",
  durationMinutes: 60,
  ...extra,
});
const match = (id, date, extra = {}) => ({
  id,
  date,
  result: "WIN",
  source: "SSTZ",
  leagueName: "3. liga",
  ...extra,
});
test("closed months include leap day, exclude plans/current month, normalize SSTZ dates and keep zero months", () => {
  const all = buildRecaps(
    [
      activity("a", "29.2.2024", { durationMinutes: 90 }),
      activity("b", "2024-02-01", { planned: true }),
      activity("c", "2024-04-01"),
      activity("d", "invalid"),
    ],
    [],
    [],
    "2024-04",
  );
  assert.deepEqual(
    all.map((r) => r.id),
    ["2024-03", "2024-02"],
  );
  assert.equal(all[0].minutes, 0);
  assert.equal(all[1].minutes, 90);
  assert.equal(all[1].bars[4].minutes, 90);
  assert.equal(all[1].rate, null);
});
test("counts singles, doubles and standalone diary results once; distinct leagues and tournaments", () => {
  const [r] = buildRecaps(
    [
      activity("linked", "2026-09-01", {
        category: "liga",
        linkedMatchId: "s",
        matchResult: "WIN",
      }),
      activity("manual", "2026-09-02", {
        category: "liga",
        leagueName: "4. liga",
        matchResult: "LOSS",
      }),
      activity("training", "2026-09-02"),
    ],
    [
      match("s", "1.9.2026"),
      match("s", "1.9.2026"),
      match("t", "2026-09-03", {
        source: "SSTZ_TOURNAMENT",
        tournamentId: "event",
        tournamentName: "Open",
        leagueName: undefined,
      }),
    ],
    [
      match("d", "2026-09-03", {
        source: "SSTZ_TOURNAMENT",
        tournamentId: "event",
        tournamentName: "Open",
        opponentPair: "A/B",
        result: "LOSS",
        leagueName: undefined,
      }),
    ],
    "2026-10",
  );
  assert.equal(r.played, 4);
  assert.equal(r.wins, 2);
  assert.equal(r.rate, 50);
  assert.equal(r.leagueMatches, 2);
  assert.equal(r.leagues, 2);
  assert.equal(r.tournaments, 1);
  assert.equal(r.activeDays, 3);
  assert.equal(r.minutes, 60);
});
test("January generates prior year; yearly totals equal monthly totals and edits recalculate", () => {
  const a = [
    activity("a", "2025-01-02"),
    activity("b", "2025-12-31", { durationMinutes: 120 }),
    activity("bad", "2025-02-03", { durationMinutes: -2 }),
  ];
  const all = buildRecaps(a, [match("s", "2025-12-31")], [], "2026-01");
  const year = all.find((r) => r.id === "2025");
  assert.equal(year.minutes, 180);
  assert.equal(year.played, 1);
  assert.equal(year.bars.length, 12);
  assert.equal(year.bars[11].minutes, 120);
  assert.equal(
    year.minutes,
    all.filter((r) => r.kind === "month").reduce((s, r) => s + r.minutes, 0),
  );
  assert.equal(
    buildRecaps(a.slice(1), [], [], "2026-01").find((r) => r.id === "2025")
      .minutes,
    120,
  );
});
test("rollover uses Bratislava timezone rather than device timezone", () => {
  assert.equal(currentMonth(new Date("2026-10-31T23:30:00Z")), "2026-11");
  assert.equal(currentMonth(new Date("2026-09-30T22:30:00Z")), "2026-10");
  assert.deepEqual(buildRecaps([], [], [], "2026-10"), []);
});
