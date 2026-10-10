import type { ActivityRecord } from "./index";
export interface PlayerProfile {
  id: string;
  display_name: string;
  handle: string;
  club: string;
}
export type SharedActivityData = Pick<
  ActivityRecord,
  | "category"
  | "date"
  | "durationMinutes"
  | "focusDrills"
  | "location"
  | "startTime"
  | "title"
  | "publicNote"
  | "opponentName"
  | "matchScore"
  | "matchResult"
  | "leagueName"
  | "teamHome"
  | "teamAway"
  | "round"
  | "eventCategory"
  | "placing"
  | "eventResult"
>;
export interface SharedActivity {
  id: string;
  owner_id: string;
  local_id: string;
  visibility: ActivityRecord["visibility"];
  activity_date: string;
  created_at: string;
  payload: SharedActivityData;
  author: PlayerProfile;
}
export interface FriendRequest {
  id: string;
  requester_id: string;
  recipient_id: string;
  status: "pending" | "accepted";
  requester: PlayerProfile;
  recipient: PlayerProfile;
}
export interface ActivityInvitation {
  id: string;
  activity_id: string;
  recipient_id: string;
  status: "pending" | "accepted" | "declined";
  activity: SharedActivity | null;
}
export interface CalendarEntry {
  id: string;
  source_activity_id: string | null;
  activity_date: string;
  data: SharedActivityData & { authorName: string };
}
