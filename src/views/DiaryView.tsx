import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { TrainingSession, MatchRecord, SetDetail } from '../types';
import { SetBreakdown } from '../components/SetBreakdown';
import {
  BookOpen,
  Play,
  Pause,
  RotateCcw,
  Plus,
  Trash2,
  Trophy,
  Clock,
  MapPin,
  CheckCircle,
  Flame,
  Tag,
  Filter,
  Activity,
  Award,
  ChevronRight
} from 'lucide-react';

export const DiaryView: React.FC = () => {
  const {
    trainingSessions,
    addTrainingSession,
    deleteTrainingSession,
    matches,
    addMatch,
    deleteMatch,
    activeRacket,
    isStopwatchRunning,
    stopwatchSeconds,
    startStopwatch,
    pauseStopwatch,
    resetStopwatch,
    saveStopwatchAsSession
  } = useApp();

  const [activeDiaryTab, setActiveDiaryTab] = useState<'matches' | 'sessions'>('matches');

  // Manual Session Modal
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [sessionForm, setSessionForm] = useState({
    durationMinutes: 60,
    type: 'tréning' as TrainingSession['type'],
    focusDrills: 'Topspin z behu, Príjem servisu krátko, Podania',
    location: 'Klubová herňa',
    intensity: 4,
    notes: ''
  });

  // Manual Match Modal
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [matchForm, setMatchForm] = useState({
    date: new Date().toISOString().split('T')[0],
    competition: 'Priateľský zápas' as MatchRecord['competition'],
    opponentName: '',
    result: 'WIN' as 'WIN' | 'LOSS',
    score: '3:1',
    sets: '11:8, 9:11, 11:7, 11:6',
    notes: ''
  });

  // Match filter
  const [matchFilter, setMatchFilter] = useState<'all' | 'wins' | 'losses' | 'sstz'>('all');

  const formatTimer = (totalSecs: number) => {
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCreateSession = (e: React.FormEvent) => {
    e.preventDefault();
    const drills = sessionForm.focusDrills.split(',').map(d => d.trim()).filter(Boolean);

    addTrainingSession({
      date: new Date().toISOString(),
      durationMinutes: Number(sessionForm.durationMinutes),
      type: sessionForm.type,
      focusDrills: drills,
      racketId: activeRacket?.id,
      intensity: Number(sessionForm.intensity),
      location: sessionForm.location,
      notes: sessionForm.notes
    });

    setShowSessionModal(false);
  };

  const handleCreateMatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!matchForm.opponentName) return;

    const rawSets = matchForm.sets.split(',').map(s => s.trim()).filter(Boolean);
    let ptsWon = 0;
    let ptsLost = 0;

    const parsedDetails: SetDetail[] = rawSets.map((s, idx) => {
      let p1 = 11;
      let p2 = 9;
      if (s.includes(':')) {
        const parts = s.split(':').map(n => parseInt(n.trim(), 10));
        p1 = isNaN(parts[0]) ? 11 : parts[0];
        p2 = isNaN(parts[1]) ? 9 : parts[1];
      }
      ptsWon += p1;
      ptsLost += p2;
      return {
        setNumber: idx + 1,
        playerPoints: p1,
        opponentPoints: p2,
        display: `${p1}:${p2}`,
        won: p1 > p2
      };
    });

    addMatch({
      date: matchForm.date,
      competition: matchForm.competition,
      opponentName: matchForm.opponentName,
      result: matchForm.result,
      score: matchForm.score,
      sets: rawSets,
      setDetails: parsedDetails,
      totalPointsWon: ptsWon,
      totalPointsLost: ptsLost,
      racketId: activeRacket?.id,
      notes: matchForm.notes,
      source: 'manual'
    });

    setShowMatchModal(false);
    setMatchForm({
      date: new Date().toISOString().split('T')[0],
      competition: 'Priateľský zápas',
      opponentName: '',
      result: 'WIN',
      score: '3:1',
      sets: '11:8, 9:11, 11:7, 11:6',
      notes: ''
    });
  };

  const filteredMatches = matches.filter(m => {
    if (matchFilter === 'wins') return m.result === 'WIN';
    if (matchFilter === 'losses') return m.result === 'LOSS';
    if (matchFilter === 'sstz') return m.source === 'SSTZ';
    return true;
  });

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Top Stopwatch Card - Native Mobile App Feel */}
      <div className="glass-panel" style={{
        padding: '24px 20px',
        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(18, 24, 36, 0.95) 100%)',
        border: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '14px',
        textAlign: 'center',
        borderRadius: 'var(--radius-lg)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="badge-pill badge-green" style={{ fontSize: '0.72rem' }}>
            <Clock size={13} /> Live Tréningové Stopky
          </span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Raketa: <strong style={{ color: '#fff' }}>{activeRacket?.name}</strong>
          </span>
        </div>

        {/* Big Digit Timer Display */}
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '3.6rem',
          fontWeight: 800,
          letterSpacing: '-0.03em',
          color: isStopwatchRunning ? '#10b981' : '#f8fafc',
          textShadow: isStopwatchRunning ? '0 0 25px rgba(16, 185, 129, 0.45)' : 'none',
          lineHeight: 1
        }}>
          {formatTimer(stopwatchSeconds)}
        </div>

        {/* Button Controls */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
          {isStopwatchRunning ? (
            <button
              onClick={pauseStopwatch}
              className="btn-danger"
              style={{ padding: '12px 24px', fontSize: '0.95rem', borderRadius: 'var(--radius-full)' }}
            >
              <Pause size={18} /> Pozastaviť
            </button>
          ) : (
            <button
              onClick={startStopwatch}
              className="btn-primary"
              style={{ padding: '12px 28px', fontSize: '0.95rem', borderRadius: 'var(--radius-full)' }}
            >
              <Play size={18} /> {stopwatchSeconds > 0 ? 'Pokračovať' : 'Spustiť tréning'}
            </button>
          )}

          {stopwatchSeconds > 0 && (
            <>
              <button
                onClick={() => saveStopwatchAsSession('tréning', 'Zaznamenané cez live stopky')}
                className="btn-primary"
                style={{
                  padding: '12px 20px',
                  fontSize: '0.9rem',
                  borderRadius: 'var(--radius-full)',
                  background: 'linear-gradient(135deg, #0ea5e9, #0284c7)'
                }}
              >
                <CheckCircle size={17} /> Uložiť tréning
              </button>

              <button
                onClick={resetStopwatch}
                className="btn-secondary"
                style={{ padding: '12px 16px', borderRadius: 'var(--radius-full)' }}
                title="Vynulovať"
              >
                <RotateCcw size={16} />
              </button>
            </>
          )}
        </div>

        <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
          ⏱️ Čas sa automaticky zapisuje do poťahov na aktívnej rakete pre presný výpočet ich opotrebovania.
        </span>
      </div>

      {/* Tabs & Quick Add Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setActiveDiaryTab('matches')}
            style={{
              padding: '10px 18px',
              borderRadius: 'var(--radius-full)',
              border: 'none',
              background: activeDiaryTab === 'matches' ? 'rgba(16, 185, 129, 0.2)' : 'var(--bg-card)',
              color: activeDiaryTab === 'matches' ? '#34d399' : 'var(--text-muted)',
              borderBottom: activeDiaryTab === 'matches' ? '2px solid #10b981' : '1px solid var(--border-subtle)',
              fontWeight: 700,
              fontSize: '0.88rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Trophy size={16} /> Zápasy & Sety ({matches.length})
          </button>

          <button
            onClick={() => setActiveDiaryTab('sessions')}
            style={{
              padding: '10px 18px',
              borderRadius: 'var(--radius-full)',
              border: 'none',
              background: activeDiaryTab === 'sessions' ? 'rgba(14, 165, 233, 0.2)' : 'var(--bg-card)',
              color: activeDiaryTab === 'sessions' ? '#38bdf8' : 'var(--text-muted)',
              borderBottom: activeDiaryTab === 'sessions' ? '2px solid #0ea5e9' : '1px solid var(--border-subtle)',
              fontWeight: 700,
              fontSize: '0.88rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Clock size={16} /> Tréningy ({trainingSessions.length})
          </button>
        </div>

        <div>
          {activeDiaryTab === 'matches' ? (
            <button
              onClick={() => setShowMatchModal(true)}
              className="btn-primary"
              style={{ fontSize: '0.85rem', padding: '8px 14px' }}
            >
              <Plus size={16} /> Zaznamenať zápas
            </button>
          ) : (
            <button
              onClick={() => setShowSessionModal(true)}
              className="btn-primary"
              style={{ fontSize: '0.85rem', padding: '8px 14px' }}
            >
              <Plus size={16} /> Pridať tréning
            </button>
          )}
        </div>
      </div>

      {/* MATCHES VIEW */}
      {activeDiaryTab === 'matches' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Mobile Filter Chips */}
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
            {[
              { id: 'all', label: `Všetky (${matches.length})` },
              { id: 'wins', label: `Výhry (${matches.filter(m => m.result === 'WIN').length})` },
              { id: 'losses', label: `Prehry (${matches.filter(m => m.result === 'LOSS').length})` },
              { id: 'sstz', label: `SSTZ Liga (${matches.filter(m => m.source === 'SSTZ').length})` },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setMatchFilter(f.id as any)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-full)',
                  border: '1px solid',
                  borderColor: matchFilter === f.id ? '#10b981' : 'var(--border-subtle)',
                  background: matchFilter === f.id ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-card)',
                  color: matchFilter === f.id ? '#34d399' : 'var(--text-muted)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Matches List with Full Set Points */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filteredMatches.map(m => {
              const isWin = m.result === 'WIN';
              return (
                <div
                  key={m.id}
                  className="glass-panel"
                  style={{
                    padding: '16px 18px',
                    borderRadius: 'var(--radius-md)',
                    borderLeft: isWin ? '4px solid #10b981' : '4px solid #ef4444',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}
                >
                  {/* Top Match Info Row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '12px',
                        background: isWin ? 'rgba(16, 185, 129, 0.18)' : 'rgba(239, 68, 68, 0.18)',
                        color: isWin ? '#34d399' : '#f87171',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: '1rem',
                        flexShrink: 0
                      }}>
                        <Trophy size={20} />
                      </div>

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <h4 style={{ fontSize: '1.05rem', fontWeight: 800 }}>vs {m.opponentName}</h4>
                          <span className={`badge-pill ${isWin ? 'badge-green' : 'badge-red'}`} style={{ fontSize: '0.65rem' }}>
                            {isWin ? 'VÝHRA' : 'PREHRA'}
                          </span>
                          {m.source === 'SSTZ' && (
                            <span className="badge-pill badge-blue" style={{ fontSize: '0.65rem' }}>
                              SSTZ Overené
                            </span>
                          )}
                        </div>

                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                          <span>{m.date}</span>
                          <span>• {m.competition} {m.round && `(${m.round})`}</span>
                          {m.teamHome && m.teamAway && (
                            <span style={{ color: 'var(--text-dim)' }}>
                              • {m.teamHome} vs {m.teamAway}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Score on right */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '1.4rem',
                        fontWeight: 800,
                        color: isWin ? '#34d399' : '#f87171',
                        textAlign: 'right'
                      }}>
                        {m.score}
                      </div>

                      <button
                        onClick={() => deleteMatch(m.id)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-dim)',
                          cursor: 'pointer',
                          padding: '4px'
                        }}
                        onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-dim)'}
                        title="Zmazať"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Set-by-Set Detailed Points Breakdown */}
                  <div style={{
                    background: 'var(--bg-card)',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)'
                  }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Body a jednotlivé sety
                    </span>
                    <SetBreakdown
                      sets={m.sets || []}
                      setDetails={m.setDetails}
                      totalPointsWon={m.totalPointsWon}
                      totalPointsLost={m.totalPointsLost}
                      result={m.result}
                    />
                  </div>

                  {m.notes && (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontStyle: 'italic', margin: 0 }}>
                      "{m.notes}"
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SESSIONS VIEW */}
      {activeDiaryTab === 'sessions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {trainingSessions.map(session => (
            <div
              key={session.id}
              className="glass-panel"
              style={{
                padding: '16px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '16px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '12px',
                  background: 'rgba(14, 165, 233, 0.18)',
                  color: '#38bdf8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Clock size={20} />
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <strong style={{ fontSize: '1rem', textTransform: 'capitalize' }}>
                      {session.type} ({session.durationMinutes} minút)
                    </strong>
                    <span className="badge-pill badge-green" style={{ fontSize: '0.65rem' }}>
                      Intenzita: {'★'.repeat(session.intensity || 4)}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
                    <span>{new Date(session.date).toLocaleDateString('sk-SK')}</span>
                    <span>• {session.location}</span>
                  </div>

                  {session.focusDrills.length > 0 && (
                    <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                      {session.focusDrills.map((drill, idx) => (
                        <span
                          key={idx}
                          style={{
                            fontSize: '0.72rem',
                            padding: '2px 8px',
                            background: 'rgba(255, 255, 255, 0.05)',
                            borderRadius: 'var(--radius-full)',
                            color: 'var(--text-dim)'
                          }}
                        >
                          #{drill}
                        </span>
                      ))}
                    </div>
                  )}

                  {session.notes && (
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                      "{session.notes}"
                    </p>
                  )}
                </div>
              </div>

              <button
                onClick={() => deleteTrainingSession(session.id)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-dim)',
                  cursor: 'pointer'
                }}
                onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-dim)'}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Pridať tréning */}
      {showSessionModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '20px'
        }}>
          <div className="glass-panel" style={{ maxWidth: '480px', width: '100%', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Zaznamenať tréningovú reláciu</h3>

            <form onSubmit={handleCreateSession} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Dĺžka v minútach</label>
                  <input
                    type="number"
                    min="5"
                    max="300"
                    required
                    value={sessionForm.durationMinutes}
                    onChange={e => setSessionForm({ ...sessionForm, durationMinutes: Number(e.target.value) })}
                    style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: '#fff' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Typ tréningu</label>
                  <select
                    value={sessionForm.type}
                    onChange={e => setSessionForm({ ...sessionForm, type: e.target.value as any })}
                    style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: '#fff' }}
                  >
                    <option value="tréning">Bežný tréning</option>
                    <option value="zápas">Tréningové zápasy</option>
                    <option value="multiball">Multiball zásobník</option>
                    <option value="podania">Nácvik podaní</option>
                    <option value="kondícia">Kondícia & nohy</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Cvičenia (čiarkou oddelené)</label>
                <input
                  type="text"
                  value={sessionForm.focusDrills}
                  onChange={e => setSessionForm({ ...sessionForm, focusDrills: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: '#fff' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Miesto</label>
                <input
                  type="text"
                  value={sessionForm.location}
                  onChange={e => setSessionForm({ ...sessionForm, location: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: '#fff' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Poznámky</label>
                <textarea
                  rows={3}
                  value={sessionForm.notes}
                  onChange={e => setSessionForm({ ...sessionForm, notes: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: '#fff' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button type="button" onClick={() => setShowSessionModal(false)} className="btn-secondary">
                  Zrušiť
                </button>
                <button type="submit" className="btn-primary">
                  Uložiť do denníka
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Pridať zápas */}
      {showMatchModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '20px'
        }}>
          <div className="glass-panel" style={{ maxWidth: '480px', width: '100%', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Zaznamenať výsledok zápasu</h3>

            <form onSubmit={handleCreateMatch} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Meno súpera</label>
                <input
                  type="text"
                  required
                  placeholder="napr. Martin Kováč"
                  value={matchForm.opponentName}
                  onChange={e => setMatchForm({ ...matchForm, opponentName: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: '#fff' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Výsledok</label>
                  <select
                    value={matchForm.result}
                    onChange={e => setMatchForm({ ...matchForm, result: e.target.value as any })}
                    style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: '#fff' }}
                  >
                    <option value="WIN">VÝHRA (Win)</option>
                    <option value="LOSS">PREHRA (Loss)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Skóre na sety</label>
                  <input
                    type="text"
                    placeholder="3:1 alebo 3:0"
                    value={matchForm.score}
                    onChange={e => setMatchForm({ ...matchForm, score: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: '#fff' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Presné body jednotlivých setov (oddelené čiarkou)</label>
                <input
                  type="text"
                  placeholder="napr. 11:8, 9:11, 11:7, 11:6"
                  value={matchForm.sets}
                  onChange={e => setMatchForm({ ...matchForm, sets: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: '#fff' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button type="button" onClick={() => setShowMatchModal(false)} className="btn-secondary">
                  Zrušiť
                </button>
                <button type="submit" className="btn-primary">
                  Uložiť zápas
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
