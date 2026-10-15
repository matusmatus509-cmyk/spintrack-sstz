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
import { getDiaryEntries, normalizeDiaryDate } from "../utils/diary";
import { DashboardProgress } from "../components/DashboardProgress";
import { dashboardAgenda, dayKey } from "../utils/dashboardInsights";
import "./Overview.css";
import "./Dashboard.css";

interface DashboardViewProps {
  onNavigate: (tab: NavTab, category?: "all" | ActivityCategory) => void;
  onOpenQuickLog?: () => void;
  onOpenMatchModal?: () => void;
}

function CourtIllustration() {
  return (
    <svg
      className="court-illustration"
      viewBox="0 0 320 240"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="176" cy="116" r="109" fill="currentColor" opacity=".06" />
      <circle
        cx="176"
        cy="116"
        r="86"
        stroke="currentColor"
        strokeDasharray="3 7"
        opacity=".2"
      />
      <g transform="translate(35 55) rotate(-14 130 80)">
        <path
          d="M15 32 176 12 267 118 100 147Z"
          fill="var(--court-fill)"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path
          d="m24 36 148 98 109 15M98 22l82 110M142 16v-24l-1 24 0 64v24M61 87l168-20"
          stroke="currentColor"
          strokeWidth="1.5"
          opacity=".55"
        />
        <path
          d="m61 87 168-20v-27L61 60Z"
          fill="var(--court-fill)"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path
          d="m61 69 168-20M61 78l168-20m-147 0v27m21-30v27m21-30v27m21-30v27m21-30v27m21-30v27m21-30v27"
          stroke="currentColor"
          opacity=".25"
        />
        <path
          d="M100 147v24m167-53v24M15 32v24"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </g>
      <g transform="translate(234 152) rotate(32)">
        <rect x="-5" y="17" width="10" height="32" rx="4" fill="#d9b78a" />
        <ellipse rx="24" ry="29" fill="var(--court-paddle)" />
        <path
          d="M-16-15c5-9 16-11 23-5"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          opacity=".45"
        />
      </g>
      <circle cx="119" cy="51" r="8" fill="var(--court-ball)" />
      <path
        d="m104 39-12-10m9 18-18-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity=".4"
      />
    </svg>
  );
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
          <h1>
            {name ? `Ahoj, ${name.split(" ")[0]}.` : "Tvoja hra. Tvoj prehľad."}
          </h1>
          <p>
            {sstzProfile?.clubName ||
              account.profile?.club ||
              "Malé kroky pri stole. Veľký posun v tvojej hre."}
          </p>
        </div>
        <button className="btn-primary" onClick={onOpenQuickLog}>
          <Plus size={18} />
          Pridať aktivitu
        </button>
      </header>

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

      <section className="home-metrics" aria-label="Tvoje výsledky">
        {[
          {
            label: "Celková úspešnosť",
            value: results.rate === null ? "—" : `${results.rate}%`,
            detail: `${results.wins} výhier · ${results.losses} prehier`,
            Icon: TrendingUp,
            tone: "green",
            tab: "performance",
          },
          {
            label: "Odohrané zápasy",
            value: results.played,
            detail: "Celá história · dvojhry aj štvorhry",
            Icon: Trophy,
            tone: "blue",
            tab: "matches",
          },
          {
            label: "Čas na tréningu",
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
                  <h2 id="home-match-title">
                    Pripravený na
                    <br />
                    ďalšiu výmenu?
                  </h2>
                  <p>
                    {sstzProfile
                      ? "Naplánuj si tréning alebo si pozri svoj kalendár."
                      : "Pripoj svoju ligu a maj zápasy, výsledky aj celú kariéru po ruke."}
                  </p>
                </div>
                <CourtIllustration />
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
        <section
          className="home-equipment glass-panel"
          aria-labelledby="home-equipment-title"
        >
          <div className="home-section-heading">
            <span className="eyebrow">PRIPRAVENÉ NA HRU</span>
            <Layers size={19} />
          </div>
          <h2 id="home-equipment-title">
            {activeRacket?.name || "Tvoja výstroj"}
          </h2>
          <p>Kondícia poťahov</p>
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
        </section>
      </div>

      <DashboardProgress
        activities={activities}
        matches={insightMatches}
        onPerformance={() => onNavigate("performance")}
        onTraining={() => onNavigate("diary", "tréning")}
      />

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
      <footer className="home-footer">
        <CircleMark />
        Vytvorené pre tvoju hru.<span>SpinTrack · SSTZ</span>
      </footer>
    </div>
  );
};
function CircleMark() {
  return <span className="footer-ball" aria-hidden="true" />;
}
