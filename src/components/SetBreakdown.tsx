import React from 'react';
import { SetDetail } from '../types';

interface SetBreakdownProps {
  sets: string[];
  setDetails?: SetDetail[];
  totalPointsWon?: number;
  totalPointsLost?: number;
  result: 'WIN' | 'LOSS';
  compact?: boolean;
}

export const SetBreakdown: React.FC<SetBreakdownProps> = ({
  sets,
  setDetails,
  totalPointsWon,
  totalPointsLost,
  result,
  compact = false
}) => {
  // If setDetails exist, use them; otherwise parse from sets string
  const details = setDetails && setDetails.length > 0
    ? setDetails
    : sets.map((s, idx) => {
        const clean = s.trim();
        if (clean.includes(':')) {
          const [p1, p2] = clean.split(':').map(n => parseInt(n.trim(), 10));
          return {
            setNumber: idx + 1,
            playerPoints: isNaN(p1) ? 11 : p1,
            opponentPoints: isNaN(p2) ? 9 : p2,
            display: clean,
            won: p1 > p2
          };
        }
        const sign = clean.startsWith('+') ? '+' : (clean.startsWith('-') ? '-' : (result === 'WIN' ? '+' : '-'));
        const num = parseInt(clean.replace(/[^0-9]/g, ''), 10);
        if (isNaN(num)) {
          return { setNumber: idx + 1, playerPoints: 11, opponentPoints: 9, display: clean, won: result === 'WIN' };
        }
        if (sign === '+') {
          const opp = num;
          const ply = num >= 10 ? num + 2 : 11;
          return { setNumber: idx + 1, playerPoints: ply, opponentPoints: opp, display: `${ply}:${opp}`, won: true };
        } else {
          const ply = num;
          const opp = num >= 10 ? num + 2 : 11;
          return { setNumber: idx + 1, playerPoints: ply, opponentPoints: opp, display: `${ply}:${opp}`, won: false };
        }
      });

  const ptsWon = totalPointsWon || details.reduce((acc, d) => acc + d.playerPoints, 0);
  const ptsLost = totalPointsLost || details.reduce((acc, d) => acc + d.opponentPoints, 0);
  const ptDiff = ptsWon - ptsLost;

  if (details.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
      {/* Set Pills Row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
        {details.map((set, idx) => (
          <div
            key={idx}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: compact ? '2px 6px' : '3px 8px',
              borderRadius: '6px',
              background: set.won ? 'rgba(16, 185, 129, 0.16)' : 'rgba(239, 68, 68, 0.16)',
              border: `1px solid ${set.won ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)'}`,
              fontSize: compact ? '0.72rem' : '0.78rem',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700
            }}
          >
            <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)', fontWeight: 500 }}>
              S{set.setNumber}:
            </span>
            <span style={{ color: set.won ? '#34d399' : '#f87171' }}>
              {set.display}
            </span>
          </div>
        ))}

        {/* Total Points Pill */}
        {ptsWon > 0 && (
          <div
            style={{
              padding: compact ? '2px 6px' : '3px 8px',
              borderRadius: '6px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-subtle)',
              fontSize: compact ? '0.7rem' : '0.75rem',
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-muted)'
            }}
          >
            Body: <strong>{ptsWon}:{ptsLost}</strong>{' '}
            <span style={{ color: ptDiff >= 0 ? '#34d399' : '#f87171', fontWeight: 700 }}>
              ({ptDiff >= 0 ? `+${ptDiff}` : ptDiff})
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
