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
    for (const row of Array.isArray(local[key]) ? local[key] : [])
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
    current.scheduleConnected || local.scheduleConnected,
  );
  return merged;
}
