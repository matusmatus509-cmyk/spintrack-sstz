import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { NavTab } from '../components/Navigation';
import { AddActivityModal } from '../components/AddActivityModal';
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
} from 'lucide-react';
interface DashboardViewProps {
  onNavigate: (tab: NavTab) => void;
  onOpenQuickLog?: () => void;
  onOpenMatchModal?: () => void;
}
export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const { totalPlayHours, overallWinRate, matches, sstzProfile, teamSchedule } =
    useApp();
  const [showAddActivityModal, setShowAddActivityModal] = useState(false);
  const upcomingMatch = teamSchedule.find((m) => !m.isPlayed);
  const totalWins = matches.filter((m) => m.result === 'WIN').length;
  return (
    <div className="page-view dashboard-view animate-fade-in">
      <div className="page-header dashboard-heading">
        <div>
          <span className="eyebrow">TVOJ STOLNOTENISOVÝ DENNÍK</span>
          <h1>
            {sstzProfile ? sstzProfile.name : 'Tvoja hra na jednom mieste.'}
          </h1>
          <p>
            {sstzProfile?.clubName ||
              'Sleduj tréningy, výsledky a každý krok vpred.'}
          </p>
        </div>
        <button
          className="btn-primary"
          onClick={() => setShowAddActivityModal(true)}
        >
          <Plus size={19} /> Pridať aktivitu
        </button>
      </div>
      <section className="next-match-card" aria-labelledby="next-match-title">
        <div className="next-match-top">
          <span className="eyebrow" id="next-match-title">
            <span className="status-dot" /> NAJBLIŽŠÍ ZÁPAS
          </span>
          <button
            className="text-button"
            onClick={() => onNavigate('calendar')}
          >
            Kalendár <ArrowUpRight size={17} />
          </button>
        </div>
        {upcomingMatch ? (
          <>
            <div className="match-teams">
              <div>
                <span className="team-caption">Domáci</span>
                <h2>{upcomingMatch.homeTeam}</h2>
              </div>
              <span className="match-vs">VS</span>
              <div>
                <span className="team-caption">Hostia</span>
                <h2>{upcomingMatch.awayTeam}</h2>
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
              <h2>Priprav sa na ďalší zápas.</h2>
              <p>Pripoj svoju ligu a maj rozpis vždy po ruke.</p>
            </div>
            <button
              className="btn-secondary"
              onClick={() => onNavigate('sstz')}
            >
              Nájsť moju ligu <ChevronRight size={17} />
            </button>
          </div>
        )}
      </section>
      <section className="dashboard-metrics" aria-label="Tvoje výsledky">
        {[
          {
            label: 'Úspešnosť',
            value: `${overallWinRate}%`,
            detail: `${totalWins} výhier z ${matches.length} zápasov`,
            icon: TrendingUp,
            tone: 'green',
          },
          {
            label: 'Odohrané zápasy',
            value: matches.length,
            detail: 'Každý duel je skúsenosť.',
            icon: Trophy,
            tone: 'blue',
          },
          {
            label: 'Čas pri stole',
            value: `${totalPlayHours} h`,
            detail: 'Tréningy a zápasy spolu.',
            icon: Clock,
            tone: 'amber',
          },
        ].map(({ label, value, detail, icon: Icon, tone }) => (
          <article className={`metric-card metric-${tone}`} key={label}>
            <span className="metric-icon">
              <Icon size={21} />
            </span>
            <span className="metric-label">{label}</span>
            <strong className="metric-value">{value}</strong>
            <span className="metric-detail">{detail}</span>
          </article>
        ))}
      </section>
      <section className="dashboard-shortcuts" aria-label="Rýchly prístup">
        <button onClick={() => onNavigate('sstz')} className="shortcut-card">
          <span className="shortcut-icon">
            <Shield size={23} />
          </span>
          <span>
            <strong>Celá tvoja kariéra</strong>
            <small>Všetky sezóny a ligy zo SSTZ</small>
          </span>
          <ChevronRight size={19} />
        </button>
        <button onClick={() => onNavigate('diary')} className="shortcut-card">
          <span className="shortcut-icon">
            <Activity size={23} />
          </span>
          <span>
            <strong>Tréningový denník</strong>
            <small>Malé kroky. Veľký progres.</small>
          </span>
          <ChevronRight size={19} />
        </button>
      </section>
      <AddActivityModal
        isOpen={showAddActivityModal}
        onClose={() => setShowAddActivityModal(false)}
      />
    </div>
  );
};
