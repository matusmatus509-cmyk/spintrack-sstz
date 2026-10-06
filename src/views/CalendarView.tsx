import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  ExternalLink,
  Plus,
  CheckCircle2,
  Filter,
  Shield,
  Layers,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { TeamScheduleMatch } from '../types';

export const CalendarView: React.FC = () => {
  const {
    teamSchedule,
    sstzProfile,
    addScheduleMatchToMatches,
    activeRacket
  } = useApp();

  const [filterType, setFilterType] = useState<'all' | 'upcoming' | 'played' | 'home' | 'away'>('all');
  const [selectedMatch, setSelectedMatch] = useState<TeamScheduleMatch | null>(null);

  // Quick log match modal
  const [showLogModal, setShowLogModal] = useState(false);
  const [matchOutcome, setMatchOutcome] = useState<'WIN' | 'LOSS'>('WIN');
  const [matchScore, setMatchScore] = useState('3:1');

  // Filter matches
  const filteredSchedule = teamSchedule.filter(m => {
    if (filterType === 'upcoming') return !m.isPlayed;
    if (filterType === 'played') return m.isPlayed;
    if (filterType === 'home') {
      return sstzProfile?.clubName
        ? m.homeTeam.toLowerCase().includes(sstzProfile.clubName.toLowerCase())
        : true;
    }
    if (filterType === 'away') {
      return sstzProfile?.clubName
        ? m.awayTeam.toLowerCase().includes(sstzProfile.clubName.toLowerCase())
        : true;
    }
    return true;
  });

  const handleOpenLogModal = (match: TeamScheduleMatch) => {
    setSelectedMatch(match);
    setShowLogModal(true);
  };

  const handleSaveToDiary = () => {
    if (!selectedMatch) return;
    addScheduleMatchToMatches(selectedMatch, matchOutcome, matchScore);
    setShowLogModal(false);
    setSelectedMatch(null);
    alert('Zápas bol úspešne pridaný do tvojho denníka a pripočítal čas k aktívnej rakete!');
  };

  // Next upcoming match
  const nextMatch = teamSchedule.find(m => !m.isPlayed);

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* Top Compact Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="badge-pill badge-blue" style={{ fontSize: '0.68rem', padding: '1px 6px' }}>
              <CalendarIcon size={12} /> SSTZ Rozpis
            </span>
            {sstzProfile?.clubName && (
              <span className="badge-pill badge-green" style={{ fontSize: '0.68rem', padding: '1px 6px' }}>
                <Shield size={10} /> {sstzProfile.clubName}
              </span>
            )}
          </div>
          <h1 style={{ fontSize: '1.45rem', fontWeight: 800, letterSpacing: '-0.02em', marginTop: '2px', marginBottom: '0' }}>
            Kalendár & Rozpis Zápasov
          </h1>
        </div>

        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Zápasov: <strong style={{ color: '#38bdf8' }}>{teamSchedule.length}</strong>
        </span>
      </div>

      {/* Highlight: Next Upcoming Fixture */}
      {nextMatch && (
        <div className="glass-panel" style={{
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(18, 24, 36, 0.95) 100%)',
          borderRadius: 'var(--radius-lg)',
          padding: '16px',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#10b981',
                padding: '10px',
                borderRadius: '12px'
              }}>
                <Clock size={22} />
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                  Najbližší ligový duel ({nextMatch.round})
                </span>
                <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>
                  {nextMatch.homeTeam} <span style={{ color: '#38bdf8' }}>vs</span> {nextMatch.awayTeam}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ textAlign: 'right', fontSize: '0.82rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                Termín:<br />
                <strong style={{ color: '#34d399', fontSize: '0.95rem' }}>{nextMatch.dateTime}</strong>
              </div>

              <button
                onClick={() => handleOpenLogModal(nextMatch)}
                className="btn-primary"
                style={{ padding: '8px 14px', fontSize: '0.82rem' }}
              >
                + Zapísať do denníka
              </button>
              </div>
              </div>
              )}

              {/* Filter Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto' }}>
          {[
            { id: 'all', label: `Všetky zápasy (${teamSchedule.length})` },
            { id: 'upcoming', label: `Nadchádzajúce (${teamSchedule.filter(m => !m.isPlayed).length})` },
            { id: 'played', label: `Odohrané (${teamSchedule.filter(m => m.isPlayed).length})` },
            { id: 'home', label: 'Zápasy Doma' },
            { id: 'away', label: 'Zápasy Vonku' }
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilterType(f.id as any)}
              className={filterType === f.id ? 'btn-primary' : 'btn-secondary'}
              style={{ padding: '8px 14px', fontSize: '0.82rem', whiteSpace: 'nowrap' }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Match Cards List */}
      {filteredSchedule.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredSchedule.map(m => {
            return (
              <div
                key={m.id}
                className="glass-panel"
                style={{
                  padding: '16px 20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '16px',
                  borderLeft: m.isPlayed ? '4px solid #10b981' : '4px solid #3b82f6'
                }}
              >
                {/* Left: Round & Date */}
                <div style={{ minWidth: '160px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span className={`badge-pill ${m.isPlayed ? 'badge-green' : 'badge-blue'}`} style={{ fontSize: '0.65rem' }}>
                      {m.round || 'Kolo'}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: 600 }}>
                      #{m.id}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {m.dateTime}
                  </div>
                </div>

                {/* Center: Teams & Result */}
                <div style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '16px',
                  minWidth: '280px'
                }}>
                  <div style={{ flex: 1, textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-main)' }}>
                      {m.homeTeam}
                    </div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>DOMÁCI</span>
                  </div>

                  {/* Score box */}
                  <div style={{
                    padding: '6px 14px',
                    borderRadius: 'var(--radius-sm)',
                    background: m.isPlayed ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                    border: `1px solid ${m.isPlayed ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-subtle)'}`,
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 800,
                    fontSize: '1.2rem',
                    color: m.isPlayed ? '#34d399' : 'var(--text-dim)',
                    minWidth: '70px',
                    textAlign: 'center'
                  }}>
                    {m.isPlayed ? `${m.homeScore} : ${m.awayScore}` : 'VS'}
                  </div>

                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-main)' }}>
                      {m.awayTeam}
                    </div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>HOSTIA</span>
                  </div>
                </div>

                {/* Right: Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {m.protocolUrl && (
                    <a
                      href={m.protocolUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-secondary"
                      style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                      title="Zobraziť zápis o stretnutí na SSTZ"
                    >
                      Protokol <ExternalLink size={13} />
                    </a>
                  )}

                  <button
                    onClick={() => handleOpenLogModal(m)}
                    className="btn-primary"
                    style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                  >
                    + Zápis
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center' }}>
          <CalendarIcon size={40} color="var(--text-dim)" style={{ marginBottom: '12px' }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Žiadne zápasy v rozvrhu</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>
            Prejdi do sekcie <strong>SSTZ Hub</strong> a zvoľ svoju ligu a klub pre načítanie oficiálneho kalendára.
          </p>
        </div>
      )}

      {/* Modal: Zaznamenať do denníka */}
      {showLogModal && selectedMatch && (
        <div
          className="mobile-sheet-container"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '20px'
          }}
        >
          <div className="glass-panel mobile-sheet-content" style={{ maxWidth: '480px', width: '100%', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Zapísať ligový duel do denníka</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {selectedMatch.round} • {selectedMatch.homeTeam} vs {selectedMatch.awayTeam} ({selectedMatch.dateTime})
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Tvoj výsledok v zápase
                </label>
                <select
                  value={matchOutcome}
                  onChange={e => setMatchOutcome(e.target.value as any)}
                  style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: '#fff' }}
                >
                  <option value="WIN">VÝHRA (Win)</option>
                  <option value="LOSS">PREHRA (Loss)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Skóre na sety
                </label>
                <input
                  type="text"
                  value={matchScore}
                  onChange={e => setMatchScore(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: '#fff' }}
                />
              </div>

              <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', background: 'rgba(10, 13, 20, 0.4)', padding: '10px', borderRadius: 'var(--radius-sm)' }}>
                Zápas bude zapísaný pod aktívnu raketu: <strong>{activeRacket?.name}</strong>. Poťahy na rakete dostanú +30 minút herného času do výpočtu opotrebovania.
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button type="button" onClick={() => setShowLogModal(false)} className="btn-secondary">
                  Zrušiť
                </button>
                <button type="button" onClick={handleSaveToDiary} className="btn-primary">
                  Uložiť do denníka
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
