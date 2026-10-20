import { SstzImportPanel } from '../components/SstzImportPanel';
import { compareOccurrenceDesc } from '../utils/diary';
import { RecommendedTournaments } from '../components/RecommendedTournaments';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Trophy,
  Search,
  Download,
  RefreshCw,
  ExternalLink,
  Users,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { SetBreakdown } from '../components/SetBreakdown';

export const TournamentsView: React.FC = () => {
  const {
    tournamentProfile,
    matches,
    doublesMatches,
  } = useApp();
  const [season, setSeason] = useState('all');
  const [event, setEvent] = useState('all');
  const [type, setType] = useState('all');
  const [opponent, setOpponent] = useState('');
  const [page, setPage] = useState(1);
  const historyRef = useRef<HTMLDivElement>(null);
  const pageSize = 12;

  const allMatches = useMemo(
    () =>
      [
        ...matches
          .filter((m) => m.source === 'SSTZ_TOURNAMENT')
          .map((m) => ({ ...m, duelType: m.matchType || ('singles' as const) })),
        ...doublesMatches
          .filter((m) => m.source === 'SSTZ_TOURNAMENT')
          .map((m) => ({
            ...m,
            opponentName: m.opponentPair,
            duelType: 'doubles' as const,
          })),
      ].sort(compareOccurrenceDesc),
    [matches, doublesMatches],
  );
  const seasons = Array.from(
    new Set(allMatches.map((m) => m.season).filter((s): s is string => !!s)),
  )
    .sort()
    .reverse();
  const events = Array.from(
    new Set(
      allMatches.map((m) => m.tournamentName).filter((s): s is string => !!s),
    ),
  ).sort();
  const filtered = allMatches.filter(
    (m) =>
      (season === 'all' || m.season === season) &&
      (event === 'all' || m.tournamentName === event) &&
      (type === 'all' || m.duelType === type) &&
      `${m.opponentName} ${'partnerName' in m ? m.partnerName : ''}`
        .toLocaleLowerCase('sk')
        .includes(opponent.trim().toLocaleLowerCase('sk')),
  );
  useEffect(
    () => setPage(1),
    [season, event, type, opponent, allMatches.length, tournamentProfile?.id],
  );

  const changePage = (next: number) => {
    setPage(next);
    requestAnimationFrame(() =>
      historyRef.current?.scrollIntoView({ block: 'start' }),
    );
  };

  return (
    <div className="page-view tournaments-view animate-fade-in">
      <div className="page-header">
        <div>
          <span className="eyebrow">SSTZ · TURNAJE</span>
          <h1>Turnaje</h1>
          <p>Odporúčané podujatia a tvoje turnajové výsledky.</p>
        </div>
        <Trophy size={28} color="var(--accent-tt-green)" aria-hidden="true" />
      </div>
      <RecommendedTournaments />
      <SstzImportPanel />
      {tournamentProfile && (
        <section
          className="glass-panel tournament-panel"
          aria-label="Turnajový profil"
        >
          <div className="tournament-profile">
            <div>
              <h2>{tournamentProfile.name}</h2>
              <p className="tournament-muted">{tournamentProfile.clubName}</p>
            </div>

          </div>
          <div className="tournament-metrics">
            <div>
              <strong>{allMatches.length}</strong>
              <span>Zápasy</span>
            </div>
            <div>
              <strong>{events.length}</strong>
              <span>Turnaje</span>
            </div>
            <div>
              <strong>
                {allMatches.filter((m) => m.result === 'WIN').length}
              </strong>
              <span>Výhry</span>
            </div>
          </div>
          <p className="tournament-muted">
            Aktualizované{' '}
            {new Date(tournamentProfile.lastSync).toLocaleString('sk-SK')}
          </p>
          <a
            className="tournament-source"
            href={`https://www.sstz.sk/hraci/${tournamentProfile.id}/turnaje`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink size={14} />
            Profil na SSTZ
          </a>
        </section>
      )}
      {allMatches.length > 0 ? (
        <section
          className="glass-panel tournament-panel"
          aria-labelledby="tournament-history-title"
        >
          <h2 id="tournament-history-title">
            Turnajové zápasy ({filtered.length} z {allMatches.length})
          </h2>
          <p className="tournament-muted">SSTZ zverejňuje pri týchto dueloch výsledok zápasu, napríklad 3:1. Body a sety jednotlivých hier v tomto zozname nie sú k dispozícii.</p>
          <div className="tournament-filters">
            <div className="tournament-field">
              <label htmlFor="tournament-season">Sezóna</label>
              <select
                id="tournament-season"
                value={season}
                onChange={(e) => setSeason(e.target.value)}
              >
                <option value="all">Všetky sezóny</option>
                {seasons.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="tournament-field">
              <label htmlFor="tournament-event">Turnaj</label>
              <select
                id="tournament-event"
                value={event}
                onChange={(e) => setEvent(e.target.value)}
              >
                <option value="all">Všetky turnaje</option>
                {events.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="tournament-field">
              <label htmlFor="tournament-type">Typ zápasu</label>
              <select
                id="tournament-type"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                <option value="all">Jednotlivci aj štvorhry</option>
                <option value="singles">Dvojhry</option>
                <option value="doubles">Štvorhry</option>
              </select>
            </div>
            <div className="tournament-field">
              <label htmlFor="tournament-opponent">Súper / spoluhráč</label>
              <input
                id="tournament-opponent"
                value={opponent}
                onChange={(e) => setOpponent(e.target.value)}
                placeholder="Hľadať v zápasoch"
              />
            </div>
          </div>
          <div ref={historyRef} className="history-list">
            {filtered.slice((page - 1) * pageSize, page * pageSize).map((m) => (
              <article className="tournament-match" key={m.id}>
                <div className="tournament-match-top">
                  <span className="badge-pill">
                    {m.duelType === 'doubles' ? 'Štvorhra' : 'Dvojhra'}
                    {m.season ? ` · ${m.season}` : ''}
                  </span>
                  <time dateTime={m.date}>
                    {new Date(`${m.date}T12:00:00`).toLocaleDateString('sk-SK')}
                  </time>
                </div>
                <h3>{m.tournamentName}</h3>
                <p className="tournament-muted">
                  {[m.category, m.round].filter(Boolean).join(' · ')}
                </p>
                <div className="tournament-score">
                  <strong>{m.opponentName}</strong>
                  <span
                    className={
                      m.result === 'WIN' ? 'tournament-win' : 'tournament-loss'
                    }
                  >
                    {m.score} · {m.result === 'WIN' ? 'Výhra' : 'Prehra'}
                  </span>
                </div>
                {m.isWalkover && <span className="badge-pill badge-red">Kontumácia / odstúpenie (WO)</span>}
                {'opponentClub' in m && <p className="tournament-muted">{m.opponentClub}</p>}
                {'partnerName' in m && (
                  <p className="tournament-muted">
                    <Users size={14} /> Spoluhráč: {m.partnerName || 'SSTZ neuvádza'}
                  </p>
                )}
                <SetBreakdown
                  sets={m.sets}
                  setDetails={m.setDetails}
                  totalPointsWon={m.totalPointsWon}
                  totalPointsLost={m.totalPointsLost}
                  result={m.result}
                  compact
                />
              </article>
            ))}
          </div>
          {filtered.length === 0 && (
            <p className="history-empty">
              Pre tieto filtre sa nenašli žiadne zápasy.
            </p>
          )}
          {filtered.length > pageSize && (
            <nav
              className="history-pagination"
              aria-label="Stránkovanie turnajov"
            >
              <button
                className="btn-secondary"
                disabled={page === 1}
                onClick={() => changePage(page - 1)}
              >
                Predošlé
              </button>
              <span aria-live="polite">
                {(page - 1) * pageSize + 1}–
                {Math.min(page * pageSize, filtered.length)} z {filtered.length}
              </span>
              <button
                className="btn-secondary"
                disabled={page * pageSize >= filtered.length}
                onClick={() => changePage(page + 1)}
              >
                Ďalšie
              </button>
            </nav>
          )}
        </section>
      ) : (
        <div className="glass-panel tournament-panel tournament-empty">
          <Trophy size={32} aria-hidden="true" />
          <h2>
            {tournamentProfile
              ? 'Zatiaľ žiadne turnajové zápasy'
              : 'Tvoja turnajová história'}
          </h2>
          <p className="tournament-muted">
            {tournamentProfile
              ? 'SSTZ pre tohto hráča neposkytlo žiadne odohrané turnajové zápasy.'
              : 'Vyhľadaj svoj profil vyššie a importuj zápasy. Nájdeš ich aj v bilancii proti súperom.'}
          </p>
        </div>
      )}
    </div>
  );
};
