import React, { useMemo } from "react";
import { useCommunity } from "../context/CommunityContext";
import { useApp } from "../context/AppContext";
import type { ActivityCategory } from "../types";
import type { NavTab } from "../components/Navigation";
import {
  Calendar,
  Clock,
  Trophy,
  TrendingUp,
  ChevronRight,
  ArrowUpRight,
  Plus,
} from "lucide-react";
import { allInsightMatches, summarizeMatches } from "../utils/matchInsights";
import "./Overview.css";
interface DashboardViewProps {
  onNavigate: (tab: NavTab, category?: "all" | ActivityCategory) => void;
  onOpenQuickLog?: () => void;
  onOpenMatchModal?: () => void;
}
export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
  onOpenQuickLog,
}) => {
  const {
    matches,
    doublesMatches,
    activities,
    sstzProfile,
    teamSchedule,
    activeRacket,
    rubbers,
    getRubberHealth,
  } = useApp();
  const account = useCommunity();
  const welcomeName = sstzProfile?.name || account.profile?.display_name;
  const welcomeClub = sstzProfile?.clubName || account.profile?.club;
  const results = useMemo(
    () => summarizeMatches(allInsightMatches(matches, doublesMatches)),
    [matches, doublesMatches],
  );
  const trainingHours =
    Math.round(
      (activities
        .filter((item) => item.category === "tréning")
        .reduce((sum, item) => sum + (item.durationMinutes || 0), 0) /
        60) *
        10,
    ) / 10;
  const forehand = rubbers.find(
    (rubber) => rubber.id === activeRacket?.forehandRubberId,
  );
  const backhand = rubbers.find(
    (rubber) => rubber.id === activeRacket?.backhandRubberId,
  );
  const forehandWear = forehand
    ? 100 - getRubberHealth(forehand).percent
    : null;
  const backhandWear = backhand
    ? 100 - getRubberHealth(backhand).percent
    : null;
  const wearText = `FH ${forehandWear === null ? "—" : `${forehandWear}%`} · BH ${backhandWear === null ? "—" : `${backhandWear}%`}`;
  const upcomingMatch = teamSchedule.find((match) => !match.isPlayed);
  return (
    <div className="page-view dashboard-view practical-dashboard animate-fade-in">
      <section
        className="dashboard-at-glance"
        aria-label="Najbližší zápas a tvoje výsledky"
      >
        <header className="dashboard-heading">
          <div className="dashboard-welcome">
            <h1 title={welcomeName ? `Vitaj, ${welcomeName}` : undefined}>
              {welcomeName ? `Vitaj, ${welcomeName}` : "Vitaj v SpinTracku"}
            </h1>
            <p title={welcomeClub}>
              {welcomeClub || "Tvoj stolnotenisový prehľad"}
            </p>
          </div>
          <button className="btn-primary" onClick={onOpenQuickLog}>
            <Plus size={18} aria-hidden="true" />
            <span>Pridať aktivitu</span>
          </button>
        </header>
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
              <strong className="metric-value">
                {tab === "diary" ? (
                  <>{trainingHours}<span className="metric-unit">h</span></>
                ) : value}
              </strong>
              {tab === "diary" ? (
                <span
                  className="training-wear"
                  title={
                    activeRacket
                      ? `Opotrebovanie poťahov rakety ${activeRacket.name}: forhend ${forehandWear === null ? "neuvedené" : `${forehandWear}%`}, bekhend ${backhandWear === null ? "neuvedené" : `${backhandWear}%`}`
                      : "Najprv si pridaj raketu vo výbave"
                  }
                >
                  <span>Opotrebovanie</span>
                  <strong>{activeRacket ? wearText : "Bez rakety"}</strong>
                </span>
              ) : (
                <span className="metric-detail">{detail}</span>
              )}
            </button>
          ))}
        </section>
      </section>
    </div>
  );
};
