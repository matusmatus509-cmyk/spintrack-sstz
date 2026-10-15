import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dashboardPeriod,
  dashboardAgenda,
} from "../src/utils/dashboardInsights.ts";
const now = new Date(2026, 9, 15, 12);
const training = (id, date, durationMinutes, extra = {}) => ({
  id,
  date,
  durationMinutes,
  category: "tréning",
  ...extra,
});
test("period includes both boundaries and excludes planned, future, invalid and non-training records", () => {
  const result = dashboardPeriod(
    [
      training("start", "9.10.2026", 45),
      training("end", "2026-10-15", 90),
      training("before", "2026-10-08", 120),
      training("after", "2026-10-16", 120),
      training("planned", "2026-10-15", 120, { planned: true }),
      training("match", "2026-10-15", 120, { category: "liga" }),
      training("invalid", "invalid", 120),
    ],
    [{ date: "9.10.2026" }, { date: "2026-10-15" }, { date: "2026-10-16" }],
    7,
    now,
  );
  assert.equal(result.minutes, 135);
  assert.equal(result.sessions, 2);
  assert.equal(result.buckets.length, 7);
  assert.equal(result.buckets[0].minutes, 45);
  assert.equal(result.buckets[6].minutes, 90);
  assert.equal(result.matches.length, 2);
});
test("30 and 90 day buckets include every day once across month boundaries", () => {
  for (const days of [30, 90]) {
    const entries = Array.from({ length: days }, (_, index) => {
      const date = new Date(2026, 9, 15 - index, 12);
      return training(
        String(index),
        `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
        60,
      );
    });
    const result = dashboardPeriod(entries, [], days, now);
    assert.equal(result.minutes, days * 60);
    assert.equal(result.sessions, days);
    assert.equal(result.buckets.length, 6);
    assert(result.buckets.every((item) => item.sessions === days / 6));
  }
});
test("agenda combines plans and fixtures chronologically, excludes completed and past, limits to three", () => {
  const result = dashboardAgenda(
    [
      training("today", "2026-10-15", 60, {
        planned: true,
        startTime: "18:00",
      }),
      training("done", "2026-10-15", 60),
      training("old", "2026-10-14", 60, { planned: true }),
      training("later", "2026-10-20", 60, { planned: true }),
      training("invalid", "bad", 60, { planned: true }),
    ],
    [
      { id: "morning", dateTime: "15.10.2026 9:00", isPlayed: false },
      { id: "tomorrow", dateTime: "2026-10-16T17:00", isPlayed: false },
      { id: "played", dateTime: "15.10.2026 08:00", isPlayed: true },
    ],
    now,
  );
  assert.deepEqual(
    result.map((item) => item.id),
    ["schedule-morning", "activity-today", "schedule-tomorrow"],
  );
});
