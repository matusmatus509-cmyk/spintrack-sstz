import type { MatchRecord, DoublesMatchRecord } from "../types";
import { normalizeDiaryDate } from "./diary.ts";
export type InsightMatch = MatchRecord | DoublesMatchRecord;
export const matchSeason = (match: InsightMatch) =>
  match.season?.trim() || "Bez sezóny";
export const matchCompetition = (match: InsightMatch) =>
  match.source === "SSTZ_TOURNAMENT"
    ? match.tournamentName || "Turnaj"
    : match.leagueName || match.competition || "Nezaradené zápasy";
export const matchOpponent = (match: InsightMatch) =>
  "opponentPair" in match ? match.opponentPair : match.opponentName;
export const matchKey = (match: InsightMatch) =>
  `${"opponentPair" in match ? "doubles" : "singles"}:${match.id}`;
export function allInsightMatches(
  singles: MatchRecord[],
  doubles: DoublesMatchRecord[],
): InsightMatch[] {
  const unique = new Map<string, InsightMatch>();
  for (const match of [...singles, ...doubles])
    unique.set(matchKey(match), match);
  return [...unique.values()].sort((a, b) =>
    normalizeDiaryDate(b.date).localeCompare(normalizeDiaryDate(a.date)),
  );
}
export function summarizeMatches(matches: InsightMatch[]) {
  const played = matches.length;
  const wins = matches.filter((match) => match.result === "WIN").length;
  return {
    played,
    wins,
    losses: played - wins,
    rate: played ? Math.round((wins / played) * 100) : null,
  };
}
export function groupMatchResults(
  matches: InsightMatch[],
  getLabel: (match: InsightMatch) => string,
) {
  const groups = new Map<string, InsightMatch[]>();
  for (const match of matches) {
    const label = getLabel(match);
    groups.set(label, [...(groups.get(label) || []), match]);
  }
  return [...groups.entries()].map(([label, records]) => ({
    label,
    ...summarizeMatches(records),
  }));
}
export const searchMatchText = (value: string) =>
  value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
