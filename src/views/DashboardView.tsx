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
  Layers,
  Activity,
  Users,
  Shield,
  ArrowRight,
} from "lucide-react";
import { allInsightMatches, summarizeMatches } from "../utils/matchInsights";
import { getDiaryEntries } from "../utils/diary";
import { DashboardProgress } from "../components/DashboardProgress";
import { dashboardAgenda, dayKey } from "../utils/dashboardInsights";
import "./Overview.css";
import "./Dashboard.css";

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
  const name = sstzProfile?.name || account.profile?.display_name;
  const results = useMemo(
    () => summarizeMatches(allInsightMatches(matches, doublesMatches)),
    [matches, doublesMatches],
  );
  const trainingHours =
    Math.round(
      activities
        .filter((item) => item.category === "tréning" && !item.planned)
        .reduce((sum, item) => sum + (item.durationMinutes || 0), 0) / 6,
    ) / 10;
  const recent = useMemo(
    () =>
      getDiaryEntries(activities, matches, doublesMatches)
        .filter((entry) => !entry.activity?.planned)
        .slice(0, 3),
    [activities, matches, doublesMatches],
  );
  const today = dayKey(new Date());
  const agenda = dashboardAgenda(activities, teamSchedule);
  const insightMatches = useMemo(
    () => allInsightMatches(matches, doublesMatches),
    [matches, doublesMatches],
  );
  const dateLabel = new Intl.DateTimeFormat("sk", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
  const equipment = [
    {
      label: "Forhend",
      short: "FH",
      rubber: rubbers.find(
        (item) => item.id === activeRacket?.forehandRubberId,
      ),
    },
    {
      label: "Bekhend",
      short: "BH",
      rubber: rubbers.find(
        (item) => item.id === activeRacket?.backhandRubberId,
      ),
    },
  ];
  return (
    <div className="page-view dashboard-view animate-fade-in">
      <header className="home-heading">
        <div>
          <span className="eyebrow home-date">{dateLabel}</span>
          <h1>{name ? `Ahoj, ${name.split(" ")[0]}.` : "Poďme si zahrať."}</h1>
          <p>
            {sstzProfile?.clubName ||
              account.profile?.club ||
              "Všetko dôležité pre tvoju ďalšiu hru."}
          </p>
        </div>
      </header>

      <section className="home-metrics" aria-label="Tvoje výsledky">
        {[
          {
            label: "Úspešnosť",
            value: results.rate === null ? "—" : `${results.rate}%`,
            detail: `${results.wins} výhier · ${results.losses} prehier`,
            Icon: TrendingUp,
            tone: "green",
            tab: "performance",
          },
          {
            label: "Zápasy",
            value: results.played,
            detail: "Celá história · dvojhry aj štvorhry",
            Icon: Trophy,
            tone: "blue",
            tab: "matches",
          },
          {
            label: "Tréning",
            value: `${trainingHours.toLocaleString("sk")} h`,
            detail: "Celkový čas dokončených tréningov",
            Icon: Clock,
            tone: "amber",
            tab: "diary",
          },
        ].map(({ label, value, detail, Icon, tone, tab }) => (
          <button
            key={tab}
            className={`home-metric metric-${tone}`}
            onClick={() =>
              onNavigate(tab as NavTab, tab === "diary" ? "tréning" : "all")
            }
          >
            <span className="metric-icon">
              <Icon size={21} />
            </span>
            <ArrowUpRight className="metric-arrow" size={17} />
            <span className="metric-label">{label}</span>
            <strong className="metric-value">{value}</strong>
            <span className="metric-detail">{detail}</span>
          </button>
        ))}
      </section>

      <div className="home-main-grid">
        <section className="home-match" aria-labelledby="home-match-title">
          <div className="home-match-top">
            <span className="eyebrow">
              <span className="status-dot" />
              TVOJ HERNÝ PLÁN
            </span>
            <button
              className="text-button"
              onClick={() => onNavigate("calendar")}
              aria-label="Otvoriť kalendár"
            >
              <ArrowUpRight size={20} />
            </button>
          </div>
          {agenda.length ? (
            <>
              <div className="agenda-heading">
                <h2 id="home-match-title">Tvoj najbližší program</h2>
                <span>{agenda.length} v pláne</span>
              </div>
              <div className="home-agenda">
                {agenda.map((item) => {
                  const date = new Date(`${item.date}T12:00:00`);
                  return (
                    <button
                      key={item.id}
                      className="agenda-row"
                      onClick={() => onNavigate("calendar")}
                    >
                      <span className="agenda-date">
                        <strong>{date.getDate()}</strong>
                        <small>
                          {date.toLocaleDateString("sk", { month: "short" })}
                        </small>
                      </span>
                      <span className="agenda-copy">
                        <small>
                          {item.date === today
                            ? "Dnes"
                            : date.toLocaleDateString("sk", {
                                weekday: "long",
                              })}
                          {item.time ? ` · ${item.time}` : ""} ·{" "}
                          {item.category === "priatelsky"
                            ? "zápas"
                            : item.category}
                        </small>
                        <strong>{item.title}</strong>
                        <span>{item.detail}</span>
                      </span>
                      <ChevronRight size={16} />
                    </button>
                  );
                })}
              </div>
              <button
                className="home-match-cta"
                onClick={() => onNavigate("calendar")}
              >
                Celý kalendár <ArrowRight size={17} />
              </button>
            </>
          ) : (
            <>
              <div className="home-match-content">
                <div>
                  <h2 id="home-match-title">Tvoj ďalší tréning?</h2>
                  <p>
                    {sstzProfile
                      ? "V kalendári zatiaľ nemáš ďalší plán."
                      : "Pripoj SSTZ a maj ligový rozpis vždy poruke."}
                  </p>
                </div>
              </div>
              <button
                className="home-match-cta"
                onClick={() => onNavigate(sstzProfile ? "calendar" : "sstz")}
              >
                {sstzProfile ? "Otvoriť kalendár" : "Nájsť moju ligu"}
                <ArrowRight size={17} />
              </button>
            </>
          )}
        </section>
        <details
          className="home-equipment glass-panel"
          aria-labelledby="home-equipment-title"
        >
          <summary className="equipment-disclosure">
            <div className="home-section-heading">
              <span className="eyebrow">MOJA VÝSTROJ</span>
              <Layers size={19} />
            </div>
            <h2 id="home-equipment-title">
              {activeRacket?.name || "Tvoja výstroj"}
            </h2>
            <span className="equipment-disclosure-hint">
              <span className="equipment-health-preview">
                {activeRacket
                  ? equipment.map(({ short, rubber }) => {
                      const health = rubber
                        ? getRubberHealth(rubber).percent
                        : null;
                      return (
                        <span
                          key={short}
                          className={
                            health !== null && health < 30 ? "needs-care" : ""
                          }
                        >
                          {short}{" "}
                          <strong>
                            {health === null ? "—" : `${health}%`}
                          </strong>
                        </span>
                      );
                    })
                  : "Pridať raketu a poťahy"}
              </span>
              <ChevronRight size={16} />
            </span>
          </summary>
          {activeRacket ? (
            <div className="home-rubbers">
              {equipment.map(({ label, short, rubber }) => {
                const health = rubber ? getRubberHealth(rubber).percent : null;
                return (
                  <div
                    className={`home-rubber ${health !== null && health < 30 ? "needs-care" : ""}`}
                    key={short}
                  >
                    <div>
                      <span>{label}</span>
                      <strong>{health === null ? "—" : `${health}%`}</strong>
                    </div>
                    <div
                      className="rubber-meter"
                      role="meter"
                      aria-label={`${label} – kondícia poťahu`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={health ?? undefined}
                      aria-valuetext={
                        health === null
                          ? "Poťah nie je priradený"
                          : `${health}%`
                      }
                    >
                      <span style={{ width: `${health ?? 0}%` }} />
                    </div>
                    <small>
                      {rubber
                        ? `${rubber.brand} ${rubber.model}`
                        : "Poťah ešte nie je priradený"}
                    </small>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="home-equipment-empty">
              Pridaj svoju raketu a sleduj, kedy si poťahy zaslúžia výmenu.
            </p>
          )}
          <button
            className="text-button"
            onClick={() => onNavigate("equipment")}
          >
            Moja výstroj
            <ArrowRight size={16} />
          </button>
        </details>
      </div>

      <section className="home-shortcuts" aria-label="Rýchly prístup">
        {[
          {
            tab: "calendar",
            Icon: Calendar,
            title: "Môj kalendár",
            description: "Tréningy a zápasy",
          },
          {
            tab: "sstz",
            Icon: Shield,
            title: "Moja liga",
            description: "Oficiálne výsledky a ligy",
          },
          {
            tab: "community",
            Icon: Users,
            title: "Komunita",
            description: "Priatelia a spoločné tréningy",
          },
        ].map(({ tab, Icon, title, description }) => (
          <button key={tab} onClick={() => onNavigate(tab as NavTab)}>
            <span className="shortcut-icon">
              <Icon size={21} />
            </span>
            <span>
              <strong>{title}</strong>
              <small>{description}</small>
            </span>
            <ChevronRight size={16} />
          </button>
        ))}
      </section>

      <section
        className="home-recent glass-panel"
        aria-labelledby="recent-title"
      >
        <div className="home-section-heading">
          <div>
            <h2 id="recent-title">Posledné aktivity</h2>
            <p>Tvoja cesta za lepšou hrou.</p>
          </div>
          <button className="text-button" onClick={() => onNavigate("diary")}>
            Všetky aktivity
            <ArrowRight size={16} />
          </button>
        </div>
        {recent.length ? (
          <div className="recent-list">
            {recent.map((entry) => (
              <button
                className="recent-row"
                key={entry.id}
                onClick={() => onNavigate("diary", entry.category)}
              >
                <span className="recent-icon" data-category={entry.category}>
                  {entry.category === "tréning" ? (
                    <Activity size={20} />
                  ) : (
                    <Trophy size={20} />
                  )}
                </span>
                <span className="recent-copy">
                  <strong>{entry.title}</strong>
                  <small>
                    {entry.date
                      ? new Date(`${entry.date}T12:00:00`).toLocaleDateString(
                          "sk",
                          { day: "numeric", month: "long" },
                        )
                      : entry.originalDate}
                    {entry.subtitle ? ` · ${entry.subtitle}` : ""}
                  </small>
                </span>
                <span
                  className={`recent-result ${entry.result === "WIN" ? "is-win" : entry.result === "LOSS" ? "is-loss" : ""}`}
                >
                  {entry.score ||
                    (entry.activity?.durationMinutes
                      ? `${entry.activity.durationMinutes} min`
                      : "")}
                </span>
                <ChevronRight size={16} />
              </button>
            ))}
          </div>
        ) : (
          <div className="home-empty">
            <span className="recent-icon">
              <Activity size={24} />
            </span>
            <div>
              <h3>Tu začína tvoj progres</h3>
              <p>
                Zapíš prvý tréning alebo zápas. O všetko ostatné sa postará tvoj
                denník.
              </p>
            </div>
            <button className="btn-secondary" onClick={onOpenQuickLog}>
              <Plus size={16} />
              Prvá aktivita
            </button>
          </div>
        )}
      </section>
      <DashboardProgress
        activities={activities}
        matches={insightMatches}
        onPerformance={() => onNavigate("performance")}
        onTraining={() => onNavigate("diary", "tréning")}
      />
    </div>
  );
};
