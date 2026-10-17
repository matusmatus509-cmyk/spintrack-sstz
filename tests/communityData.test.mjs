import { test } from "node:test";
import assert from "node:assert/strict";
import {
  publicActivity,
  emptyAccountData,
  mergeLocalData,
  parseLocalDiary,
  localRecoverySummary,
  prepareLocalRecovery,
  LOCAL_DIARY_KEY,
} from "../src/utils/community.ts";

test("sharing excludes private notes, photos and equipment while retaining training details", () => {
  const input = {
    category: "tréning",
    date: "2026-10-20",
    startTime: "18:30",
    durationMinutes: 90,
    location: "Hala",
    focusDrills: ["FH"],
    visibility: "friends",
    publicNote: "Let us train",
    privateNote: "Private tactics",
    photos: ["private photo"],
    racketId: "private-racket",
    addEquipmentWear: true,
  };
  const shared = publicActivity(input);
  assert.equal(shared.startTime, "18:30");
  assert.equal(shared.publicNote, "Let us train");
  for (const key of [
    "privateNote",
    "photos",
    "racketId",
    "addEquipmentWear",
    "visibility",
  ])
    assert.ok(!(key in shared));
});

test("a new signed-in account can recover the complete local diary and SSTZ selection", () => {
  const local = {
    activities: Array.from({ length: 120 }, (_, n) => ({ id: `training-${n}`, visibility: "community", privateNote: "personal" })),
    matches: Array.from({ length: 300 }, (_, n) => ({ id: `match-${n}`, score: "3:1" })),
    doublesMatches: [{ id: "doubles-local" }],
    rackets: [{ id: "racket-1" }, { id: "racket-2" }],
    activeRacketId: "racket-2",
    sstzProfile: { id: "my-sstz-player", matches: [{ id: "career" }] },
    selectedLeagueSlug: "my-real-league",
    selectedClubId: "my-club",
    scheduleConnected: true,
    teamSchedule: [{ id: "league-fixture" }],
  };
  const raw = JSON.stringify(local);
  const current = { ...emptyAccountData(), activeRacketId: "racket-1", selectedLeagueSlug: "default-league" };
  assert.deepEqual(localRecoverySummary(current, parseLocalDiary(raw)), {
    activities: 120, matches: 301, sstz: true, equipment: 2, available: true,
  });
  const merged = mergeLocalData(current, parseLocalDiary(raw));
  assert.equal(merged.activities.length, 120);
  assert.ok(merged.activities.every(row => row.visibility === "private"));
  assert.equal(merged.activities[0].privateNote, "personal");
  assert.equal(merged.matches.length, 300);
  assert.deepEqual(merged.sstzProfile, local.sstzProfile);
  assert.equal(merged.selectedLeagueSlug, "my-real-league");
  assert.equal(merged.selectedClubId, "my-club");
  assert.equal(merged.activeRacketId, "racket-2");
  assert.equal(merged.scheduleConnected, true);
  assert.equal(localRecoverySummary(merged, local).available, false);
  assert.equal(JSON.stringify(local), raw, "the original local backup is never modified");
  assert.deepEqual(mergeLocalData(merged, local), merged, "retry cannot duplicate history");
});

test("legacy training-only diaries recover into the visible activities list without exposing notes", () => {
  const local = { trainingSessions: [{ id: "old-training", date: "2025-01-02T18:00:00Z", durationMinutes: 75, notes: "private tactics" }] };
  const merged = mergeLocalData(emptyAccountData(), parseLocalDiary(JSON.stringify(local)));
  assert.equal(merged.activities.length, 1);
  assert.equal(merged.activities[0].date, "2025-01-02");
  assert.equal(merged.activities[0].durationMinutes, 75);
  assert.equal(merged.activities[0].visibility, "private");
  assert.equal(merged.activities[0].privateNote, "private tactics");
  assert.equal(merged.activities[0].publicNote, undefined);
  assert.equal(merged.activities[0].addEquipmentWear, false, "recovery never reapplies equipment wear");
  assert.equal(mergeLocalData(emptyAccountData(), { ...local, activities: [] }).activities.length, 0,
    "an explicitly emptied modern diary must not resurrect removed training sessions");
});

