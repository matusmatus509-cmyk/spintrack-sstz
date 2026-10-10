import { newActivityId } from '../utils/activityId';
import React, { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Plus,
  Minus,
  Save,
  Clock,
  Trophy,
  Shield,
  Users,
  CalendarDays,
  Lock,
  Camera,
} from "lucide-react";
import { useDialog } from "../hooks/useDialog";
import { useCommunity } from "../context/CommunityContext";
import { communityError } from "../views/CommunityView";
import { useApp } from "../context/AppContext";
import {
  ActivityRecord,
  ActivityCategory,
  ActivityOpponentRubber,
  ActivityVisibility,
} from "../types";

interface AddActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultCategory?: ActivityCategory;
}

const categories = [
  {
    id: "tréning",
    label: "Tréning",
    icon: Clock,
    hint: "Čas na zlepšenie. Zapíš náplň a pocit z tréningu.",
  },
  {
    id: "priatelsky",
    label: "Zápas",
    icon: Users,
    hint: "Súper, výsledok a postrehy z priateľského zápasu.",
  },
  {
    id: "turnaj",
    label: "Turnaj",
    icon: Trophy,
    hint: "Turnaj, kategória a výsledok tvojho duelu.",
  },
  {
    id: "liga",
    label: "Liga",
    icon: Shield,
    hint: "Súťaž, tímy a tvoj zápas proti súperovi.",
  },
  {
    id: "podujatie",
    label: "Podujatie",
    icon: CalendarDays,
    hint: "Názov, miesto a zážitky z podujatia.",
  },
] as const;
const drills = [
  "Rozcvička",
  "FH",
  "BH",
  "Práca nôh",
  "Topspin",
  "Blok / kontra",
  "Krátka hra",
  "Podanie",
  "Príjem",
  "Multiball",
  "Robot",
  "Hra na body",
  "Kondícia",
];
const rubbers: { value: ActivityOpponentRubber; label: string }[] = [
  { value: "in", label: "Hladký" },
  { value: "long_pips", label: "Tráva" },
  { value: "short_pips", label: "Krátke nopky" },
  { value: "anti", label: "Antispin" },
];
const localDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};
const initialForm = (category: ActivityCategory, racketId: string) => ({
  category,
  date: localDate(),
  duration: 60,
  startTime: "",
  location: "",
  title: "",
  leagueName: "",
  teamHome: "",
  teamAway: "",
  round: "",
  eventCategory: "",
  placing: "",
  eventResult: "",
  opponentName: "",
  grip: "" as "" | "left" | "right",
  fh: "" as "" | ActivityOpponentRubber,
  bh: "" as "" | ActivityOpponentRubber,
  ownScore: "",
  opponentScore: "",
  publicNote: "",
  privateNote: "",
  visibility: "private" as ActivityVisibility,
  racketId,
  wear: true,
  drills: ["Rozcvička", "Topspin"],
  photos: [] as string[],
  tournamentDuel: true,
});

