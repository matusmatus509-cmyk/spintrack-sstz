import React from 'react';
import { useCommunity } from '../context/CommunityContext';
import { useApp } from '../context/AppContext';
import { Settings, ShieldCheck, CircleDot, UserRound } from 'lucide-react';
interface AppTopBarProps {
  onOpenSettings: () => void;
  onOpenCommunity: () => void;
}
export const AppTopBar: React.FC<AppTopBarProps> = ({ onOpenSettings, onOpenCommunity }) => {
  const { sstzProfile } = useApp();
  const account = useCommunity();
  return (
    <header className="app-topbar">
      <div className="brand">
        <span className="brand-mark">
          <CircleDot size={25} strokeWidth={2.2} />
        </span>
        <span className="brand-name">
          SpinTrack
          <span className="brand-caption">TVOJA HRA. TVOJ PROGRES.</span>
        </span>
        <span className="brand-sstz">SSTZ</span>
      </div>
      <div className="topbar-actions">
        <button className="icon-button" onClick={onOpenCommunity}
          aria-label={account.user ? "Môj účet a komunita" : "Prihlásiť sa"}
          title={account.profile?.display_name || "Prihlásiť sa"}>
          <UserRound size={21} />
        </button>
        {sstzProfile && (
          <span className="topbar-profile">
            <ShieldCheck size={16} />
            <span>{sstzProfile.name}</span>
          </span>
        )}
        <button
          className="icon-button"
          onClick={onOpenSettings}
          aria-label="Nastavenia"
          title="Nastavenia"
        >
          <Settings size={21} strokeWidth={1.8} />
        </button>
      </div>
    </header>
  );
};
