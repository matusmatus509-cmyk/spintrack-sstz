import React, { useCallback, useEffect, useRef, useState } from "react";
import { CalendarCheck, Users, Plus, RefreshCw } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useCommunity } from "../context/CommunityContext";
import { useApp } from "../context/AppContext";

interface ClubTraining {
  id: string;
  coach_id: string;
  title: string;
  location: string;
  training_date: string;
  start_time: string;
  duration_minutes: number;
  focus_drills: string[];
  response_deadline: string;
}
interface Member {
  training_id: string;
  player_id: string;
  response: "yes" | "no" | "unsure" | null;
  attended: boolean | null;
  player: { display_name: string } | null;
}
const responses = [
  { id: "yes", label: "Prídem" },
  { id: "no", label: "Neprídem" },
  { id: "unsure", label: "Neviem" },
] as const;
const zoned = (date: string, time: string) => {
  // Sessions are scheduled in Slovak club time, including daylight saving.
  const target = Date.parse(`${date}T${time.slice(0, 5)}:00Z`);
  let result = new Date(target);
  for (let i = 0; i < 2; i++) {
    const parts = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Europe/Bratislava",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .format(result)
      .replace(" ", "T");
    result = new Date(result.getTime() + target - Date.parse(`${parts}Z`));
  }
  return result;
};
export function ClubTrainingPanel() {
  const { user, friends } = useCommunity();
  const { activities, addActivity, activeRacket } = useApp();
  const [trainings, setTrainings] = useState<ClubTraining[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [missing, setMissing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState("");
  const [tick, setTick] = useState(Date.now());
  const version = useRef(0);
  const [form, setForm] = useState({
    title: "Klubový tréning",
    location: "",
    date: "",
    time: "18:00",
    duration: 90,
    drills: "",
    deadline: "",
    players: [] as string[],
  });
  const load = useCallback(async () => {
    if (!supabase || !user) return;
    const request = ++version.current;
    setLoading(true);
    try {
      const [sessions, attendance] = await Promise.all([
        supabase
          .from("club_trainings")
          .select("*")
          .order("training_date", { ascending: false }),
        supabase
          .from("club_training_members")
          .select("*,player:profiles!player_id(display_name)"),
      ]);
      if (request !== version.current) return;
      setLoading(false);
      const failure = sessions.error || attendance.error;
      if (failure) {
        setMissing(["42P01", "PGRST205"].includes(failure.code));
        setError(
          ["42P01", "PGRST205"].includes(failure.code)
            ? "Klubová dochádzka čaká na aktiváciu databázy."
            : "Dochádzku sa nepodarilo načítať. Skús obnoviť pripojenie.",
        );
        return;
      }
      setMissing(false);
      setError("");
      setTrainings(sessions.data || []);
      setMembers((attendance.data || []) as Member[]);
    } catch {
      if (request === version.current) {
        setLoading(false);
        setError("Dochádzku sa nepodarilo načítať. Skús obnoviť pripojenie.");
      }
    }
  }, [user?.id]);
  useEffect(() => {
    void load();
    const refresh = () => {
      if (!document.hidden) {
        setTick(Date.now());
        void load();
      }
    };
    const timer = setInterval(refresh, 60000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      version.current++;
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [load]);
  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      await load();
    } catch {
      setError(
        "Zmenu sa nepodarilo uložiť. Over pripojenie a termín odpovede, potom skús znova.",
      );
    } finally {
      setBusy(false);
    }
  };
  if (!user) return null;
  return (
    <section
      className="practice-panel club-panel"
      aria-label="Klubové tréningy"
    >
      <div className="practice-heading">
        <div>
          <span>SPOLOČNE PRI STOLE</span>
          <h2>
            <Users size={20} /> Klubové tréningy
          </h2>
        </div>
        <button
          type="button"
          className="btn-secondary"
          disabled={busy || loading}
          aria-label="Obnoviť dochádzku"
          onClick={() => void load()}
        >
          <RefreshCw size={17} />
        </button>
      </div>
      <p className="practice-muted">
        Organizátor pozve priateľov, vidí ich odpovede a po tréningu potvrdí
        dochádzku. Časy sú podľa Slovenska.
      </p>
      {error && (
        <p role="alert" className="community-error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="community-message">
          {notice}
        </p>
      )}
      {loading && !trainings.length && (
        <p role="status">Načítavam klubové tréningy…</p>
      )}
      {!missing && (
        <button
          type="button"
          className="btn-secondary practice-wide"
          disabled={busy}
          onClick={() => setCreating((v) => !v)}
        >
          <Plus size={18} />
          {creating ? "Zavrieť plánovanie" : "Zorganizovať tréning"}
        </button>
      )}
      {creating && !missing && (
        <form
          className="practice-form"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              if (!supabase) return;
              const deadline = zoned(
                form.deadline.slice(0, 10),
                form.deadline.slice(11, 16),
              );
              const { error } = await supabase.rpc("create_club_training", {
                p_title: form.title.trim(),
                p_location: form.location.trim(),
                p_date: form.date,
                p_start: form.time,
                p_duration: form.duration,
                p_drills: form.drills
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
                p_deadline: deadline.toISOString(),
                p_players: form.players,
              });
              if (error) throw error;
              setCreating(false);
              setForm({ ...form, players: [] });
              setNotice(
                "Tréning je vytvorený. Pozvaní hráči ho nájdu vo svojej komunite.",
              );
            });
          }}
        >
          <label>
            Názov
            <input
              required
              maxLength={120}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </label>
          <label>
            Miesto
            <input
              maxLength={200}
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            />
          </label>
          <div className="practice-grid">
            <label>
              Dátum
              <input
                required
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </label>
            <label>
              Začiatok
              <input
                required
                type="time"
                value={form.time}
                onChange={(e) => setForm({ ...form, time: e.target.value })}
              />
            </label>
          </div>
          <label>
            Trvanie v minútach
            <input
              required
              type="number"
              min={10}
              max={600}
              value={form.duration}
              onChange={(e) =>
                setForm({ ...form, duration: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Cvičenia oddelené čiarkou
            <input
              maxLength={1000}
              placeholder="Podanie, Príjem, Topspin"
              value={form.drills}
              onChange={(e) => setForm({ ...form, drills: e.target.value })}
            />
          </label>
          <label>
            Odpovedať do (slovenský čas)
            <input
              required
              type="datetime-local"
              value={form.deadline}
              onChange={(e) => setForm({ ...form, deadline: e.target.value })}
            />
          </label>
          <fieldset disabled={busy}>
            <legend>Pozvaní priatelia</legend>
            {!friends.length && <p>Najprv si pridaj hráčov medzi priateľov.</p>}
            {friends.map((friend) => (
              <label className="practice-check" key={friend.id}>
                <input
                  type="checkbox"
                  checked={form.players.includes(friend.id)}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      players: e.target.checked
                        ? [...form.players, friend.id]
                        : form.players.filter((id) => id !== friend.id),
                    })
                  }
                />
                {friend.display_name}
              </label>
            ))}
          </fieldset>
          <button
            className="btn-primary"
            disabled={busy || !form.players.length}
          >
            {busy ? "Ukladám…" : "Vytvoriť a pozvať hráčov"}
          </button>
        </form>
      )}
      {!loading && !error && !trainings.length && (
        <p className="practice-muted">
          Zatiaľ nemáš žiadny spoločný tréning. Vytvor prvý alebo počkaj na
          pozvánku trénera.
        </p>
      )}
      {trainings.map((training) => {
        const roster = members.filter((m) => m.training_id === training.id);
        const mine = roster.find((m) => m.player_id === user.id);
        const coach = training.coach_id === user.id;
        const ended =
          zoned(training.training_date, training.start_time).getTime() +
            training.duration_minutes * 60000 <=
          tick;
        const deadlinePassed = Date.parse(training.response_deadline) < tick;
        const logged = activities.some(
          (a) => a.sourceEventId === `club-${training.id}`,
        );
        return (
          <article className="club-session" key={training.id}>
            <div className="practice-heading">
              <h3>{training.title}</h3>
              <span className="club-badge">
                {coach ? "Organizuješ" : ended ? "Ukončený" : "Pozvánka"}
              </span>
            </div>
            <p>
              {new Date(
                `${training.training_date}T12:00:00`,
              ).toLocaleDateString("sk-SK")}{" "}
              · {training.start_time.slice(0, 5)} · {training.duration_minutes}{" "}
              min
            </p>
            {training.location && <p>{training.location}</p>}
            {!!training.focus_drills.length && (
              <p className="practice-muted">
                {training.focus_drills.join(" · ")}
              </p>
            )}
            <p className="practice-muted">
              Odpoveď do{" "}
              {new Date(training.response_deadline).toLocaleString("sk-SK", {
                timeZone: "Europe/Bratislava",
              })}
              {deadlinePassed ? " · uzavreté" : ""}
            </p>
            {coach && (
              <>
                <div className="club-counts">
                  {responses.map((r) => (
                    <span key={r.id}>
                      <strong>
                        {roster.filter((m) => m.response === r.id).length}
                      </strong>
                      {r.label}
                    </span>
                  ))}
                  <span>
                    <strong>{roster.filter((m) => !m.response).length}</strong>
                    Bez odpovede
                  </span>
                </div>
                {roster.map((member) => (
                  <div className="club-member" key={member.player_id}>
                    <div>
                      <strong>{member.player?.display_name || "Hráč"}</strong>
                      <span>
                        {responses.find((r) => r.id === member.response)
                          ?.label || "Bez odpovede"}
                        {member.attended === true
                          ? " · účasť potvrdená"
                          : member.attended === false
                            ? " · neprišiel/a"
                            : ""}
                      </span>
                    </div>
                    {ended && (
                      <div className="club-response">
                        <button
                          className="btn-secondary"
                          aria-pressed={member.attended === true}
                          disabled={busy}
                          onClick={() =>
                            void run(async () => {
                              const { error } = await supabase!.rpc(
                                "confirm_club_attendance",
                                {
                                  p_training: training.id,
                                  p_player: member.player_id,
                                  p_attended: true,
                                },
                              );
                              if (error) throw error;
                            })
                          }
                        >
                          Bol/a
                        </button>
                        <button
                          className="btn-secondary"
                          aria-pressed={member.attended === false}
                          disabled={busy}
                          onClick={() =>
                            void run(async () => {
                              const { error } = await supabase!.rpc(
                                "confirm_club_attendance",
                                {
                                  p_training: training.id,
                                  p_player: member.player_id,
                                  p_attended: false,
                                },
                              );
                              if (error) throw error;
                            })
                          }
                        >
                          Nebol/a
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}
            {mine && (
              <>
                <div
                  className="club-response"
                  role="group"
                  aria-label={`Odpoveď na ${training.title}`}
                >
                  {responses.map((r) => (
                    <button
                      key={r.id}
                      className="btn-secondary"
                      aria-pressed={mine.response === r.id}
                      disabled={busy || deadlinePassed}
                      onClick={() =>
                        void run(async () => {
                          const { error } = await supabase!.rpc(
                            "respond_club_training",
                            { p_training: training.id, p_response: r.id },
                          );
                          if (error) throw error;
                        })
                      }
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
                {ended && mine.attended === null && (
                  <p className="practice-muted">
                    Čaká sa na potvrdenie dochádzky trénerom.
                  </p>
                )}
                {mine.attended === false && (
                  <p className="practice-muted">Tréner zaznamenal neúčasť.</p>
                )}
                {mine.attended === true && (
                  <button
                    className="btn-primary practice-wide"
                    disabled={logged || busy}
                    onClick={() => {
                      if (logged) return;
                      addActivity(
                        {
                          category: "tréning",
                          date: training.training_date,
                          startTime: training.start_time.slice(0, 5),
                          durationMinutes: training.duration_minutes,
                          focusDrills: training.focus_drills,
                          location: training.location,
                          visibility: "private",
                          addEquipmentWear: !!activeRacket,
                          racketId: activeRacket?.id,
                          sourceEventId: `club-${training.id}`,
                        },
                        `club-${training.id}`,
                      );
                      setNotice(
                        "Absolvovaný tréning je v denníku. Trvanie a vyhodnotenie môžeš doplniť cez Upraviť.",
                      );
                    }}
                  >
                    <CalendarCheck size={18} />
                    {logged
                      ? "Zapísané v denníku"
                      : "Zapísať absolvovaný tréning"}
                  </button>
                )}
              </>
            )}
          </article>
        );
      })}
    </section>
  );
}
