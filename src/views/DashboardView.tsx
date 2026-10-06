import React from 'react';
import { useApp } from '../context/AppContext';
import { NavTab } from '../components/Navigation';
import { SetBreakdown } from '../components/SetBreakdown';
import {
  Trophy,
  Flame,
  Clock,
  ShieldCheck,
  Calendar,
  AlertTriangle,
  Play,
  CheckCircle2,
  ChevronRight,
  TrendingUp,
  Activity,
  Layers
} from 'lucide-react';

interface DashboardViewProps {
  onNavigate: (tab: NavTab) => void;
  onOpenQuickLog: () => void;
  onOpenMatchModal: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
  onOpenQuickLog,
  onOpenMatchModal
}) => {
  const {
    activeRacket,
    blades,
    rubbers,
    getRubberHealth,
    totalPlayHours,
    overallWinRate,
    matches,
    trainingSessions,
    sstzProfile,
    teamSchedule,
    isStopwatchRunning,
    startStopwatch
  } = useApp();

  const blade = blades.find(b => b.id === activeRacket?.bladeId);
  const fhRubber = rubbers.find(r => r.id === activeRacket?.forehandRubberId);
  const bhRubber = rubbers.find(r => r.id === activeRacket?.backhandRubberId);

  const fhHealth = fhRubber ? getRubberHealth(fhRubber) : null;
  const bhHealth = bhRubber ? getRubberHealth(bhRubber) : null;

  // Next upcoming match from teamSchedule
  const upcomingMatch = teamSchedule.find(m => !m.isPlayed);

  // Recent 4 activities (matches + sessions combined)
  const recentItems = [
    ...matches.slice(0, 3).map(m => ({ ...m, activityType: 'match' as const })),
    ...trainingSessions.slice(0, 3).map(s => ({ ...s, activityType: 'session' as const }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 4);

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Top Banner / Hero Card */}
      <div className="glass-panel" style={{
        padding: '24px',
        position: 'relative',
        overflow: 'hidden',
        background: 'linear-gradient(135deg, rgba(18, 24, 36, 0.95) 0%, rgba(24, 32, 50, 0.85) 100%)',
        border: '1px solid var(--border-subtle)'
      }}>
        <div style={{
          position: 'absolute',
          top: '-40px',
          right: '-40px',
          width: '200px',
          height: '200px',
          background: 'radial-gradient(circle, rgba(16, 185, 129, 0.15) 0%, transparent 70%)',
          borderRadius: '50%',
          pointerEvents: 'none'
        }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span className="badge-pill badge-green">
                <Flame size={12} /> SpinTrack Stolnotenisový Denník
              </span>
              {sstzProfile && (
                <span className="badge-pill badge-blue">
                  <ShieldCheck size={12} /> {sstzProfile.clubName || 'SSTZ Klub'}
                </span>
              )}
            </div>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '4px' }}>
              Vitaj späť, {sstzProfile ? sstzProfile.name : 'Hráč'}! 🏓
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', maxWidth: '600px' }}>
              Sleduj opotrebovanie svojich poťahov, eviduj tréningy so stopkami a maj kompletný rozpis a výsledky SSTZ líg na jednom mieste.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            {!isStopwatchRunning && (
              <button
                onClick={startStopwatch}
                className="btn-primary"
                style={{ padding: '10px 18px', fontSize: '0.9rem' }}
              >
                <Play size={16} /> Spustiť tréning
              </button>
            )}
            <button
              onClick={onOpenMatchModal}
              className="btn-secondary"
              style={{ padding: '10px 18px', fontSize: '0.9rem' }}
            >
              + Zápas
            </button>
          </div>
        </div>
      </div>

      {/* Grid: Active Racket & Next Match */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '20px'
      }}>
        {/* Active Racket Card */}
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#10b981',
                padding: '8px',
                borderRadius: '10px'
              }}>
                <Layers size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Aktívna Raketa</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {activeRacket?.name || 'Bez názvu'}
                </span>
              </div>
            </div>

            <button
              onClick={() => onNavigate('equipment')}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#34d399',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              Upraviť <ChevronRight size={14} />
            </button>
          </div>

          {/* Setup details */}
          <div style={{
            background: 'var(--bg-card)',
            borderRadius: 'var(--radius-md)',
            padding: '16px',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            {/* Blade */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Drevo:</span>
              <strong style={{ fontSize: '0.92rem' }}>{blade ? `${blade.brand} ${blade.model}` : 'Nezvolené'}</strong>
            </div>

            <div style={{ height: '1px', background: 'var(--border-subtle)' }} />

            {/* Forehand Rubber Health */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: fhRubber?.color === 'red' ? '#ef4444' : '#000000',
                    border: '1px solid rgba(255,255,255,0.2)'
                  }} />
                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                    FH: {fhRubber ? `${fhRubber.brand} ${fhRubber.model}` : 'Nezvolený'}
                  </span>
                </div>
                <span style={{
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  color: (fhHealth?.percent || 0) < 40 ? '#f87171' : '#34d399'
                }}>
                  {fhHealth?.percent}% Zdravie ({fhRubber?.hoursPlayed || 0}h / {fhRubber?.maxRecommendedHours || 80}h)
                </span>
              </div>
              <div style={{
                height: '6px',
                background: 'rgba(255,255,255,0.08)',
                borderRadius: 'var(--radius-full)',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${fhHealth?.percent || 0}%`,
                  height: '100%',
                  background: (fhHealth?.percent || 0) < 40 ? '#ef4444' : 'linear-gradient(90deg, #10b981, #34d399)',
                  borderRadius: 'var(--radius-full)',
                  transition: 'width 0.3s'
                }} />
              </div>
            </div>

            {/* Backhand Rubber Health */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: bhRubber?.color === 'red' ? '#ef4444' : '#000000',
                    border: '1px solid rgba(255,255,255,0.2)'
                  }} />
                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                    BH: {bhRubber ? `${bhRubber.brand} ${bhRubber.model}` : 'Nezvolený'}
                  </span>
                </div>
                <span style={{
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  color: (bhHealth?.percent || 0) < 40 ? '#f87171' : '#34d399'
                }}>
                  {bhHealth?.percent}% Zdravie ({bhRubber?.hoursPlayed || 0}h / {bhRubber?.maxRecommendedHours || 80}h)
                </span>
              </div>
              <div style={{
                height: '6px',
                background: 'rgba(255,255,255,0.08)',
                borderRadius: 'var(--radius-full)',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${bhHealth?.percent || 0}%`,
                  height: '100%',
                  background: (bhHealth?.percent || 0) < 40 ? '#ef4444' : 'linear-gradient(90deg, #10b981, #34d399)',
                  borderRadius: 'var(--radius-full)',
                  transition: 'width 0.3s'
                }} />
              </div>
            </div>
          </div>

          {/* Setup GPI indicator */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>Gear Performance Index (GPI):</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <TrendingUp size={16} color="#10b981" />
              <strong style={{ color: '#10b981', fontFamily: 'var(--font-mono)' }}>
                {activeRacket?.gpiScore || 85} / 100
              </strong>
            </div>
          </div>
        </div>

        {/* Next Upcoming Match Card */}
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                background: 'rgba(59, 130, 246, 0.15)',
                color: '#3b82f6',
                padding: '8px',
                borderRadius: '10px'
              }}>
                <Calendar size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Najbližší ligový zápas</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  SSTZ Rozpis tímu
                </span>
              </div>
            </div>

            <button
              onClick={() => onNavigate('calendar')}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#60a5fa',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              Rozpis <ChevronRight size={14} />
            </button>
          </div>

          {upcomingMatch ? (
            <div style={{
              background: 'var(--bg-card)',
              borderRadius: 'var(--radius-md)',
              padding: '18px',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="badge-pill badge-blue" style={{ fontSize: '0.7rem' }}>
                  {upcomingMatch.round || 'Ligové kolo'}
                </span>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {upcomingMatch.dateTime}
                </span>
              </div>

              {/* Matchup */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 0',
                gap: '8px'
              }}>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-main)' }}>
                    {upcomingMatch.homeTeam}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Doma</span>
                </div>

                <div style={{
                  padding: '4px 10px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: 'var(--radius-sm)',
                  fontWeight: 800,
                  fontSize: '0.9rem',
                  color: 'var(--text-dim)'
                }}>
                  VS
                </div>

                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-main)' }}>
                    {upcomingMatch.awayTeam}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Vonku</span>
                </div>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.8rem',
                color: 'var(--text-muted)',
                background: 'rgba(10, 13, 20, 0.4)',
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)'
              }}>
                <Activity size={14} color="#10b981" />
                <span>Pripravené pre zápas s raketou {activeRacket?.name}</span>
              </div>
            </div>
          ) : (
            <div style={{
              background: 'var(--bg-card)',
              borderRadius: 'var(--radius-md)',
              padding: '24px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px'
            }}>
              <Calendar size={32} color="var(--text-dim)" />
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                Zatiaľ nemáš prepojený rozpis tímu zo stránky SSTZ.
              </p>
              <button
                onClick={() => onNavigate('sstz')}
                className="btn-primary"
                style={{ fontSize: '0.8rem', padding: '6px 14px' }}
              >
                Vybrať tím a ligu
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Stats Numbers Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px'
      }}>
        {/* Total hours */}
        <div className="glass-panel" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            background: 'rgba(16, 185, 129, 0.15)',
            color: '#10b981',
            padding: '12px',
            borderRadius: '12px'
          }}>
            <Clock size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Odohraný čas
            </span>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
              {totalPlayHours} hod.
            </div>
          </div>
        </div>

        {/* Win rate */}
        <div className="glass-panel" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            background: 'rgba(59, 130, 246, 0.15)',
            color: '#3b82f6',
            padding: '12px',
            borderRadius: '12px'
          }}>
            <Trophy size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Celková úspešnosť
            </span>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>
              {overallWinRate}%
            </div>
          </div>
        </div>

        {/* SSTZ Singles Rate */}
        <div className="glass-panel" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            background: 'rgba(245, 158, 11, 0.15)',
            color: '#f59e0b',
            padding: '12px',
            borderRadius: '12px'
          }}>
            <ShieldCheck size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              SSTZ Úspešnosť
            </span>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fbbf24', fontFamily: 'var(--font-mono)' }}>
              {sstzProfile ? `${sstzProfile.singlesStats.winRate}%` : 'Neprepojené'}
            </div>
          </div>
        </div>

        {/* Total matches */}
        <div className="glass-panel" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            background: 'rgba(139, 92, 246, 0.15)',
            color: '#8b5cf6',
            padding: '12px',
            borderRadius: '12px'
          }}>
            <Activity size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Zápasy v denníku
            </span>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
              {matches.length}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity List */}
      <div className="glass-panel" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Posledné záznamy & zápasy</h3>
          <button
            onClick={() => onNavigate('diary')}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Zobraziť všetky ({matches.length + trainingSessions.length}) →
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {recentItems.map((item, idx) => {
            const isMatch = item.activityType === 'match';
            return (
              <div
                key={item.id || idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  background: 'var(--bg-card)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  gap: '12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
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
                    {isMatch ? <Trophy size={18} /> : <Clock size={18} />}
                  </div>

                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>
                      {isMatch
                        ? `vs ${(item as any).opponentName}`
                        : `${(item as any).type?.toUpperCase()} (${(item as any).durationMinutes} min)`}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {new Date(item.date).toLocaleDateString('sk-SK')} • {isMatch ? (item as any).competition : (item as any).location}
                    </div>
                    {isMatch && (item as any).sets && (
                      <SetBreakdown
                        sets={(item as any).sets}
                        setDetails={(item as any).setDetails}
                        totalPointsWon={(item as any).totalPointsWon}
                        totalPointsLost={(item as any).totalPointsLost}
                        result={(item as any).result}
                        compact
                      />
                    )}
                  </div>
                </div>

                {isMatch ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.9rem' }}>
                      {(item as any).score}
                    </span>
                    <span className={`badge-pill ${(item as any).result === 'WIN' ? 'badge-green' : 'badge-red'}`}>
                      {(item as any).result === 'WIN' ? 'VÝHRA' : 'PREHRA'}
                    </span>
                  </div>
                ) : (
                  <span className="badge-pill badge-blue">
                    {(item as any).durationMinutes} MIN
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};