test("recovery preserves a populated account, including its SSTZ identity and equipment", () => {
  const current = { ...emptyAccountData(), activities: [{ id: "same", visibility: "friends", privateNote: "newer" }],
    rackets: [{ id: "mine" }], activeRacketId: "mine", sstzProfile: { id: "account-player" }, selectedLeagueSlug: "account-league" };
  const local = { activities: [{ id: "same", privateNote: "older" }, { id: "extra" }], sstzProfile: { id: "local-player" }, selectedLeagueSlug: "local-league" };
  const merged = mergeLocalData(current, local);
  assert.equal(merged.activities.length, 2);
  assert.deepEqual(merged.activities[0], current.activities[0]);
  assert.equal(merged.sstzProfile.id, "account-player");
  assert.equal(merged.selectedLeagueSlug, "account-league");
  assert.equal(merged.activeRacketId, "mine");
});

test("invalid local backup cannot be merged into the account", () => {
  for (const raw of ["null", "[]", "42", '{"activities":{}}', '{"matches":[null]}', '{"rackets":[{}]}'])
    assert.throws(() => parseLocalDiary(raw), /Neplatná/);
});

test("legacy team schedule restores its connected status", () => {
  const merged = mergeLocalData(emptyAccountData(), { teamSchedule: [{ id: "fixture" }], selectedLeagueSlug: "local-league" });
  assert.equal(merged.scheduleConnected, true);
  assert.equal(merged.selectedLeagueSlug, "local-league");
});

test("recovery backs up the current account without modifying its original guest storage", () => {
  const guest = JSON.stringify({ matches: [{ id: "old-match" }] });
  const current = JSON.stringify({ ...emptyAccountData(), matches: [{ id: "just-added" }] });
  const values = new Map([[LOCAL_DIARY_KEY, guest]]);
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const restored = prepareLocalRecovery(storage, "my-account", current);
  assert.equal(values.get(LOCAL_DIARY_KEY), guest);
  assert.equal(values.get("spintrack_before_recovery_my-account"), current);
  assert.deepEqual(restored.matches.map(row => row.id), ["old-match", "just-added"]);
});

test("recovery stops before import when storage is full or the guest backup is corrupt", () => {
  const current = JSON.stringify(emptyAccountData());
  const full = { getItem: () => '{"matches":[{"id":"old-match"}]}', setItem: () => { throw new Error("quota"); } };
  assert.throws(() => prepareLocalRecovery(full, "owner", current), /quota/);
  let writes = 0;
  const corrupt = { getItem: () => '{"activities":[null]}', setItem: () => { writes++; } };
  assert.throws(() => prepareLocalRecovery(corrupt, "owner", current), /Neplatná/);
  assert.equal(writes, 0);
});
test("local migration merges identities without duplicating or overwriting existing account records", () => {
  const existing = {
    ...emptyAccountData(),
    activities: [
      { id: "same", visibility: "friends", publicNote: "account wins" },
    ],
    matches: [{ id: "remote", score: "3:0" }],
  };
  const local = {
    activities: [
      { id: "same", visibility: "community", publicNote: "older" },
      { id: "local", visibility: "community" },
    ],
    matches: [{ id: "localmatch" }],
    sstzProfile: { id: "player" },
  };
  const merged = mergeLocalData(existing, local);
  assert.equal(merged.activities.length, 2);
  assert.equal(
    merged.activities.find((a) => a.id === "same").publicNote,
    "account wins",
  );
  assert.equal(
    merged.activities.find((a) => a.id === "same").visibility,
    "friends",
  );
  assert.equal(
    merged.activities.find((a) => a.id === "local").visibility,
    "private",
  );
  assert.equal(merged.matches.length, 2);
  assert.equal(merged.sstzProfile.id, "player");
  assert.deepEqual(
    mergeLocalData(merged, local),
    merged,
    "repeated migration is idempotent",
  );
  assert.equal(
    local.activities[1].visibility,
    "community",
    "original local data is untouched",
  );
});
