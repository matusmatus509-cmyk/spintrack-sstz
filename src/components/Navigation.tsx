import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  LayoutDashboard,
  Users,
  Shield,
  Layers,
  Calendar,
  Activity,
  BarChart3,
  TrendingUp,
  Target,
  Trophy,
  MoreHorizontal,
  ChevronRight,
  X,
  Plus,
  Search,
} from 'lucide-react';
import { useDialog } from '../hooks/useDialog';

export type NavTab =
  | 'community'
  | 'performance'
  | 'matches'
  | 'dashboard'
  | 'sstz'
  | 'opponents'
  | 'equipment'
  | 'calendar'
  | 'diary'
  | 'stats'
  | 'tournaments';
interface NavigationProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onAddActivity: () => void;
}
export const NAV_TABS = [
  {
    id: 'dashboard' as NavTab,
    label: 'Prehľad',
    icon: LayoutDashboard,
    description: 'Tvoj deň pri stole',
  },
  {
    id: 'sstz' as NavTab,
    label: 'SSTZ',
    icon: Shield,
    description: 'Ligy a celá kariéra',
  },
  {
    id: 'diary' as NavTab,
    label: 'Aktivita',
    icon: Activity,
    description: 'Tréningy a zápasy',
  },
  {
    id: 'calendar' as NavTab,
    label: 'Kalendár',
    icon: Calendar,
    description: 'Najbližšie stretnutia',
  },
  { id: 'community' as NavTab, label: 'Komunita', icon: Users, description: 'Priatelia a spoločné tréningy' },
  {
    id: 'opponents' as NavTab,
    label: 'Súperi',
    icon: Target,
    description: 'Bilancia a taktika',
  },
  {
    id: 'tournaments' as NavTab,
    label: 'Turnaje',
    icon: Trophy,
    description: 'Turnajové zápasy zo SSTZ',
  },
  {
    id: 'equipment' as NavTab,
    label: 'Výstroj',
    icon: Layers,
    description: 'Rakety, drevá a poťahy',
  },
  { id: 'performance' as NavTab, label: 'Úspešnosť', icon: TrendingUp, description: 'Výsledky podľa sezón a líg' },
  { id: 'matches' as NavTab, label: 'Zápasy', icon: Trophy, description: 'Všetky dvojhry a štvorhry' },
  {
    id: 'stats' as NavTab,
    label: 'Štatistiky',
    icon: BarChart3,
    description: 'Výkonnosť a odznaky',
  },
];

export const Navigation: React.FC<NavigationProps> = ({
  currentTab,
  onSelectTab,
  onAddActivity,
}) => {
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [query, setQuery] = useState('');
  const dialogRef = useDialog(isMoreOpen, () => setIsMoreOpen(false));
  const primaryTabs = ['dashboard', 'diary', 'calendar'].map(id => NAV_TABS.find(tab => tab.id === id)!);
  const moreTabs = NAV_TABS.filter(tab => !primaryTabs.includes(tab));
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('sk');
  const visibleTabs = moreTabs.filter(tab => normalize(`${tab.label} ${tab.description}`).includes(normalize(query)));
  const select = (tab: NavTab) => {
    setIsMoreOpen(false);
    onSelectTab(tab);
  };
  const moreActive = moreTabs.some((tab) => tab.id === currentTab);
  return (
    <>
      <nav className="mobile-bottom-nav" aria-label="Mobilná navigácia">
        {primaryTabs.map(({ id, label, icon: Icon }) => (
          <React.Fragment key={id}>
            {id === 'calendar' && (
              <button className="mobile-nav-btn mobile-create" onClick={onAddActivity} aria-label="Pridať aktivitu">
                <span className="mobile-nav-icon"><Plus size={24} /></span>
                <span>Pridať</span>
              </button>
            )}
            <button
              className={`mobile-nav-btn ${currentTab === id ? 'is-active' : ''}`}
              aria-current={currentTab === id ? 'page' : undefined}
              onClick={() => select(id)}
            >
              <span className="mobile-nav-icon">
                <Icon size={22} strokeWidth={1.8} />
              </span>
              <span>{label}</span>
            </button>
          </React.Fragment>
        ))}
        <button
          className={`mobile-nav-btn ${moreActive || isMoreOpen ? 'is-active' : ''}`}
          aria-label="Viac sekcií"
          aria-expanded={isMoreOpen}
          aria-haspopup="dialog"
          onClick={() => { setQuery(''); setIsMoreOpen(true); }}
        >
          <span className="mobile-nav-icon">
            <MoreHorizontal size={23} />
          </span>
          <span>Viac</span>
        </button>
      </nav>
      {isMoreOpen &&
        createPortal(
          <div
            className="mobile-sheet-container nav-sheet-backdrop"
            onClick={() => setIsMoreOpen(false)}
          >
            <div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="more-menu-title"
              tabIndex={-1}
              className="mobile-sheet-content nav-sheet"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="dialog-header">
                <div>
                  <span className="eyebrow">SPINTRACK</span>
                  <h2 id="more-menu-title">Viac z tvojej hry</h2>
                </div>
                <button
                  className="icon-button"
                  aria-label="Zavrieť menu"
                  onClick={() => setIsMoreOpen(false)}
                >
                  <X size={21} />
                </button>
              </div>
              <label className="nav-search"><Search size={18} /><span className="sr-only">Hľadať sekciu</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Nájsť sekciu…" /></label>
              {visibleTabs.length === 0 && <p className="nav-search-empty">Žiadna sekcia sa nenašla.</p>}
              {visibleTabs.map(({ id, label, icon: Icon, description }) => (
                <button
                  key={id}
                  className={`more-menu-link ${currentTab === id ? 'is-active' : ''}`}
                  aria-current={currentTab === id ? 'page' : undefined}
                  onClick={() => select(id)}
                >
                  <span className="more-menu-icon">
                    <Icon size={23} />
                  </span>
                  <span>
                    <strong>{label}</strong>
                    <small>{description}</small>
                  </span>
                  <ChevronRight size={19} />
                </button>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
};
