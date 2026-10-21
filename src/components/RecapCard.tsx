import React from "react";
import {
  ArrowUpRight,
  CalendarDays,
  Clock3,
  Trophy,
  Sparkles,
} from "lucide-react";
import { recapLabel, type Recap } from "../utils/recaps";
const plural = (n: number, one: string, few: string, many: string) =>
  n === 1 ? one : n >= 2 && n <= 4 ? few : many;
export function RecapCard({
  recap,
  compact = false,
  onOpen,
}: {
  recap: Recap;
  compact?: boolean;
  onOpen?: () => void;
}) {
  const hours = (recap.minutes / 60).toLocaleString("sk", {
    maximumFractionDigits: 1,
  });
  return (
    <article
      className={`recap-card ${recap.kind === "year" ? "recap-year" : ""}`}
    >
      <div className="recap-kicker">
        <Sparkles size={16} />
        <span>
          {recap.kind === "year"
            ? "TVOJ ROK PRI STOLE"
            : "TVOJ MESIAC PRI STOLE"}
        </span>
        <span className="recap-stamp">SPINTRACK</span>
      </div>
      <h2>{recapLabel(recap.id)}</h2>
      <p className="recap-intro">
        {recap.activeDays
          ? `${recap.activeDays} ${plural(recap.activeDays, "aktívny deň", "aktívne dni", "aktívnych dní")}. Každý sa počíta.`
          : "Aj oddych patrí k tvojej hre."}
      </p>
      <div className="recap-hero-number">
        <strong>{hours}</strong>
        <span>
          hodín
          <br />
          tréningu
        </span>
        <Clock3 size={30} aria-hidden="true" />
      </div>
      <div className="recap-stats">
        <div>
          <strong>{recap.played}</strong>
          <span>{plural(recap.played, "zápas", "zápasy", "zápasov")}</span>
        </div>
        <div>
          <strong>{recap.rate === null ? "—" : `${recap.rate}%`}</strong>
          <span>úspešnosť</span>
        </div>
        <div>
          <strong>{recap.trainings}</strong>
          <span>
            {plural(recap.trainings, "tréning", "tréningy", "tréningov")}
          </span>
        </div>
      </div>
      {!compact && (
        <>
          <div className="recap-results">
            <span>
              {recap.wins} {plural(recap.wins, "výhra", "výhry", "výhier")}
            </span>
            <span>
              {recap.losses}{" "}
              {plural(recap.losses, "prehra", "prehry", "prehier")}
            </span>
          </div>
          <div className="recap-result-track" aria-hidden="true">
            <span style={{ width: `${recap.rate || 0}%` }} />
          </div>
          <div className="recap-details">
            <span>
              <Trophy size={17} />
              {recap.leagueMatches}{" "}
              {plural(
                recap.leagueMatches,
                "ligový zápas",
                "ligové zápasy",
                "ligových zápasov",
              )}{" "}
              · {recap.leagues} {plural(recap.leagues, "liga", "ligy", "líg")}
            </span>
            <span>
              <CalendarDays size={17} />
              {recap.tournaments}{" "}
              {plural(recap.tournaments, "turnaj", "turnaje", "turnajov")}
            </span>
          </div>
        </>
      )}
      {onOpen && (
        <button className="recap-open" onClick={onOpen}>
          Pozrieť zhrnutia <ArrowUpRight size={19} />
        </button>
      )}
    </article>
  );
}
