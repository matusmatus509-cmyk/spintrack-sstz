import React from 'react';
import { useApp } from '../context/AppContext';
import { Play, Pause, RotateCcw, ShieldCheck, AlertCircle, RefreshCw, Settings, Trophy } from 'lucide-react';

interface HeaderProps {
  onOpenSettings: () => void;
  onOpenQuickLog: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenSettings, onOpenQuickLog }) => {
  const {
    activeRacket,
    rubbers,
    getRubberHealth,
    isStopwatchRunning,
    stopwatchSeconds,
    startStopwatch,
    pauseStopwatch,
    resetStopwatch,
    saveStopwatchAsSession,
    sstzProfile,
    isSstzLoading
  } = useApp();

  const formatTimer = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const fhRubber = rubbers.find(r => r.id === activeRacket?.forehandRubberId);
  const bhRubber = rubbers.find(r => r.id === activeRacket?.backhandRubberId);

  const fhHealth = fhRubber ? getRubberHealth(fhRubber) : null;
  const bhHealth = bhRubber ? getRubberHealth(bhRubber) : null;

  return (
    <header className="glass-panel" style={{
      margin: '12px 16px 0 16px',
      padding: '12px 20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '16px',
      position: 'sticky',
      top: '12px',
      zIndex: 40
    }}>
      {/* Brand & Active Racket */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{
          width: '42px',
          height: '42px',
          borderRadius: '12px',
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(16, 185, 129, 0.35)',
          color: '#ffffff',
          fontWeight: 800,
          fontSize: '1.2rem',
          letterSpacing: '-0.02em'
        }}>
          ST
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 800, fontSize: '1.1rem', letterSpacing: '-0.02em' }}>
              SpinTrack <span style={{ color: '#10b981' }}>SSTZ</span>
            </span>
            {sstzProfile ? (
              <span className="badge-pill badge-green" style={{ fontSize: '0.65rem', padding: '2px 8px' }}>
                <ShieldCheck size={12} /> SSTZ Overené
              </span>
            ) : (
              <span className="badge-pill badge-amber" style={{ fontSize: '0.65rem', padding: '2px 8px' }}>
                <AlertCircle size={12} /> SSTZ Neaktívne
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Raketa: <strong style={{ color: 'var(--text-main)' }}>{activeRacket?.name || 'Nevybraná'}</strong></span>
            {fhHealth && (
              <span style={{ color: fhHealth.percent < 40 ? '#f87171' : '#34d399', fontWeight: 600 }}>
                • FH: {fhHealth.percent}%
              </span>
            )}
            {bhHealth && (
              <span style={{ color: bhHealth.percent < 40 ? '#f87171' : '#34d399', fontWeight: 600 }}>
                • BH: {bhHealth.percent}%
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Center / Right controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Live Stopwatch Mini-bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(10, 13, 20, 0.65)',
          border: '1px solid var(--border-subtle)',
          padding: '6px 12px',
          borderRadius: 'var(--radius-full)'
        }}>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            fontSize: '0.95rem',
            color: isStopwatchRunning ? '#10b981' : 'var(--text-main)',
            minWidth: '50px',
            textAlign: 'center'
          }}>
            {formatTimer(stopwatchSeconds)}
          </span>

          {isStopwatchRunning ? (
            <button
              onClick={pauseStopwatch}
              title="Pozastaviť tréning"
              style={{
                background: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                color: '#f87171',
                borderRadius: '50%',
                width: '28px',
                height: '28px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <Pause size={14} />
            </button>
          ) : (
            <button
              onClick={startStopwatch}
              title="Spustiť stopky tréningu"
              style={{
                background: 'rgba(16, 185, 129, 0.2)',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                color: '#34d399',
                borderRadius: '50%',
                width: '28px',
                height: '28px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <Play size={14} style={{ marginLeft: '2px' }} />
            </button>
          )}

          {stopwatchSeconds > 0 && (
            <>
              <button
                onClick={() => saveStopwatchAsSession('tréning', 'Zaznamenaný tréning cez mini-stopky')}
                title="Uložiť do denníka"
                style={{
                  background: 'var(--accent-tt-green)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 'var(--radius-full)',
                  padding: '2px 8px',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Uložiť
              </button>
              <button
                onClick={resetStopwatch}
                title="Vynulovať"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-dim)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <RotateCcw size={13} />
              </button>
            </>
          )}
        </div>

        {/* Quick Log Action */}
        <button
          onClick={onOpenQuickLog}
          className="btn-primary"
          style={{ padding: '8px 14px', fontSize: '0.85rem' }}
        >
          + Tréning
        </button>

        {/* Settings Button */}
        <button
          onClick={onOpenSettings}
          title="Nastavenia a Záloha"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-muted)',
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'color 0.2s'
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--text-main)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
        >
          <Settings size={18} />
        </button>
      </div>
    </header>
  );
};
