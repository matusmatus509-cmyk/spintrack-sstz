import { useEffect, useRef, useState } from "react";
import { useCommunity } from "../context/CommunityContext";
import { useApp } from "../context/AppContext";
import { supabase } from "../lib/supabase";
import { publicActivity } from "../utils/community";
import { calendarDate } from "../utils/calendar";
import { compareOccurrenceDesc } from "../utils/diary";
import { ActivityPreview, communityError } from "./CommunityView";
import { ImportSharedActivity } from "../components/ImportSharedActivity";
import type {
  Club,
  ClubMember,
  ClubActivity,
  ClubNote,
} from "../types/community";

const roles = { owner: "Zakladateľ / tréner", coach: "Tréner", player: "Hráč" };
const profileFields = "id,display_name,handle,club";
function check(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export function ClubView() {
  const { user } = useCommunity();
  const { activities } = useApp();
  const [clubs, setClubs] = useState<Club[]>([]);
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [rows, setRows] = useState<ClubActivity[]>([]);
  const [notes, setNotes] = useState<ClubNote[]>([]);
  const [selected, setSelected] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const [revision, setRevision] = useState(0);
  const [limit, setLimit] = useState(30);
  const [past, setPast] = useState(false);
  const [mode, setMode] = useState<"schedule" | "activities" | "members">(
    "schedule",
  );
  const [tags, setTags] = useState<string[]>([]);
  const [activityId, setActivityId] = useState("");
  const [title, setTitle] = useState("Spoločný tréning");
  const [date, setDate] = useState(() => calendarDate(new Date()));
  const [time, setTime] = useState("18:00");
  const [duration, setDuration] = useState(90);
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  useEffect(() => {
    let active = true;
    setLoading(true);
    const load = async () => {
      if (!supabase || !user) return;
      try {
        const [groups, people] = await Promise.all([
          supabase.from("clubs").select("*").order("name"),
          supabase
            .from("club_members")
            .select(`*,profile:profiles!user_id(${profileFields})`),
        ]);
        check(groups.error);
        check(people.error);
        if (!active) return;
        setClubs(groups.data || []);
        setMembers(people.data as unknown as ClubMember[]);
        if (!(groups.data || []).some((c) => c.id === selected)) {
          setSelected(groups.data?.[0]?.id || "");
          setRows([]);
          setNotes([]);
          setCode("");
          return;
        }
        let postQuery = supabase
          .from("club_activities")
          .select(`*,author:profiles!owner_id(${profileFields})`)
          .eq("club_id", selected)
          .eq("scheduled", mode === "schedule");
        if (mode === "schedule")
          postQuery = past
            ? postQuery.lt("activity_date", calendarDate(new Date()))
            : postQuery.gte("activity_date", calendarDate(new Date()));
        const [posts, codes] = await Promise.all([
          postQuery
            .order("activity_date", { ascending: mode === "schedule" && !past })
            .order("id")
            .limit(limit),
          supabase
            .from("club_invite_codes")
            .select("code")
            .eq("club_id", selected)
            .maybeSingle(),
        ]);
        check(posts.error);
        check(codes.error);
        const comments = posts.data?.length
          ? await supabase
              .from("club_notes")
              .select(`*,author:profiles!author_id(${profileFields})`)
              .in(
                "activity_id",
                posts.data.map((p) => p.id),
              )
              .order("created_at")
          : { data: [], error: null };
        check(comments.error);
        if (!active) return;
        setRows(posts.data as unknown as ClubActivity[]);
        setNotes(comments.data as unknown as ClubNote[]);
        setCode(codes.data?.code || "");
        setError("");
      } catch (e) {
        if (active) setError(communityError(e));
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [user?.id, selected, revision, limit, mode, past]);
  useEffect(() => {
    const refresh = () => {
      if (!document.hidden) setRevision((n) => n + 1);
    };
    const timer = setInterval(refresh, 60000);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  const run = async (action: () => Promise<void>, success: string) => {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
      setMessage(success);
      setRevision((n) => n + 1);
    } catch (e) {
      setError(communityError(e));
    } finally {
      locked.current = false;
      setBusy(false);
    }
  };
  const rpc = async (fn: string, args: Record<string, unknown>) => {
    const result = await supabase!.rpc(fn, args);
    check(result.error);
    return result.data;
  };
  const club = clubs.find((c) => c.id === selected);
  const roster = members.filter((m) => m.club_id === selected);
  const myRole = roster.find((m) => m.user_id === user?.id)?.role;
  const coach = myRole === "owner" || myRole === "coach";
  const tagPicker = (
    <fieldset className="club-tags">
      <legend>Označiť členov (voliteľné)</legend>
      {roster
        .filter((m) => m.user_id !== user?.id)
        .map((m) => (
          <label key={m.user_id}>
            <input
              type="checkbox"
              checked={tags.includes(m.user_id)}
              onChange={(e) =>
                setTags((previous) =>
                  e.target.checked
                    ? [...previous, m.user_id]
                    : previous.filter((id) => id !== m.user_id),
                )
              }
            />
            {m.profile.display_name}
          </label>
        ))}
      {roster.length < 2 && <small>Pozvi spoluhráčov cez kód klubu.</small>}
    </fieldset>
  );
  const publish = async (scheduled: boolean) => {
    const activity = activities.find((a) => a.id === activityId);
    if (!scheduled && !activity)
      throw new Error("Najprv vyber svoju aktivitu.");
    await rpc("publish_club_activity", {
      p_club: selected,
      p_local_id: scheduled ? crypto.randomUUID() : activity!.id,
      p_payload: scheduled
        ? {
            category: "tréning",
            date,
            startTime: time || undefined,
            durationMinutes: duration,
            location,
            title,
            publicNote: description,
            focusDrills: [],
          }
        : publicActivity(activity!),
      p_scheduled: scheduled,
      p_tags: tags,
    });
    setTags([]);
  };
  return (
    <section className="club-view">
      <p>
        Klubové aktivity a poznámky vidia iba členovia klubu. Súkromné poznámky
        a fotky z denníka sa nezdieľajú.
      </p>
      {error && (
        <p role="alert" className="community-error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="community-message">
          {message}
        </p>
      )}
      <details className="glass-panel community-card" open={!clubs.length}>
        <summary>Vytvoriť klub alebo pridať sa ku klubu</summary>
        <form
          className="community-form"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              const id = await rpc("create_club", { p_name: name.trim() });
              setSelected(id);
              setName("");
            }, "Klub bol vytvorený. Pozvi členov pomocou kódu.");
          }}
        >
          <label>
            Názov nového klubu
            <input
              required
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <button className="btn-primary" disabled={busy}>
            Vytvoriť klub
          </button>
        </form>
        <form
          className="community-form"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              const id = await rpc("join_club", { p_code: joinCode.trim() });
              setSelected(id);
              setJoinCode("");
            }, "Si členom klubu.");
          }}
        >
          <label>
            Pozývací kód od zakladateľa
            <input
              required
              maxLength={32}
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              autoCapitalize="none"
            />
          </label>
          <button className="btn-secondary" disabled={busy}>
            Pridať sa ku klubu
          </button>
        </form>
      </details>
      {!!clubs.length && (
        <label className="community-form">
          Tvoj klub
          <select
            value={selected}
            disabled={busy}
            onChange={(e) => {
              setSelected(e.target.value);
              setRows([]);
              setNotes([]);
              setCode("");
              setTags([]);
              setLimit(30);
              setMessage("");
            }}
          >
            {clubs.map((c) => (
              <option value={c.id} key={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {club && (
        <>
          <div className="club-heading">
            <div>
              <h2>{club.name}</h2>
              <small>{myRole && roles[myRole]}</small>
            </div>
            <button
              className="btn-secondary"
              disabled={loading || busy}
              onClick={() => setRevision((n) => n + 1)}
            >
              Obnoviť klub
            </button>
          </div>
          <div
            className="community-tabs"
            role="group"
            aria-label="Sekcie klubu"
          >
            {(
              [
                ["schedule", "Rozpis tréningov"],
                ["activities", "Aktivity členov"],
                ["members", "Členovia"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                aria-pressed={mode === value}
                onClick={() => {
                  setMode(value);
                  setRows([]);
                  setNotes([]);
                  setLimit(30);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          {mode === "members" ? (
            <>
              {myRole === "owner" && (
                <section className="glass-panel community-card">
                  <h3>Pozvať členov</h3>
                  <p>
                    Pošli tento kód spoluhráčom. Pridajú sa ako hráči; trénerov
                    nastavíš nižšie.
                  </p>
                  <label className="community-form">
                    Pozývací kód
                    <input
                      readOnly
                      value={code}
                      onFocus={(e) => e.target.select()}
                    />
                  </label>
                  <button
                    className="btn-secondary"
                    disabled={busy || !code}
                    onClick={() =>
                      void run(async () => {
                        await rpc("rotate_club_code", { p_club: selected });
                      }, "Nový kód je pripravený. Starý už neplatí.")
                    }
                  >
                    Vygenerovať nový kód
                  </button>
                </section>
              )}
              {roster.map((m) => (
                <article
                  className="glass-panel community-friend"
                  key={m.user_id}
                >
                  <div>
                    <strong>{m.profile.display_name}</strong>
                    <small>
                      @{m.profile.handle} · {roles[m.role]}
                    </small>
                  </div>
                  {myRole === "owner" && m.role !== "owner" && (
                    <div className="community-actions">
                      <select
                        aria-label={`Rola ${m.profile.display_name}`}
                        disabled={busy}
                        value={m.role}
                        onChange={(e) => {
                          const role = e.target.value;
                          void run(async () => {
                            await rpc("manage_club_member", {
                              p_club: selected,
                              p_user: m.user_id,
                              p_role: role,
                            });
                          }, "Rola bola uložená.");
                        }}
                      >
                        <option value="player">Hráč</option>
                        <option value="coach">Tréner</option>
                      </select>
                      <button
                        className="text-button"
                        disabled={busy}
                        onClick={() => {
                          if (
                            window.confirm(
                              `Odobrať ${m.profile.display_name} z klubu?`,
                            )
                          )
                            void run(async () => {
                              await rpc("manage_club_member", {
                                p_club: selected,
                                p_user: m.user_id,
                                p_role: "remove",
                              });
                            }, "Člen bol odobratý.");
                        }}
                      >
                        Odobrať
                      </button>
                    </div>
                  )}
                </article>
              ))}
              {myRole !== "owner" && (
                <button
                  className="btn-secondary"
                  disabled={busy}
                  onClick={() => {
                    if (
                      window.confirm(
                        "Opustiť klub? Tvoje zdieľané aktivity zostanú v klube.",
                      )
                    )
                      void run(async () => {
                        await rpc("manage_club_member", {
                          p_club: selected,
                          p_user: user!.id,
                          p_role: "remove",
                        });
                        setSelected("");
                      }, "Opustil si klub.");
                  }}
                >
                  Opustiť klub
                </button>
              )}
            </>
          ) : (
            <>
              {mode === "schedule" && (
                <div
                  className="community-tabs"
                  role="group"
                  aria-label="Obdobie rozpisu"
                >
                  {([false, true] as const).map((value) => (
                    <button
                      key={String(value)}
                      aria-pressed={past === value}
                      onClick={() => {
                        setPast(value);
                        setRows([]);
                        setLimit(30);
                      }}
                    >
                      {value ? "Minulé tréningy" : "Najbližšie tréningy"}
                    </button>
                  ))}
                </div>
              )}
              {(mode === "activities" || coach) && (
                <details className="glass-panel community-card">
                  <summary>
                    {mode === "schedule"
                      ? "Naplánovať spoločný tréning"
                      : "Zdieľať moju aktivitu s klubom"}
                  </summary>
                  <form
                    className="community-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void run(
                        () => publish(mode === "schedule"),
                        mode === "schedule"
                          ? "Tréning je v rozpise klubu."
                          : "Aktivita bola zdieľaná s klubom.",
                      );
                    }}
                  >
                    {mode === "schedule" ? (
                      <>
                        <label>
                          Názov
                          <input
                            required
                            maxLength={200}
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                          />
                        </label>
                        <div className="club-form-row">
                          <label>
                            Dátum
                            <input
                              type="date"
                              required
                              value={date}
                              onChange={(e) => setDate(e.target.value)}
                            />
                          </label>
                          <label>
                            Čas
                            <input
                              type="time"
                              value={time}
                              onChange={(e) => setTime(e.target.value)}
                            />
                          </label>
                        </div>
                        <label>
                          Trvanie (minúty)
                          <input
                            type="number"
                            required
                            min={1}
                            max={1440}
                            value={duration}
                            onChange={(e) =>
                              setDuration(Number(e.target.value))
                            }
                          />
                        </label>
                        <label>
                          Miesto
                          <input
                            maxLength={200}
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                          />
                        </label>
                        <label>
                          Náplň tréningu
                          <textarea
                            maxLength={4000}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                          />
                        </label>
                      </>
                    ) : (
                      <label>
                        Aktivita z môjho denníka
                        <select
                          required
                          value={activityId}
                          onChange={(e) => setActivityId(e.target.value)}
                        >
                          <option value="">Vyber aktivitu</option>
                          {activities
                            .filter((a) => a.date)
                            .map((a) => (
                              <option value={a.id} key={a.id}>
                                {a.date} · {a.title || a.category}
                                {a.planned ? " (plán)" : ""}
                              </option>
                            ))}
                        </select>
                        <small>
                          Zdieľa sa dátum, náplň a verejná poznámka. Opätovné
                          zdieľanie tej istej aktivity aktualizuje jej kópiu v
                          klube.
                        </small>
                      </label>
                    )}
                    {tagPicker}
                    <button className="btn-primary" disabled={busy}>
                      {mode === "schedule"
                        ? "Pridať do rozpisu"
                        : "Zdieľať s klubom"}
                    </button>
                  </form>
                </details>
              )}
              {loading && <p role="status">Načítavam klub…</p>}
              {!loading && !rows.length && (
                <section className="glass-panel community-empty">
                  <h3>
                    {mode === "schedule"
                      ? "Rozpis je zatiaľ prázdny"
                      : "Zatiaľ žiadne zdieľané aktivity"}
                  </h3>
                  <p>
                    {mode === "schedule"
                      ? "Tréner sem môže pridať spoločné tréningy."
                      : "Vyber aktivitu zo svojho denníka a zdieľaj ju s klubom."}
                  </p>
                </section>
              )}
              {[...rows]
                .sort((a, b) =>
                  mode === "schedule" && !past
                    ? -compareOccurrenceDesc(
                        { id: a.id, ...a.payload },
                        { id: b.id, ...b.payload },
                      )
                    : compareOccurrenceDesc(
                        { id: a.id, ...a.payload },
                        { id: b.id, ...b.payload },
                      ),
                )
                .map((row) => (
                  <article className="glass-panel community-card" key={row.id}>
                    <p>
                      <strong>{row.author.display_name}</strong>
                      {row.scheduled ? " · Plán tréningu" : ""}
                    </p>
                    {row.tagged_ids.includes(user!.id) && (
                      <p className="community-message">
                        Si označený/á v tejto aktivite.
                      </p>
                    )}
                    <ActivityPreview data={row.payload} />
                    {!!row.tagged_ids.length && (
                      <p>
                        Označení:{" "}
                        {row.tagged_ids
                          .map(
                            (id) =>
                              roster.find((m) => m.user_id === id)?.profile
                                .display_name || "Bývalý člen",
                          )
                          .join(", ")}
                      </p>
                    )}
                    {!(
                      row.owner_id === user!.id &&
                      activities.some((a) => a.id === row.local_id)
                    ) && (
                      <ImportSharedActivity
                        source="club"
                        sourceId={row.id}
                        data={row.payload}
                      />
                    )}
                    <details className="club-feedback">
                      <summary>
                        Poznámky trénera (
                        {notes.filter((n) => n.activity_id === row.id).length})
                      </summary>
                      {notes
                        .filter((n) => n.activity_id === row.id)
                        .map((n) => (
                          <div className="club-note" key={n.id}>
                            <strong>{n.author.display_name}</strong>
                            <small>
                              {new Date(n.created_at).toLocaleString("sk-SK")}
                            </small>
                            <p>{n.body}</p>
                            {n.author_id === user!.id && (
                              <button
                                className="text-button"
                                disabled={busy}
                                onClick={() =>
                                  void run(async () => {
                                    const result = await supabase!
                                      .from("club_notes")
                                      .delete()
                                      .eq("id", n.id);
                                    check(result.error);
                                  }, "Poznámka bola odstránená.")
                                }
                              >
                                Odstrániť poznámku
                              </button>
                            )}
                          </div>
                        ))}
                      {coach && (
                        <form
                          className="community-form"
                          onSubmit={(e) => {
                            e.preventDefault();
                            void run(async () => {
                              const result = await supabase!
                                .from("club_notes")
                                .insert({
                                  activity_id: row.id,
                                  body: noteDrafts[row.id]?.trim(),
                                });
                              check(result.error);
                              setNoteDrafts((p) => ({ ...p, [row.id]: "" }));
                            }, "Poznámka trénera bola pridaná.");
                          }}
                        >
                          <label>
                            Poznámka k aktivite
                            <textarea
                              required
                              maxLength={4000}
                              value={noteDrafts[row.id] || ""}
                              onChange={(e) =>
                                setNoteDrafts((p) => ({
                                  ...p,
                                  [row.id]: e.target.value,
                                }))
                              }
                            />
                          </label>
                          <button
                            className="btn-secondary"
                            disabled={busy || !noteDrafts[row.id]?.trim()}
                          >
                            Pridať poznámku
                          </button>
                        </form>
                      )}
                    </details>
                    {(row.owner_id === user!.id || myRole === "owner") && (
                      <button
                        className="text-button"
                        disabled={busy}
                        onClick={() => {
                          if (
                            window.confirm(
                              "Odstrániť aktivitu z klubu? Už importované kópie zostanú členom v denníku.",
                            )
                          )
                            void run(async () => {
                              await rpc("delete_club_activity", {
                                p_activity: row.id,
                              });
                            }, "Aktivita bola odstránená z klubu.");
                        }}
                      >
                        Odstrániť z klubu
                      </button>
                    )}
                  </article>
                ))}
              {rows.length >= limit && (
                <button
                  className="btn-secondary"
                  disabled={loading}
                  onClick={() => setLimit((n) => n + 30)}
                >
                  Načítať ďalšie aktivity
                </button>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
