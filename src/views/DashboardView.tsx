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
  ShieldCheck,
  ChevronRight,
  Flame
} from 'lucide-react';

interface DashboardViewProps {
  onNavigate: (tab: NavTab) => void;
  onOpenQuickLog?: () => void;
  onOpenMatchModal?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const {
    totalPlayHours,
    overallWinRate,
    matches,
    sstzProfile,
    teamSchedule
  } = useApp();

  const [showAddActivityModal, setShowAddActivityModal] = useState(false);

  // Next upcoming match from teamSchedule
  const upcomingMatch = teamSchedule.find(m => !m.isPlayed);
  const totalWins = matches.filter(m => m.result === 'WIN').length;

  return (
    <div
      className="animate-fade-in"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        maxWidth: '720px',
        margin: '0 auto',
        width: '100%',
        paddingBottom: '8px'
      }}
    >
      {/* 1. Header with Profile & Add Activity Button */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="badge-pill badge-green" style={{ fontSize: '0.68rem', padding: '1px 6px' }}>
              <Flame size={11} /> Prehľad
            </span>
            {sstzProfile && (
              <span className="badge-pill badge-blue" style={{ fontSize: '0.68rem', padding: '1px 6px' }}>
                <ShieldCheck size={11} /> {sstzProfile.clubName || 'SSTZ'}
              </span>
            )}
          </div>
          <h1 style={{ fontSize: '1.45rem', fontWeight: 800, letterSpacing: '-0.02em', margin: '2px 0 0 0' }}>
            {sstzProfile ? sstzProfile.name : 'Môj SpinTrack'}
          </h1>
        </div>

        <button
          onClick={() => setShowAddActivityModal(true)}
          className="btn-primary"
          style={{
            padding: '9px 16px',
            fontSize: '0.85rem',
            boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap'
          }}
        >
          <Plus size={16} /> Pridať aktivitu
        </button>
      </div>

      {/* 2. KARTA: ĎALŠÍ ZÁPAS */}
      <div
        className="glass-panel"
        style={{
          padding: '18px 20px',
          borderRadius: 'var(--radius-xl)',
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.85) 100%)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              className="badge-pill badge-blue"
              style={{ fontSize: '0.72rem', fontWeight: 800, padding: '3px 8px' }}
            >
              <Calendar size={12} /> Ďalší zápas
            </span>
            {upcomingMatch?.round && (
              <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', fontWeight: 600 }}>
                {upcomingMatch.round}
              </span>
            )}
          </div>

          <button
            onClick={() => onNavigate('calendar')}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#38bdf8',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '2px'
            }}
          >
            Kalendár <ChevronRight size={14} />
          </button>
        </div>

        {upcomingMatch ? (
          <div>
            {/* Teams Duel */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                padding: '12px 14px',
                background: 'rgba(0, 0, 0, 0.35)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-subtle)'
              }}
            >
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Domáci
                </div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>
                  {upcomingMatch.homeTeam}
                </div>
              </div>

              <div
                style={{
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-full)',
                  background: 'rgba(59, 130, 246, 0.2)',
                  border: '1px solid rgba(59, 130, 246, 0.4)',
                  color: '#60a5fa',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  fontFamily: 'var(--font-mono)'
                }}
              >
                VS
              </div>

              <div style={{ flex: 1, textAlign: 'right' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Hostia
                </div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>
                  {upcomingMatch.awayTeam}
                </div>
              </div>
            </div>

            {/* Date & Time footer */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '10px',
                fontSize: '0.8rem',
                color: 'var(--text-muted)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clock size={14} color="#34d399" />
                <span style={{ color: '#fff', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                  {upcomingMatch.dateTime}
                </span>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                SSTZ Oficiálny rozpis
              </span>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '16px 10px' }}>
            <Calendar size={32} color="var(--text-dim)" style={{ margin: '0 auto 8px auto' }} />
            <div style={{ fontSize: '0.95rem', fontWeight: 700 }}>
              Žiadny naplánovaný zápas
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '4px 0 10px 0' }}>
              Pozri si ligovú tabuľku alebo kalendár v SSTZ Hub.
            </p>
            <button
              onClick={() => onNavigate('sstz')}
              className="btn-secondary"
              style={{ padding: '6px 14px', fontSize: '0.78rem' }}
            >
              Prejsť na SSTZ Hub
            </button>
          </div>
        )}
      </div>

      {/* 3. HLAVNÉ METRIKY: Úspešnosť, Počet zápasov, Odohrané hodiny */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px'
        }}
      >
        {/* Metrika 1: Úspešnosť */}
        <div
          className="glass-panel"
          style={{
            padding: '18px 16px',
            borderRadius: 'var(--radius-xl)',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>
              Úspešnosť výhier
            </span>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <TrendingUp size={16} />
            </div>
          </div>

          <div
            style={{
              fontSize: '2.1rem',
              fontWeight: 800,
              fontFamily: 'var(--font-mono)',
              color: overallWinRate >= 50 ? '#34d399' : '#f87171',
              lineHeight: 1
            }}
          >
            {overallWinRate}%
          </div>

          <div style={{ fontSize: '0.76rem', color: 'var(--text-dim)' }}>
            <strong style={{ color: '#34d399' }}>{totalWins}</strong> výhier z <strong>{matches.length}</strong> zápasov
          </div>
        </div>

        {/* Metrika 2: Počet zápasov */}
        <div
          className="glass-panel"
          style={{
            padding: '18px 16px',
            borderRadius: 'var(--radius-xl)',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>
              Počet zápasov
            </span>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Trophy size={16} />
            </div>
          </div>

          <div
            style={{
              fontSize: '2.1rem',
              fontWeight: 800,
              fontFamily: 'var(--font-mono)',
              color: '#fff',
              lineHeight: 1
            }}
          >
            {matches.length}
          </div>

          <div style={{ fontSize: '0.76rem', color: 'var(--text-dim)' }}>
            Celkovo odohraných duelov
          </div>
        </div>

        {/* Metrika 3: Počet odohratých hodín */}
        <div
          className="glass-panel"
          style={{
            padding: '18px 16px',
            borderRadius: 'var(--radius-xl)',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>
              Odohrané hodiny
            </span>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(245, 158, 11, 0.15)',
                color: '#f59e0b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Clock size={16} />
            </div>
          </div>

          <div
            style={{
              fontSize: '2.1rem',
              fontWeight: 800,
              fontFamily: 'var(--font-mono)',
              color: '#f59e0b',
              lineHeight: 1
            }}
          >
            {totalPlayHours} <span style={{ fontSize: '1rem', color: 'var(--text-dim)' }}>h</span>
          </div>

          <div style={{ fontSize: '0.76rem', color: 'var(--text-dim)' }}>
            Tréningy a zápasy celkom
          </div>
        </div>
      </div>

      {/* Add Activity Modal */}
      <AddActivityModal
        isOpen={showAddActivityModal}
        onClose={() => setShowAddActivityModal(false)}
      />
    </div>
  );
};
