import { useEffect, useRef, useState } from "react";
import {
  Search,
  Download,
  RefreshCw,
  CheckCircle2,
  UserRound,
  ExternalLink,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import {
  pairSstzPlayers,
  sstzNameKey,
  type SstzPlayerChoice,
} from "../utils/sstzAccountImport";
import "./SstzImportPanel.css";

export function SstzImportPanel() {
  const {
    sstzProfile,
    tournamentProfile,
    syncSstzAccount,
    disconnectSstz,
    isSstzLoading,
    isTournamentLoading,
  } = useApp();
  const [query, setQuery] = useState("");
  const [choices, setChoices] = useState<SstzPlayerChoice[]>([]);
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState(!sstzProfile && !tournamentProfile);
  const lock = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const busy = isSstzLoading || isTournamentLoading;
  const name = tournamentProfile?.name || sstzProfile?.name || "";
  useEffect(() => {
    const controller = new AbortController();
    setChoices([]);
    setSelection({});
    setSearching(false);
    setSearched(false);
    setError("");
    if (query.trim().length < 2) return () => controller.abort();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const read = async (url: string, key: "players") => {
          const r = await fetch(url, {
            signal: controller.signal,
            cache: "no-store",
          });
          const data = await r.json();
          if (
            !r.ok ||
            data.error ||
            !Array.isArray(data[key]) ||
            data[key].some(
              (p: any) =>
                typeof p.id !== "string" || typeof p.name !== "string",
            )
          )
            throw new Error(
              "Vyhľadávanie jedného zdroja SSTZ zlyhalo. Skús vyhľadávanie zopakovať.",
            );
          return data[key];
        };
        const q = encodeURIComponent(query.trim());
        const [registry, league] = await Promise.all([
          read(`/api/sstz/tournaments/search?q=${q}`, "players"),
          read(`/api/sstz/search?q=${q}`, "players"),
        ]);
        if (!controller.signal.aborted) {
          setChoices(pairSstzPlayers(registry, league));
          setSearched(true);
        }
      } catch (e) {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : "Vyhľadávanie zlyhalo.");
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 350);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);
  const run = async (choice: SstzPlayerChoice) => {
    if (lock.current || busy) return;
    lock.current = true;
    setError("");
    setNotice("");
    try {
      const ok = await syncSstzAccount(choice);
      if (!alive.current) return;
      if (ok) {
        setNotice(
          choice.registryId && choice.leagueId
            ? "Ligové aj turnajové zápasy sú importované."
            : choice.registryId
              ? "Turnaje sú importované. Ligový profil sa nenašiel; môžeš ho doplniť novým vyhľadaním."
              : "Ligy sú importované. Turnajový profil sa nenašiel; môžeš ho doplniť novým vyhľadaním.",
        );
        setEditing(false);
        setQuery("");
      } else
        setError(
          "Spoločný import sa nepodaril. Predchádzajúce zápasy a poznámky zostali zachované. Skús to znova.",
        );
    } finally {
      lock.current = false;
    }
  };
  return (
    <section
      className="glass-panel sstz-import-panel"
      aria-labelledby="tournament-search-title"
    >
      <div className="sstz-import-heading">
        <span className="sstz-import-icon">
          <Download size={22} />
        </span>
        <div>
          <span className="eyebrow">JEDNO MENO · CELÁ KARIÉRA</span>
          <h2 id="tournament-search-title">Import SSTZ</h2>
        </div>
      </div>
      <p>
        Zadaj svoje meno, vyber hráča a importuj ligové aj turnajové zápasy
        naraz vrátane štvorhier.
      </p>
      {name && <p>Pripojené zápasy obnovujeme automaticky pri otvorení a každých 5 minút počas používania. Zahŕňame aj turnaje z kalendára, keď SSTZ zverejní tvoje výsledky.</p>}
      {name && (
        <div className="sstz-import-connected">
          <strong>
            <UserRound size={17} />
            {name}
          </strong>
          <div>
            <span>
              <CheckCircle2 size={14} />
              {sstzProfile ? "Ligy pripojené" : "Ligy nepripojené"}
            </span>
            <span>
              <CheckCircle2 size={14} />
              {tournamentProfile ? "Turnaje pripojené" : "Turnaje nepripojené"}
            </span>
          </div>
          {sstzProfile &&
          tournamentProfile &&
          sstzNameKey(sstzProfile.name) !==
            sstzNameKey(tournamentProfile.name) ? (
            <p role="alert">
              Prepojené profily majú rozdielne mená. Vyber svoj profil znova.
            </p>
          ) : sstzProfile && tournamentProfile ? (
            <button
              className="btn-primary"
              disabled={busy}
              onClick={() =>
                void run({
                  name,
                  registryId: tournamentProfile.id,
                  leagueId: sstzProfile.id,
                })
              }
            >
              <RefreshCw size={16} />
              Obnoviť všetky zápasy
            </button>
          ) : (
            <button
              className="btn-primary"
              disabled={busy}
              onClick={() => {
                setEditing(true);
                setQuery(name);
              }}
            >
              <Download size={16} />
              Prepojiť ligy aj turnaje
            </button>
          )}
          <div className="sstz-import-manage">
            <button
              className="text-button"
              disabled={busy}
              onClick={() => {
                setEditing((e) => !e);
                setQuery(name);
              }}
            >
              Zmeniť hráča
            </button>
            <button
              className="text-button"
              disabled={busy}
              onClick={() => {
                disconnectSstz();
                setEditing(true);
                setQuery("");
                setNotice(
                  "Prepojenie je odpojené. História zostala v denníku.",
                );
              }}
            >
              Odpojiť SSTZ
            </button>
          </div>
        </div>
      )}
      {(editing || !name) && (
        <>
          <label className="sstz-import-search">
            <Search size={19} />
            <input
              aria-label="Meno hráča SSTZ"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Meno a priezvisko"
              autoComplete="off"
              disabled={busy}
            />
          </label>
          {searching && (
            <p role="status">Hľadám v registri aj v ligách SSTZ…</p>
          )}
          {!searching && searched && !choices.length && (
            <p role="status">
              Hráč sa nenašiel. Skús celé meno alebo priezvisko.
            </p>
          )}
          <div className="sstz-import-results">
            {choices.map((choice) => {
              const key = choice.registryId
                ? `registry-${choice.registryId}`
                : `league-${choice.leagueId}`;
              const selected = choice.leagueId || selection[key];
              return (
                <article className="sstz-import-player" key={key}>
                  <div>
                    <strong>{choice.name}</strong>
                    <small>{choice.clubName || "Klub nie je uvedený"}</small>
                    <span>
                      {choice.registryId && selected
                        ? "Ligy + turnaje"
                        : choice.leagueCandidates?.length
                          ? "Over ligový profil menovca"
                          : choice.registryId
                            ? "Turnajový profil · ligový sa nenašiel"
                            : "Ligový profil · turnajový sa nenašiel"}
                    </span>
                  </div>
                  {!!choice.leagueCandidates?.length && (
                    <label>
                      Našli sme menovcov. Vyber svoj ligový profil:
                      <select
                        aria-label={`Ligový profil pre ${choice.name} #${choice.registryId}`}
                        value={selected || ""}
                        disabled={busy}
                        onChange={(e) =>
                          setSelection((p) => ({ ...p, [key]: e.target.value }))
                        }
                      >
                        <option value="">Vyber profil</option>
                        {choice.leagueCandidates.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} · ligové ID {p.id}
                          </option>
                        ))}
                      </select>
                      {selected && (
                        <a
                          href={`https://www.stolnytenis.info/hrac/${selected}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Overiť ligový profil <ExternalLink size={13} />
                        </a>
                      )}
                    </label>
                  )}
                  <button
                    className="btn-primary"
                    disabled={
                      busy || (!!choice.leagueCandidates?.length && !selected)
                    }
                    onClick={() => void run({ ...choice, leagueId: selected })}
                  >
                    <Download size={16} />
                    {choice.registryId && selected
                      ? "Importovať ligy aj turnaje"
                      : "Importovať dostupné zápasy"}
                  </button>
                </article>
              );
            })}
          </div>
        </>
      )}
      {busy && (
        <p role="status">
          Načítavam všetky dostupné sezóny. Import prebieha aj po prechode do
          inej sekcie.
        </p>
      )}
      {error && (
        <p className="sstz-import-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="sstz-import-notice" role="status">
          {notice}
        </p>
      )}
    </section>
  );
}
