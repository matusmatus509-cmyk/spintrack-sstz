import React from "react";
import { createPortal } from "react-dom";
import { X, Sparkles } from "lucide-react";
import { useApp } from "../context/AppContext";
import { useDialog } from "../hooks/useDialog";
import { currentMonth } from "../utils/recaps";
import { RecapCard } from "./RecapCard";

/** Only the latest completed periods are announced; the full archive stays in Zhrnutia. */
export function RecapReveal({ onArchive }: { onArchive: () => void }) {
  const { recaps, seenRecaps, markRecapsSeen } = useApp();
  const month = currentMonth();
  const [year, number] = month.split("-").map(Number);
  const previous =
    number === 1
      ? `${year - 1}-12`
      : `${year}-${String(number - 1).padStart(2, "0")}`;
  const available = recaps.filter(
    (r) => r.id === previous || (number === 1 && r.id === String(year - 1)),
  );
  const recap = available.find((r) => !seenRecaps.includes(r.id));
  const dismiss = () => markRecapsSeen(available.map((r) => r.id));
  const ref = useDialog(!!recap, dismiss);
  if (!recap) return null;
  return createPortal(
    <div className="recap-reveal-backdrop" onClick={dismiss}>
      <div
        className="recap-reveal"
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="recap-reveal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="recap-reveal-heading">
          <span>
            <Sparkles size={18} /> TVOJA HRA. TVOJ PRÍBEH.
          </span>
          <button
            className="icon-button"
            aria-label="Zavrieť zhrnutie"
            onClick={dismiss}
          >
            <X size={22} />
          </button>
        </div>
        <h1 id="recap-reveal-title">Pozri, čo máš za sebou.</h1>
        <p>Tvoje nové zhrnutie je pripravené.</p>
        <RecapCard recap={recap} />
        {available.some(
          (r) => r.id !== recap.id && !seenRecaps.includes(r.id),
        ) && (
          <button
            className="btn-primary"
            onClick={() => markRecapsSeen([recap.id])}
          >
            Pokračovať na ročné zhrnutie
          </button>
        )}
        <button
          className="btn-primary"
          onClick={() => {
            dismiss();
            onArchive();
          }}
        >
          Otvoriť archív zhrnutí
        </button>
        <button className="btn-secondary" onClick={dismiss}>
          Hotovo, poďme hrať
        </button>
        <small>Kedykoľvek ich nájdeš cez Viac → Zhrnutia.</small>
      </div>
    </div>,
    document.body,
  );
}
