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
      {/* Desktop / Tablet Sidebar */}
      <aside className="d-none d-md-flex desktop-sidebar" style={{
        width: '230px',
        padding: '20px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        borderRight: '1px solid var(--border-subtle)',
        background: 'rgba(10, 13, 20, 0.4)',
        minHeight: 'calc(100vh - 80px)'
      }}>
        <div style={{
          fontSize: '0.72rem',
          fontWeight: 800,
          color: 'var(--text-dim)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          padding: '4px 12px 10px 12px'
        }}>
          Navigácia
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
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                background: isActive ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                color: isActive ? '#34d399' : 'var(--text-muted)',
                fontWeight: isActive ? 700 : 500,
                fontSize: '0.9rem',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease',
                width: '100%',
                position: 'relative'
              }}
              onMouseEnter={e => {
                if (!isActive) {
                  e.currentTarget.style.background = 'var(--bg-card-hover)';
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

      {/* Native-style Mobile Bottom Navigation Bar */}
      <nav className="mobile-bottom-nav d-md-none" style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'rgba(15, 23, 42, 0.96)',
        backdropFilter: 'blur(25px)',
        WebkitBackdropFilter: 'blur(25px)',
        borderTop: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        padding: '6px 4px',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 6px)',
        zIndex: 50,
        boxShadow: '0 -4px 25px rgba(0, 0, 0, 0.6)',
        overflowX: 'auto',
        scrollbarWidth: 'none',
        WebkitOverflowScrolling: 'touch',
        justifyContent: 'space-around'
      }}>
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className="mobile-nav-btn"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '2px',
                background: 'transparent',
                border: 'none',
                color: isActive ? '#34d399' : 'var(--text-muted)',
                cursor: 'pointer',
                padding: '4px 6px',
                minWidth: '48px',
                flex: '1 0 auto',
                fontSize: '0.67rem',
                fontWeight: isActive ? 800 : 500,
                transition: 'all 0.15s ease',
                touchAction: 'manipulation'
              }}
            >
              <div style={{
                padding: '3px 10px',
                borderRadius: 'var(--radius-full)',
                background: isActive ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease'
              }}>
                <Icon size={19} color={isActive ? '#34d399' : 'currentColor'} />
              </div>
              <span style={{
                maxWidth: '60px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>
    </>
  );
};
