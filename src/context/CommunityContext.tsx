import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { emptyAccountData, publicActivity } from "../utils/community";
import type { ActivityRecord, ActivityVisibility } from "../types";
import type {
  ActivityInvitation,
  CalendarEntry,
  FriendRequest,
  PlayerProfile,
  SharedActivity,
} from "../types/community";

interface CommunityContextType {
  configured: boolean;
  authLoading: boolean;
  user: User | null;
  profile: PlayerProfile | null;
  dataReady: boolean;
  initialData: Record<string, any> | null;
  accountError: string;
  cloudError: string;
  socialError: string;
  socialLoading: boolean;
  friends: PlayerProfile[];
  ownShares: SharedActivity[];
  requests: FriendRequest[];
  feed: SharedActivity[];
  invitations: ActivityInvitation[];
  calendar: CalendarEntry[];
  recovering: boolean;
  refresh: () => Promise<void>;
  retryAccount: () => void;
  register: (
    email: string,
    password: string,
    name: string,
    handle: string,
  ) => Promise<boolean>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  changePassword: (password: string) => Promise<void>;
  saveAccountData: (data: Record<string, any>) => void;
  updateProfile: (name: string, handle: string, club: string) => Promise<void>;
  searchPlayers: (query: string) => Promise<PlayerProfile[]>;
  requestFriend: (id: string) => Promise<void>;
  respondFriend: (id: string, accept: boolean) => Promise<void>;
  removeFriend: (id: string) => Promise<void>;
  publishActivity: (
    localId: string,
    activity: Omit<ActivityRecord, "id" | "createdAt">,
    invitees: string[],
  ) => Promise<void>;
  changeVisibility: (
    id: string,
    visibility: ActivityVisibility,
  ) => Promise<void>;
  unshareOwnActivity: (localId: string) => Promise<void>;
  unshareAllActivities: () => Promise<void>;
  unshareActivity: (id: string) => Promise<void>;
  acceptInvitation: (id: string) => Promise<void>;
  declineInvitation: (id: string) => Promise<void>;
  removeCalendarEntry: (id: string) => Promise<void>;
}
const CommunityContext = createContext<CommunityContextType | null>(null);
const check = (error: { message: string } | null) => {
  if (error) throw new Error(error.message);
};
const client = () => {
  if (!supabase)
    throw new Error("Prihlásenie a komunita ešte nie sú pripojené.");
  return supabase;
};
const activitySelect =
  "*,author:profiles!owner_id(id,display_name,handle,club)";

