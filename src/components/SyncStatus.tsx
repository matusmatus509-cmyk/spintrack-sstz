import React, { useEffect, useState } from 'react';
import { CheckCircle2, LoaderCircle, AlertCircle, X } from 'lucide-react';
import { SyncKind, useApp } from '../context/AppContext';

const labels: Record<SyncKind, string> = {
  player: 'Ligové zápasy',
  schedule: 'Liga a rozpis',
  tournaments: 'Turnaje',
};

/** Keep imports visible across navigation without blocking the saved history. */
export const SyncStatus: React.FC = () => {
  const { syncJobs } = useApp();
  const [now, setNow] = useState(Date.now());
  const [dismissed, setDismissed] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!Object.keys(syncJobs).length) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [syncJobs]);
  const jobs = (
    Object.entries(syncJobs) as [
      SyncKind,
      NonNullable<(typeof syncJobs)[SyncKind]>,
    ][]
  ).filter(
    ([kind, job]) =>
      dismissed[kind] !== job.startedAt &&
      (job.state !== 'success' || now - (job.finishedAt || now) < 8000),
  );
  if (!jobs.length) return null;
  return (
    <aside className="sync-status" aria-label="Priebeh aktualizácie">
      {jobs.map(([kind, job]) => {
        const loading = job.state === 'loading';
        const Icon = loading
          ? LoaderCircle
          : job.state === 'success'
            ? CheckCircle2
            : AlertCircle;
        const seconds = Math.max(0, Math.floor((now - job.startedAt) / 1000));
        return (
          <div key={kind} className={`sync-status-card sync-${job.state}`}>
            <Icon
              size={22}
              className={loading ? 'sync-spinner' : ''}
              aria-hidden="true"
            />
            <div className="sync-status-copy">
              <div role={job.state === 'error' ? 'alert' : 'status'}>
                <strong>{labels[kind]}</strong>
                <p>{job.message}</p>
              </div>
              {loading && (
                <>
                  <span className="sync-status-hint">
                    {seconds ? `Prebieha ${seconds} s. ` : ''}Kompletná história
                    môže chvíľu trvať.
                  </span>
                  <div
                    className="sync-progress"
                    role="progressbar"
                    aria-label={`Načítavanie: ${labels[kind]}`}
                  >
                    <span />
                  </div>
                </>
              )}
              {job.state === 'error' && (
                <span className="sync-status-hint">
                  Uložené údaje zostali dostupné. Obnovu môžeš zopakovať v
                  príslušnej sekcii.
                </span>
              )}
            </div>
            {!loading && (
              <button
                type="button"
                aria-label={`Zavrieť oznámenie: ${labels[kind]}`}
                onClick={() =>
                  setDismissed((previous) => ({
                    ...previous,
                    [kind]: job.startedAt,
                  }))
                }
              >
                <X size={18} />
              </button>
            )}
          </div>
        );
      })}
    </aside>
  );
};
