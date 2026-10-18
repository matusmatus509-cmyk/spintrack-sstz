import { useEffect, useState } from "react";
import { CloudCheck, CloudOff, RefreshCw, HardDrive } from "lucide-react";
import { useCommunity } from "../context/CommunityContext";
import { useApp } from "../context/AppContext";

export function AccountSaveStatus() {
  const account = useCommunity();
  const { localSaveError } = useApp();
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  const state = account.user ? account.saveState : "local";
  const Icon =
    state === "saved"
      ? CloudCheck
      : state === "local"
        ? HardDrive
        : state === "saving"
          ? RefreshCw
          : CloudOff;
  const label = localSaveError
    ? "Úložisko zariadenia je plné. Exportuj si zálohu v nastaveniach."
    : state === "local"
      ? "Denník je uložený v tomto zariadení"
      : state === "saved"
        ? `Uložené v účte${account.lastSavedAt ? ` · ${new Date(account.lastSavedAt).toLocaleTimeString("sk-SK", { hour: "2-digit", minute: "2-digit" })}` : ""}`
        : state === "saving"
          ? "Ukladám zmeny do účtu…"
          : state === "error"
            ? "Záloha do účtu zlyhala. Zmeny zostali v zariadení."
            : online
              ? "Zmeny čakajú na uloženie do účtu"
              : "Bez pripojenia · zmeny čakajú v zariadení";
  return (
    <div
      className={`account-save-status ${localSaveError || state === "error" ? "save-error" : ""}`}
      role="status"
    >
      <Icon size={16} />
      <span>{label}</span>
      {state === "error" && (
        <button
          type="button"
          className="text-button"
          onClick={() => void account.retrySave()}
        >
          Skúsiť znova
        </button>
      )}
    </div>
  );
}
