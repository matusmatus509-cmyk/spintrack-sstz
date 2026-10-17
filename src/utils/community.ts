import type { ActivityRecord } from "../types/index";
import type { SharedActivityData } from "../types/community";

// An explicit allowlist also protects the payload before it reaches the database.
export function publicActivity(
  activity: Omit<ActivityRecord, "id" | "createdAt">,
): SharedActivityData {
  const {
    category,
    date,
    startTime,
    durationMinutes,
    focusDrills,
    location,
    title,
    publicNote,
    opponentName,
    matchScore,
    matchResult,
    leagueName,
    teamHome,
    teamAway,
    round,
    eventCategory,
    placing,
    eventResult,
  } = activity;
  return {
    category,
    date,
    startTime,
    durationMinutes,
    focusDrills,
    location,
    title,
    publicNote,
    opponentName,
    matchScore,
    matchResult,
    leagueName,
    teamHome,
    teamAway,
    round,
    eventCategory,
    placing,
    eventResult,
  };
}
export const emptyAccountData = () => ({
  blades: [],
  rubbers: [],
  rackets: [],
  activeRacketId: "",
  activities: [],
  trainingSessions: [],
  matches: [],
  doublesMatches: [],
  opponents: [],
  sstzProfile: null,
  tournamentProfile: null,
  teamSchedule: [],
  selectedClubId: "",
  scheduleConnected: false,
});

export const LOCAL_DIARY_KEY = "spintrack_sstz_data_v1";

export function parseLocalDiary(raw: string): Record<string, any> {
  const data = JSON.parse(raw);
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new Error("Neplatná miestna záloha.");
  for (const key of ["activities", "trainingSessions", "matches", "doublesMatches", "blades", "rubbers", "rackets", "opponents", "teamSchedule", "badges"]) {
    if (data[key] !== undefined && (!Array.isArray(data[key]) || data[key].some(
      (row: any) => !row || typeof row !== "object" || typeof row.id !== "string" || !row.id,
    ))) throw new Error("Neplatná miestna záloha.");
  }
  return data;
}

function localActivities(local: Record<string, any>) {
  // Older diaries only had trainingSessions. An explicit modern activities: []
  // represents a deliberately empty diary and must not resurrect deleted items.
  if (Array.isArray(local.activities)) return local.activities;
  return (local.trainingSessions || []).map((session: any) => ({
    id: session.id,
    category: "tréning",
    date: session.date?.split("T")[0],
    durationMinutes: session.durationMinutes ?? 60,
    focusDrills: session.focusDrills || [],
    location: session.location || "",
    privateNote: session.notes || "",
    visibility: "private",
    addEquipmentWear: false,
    racketId: session.racketId,
    intensity: session.intensity,
    createdAt: session.date,
  }));
}

export function localRecoverySummary(current: Record<string, any>, local: Record<string, any>) {
  const missing = (key: string, rows = local[key] || []) => {
    const ids = new Set((current[key] || []).map((row: any) => row.id));
    return rows.filter((row: any) => !ids.has(row.id)).length;
  };
  const activities = missing("activities", localActivities(local));
  const matches = missing("matches") + missing("doublesMatches");
  const sstz = Boolean(!current.sstzProfile && local.sstzProfile);
  const equipment = missing("blades") + missing("rubbers") + missing("rackets");
  const other = missing("opponents") + missing("teamSchedule") + Boolean(!current.tournamentProfile && local.tournamentProfile);
  return { activities, matches, sstz, equipment, available: Boolean(activities || matches || sstz || equipment || other) };
}

export function prepareLocalRecovery(
  storage: Pick<Storage, "getItem" | "setItem">,
  ownerId: string,
  currentRaw: string,
) {
  const raw = storage.getItem(LOCAL_DIARY_KEY);
  if (!raw) throw new Error("Miestna kópia už nie je dostupná. Otvor pôvodnú adresu aplikácie.");
  const local = parseLocalDiary(raw);
  const merged = mergeLocalData(parseLocalDiary(currentRaw), local);
  // Do not start the import if its safety snapshot cannot be persisted.
  storage.setItem(`spintrack_before_recovery_${ownerId}`, currentRaw);
  return merged;
}

// Migration is explicit. Never silently publish old local records marked community.
export function mergeLocalData(
  current: Record<string, any>,
  local: Record<string, any>,
) {
  const merged = { ...local, ...current };
  for (const key of [
    "blades",
    "rubbers",
    "rackets",
    "activities",
    "trainingSessions",
    "matches",
    "doublesMatches",
    "opponents",
    "teamSchedule",
    "badges",
  ]) {
    const entries = new Map<string, any>();
    for (const row of key === "activities" ? localActivities(local) : Array.isArray(local[key]) ? local[key] : [])
      entries.set(
        row.id,
        key === "activities" ? { ...row, visibility: "private" } : { ...row },
      );
    for (const row of Array.isArray(current[key]) ? current[key] : [])
      entries.set(row.id, { ...row });
    merged[key] = [...entries.values()];
  }
  for (const key of [
    "sstzProfile",
    "tournamentProfile",
    "activeRacketId",
    "selectedClubId",
    "selectedLeagueSlug",
  ]) {
    merged[key] = current[key] || local[key];
  }
  merged.scheduleConnected = Boolean(
    (current.scheduleConnected ?? current.teamSchedule?.length) ||
    (local.scheduleConnected ?? local.teamSchedule?.length),
  );
  // A fresh account has a default league slug even though it has no SSTZ link.
  // That default must not override the restored player's league selection.
  if (!current.sstzProfile && !current.scheduleConnected && !current.teamSchedule?.length)
    merged.selectedLeagueSlug = local.selectedLeagueSlug || current.selectedLeagueSlug;
  if (!(current.rackets || []).some((racket: any) => racket.id === current.activeRacketId))
    merged.activeRacketId = local.activeRacketId || current.activeRacketId;
  return merged;
}
