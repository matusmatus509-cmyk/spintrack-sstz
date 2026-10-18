import { CheckCircle2, PlusCircle, LoaderCircle } from "lucide-react";
import { useRef, useState } from "react";
import { useApp } from "../context/AppContext";
import type { SharedActivityData } from "../types/community";
import { sharedImportData, sharedImportId } from "../utils/sharedImport";

export function ImportSharedActivity({
  source,
  sourceId,
  data,
  beforeImport,
}: {
  source: "club" | "community";
  sourceId: string;
  data: SharedActivityData;
  beforeImport?: () => Promise<void>;
}) {
  const { activities, addActivity } = useApp();
  const [imported, setImported] = useState(false);
  const importing = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const id = sharedImportId(source, sourceId);
  const saved = activities.some((activity) => activity.id === id);
  return (
    <div className="club-import">
      <button
        className="btn-primary"
        disabled={saved || busy}
        onClick={async () => {
          if (saved || importing.current) return;
          importing.current = true;
          setBusy(true);
          setError("");
          try {
            await beforeImport?.();
            addActivity(sharedImportData(data), id);
            setImported(true);
          } catch {
            setError(
              "Aktivitu sa nepodarilo importovať. Obnov komunitu a skús znova.",
            );
          } finally {
            setBusy(false);
            importing.current = false;
          }
        }}
      >
        {busy ? (
          <LoaderCircle size={17} className="sync-spinner" />
        ) : saved ? (
          <CheckCircle2 size={17} />
        ) : (
          <PlusCircle size={17} />
        )}
        {busy
          ? "Pridávam…"
          : saved
            ? "Uložené v mojom denníku"
            : "Pridať do môjho denníka"}
      </button>
      {error && (
        <small role="alert" className="community-error">
          {error}
        </small>
      )}
      {imported && (
        <small role="status">
          Pridané ako plán. Po tréningu otvor aktivitu v denníku a označ ju za
          absolvovanú.
        </small>
      )}
    </div>
  );
}
