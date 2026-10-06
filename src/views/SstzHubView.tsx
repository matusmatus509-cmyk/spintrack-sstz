import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { SetBreakdown } from '../components/SetBreakdown';
import {
  Search,
  Shield,
  ShieldCheck,
  RefreshCw,
  Trophy,
  Users,
  CheckCircle2,
  Calendar,
  ExternalLink,
  ChevronRight,
  Flame,
  Award,
  AlertCircle,
  Filter,
  Layers,
  ChevronDown,
  ListOrdered,
  CalendarDays
} from 'lucide-react';
import { LeagueData } from '../types';

// Aktuálna sezóna SSTZ sa začína 1. júla – odvodíme ju z dnešného dátumu,
// aby sa tlačidlo nemuselo upravovať každú sezónu ručne.
const currentSeasonLabel = (() => {
  const now = new Date();
  const y = now.getFullYear();
  const startYear = now.getMonth() >= 6 ? y : y - 1;
  return `${startYear}/${String(startYear + 1).slice(-2)}`;
})();

export const SstzHubView: React.FC = () => {
  const {
    sstzProfile,
    syncSstzPlayer,
    syncTeamSchedule,
    teamSchedule,
    selectedLeagueSlug,
    selectedClubId,
    isSstzLoading,
    sstzError,
    sstzSyncMessage,
    disconnectSstz,
    matches
  } = useApp();

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{
    players: { id: string; name: string; url: string }[];
    clubs: { clubId: string; leagueSlug: string; name: string; url: string }[];
    leagues: { leagueSlug: string; name: string; url: string }[];
  }>({ players: [], clubs: [], leagues: [] });
  const [isSearching, setIsSearching] = useState(false);

  // All 39 regions & 126 Slovak leagues
  const [allLeagues, setAllLeagues] = useState<any[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('SSTZ');
  const [currLeagueSlug, setCurrLeagueSlug] = useState(selectedLeagueSlug || 'sezona-2026-27-joola-extraliga-muzi-sstz');
  const [currClubId, setCurrClubId] = useState(selectedClubId || '');
  const [leagueData, setLeagueData] = useState<LeagueData | null>(null);
  const [isLoadingLeague, setIsLoadingLeague] = useState(false);
  const [activeOpponent, setActiveOpponent] = useState<string | null>(null);
  const [activeLeagueTab, setActiveLeagueTab] = useState<'standings' | 'matches'>('standings');
  const [importAllSeasons, setImportAllSeasons] = useState(true);

  // Load all 126 Slovak leagues on mount
  useEffect(() => {
    fetch('/api/sstz/all-leagues')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setAllLeagues(data);
          // Keep current category or pick first
          const defaultCat = data.find((c: any) => c.category === 'SSTZ') || data[0];
          setActiveCategory(defaultCat.category);
          if (defaultCat.leagues && defaultCat.leagues[0] && !selectedLeagueSlug) {
            setCurrLeagueSlug(defaultCat.leagues[0].slug);
          }
        }
      })
      .catch(err => {
        console.error('Error fetching all leagues:', err);
        fetch('/api/sstz/popular-leagues')
          .then(r => r.json())
          .then(p => setAllLeagues(p))
          .catch(e => console.error(e));
      });
  }, []);

  // Fetch league data (clubs, standings, fixtures) when currLeagueSlug changes
  useEffect(() => {
    if (!currLeagueSlug) return;
    setIsLoadingLeague(true);
    fetch(`/api/sstz/league/${currLeagueSlug}`)
      .then(res => res.json())
      .then(data => {
        setLeagueData(data);
        if (data.clubs && data.clubs.length > 0) {
          if (!currClubId || !data.clubs.some((c: any) => c.clubId === currClubId)) {
            setCurrClubId(data.clubs[0].clubId);
          }
        } else {
          setCurrClubId('');
        }
        setIsLoadingLeague(false);
      })
      .catch(err => {
        console.error('Error fetching league data:', err);
        setIsLoadingLeague(false);
      });
  }, [currLeagueSlug]);

  // Debounced search
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults({ players: [], clubs: [], leagues: [] });
      return;
    }

    const timer = setTimeout(() => {
      setIsSearching(true);
      fetch(`/api/sstz/search?q=${encodeURIComponent(searchQuery)}`)
        .then(res => res.json())
        .then(data => {
          setSearchResults(data);
          setIsSearching(false);
        })
        .catch(err => {
          console.error('Search error:', err);
          setIsSearching(false);
        });
    }, 350);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSelectPlayer = async (playerId: string) => {
    await syncSstzPlayer(playerId, importAllSeasons);
  };

  const handleImportSchedule = async (onlyClub: boolean = true) => {
    if (!currLeagueSlug) return;
    const clubToImport = onlyClub ? currClubId : undefined;
    const ok = await syncTeamSchedule(currLeagueSlug, clubToImport);
    if (ok) {
      alert(onlyClub
        ? 'Rozpis tímu bol úspešne naimportovaný do tvojho kalendára!'
        : 'Rozpis celej súťaže bol úspešne naimportovaný do tvojho kalendára!'
      );
    }
  };

  // Group matches by opponent for Head-to-Head analytics
  const opponentStats = React.useMemo(() => {
    const sstzMatches = matches.filter(m => m.source === 'SSTZ');
    const map = new Map<string, { name: string; wins: number; losses: number; matches: typeof sstzMatches }>();

    for (const m of sstzMatches) {
      const opp = m.opponentName;
      if (!opp || opp === 'Neznámy súper' || opp.includes('(Tímový zápas)')) continue;
      const current = map.get(opp) || { name: opp, wins: 0, losses: 0, matches: [] };
      if (m.result === 'WIN') current.wins++;
      else current.losses++;
      current.matches.push(m);
      map.set(opp, current);
    }

    return Array.from(map.values()).sort((a, b) => (b.wins + b.losses) - (a.wins + a.losses));
  }, [matches]);

  // Current category object
  const currentCategoryObj = allLeagues.find(c => c.category === activeCategory) || allLeagues[0];
  const leaguesInCategory = currentCategoryObj?.leagues || [];

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* Top Compact Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="badge-pill badge-blue" style={{ fontSize: '0.68rem', padding: '1px 6px' }}>
              <Shield size={12} /> SSTZ Oficiálne
            </span>
          </div>
          <h1 style={{ fontSize: '1.45rem', fontWeight: 800, letterSpacing: '-0.02em', marginTop: '2px', marginBottom: '0' }}>
            SSTZ Hub • Ligy & Tabuľky
          </h1>
        </div>

        {sstzProfile && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <button
              onClick={() => syncSstzPlayer(sstzProfile.id, false)}
              disabled={isSstzLoading}
              className="btn-secondary"
              style={{ padding: '6px 10px', fontSize: '0.74rem' }}
              title="Stiahne zápasy len pre aktuálnu sezónu"
            >
              <RefreshCw size={12} /> {currentSeasonLabel}
            </button>
            <button
              onClick={() => syncSstzPlayer(sstzProfile.id, true)}
              disabled={isSstzLoading}
              className="btn-primary"
              style={{ padding: '6px 12px', fontSize: '0.74rem' }}
              title="Stiahne kompletnú históriu zápasov zo všetkých minulých sezón"
            >
              <Trophy size={12} /> Celá kariéra
            </button>
            <button
              onClick={disconnectSstz}
              className="btn-secondary"
              style={{ padding: '6px 10px', fontSize: '0.74rem', color: '#f87171' }}
            >
              Odpojiť
            </button>
          </div>
        )}
      </div>

      {sstzError && (
        <div style={{
          padding: '14px 18px',
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: 'var(--radius-md)',
          color: '#f87171',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '0.9rem'
        }}>
          <AlertCircle size={18} />
          <span>{sstzError}</span>
        </div>
      )}

      {isSstzLoading && sstzSyncMessage && (
        <div style={{
          padding: '10px 18px',
          background: 'rgba(59, 130, 246, 0.12)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          borderRadius: 'var(--radius-md)',
          color: '#60a5fa',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '0.85rem'
        }}>
          <RefreshCw size={14} style={{ animation: isSstzLoading ? 'spin 1.2s linear infinite' : undefined }} />
          <span>{sstzSyncMessage}</span>
        </div>
      )}

      {/* Connected Profile Card */}
      {sstzProfile ? (
        <div className="glass-panel" style={{ padding: '24px 20px', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: '1.5rem',
                fontWeight: 800,
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)'
              }}>
                {sstzProfile.name.split(' ').map(n => n[0]).join('')}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <h2 style={{ fontSize: '1.35rem', fontWeight: 800 }}>{sstzProfile.name}</h2>
                  <span className="badge-pill badge-green" style={{ fontSize: '0.7rem' }}>
                    <ShieldCheck size={13} /> SSTZ ID #{sstzProfile.id}
                  </span>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Zväz: <strong>{sstzProfile.association}</strong> {sstzProfile.clubName && `• Klub: ${sstzProfile.clubName}`}
                </div>
              </div>
            </div>

            <div style={{ textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Posledná synchronizácia:<br />
              <strong>{new Date(sstzProfile.lastSync).toLocaleString('sk-SK')}</strong>
            </div>
          </div>

          {/* Pravdivosť dát: zdroj, overenie, sezóny, upozornenia */}
          {(() => {
            const verification = sstzProfile.verification;
            const source = sstzProfile.source;
            const warnings = sstzProfile.warnings || [];
            const verified = verification?.status === 'verified';
            const checks = verification?.seasons?.flatMap(s => s.checks.map(c => ({ ...c, season: s.label }))) || [];
            const failed = checks.filter(c => !c.ok);

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                <div style={{
                  display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px',
                  fontSize: '0.78rem', color: 'var(--text-muted)'
                }}>
                  <span className="badge-pill" style={{
                    background: verified ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                    color: verified ? '#34d399' : '#fbbf24',
                    border: `1px solid ${verified ? 'rgba(16,185,129,0.35)' : 'rgba(245,158,11,0.35)'}`,
                    fontSize: '0.7rem', padding: '2px 8px'
                  }}>
                    {verified ? <ShieldCheck size={12} /> : <AlertCircle size={12} />}
                    {verified
                      ? `Overené voči oficiálnym súhrnom (${checks.length} kontrol)`
                      : 'NEPOTVRDENÉ – údaje sa nezhodujú s oficiálnym súhrnom'}
                  </span>
                  <span>
                    Zdroj: <strong>{(source?.name || 'stolnytenis.info')}</strong>
                    {source?.publisher ? ` • ${source.publisher}` : ''}
                    {source?.fetchedAt ? ` • načítané ${new Date(source.fetchedAt).toLocaleString('sk-SK')}` : ''}
                    {source?.mode === 'snapshot' ? ' • SNAPSHOT (uložené dáta)' : ' • ŽIVÉ dáta'}
                  </span>
                  {(source?.profileUrl || sstzProfile.profileUrl) && (
                    <a href={source?.profileUrl || sstzProfile.profileUrl} target="_blank" rel="noreferrer" style={{ color: '#38bdf8' }}>
                      overiť na portáli <ExternalLink size={11} style={{ display: 'inline', verticalAlign: '-1px' }} />
                    </a>
                  )}
                </div>

                {failed.length > 0 && (
                  <div style={{
                    padding: '10px 14px', borderRadius: 'var(--radius-md)',
                    background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
                    fontSize: '0.8rem', color: '#fca5a5'
                  }}>
                    <strong>Nezhody s oficiálnym súhrnom ({(failed[0] as any).season}):</strong>
                    <ul style={{ margin: '6px 0 0 18px' }}>
                      {failed.slice(0, 5).map((c, i) => (
                        <li key={i}>
                          {c.name}: portál uvádza <strong>{c.expected ?? c.official ?? '—'}</strong>, aplikácia načítala <strong>{c.actual ?? c.computed ?? '—'}</strong>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {warnings.length > 0 && (
                  <div style={{
                    padding: '10px 14px', borderRadius: 'var(--radius-md)',
                    background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.3)',
                    fontSize: '0.78rem', color: '#fcd34d'
                  }}>
                    <strong>Poznámky k synchronizácii:</strong>
                    <ul style={{ margin: '6px 0 0 18px' }}>
                      {warnings.slice(0, 6).map((w, i) => <li key={i}>{w}</li>)}
                    </ul>
                  </div>
                )}

                {(sstzProfile.seasons || []).length > 0 && (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                      <thead>
                        <tr style={{ color: 'var(--text-dim)', textAlign: 'left' }}>
                          <th style={{ padding: '4px 8px' }}>Sezóna</th>
                          <th style={{ padding: '4px 8px' }}>Súťaže / družstvá</th>
                          <th style={{ padding: '4px 8px' }}>Duelov</th>
                          <th style={{ padding: '4px 8px' }}>Overenie</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(sstzProfile.seasons || []).map((season, i) => (
                          <tr key={i} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                            <td style={{ padding: '4px 8px', fontWeight: 700 }}>{season.label}</td>
                            <td style={{ padding: '4px 8px', color: 'var(--text-muted)' }}>
                              {(season.competitions || []).filter(c => c && c !== 'celý profil').join(', ') || '—'}
                            </td>
                            <td style={{ padding: '4px 8px' }}>{season.matches}</td>
                            <td style={{ padding: '4px 8px', color: season.verification?.verified ? '#34d399' : '#fbbf24' }}>
                              {season.verification?.verified ? '✓ overené' : 'nepotvrdené'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Official SSTZ Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
            <div style={{ background: 'var(--bg-card)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '4px' }}>
                Úspešnosť - Dvojhry
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: sstzProfile.singlesStats.winRate >= 50 ? '#34d399' : '#f87171' }}>
                {sstzProfile.singlesStats.winRate}%
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                {sstzProfile.singlesStats.won} výhier z {sstzProfile.singlesStats.played} zápasov
              </div>
            </div>

            <div style={{ background: 'var(--bg-card)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '4px' }}>
                Bilancia Doma
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#38bdf8' }}>
                {sstzProfile.singlesStats.home ? `${sstzProfile.singlesStats.home.won} z ${sstzProfile.singlesStats.home.total}` : '0 z 0'}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                {sstzProfile.singlesStats.home && sstzProfile.singlesStats.home.total > 0
                  ? `${Math.round((sstzProfile.singlesStats.home.won / sstzProfile.singlesStats.home.total) * 100)}% výhier doma`
                  : 'Bez odohraných zápasov doma'}
              </div>
            </div>

            <div style={{ background: 'var(--bg-card)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '4px' }}>
                Bilancia Vonku
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f59e0b' }}>
                {sstzProfile.singlesStats.away ? `${sstzProfile.singlesStats.away.won} z ${sstzProfile.singlesStats.away.total}` : '0 z 0'}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                {sstzProfile.singlesStats.away && sstzProfile.singlesStats.away.total > 0
                  ? `${Math.round((sstzProfile.singlesStats.away.won / sstzProfile.singlesStats.away.total) * 100)}% výhier vonku`
                  : 'Bez odohraných zápasov vonku'}
              </div>
            </div>

            <div style={{ background: 'var(--bg-card)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '4px' }}>
                Úspešnosť - Štvorhry
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#a855f7' }}>
                {sstzProfile.doublesStats.winRate}%
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                {sstzProfile.doublesStats.won} výhier z {sstzProfile.doublesStats.played}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              V denníku je zapísaných <strong>{matches.filter(m => m.source === 'SSTZ').length}</strong> overených SSTZ duelov.
            </span>
            <a
              href={`https://www.stolnytenis.info/hrac/${sstzProfile.id}`}
              target="_blank"
              rel="noreferrer"
              className="btn-secondary"
              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
            >
              Otvoriť profil na StolnyTenis.info <ExternalLink size={13} />
            </a>
          </div>
        </div>
      ) : (
        /* Player Search Box if not connected */
        <div className="glass-panel" style={{ padding: '24px 20px', borderRadius: 'var(--radius-lg)' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '6px' }}>
            1. Vyhľadaj sa na portáli SSTZ (stolnytenis.info)
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '16px' }}>
            Zadaj svoje priezvisko alebo meno. Systém nájde tvoj profil v oficiálnom registri SSTZ a stiahne tvoju reálnu úspešnosť a všetky odohrané zápasy so setmi a bodmi.
          </p>

          <div style={{ position: 'relative', maxWidth: '500px' }}>
            <input
              type="text"
              placeholder="Napr. Novák, Oráč, Baláž..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 14px 12px 42px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-main)',
                fontSize: '0.95rem'
              }}
            />
            <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              <input
                type="checkbox"
                checked={importAllSeasons}
                onChange={e => setImportAllSeasons(e.target.checked)}
                style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: '#10b981' }}
              />
              <span>Stiahnuť aj minulé sezóny (všetky historické zápasy SSTZ od 2018/19)</span>
            </label>
          </div>

          {isSearching && (
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '12px' }}>
              Prehľadávam register SSTZ...
            </div>
          )}

          {searchResults.players.length > 0 && (
            <div style={{ marginTop: '16px' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>
                Nájdení hráči v registri SSTZ ({searchResults.players.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '280px', overflowY: 'auto' }}>
                {searchResults.players.map(p => (
                  <div
                    key={p.id}
                    onClick={() => handleSelectPlayer(p.id)}
                    style={{
                      padding: '12px 16px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-card)',
                      transition: 'background 0.15s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-card)'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Users size={16} color="#34d399" />
                      <strong style={{ fontSize: '0.95rem' }}>{p.name}</strong>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>SSTZ ID: #{p.id}</span>
                    </div>

                    <button
                      className="btn-primary"
                      style={{ padding: '6px 14px', fontSize: '0.78rem' }}
                    >
                      Prepojiť profil
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ALL TEAMS & LEAGUES SELECTOR (ALL 126 LEAGUES IN SLOVAKIA) */}
      <div className="glass-panel" style={{ padding: '24px 20px', borderRadius: 'var(--radius-lg)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', marginBottom: '6px' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>
              2. Výber Ligy a Tímu (Všetky súťaže SSTZ na Slovensku)
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
              Vyber si z kompletného zoznamu všetkých 126 líg (republikové súťaže SSTZ, krajské a okresné zväzy).
            </p>
          </div>
          <span className="badge-pill badge-green" style={{ fontSize: '0.72rem' }}>
            Dostupných {allLeagues.reduce((acc, c) => acc + (c.leagues?.length || 0), 0)} oficiálnych líg
          </span>
        </div>

        {/* 3 Step Selectors */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px', marginTop: '16px' }}>
          
          {/* 1. Region / Category Dropdown */}
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 700, textTransform: 'uppercase' }}>
              1. Zväz / Región ({allLeagues.length})
            </label>
            <select
              value={activeCategory}
              onChange={e => {
                const newCat = e.target.value;
                setActiveCategory(newCat);
                const catObj = allLeagues.find(c => c.category === newCat);
                if (catObj && catObj.leagues && catObj.leagues[0]) {
                  setCurrLeagueSlug(catObj.leagues[0].slug);
                }
              }}
              style={{
                width: '100%',
                padding: '11px 12px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-main)',
                fontSize: '0.9rem',
                cursor: 'pointer'
              }}
            >
              {allLeagues.map(cat => (
                <option key={cat.category} value={cat.category}>
                  {cat.category} ({cat.leagues?.length || 0})
                </option>
              ))}
            </select>
          </div>

          {/* 2. Specific League Dropdown */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                2. Súťaž / Liga ({leaguesInCategory.length})
              </label>
            </div>
            <select
              value={currLeagueSlug}
              onChange={e => setCurrLeagueSlug(e.target.value)}
              style={{
                width: '100%',
                padding: '11px 12px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-main)',
                fontSize: '0.9rem',
                cursor: 'pointer'
              }}
            >
              {leaguesInCategory.map((l: any) => (
                <option key={l.slug} value={l.slug}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Club / Team Dropdown */}
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 700, textTransform: 'uppercase' }}>
              3. Tvoj Tím / Klub {isLoadingLeague && '(Načítavam...)'}
            </label>
            <select
              value={currClubId}
              onChange={e => setCurrClubId(e.target.value)}
              disabled={isLoadingLeague || !leagueData?.clubs || leagueData.clubs.length === 0}
              style={{
                width: '100%',
                padding: '11px 12px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-main)',
                fontSize: '0.9rem',
                cursor: 'pointer'
              }}
            >
              {leagueData?.clubs && leagueData.clubs.map(c => (
                <option key={c.clubId} value={c.clubId}>
                  {c.clubName}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Action Buttons for Schedule Import */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginTop: '18px' }}>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              onClick={() => handleImportSchedule(true)}
              disabled={isSstzLoading || !currClubId}
              className="btn-primary"
              style={{ padding: '11px 20px', fontSize: '0.88rem' }}
            >
              <Calendar size={16} />
              {isSstzLoading ? 'Sťahujem...' : 'Naimportovať rozpis tímu'}
            </button>

            <button
              onClick={() => handleImportSchedule(false)}
              disabled={isSstzLoading || !currLeagueSlug}
              className="btn-secondary"
              style={{ padding: '11px 18px', fontSize: '0.88rem' }}
            >
              <CalendarDays size={16} />
              Naimportovať celú ligu ({leagueData?.matches?.length || 0} zápasov)
            </button>
          </div>

          {teamSchedule.length > 0 && (
            <span style={{ fontSize: '0.85rem', color: '#34d399', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
              <CheckCircle2 size={16} /> Aktuálne v kalendári: {teamSchedule.length} zápasov
            </span>
          )}
        </div>
      </div>

      {/* OFFICIAL LEAGUE DATA: STANDINGS & MATCHES */}
      {leagueData && (
        <div className="glass-panel" style={{ padding: '24px 20px', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Trophy size={18} color="#f59e0b" />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>
                  {leagueData.title}
                </h3>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Oficiálne výsledky a poradie klubov priamo z databázy SSTZ
              </p>
            </div>

            {/* Toggle Tabs */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setActiveLeagueTab('standings')}
                className={activeLeagueTab === 'standings' ? 'btn-primary' : 'btn-secondary'}
                style={{ padding: '7px 14px', fontSize: '0.82rem' }}
              >
                <ListOrdered size={14} /> Tabuľka ({leagueData.standings?.length || leagueData.clubs?.length || 0})
              </button>
              <button
                onClick={() => setActiveLeagueTab('matches')}
                className={activeLeagueTab === 'matches' ? 'btn-primary' : 'btn-secondary'}
                style={{ padding: '7px 14px', fontSize: '0.82rem' }}
              >
                <CalendarDays size={14} /> Rozpis zápasov ({leagueData.matches?.length || 0})
              </button>
            </div>
          </div>

          {/* TAB 1: STANDINGS TABLE */}
          {activeLeagueTab === 'standings' && (
            <div style={{ overflowX: 'auto' }}>
              {leagueData.standings && leagueData.standings.length > 0 ? (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                      <th style={{ padding: '10px 8px', width: '40px' }}>#</th>
                      <th style={{ padding: '10px 12px' }}>Družstvo / Klub</th>
                      <th style={{ padding: '10px 8px', textAlign: 'center' }}>Z</th>
                      <th style={{ padding: '10px 8px', textAlign: 'center' }}>V</th>
                      <th style={{ padding: '10px 8px', textAlign: 'center' }}>R</th>
                      <th style={{ padding: '10px 8px', textAlign: 'center' }}>P</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center' }}>Skóre</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 800 }}>Body</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leagueData.standings.map(row => {
                      const isSelected = row.clubId === currClubId;
                      return (
                        <tr
                          key={row.clubId}
                          onClick={() => setCurrClubId(row.clubId)}
                          style={{
                            borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                            background: isSelected ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
                            cursor: 'pointer',
                            transition: 'background 0.15s'
                          }}
                          onMouseEnter={e => {
                            if (!isSelected) e.currentTarget.style.background = 'var(--bg-card-hover)';
                          }}
                          onMouseLeave={e => {
                            if (!isSelected) e.currentTarget.style.background = 'transparent';
                          }}
                        >
                          <td style={{ padding: '12px 8px', fontWeight: 700, color: row.position <= 2 ? '#34d399' : 'var(--text-dim)' }}>
                            {row.position}.
                          </td>
                          <td style={{ padding: '12px 12px', fontWeight: 600, color: isSelected ? '#38bdf8' : 'var(--text-main)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {row.clubName}
                              {isSelected && (
                                <span className="badge-pill badge-blue" style={{ fontSize: '0.65rem', padding: '2px 6px' }}>
                                  Vybraný tím
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--text-muted)' }}>{row.played}</td>
                          <td style={{ padding: '12px 8px', textAlign: 'center', color: '#34d399', fontWeight: 700 }}>{row.wins}</td>
                          <td style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--text-muted)' }}>{row.draws}</td>
                          <td style={{ padding: '12px 8px', textAlign: 'center', color: '#f87171' }}>{row.losts}</td>
                          <td style={{ padding: '12px 12px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>{row.score}</td>
                          <td style={{ padding: '12px 12px', textAlign: 'center', fontWeight: 800, fontSize: '0.95rem', color: '#fff' }}>{row.points}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Zoznam klubov v tejto lige ({leagueData.clubs?.length || 0}):
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', marginTop: '12px' }}>
                    {leagueData.clubs?.map(c => (
                      <button
                        key={c.clubId}
                        onClick={() => setCurrClubId(c.clubId)}
                        className={c.clubId === currClubId ? 'btn-primary' : 'btn-secondary'}
                        style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                      >
                        {c.clubName}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: LEAGUE MATCHES */}
          {activeLeagueTab === 'matches' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '500px', overflowY: 'auto' }}>
              {leagueData.matches && leagueData.matches.length > 0 ? (
                leagueData.matches.map(m => (
                  <div
                    key={m.id}
                    style={{
                      padding: '10px 14px',
                      background: 'var(--bg-card)',
                      borderRadius: 'var(--radius-sm)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '12px',
                      borderLeft: m.isPlayed ? '3px solid #10b981' : '3px solid #3b82f6'
                    }}
                  >
                    <div style={{ minWidth: '140px' }}>
                      <span style={{ fontSize: '0.72rem', color: '#38bdf8', fontWeight: 700 }}>
                        {m.round || 'Kolo'}
                      </span>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                        {m.dateTime}
                      </div>
                    </div>

                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', minWidth: '240px' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.9rem', textAlign: 'right', flex: 1 }}>{m.homeTeam}</span>
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: 'var(--radius-sm)',
                        background: m.isPlayed ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                        color: m.isPlayed ? '#34d399' : 'var(--text-dim)',
                        fontWeight: 800,
                        fontSize: '0.95rem',
                        fontFamily: 'var(--font-mono)'
                      }}>
                        {m.isPlayed ? `${m.homeScore}:${m.awayScore}` : 'VS'}
                      </span>
                      <span style={{ fontWeight: 600, fontSize: '0.9rem', textAlign: 'left', flex: 1 }}>{m.awayTeam}</span>
                    </div>

                    <div>
                      {m.protocolUrl && (
                        <a
                          href={m.protocolUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-secondary"
                          style={{ padding: '5px 10px', fontSize: '0.75rem' }}
                        >
                          Zápis <ExternalLink size={12} />
                        </a>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                  Zápasy pre túto ligu sa načítavajú alebo ešte neboli vyžrebované.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Head-to-Head Opponent Records with Set Scores */}
      {opponentStats.length > 0 && (
        <div className="glass-panel" style={{ padding: '24px 20px', borderRadius: 'var(--radius-lg)' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '6px' }}>
            Bilancia proti súperom (Head-to-Head z SSTZ)
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '16px' }}>
            Zoznam hráčov, s ktorými si odohral ligové duely. Kliknutím zobrazíš presné body a sety z každého zápasu.
          </p>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '12px'
          }}>
            {opponentStats.map(opp => {
              const total = opp.wins + opp.losses;
              const winPct = Math.round((opp.wins / total) * 100);
              const isSelected = activeOpponent === opp.name;

              return (
                <div
                  key={opp.name}
                  onClick={() => setActiveOpponent(isSelected ? null : opp.name)}
                  style={{
                    background: isSelected ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-card)',
                    border: `1px solid ${isSelected ? '#10b981' : 'var(--border-subtle)'}`,
                    borderRadius: 'var(--radius-md)',
                    padding: '14px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <strong style={{ fontSize: '1rem' }}>{opp.name}</strong>
                    <span className={`badge-pill ${opp.wins >= opp.losses ? 'badge-green' : 'badge-red'}`} style={{ fontSize: '0.7rem' }}>
                      {opp.wins}V - {opp.losses}P
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    <span>Úspešnosť: <strong style={{ color: winPct >= 50 ? '#34d399' : '#f87171' }}>{winPct}%</strong></span>
                    <span>{total} {total === 1 ? 'zápas' : total < 5 ? 'zápasy' : 'zápasov'}</span>
                  </div>

                  {/* Expanded matches list with SetBreakdown */}
                  {isSelected && (
                    <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {opp.matches.map((m, idx) => (
                        <div key={idx} style={{ background: 'rgba(10, 13, 20, 0.5)', padding: '8px 10px', borderRadius: 'var(--radius-sm)' }}>
                          <div style={{ fontSize: '0.78rem', display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ color: 'var(--text-dim)' }}>{m.date} ({m.round || 'Liga'})</span>
                            <span style={{ fontWeight: 800, color: m.result === 'WIN' ? '#34d399' : '#f87171' }}>
                              {m.score} ({m.result})
                            </span>
                          </div>
                          <SetBreakdown
                            sets={m.sets || []}
                            setDetails={m.setDetails}
                            totalPointsWon={m.totalPointsWon}
                            totalPointsLost={m.totalPointsLost}
                            result={m.result}
                            compact
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
};
