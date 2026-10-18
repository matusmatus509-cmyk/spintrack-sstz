import React, { useEffect, useState } from "react";
import { CheckCheck, Target } from "lucide-react";
import { useApp } from "../context/AppContext";
import type { ActivityRecord } from "../types";
import { AddActivityModal } from "./AddActivityModal";
import { trainingHasEnded } from "../utils/training";

export function TrainingQuickActions() {
  const { activities } = useApp();
  const [selection, setSelection] = useState<ActivityRecord | null>(null);
  const [today, setToday] = useState(() => new Date());
  useEffect(() => {
    const update = () => setToday(new Date());
    const timer = window.setInterval(update, 60000);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  const ordered = [...activities]
    .filter((a) => a.category === "tréning")
    .sort(
      (a, b) =>
        `${b.date}T${b.startTime || "00:00"}`.localeCompare(
          `${a.date}T${a.startTime || "00:00"}`,
        ) || b.createdAt.localeCompare(a.createdAt),
    );
  const due = ordered.filter((a) => trainingHasEnded(a, today));
  const goal = ordered.find(
    (a) =>
      !a.planned &&
      new Date(`${a.date}T00:00:00`) <= today &&
      a.reflection?.nextGoal,
  )?.reflection?.nextGoal;
  if (!due.length && !goal) return null;
  return (
    <section className="practice-panel" aria-label="Rýchly zápis tréningu">
      <div className="practice-heading">
        <div>
          <span>TVOJ ĎALŠÍ KROK</span>
          <h2>Ďalší krok v tréningu</h2>
        </div>
        <Target size={22} />
      </div>
      {goal && (
        <div className="practice-callout">
          <Target size={18} />
          <div>
            <span>Pri ďalšom tréningu</span>
            <strong>{goal}</strong>
          </div>
        </div>
      )}
      {due.map((a) => (
        <div className="practice-due" key={a.id}>
          <div>
            <strong>{a.location || "Naplánovaný tréning"}</strong>
            <span>
              {new Date(`${a.date}T12:00:00`).toLocaleDateString("sk-SK")} ·{" "}
              {a.durationMinutes} min
            </span>
          </div>
          <button className="btn-secondary" onClick={() => setSelection(a)}>
            <CheckCheck size={18} /> Absolvované
          </button>
        </div>
      ))}
      <AddActivityModal
        isOpen={!!selection}
        onClose={() => setSelection(null)}
        editActivity={selection}
        completePlanned
      />
    </section>
  );
}
