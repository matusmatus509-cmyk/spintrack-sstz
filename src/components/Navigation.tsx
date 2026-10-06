import React from 'react';
import {
  LayoutDashboard,
  Shield,
  Layers,
  Calendar,
  BookOpen,
  BarChart3,
  Target
} from 'lucide-react';

export type NavTab = 'dashboard' | 'sstz' | 'opponents' | 'equipment' | 'calendar' | 'diary' | 'stats';

interface NavigationProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ currentTab, onSelectTab }) => {
  const tabs = [
    { id: 'dashboard' as NavTab, label: 'Prehľad', icon: LayoutDashboard },
    { id: 'sstz' as NavTab, label: 'SSTZ Hub', icon: Shield, badge: 'SSTZ' },
    { id: 'opponents' as NavTab, label: 'Súperi', icon: Target, badge: 'Skauting' },
    { id: 'equipment' as NavTab, label: 'Výstroj', icon: Layers },
    { id: 'calendar' as NavTab, label: 'Kalendár', icon: Calendar },
    { id: 'diary' as NavTab, label: 'Denník', icon: BookOpen },
    { id: 'stats' as NavTab, label: 'Štatistiky', icon: BarChart3 },
  ];

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="d-none d-md-flex" style={{
        width: '240px',
        padding: '24px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        borderRight: '1px solid var(--border-subtle)',
        background: 'rgba(10, 13, 20, 0.4)',
        minHeight: 'calc(100vh - 80px)'
      }}>
        <div style={{
          fontSize: '0.75rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--text-dim)',
          padding: '0 12px 8px 12px'
        }}>
          Menu Navigácia
        </div>

        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                background: isActive ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(16, 185, 129, 0.05) 100%)' : 'transparent',
                color: isActive ? '#34d399' : 'var(--text-muted)',
                fontWeight: isActive ? 700 : 500,
                fontSize: '0.92rem',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease',
                borderLeft: isActive ? '3px solid #10b981' : '3px solid transparent'
              }}
              onMouseEnter={e => {
                if (!isActive) {
                  e.currentTarget.style.background = 'var(--bg-card)';
                  e.currentTarget.style.color = 'var(--text-main)';
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--text-muted)';
                }
              }}
            >
              <Icon size={19} color={isActive ? '#10b981' : 'currentColor'} />
              <span>{tab.label}</span>
              {tab.badge && (
                <span style={{
                  marginLeft: 'auto',
                  fontSize: '0.65rem',
                  padding: '2px 6px',
                  borderRadius: 'var(--radius-full)',
                  background: 'rgba(59, 130, 246, 0.2)',
                  color: '#60a5fa',
                  fontWeight: 700
                }}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </aside>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="d-md-none" style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'rgba(18, 24, 36, 0.96)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid var(--border-subtle)',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        padding: '6px 4px',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)',
        zIndex: 50,
        boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.5)'
      }}>
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                background: 'transparent',
                border: 'none',
                color: isActive ? '#34d399' : 'var(--text-dim)',
                cursor: 'pointer',
                padding: '4px 8px',
                fontSize: '0.7rem',
                fontWeight: isActive ? 700 : 500,
                transition: 'color 0.15s'
              }}
            >
              <div style={{
                padding: '4px 12px',
                borderRadius: 'var(--radius-full)',
                background: isActive ? 'rgba(16, 185, 129, 0.18)' : 'transparent'
              }}>
                <Icon size={20} color={isActive ? '#34d399' : 'currentColor'} />
              </div>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
};
