import { useDialog } from '../hooks/useDialog';
import { TrainingQuickActions } from '../components/TrainingQuickActions';
import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useCommunity } from '../context/CommunityContext';
import { communityError } from './CommunityView';
import { ActivityCalendar, CalendarEvent } from '../components/ActivityCalendar';
import { AddActivityModal } from '../components/AddActivityModal';
import { calendarDate } from '../utils/calendar';
import { getDiaryEntries, normalizeDiaryDate } from '../utils/diary';
import './ActivityCalendar.css';
import { useApp } from '../context/AppContext';
import {
  Calendar as CalendarIcon,
  Clock,
  ExternalLink,
  Plus,
  Shield
} from 'lucide-react';
import { ActivityRecord, TeamScheduleMatch } from '../types';

export const CalendarView: React.FC = () => {
  const {
    activities,
    matches,
    doublesMatches,
    teamSchedule,
    sstzProfile,
    addScheduleMatchToMatches,
    activeRacket
  } = useApp();

  const account = useCommunity();
  const [calendarError, setCalendarError] = useState('');
  const [removing, setRemoving] = useState('');
  const [view, setView] = useState<'calendar' | 'schedule'>('calendar');
  const [selectedDate, setSelectedDate] = useState(() => calendarDate(new Date()));
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [editingActivity, setEditingActivity] = useState<ActivityRecord | null>(null);
  const [planning, setPlanning] = useState(false);
  const events = useMemo<CalendarEvent[]>(() => [
    ...getDiaryEntries(activities, matches, doublesMatches).map(entry => ({
      id: entry.id, date: entry.date, category: entry.category, title: entry.title,
      time: entry.activity?.startTime, location: entry.activity?.location,
      duration: entry.activity?.durationMinutes,
      detail: entry.activity ? [entry.activity.leagueName, entry.activity.round, entry.activity.eventCategory].filter(Boolean).join(' · ') : entry.subtitle,
      planned: entry.activity?.planned,
      actionLabel: entry.activity ? 'Upraviť aktivitu' : undefined,
    })),
    ...teamSchedule.map(match => ({
      id: `fixture-${match.id}`, date: normalizeDiaryDate(match.dateTime), category: 'liga' as const,
      title: `${match.homeTeam} – ${match.awayTeam}`,
      time: match.dateTime.match(/(\d{1,2}:\d{2})/)?.[1],
      detail: `${match.round}${match.isPlayed ? ` · ${match.homeScore}:${match.awayScore}` : ''}`,
      planned: !match.isPlayed, actionLabel: 'Zapísať výsledok',
    })),
    ...account.calendar.map(entry => ({
      id: `invitation-${entry.id}`, date: normalizeDiaryDate(entry.data.date),
      category: entry.data.category, title: entry.data.title || entry.data.opponentName || 'Spoločná aktivita',
      time: entry.data.startTime, location: entry.data.location, duration: entry.data.durationMinutes,
      detail: `S ${entry.data.authorName}`, planned: entry.data.date > calendarDate(new Date()),
      actionLabel: 'Odobrať z kalendára',
    })),
  ], [activities, matches, doublesMatches, teamSchedule, account.calendar]);
  const openActivity = (planned = selectedDate > calendarDate(new Date())) => {
    setEditingActivity(null);
    setPlanning(planned);
    setShowActivityModal(true);
  };
  const [filterType, setFilterType] = useState<'all' | 'upcoming' | 'played' | 'home' | 'away'>('all');
  const [selectedMatch, setSelectedMatch] = useState<TeamScheduleMatch | null>(null);

  // Quick log match modal
  const [showLogModal, setShowLogModal] = useState(false);
  const [matchOutcome, setMatchOutcome] = useState<'WIN' | 'LOSS'>('WIN');
  const [matchScore, setMatchScore] = useState('3:1');

  // Keep the fixture list chronological even when the upstream order changes.
  const orderedSchedule = [...teamSchedule].sort((a, b) => normalizeDiaryDate(a.dateTime).localeCompare(normalizeDiaryDate(b.dateTime)));
  const filteredSchedule = orderedSchedule.filter(m => {
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

  const dialogRef = useDialog(showLogModal && !!selectedMatch, () => { setShowLogModal(false); });

  // Next upcoming match
  const nextMatch = orderedSchedule.find(m => !m.isPlayed);

  return (
    <div className="page-view calendar-view animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      <TrainingQuickActions />
      <header className="calendar-page-heading">
        <div><span className="calendar-eyebrow">TRÉNINGY · ZÁPASY · ZÁŽITKY</span><h1>Tvoj kalendár</h1><p>Celý športový program na jednom mieste.</p></div>
        <button type="button" className="btn-primary" onClick={() => openActivity(true)}><Plus size={18} /> Naplánovať aktivitu</button>
      </header>
      <div className="calendar-view-tabs" role="group" aria-label="Zobrazenie kalendára">
        <button type="button" aria-pressed={view === 'calendar'} onClick={() => setView('calendar')}><CalendarIcon size={17} /> Mesačný kalendár</button>
        <button type="button" aria-pressed={view === 'schedule'} onClick={() => setView('schedule')}><Shield size={17} /> Rozpis zápasov <span>{teamSchedule.length}</span></button>
      </div>
      {calendarError && <p role="alert" className="community-error">{calendarError}</p>}
      {view === 'calendar' && <ActivityCalendar events={events} selectedDate={selectedDate} onSelectDate={setSelectedDate}
        onAdd={() => openActivity()} busy={Boolean(removing)} onAction={async event => {
          if (event.id.startsWith('activity-')) {
            const activity = activities.find(activity => `activity-${activity.id}` === event.id);
            if (activity) { setEditingActivity(activity); setShowActivityModal(true); }
          } else if (event.id.startsWith('fixture-')) {
            const match = teamSchedule.find(match => `fixture-${match.id}` === event.id);
            if (match) handleOpenLogModal(match);
          } else if (event.id.startsWith('invitation-')) {
            setRemoving(event.id); setCalendarError('');
            try { await account.removeCalendarEntry(event.id.slice('invitation-'.length)); }
            catch (error) { setCalendarError(communityError(error)); }
            finally { setRemoving(''); }
          }
        }} />}
      <AddActivityModal isOpen={showActivityModal} editActivity={editingActivity} defaultDate={selectedDate}
        defaultPlanned={planning} onClose={() => { setShowActivityModal(false); setEditingActivity(null); }} />
      {view === 'schedule' && <>
      <h2>Ligový rozpis SSTZ</h2>
      {/* Highlight: Next Upcoming Fixture */}
      {nextMatch && (
        <div className="glass-panel" style={{
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, var(--bg-card) 100%)',
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
                color: 'var(--accent-tt-green)',
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
                  {nextMatch.homeTeam} <span style={{ color: 'var(--accent-tt-blue)' }}>vs</span> {nextMatch.awayTeam}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ textAlign: 'right', fontSize: '0.82rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                Termín:<br />
                <strong style={{ color: 'var(--accent-tt-green)', fontSize: '0.95rem' }}>{nextMatch.dateTime}</strong>
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
        <div className="scroll-tabs" style={{ display: 'flex', gap: '8px', overflowX: 'auto' }}>
          {[
            { id: 'all', label: `Všetky (${teamSchedule.length})` },
            { id: 'upcoming', label: `Nadchádzajúce (${teamSchedule.filter(m => !m.isPlayed).length})` },
            { id: 'played', label: `Odohrané (${teamSchedule.filter(m => m.isPlayed).length})` },
            { id: 'home', label: 'Doma' },
            { id: 'away', label: 'Vonku' }
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
                className="glass-panel fixture-row"
                style={{
                  padding: '16px 20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '16px',
                  borderLeft: m.isPlayed ? '4px solid var(--accent-tt-green)' : '4px solid #3b82f6'
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
                <div className="fixture-teams" style={{
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
                    background: m.isPlayed ? 'rgba(16, 185, 129, 0.15)' : 'var(--surface-tint)',
                    border: `1px solid ${m.isPlayed ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-subtle)'}`,
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 800,
                    fontSize: '1.2rem',
                    color: m.isPlayed ? 'var(--accent-tt-green)' : 'var(--text-dim)',
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

      </>}

      {/* Modal: Zaznamenať do denníka */}
      {showLogModal && selectedMatch && createPortal(
        <div
          className="mobile-sheet-container"
          onClick={() => setShowLogModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '20px',
            boxSizing: 'border-box'
          }}
        >
          <div
            className="glass-panel mobile-sheet-content"
            ref={dialogRef} role="dialog" aria-modal="true" aria-label="Zapísať ligový duel" tabIndex={-1}
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '480px',
              width: '100%',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              boxSizing: 'border-box',
              margin: 'auto'
            }}
          >
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
                  style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-main)' }}
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
                  style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-main)' }}
                />
              </div>

              <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', background: 'var(--bg-secondary)', padding: '10px', borderRadius: 'var(--radius-sm)' }}>
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
        </div>,
        document.body
      )}

    </div>
  );
};
