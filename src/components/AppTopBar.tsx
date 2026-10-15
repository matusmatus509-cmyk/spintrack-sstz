import React from "react";
import { useCommunity } from "../context/CommunityContext";
import { useTheme } from "../context/ThemeContext";
import {
  Settings,
  CircleDot,
  UserRound,
  Sun,
  Moon,
} from "lucide-react";
import { type NavTab } from "./Navigation";

interface AppTopBarProps {
  onOpenSettings: () => void;
  onOpenCommunity: () => void;
  onHome: () => void;
  currentTab: NavTab;
}
export const AppTopBar: React.FC<AppTopBarProps> = ({
  onOpenSettings,
  onOpenCommunity,
  onHome,
  currentTab,
}) => {
  const account = useCommunity();
  const { theme, setPreference } = useTheme();
  const nextTheme = theme === "dark" ? "light" : "dark";
  const themeLabel =
    theme === "dark" ? "Zapnúť svetlý režim" : "Zapnúť tmavý režim";
  return (
    <header className="app-topbar">
      <button className="brand" onClick={onHome} aria-label="SpinTrack – domov">
        <span className="brand-mark">
          <CircleDot size={25} strokeWidth={2.2} />
        </span>
        <span className="brand-name">
          SpinTrack
          <span className="brand-caption">Tvoja hra vo vrecku</span>
        </span>
      </button>
      <div className="topbar-actions">
        <button
          className="icon-button theme-toggle"
          onClick={() => setPreference(nextTheme)}
          aria-label={themeLabel}
          title={themeLabel}
        >
          {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
        </button>
        <button
          className="icon-button"
          onClick={onOpenSettings}
          aria-label="Nastavenia"
          title="Nastavenia"
        >
          <Settings size={20} strokeWidth={1.8} />
        </button>
        <button
          className="account-button"
          onClick={onOpenCommunity}
          aria-label={account.user ? "Môj účet a komunita" : "Prihlásiť sa"}
        >
          <span className="account-avatar">
            {account.profile?.display_name
              ?.slice(0, 1)
              .toLocaleUpperCase("sk") || <UserRound size={19} />}
          </span>
          <span className="account-label">
            {account.profile?.display_name || "Môj účet"}
            <small>{account.user ? "Hráčsky profil" : "Prihlásiť sa"}</small>
          </span>
        </button>
      </div>
    </header>
  );
};
