import React, { useMemo, useState } from "react";
import { useApp } from "../context/AppContext";
import type { ActivityCategory } from "../types";
import type { NavTab } from "../components/Navigation";
import { AddActivityModal } from "../components/AddActivityModal";
import {
  Calendar,
  Clock,
  Trophy,
  TrendingUp,
  Plus,
  ChevronRight,
  ArrowUpRight,
  Shield,
  Activity,
  Target,
  Layers,
  BarChart3,
} from "lucide-react";
import { allInsightMatches, summarizeMatches } from "../utils/matchInsights";
import { getDiaryEntries } from "../utils/diary";
import "./Overview.css";
interface DashboardViewProps {
  onNavigate: (tab: NavTab, category?: "all" | ActivityCategory) => void;
  onOpenQuickLog?: () => void;
  onOpenMatchModal?: () => void;
}
export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const { matches, doublesMatches, activities, sstzProfile, teamSchedule } =
    useApp();
  const [showAdd, setShowAdd] = useState(false);
  const results = useMemo(
    () => summarizeMatches(allInsightMatches(matches, doublesMatches)),
    [matches, doublesMatches],
  );
  const recent = useMemo(
    () => getDiaryEntries(activities, matches, doublesMatches).slice(0, 4),
    [activities, matches, doublesMatches],
  );
  const trainingHours =
    Math.round(
      (activities
        .filter((item) => item.category === "tréning")
        .reduce((sum, item) => sum + (item.durationMinutes || 0), 0) /
        60) *
        10,
    ) / 10;
  const upcomingMatch = teamSchedule.find((match) => !match.isPlayed);
  return (
    <div className="page-view dashboard-view practical-dashboard animate-fade-in">
      <section
        className="dashboard-at-glance"
        aria-label="Najbližší zápas a tvoje výsledky"
      >
        <div className="page-header dashboard-heading">
          <div>
            <span className="eyebrow">TVOJA HRA NA JEDNOM MIESTE</span>
            <h1 title={sstzProfile?.name}>
              {sstzProfile?.name || "Tvoj prehľad"}
            </h1>
            <p>
              {sstzProfile?.clubName ||
                "Výsledky, tréningy a ďalší zápas. Všetko poruke."}
            </p>
          </div>
          <button className="btn-primary" onClick={() => setShowAdd(true)}>
            <Plus size={19} />{" "}
            <span className="overview-add-label">Pridať aktivitu</span>
          </button>
        </div>
        <section className="next-match-card" aria-labelledby="next-match-title">
          <div className="next-match-top">
            <span className="eyebrow" id="next-match-title">
              <span className="status-dot" /> NAJBLIŽŠÍ ZÁPAS
            </span>
            <button
              className="text-button"
              onClick={() => onNavigate("calendar")}
            >
              Kalendár <ArrowUpRight size={17} />
            </button>
          </div>
          {upcomingMatch ? (
            <>
              <div className="match-teams">
                <div>
                  <span className="team-caption">Domáci</span>
                  <h2 title={upcomingMatch.homeTeam}>
                    {upcomingMatch.homeTeam}
                  </h2>
                </div>
                <span className="match-vs">VS</span>
                <div>
                  <span className="team-caption">Hostia</span>
                  <h2 title={upcomingMatch.awayTeam}>
                    {upcomingMatch.awayTeam}
                  </h2>
                </div>
              </div>
              <div className="match-footer">
                <span>
                  <Calendar size={16} /> {upcomingMatch.dateTime}
                </span>
                {upcomingMatch.round && <span>{upcomingMatch.round}</span>}
              </div>
            </>
          ) : (
            <div className="next-match-empty">
              <span className="empty-icon">
                <Calendar size={29} />
              </span>
              <div>
                <h2>Ďalší zápas na dosah</h2>
                <p>
                  {sstzProfile
                    ? "V uloženom rozpise nie je ďalšie neodohrané stretnutie."
                    : "Pripoj svoju ligu a maj rozpis vždy po ruke."}
                </p>
              </div>
              <button
                className="btn-secondary"
                onClick={() => onNavigate(sstzProfile ? "calendar" : "sstz")}
              >
                {sstzProfile ? "Otvoriť kalendár" : "Nájsť moju ligu"}
                <ChevronRight size={17} />
              </button>
            </div>
          )}
        </section>
        <section
          className="dashboard-metrics"
          aria-label="Otvor prehľad svojich výsledkov"
        >
          {[
            {
              label: "Úspešnosť",
              value: results.rate === null ? "—" : `${results.rate}%`,
              detail: `${results.wins} výhier · ${results.losses} prehier`,
              icon: TrendingUp,
              tone: "green",
              tab: "performance" as NavTab,
            },
            {
              label: "Všetky zápasy",
              value: results.played,
              detail: "Dvojhry aj štvorhry",
              icon: Trophy,
              tone: "blue",
              tab: "matches" as NavTab,
            },
            {
              label: "Tréningy",
              value: `${trainingHours} h`,
              detail: "Čas zo zapísaných tréningov",
              icon: Clock,
              tone: "amber",
              tab: "diary" as NavTab,
            },
          ].map(({ label, value, detail, icon: Icon, tone, tab }) => (
            <button
              className={`metric-card metric-${tone} overview-metric`}
              key={label}
              onClick={() =>
                onNavigate(tab, tab === "diary" ? "tréning" : "all")
              }
            >
              <span className="metric-icon">
                <Icon size={21} />
              </span>
              <ArrowUpRight className="metric-arrow" size={18} />
              <span className="metric-label">{label}</span>
              <strong className="metric-value">{value}</strong>
              <span className="metric-detail">{detail}</span>
            </button>
          ))}
        </section>
      </section>
      <section className="glass-panel overview-recent">
        <div className="overview-section-title">
          <h2>Posledné aktivity</h2>
          <button className="text-button" onClick={() => onNavigate("diary")}>
            Všetky <ArrowUpRight size={16} />
          </button>
        </div>
        {recent.length ? (
          recent.map((entry) => (
            <button
              className="overview-recent-row"
              key={entry.id}
              onClick={() => onNavigate(entry.match ? "matches" : "diary")}
            >
              <span
                className={`result-dot ${entry.result === "WIN" ? "win" : entry.result === "LOSS" ? "loss" : ""}`}
              >
                {entry.result ? (
                  entry.result === "WIN" ? (
                    "V"
                  ) : (
                    "P"
                  )
                ) : (
                  <Activity size={16} />
                )}
              </span>
              <span>
                <strong>{entry.title}</strong>
                <small>
                  {entry.originalDate || "Bez dátumu"}
                  {entry.subtitle ? ` · ${entry.subtitle}` : ""}
                </small>
              </span>
              {entry.score && <b>{entry.score}</b>}
              <ChevronRight size={16} />
            </button>
          ))
        ) : (
          <div className="insights-empty">
            <p>Zaznamenaj prvý tréning alebo si importuj zápasy.</p>
            <button className="btn-secondary" onClick={() => setShowAdd(true)}>
              <Plus size={16} /> Pridať aktivitu
            </button>
          </div>
        )}
      </section>
      <section className="overview-tools" aria-label="Rýchly prístup">
        {[
          {
            tab: "sstz" as NavTab,
            title: "Moje ligy SSTZ",
            detail: "Sezóny, tímy a import",
            icon: Shield,
          },
          {
            tab: "tournaments" as NavTab,
            title: "Turnaje",
            detail: "Import a turnajové výsledky",
            icon: Trophy,
          },
          {
            tab: "opponents" as NavTab,
            title: "Súperi",
            detail: "Vzájomná bilancia a poznámky",
            icon: Target,
          },
          {
            tab: "equipment" as NavTab,
            title: "Moja výbava",
            detail: "Rakety, drevá a poťahy",
            icon: Layers,
          },
          {
            tab: "diary" as NavTab,
            title: "Všetky aktivity",
            detail: "Denník a filtrovanie",
            icon: Activity,
          },
          {
            tab: "stats" as NavTab,
            title: "Môj progres",
            detail: "Odznaky a výkonnosť rakiet",
            icon: BarChart3,
          },
        ].map(({ tab, title, detail, icon: Icon }) => (
          <button
            onClick={() => onNavigate(tab)}
            className="shortcut-card"
            key={tab}
          >
            <span className="shortcut-icon">
              <Icon size={22} />
            </span>
            <span>
              <strong>{title}</strong>
              <small>{detail}</small>
            </span>
            <ChevronRight size={18} />
          </button>
        ))}
      </section>
      <AddActivityModal isOpen={showAdd} onClose={() => setShowAdd(false)} />
    </div>
  );
};
