import type { ActivityRecord, MatchRecord, DoublesMatchRecord } from "../types";
import { normalizeDiaryDate } from "./diary.ts";
import { allInsightMatches } from "./matchInsights.ts";

export interface Recap {
  id: string;
  kind: "month" | "year";
  minutes: number;
  trainings: number;
  played: number;
  wins: number;
  losses: number;
  rate: number | null;
  leagueMatches: number;
  leagues: number;
  tournaments: number;
  activeDays: number;
  bars: { label: string; minutes: number }[];
}
export function currentMonth(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Europe/Bratislava",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  return `${parts.find((p) => p.type === "year")!.value}-${parts.find((p) => p.type === "month")!.value}`;
}
export function recapLabel(id: string) {
  return id.length === 4
    ? `Rok ${id}`
    : new Intl.DateTimeFormat("sk", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(`${id}-01T12:00:00Z`));
}
export function buildRecaps(
  activities: ActivityRecord[],
  singles: MatchRecord[],
  doubles: DoublesMatchRecord[],
  month = currentMonth(),
): Recap[] {
  const completed = activities.filter(
    (a) => !a.planned && normalizeDiaryDate(a.date),
  );
  const matches = allInsightMatches(singles, doubles).filter((m) =>
    normalizeDiaryDate(m.date),
  );
  const dates = [...completed, ...matches]
    .map((a) => normalizeDiaryDate(a.date))
    .filter((d) => d.slice(0, 7) < month)
    .sort();
  if (!dates.length) return [];
  const ids: string[] = [];
  let cursor = dates[0].slice(0, 7);
  while (cursor < month) {
    ids.push(cursor);
    const [y, m] = cursor.split("-").map(Number);
    cursor =
      m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  }
  for (
    let year = Number(dates[0].slice(0, 4));
    year < Number(month.slice(0, 4));
    year++
  )
    ids.push(String(year));
  return ids
    .sort()
    .reverse()
    .map((id) => {
      const inPeriod = (date: string) =>
        normalizeDiaryDate(date).startsWith(id);
      const acts = completed.filter((a) => inPeriod(a.date));
      const played = matches.filter((m) => inPeriod(m.date));
      // A diary entry linked to a match must not count as a second result.
      const extra = acts.filter(
        (a) =>
          a.matchResult &&
          !matches.some(
            (m) =>
              m.id === a.linkedMatchId ||
              ("sourceActivityId" in m && m.sourceActivityId === a.id),
          ),
      );
      const training = acts.filter((a) => a.category === "tréning");
      const minutes = (a: ActivityRecord) =>
        Number.isFinite(a.durationMinutes) ? Math.max(0, a.durationMinutes) : 0;
      const league = played.filter(
        (m) =>
          m.source !== "SSTZ_TOURNAMENT" &&
          (m.source === "SSTZ" ||
            /liga|league/i.test(m.competition || "") ||
            !!m.leagueName),
      );
      const leagueActs = acts.filter((a) => a.category === "liga");
      const tournamentKeys = new Set(
        played
          .filter((m) => m.source === "SSTZ_TOURNAMENT" || m.tournamentName)
          .map(
            (m) =>
              m.tournamentId ||
              `${normalizeDiaryDate(m.date)}:${m.tournamentName}`,
          ),
      );
      for (const a of acts.filter((a) => a.category === "turnaj")) {
        if (
          !played.some(
            (m) =>
              m.id === a.linkedMatchId ||
              ("sourceActivityId" in m && m.sourceActivityId === a.id) ||
              (normalizeDiaryDate(m.date) === normalizeDiaryDate(a.date) &&
                m.tournamentName === a.title),
          )
        )
          tournamentKeys.add(
            a.sourceEventId ||
              `${normalizeDiaryDate(a.date)}:${a.title || "Turnaj"}`,
          );
      }
      const wins =
        played.filter((m) => m.result === "WIN").length +
        extra.filter((a) => a.matchResult === "WIN").length;
      const count = played.length + extra.length;
      const year = id.length === 4;
      const days = year
        ? 12
        : new Date(Number(id.slice(0, 4)), Number(id.slice(5)), 0).getDate();
      const bars = Array.from(
        { length: year ? 12 : Math.ceil(days / 7) },
        (_, i) => ({
          label: year
            ? new Intl.DateTimeFormat("sk", {
                month: "short",
                timeZone: "UTC",
              }).format(new Date(Date.UTC(2020, i, 1)))
            : `${i * 7 + 1}. – ${Math.min(days, (i + 1) * 7)}.`,
          minutes: training
            .filter((a) => {
              const d = normalizeDiaryDate(a.date);
              return year
                ? Number(d.slice(5, 7)) === i + 1
                : Math.floor((Number(d.slice(8)) - 1) / 7) === i;
            })
            .reduce((sum, a) => sum + minutes(a), 0),
        }),
      );
      return {
        id,
        kind: year ? "year" : "month",
        minutes: training.reduce((sum, a) => sum + minutes(a), 0),
        trainings: training.length,
        played: count,
        wins,
        losses: count - wins,
        rate: count ? Math.round((100 * wins) / count) : null,
        leagueMatches:
          league.length + extra.filter((a) => a.category === "liga").length,
        leagues: new Set(
          [
            ...league.map((m) => m.leagueName || m.competition),
            ...leagueActs.map((a) => a.leagueName),
          ].filter(Boolean),
        ).size,
        tournaments: tournamentKeys.size,
        activeDays: new Set(
          [...acts, ...played].map((a) => normalizeDiaryDate(a.date)),
        ).size,
        bars,
      };
    });
}
