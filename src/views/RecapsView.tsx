import React, { useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useApp } from "../context/AppContext";
import { RecapCard } from "../components/RecapCard";
import { recapLabel } from "../utils/recaps";
export function RecapsView() {
  const { recaps } = useApp();
  const [kind, setKind] = useState<"month" | "year">("month");
  const [selected, setSelected] = useState("");
  const list = recaps.filter((r) => r.kind === kind);
  const recap = list.find((r) => r.id === selected) || list[0];
  const index = list.indexOf(recap);
  const max = Math.max(60, ...(recap?.bars.map((b) => b.minutes) || []));
  return (
    <div className="page-view recap-view animate-fade-in">
      <header className="page-header">
        <span className="eyebrow">TVOJA HRA V ČÍSLACH</span>
        <h1>
          Malé kroky.
          <br />
          Veľký príbeh.
        </h1>
        <p>Mesiace úsilia, na ktoré sa oplatí pozrieť späť.</p>
      </header>
      <div className="recap-switch" aria-label="Obdobie zhrnutia">
        {(["month", "year"] as const).map((k) => (
          <button
            key={k}
            aria-pressed={kind === k}
            onClick={() => {
              setKind(k);
              setSelected("");
            }}
          >
            {k === "month" ? "Mesačné" : "Ročné"}
          </button>
        ))}
      </div>
      {recap ? (
        <>
          <div className="recap-picker">
            <button
              className="icon-button"
              disabled={index === list.length - 1}
              aria-label="Staršie zhrnutie"
              onClick={() => setSelected(list[index + 1].id)}
            >
              <ChevronLeft />
            </button>
            <label>
              <span className="sr-only">Vybrať zhrnutie</span>
              <select
                value={recap.id}
                onChange={(e) => setSelected(e.target.value)}
              >
                {list.map((r) => (
                  <option key={r.id} value={r.id}>
                    {recapLabel(r.id)}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="icon-button"
              disabled={index === 0}
              aria-label="Novšie zhrnutie"
              onClick={() => setSelected(list[index - 1].id)}
            >
              <ChevronRight />
            </button>
          </div>
          <RecapCard recap={recap} />
          <section className="recap-chart">
            <span className="eyebrow">TVOJA PRAVIDELNOSŤ</span>
            <h2>Čas venovaný tréningu</h2>
            <div className={`recap-bars ${kind === "year" ? "is-year" : ""}`}>
              {recap.bars.map((b) => (
                <div key={b.label}>
                  <span>
                    {(b.minutes / 60).toLocaleString("sk", {
                      maximumFractionDigits: 1,
                    })}{" "}
                    h
                  </span>
                  <div className="recap-bar-track">
                    <i style={{ height: `${(100 * b.minutes) / max}%` }} />
                  </div>
                  <small>{b.label}</small>
                </div>
              ))}
            </div>
          </section>
          <p className="recap-footnote">
            Z dokončených aktivít, dvojhier a štvorhier. Tréningový čas vychádza
            zo zapísaného trvania. Zhrnutia sa ukladajú s denníkom a po oprave
            či importe údajov sa aktualizujú.
          </p>
        </>
      ) : (
        <section className="recap-empty">
          <CalendarDays size={36} />
          <h2>
            {kind === "year"
              ? "Tvoj rok sa ešte píše"
              : "Tvoj príbeh sa začína"}
          </h2>
          <p>
            {kind === "year"
              ? "Ročnú kartičku tu nájdeš po skončení roka."
              : "Po skončení mesiaca tu nájdeš svoju prvú kartičku. Zapisuj tréningy a zápasy, o zhrnutie sa postaráme."}
          </p>
        </section>
      )}
    </div>
  );
}
