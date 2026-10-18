import type { ActivityRecord } from "../types/index";
import type { SharedActivityData } from "../types/community";
import { publicActivity } from "./community.ts";

export function sharedImportId(source: "club" | "community", id: string) {
  return `import-${source}-${id}`;
}
// Import is a personal plan, never an automatic claim of attendance or a result.
export function sharedImportData(
  data: SharedActivityData,
): Omit<ActivityRecord, "id" | "createdAt"> {
  return {
    ...publicActivity({
      ...data,
      visibility: "private",
      addEquipmentWear: false,
    }),
    focusDrills: data.focusDrills || [],
    location: data.location || "",
    durationMinutes: data.durationMinutes || 0,
    opponentName: undefined,
    matchScore: undefined,
    matchResult: undefined,
    placing: undefined,
    eventResult: undefined,
    planned: true,
    visibility: "private",
    addEquipmentWear: false,
  };
}
