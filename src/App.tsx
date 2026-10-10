import React, { useState, useEffect } from 'react';
import type { ActivityCategory } from './types';
import { AppProvider } from './context/AppContext';
import { AppTopBar } from './components/AppTopBar';
import { Navigation, NavTab } from './components/Navigation';
import { DashboardView } from './views/DashboardView';
import { TournamentsView } from './views/TournamentsView';
import { SstzHubView } from './views/SstzHubView';
import { OpponentsView } from './views/OpponentsView';
import { EquipmentView } from './views/EquipmentView';
import { CalendarView } from './views/CalendarView';
import { DiaryView } from './views/DiaryView';
import { MatchInsightsView } from './views/MatchInsightsView';
import { StatsView } from './views/StatsView';
import { SettingsModal } from './components/SettingsModal';
import { SyncStatus } from './components/SyncStatus';
import { AddActivityModal } from './components/AddActivityModal';
import { CommunityProvider, useCommunity } from './context/CommunityContext';
import { CommunityView } from './views/CommunityView';
import './views/Community.css';

const AppContent: React.FC = () => {
  const community = useCommunity();
  const [diaryCategory, setDiaryCategory] = useState<'all' | ActivityCategory>('all');
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showAddActivity, setShowAddActivity] = useState(false);

  const selectTab = (tab: NavTab, category: 'all' | ActivityCategory = 'all') => {
    setDiaryCategory(category);
    setCurrentTab(tab);
    window.scrollTo({ top: 0, behavior: 'auto' });
    requestAnimationFrame(() => document.getElementById('main-content')?.focus({ preventScroll: true }));
  };

  useEffect(() => { if (community.recovering) setCurrentTab('community'); }, [community.recovering]);
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Prejsť na obsah</a>
      {/* Sleek Minimal App Top Bar */}
      <AppTopBar onOpenSettings={() => setIsSettingsOpen(true)} onOpenCommunity={() => selectTab('community')} />

      {/* Main Container */}
      <div className="app-container">
        {/* Navigation (Sidebar desktop + bottom mobile) */}
        <Navigation
          currentTab={currentTab}
          onSelectTab={selectTab}
        />

        {/* Dynamic View Content */}
        <main id="main-content" className="main-content" tabIndex={-1}>
          {currentTab === 'dashboard' && (
            <DashboardView
              onNavigate={selectTab}
              onOpenQuickLog={() => setShowAddActivity(true)}
              onOpenMatchModal={() => setShowAddActivity(true)}
            />
          )}

          {currentTab === 'tournaments' && <TournamentsView />}

          {currentTab === 'sstz' && <SstzHubView />}

          {currentTab === 'opponents' && <OpponentsView />}

          {currentTab === 'equipment' && <EquipmentView />}

          {currentTab === 'calendar' && <CalendarView />}

          {currentTab === 'diary' && <DiaryView key={diaryCategory} initialCategory={diaryCategory} />}

          {(currentTab === 'performance' || currentTab === 'matches') && <MatchInsightsView key={currentTab} mode={currentTab} onNavigate={selectTab} />}

          {currentTab === 'stats' && <StatsView />}
          {currentTab === 'community' && <CommunityView onNavigate={selectTab} />}
        </main>
      </div>

      <SyncStatus />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* Unified Add Activity Modal */}
      <AddActivityModal
        isOpen={showAddActivity}
        onClose={() => setShowAddActivity(false)}
      />
    </div>
  );
};

function AccountWorkspace() {
  const account = useCommunity();
  if (account.authLoading || (account.user && !account.dataReady)) {
    return <div className="account-loading" role="status">
      <h1>SpinTrack</h1>
      <p>{account.accountError || "Načítavam tvoj účet…"}</p>
      {account.accountError && <div className="community-actions">
        <button className="btn-primary" onClick={account.retryAccount}>Skúsiť znova</button>
        <button className="btn-secondary" onClick={() => { void account.logout().catch(() => {}); }}>Odhlásiť sa</button>
      </div>}
    </div>;
  }
  return <AppProvider key={account.user?.id || 'guest'}
    storageKey={account.user ? `spintrack_account_${account.user.id}` : undefined}
    initialData={account.user ? account.initialData : undefined}
    onPersist={account.user ? account.saveAccountData : undefined}
    beforeDeleteActivity={account.user ? account.unshareOwnActivity : undefined}
    beforeReset={account.user ? account.unshareAllActivities : undefined}>
      <AppContent />
    </AppProvider>;
}
export const App: React.FC = () => <CommunityProvider><AccountWorkspace /></CommunityProvider>;
