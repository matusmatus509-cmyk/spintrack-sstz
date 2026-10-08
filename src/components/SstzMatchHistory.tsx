import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { SetBreakdown } from './SetBreakdown';
import { Target } from 'lucide-react';

export const SstzMatchHistory: React.FC = () => {
  const { matches, doublesMatches, sstzProfile } = useApp();

  // Matches interactive filters
  const [historyPage, setHistoryPage] = useState(1);
  const historyPageSize = 12;
  const matchHistoryRef = React.useRef<HTMLDivElement>(null);
  const goToHistoryPage = (page: number) => {
    setHistoryPage(page);
    requestAnimationFrame(() =>
      matchHistoryRef.current?.scrollIntoView({
        block: 'start',
        behavior: 'auto',
      }),
    );
  };
  const [selectedSeasonFilter, setSelectedSeasonFilter] =
    useState<string>('all');
  const [selectedLeagueFilter, setSelectedLeagueFilter] =
    useState<string>('all');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<
    'all' | 'singles' | 'doubles'
  >('all');
  const [matchSearch, setMatchSearch] = useState('');

  useEffect(() => {
    setHistoryPage(1);
  }, [
    selectedSeasonFilter,
    selectedLeagueFilter,
    selectedTypeFilter,
    matchSearch,
    sstzProfile?.id,
    matches.length,
    doublesMatches.length,
  ]);

  // All combined authentic matches (singles + doubles)
  const allAuthenticMatches = React.useMemo(() => {
    const sMatches = matches
      .filter((m) => m.source === 'SSTZ')
      .map((m) => ({
        ...m,
        duelType: 'singles' as const,
      }));
    const dMatches = doublesMatches
      .filter((m) => m.source === 'SSTZ')
      .map((m) => ({
        ...m,
        duelType: 'doubles' as const,
        opponentName: m.opponentPair,
        competition: m.competition || m.leagueName || 'SSTZ Liga',
      }));

    return [...sMatches, ...dMatches].sort((a, b) => {
      return (b.date || '').localeCompare(a.date || '');
    });
  }, [matches, doublesMatches]);

  // Unique seasons and leagues for filter dropdowns
  const availableSeasons = React.useMemo(() => {
    const set = new Set<string>();
    allAuthenticMatches.forEach((m) => {
      if (m.season) set.add(m.season);
    });
    return Array.from(set).sort().reverse();
  }, [allAuthenticMatches]);

  const availableLeagues = React.useMemo(() => {
    const set = new Set<string>();
    allAuthenticMatches.forEach((m) => {
      if (m.leagueName) set.add(m.leagueName);
    });
    return Array.from(set).sort();
  }, [allAuthenticMatches]);

  // Filtered matches list
  const filteredMatches = React.useMemo(() => {
    return allAuthenticMatches.filter((m) => {
      if (selectedSeasonFilter !== 'all' && m.season !== selectedSeasonFilter)
        return false;
      if (
        selectedLeagueFilter !== 'all' &&
        m.leagueName !== selectedLeagueFilter
      )
        return false;
      if (selectedTypeFilter !== 'all' && m.duelType !== selectedTypeFilter)
        return false;
      if (matchSearch.trim()) {
        const q = matchSearch.toLowerCase().trim();
        const opp = (m.opponentName || '').toLowerCase();
        const teams = (m.teams || '').toLowerCase();
        const league = (m.leagueName || '').toLowerCase();
        const partner = ((m as any).partnerName || '').toLowerCase();
        if (
          !opp.includes(q) &&
          !teams.includes(q) &&
          !league.includes(q) &&
          !partner.includes(q)
        )
          return false;
      }
      return true;
    });
  }, [
    allAuthenticMatches,
    selectedSeasonFilter,
    selectedLeagueFilter,
    selectedTypeFilter,
    matchSearch,
  ]);

  if (!allAuthenticMatches.length) {
    return (
      <div className="glass-panel history-empty">
        Zatiaľ nemáš importované ligové zápasy. Prepoj svoj profil v SSTZ Hube.
      </div>
    );
  }

  return (
    <div
      className="glass-panel"
      style={{ padding: '24px 20px', borderRadius: 'var(--radius-lg)' }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Target size={18} color="#10b981" />
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>
              Všetky reálne ligové zápasy ({filteredMatches.length} z{' '}
              {allAuthenticMatches.length})
            </h3>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Kompletná história ligových duelov s oficiálnymi setmi a bodmi.
          </p>
        </div>
      </div>

      {/* Filters Bar */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
          gap: '10px',
          marginBottom: '16px',
          background: 'rgba(255, 255, 255, 0.02)',
          padding: '12px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        {/* Search opponent */}
        <div>
          <label
            htmlFor="history-matchSearch"
            style={{
              display: 'block',
              fontSize: '0.72rem',
              color: 'var(--text-muted)',
              marginBottom: '4px',
              textTransform: 'uppercase',
              fontWeight: 700,
            }}
          >
            Hľadať súpera / tím
          </label>
          <input
            type="text"
            placeholder="Meno alebo tím..."
            id="history-matchSearch"
            value={matchSearch}
            onChange={(e) => setMatchSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-main)',
              fontSize: '0.85rem',
            }}
          />
        </div>

        {/* Season Filter */}
        <div>
          <label
            htmlFor="history-selectedSeasonFilter"
            style={{
              display: 'block',
              fontSize: '0.72rem',
              color: 'var(--text-muted)',
              marginBottom: '4px',
              textTransform: 'uppercase',
              fontWeight: 700,
            }}
          >
            Sezóna
          </label>
          <select
            id="history-selectedSeasonFilter"
            value={selectedSeasonFilter}
            onChange={(e) => setSelectedSeasonFilter(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-main)',
              fontSize: '0.85rem',
            }}
          >
            <option value="all">
              Všetky sezóny ({availableSeasons.length})
            </option>
            {availableSeasons.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {/* League Filter */}
        <div>
          <label
            htmlFor="history-selectedLeagueFilter"
            style={{
              display: 'block',
              fontSize: '0.72rem',
              color: 'var(--text-muted)',
              marginBottom: '4px',
              textTransform: 'uppercase',
              fontWeight: 700,
            }}
          >
            Súťaž / Liga
          </label>
          <select
            id="history-selectedLeagueFilter"
            value={selectedLeagueFilter}
            onChange={(e) => setSelectedLeagueFilter(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-main)',
              fontSize: '0.85rem',
            }}
          >
            <option value="all">
              Všetky súťaže ({availableLeagues.length})
            </option>
            {availableLeagues.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>

        {/* Type Filter */}
        <div>
          <label
            htmlFor="history-selectedTypeFilter"
            style={{
              display: 'block',
              fontSize: '0.72rem',
              color: 'var(--text-muted)',
              marginBottom: '4px',
              textTransform: 'uppercase',
              fontWeight: 700,
            }}
          >
            Typ zápasu
          </label>
          <select
            id="history-selectedTypeFilter"
            value={selectedTypeFilter}
            onChange={(e) => setSelectedTypeFilter(e.target.value as any)}
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-main)',
              fontSize: '0.85rem',
            }}
          >
            <option value="all">Všetky (Dvojhry aj Štvorhry)</option>
            <option value="singles">Iba Dvojhry (1v1)</option>
            <option value="doubles">Iba Štvorhry</option>
          </select>
        </div>
      </div>

      {/* Matches List */}
      <div
        ref={matchHistoryRef}
        className="history-list"
        style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
      >
        {filteredMatches
          .slice(
            (historyPage - 1) * historyPageSize,
            historyPage * historyPageSize,
          )
          .map((m) => {
            const isWin = m.result === 'WIN';
            const isDoubles = m.duelType === 'doubles';

            return (
              <div
                key={m.id}
                style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  borderLeft: `4px solid ${isWin ? '#10b981' : '#ef4444'}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    flexWrap: 'wrap',
                    gap: '8px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span
                      className="badge-pill badge-blue"
                      style={{ fontSize: '0.68rem', padding: '1px 6px' }}
                    >
                      {m.season}
                    </span>
                    <span
                      style={{
                        fontSize: '0.78rem',
                        color: '#38bdf8',
                        fontWeight: 700,
                      }}
                    >
                      {m.leagueName || m.competition}
                    </span>
                    {m.round && (
                      <span
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--text-muted)',
                        }}
                      >
                        • {m.round}
                      </span>
                    )}
                    {m.date && (
                      <span
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--text-dim)',
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        • {m.date}
                      </span>
                    )}
                    {isDoubles && (
                      <span
                        className="badge-pill badge-purple"
                        style={{ fontSize: '0.65rem', padding: '1px 6px' }}
                      >
                        Štvorhra
                      </span>
                    )}
                    {m.isWalkover && (
                      <span
                        className="badge-pill badge-red"
                        style={{ fontSize: '0.65rem', padding: '1px 6px' }}
                      >
                        Kontumácia
                      </span>
                    )}
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                    }}
                  >
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: '4px',
                        background: isWin
                          ? 'rgba(16, 185, 129, 0.2)'
                          : 'rgba(239, 68, 68, 0.2)',
                        color: isWin ? '#34d399' : '#f87171',
                        fontWeight: 800,
                        fontSize: '0.9rem',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      {m.score} ({isWin ? 'VÝHRA' : 'PREHRA'})
                    </span>
                  </div>
                </div>

                {/* Encounter teams & Opponents */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '8px',
                  }}
                >
                  <div>
                    {isDoubles ? (
                      <div style={{ fontSize: '0.92rem' }}>
                        <span
                          style={{
                            color: 'var(--text-dim)',
                            fontSize: '0.78rem',
                          }}
                        >
                          Spoluhráč:{' '}
                        </span>
                        <strong>
                          {(m as any).partnerName || 'Neznámy spoluhráč'}
                        </strong>
                        <span
                          style={{ color: 'var(--text-dim)', margin: '0 6px' }}
                        >
                          vs
                        </span>
                        <span
                          style={{
                            color: 'var(--text-dim)',
                            fontSize: '0.78rem',
                          }}
                        >
                          Súperi:{' '}
                        </span>
                        <strong
                          style={{ color: isWin ? '#34d399' : '#f87171' }}
                        >
                          {m.opponentName}
                        </strong>
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.92rem' }}>
                        <span
                          style={{
                            color: 'var(--text-dim)',
                            fontSize: '0.78rem',
                          }}
                        >
                          Súper:{' '}
                        </span>
                        <strong
                          style={{ color: isWin ? '#34d399' : '#f87171' }}
                        >
                          {m.opponentName}
                        </strong>
                      </div>
                    )}
                    {m.teams && (
                      <div
                        style={{
                          fontSize: '0.78rem',
                          color: 'var(--text-muted)',
                          marginTop: '2px',
                        }}
                      >
                        Stretnutie: {m.teams}
                      </div>
                    )}
                  </div>

                  {m.isPlayerHome !== undefined && (
                    <span
                      style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}
                    >
                      {m.isPlayerHome ? 'Domáci zápas' : 'Zápas vonku'}
                    </span>
                  )}
                </div>

                {/* Set breakdown */}
                <SetBreakdown
                  sets={m.sets || []}
                  setDetails={m.setDetails}
                  totalPointsWon={m.totalPointsWon}
                  totalPointsLost={m.totalPointsLost}
                  result={m.result}
                  compact
                />
              </div>
            );
          })}
      </div>
      {filteredMatches.length === 0 && (
        <p className="history-empty">
          Pre tieto filtre sa nenašli žiadne zápasy.
        </p>
      )}
      {filteredMatches.length > historyPageSize && (
        <nav className="history-pagination" aria-label="Stránkovanie zápasov">
          <button
            className="btn-secondary"
            aria-label="Predchádzajúce zápasy"
            disabled={historyPage === 1}
            onClick={() => goToHistoryPage(historyPage - 1)}
          >
            Predošlé
          </button>
          <span aria-live="polite">
            {(historyPage - 1) * historyPageSize + 1}–
            {Math.min(historyPage * historyPageSize, filteredMatches.length)} z{' '}
            {filteredMatches.length}
          </span>
          <button
            className="btn-secondary"
            aria-label="Ďalšie zápasy"
            disabled={historyPage * historyPageSize >= filteredMatches.length}
            onClick={() => goToHistoryPage(historyPage + 1)}
          >
            Ďalšie
          </button>
        </nav>
      )}
    </div>
  );
};