export const AddActivityModal: React.FC<AddActivityModalProps> = ({
  isOpen,
  onClose,
  defaultCategory = "tréning",
}) => {
  const community = useCommunity();
  const [invitees, setInvitees] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const localId = useRef(newActivityId());
  const { addActivity, rackets, activeRacket, opponents } = useApp();
  const [form, setForm] = useState(() =>
    initialForm(defaultCategory, activeRacket?.id || ""),
  );
  const [customDrill, setCustomDrill] = useState("");
  const [error, setError] = useState("");
  const dialogRef = useDialog(isOpen, () => {
    if (!saving) onClose();
  });
  useEffect(() => {
    if (isOpen) {
      setForm(initialForm(defaultCategory, activeRacket?.id || ""));
      setCustomDrill("");
      setError("");
      setInvitees([]);
      localId.current = newActivityId();
    }
  }, [isOpen, defaultCategory, activeRacket?.id]);
  const field = <K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K],
  ) => setForm((prev) => ({ ...prev, [key]: value }));
  const training = form.category === "tréning";
  const match =
    form.category === "liga" ||
    form.category === "priatelsky" ||
    (form.category === "turnaj" && form.tournamentDuel);
  const current = categories.find((c) => c.id === form.category)!;
  const Icon = current.icon;

  const selectOpponent = (name: string) => {
    const opponent = opponents.find(
      (o) => o.name.toLowerCase() === name.toLowerCase(),
    );
    const rubber = (value?: string): "" | ActivityOpponentRubber =>
      value === "soft"
        ? "in"
        : value === "antispin"
          ? "anti"
          : value === "long_pips" || value === "short_pips"
            ? value
            : "";
    setForm((prev) => ({
      ...prev,
      opponentName: name,
      grip:
        opponent?.handedness === "left" || opponent?.handedness === "right"
          ? opponent.handedness
          : "",
      fh: rubber(opponent?.forehandRubber),
      bh: rubber(opponent?.backhandRubber),
    }));
  };
  const addDrill = () => {
    const value = customDrill.trim();
    if (value) field("drills", Array.from(new Set([...form.drills, value])));
    setCustomDrill("");
  };
  const uploadPhotos = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []).filter((file) =>
      file.type.startsWith("image/"),
    );
    const encoded = await Promise.all(
      files.map(
        (file) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = reject;
            reader.readAsDataURL(file);
          }),
      ),
    ).catch(() => {
      setError("Fotku sa nepodarilo načítať. Skús ju pridať znova.");
      return [];
    });
    setForm((prev) => ({ ...prev, photos: [...prev.photos, ...encoded] }));
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    const own = Number(form.ownScore),
      other = Number(form.opponentScore);
    if (
      match &&
      (form.ownScore === "" ||
        form.opponentScore === "" ||
        own === other ||
        ![3, 4].includes(Math.max(own, other)))
    ) {
      setError(
        "Zadaj konečné skóre na 3 alebo 4 víťazné sety, napríklad 3:1 alebo 2:4.",
      );
      return;
    }
    const activity: Omit<ActivityRecord, "id" | "createdAt"> = {
      startTime: form.startTime || undefined,
      category: form.category,
      date: form.date,
      durationMinutes: training ? form.duration : 0,
      focusDrills: training ? form.drills : [],
      location: form.location.trim(),
      title: ["turnaj", "podujatie"].includes(form.category)
        ? form.title.trim()
        : undefined,
      leagueName: form.category === "liga" ? form.leagueName.trim() : undefined,
      teamHome: form.category === "liga" ? form.teamHome.trim() : undefined,
      teamAway: form.category === "liga" ? form.teamAway.trim() : undefined,
      round: match ? form.round.trim() : undefined,
      eventCategory:
        form.category === "turnaj" ? form.eventCategory.trim() : undefined,
      placing: form.category === "turnaj" ? form.placing.trim() : undefined,
      eventResult:
        form.category === "podujatie" ? form.eventResult.trim() : undefined,
      opponentName: match ? form.opponentName.trim() : undefined,
      opponentGrip: match ? form.grip || undefined : undefined,
      opponentFhRubber: match ? form.fh || undefined : undefined,
      opponentBhRubber: match ? form.bh || undefined : undefined,
      matchScore: match ? `${own}:${other}` : undefined,
      matchResult: match ? (own > other ? "WIN" : "LOSS") : undefined,
      publicNote: form.publicNote.trim() || undefined,
      privateNote: form.privateNote.trim() || undefined,
      visibility: form.visibility,
      racketId:
        form.category !== "podujatie" ? form.racketId || undefined : undefined,
      addEquipmentWear: training && form.wear,
      photos: form.photos.length ? form.photos : undefined,
    };
    if (form.visibility !== "private" && !community.user) {
      setError("Na zdieľanie aktivity sa najprv prihlás v komunite.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (community.user && form.visibility !== "private") {
        await community.publishActivity(localId.current, activity, invitees);
      }
      addActivity(activity, localId.current);
      onClose();
    } catch (error) {
      setError(communityError(error));
    } finally {
      setSaving(false);
    }
  };
  if (!isOpen) return null;

  return createPortal(
    <div
      className="activity-overlay"
      onClick={() => {
        if (!saving) onClose();
      }}
    >
      <div
        className="activity-dialog"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="activity-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="activity-header">
          <div>
            <span className="activity-eyebrow">TVOJ ŠPORTOVÝ DENNÍK</span>
            <h2 id="activity-title">Pridať aktivitu</h2>
          </div>
          <button
            type="button"
            className="activity-icon-button"
            aria-label="Zavrieť"
            disabled={saving}
            onClick={onClose}
          >
            <X size={22} />
          </button>
        </header>
        <form onSubmit={submit} className="activity-form">
          <div className="activity-body">
            <div
              className="activity-types"
              role="group"
              aria-label="Typ aktivity"
            >
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={form.category === c.id}
                  className={form.category === c.id ? "selected" : ""}
                  onClick={() => {
                    field("category", c.id);
                    setError("");
                  }}
                >
                  <c.icon size={21} />
                  <span>{c.label}</span>
                </button>
              ))}
            </div>
            <div className="activity-context">
              <Icon size={23} />
              <div>
                <strong>{current.label}</strong>
                <p>{current.hint}</p>
              </div>
            </div>
            <section className="activity-section">
              <h3>Základné údaje</h3>
              <div className="activity-grid">
                <label>
                  Dátum
                  <input
                    type="date"
                    required
                    value={form.date}
                    onChange={(e) => field("date", e.target.value)}
                  />
                </label>
                <label>
                  Miesto
                  <input
                    placeholder="Herňa, mesto alebo športová hala"
                    value={form.location}
                    onChange={(e) => field("location", e.target.value)}
                  />
                </label>
              </div>
              <label>
                Začiatok (voliteľné)
                <input
                  type="time"
                  value={form.startTime}
                  onChange={(e) => field("startTime", e.target.value)}
                />
              </label>
              {["turnaj", "podujatie"].includes(form.category) && (
                <label>
                  Názov {form.category === "turnaj" ? "turnaja" : "podujatia"}
                  <input
                    required
                    placeholder={
                      form.category === "turnaj"
                        ? "Napr. Majstrovstvá Slovenska"
                        : "Napr. Klubový stolnotenisový deň"
                    }
                    value={form.title}
                    onChange={(e) => field("title", e.target.value)}
                  />
                </label>
              )}
              {form.category === "liga" && (
                <>
                  <label>
                    Liga / súťaž
                    <input
                      required
                      placeholder="Napr. 3. liga mužov"
                      value={form.leagueName}
                      onChange={(e) => field("leagueName", e.target.value)}
                    />
                  </label>
                  <div className="activity-grid">
                    <label>
                      Domáci tím
                      <input
                        value={form.teamHome}
                        onChange={(e) => field("teamHome", e.target.value)}
                        placeholder="Názov domáceho klubu"
                      />
                    </label>
                    <label>
                      Hosťujúci tím
                      <input
                        value={form.teamAway}
                        onChange={(e) => field("teamAway", e.target.value)}
                        placeholder="Názov hosťujúceho klubu"
                      />
                    </label>
                  </div>
                </>
              )}
              {form.category === "turnaj" && (
                <>
                  <div className="activity-grid">
                    <label>
                      Kategória
                      <input
                        placeholder="Napr. Muži, U19"
                        value={form.eventCategory}
                        onChange={(e) => field("eventCategory", e.target.value)}
                      />
                    </label>
                    <label>
                      Umiestnenie
                      <input
                        placeholder="Napr. 3. miesto"
                        value={form.placing}
                        onChange={(e) => field("placing", e.target.value)}
                      />
                    </label>
                  </div>
                  <label className="activity-check">
                    <input
                      type="checkbox"
                      checked={form.tournamentDuel}
                      onChange={(e) =>
                        field("tournamentDuel", e.target.checked)
                      }
                    />
                    Zapísať aj konkrétny zápas na turnaji
                  </label>
                </>
              )}
              {form.category === "podujatie" && (
                <label>
                  Výsledok / skóre (voliteľné)
                  <input
                    placeholder="Napr. Víťaz tímovej súťaže alebo 8:2"
                    value={form.eventResult}
                    onChange={(e) => field("eventResult", e.target.value)}
                  />
                </label>
              )}
            </section>
            {training && (
              <section className="activity-section">
                <h3>Trvanie a náplň tréningu</h3>
                <div className="activity-duration">
                  <button
                    type="button"
                    className="activity-icon-button"
                    aria-label="Ubrať 10 minút"
                    onClick={() =>
                      field("duration", Math.max(10, form.duration - 10))
                    }
                  >
                    <Minus size={20} />
                  </button>
                  <label>
                    <input
                      type="number"
                      min="10"
                      max="600"
                      step="1"
                      required
                      value={form.duration}
                      onChange={(e) =>
                        field("duration", Number(e.target.value))
                      }
                      aria-label="Trvanie v minútach"
                    />
                    <span>minút</span>
                  </label>
                  <button
                    type="button"
                    className="activity-icon-button"
                    aria-label="Pridať 10 minút"
                    onClick={() =>
                      field("duration", Math.min(600, form.duration + 10))
                    }
                  >
                    <Plus size={20} />
                  </button>
                </div>
                <div className="activity-chips">
                  {[30, 45, 60, 90, 120].map((min) => (
                    <button
                      type="button"
                      key={min}
                      className={form.duration === min ? "selected" : ""}
                      aria-pressed={form.duration === min}
                      onClick={() => field("duration", min)}
                    >
                      {min} min
                    </button>
                  ))}
                </div>
                <label>Zameranie tréningu</label>
                <div className="activity-chips">
                  {Array.from(new Set([...drills, ...form.drills])).map(
                    (drill) => (
                      <button
                        type="button"
                        key={drill}
                        aria-pressed={form.drills.includes(drill)}
                        className={
                          form.drills.includes(drill) ? "selected" : ""
                        }
                        onClick={() =>
                          field(
                            "drills",
                            form.drills.includes(drill)
                              ? form.drills.filter((d) => d !== drill)
                              : [...form.drills, drill],
                          )
                        }
                      >
                        {drill}
                      </button>
                    ),
                  )}
                </div>
                <div className="activity-add-tag">
                  <input
                    aria-label="Vlastné cvičenie"
                    placeholder="Pridať vlastné cvičenie"
                    value={customDrill}
                    onChange={(e) => setCustomDrill(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addDrill();
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="activity-icon-button"
                    aria-label="Pridať cvičenie"
                    onClick={addDrill}
                  >
                    <Plus size={20} />
                  </button>
                </div>
              </section>
            )}
            {match && (
              <section className="activity-section">
                <h3>Súper a výsledok</h3>
                <label>
                  Súper
                  <input
                    required
                    list="activity-opponents"
                    autoComplete="off"
                    placeholder="Vyhľadaj alebo napíš meno súpera"
                    value={form.opponentName}
                    onChange={(e) => selectOpponent(e.target.value)}
                  />
                </label>
                <datalist id="activity-opponents">
                  {opponents.map((o) => (
                    <option key={o.id} value={o.name} />
                  ))}
                </datalist>
                <label>
                  {form.category === "liga"
                    ? "Kolo ligy"
                    : "Kolo / fáza zápasu"}
                  <input
                    placeholder={
                      form.category === "turnaj"
                        ? "Napr. Skupina A, štvrťfinále"
                        : "Napr. 5. kolo"
                    }
                    value={form.round}
                    onChange={(e) => field("round", e.target.value)}
                  />
                </label>
                <div className="activity-score">
                  <label>
                    Moje sety
                    <select
                      required
                      aria-label="Moje vyhrané sety"
                      value={form.ownScore}
                      onChange={(e) => {
                        field("ownScore", e.target.value);
                        setError("");
                      }}
                    >
                      <option value="">–</option>
                      {[0, 1, 2, 3, 4].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </label>
                  <span aria-hidden="true">:</span>
                  <label>
                    Súperove sety
                    <select
                      required
                      aria-label="Súperove vyhrané sety"
                      value={form.opponentScore}
                      onChange={(e) => {
                        field("opponentScore", e.target.value);
                        setError("");
                      }}
                    >
                      <option value="">–</option>
                      {[0, 1, 2, 3, 4].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <p className="activity-help">
                  Skóre zapisuj z tvojho pohľadu. Výhra alebo prehra sa určí
                  automaticky.
                </p>
                <details className="activity-details">
                  <summary>Herný štýl a výbava súpera</summary>
                  <div className="activity-grid">
                    <label>
                      Hrá rukou
                      <select
                        value={form.grip}
                        onChange={(e) =>
                          field("grip", e.target.value as typeof form.grip)
                        }
                      >
                        <option value="">Neviem</option>
                        <option value="right">Pravá</option>
                        <option value="left">Ľavá</option>
                      </select>
                    </label>
                    {(["fh", "bh"] as const).map((side) => (
                      <label key={side}>
                        {side.toUpperCase()} poťah
                        <select
                          value={form[side]}
                          onChange={(e) =>
                            field(side, e.target.value as typeof form.fh)
                          }
                        >
                          <option value="">Neviem</option>
                          {rubbers.map((r) => (
                            <option key={r.value} value={r.value}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>
                </details>
              </section>
            )}
            <section className="activity-section">
              <h3>Poznámky a fotky</h3>
              <label>
                Poznámka
                <textarea
                  rows={3}
                  placeholder={
                    training
                      ? "Čo sa darilo a čo chceš zlepšiť?"
                      : "Priebeh, výsledok a tvoje postrehy…"
                  }
                  value={form.publicNote}
                  onChange={(e) => field("publicNote", e.target.value)}
                />
              </label>
              <label>
                <span>
                  <Lock size={13} /> Súkromná poznámka
                </span>
                <textarea
                  rows={2}
                  placeholder="Taktika a postrehy iba pre teba"
                  value={form.privateNote}
                  onChange={(e) => field("privateNote", e.target.value)}
                />
              </label>
              <div className="activity-photos">
                {form.photos.map((photo, index) => (
                  <div key={index}>
                    <img src={photo} alt={`Fotka aktivity ${index + 1}`} />
                    <button
                      type="button"
                      aria-label={`Odstrániť fotku ${index + 1}`}
                      onClick={() =>
                        field(
                          "photos",
                          form.photos.filter((_, i) => i !== index),
                        )
                      }
                    >
                      <X size={15} />
                    </button>
                  </div>
                ))}
                <label className="activity-upload">
                  <Camera size={21} />
                  <span>Pridať fotky</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={uploadPhotos}
                  />
                </label>
              </div>
            </section>
            <section className="activity-section">
              <h3>Uloženie záznamu</h3>
              <label>
                Viditeľnosť
                <select
                  value={form.visibility}
                  onChange={(e) => {
                    field("visibility", e.target.value as ActivityVisibility);
                    if (e.target.value === "private") setInvitees([]);
                  }}
                >
                  <option value="private">Len ja</option>
                  <option value="friends" disabled={!community.user}>
                    Iba priatelia
                  </option>
                  <option value="community" disabled={!community.user}>
                    Verejná
                  </option>
                </select>
              </label>
              {!community.user && (
                <p className="activity-hint">
                  Pre zdieľanie a pozvanie priateľov sa prihlás v sekcii
                  Komunita.
                </p>
              )}
              {community.user && (
                <>
                  <h3>Označiť priateľov</h3>
                  <p className="activity-hint">
                    Dostanú pozvánku a tréning alebo aktivitu si môžu pridať do
                    svojho kalendára. Súkromná poznámka a fotky zostávajú iba u
                    teba.
                  </p>
                  {community.friends.length ? (
                    <div className="activity-friends">
                      {community.friends.map((friend) => (
                        <label className="activity-check" key={friend.id}>
                          <input
                            type="checkbox"
                            checked={invitees.includes(friend.id)}
                            onChange={(e) => {
                              setInvitees((prev) =>
                                e.target.checked
                                  ? [...prev, friend.id]
                                  : prev.filter((id) => id !== friend.id),
                              );
                              if (
                                e.target.checked &&
                                form.visibility === "private"
                              )
                                field("visibility", "friends");
                            }}
                          />
                          {friend.display_name} <small>@{friend.handle}</small>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="activity-hint">
                      Priateľov si pridáš v sekcii Komunita → Priatelia.
                    </p>
                  )}
                </>
              )}
              {form.category !== "podujatie" && (
                <label>
                  Použitá raketa
                  <select
                    value={form.racketId}
                    onChange={(e) => field("racketId", e.target.value)}
                  >
                    <option value="">Bez priradenia</option>
                    {rackets.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                        {r.isActive ? " · aktívna" : ""}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {training && (
                <label className="activity-check">
                  <input
                    type="checkbox"
                    checked={form.wear}
                    onChange={(e) => field("wear", e.target.checked)}
                  />
                  Započítať {form.duration} minút do opotrebovania rakety
                </label>
              )}
            </section>
            {error && (
              <p className="activity-error" role="alert">
                {error}
              </p>
            )}
          </div>
          <footer className="activity-footer">
            <button
              type="button"
              className="btn-secondary"
              disabled={saving}
              onClick={onClose}
            >
              Zrušiť
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              <Save size={18} /> {saving ? "Ukladám…" : "Uložiť"}{" "}
              {form.category === "tréning"
                ? "tréning"
                : form.category === "priatelsky" || form.category === "liga"
                  ? "zápas"
                  : form.category === "turnaj"
                    ? "turnaj"
                    : "podujatie"}
            </button>
          </footer>
        </form>
      </div>
    </div>,
    document.body,
  );
};
