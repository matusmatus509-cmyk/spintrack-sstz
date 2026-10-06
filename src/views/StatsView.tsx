import React from 'react';
import { useApp } from '../context/AppContext';
import {
  Trophy,
  Flame,
  Clock,
  ShieldCheck,
  TrendingUp,
  Award,
  Zap,
  Target,
  CheckCircle,
  Sparkles,
  Layers
} from 'lucide-react';
import confetti from 'canvas-confetti';

export const StatsView: React.FC = () => {
  const {
    rackets,
    matches,
    trainingSessions,
    totalPlayHours,
    overallWinRate,
    sstzProfile,
    badges
  } = useApp();

  // Trigger confetti for fun
  const handleBadgeClick = (b: any) => {
    if (b.unlockedAt) {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 }
      });
    }
  };

  // XP calculation: 10 XP per training hour, 15 XP per match won, 5 XP per match played
  const wins = matches.filter(m => m.result === 'WIN').length;
  const xp = Math.round(totalPlayHours * 10 + wins * 15 + matches.length * 5);
  const level = Math.floor(xp / 100) + 1;
  const currentLevelXp = xp % 100;

  // Icon mapper for badges
  const renderBadgeIcon = (iconName: string) => {
    switch (iconName) {
      case 'Target': return <Target size={22} />;
      case 'Clock': return <Clock size={22} />;
      case 'Flame': return <Flame size={22} />;
      case 'ShieldCheck': return <ShieldCheck size={22} />;
      case 'Sparkles': return <Sparkles size={22} />;
      case 'Zap': return <Zap size={22} />;
      case 'Trophy': return <Trophy size={22} />;
      default: return <Award size={22} />;
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Top XP & Level Banner */}
      <div className="glass-panel" style={{
        padding: '24px',
        background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(18, 24, 36, 0.95) 100%)',
        border: '1px solid var(--border-subtle)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '20px',
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 800,
            fontSize: '1.8rem',
            boxShadow: '0 4px 16px rgba(245, 158, 11, 0.35)'
          }}>
            {level}
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Úroveň {level} • Stolnotenisový Bojovník</h2>
              <span className="badge-pill badge-amber">
                <Zap size={12} /> {xp} XP
              </span>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '2px' }}>
              Do úrovne {level + 1} ti chýba {100 - currentLevelXp} XP (trénuj, vyhrávaj zápasy, staraj sa o poťahy).
            </p>

            <div style={{
              width: '100%',
              maxWidth: '360px',
              height: '8px',
              background: 'rgba(255, 255, 255, 0.1)',
              borderRadius: 'var(--radius-full)',
              overflow: 'hidden',
              marginTop: '10px'
            }}>
              <div style={{
                width: `${currentLevelXp}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #f59e0b, #fbbf24)',
                borderRadius: 'var(--radius-full)'
              }} />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '16px' }}>
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Odomknuté odznaky</span>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fbbf24', fontFamily: 'var(--font-mono)' }}>
              {badges.filter(b => b.unlockedAt).length} / {badges.length}
            </div>
          </div>
        </div>
      </div>

      {/* Gear Performance Index (GPI) Rankings */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Gear Performance Index (GPI)</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              S akou raketou dosahuješ najvyššiu efektivitu a víťazstvá?
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {rackets.map((racket, idx) => {
            const total = racket.winCount + racket.lossCount;
            const rate = total > 0 ? Math.round((racket.winCount / total) * 100) : 0;

            return (
              <div
                key={racket.id}
                style={{
                  background: 'var(--bg-card)',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px 20px',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: idx === 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                    color: idx === 0 ? '#10b981' : 'var(--text-dim)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '1rem'
                  }}>
                    #{idx + 1}
                  </div>

                  <div>
                    <strong style={{ fontSize: '1rem' }}>{racket.name}</strong>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Odohrané: {racket.totalHours}h • Bilancia: {racket.winCount}V - {racket.lossCount}P
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Úspešnosť</span>
                    <div style={{ fontWeight: 800, fontSize: '1.1rem', color: rate >= 60 ? '#34d399' : '#f87171', fontFamily: 'var(--font-mono)' }}>
                      {rate}%
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>GPI Skóre</span>
                    <div style={{ fontWeight: 800, fontSize: '1.2rem', color: '#10b981', fontFamily: 'var(--font-mono)' }}>
                      {racket.gpiScore}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Badges & Achievements Grid */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '6px' }}>
          Odznaky & Úspechy (Badges & Milestones)
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '20px' }}>
          Odomykaj odznaky za pravidelný tréning, starostlivosť o poťahy a zápasové víťazstvá.
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '16px'
        }}>
          {badges.map(b => {
            const isUnlocked = !!b.unlockedAt;

            return (
              <div
                key={b.id}
                onClick={() => handleBadgeClick(b)}
                style={{
                  background: isUnlocked ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-card)',
                  border: isUnlocked ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '18px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '14px',
                  cursor: isUnlocked ? 'pointer' : 'default',
                  opacity: isUnlocked ? 1 : 0.65,
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '12px',
                  background: isUnlocked ? 'linear-gradient(135deg, #10b981, #059669)' : 'rgba(255, 255, 255, 0.05)',
                  color: isUnlocked ? '#ffffff' : 'var(--text-dim)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  {renderBadgeIcon(b.icon)}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <strong style={{ fontSize: '0.95rem' }}>{b.title}</strong>
                    {isUnlocked && (
                      <span className="badge-pill badge-green" style={{ fontSize: '0.65rem' }}>
                        Získané
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    {b.description}
                  </p>

                  {!isUnlocked && (
                    <div style={{ marginTop: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                        <span>Postup:</span>
                        <span>{Math.round(b.progress)} / {b.maxProgress}</span>
                      </div>
                      <div style={{
                        height: '5px',
                        background: 'rgba(255, 255, 255, 0.08)',
                        borderRadius: 'var(--radius-full)',
                        overflow: 'hidden',
                        marginTop: '4px'
                      }}>
                        <div style={{
                          width: `${Math.min(100, (b.progress / b.maxProgress) * 100)}%`,
                          height: '100%',
                          background: '#38bdf8'
                        }} />
                      </div>
                    </div>
                  )}

                  {isUnlocked && (
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '6px', display: 'block' }}>
                      Odomknuté: {b.unlockedAt}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};
