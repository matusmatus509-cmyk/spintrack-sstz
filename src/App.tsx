import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { AppTopBar } from './components/AppTopBar';
import { Navigation, NavTab } from './components/Navigation';
import { DashboardView } from './views/DashboardView';
import { SstzHubView } from './views/SstzHubView';
import { OpponentsView } from './views/OpponentsView';
import { EquipmentView } from './views/EquipmentView';
import { CalendarView } from './views/CalendarView';
import { DiaryView } from './views/DiaryView';
import { StatsView } from './views/StatsView';
import { SettingsModal } from './components/SettingsModal';

const AppContent: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Quick training log modal state
  const [showQuickLog, setShowQuickLog] = useState(false);
  const [logMinutes, setLogMinutes] = useState(60);
  const [logDrills, setLogDrills] = useState('Topspin, Príjem');
  const [logLocation, setLogLocation] = useState('Klubová herňa');
  const { addTrainingSession, activeRacket } = useApp();

  // Quick match modal state
  const [showQuickMatch, setShowQuickMatch] = useState(false);
  const [matchOpponent, setMatchOpponent] = useState('');
  const [matchResult, setMatchResult] = useState<'WIN' | 'LOSS'>('WIN');
  const [matchScore, setMatchScore] = useState('3:1');
  const { addMatch } = useApp();

  const handleSaveQuickLog = (e: React.FormEvent) => {
    e.preventDefault();
    addTrainingSession({
      date: new Date().toISOString(),
      durationMinutes: Number(logMinutes),
      type: 'tréning',
      focusDrills: logDrills.split(',').map(s => s.trim()).filter(Boolean),
      racketId: activeRacket?.id,
      intensity: 4,
      location: logLocation,
      notes: 'Rýchly záznam tréningu'
    });
    setShowQuickLog(false);
  };

  const handleSaveQuickMatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!matchOpponent) return;
    addMatch({
      date: new Date().toISOString().split('T')[0],
      competition: 'Priateľský zápas',
      opponentName: matchOpponent,
      result: matchResult,
      score: matchScore,
      sets: [],
      racketId: activeRacket?.id,
      notes: 'Rýchly záznam zápasu'
    });
    setShowQuickMatch(false);
    setMatchOpponent('');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Sleek Minimal App Top Bar */}
      <AppTopBar onOpenSettings={() => setIsSettingsOpen(true)} />

      {/* Main Container */}
      <div className="app-container">
        {/* Navigation (Sidebar desktop + bottom mobile) */}
        <Navigation
          currentTab={currentTab}
          onSelectTab={tab => setCurrentTab(tab)}
        />

        {/* Dynamic View Content */}
        <main className="main-content">
          {currentTab === 'dashboard' && (
            <DashboardView
              onNavigate={tab => setCurrentTab(tab)}
              onOpenQuickLog={() => setShowQuickLog(true)}
              onOpenMatchModal={() => setShowQuickMatch(true)}
            />
          )}

          {currentTab === 'sstz' && <SstzHubView />}

          {currentTab === 'opponents' && <OpponentsView />}

          {currentTab === 'equipment' && <EquipmentView />}

          {currentTab === 'calendar' && <CalendarView />}

          {currentTab === 'diary' && <DiaryView />}

          {currentTab === 'stats' && <StatsView />}
        </main>
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* Quick Log Modal */}
      {showQuickLog && (
        <div
          className="mobile-sheet-container"
          style={{
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
            zIndex: 150,
            padding: '20px'
          }}
        >
          <div className="glass-panel mobile-sheet-content" style={{ maxWidth: '440px', width: '100%', padding: '24px' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '14px' }}>
              Rýchly záznam tréningu
            </h3>
            <form onSubmit={handleSaveQuickLog} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Dĺžka v minútach</label>
                <input
                  type="number"
                  required
                  min="5"
                  max="300"
                  value={logMinutes}
                  onChange={e => setLogMinutes(Number(e.target.value))}
                  style={{ width: '100%', padding: '8px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: '#fff' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Cvičenia</label>
                <input
                  type="text"
                  value={logDrills}
                  onChange={e => setLogDrills(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: '#fff' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Miesto</label>
                <input
                  type="text"
                  value={logLocation}
                  onChange={e => setLogLocation(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: '#fff' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button type="button" onClick={() => setShowQuickLog(false)} className="btn-secondary">
                  Zrušiť
                </button>
                <button type="submit" className="btn-primary">
                  Uložiť
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Match Modal */}
      {showQuickMatch && (
        <div
          className="mobile-sheet-container"
          style={{
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
            zIndex: 150,
            padding: '20px'
          }}
        >
          <div className="glass-panel mobile-sheet-content" style={{ maxWidth: '440px', width: '100%', padding: '24px' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '14px' }}>
              Rýchly záznam zápasu
            </h3>
            <form onSubmit={handleSaveQuickMatch} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Súper</label>
                <input
                  type="text"
                  required
                  placeholder="Meno súpera"
                  value={matchOpponent}
                  onChange={e => setMatchOpponent(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: '#fff' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Výsledok</label>
                  <select
                    value={matchResult}
                    onChange={e => setMatchResult(e.target.value as any)}
                    style={{ width: '100%', padding: '8px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: '#fff' }}
                  >
                    <option value="WIN">VÝHRA</option>
                    <option value="LOSS">PREHRA</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Skóre</label>
                  <input
                    type="text"
                    value={matchScore}
                    onChange={e => setMatchScore(e.target.value)}
                    style={{ width: '100%', padding: '8px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: '#fff' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button type="button" onClick={() => setShowQuickMatch(false)} className="btn-secondary">
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

export const App: React.FC = () => {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
};
