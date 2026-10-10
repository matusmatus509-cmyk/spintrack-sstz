import { test } from "node:test";
import assert from "node:assert/strict";
import {
  publicActivity,
  emptyAccountData,
  mergeLocalData,
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
