import React, { useState } from 'react';
import { AppProvider } from './context/AppContext';
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
import { AddActivityModal } from './components/AddActivityModal';

const AppContent: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showAddActivity, setShowAddActivity] = useState(false);

  const selectTab = (tab: NavTab) => {
    setCurrentTab(tab);
    window.scrollTo({ top: 0, behavior: 'auto' });
    requestAnimationFrame(() => document.getElementById('main-content')?.focus({ preventScroll: true }));
  };

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Prejsť na obsah</a>
      {/* Sleek Minimal App Top Bar */}
      <AppTopBar onOpenSettings={() => setIsSettingsOpen(true)} />

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

      {/* Unified Add Activity Modal */}
      <AddActivityModal
        isOpen={showAddActivity}
        onClose={() => setShowAddActivity(false)}
      />
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
