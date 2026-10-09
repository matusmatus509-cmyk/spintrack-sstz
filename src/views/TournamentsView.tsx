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

interface PlayerResult {
  id: string;
  name: string;
  clubName?: string;
}

export const TournamentsView: React.FC = () => {
  const {
    tournamentProfile,
    matches,
    doublesMatches,
    isTournamentLoading,
    tournamentError,
    syncSstzTournaments,
  } = useApp();
  const [query, setQuery] = useState('');
  const [players, setPlayers] = useState<PlayerResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [searched, setSearched] = useState(false);
  const [notice, setNotice] = useState('');
  const [season, setSeason] = useState('all');
  const [event, setEvent] = useState('all');
  const [type, setType] = useState('all');
  const [opponent, setOpponent] = useState('');
  const [page, setPage] = useState(1);
  const historyRef = useRef<HTMLDivElement>(null);
  const pageSize = 12;

  useEffect(() => {
    const controller = new AbortController();
    setPlayers([]);
    setSearchError('');
    setSearched(false);
    setSearching(false);
    const trimmed = query.trim();
    if (trimmed.length < 2) return () => controller.abort();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        // Accept official profile URLs/IDs as well as names. IDs on the two SSTZ sites differ.
        const id = trimmed.match(
          /^(?:https:\/\/(?:www\.)?sstz\.sk\/hraci\/)?(\d+)(?:\/turnaje)?\/?$/,
        )?.[1];
        if (id) {
          setPlayers([{ id, name: `Hráč SSTZ #${id}` }]);
          return;
        }
        const response = await fetch(
          `/api/sstz/tournaments/search?q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal },
        );
        if (
          !(response.headers.get('content-type') || '').includes(
            'application/json',
          )
        )
          throw new Error(
            'Vyhľadávanie turnajových hráčov zatiaľ nie je dostupné na serveri.',
          );
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error || 'Vyhľadávanie hráčov zlyhalo.');
        if (!Array.isArray(data.players))
          throw new Error('SSTZ vrátilo neplatné výsledky vyhľadávania.');
        setPlayers(
          data.players.filter(
            (p: PlayerResult) =>
              /^\d+$/.test(String(p.id)) && typeof p.name === 'string',
          ),
        );
      } catch (error) {
        if (!controller.signal.aborted)
          setSearchError(
            error instanceof Error ? error.message : 'Vyhľadávanie zlyhalo.',
          );
      } finally {
        if (!controller.signal.aborted) {
          setSearching(false);
          setSearched(true);
        }
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

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
      ].sort((a, b) => b.date.localeCompare(a.date)),
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

  const importPlayer = async (id: string) => {
    setNotice('');
    if (await syncSstzTournaments(String(id))) {
      setSeason('all');
      setEvent('all');
      setType('all');
      setOpponent('');
      setQuery('');
      setPage(1);
      setNotice('Turnajové zápasy boli importované.');
    }
  };
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
          <p>Tvoje turnajové duely, súperi a výsledky.</p>
        </div>
        <Trophy size={28} color="var(--accent-tt-green)" aria-hidden="true" />
      </div>
      <section
        className="glass-panel tournament-panel"
        aria-labelledby="tournament-search-title"
      >
        <h2 id="tournament-search-title">Vyhľadaj hráča SSTZ</h2>
        <p className="tournament-muted">
          Zadaj meno, ID alebo odkaz na hráča zo sstz.sk.
        </p>
        <label className="tournament-field" htmlFor="tournament-player-search">
          <span>Meno alebo odkaz hráča</span>
          <div className="tournament-search">
            <Search size={18} aria-hidden="true" />
            <input
              id="tournament-player-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Meno hráča alebo https://www.sstz.sk/hraci/…"
              autoComplete="off"
            />
          </div>
        </label>
        {searching && <p role="status">Hľadám hráčov…</p>}
        {searchError && (
          <p role="alert" className="tournament-error">
            {searchError}
          </p>
        )}
        {!searching && searched && !searchError && !players.length && (
          <p role="status" className="tournament-muted">
            Žiadny hráč sa nenašiel. Skús iné meno alebo odkaz na jeho profil.
          </p>
        )}
        <div className="tournament-player-results">
          {players.map((player) => (
            <div className="tournament-player" key={player.id}>
              <div>
                <strong>{player.name}</strong>
                <p className="tournament-muted">
                  {player.clubName || `SSTZ ID ${player.id}`}
                </p>
              </div>
              <button
                className="btn-primary"
                disabled={isTournamentLoading}
                onClick={() => importPlayer(player.id)}
              >
                <Download size={16} />
                Importovať zápasy
              </button>
            </div>
          ))}
        </div>
        {isTournamentLoading && (
          <p role="status">Načítavam históriu turnajových zápasov…</p>
        )}
        {tournamentError && (
          <p role="alert" className="tournament-error">
            {tournamentError}
          </p>
        )}
        {notice && <p role="status">{notice}</p>}
      </section>
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
            <button
              className="btn-secondary"
              disabled={isTournamentLoading}
              onClick={() => importPlayer(tournamentProfile.id)}
            >
              <RefreshCw size={16} />
              Obnoviť turnaje
            </button>
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
