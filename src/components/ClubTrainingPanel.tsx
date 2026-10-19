import { LocationField } from "./LocationField";
import { PlayerAvatar } from "./PlayerAvatar";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  CalendarCheck,
  Users,
  Plus,
  RefreshCw,
  CalendarDays,
  MapPin,
  Clock3,
  ChevronRight,
  CheckCircle2,
  ClipboardCheck,
  Search,
} from "lucide-react";
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
export function ClubTrainingPanel({
  onFindFriends,
}: {
  onFindFriends?: () => void;
}) {
  const { user, friends } = useCommunity();
  const { activities, addActivity, activeRacket, rememberLocation } = useApp();
  const [trainings, setTrainings] = useState<ClubTraining[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [missing, setMissing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [scope, setScope] = useState<"upcoming" | "todo" | "past">("upcoming");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
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
  const startOf = (training: ClubTraining) =>
    zoned(training.training_date, training.start_time).getTime();
  const endedTraining = (training: ClubTraining) =>
    startOf(training) + training.duration_minutes * 60000 <= tick;
  const needsAction = (training: ClubTraining) => {
    const roster = members.filter((m) => m.training_id === training.id);
    const mine = roster.find((m) => m.player_id === user.id);
    const logged = activities.some(
      (a) => a.sourceEventId === `club-${training.id}`,
    );
    return (
      (training.coach_id === user.id &&
        endedTraining(training) &&
        roster.some((m) => m.attended === null)) ||
      (!!mine &&
        ((mine.attended === true && !logged) ||
          (!mine.response && Date.parse(training.response_deadline) >= tick)))
    );
  };
  const actionCount = trainings.filter(needsAction).length;
  const searchKey = (value: string) =>
    value
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLocaleLowerCase("sk")
      .trim();
  const visibleTrainings = trainings
    .filter((t) =>
      searchKey(`${t.title} ${t.location} ${t.training_date}`).includes(
        searchKey(query),
      ),
    )
    .filter((t) =>
      scope === "todo"
        ? needsAction(t)
        : scope === "past"
          ? endedTraining(t)
          : !endedTraining(t),
    )
    .sort((a, b) =>
      scope === "past" ? startOf(b) - startOf(a) : startOf(a) - startOf(b),
    );

  return (
    <section
      className="club-panel attendance-space"
      aria-label="Klubové tréningy"
    >
      <div className="practice-heading attendance-heading">
        <div>
          <span>SPOLOČNE PRI STOLE</span>
          <h2>Spoločné tréningy</h2>
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
        Daj vedieť, či prídeš. Po tréningu si potvrdenú účasť uložíš rovno do
        denníka.
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
          className="btn-primary practice-wide"
          disabled={busy}
          aria-expanded={creating}
          aria-controls="training-create-form"
          onClick={() => setCreating((v) => !v)}
        >
          <Plus size={18} />
          {creating ? "Zavrieť plánovanie" : "Zorganizovať tréning"}
        </button>
      )}
      {creating && !missing && (
        <form
          id="training-create-form"
          className="practice-form attendance-form"
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
              rememberLocation(form.location);
              setCreating(false);
              setScope("upcoming");
              setForm({ ...form, players: [] });
              setNotice(
                "Tréning je vytvorený. Pozvaní hráči ho nájdu vo svojej komunite.",
              );
            });
          }}
        >
          <div className="social-section-label">
            <CalendarDays size={19} />
            <h3>Priprav spoločný tréning</h3>
          </div>
          <p className="practice-muted">
            Vyber termín a pozvi priateľov. Časy zadávaj podľa Slovenska.
          </p>
          <label>
            Názov
            <input
              required
              maxLength={120}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </label>
          <LocationField
            value={form.location}
            onChange={(value) => setForm({ ...form, location: value })}
          />
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
            <legend>Pozvaní priatelia · {form.players.length} vybraných</legend>
            {friends.length > 1 && (
              <div className="attendance-invite-tools">
                <button
                  type="button"
                  className="text-button"
                  onClick={() =>
                    setForm({ ...form, players: friends.map((f) => f.id) })
                  }
                >
                  Vybrať všetkých
                </button>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setForm({ ...form, players: [] })}
                >
                  Zrušiť výber
                </button>
              </div>
            )}
            {!friends.length && (
              <div className="social-empty-inline">
                <p>Najprv si pridaj spoluhráčov medzi priateľov.</p>
                {onFindFriends && (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={onFindFriends}
                  >
                    Nájsť spoluhráčov <ChevronRight size={15} />
                  </button>
                )}
              </div>
            )}
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
                <PlayerAvatar name={friend.display_name} />
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
      {!creating && (
        <>
          {actionCount > 0 && (
            <button
              className="social-attention"
              onClick={() => setScope("todo")}
            >
              <span className="social-attention-icon">
                <ClipboardCheck size={21} />
              </span>
              <span>
                <strong>
                  {actionCount === 1
                    ? "1 tréning čaká na tvoj krok"
                    : actionCount < 5
                      ? `${actionCount} tréningy čakajú na tvoj krok`
                      : `${actionCount} tréningov čaká na tvoj krok`}
                </strong>
                <small>Odpovedz na pozvánku alebo potvrď účasť.</small>
              </span>
              <ChevronRight size={18} />
            </button>
          )}
          <div
            className="social-segments"
            role="group"
            aria-label="Filter dochádzky"
          >
            {(
              [
                { id: "upcoming", label: "Najbližšie" },
                { id: "todo", label: "Na vybavenie" },
                { id: "past", label: "Minulé" },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                aria-pressed={scope === item.id}
                onClick={() => setScope(item.id)}
              >
                {item.label}
                {item.id === "todo" && actionCount > 0 && (
                  <span className="social-inline-count">{actionCount}</span>
                )}
              </button>
            ))}
          </div>
          <label className="social-search-field attendance-search">
            <Search size={18} />
            <input
              aria-label="Hľadať tréning"
              placeholder="Názov, miesto alebo dátum"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                type="button"
                className="text-button"
                onClick={() => setQuery("")}
              >
                Zrušiť
              </button>
            )}
          </label>
          {query && !visibleTrainings.length && (
            <p role="status" className="practice-muted">
              Nenašli sme tréning pre „{query}“. Skús iné slovo alebo obdobie.
            </p>
          )}
          {!query && !loading && !error && !visibleTrainings.length && (
            <div className="community-empty attendance-empty">
              <span className="social-empty-icon">
                {scope === "todo" ? (
                  <CheckCircle2 size={28} />
                ) : (
                  <CalendarDays size={28} />
                )}
              </span>
              <h3>
                {scope === "todo"
                  ? "Všetko vybavené"
                  : scope === "past"
                    ? "Tu bude tvoja tréningová história"
                    : "Priestor na ďalší tréning"}
              </h3>
              <p>
                {scope === "todo"
                  ? "Momentálne od teba nič nečaká na odpoveď."
                  : scope === "past"
                    ? "Ukončené tréningy a potvrdenú účasť nájdeš vždy tu."
                    : "Vytvor spoločný termín alebo počkaj na pozvánku od spoluhráča."}
              </p>
            </div>
          )}
          {visibleTrainings.map((training) => {
            const roster = members.filter((m) => m.training_id === training.id);
            const mine = roster.find((m) => m.player_id === user.id);
            const coach = training.coach_id === user.id;
            const ended =
              zoned(training.training_date, training.start_time).getTime() +
                training.duration_minutes * 60000 <=
              tick;
            const deadlinePassed =
              Date.parse(training.response_deadline) < tick;
            const logged = activities.some(
              (a) => a.sourceEventId === `club-${training.id}`,
            );
            return (
              <article className="club-session" key={training.id}>
                <div className="session-card-heading">
                  <div className="session-date">
                    <strong>
                      {new Date(`${training.training_date}T12:00:00`).getDate()}
                    </strong>
                    <span>
                      {new Date(
                        `${training.training_date}T12:00:00`,
                      ).toLocaleDateString("sk-SK", { month: "short" })}
                    </span>
                    {new Date(
                      `${training.training_date}T12:00:00`,
                    ).getFullYear() !== new Date(tick).getFullYear() && (
                      <small>{training.training_date.slice(0, 4)}</small>
                    )}
                  </div>
                  <div>
                    <span
                      className={`social-status ${mine?.attended === true ? "status-confirmed" : ""}`}
                    >
                      {coach
                        ? "Organizuješ"
                        : mine?.attended === true
                          ? "Účasť potvrdená"
                          : ended
                            ? "Ukončený"
                            : "Pozvánka"}
                    </span>
                    <h3>{training.title}</h3>
                  </div>
                </div>
                <div className="social-event-meta">
                  <span>
                    <Clock3 size={15} />
                    {training.start_time.slice(0, 5)} ·{" "}
                    {training.duration_minutes} min
                  </span>
                  {training.location && (
                    <span>
                      <MapPin size={15} />
                      {training.location}
                    </span>
                  )}
                </div>
                {!!training.focus_drills.length && (
                  <div className="social-drills">
                    {training.focus_drills.map((drill) => (
                      <span key={drill}>{drill}</span>
                    ))}
                  </div>
                )}
                <p
                  className={`session-deadline ${deadlinePassed ? "deadline-closed" : ""}`}
                >
                  {deadlinePassed ? "Odpovede uzavreté od " : "Odpovedz do "}{" "}
                  {new Date(training.response_deadline).toLocaleString(
                    "sk-SK",
                    {
                      timeZone: "Europe/Bratislava",
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    },
                  )}
                </p>
                {coach && (
                  <>
                    {ended && (
                      <div className="attendance-progress">
                        <div>
                          <strong>Skutočná dochádzka</strong>
                          <span>
                            {roster.filter((m) => m.attended !== null).length} /{" "}
                            {roster.length} overených
                          </span>
                        </div>
                        <progress
                          aria-label="Overená dochádzka"
                          max={roster.length || 1}
                          value={
                            roster.filter((m) => m.attended !== null).length
                          }
                        />
                        <div className="attendance-result-counts">
                          <span>
                            <strong>
                              {roster.filter((m) => m.attended === true).length}
                            </strong>{" "}
                            Prišli
                          </span>
                          <span>
                            <strong>
                              {
                                roster.filter((m) => m.attended === false)
                                  .length
                              }
                            </strong>{" "}
                            Neprišli
                          </span>
                          <span>
                            <strong>
                              {roster.filter((m) => m.attended === null).length}
                            </strong>{" "}
                            Na potvrdenie
                          </span>
                        </div>
                      </div>
                    )}
                    {!ended && (
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
                          <strong>
                            {roster.filter((m) => !m.response).length}
                          </strong>
                          Bez odpovede
                        </span>
                      </div>
                    )}
                    <details
                      className="attendance-roster"
                      open={ended && roster.some((m) => m.attended === null)}
                    >
                      <summary>
                        <Users size={17} />
                        <span>
                          {ended ? "Potvrdiť skutočnú účasť" : "Pozvaní hráči"}
                          <small>
                            {roster.length} hráčov
                            {ended
                              ? ` · potvrdených ${roster.filter((m) => m.attended !== null).length}`
                              : ""}
                          </small>
                        </span>
                        <ChevronRight size={17} />
                      </summary>
                      {roster.map((member) => (
                        <div className="club-member" key={member.player_id}>
                          <PlayerAvatar
                            name={member.player?.display_name || "Hráč"}
                          />
                          <div>
                            <strong>
                              {member.player?.display_name || "Hráč"}
                            </strong>
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
                    </details>
                  </>
                )}
                {mine && (
                  <>
                    <div className="attendance-your-response">
                      <strong>Tvoja odpoveď</strong>
                      <span>
                        {responses.find((r) => r.id === mine.response)?.label ||
                          "Zatiaľ si neodpovedal/a"}
                      </span>
                    </div>
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
                      <p className="practice-muted">
                        Tréner zaznamenal neúčasť.
                      </p>
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
        </>
      )}
    </section>
  );
}
