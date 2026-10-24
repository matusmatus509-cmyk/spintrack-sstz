import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
export interface ClubMembership {
  club_id: string;
  name: string;
  user_id: string;
  role: "owner" | "coach" | "player";
  member_count: number;
}
export interface ClubConnection {
  id: string;
  club_id: string;
  club_name: string;
  player_id: string;
  player_name: string;
  created_by: string;
  actor_name: string;
  kind: "request" | "invitation";
  status: "pending" | "accepted" | "declined" | "cancelled";
  created_at: string;
  can_respond: boolean;
  can_cancel: boolean;
}
interface Data {
  memberships: ClubMembership[];
  actions: ClubConnection[];
}
const empty: Data = { memberships: [], actions: [] };
export function useClubConnections(userId?: string) {
  const [data, setData] = useState<Data>(empty);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);
  const currentUser = useRef(userId);
  currentUser.current = userId;
  const version = useRef(0),
    locked = useRef(false);
  const refresh = useCallback(async () => {
    if (!supabase || !userId) return;
    const request = ++version.current;
    setLoading(true);
    try {
      const result = await supabase.rpc("get_club_connections");
      if (request !== version.current || currentUser.current !== userId) return;
      if (result.error) throw new Error(result.error.message);
      setData(result.data as Data);
      setError("");
    } catch {
      if (request === version.current && currentUser.current === userId)
        setError("Klubové pozvánky sa nepodarilo načítať. Skús ich obnoviť.");
    } finally {
      if (request === version.current && currentUser.current === userId)
        setLoading(false);
    }
  }, [userId]);
  useEffect(() => {
    setData(empty);
    setNotice("");
    setError("");
    setBusy(false);
    locked.current = false;
    void refresh();
    const resume = () => {
      if (!document.hidden) void refresh();
    };
    const timer = setInterval(resume, 60000);
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      version.current++;
      clearInterval(timer);
      window.removeEventListener("focus", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [refresh]);
  const run = async (
    fn: string,
    args: Record<string, unknown>,
    message: string,
  ) => {
    if (locked.current || !supabase || !userId) return;
    const owner = userId;
    locked.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await supabase.rpc(fn, args);
      if (currentUser.current !== owner) return;
      if (result.error) throw new Error(result.error.message);
      setNotice(message);
      setRevision((n) => n + 1);
      await refresh();
    } catch (e) {
      if (currentUser.current === owner)
        setError(
          e instanceof Error &&
            /^(Klub|Pozván|Pozvať|Žiadosť|Hráč|Už si|Túto|Najprv|Neplatn)/.test(
              e.message,
            )
            ? e.message
            : "Zmenu sa nepodarilo uložiť. Obnov klub a skús znova.",
        );
    } finally {
      if (currentUser.current === owner) {
        locked.current = false;
        setBusy(false);
      }
    }
  };
  const mine = data.memberships.filter((m) => m.user_id === userId);
  return {
    ...data,
    mine,
    managed: mine.filter((m) => m.role === "owner" || m.role === "coach"),
    userId,
    loading,
    busy,
    error,
    notice,
    revision,
    refresh,
    request: (clubId: string) =>
      run(
        "request_club_membership",
        { p_club: clubId },
        "Žiadosť bola odoslaná trénerom klubu.",
      ),
    invite: (clubId: string, playerId: string) =>
      run(
        "invite_friend_to_club",
        { p_club: clubId, p_player: playerId },
        "Pozvánka bola odoslaná. Priateľ ju nájde v kluboch aj pozvánkach.",
      ),
    respond: (id: string, decision: "accept" | "decline" | "cancel") =>
      run(
        "respond_club_connection",
        { p_connection: id, p_decision: decision },
        decision === "accept"
          ? "Prijatie bolo potvrdené. Členstvo je aktívne."
          : decision === "decline"
            ? "Odpoveď bola uložená."
            : "Pozvánka alebo žiadosť bola zrušená.",
      ),
  };
}
export type ClubConnections = ReturnType<typeof useClubConnections>;
