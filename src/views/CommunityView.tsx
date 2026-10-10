import React, { useEffect, useState } from "react";
import {
  ChevronRight,
  Users,
  UserPlus,
  CalendarPlus,
  RefreshCw,
  Globe,
  Lock,
  LogOut,
  Check,
  Mail,
} from "lucide-react";
import { useCommunity } from "../context/CommunityContext";
import { formatDuration } from "../utils/formatDuration";
import { useApp } from "../context/AppContext";
import type { NavTab } from "../components/Navigation";
import type { ActivityRecord, ActivityVisibility } from "../types";
import type { PlayerProfile, SharedActivityData } from "../types/community";
import { mergeLocalData } from "../utils/community";
import "./Community.css";

const visibilityLabel = {
  private: "Len ja",
  friends: "Iba priatelia",
  community: "Verejná",
};
const categoryLabel = {
  tréning: "Tréning",
  priatelsky: "Zápas",
  turnaj: "Turnaj",
  liga: "Liga",
  podujatie: "Podujatie",
};
export function communityError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (/Invalid login credentials/i.test(message))
    return "Nesprávny e-mail alebo heslo.";
  if (/Email not confirmed/i.test(message))
    return "Najprv potvrď svoj e-mail cez odkaz v správe.";
  if (/already registered/i.test(message))
    return "Tento e-mail už má účet. Prihlás sa alebo obnov heslo.";
  if (/duplicate|unique|Database error saving new user/i.test(message))
    return "Používateľské meno môže byť obsadené. Skús iné meno.";
  if (/rate limit|too many|security purposes/i.test(message))
    return "Príliš veľa pokusov. Skús to o chvíľu.";
  if (/password.*(least|weak)/i.test(message))
    return "Zvoľ silnejšie heslo s aspoň 8 znakmi.";
  if (
    /^(Pozvať|Súkromná|Pozvánka|Aktivita|Žiadosť|Najprv|Neplatn)/.test(message)
  )
    return message;
  return "Nepodarilo sa to dokončiť. Skontroluj pripojenie a skús znova.";
}
export function ActivityPreview({ data }: { data: SharedActivityData }) {
  return (
    <div className="community-activity-info">
      <span className="community-kicker">
        {categoryLabel[data.category] || "Aktivita"}
      </span>
      <h3>
        {data.title ||
          (data.opponentName
            ? `Zápas s ${data.opponentName}`
            : categoryLabel[data.category])}
      </h3>
      <p>
        {new Date(`${data.date}T12:00:00`).toLocaleDateString("sk-SK")}
        {data.startTime && ` · ${data.startTime}`}
        {data.durationMinutes > 0 && ` · ${formatDuration(data.durationMinutes)}`}
        {data.matchScore && ` · ${data.matchScore}`}
      </p>
      {data.location && <p>{data.location}</p>}
      {data.leagueName && <p>{data.leagueName}</p>}
      {data.publicNote && <p className="community-note">{data.publicNote}</p>}
    </div>
  );
}
function AuthForm() {
  const account = useCommunity();
  const [mode, setMode] = useState<"login" | "register" | "reset">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (account.recovering) {
        await account.changePassword(password);
        setMessage("Heslo bolo zmenené.");
      } else if (mode === "reset") {
        await account.resetPassword(email);
        setMessage(
          "Ak účet existuje, príde ti e-mail s odkazom na obnovu hesla.",
        );
      } else if (mode === "register") {
        const signedIn = await account.register(email, password, name, handle);
        if (!signedIn)
          setMessage(
            "Skontroluj e-mail a potvrď registráciu. Potom sa môžeš prihlásiť.",
          );
      } else await account.login(email, password);
    } catch (error) {
      setError(communityError(error));
    } finally {
      setBusy(false);
    }
  };
  const recovery = account.recovering;
  return (
    <section className="glass-panel community-auth">
      <span className="community-avatar">
        <Users size={25} />
      </span>
      <h2>
        {recovery
          ? "Nové heslo"
          : mode === "register"
            ? "Pridaj sa k hráčom"
            : mode === "reset"
              ? "Obnoviť heslo"
              : "Tvoja hra, tvoji priatelia"}
      </h2>
      <p>
        {recovery
          ? "Nastav si nové heslo k svojmu účtu."
          : "Maj vlastný účet, zdieľaj aktivity a dohodni si spoločný tréning."}
      </p>
      {!recovery && (
        <div
          className="community-tabs"
          role="group"
          aria-label="Prihlásenie alebo registrácia"
        >
          {(["login", "register"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              onClick={() => {
                setMode(value);
                setError("");
                setMessage("");
              }}
            >
              {value === "login" ? "Prihlásiť sa" : "Vytvoriť účet"}
            </button>
          ))}
        </div>
      )}
      <form onSubmit={submit} className="community-form">
        {!recovery && (
          <label>
            E-mail
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={254}
            />
          </label>
        )}
        {mode === "register" && !recovery && (
          <>
            <label>
              Tvoje meno
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                autoComplete="name"
              />
            </label>
            <label>
              Používateľské meno
              <input
                required
                value={handle}
                onChange={(e) => setHandle(e.target.value.toLowerCase())}
                pattern="[a-z0-9_]{3,32}"
                minLength={3}
                maxLength={32}
                autoComplete="username"
                placeholder="napr. matus_ocovan"
              />
              <small>
                3 až 32 znakov: malé písmená bez diakritiky, čísla a
                podčiarkovník.
              </small>
            </label>
          </>
        )}
        {(recovery || mode !== "reset") && (
          <label>
            Heslo
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={recovery || mode === "register" ? 8 : undefined}
              maxLength={128}
              autoComplete={
                recovery || mode === "register"
                  ? "new-password"
                  : "current-password"
              }
            />
          </label>
        )}
        {error && (
          <p role="alert" className="community-error">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="community-message">
            <Mail size={17} /> {message}
          </p>
        )}
        <button className="btn-primary" disabled={busy}>
          {busy
            ? "Chvíľku počkaj…"
            : recovery
              ? "Uložiť nové heslo"
              : mode === "register"
                ? "Vytvoriť účet"
                : mode === "reset"
                  ? "Poslať odkaz na obnovu"
                  : "Prihlásiť sa"}
        </button>
        {!recovery && mode !== "reset" && (
          <button
            type="button"
            className="text-button"
            onClick={() => {
              setMode("reset");
              setError("");
              setMessage("");
            }}
          >
            Zabudnuté heslo
          </button>
        )}
      </form>
    </section>
  );
}
export function CommunityView({
  onNavigate,
}: {
  onNavigate: (tab: NavTab) => void;
}) {
  const account = useCommunity();
  const { activities, updateActivity, exportData, importData } = useApp();
  const [tab, setTab] = useState<"feed" | "friends" | "invitations" | "mine">(
    "feed",
  );
  const [feedScope, setFeedScope] = useState<"all" | "friends">("all");
  const [query, setQuery] = useState("");
  const [players, setPlayers] = useState<PlayerProfile[]>([]);
  const [searched, setSearched] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [club, setClub] = useState("");
  const [limit, setLimit] = useState(20);
  useEffect(() => {
    if (account.profile) {
      setName(account.profile.display_name);
      setHandle(account.profile.handle);
      setClub(account.profile.club);
    }
  }, [account.profile]);
  const run = async (
    key: string,
    action: () => Promise<void>,
    success = "",
  ) => {
    if (busy) return;
    setBusy(key);
    setError("");
    setMessage("");
    try {
      await action();
      if (success) setMessage(success);
    } catch (error) {
      setError(communityError(error));
    } finally {
      setBusy("");
    }
  };
  const visibility = async (
    activity: ActivityRecord,
    next: ActivityVisibility,
  ) => {
    const shared = account.ownShares.find(
      (row) => row.local_id === activity.id,
    );
    if (shared) await account.changeVisibility(shared.id, next);
    else if (next !== "private")
      await account.publishActivity(
        activity.id,
        { ...activity, visibility: next },
        [],
      );
    updateActivity(activity.id, { visibility: next });
  };
  if (!account.configured)
    return (
      <div className="page-view community-view">
        <div className="page-header">
          <h1>Komunita</h1>
        </div>
        <section className="glass-panel community-auth">
          <Users size={34} />
          <h2>Komunita sa pripravuje</h2>
          <p>
            Prihlásenie a zdieľanie ešte nie sú pripojené. Svoj denník môžeš
            zatiaľ používať bez účtu.
          </p>
          <button
            className="btn-primary"
            onClick={() => onNavigate("dashboard")}
          >
            Späť na prehľad
          </button>
        </section>
      </div>
    );
  if (!account.user || account.recovering)
    return (
      <div className="page-view community-view">
        <AuthForm />
      </div>
    );
  const pending = account.invitations.filter(
    (invite) => invite.status === "pending",
  );
  const incoming = account.requests.filter(
    (request) =>
      request.status === "pending" && request.recipient_id === account.user!.id,
  );
  const outgoing = account.requests.filter(
    (request) =>
      request.status === "pending" && request.requester_id === account.user!.id,
  );
  const friendsIds = new Set(account.friends.map((player) => player.id));
  const feed = [...account.feed, ...account.ownShares]
    .sort(
      (a, b) =>
        b.activity_date.localeCompare(a.activity_date) ||
        b.created_at.localeCompare(a.created_at),
    )
    .filter(
      (row) =>
        row.visibility !== "private" &&
        (feedScope === "all" || friendsIds.has(row.owner_id)),
    );
  const myActivities = [...activities].sort((a, b) =>
    b.date.localeCompare(a.date),
  );
  let guestData: string | null = null;
  try {
    guestData = localStorage.getItem("spintrack_sstz_data_v1");
  } catch {
    /* storage may be unavailable */
  }
  return (
    <div className="page-view community-view animate-fade-in">
      <div className="page-header">
        <div>
          <h1>Komunita</h1>
          <p>Hráči, spoločné tréningy a tvoj denník.</p>
        </div>
        <button
          className="btn-secondary"
          disabled={Boolean(busy) || account.socialLoading}
          onClick={() => {
            void run("refresh", account.refresh);
          }}
        >
          <RefreshCw size={16} /> Obnoviť
        </button>
      </div>
      <details className="glass-panel community-account">
        <summary className="community-person">
          <span className="community-avatar">
            {account.profile?.display_name.slice(0, 1)}
          </span>
          <div>
            <strong>{account.profile?.display_name}</strong>
            <small>
              @{account.profile?.handle}
              {account.profile?.club && ` · ${account.profile.club}`}
            </small>
          </div>
          <ChevronRight size={18} />
        </summary>
        <div className="community-account-options">
          <details>
            <summary>Upraviť profil</summary>
            <form
              className="community-form"
              onSubmit={(event) => {
                event.preventDefault();
                void run(
                  "profile",
                  () => account.updateProfile(name, handle, club),
                  "Profil bol uložený.",
                );
              }}
            >
              <label>
                Meno
                <input
                  required
                  maxLength={80}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label>
                Používateľské meno
                <input
                  required
                  pattern="[a-z0-9_]{3,32}"
                  minLength={3}
                  maxLength={32}
                  value={handle}
                  onChange={(e) => setHandle(e.target.value.toLowerCase())}
                />
              </label>
              <label>
                Klub
                <input
                  maxLength={120}
                  value={club}
                  onChange={(e) => setClub(e.target.value)}
                />
              </label>
              <button className="btn-primary" disabled={Boolean(busy)}>
                Uložiť profil
              </button>
            </form>
          </details>
          <div className="community-actions">
            {guestData && (
              <button
                className="btn-secondary"
                disabled={Boolean(busy)}
                onClick={() => {
                  void run(
                    "migrate",
                    async () => {
                      const data = mergeLocalData(
                        JSON.parse(exportData()),
                        JSON.parse(guestData!),
                      );
                      if (!importData(JSON.stringify(data)))
                        throw new Error("Import zlyhal.");
                    },
                    "Miestne údaje boli pridané do účtu. Prenesené aktivity sú súkromné.",
                  );
                }}
              >
                Preniesť miestne údaje do účtu
              </button>
            )}
            <button
              className="text-button"
              disabled={Boolean(busy)}
              onClick={() => {
                void run("logout", account.logout);
              }}
            >
              <LogOut size={15} /> Odhlásiť sa
            </button>
          </div>
        </div>
      </details>
      {account.cloudError && (
        <div role="alert" className="community-error">
          {account.cloudError}{" "}
          <button
            className="text-button"
            onClick={() =>
              account.saveAccountData({
                ...JSON.parse(exportData()),
                _updatedAt: new Date().toISOString(),
              })
            }
          >
            Uložiť znova
          </button>
        </div>
      )}
      {account.socialError && (
        <p role="alert" className="community-error">
          {account.socialError}
        </p>
      )}
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
      <div className="community-tabs" role="group" aria-label="Sekcie komunity">
        {(
          [
            { id: "feed", label: "Aktivity" },
            {
              id: "friends",
              label: `Priatelia${incoming.length ? ` (${incoming.length})` : ""}`,
            },
            {
              id: "invitations",
              label: `Pozvánky${pending.length ? ` (${pending.length})` : ""}`,
            },
            { id: "mine", label: "Moje aktivity" },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            aria-pressed={tab === item.id}
            onClick={() => {
              setTab(item.id);
              setError("");
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
      {account.socialLoading && !account.feed.length && (
        <p role="status">Načítavam komunitu…</p>
      )}
      {tab === "feed" && (
        <>
          <div
            className="community-tabs small"
            role="group"
            aria-label="Aktivity komunity"
          >
            <button
              aria-pressed={feedScope === "all"}
              onClick={() => setFeedScope("all")}
            >
              Verejné a priatelia
            </button>
            <button
              aria-pressed={feedScope === "friends"}
              onClick={() => setFeedScope("friends")}
            >
              Iba priatelia
            </button>
          </div>
          {!feed.length && !account.socialLoading && (
            <section className="glass-panel community-empty">
              <Globe size={26} />
              <h2>Zatiaľ žiadne aktivity</h2>
              <p>Pridaj si priateľov alebo zdieľaj prvý tréning.</p>
              <button
                className="btn-secondary"
                onClick={() => setTab("friends")}
              >
                Nájsť priateľov
              </button>
            </section>
          )}
          {feed.map((activity) => (
            <article className="glass-panel community-card" key={activity.id}>
              <div className="community-person">
                <span className="community-avatar">
                  {activity.author.display_name.slice(0, 1)}
                </span>
                <div>
                  <strong>{activity.author.display_name}</strong>
                  <small>@{activity.author.handle}</small>
                </div>
                <span className="community-visibility">
                  {visibilityLabel[activity.visibility]}
                </span>
              </div>
              <ActivityPreview data={activity.payload} />
            </article>
          ))}
        </>
      )}
      {tab === "friends" && (
        <>
          <form
            className="community-search"
            onSubmit={(event) => {
              event.preventDefault();
              void run("search", async () => {
                setPlayers(await account.searchPlayers(query));
                setSearched(true);
              });
            }}
          >
            <label className="sr-only" htmlFor="player-query">
              Meno alebo používateľské meno hráča
            </label>
            <input
              id="player-query"
              required
              minLength={2}
              maxLength={80}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSearched(false);
              }}
              placeholder="Meno alebo @používateľské meno"
            />
            <button className="btn-primary" disabled={Boolean(busy)}>
              <UserPlus size={17} /> Hľadať
            </button>
          </form>
          {searched && !players.length && (
            <p>Nenašiel sa žiadny hráč. Skús jeho používateľské meno.</p>
          )}
          {searched &&
            players.map((player) => {
              const request = account.requests.find(
                (row) =>
                  row.requester_id === player.id ||
                  row.recipient_id === player.id,
              );
              return (
                <article
                  className="glass-panel community-friend"
                  key={player.id}
                >
                  <div>
                    <strong>{player.display_name}</strong>
                    <small>
                      @{player.handle}
                      {player.club && ` · ${player.club}`}
                    </small>
                  </div>
                  <button
                    className="btn-secondary"
                    disabled={Boolean(busy) || Boolean(request)}
                    onClick={() => {
                      void run(
                        player.id,
                        () => account.requestFriend(player.id),
                        "Žiadosť o priateľstvo bola odoslaná.",
                      );
                    }}
                  >
                    {request?.status === "accepted"
                      ? "Priateľ"
                      : request
                        ? "Čaká na prijatie"
                        : "Pridať priateľa"}
                  </button>
                </article>
              );
            })}
          {incoming.length > 0 && <h2>Žiadosti o priateľstvo</h2>}
          {incoming.map((request) => (
            <article className="glass-panel community-friend" key={request.id}>
              <div>
                <strong>{request.requester.display_name}</strong>
                <small>@{request.requester.handle}</small>
              </div>
              <div className="community-actions">
                <button
                  className="btn-primary"
                  disabled={Boolean(busy)}
                  onClick={() => {
                    void run(
                      request.id,
                      () => account.respondFriend(request.id, true),
                      "Priateľstvo bolo prijaté.",
                    );
                  }}
                >
                  <Check size={16} /> Prijať
                </button>
                <button
                  className="btn-secondary"
                  disabled={Boolean(busy)}
                  onClick={() => {
                    void run(request.id, () =>
                      account.respondFriend(request.id, false),
                    );
                  }}
                >
                  Odmietnuť
                </button>
              </div>
            </article>
          ))}
          <h2>Moji priatelia ({account.friends.length})</h2>
          {!account.friends.length && (
            <p>
              Zatiaľ nemáš prijatých priateľov. Vyhľadaj hráča a pošli mu
              žiadosť.
            </p>
          )}
          {account.requests
            .filter((request) => request.status === "accepted")
            .map((request) => {
              const player =
                request.requester_id === account.user!.id
                  ? request.recipient
                  : request.requester;
              return (
                <article
                  className="glass-panel community-friend"
                  key={request.id}
                >
                  <div>
                    <strong>{player.display_name}</strong>
                    <small>@{player.handle}</small>
                  </div>
                  <button
                    className="text-button"
                    disabled={Boolean(busy)}
                    onClick={() => {
                      void run(request.id, () =>
                        account.removeFriend(request.id),
                      );
                    }}
                  >
                    Odobrať priateľa
                  </button>
                </article>
              );
            })}
          {outgoing.length > 0 && <h2>Odoslané žiadosti</h2>}
          {outgoing.map((request) => (
            <article className="glass-panel community-friend" key={request.id}>
              <div>
                <strong>{request.recipient.display_name}</strong>
                <small>Čaká na prijatie</small>
              </div>
              <button
                className="text-button"
                disabled={Boolean(busy)}
                onClick={() => {
                  void run(request.id, () => account.removeFriend(request.id));
                }}
              >
                Zrušiť žiadosť
              </button>
            </article>
          ))}
        </>
      )}
      {tab === "invitations" && (
        <>
          {!account.invitations.length && (
            <section className="glass-panel community-empty">
              <CalendarPlus size={26} />
              <h2>Zatiaľ žiadne pozvánky</h2>
              <p>
                Keď ťa priateľ označí v aktivite, môžeš si ju tu pridať do
                kalendára.
              </p>
            </section>
          )}
          {account.invitations
            .filter((invite) => invite.activity)
            .map((invite) => {
              const saved = account.calendar.some(
                (entry) => entry.source_activity_id === invite.activity_id,
              );
              return (
                <article className="glass-panel community-card" key={invite.id}>
                  <p>
                    <strong>{invite.activity!.author.display_name}</strong> ťa
                    pozýva
                  </p>
                  <ActivityPreview data={invite.activity!.payload} />
                  <div className="community-actions">
                    <button
                      className="btn-primary"
                      disabled={Boolean(busy) || saved}
                      onClick={() => {
                        void run(
                          invite.id,
                          () => account.acceptInvitation(invite.id),
                          "Aktivita bola pridaná do tvojho kalendára.",
                        );
                      }}
                    >
                      <CalendarPlus size={17} />{" "}
                      {saved ? "V kalendári" : "Pridať do kalendára"}
                    </button>
                    {invite.status === "pending" && (
                      <button
                        className="btn-secondary"
                        disabled={Boolean(busy)}
                        onClick={() => {
                          void run(invite.id, () =>
                            account.declineInvitation(invite.id),
                          );
                        }}
                      >
                        Odmietnuť
                      </button>
                    )}
                    {saved && (
                      <button
                        className="text-button"
                        onClick={() => onNavigate("calendar")}
                      >
                        Otvoriť kalendár
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
        </>
      )}
      {tab === "mine" && (
        <>
          <p>
            Vyber, kto môže vidieť tvoju aktivitu. Súkromné poznámky a fotky
            zostávajú iba v tvojom denníku. Prepnutie na „Len ja“ zruší
            pozvánky; už prijaté kópie zostanú v kalendári priateľa.
          </p>
          {!myActivities.length && (
            <section className="glass-panel community-empty">
              <Lock size={26} />
              <h2>Tvoj denník je zatiaľ prázdny</h2>
              <p>
                Pridaj aktivitu cez hlavný prehľad alebo prenes miestne údaje do
                účtu.
              </p>
              <button
                className="btn-primary"
                onClick={() => onNavigate("dashboard")}
              >
                Otvoriť prehľad
              </button>
            </section>
          )}
          {myActivities.slice(0, limit).map((activity) => (
            <article className="glass-panel community-card" key={activity.id}>
              <ActivityPreview data={activity} />
              <label className="community-visibility-select">
                Viditeľnosť aktivity
                <select
                  aria-label={`Viditeľnosť aktivity ${activity.title || activity.date}`}
                  value={
                    account.ownShares.find(
                      (row) => row.local_id === activity.id,
                    )?.visibility || "private"
                  }
                  disabled={Boolean(busy)}
                  onChange={(e) => {
                    const next = e.target.value as ActivityVisibility;
                    void run(
                      activity.id,
                      () => visibility(activity, next),
                      "Viditeľnosť bola uložená.",
                    );
                  }}
                >
                  <option value="private">Len ja</option>
                  <option value="friends">Iba priatelia</option>
                  <option value="community">Verejná</option>
                </select>
              </label>
            </article>
          ))}
          {account.ownShares
            .filter(
              (row) =>
                !activities.some((activity) => activity.id === row.local_id),
            )
            .map((row) => (
              <article className="glass-panel community-card" key={row.id}>
                <ActivityPreview data={row.payload} />
                <p>
                  Zdieľaná aktivita mimo aktuálneho denníka ·{" "}
                  {visibilityLabel[row.visibility]}
                </p>
                <button
                  className="btn-secondary"
                  disabled={Boolean(busy)}
                  onClick={() => {
                    void run(
                      row.id,
                      () => account.unshareActivity(row.id),
                      "Zdieľanie bolo zrušené.",
                    );
                  }}
                >
                  Zrušiť zdieľanie
                </button>
              </article>
            ))}
          {myActivities.length > limit && (
            <button
              className="btn-secondary"
              onClick={() => setLimit((value) => value + 20)}
            >
              Ďalších 20 aktivít
            </button>
          )}
        </>
      )}
    </div>
  );
}