export function CommunityProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(Boolean(supabase));
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [ready, setDataReady] = useState(false);
  const [readyOwner, setReadyOwner] = useState<string | null>(null);
  const [initialData, setInitialData] = useState<Record<string, any> | null>(
    null,
  );
  const [accountError, setAccountError] = useState("");
  const [cloudError, setCloudError] = useState("");
  const [socialError, setSocialError] = useState("");
  const [socialLoading, setSocialLoading] = useState(false);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [ownShares, setOwnShares] = useState<SharedActivity[]>([]);
  const [feed, setFeed] = useState<SharedActivity[]>([]);
  const [invitations, setInvitations] = useState<ActivityInvitation[]>([]);
  const [calendar, setCalendar] = useState<CalendarEntry[]>([]);
  const [recovering, setRecovering] = useState(false);
  const [retry, setRetry] = useState(0);
  const user = session?.user || null;
  const userId = user?.id;
  const dataReady = ready && readyOwner === userId;
  const currentId = useRef(userId);
  currentId.current = userId;
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const refreshVersion = useRef(0);
  const pending = useRef<{ owner: string; data: Record<string, any> } | null>(
    null,
  );
  const saving = useRef<Promise<void> | null>(null);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, next) => {
      if (!active) return;
      if (currentId.current !== next?.user.id) {
        clearTimeout(timer.current);
        pending.current = null;
      }
      currentId.current = next?.user.id;
      setSession(next);
      setAuthLoading(false);
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
    });
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active) return;
        if (error)
          setAccountError(
            "Prihlásenie sa nepodarilo obnoviť. Skús sa prihlásiť znova.",
          );
        setSession(data.session);
        setAuthLoading(false);
      })
      .catch(() => {
        if (active) {
          setAuthLoading(false);
          setAccountError("Prihlásenie sa nepodarilo obnoviť.");
        }
      });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;
    clearTimeout(timer.current);
    pending.current = null;
    setDataReady(false);
    setInitialData(null);
    setProfile(null);
    setAccountError("");
    setCloudError("");
    setRequests([]);
    setFeed([]);
    setOwnShares([]);
    setInvitations([]);
    setCalendar([]);
    setSocialError("");
    if (!userId || !supabase) return;
    Promise.all([
      supabase
        .from("user_data")
        .select("data")
        .eq("owner_id", userId)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("id,display_name,handle,club")
        .eq("id", userId)
        .single(),
    ])
      .then(([backup, player]) => {
        if (!active) return;
        check(backup.error);
        check(player.error);
        let cached: Record<string, any> | null = null;
        try {
          cached = JSON.parse(
            localStorage.getItem(`spintrack_account_${userId}`) || "null",
          );
        } catch {
          /* ignore invalid cache */
        }
        const remote = backup.data?.data;
        const cachedNewer =
          cached?._updatedAt &&
          (!remote?._updatedAt || cached._updatedAt > remote._updatedAt);
        setInitialData(
          cachedNewer ? cached : remote || cached || emptyAccountData(),
        );
        setReadyOwner(userId);
        setProfile(player.data);
        setDataReady(true);
      })
      .catch(() => {
        if (active)
          setAccountError(
            "Údaje účtu sa nepodarilo načítať. Skontroluj pripojenie a skús znova.",
          );
      });
    return () => {
      active = false;
      clearTimeout(timer.current);
      pending.current = null;
    };
  }, [userId, retry]);

  const refresh = useCallback(async () => {
    if (!supabase || !userId) return;
    const owner = userId;
    const version = ++refreshVersion.current;
    setSocialLoading(true);
    try {
      const results = await Promise.all([
        supabase
          .from("friend_requests")
          .select(
            "*,requester:profiles!requester_id(id,display_name,handle,club),recipient:profiles!recipient_id(id,display_name,handle,club)",
          )
          .order("created_at", { ascending: false }),
        supabase
          .from("shared_activities")
          .select(activitySelect)
          .neq("owner_id", owner)
          .order("activity_date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(60),
        supabase
          .from("activity_invitations")
          .select(`*,activity:shared_activities(${activitySelect})`)
          .eq("recipient_id", owner)
          .neq("status", "declined")
          .order("created_at", { ascending: false }),
        supabase
          .from("calendar_entries")
          .select("*")
          .order("activity_date", { ascending: true }),
        supabase
          .from("shared_activities")
          .select(activitySelect)
          .eq("owner_id", owner)
          .order("activity_date", { ascending: false }),
      ]);
      if (currentId.current !== owner || version !== refreshVersion.current)
        return;
      results.forEach((result) => check(result.error));
      setRequests(results[0].data as unknown as FriendRequest[]);
      setFeed(results[1].data as unknown as SharedActivity[]);
      setInvitations(results[2].data as unknown as ActivityInvitation[]);
      setCalendar(results[3].data as unknown as CalendarEntry[]);
      setOwnShares(results[4].data as unknown as SharedActivity[]);
      setSocialError("");
    } catch {
      if (currentId.current === owner && version === refreshVersion.current)
        setSocialError("Komunitu sa nepodarilo obnoviť. Skús načítať znova.");
    } finally {
      if (currentId.current === owner && version === refreshVersion.current)
        setSocialLoading(false);
    }
  }, [userId]);
  useEffect(() => {
    if (!dataReady) return;
    void refresh();
    const resume = () => {
      if (!document.hidden) void refresh();
    };
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    const poll = setInterval(resume, 60000);
    return () => {
      clearInterval(poll);
      window.removeEventListener("focus", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [refresh, dataReady]);

  const flush = useCallback(async () => {
    if (!supabase) return;
    while (saving.current) await saving.current;
    saving.current = (async () => {
      while (pending.current) {
        const job = pending.current;
        pending.current = null;
        if (job.owner !== currentId.current) continue;
        try {
          const { error } = await supabase.from("user_data").upsert({
            owner_id: job.owner,
            data: job.data,
            updated_at: new Date().toISOString(),
          });
          if (job.owner === currentId.current)
            setCloudError(
              error
                ? "Údaje sú uložené v tomto zariadení, ale záloha do účtu zlyhala. Skús uložiť znova."
                : "",
            );
        } catch {
          if (job.owner === currentId.current)
            setCloudError(
              "Údaje sú uložené v tomto zariadení, ale záloha do účtu zlyhala. Skús uložiť znova.",
            );
        }
      }
    })();
    try {
      await saving.current;
    } finally {
      saving.current = null;
    }
  }, []);
  const saveAccountData = useCallback(
    (data: Record<string, any>) => {
      if (!userId || !dataReady) return;
      pending.current = { owner: userId, data };
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        void flush();
      }, 1000);
    },
    [userId, dataReady, flush],
  );

  const rpc = async (
    name: string,
    args: Record<string, unknown>,
    committed?: (data: unknown) => void,
  ) => {
    const { data, error } = await client().rpc(name, args);
    check(error);
    if (userId === currentId.current) committed?.(data);
    await refresh();
  };
  const value: CommunityContextType = {
    configured: Boolean(supabase),
    authLoading,
    user,
    profile,
    dataReady,
    initialData,
    accountError,
    cloudError,
    socialError,
    socialLoading,
    recovering,
    requests,
    feed,
    ownShares,
    invitations,
    calendar,
    friends: requests
      .filter((r) => r.status === "accepted")
      .map((r) => (r.requester_id === userId ? r.recipient : r.requester)),
    refresh,
    retryAccount: () => setRetry((value) => value + 1),
    saveAccountData,
    register: async (email, password, name, handle) => {
      const { data, error } = await client().auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            display_name: name.trim(),
            handle: handle.trim().toLowerCase(),
          },
          emailRedirectTo: window.location.origin,
        },
      });
      check(error);
      return Boolean(data.session);
    },
    login: async (email, password) => {
      const { error } = await client().auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      check(error);
    },
    logout: async () => {
      clearTimeout(timer.current);
      await flush();
      const { error } = await client().auth.signOut({ scope: "local" });
      check(error);
      setRecovering(false);
    },
    resetPassword: async (email) => {
      const { error } = await client().auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo: window.location.origin },
      );
      check(error);
    },
    changePassword: async (password) => {
      const { error } = await client().auth.updateUser({ password });
      check(error);
      setRecovering(false);
    },
    updateProfile: async (name, handle, club) => {
      const { data, error } = await client()
        .from("profiles")
        .update({
          display_name: name.trim(),
          handle: handle.trim().toLowerCase(),
          club: club.trim(),
        })
        .eq("id", userId!)
        .select("id,display_name,handle,club")
        .single();
      check(error);
      if (userId === currentId.current) setProfile(data);
      await refresh();
    },
    searchPlayers: async (query) => {
      const { data, error } = await client().rpc("search_players", {
        p_query: query.trim(),
      });
      check(error);
      return data as PlayerProfile[];
    },
    requestFriend: (id) => rpc("request_friend", { p_recipient: id }),
    respondFriend: (id, accept) =>
      rpc("respond_friend", { p_request: id, p_accept: accept }),
    removeFriend: (id) => rpc("remove_friend", { p_request: id }),
    publishActivity: (localId, activity, invitees) =>
      rpc(
        "publish_activity",
        {
          p_local_id: localId,
          p_payload: publicActivity(activity),
          p_visibility: activity.visibility,
          p_invitees: invitees,
        },
        (id) =>
          setOwnShares((previous) => [
            ...previous.filter((row) => row.local_id !== localId),
            {
              id: String(id),
              owner_id: userId!,
              local_id: localId,
              visibility: activity.visibility,
              activity_date: activity.date,
              created_at: new Date().toISOString(),
              payload: publicActivity(activity),
              author: profile!,
            },
          ]),
      ),
    changeVisibility: (id, visibility) =>
      rpc(
        "change_activity_visibility",
        {
          p_activity: id,
          p_visibility: visibility,
        },
        () =>
          setOwnShares((previous) =>
            previous.map((row) =>
              row.id === id ? { ...row, visibility } : row,
            ),
          ),
      ),
    unshareOwnActivity: (localId) =>
      rpc("unshare_local_activity", { p_local_id: localId }, () =>
        setOwnShares((previous) =>
          previous.filter((row) => row.local_id !== localId),
        ),
      ),
    unshareAllActivities: () =>
      rpc("unshare_all_activities", {}, () => setOwnShares([])),
    unshareActivity: (id) =>
      rpc("unshare_activity", { p_activity: id }, () =>
        setOwnShares((previous) => previous.filter((row) => row.id !== id)),
      ),
    acceptInvitation: (id) =>
      rpc("accept_activity_invitation", { p_invitation: id }),
    declineInvitation: (id) =>
      rpc("decline_activity_invitation", { p_invitation: id }),
    removeCalendarEntry: async (id) => {
      const { error } = await client()
        .from("calendar_entries")
        .delete()
        .eq("id", id);
      check(error);
      await refresh();
    },
  };
  return (
    <CommunityContext.Provider value={value}>
      {children}
    </CommunityContext.Provider>
  );
}
export function useCommunity() {
  const context = useContext(CommunityContext);
  if (!context) throw new Error("Chýba CommunityProvider.");
  return context;
}
