import type { ActivityRecord } from "../types/index";

export function trainingHasEnded(
  activity: ActivityRecord,
  now = new Date(),
): boolean {
  if (!activity.planned || activity.category !== "tréning") return false;
  const end = new Date(`${activity.date}T${activity.startTime || "23:59"}:00`);
  if (activity.startTime)
    end.setMinutes(end.getMinutes() + activity.durationMinutes);
  return end.getTime() <= now.getTime();
}
