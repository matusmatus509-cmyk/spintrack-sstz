import { test } from "node:test";
import assert from "node:assert/strict";
import { trainingHasEnded } from "../src/utils/training.ts";
import { mergeCandidates, mergeMatchNotes } from "../src/utils/matchMerge.ts";
import { publicActivity } from "../src/utils/community.ts";
import { getDiaryEntries } from "../src/utils/diary.ts";

test("planned training becomes due only after its end, with safe fallback for missing time", () => {
  const training = {
    category: "tréning",
    planned: true,
    date: "2026-10-18",
    startTime: "18:00",
    durationMinutes: 90,
  };
  assert.equal(
    trainingHasEnded(training, new Date(2026, 9, 18, 19, 29)),
    false,
  );
  assert.equal(trainingHasEnded(training, new Date(2026, 9, 18, 19, 30)), true);
  assert.equal(
    trainingHasEnded({ ...training, planned: false }, new Date(2026, 9, 19)),
    false,
  );
  assert.equal(
    trainingHasEnded({ ...training, startTime: "" }, new Date(2026, 9, 18, 12)),
    false,
  );
  assert.equal(
    trainingHasEnded({ ...training, startTime: "" }, new Date(2026, 9, 19)),
    true,
  );
});
test("manual and official matches offer merging despite date formats and accents, never across days", () => {
  const manual = {
    id: "manual",
    source: "manual",
    date: "2026-10-18",
    opponentName: "Ján Novák",
    score: "3:1",
    notes: "Moja poznámka",
    tacticsNote: "Krátke podanie",
    racketId: "r1",
    sourceActivityId: "a1",
  };
  const imported = {
    id: "sstz",
    source: "SSTZ",
    date: "18.10.2026",
    opponentName: "Jan Novak",
    score: "3:2",
    notes: "SSTZ",
    tacticsNote: "Starší postreh",
  };
  assert.equal(mergeCandidates([manual, imported]).length, 1);
  assert.equal(
    mergeCandidates([manual, { ...imported, date: "19.10.2026" }]).length,
    0,
  );
  assert.equal(mergeCandidates([manual, imported], ["manual|sstz"]).length, 0);
  const merged = mergeMatchNotes(manual, imported);
  assert.equal(merged.score, "3:2");
  assert.equal(merged.racketId, "r1");
  assert.equal(merged.sourceActivityId, "a1");
  assert.match(merged.notes, /Moja poznámka/);
  assert.match(merged.notes, /SSTZ/);
  assert.match(merged.tacticsNote, /Krátke podanie/);
  assert.match(merged.tacticsNote, /Starší postreh/);
});
test("reflection and training partners never enter a public activity payload; merged diary keeps private original", () => {
  const activity = {
    id: "a1",
    category: "liga",
    date: "2026-10-18",
    durationMinutes: 0,
    focusDrills: [],
    location: "Herňa",
    visibility: "friends",
    trainingPartners: "Privátne mená",
    trainingPartnerIds: ["friend"],
    reflection: { wentWell: "Výborne", improve: "Nohy", nextGoal: "Príjem" },
    privateNote: "Súkromné",
    linkedMatchId: "s1",
  };
  const payload = publicActivity(activity);
  for (const key of [
    "reflection",
    "trainingPartners",
    "trainingPartnerIds",
    "privateNote",
    "linkedMatchId",
  ])
    assert.equal(key in payload, false);
  const entries = getDiaryEntries(
    [activity],
    [{ id: "s1", source: "SSTZ", date: "18.10.2026", opponentName: "Súper" }],
    [],
  );
  assert.equal(entries.length, 1);
  assert.equal(entries[0].source, "sstz");
  assert.equal(entries[0].activity.privateNote, "Súkromné");
});

test("repeated tournament import retains the manual activity link and its annotations", async () => {
  const { replaceTournamentMatches } =
    await import("../src/utils/tournamentImport.ts");
  const old = {
    id: "official",
    source: "SSTZ_TOURNAMENT",
    notes: "Moja poznámka",
    tacticsNote: "Do BH",
    sourceActivityId: "a1",
    racketId: "r1",
  };
  const result = replaceTournamentMatches(
    [old],
    [{ id: "official", source: "SSTZ_TOURNAMENT", notes: "Oficiálny import" }],
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].sourceActivityId, "a1");
  assert.equal(result[0].notes, "Moja poznámka");
  assert.equal(result[0].racketId, "r1");
});
