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
import { AddActivityModal } from './components/AddActivityModal';

const AppContent: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showAddActivity, setShowAddActivity] = useState(false);

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
