import React, { useMemo, useState } from "react";
import { ArrowLeft, Search, ChevronRight, RotateCcw } from "lucide-react";
import { useApp } from "../context/AppContext";
import type { NavTab } from "../components/Navigation";
import {
  allInsightMatches,
  summarizeMatches,
  groupMatchResults,
  matchSeason,
  matchCompetition,
  matchOpponent,
  matchKey,
  searchMatchText,
} from "../utils/matchInsights";
import "./Overview.css";

export function MatchInsightsView({
  mode,
  onNavigate,
}: {
  mode: "performance" | "matches";
  onNavigate: (tab: NavTab) => void;
}) {
  const { matches, doublesMatches } = useApp();
  const [season, setSeason] = useState("all");
  const [competition, setCompetition] = useState("all");
  const [source, setSource] = useState("all");
  const [type, setType] = useState("all");
  const [result, setResult] = useState("all");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(20);
  const all = useMemo(
    () => allInsightMatches(matches, doublesMatches),
    [matches, doublesMatches],
  );
  const seasons = [...new Set(all.map(matchSeason))].sort((a, b) =>
    b.localeCompare(a, "sk", { numeric: true }),
  );
  const base = all.filter(
    (match) =>
      (source === "all" ||
        (source === "league"
          ? match.source === "SSTZ"
          : source === "tournament"
            ? match.source === "SSTZ_TOURNAMENT"
            : !match.source || match.source === "manual")) &&
      (type === "all" || (type === "doubles") === "opponentPair" in match),
  );
  const seasonMatches = base.filter(
    (match) => season === "all" || matchSeason(match) === season,
  );
  const competitions = [...new Set(seasonMatches.map(matchCompetition))].sort(
    (a, b) => a.localeCompare(b, "sk"),
  );
  const filtered = seasonMatches.filter(
    (match) =>
      (competition === "all" || matchCompetition(match) === competition) &&
      (result === "all" || match.result === result) &&
      searchMatchText(
        `${matchOpponent(match)} ${matchCompetition(match)} ${matchSeason(match)} ${"partnerName" in match ? match.partnerName : ""}`,
      ).includes(searchMatchText(query.trim())),
  );
  const stats = summarizeMatches(filtered);
  const seasonGroups = groupMatchResults(
    base.filter(
      (match) =>
        competition === "all" || matchCompetition(match) === competition,
    ),
    matchSeason,
  ).sort((a, b) => a.label.localeCompare(b.label, "sk", { numeric: true }));
  const leagueGroups = groupMatchResults(seasonMatches, matchCompetition).sort(
    (a, b) => b.played - a.played,
  );
  const extraFilterCount = Number(source !== "all") + Number(type !== "all");
  const hasFilters =
    season !== "all" ||
    competition !== "all" ||
    extraFilterCount > 0 ||
    result !== "all" ||
    query.trim() !== "";
  const reset = () => {
    setSeason("all");
    setCompetition("all");
    setSource("all");
    setType("all");
    setResult("all");
    setQuery("");
    setLimit(20);
  };
  const selectSeason = (value: string) => {
    setSeason(value);
    setCompetition("all");
    setLimit(20);
  };
  return (
    <div className="page-view insights-view animate-fade-in">
      <button
        className="text-button overview-back"
        onClick={() => onNavigate("dashboard")}
      >
        <ArrowLeft size={17} /> Späť na prehľad
      </button>
      <div className="page-header">
        <div>
          <h1>
            {mode === "performance" ? "Tvoja úspešnosť" : "Všetky zápasy"}
          </h1>
          <p>
            {mode === "performance"
              ? "Bilancia podľa sezón a súťaží."
              : "História dvojhier a štvorhier od najnovších."}
          </p>
        </div>
      </div>
      <section
        className="glass-panel insights-filters"
        aria-label="Filtrovanie výsledkov"
      >
        <label>
          Sezóna
          <select value={season} onChange={(e) => selectSeason(e.target.value)}>
            <option value="all">Všetky sezóny</option>
            {seasons.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          Liga alebo turnaj
          <select
            value={competition}
            onChange={(e) => {
              setCompetition(e.target.value);
              setLimit(20);
            }}
          >
            <option value="all">Všetky súťaže</option>
            {competitions.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <div className="insights-filter-actions">
          <details className="insights-extra-filters">
            <summary>
              Ďalšie filtre
              {extraFilterCount > 0 && (
                <span className="filter-count">{extraFilterCount}</span>
              )}
              <ChevronRight size={15} />
            </summary>
            <div className="insights-extra-grid">
              <label>
                Zdroj
                <select
                  value={source}
                  onChange={(e) => {
                    setSource(e.target.value);
                    setCompetition("all");
                    setLimit(20);
                  }}
                >
                  <option value="all">Všetky zápasy</option>
                  <option value="league">Ligy SSTZ</option>
                  <option value="tournament">Turnaje SSTZ</option>
                  <option value="manual">Vlastné zápisy</option>
                </select>
              </label>
              <label>
                Disciplína
                <select
                  value={type}
                  onChange={(e) => {
                    setType(e.target.value);
                    setCompetition("all");
                    setLimit(20);
                  }}
                >
                  <option value="all">Dvojhry aj štvorhry</option>
                  <option value="singles">Dvojhry</option>
                  <option value="doubles">Štvorhry</option>
                </select>
              </label>
            </div>
          </details>
          {hasFilters && (
            <button className="text-button insights-reset" onClick={reset}>
              <RotateCcw size={15} /> Zrušiť filtre
            </button>
          )}
        </div>
      </section>
      <section className="insights-summary" aria-live="polite">
        {[
          ["Úspešnosť", stats.rate === null ? "—" : `${stats.rate}%`],
          ["Zápasy", stats.played],
          ["Výhry", stats.wins],
          ["Prehry", stats.losses],
        ].map(([label, value]) => (
          <div className="glass-panel" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </section>
      {mode === "performance" && (
        <div className="insights-charts">
          {[
            {
              title: "Úspešnosť podľa sezón",
              groups: seasonGroups,
              selected: season,
              select: selectSeason,
            },
            {
              title: "Bilancia v jednotlivých súťažiach",
              groups: leagueGroups,
              selected: competition,
              select: (value: string) => {
                setCompetition(value);
                setLimit(20);
              },
            },
          ].map((chart) => (
            <section className="glass-panel insights-chart" key={chart.title}>
              <h2>{chart.title}</h2>
              <p>Zelená = výhry · červená = prehry.</p>
              {chart.groups.length ? (
                chart.groups.map((group) => (
                  <button
                    className={`insights-bar-row ${chart.selected === group.label ? "is-selected" : ""}`}
                    key={group.label}
                    onClick={() =>
                      chart.select(
                        chart.selected === group.label ? "all" : group.label,
                      )
                    }
                    aria-pressed={chart.selected === group.label}
                  >
                    <span className="insights-bar-heading">
                      <strong>{group.label}</strong>
                      <b>{group.rate}%</b>
                    </span>
                    <span className="insights-bar" aria-hidden="true">
                      <span
                        style={{
                          width: `${(group.wins / group.played) * 100}%`,
                        }}
                      />
                      <span
                        style={{
                          width: `${(group.losses / group.played) * 100}%`,
                        }}
                      />
                    </span>
                    <span className="insights-bar-caption">
                      {group.played} zápasov · {group.wins} výhier ·{" "}
                      {group.losses} prehier
                    </span>
                  </button>
                ))
              ) : (
                <p>Pre tento výber zatiaľ nemáš zápasy.</p>
              )}
            </section>
          ))}
        </div>
      )}
      {mode === "matches" && (
        <section className="glass-panel insights-match-list">
          <div className="overview-section-title">
            <div>
              <h2>Zápasy vo výbere</h2>
              <p>
                Od najnovšieho po najstarší. Rozklikni zápas pre sety a ďalšie
                údaje.
              </p>
            </div>
            <span>{filtered.length}</span>
          </div>
          <div className="insights-search">
            <label>
              <Search size={17} />
              <input
                aria-label="Vyhľadať súpera alebo súťaž"
                placeholder="Súper, liga alebo turnaj…"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setLimit(20);
                }}
              />
            </label>
            <select
              aria-label="Výsledok zápasu"
              value={result}
              onChange={(e) => {
                setResult(e.target.value);
                setLimit(20);
              }}
            >
              <option value="all">Všetky výsledky</option>
              <option value="WIN">Výhry</option>
              <option value="LOSS">Prehry</option>
            </select>
          </div>
          {filtered.slice(0, limit).map((match) => (
            <details className="insights-match" key={matchKey(match)}>
              <summary>
                <span
                  className={`result-dot ${match.result === "WIN" ? "win" : "loss"}`}
                >
                  {match.result === "WIN" ? "V" : "P"}
                </span>
                <span className="insights-match-info">
                  <strong>{matchOpponent(match)}</strong>
                  <small>
                    {match.date || "Bez dátumu"} · {matchCompetition(match)} ·{" "}
                    {matchSeason(match)} ·{" "}
                    {"opponentPair" in match ? "Štvorhra" : "Dvojhra"}
                  </small>
                </span>
                <b>{match.score}</b>
                <ChevronRight size={16} />
              </summary>
              <div className="insights-match-detail">
                {"partnerName" in match && (
                  <p>Spoluhráč: {match.partnerName}</p>
                )}
                <p>{[match.round, match.teams].filter(Boolean).join(" · ")}</p>
                <div className="insights-set-list">
                  {match.setDetails?.length ? (
                    match.setDetails.map((set) => (
                      <span key={set.setNumber}>
                        S{set.setNumber}: {set.display}
                      </span>
                    ))
                  ) : match.sets?.length ? (
                    match.sets.map((set, i) => (
                      <span key={i}>
                        S{i + 1}: {set}
                      </span>
                    ))
                  ) : (
                    <span>Body jednotlivých setov nie sú uvedené.</span>
                  )}
                </div>
                {match.isWalkover && <p>Kontumačný výsledok</p>}
                {match.notes && <p>{match.notes}</p>}
              </div>
            </details>
          ))}
          {!filtered.length && (
            <div className="insights-empty">
              <h3>
                {all.length
                  ? "Žiadne zápasy pre tento výber"
                  : "Tvoje výsledky začínajú prvým zápasom"}
              </h3>
              <p>
                {all.length
                  ? "Skús inú sezónu alebo zruš filtre."
                  : "Importuj si históriu zo SSTZ alebo pridaj vlastný zápas."}
              </p>
              <button
                className="btn-secondary"
                onClick={all.length ? reset : () => onNavigate("sstz")}
              >
                {all.length ? "Zrušiť filtre" : "Pripojiť SSTZ"}
              </button>
            </div>
          )}
          {filtered.length > limit && (
            <button
              className="btn-secondary insights-load"
              onClick={() => setLimit((value) => value + 20)}
            >
              Ďalších 20 zápasov ({filtered.length - limit} zostáva)
            </button>
          )}
        </section>
      )}
    </div>
  );
}
