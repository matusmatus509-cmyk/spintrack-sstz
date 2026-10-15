import type { ActivityRecord, TeamScheduleMatch } from "../types";
import type { InsightMatch } from "./matchInsights";
import { normalizeDiaryDate } from "./diary.ts";

// Calendar arithmetic uses local noon, including across daylight-saving changes.
export function dayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function dashboardPeriod(
  activities: ActivityRecord[],
  matches: InsightMatch[],
  days: number,
  now = new Date(),
) {
  const end = dayKey(now);
  const startDate = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - days + 1,
    12,
  );
  const start = dayKey(startDate);
  const bucketDays = days === 7 ? 1 : days === 30 ? 5 : 15;
  const buckets = Array.from(
    { length: Math.ceil(days / bucketDays) },
    (_, index) => {
      const from = new Date(startDate);
      from.setDate(from.getDate() + index * bucketDays);
      const to = new Date(from);
      to.setDate(to.getDate() + bucketDays - 1);
      return {
        from: dayKey(from),
        to: dayKey(to) > end ? end : dayKey(to),
        minutes: 0,
        sessions: 0,
      };
    },
  );
  for (const activity of activities) {
    const date = normalizeDiaryDate(activity.date);
    if (
      activity.planned ||
      activity.category !== "tréning" ||
      date < start ||
      date > end
    )
      continue;
    const bucket = buckets.find((item) => date >= item.from && date <= item.to);
    if (bucket) {
      bucket.minutes += Math.max(0, Number(activity.durationMinutes) || 0);
      bucket.sessions++;
    }
  }
  return {
    buckets,
    minutes: buckets.reduce((sum, item) => sum + item.minutes, 0),
    sessions: buckets.reduce((sum, item) => sum + item.sessions, 0),
    matches: matches.filter((match) => {
      const date = normalizeDiaryDate(match.date);
      return date >= start && date <= end;
    }),
  };
}

export function dashboardAgenda(
  activities: ActivityRecord[],
  schedule: TeamScheduleMatch[],
  now = new Date(),
) {
  const today = dayKey(now);
  return [
    ...activities
      .filter((item) => item.planned)
      .map((item) => ({
        id: `activity-${item.id}`,
        date: normalizeDiaryDate(item.date),
        time: item.startTime?.padStart(5, "0") || "",
        title:
          item.title ||
          (item.opponentName
            ? `Zápas proti ${item.opponentName}`
            : item.category === "tréning"
              ? "Tréning pri stole"
              : item.leagueName || "Plánovaná aktivita"),
        detail: item.location || item.leagueName || "Vlastný plán",
        category: item.category,
      })),
    ...schedule
      .filter((item) => !item.isPlayed)
      .map((item) => ({
        id: `schedule-${item.id}`,
        date: normalizeDiaryDate(item.dateTime),
        time:
          item.dateTime
            .match(/(?:T|\s)(\d{1,2}:\d{2})/)?.[1]
            ?.padStart(5, "0") || "",
        title: `${item.homeTeam} – ${item.awayTeam}`,
        detail: item.round || "Ligový zápas",
        category: "liga",
      })),
  ]
    .filter((item) => item.date >= today)
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        (a.time || "99:99").localeCompare(b.time || "99:99"),
    )
    .slice(0, 3);
}
