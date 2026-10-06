import React from 'react';
import { useApp } from '../context/AppContext';
import { PwaInstallPrompt } from './PwaInstallPrompt';
import { Play, Pause, RotateCcw, ShieldCheck, AlertCircle, Settings } from 'lucide-react';

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
    sstzProfile
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
    <header className="glass-panel app-header" style={{
      margin: '8px 12px 0 12px',
      padding: '10px 16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '12px',
      position: 'sticky',
      top: '8px',
      zIndex: 40,
      flexWrap: 'wrap'
    }}>
      {/* Brand & Active Racket */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{
          width: '38px',
          height: '38px',
          borderRadius: '11px',
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(16, 185, 129, 0.35)',
          color: '#ffffff',
          fontWeight: 800,
          fontSize: '1.1rem',
          letterSpacing: '-0.02em',
          flexShrink: 0
        }}>
          ST
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontWeight: 800, fontSize: '1.05rem', letterSpacing: '-0.02em' }}>
              SpinTrack <span style={{ color: '#10b981' }}>SSTZ</span>
            </span>
            {sstzProfile ? (
              <span className="badge-pill badge-green d-none-xs" style={{ fontSize: '0.62rem', padding: '1px 6px' }}>
                <ShieldCheck size={11} /> Overené
              </span>
            ) : (
              <span className="badge-pill badge-amber d-none-xs" style={{ fontSize: '0.62rem', padding: '1px 6px' }}>
                <AlertCircle size={11} /> Offline
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {activeRacket?.name || 'Raketa'}
            </span>
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'nowrap' }}>
        {/* PWA Download / Install Button */}
        <PwaInstallPrompt compact />

        {/* Live Stopwatch Mini-bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: 'rgba(10, 13, 20, 0.65)',
          border: '1px solid var(--border-subtle)',
          padding: '5px 10px',
          borderRadius: 'var(--radius-full)'
        }}>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            fontSize: '0.88rem',
            color: isStopwatchRunning ? '#10b981' : 'var(--text-main)',
            minWidth: '42px',
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
                width: '26px',
                height: '26px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <Pause size={13} />
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
                width: '26px',
                height: '26px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <Play size={13} style={{ marginLeft: '1px' }} />
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
                  padding: '2px 7px',
                  fontSize: '0.65rem',
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
                <RotateCcw size={12} />
              </button>
            </>
          )}
        </div>

        {/* Quick Log Action (Visible on medium+ screens, icon on xs) */}
        <button
          onClick={onOpenQuickLog}
          className="btn-primary d-none-xs"
          style={{ padding: '7px 12px', fontSize: '0.8rem' }}
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
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'color 0.2s',
            flexShrink: 0
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--text-main)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
        >
          <Settings size={17} />
        </button>
      </div>
    </header>
  );
};
