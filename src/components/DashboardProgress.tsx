import { useMemo, useState } from "react";
import { ArrowUpRight, ChartNoAxesCombined, Clock, Trophy } from "lucide-react";
import type { ActivityRecord } from "../types";
import { dashboardPeriod } from "../utils/dashboardInsights";
import {
  matchKey,
  matchOpponent,
  summarizeMatches,
  type InsightMatch,
} from "../utils/matchInsights";
import { compareOccurrenceDesc } from "../utils/diary";

const shortDate = (value: string) =>
  new Date(`${value}T12:00:00`).toLocaleDateString("sk", {
    day: "numeric",
    month: "numeric",
  });
const duration = (minutes: number) =>
  `${Math.floor(minutes / 60)} h ${minutes % 60} min`;

export function DashboardProgress({
  activities,
  matches,
  onPerformance,
  onTraining,
}: {
  activities: ActivityRecord[];
  matches: InsightMatch[];
  onPerformance: () => void;
  onTraining: () => void;
}) {
  const [days, setDays] = useState(30);
  const [selected, setSelected] = useState<number | null>(null);
  const data = useMemo(
    () => dashboardPeriod(activities, matches, days),
    [activities, matches, days],
  );
  const results = summarizeMatches(data.matches);
  const max = Math.max(60, ...data.buckets.map((item) => item.minutes));
  const selectedBucket = selected === null ? null : data.buckets[selected];
  const recent = [...data.matches]
    .sort(compareOccurrenceDesc)
    .slice(0, 8)
    .reverse();
  return (
    <section className="progress-section" aria-labelledby="progress-title">
      <div className="progress-heading">
        <div>
          <span className="eyebrow">KAŽDÝ TRÉNING SA POČÍTA</span>
          <h2 id="progress-title">Tvoja hra v číslach</h2>
        </div>
        <div
          className="period-switch"
          role="group"
          aria-label="Obdobie štatistík"
        >
          {[7, 30, 90].map((value) => (
            <button
              key={value}
              aria-pressed={days === value}
              onClick={() => {
                setDays(value);
                setSelected(null);
              }}
            >
              {value} dní
            </button>
          ))}
        </div>
      </div>
      <div className="progress-grid">
        <article className="training-chart glass-panel">
          <div className="home-section-heading">
            <h3>
              <Clock size={17} /> Čas pri stole
            </h3>
            <button
              className="chart-link"
              onClick={onTraining}
              aria-label="Otvoriť tréningový denník"
            >
              <ArrowUpRight size={19} />
            </button>
          </div>
          <div className="chart-total">
            <strong>{duration(data.minutes)}</strong>
            <span>
              {data.sessions} tréningov za {days} dní
            </span>
          </div>
          <div
            className="training-plot"
            aria-label="Tréningový čas podľa dátumu"
          >
            <div className="chart-gridlines" aria-hidden="true">
              <span>
                {(max / 60).toLocaleString("sk", { maximumFractionDigits: 1 })}{" "}
                h
              </span>
              <span>
                {(max / 120).toLocaleString("sk", { maximumFractionDigits: 1 })}{" "}
                h
              </span>
              <span>0 h</span>
            </div>
            <div className="chart-columns">
              {data.buckets.map((bucket, index) => (
                <button
                  key={bucket.from}
                  className={`chart-column ${selected === index ? "selected" : ""}`}
                  aria-pressed={selected === index}
                  aria-label={`${shortDate(bucket.from)} až ${shortDate(bucket.to)}: ${duration(bucket.minutes)}, ${bucket.sessions} tréningov`}
                  onClick={() => setSelected(index)}
                >
                  <span className="bar-track">
                    <span
                      className={`training-bar ${bucket.minutes ? "" : "zero"}`}
                      style={{ height: `${(bucket.minutes / max) * 100}%` }}
                    />
                  </span>
                  <span className="bar-label">
                    {shortDate(bucket.from).replace(/\s/g, "")}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div
            className={`chart-selection ${selectedBucket ? "has-selection" : ""}`}
            aria-live="polite"
          >
            {selectedBucket
              ? `${shortDate(selectedBucket.from)}${selectedBucket.from !== selectedBucket.to ? ` – ${shortDate(selectedBucket.to)}` : ""} · ${duration(selectedBucket.minutes)} · ${selectedBucket.sessions} tréningov`
              : data.sessions
                ? "Vyber stĺpec a pozri si podrobnosti."
                : "Zapíš tréning a sleduj, ako rastie tvoja pravidelnosť."}
          </div>
          <div className="chart-note">
            <span className="legend-dot" /> Dokončené tréningy{" "}
            <span>
              {days === 7
                ? "Po dňoch"
                : days === 30
                  ? "Po 5 dňoch"
                  : "Po 15 dňoch"}
            </span>
          </div>
        </article>
        <article className="form-chart glass-panel">
          <div className="home-section-heading">
            <h3>
              <Trophy size={17} /> Zápasová forma
            </h3>
            <button
              className="chart-link"
              onClick={onPerformance}
              aria-label="Otvoriť podrobné štatistiky"
            >
              <ArrowUpRight size={19} />
            </button>
          </div>
          <div className="form-summary">
            <div
              className={`form-ring ${results.played ? "has-results" : ""}`}
              role="img"
              aria-label={
                results.rate === null
                  ? "Zatiaľ žiadne zápasy v tomto období"
                  : `Úspešnosť ${results.rate} percent, ${results.wins} výhier, ${results.losses} prehier`
              }
            >
              <svg viewBox="0 0 120 120" aria-hidden="true">
                <circle className="ring-track" cx="60" cy="60" r="49" />
                {results.wins > 0 && (
                  <circle
                    className="ring-value"
                    cx="60"
                    cy="60"
                    r="49"
                    pathLength="100"
                    strokeDasharray={`${results.rate || 0} 100`}
                  />
                )}
              </svg>
              <div>
                <strong>
                  {results.rate === null ? "—" : `${results.rate}%`}
                </strong>
                <span>úspešnosť</span>
              </div>
            </div>
            <div className="form-counts">
              <span>
                <i className="legend-dot" />
                Výhry <strong>{results.wins}</strong>
              </span>
              <span>
                <i className="legend-dot loss" />
                Prehry <strong>{results.losses}</strong>
              </span>
              <small>
                Dvojhry aj štvorhry
                <br />
                za posledných {days} dní
              </small>
            </div>
          </div>
          {recent.length ? (
            <div className="form-history">
              <div>
                <span>Posledné výsledky</span>
                <small>Najnovší vpravo →</small>
              </div>
              <div className="form-results">
                {recent.map((match) => (
                  <span
                    key={matchKey(match)}
                    className={match.result === "WIN" ? "won" : "lost"}
                    title={`${match.date} · ${matchOpponent(match)} · ${match.score}`}
                    aria-label={`${match.result === "WIN" ? "Výhra" : "Prehra"} proti ${matchOpponent(match)}, ${match.score}, ${match.date}`}
                  >
                    {match.result === "WIN" ? "V" : "P"}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="form-empty">
              <ChartNoAxesCombined size={20} />
              <p>
                V tomto období ešte nemáš zápas. Skús dlhšie obdobie alebo
                pridaj výsledok.
              </p>
            </div>
          )}
        </article>
      </div>
    </section>
  );
}
