import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { NavTab } from '../components/Navigation';
import { SetBreakdown } from '../components/SetBreakdown';
import { AddActivityModal } from '../components/AddActivityModal';
import {
  Trophy,
  Flame,
  Clock,
  ShieldCheck,
  Calendar,
  AlertTriangle,
  Plus,
  CheckCircle2,
  ChevronRight,
  TrendingUp,
  Activity,
  Layers
} from 'lucide-react';

interface DashboardViewProps {
  onNavigate: (tab: NavTab) => void;
  onOpenQuickLog?: () => void;
  onOpenMatchModal?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate
}) => {
  const {
    activeRacket,
    blades,
    rubbers,
    getRubberHealth,
    totalPlayHours,
    overallWinRate,
    matches,
    activities,
    sstzProfile,
    teamSchedule
  } = useApp();

  const [showAddActivityModal, setShowAddActivityModal] = useState(false);

  const blade = blades.find(b => b.id === activeRacket?.bladeId);
  const fhRubber = rubbers.find(r => r.id === activeRacket?.forehandRubberId);
  const bhRubber = rubbers.find(r => r.id === activeRacket?.backhandRubberId);

  const fhHealth = fhRubber ? getRubberHealth(fhRubber) : null;
  const bhHealth = bhRubber ? getRubberHealth(bhRubber) : null;

  // Next upcoming match from teamSchedule
  const upcomingMatch = teamSchedule.find(m => !m.isPlayed);

  // Recent 4 activities (matches + activities combined)
  const recentItems = [
    ...matches.slice(0, 3).map(m => ({ ...m, activityType: 'match' as const })),
    ...activities.slice(0, 3).map(a => ({ ...a, activityType: 'activity' as const }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 4);

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* Top Banner / Hero Card */}
      <div className="glass-panel" style={{
        padding: '16px',
        position: 'relative',
        overflow: 'hidden',
        background: 'linear-gradient(135deg, rgba(18, 24, 36, 0.95) 0%, rgba(24, 32, 50, 0.85) 100%)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <span className="badge-pill badge-green" style={{ fontSize: '0.65rem' }}>
                <Flame size={11} /> SpinTrack
              </span>
              {sstzProfile && (
                <span className="badge-pill badge-blue" style={{ fontSize: '0.65rem' }}>
                  <ShieldCheck size={11} /> {sstzProfile.clubName || 'SSTZ'}
                </span>
              )}
            </div>
            <h1 style={{ fontSize: '1.45rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
              Ahoj, {sstzProfile ? sstzProfile.name.split(' ')[0] : 'hráč'}! 🏓
            </h1>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setShowAddActivityModal(true)}
              className="btn-primary"
              style={{
                padding: '9px 16px',
                fontSize: '0.85rem',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.35)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Plus size={15} /> Pridať aktivitu
            </button>
            <button
              onClick={() => onNavigate('diary')}
              className="btn-secondary"
              style={{ padding: '9px 14px', fontSize: '0.85rem' }}
            >
              Prehľad aktivít
            </button>
          </div>
        </div>
      </div>

      {/* Active Racket Health Overview */}
      <div className="glass-panel" style={{ padding: '16px', borderRadius: 'var(--radius-lg)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>
              Aktívna výbava
            </span>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>
              {activeRacket?.name || 'Zostava'}
            </h3>
          </div>

          <button
            onClick={() => onNavigate('equipment')}
            className="btn-secondary"
            style={{ padding: '6px 12px', fontSize: '0.78rem' }}
          >
            Spravovať výstroj →
          </button>
        </div>

        {/* Rubbers Health Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
          
          {/* Forehand Rubber */}
          <div style={{
            background: 'var(--bg-card)',
            padding: '14px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981' }} />
                <strong style={{ fontSize: '0.9rem' }}>Forehand (FH)</strong>
              </div>
              {fhHealth && (
                <span className={`badge-pill ${fhHealth.status === 'excellent' || fhHealth.status === 'good' ? 'badge-green' : 'badge-red'}`} style={{ fontSize: '0.68rem' }}>
                  {fhHealth.percent}% zdravie
                </span>
              )}
            </div>

            <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', marginBottom: '8px' }}>
              {fhRubber ? `${fhRubber.brand} ${fhRubber.model}` : 'Nenainštalovaný'}
            </div>

            {fhHealth && (
              <div>
                <div className="progress-bar-bg" style={{ height: '6px' }}>
                  <div
                    className={`progress-bar-fill ${fhHealth.status === 'critical' || fhHealth.status === 'worn' ? 'progress-danger' : 'progress-success'}`}
                    style={{ width: `${fhHealth.percent}%` }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                  <span>Odohrané: {fhRubber?.hoursPlayed || 0} h</span>
                  <span>Zostáva: ~{fhHealth.remainingHours} h</span>
                </div>
              </div>
            )}
          </div>

          {/* Backhand Rubber */}
          <div style={{
            background: 'var(--bg-card)',
            padding: '14px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444' }} />
                <strong style={{ fontSize: '0.9rem' }}>Backhand (BH)</strong>
              </div>
              {bhHealth && (
                <span className={`badge-pill ${bhHealth.status === 'excellent' || bhHealth.status === 'good' ? 'badge-green' : 'badge-red'}`} style={{ fontSize: '0.68rem' }}>
                  {bhHealth.percent}% zdravie
                </span>
              )}
            </div>

            <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', marginBottom: '8px' }}>
              {bhRubber ? `${bhRubber.brand} ${bhRubber.model}` : 'Nenainštalovaný'}
            </div>

            {bhHealth && (
              <div>
                <div className="progress-bar-bg" style={{ height: '6px' }}>
                  <div
                    className={`progress-bar-fill ${bhHealth.status === 'critical' || bhHealth.status === 'worn' ? 'progress-danger' : 'progress-success'}`}
                    style={{ width: `${bhHealth.percent}%` }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                  <span>Odohrané: {bhRubber?.hoursPlayed || 0} h</span>
                  <span>Zostáva: ~{bhHealth.remainingHours} h</span>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Next Upcoming Match Card */}
      {upcomingMatch && (
        <div className="glass-panel" style={{
          padding: '16px',
          borderRadius: 'var(--radius-lg)',
          borderLeft: '4px solid #3b82f6'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="badge-pill badge-blue" style={{ fontSize: '0.68rem' }}>
                <Calendar size={11} /> Najbližší zápas
              </span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                {upcomingMatch.dateTime} ({upcomingMatch.round})
              </span>
            </div>

            <button
              onClick={() => onNavigate('calendar')}
              className="btn-secondary"
              style={{ padding: '4px 10px', fontSize: '0.72rem' }}
            >
              Celý kalendár →
            </button>
          </div>

          <div style={{ fontSize: '1.05rem', fontWeight: 800 }}>
            {upcomingMatch.homeTeam} <span style={{ color: '#38bdf8' }}>vs</span> {upcomingMatch.awayTeam}
          </div>
        </div>
      )}

      {/* Quick Statistics Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
        <div style={{ background: 'var(--bg-card)', padding: '12px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
            Celkovo zápasov
          </span>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '2px', color: '#fff' }}>
            {matches.length}
          </div>
        </div>

        <div style={{ background: 'var(--bg-card)', padding: '12px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
            Úspešnosť výhier
          </span>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '2px', color: overallWinRate >= 50 ? '#34d399' : '#f87171' }}>
            {overallWinRate}%
          </div>
        </div>

        <div style={{ background: 'var(--bg-card)', padding: '12px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
            Aktivity & Tréning
          </span>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '2px', color: '#38bdf8' }}>
            {activities.length}
          </div>
        </div>

        <div style={{ background: 'var(--bg-card)', padding: '12px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
            Odohrané hodiny
          </span>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '2px', color: '#f59e0b' }}>
            {totalPlayHours} h
          </div>
        </div>
      </div>

      {/* Recent Activity List */}
      <div className="glass-panel" style={{ padding: '16px', borderRadius: 'var(--radius-lg)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0 }}>Posledné záznamy</h3>
          <button
            onClick={() => onNavigate('diary')}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#38bdf8',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Zobraziť všetky ({activities.length + matches.length}) →
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {recentItems.map((item, idx) => {
            const isMatch = item.activityType === 'match';
            return (
              <div
                key={item.id || idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  background: 'var(--bg-card)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  gap: '10px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: isMatch
                      ? (item as any).result === 'WIN' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'
                      : 'rgba(59, 130, 246, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: isMatch
                      ? (item as any).result === 'WIN' ? '#34d399' : '#f87171'
                      : '#60a5fa'
                  }}>
                    {isMatch ? <Trophy size={16} /> : <Activity size={16} />}
                  </div>

                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>
                      {isMatch
                        ? `vs ${(item as any).opponentName}`
                        : `${(item as any).category?.toUpperCase() || 'TRÉNING'} (${(item as any).durationMinutes} min)`}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                      {(item as any).date} • {isMatch ? (item as any).competition : (item as any).location}
                    </div>
                  </div>
                </div>

                {isMatch ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.85rem' }}>
                      {(item as any).score}
                    </span>
                    <span className={`badge-pill ${(item as any).result === 'WIN' ? 'badge-green' : 'badge-red'}`} style={{ fontSize: '0.65rem' }}>
                      {(item as any).result === 'WIN' ? 'VÝHRA' : 'PREHRA'}
                    </span>
                  </div>
                ) : (
                  <span className="badge-pill badge-blue" style={{ fontSize: '0.68rem' }}>
                    {(item as any).durationMinutes} MIN
                  </span>
                )}
              </div>
            );
          })}
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
