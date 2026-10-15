import React from "react";
import { useCommunity } from "../context/CommunityContext";
import { useTheme } from "../context/ThemeContext";
import {
  Settings,
  ArrowLeft,
  CircleDot,
  UserRound,
  Sun,
  Moon,
} from "lucide-react";
import { NAV_TABS, type NavTab } from "./Navigation";

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
      <button
        className={`brand ${currentTab !== "dashboard" ? "screen-brand" : ""}`}
        onClick={onHome}
        aria-label={
          currentTab === "dashboard" ? "SpinTrack – domov" : "Späť na prehľad"
        }
      >
        <span className="brand-mark">
          {currentTab === "dashboard" ? (
            <CircleDot size={25} strokeWidth={2.2} />
          ) : (
            <ArrowLeft size={22} />
          )}
        </span>
        <span className="brand-name">
          {currentTab === "dashboard"
            ? "SpinTrack"
            : NAV_TABS.find((tab) => tab.id === currentTab)?.label}
          <span className="brand-caption">
            {currentTab === "dashboard" ? "Tvoja hra vo vrecku" : "SpinTrack"}
          </span>
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
