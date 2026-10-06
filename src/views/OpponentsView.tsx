import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { SetBreakdown } from '../components/SetBreakdown';
import {
  Users,
  Search,
  Filter,
  Plus,
  Edit3,
  Check,
  Shield,
  Trophy,
  Target,
  Flame,
  Award,
  Calendar,
  ExternalLink,
  ChevronRight,
  Save,
  X,
  FileText,
  AlertCircle,
  HelpCircle,
  Clock,
  Sparkles,
  Layers,
  ChevronDown
} from 'lucide-react';
import {
  OpponentProfile,
  Handedness,
  OpponentRubberType,
  PlayStyle,
  MatchRecord
} from '../types';

export const OpponentsView: React.FC = () => {
  const { opponents, updateOpponent, matches, updateMatchNotes } = useApp();

  // Search & filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterHand, setFilterHand] = useState<'all' | Handedness>('all');
  const [filterRubber, setFilterRubber] = useState<'all' | OpponentRubberType>('all');
  const [filterStyle, setFilterStyle] = useState<'all' | PlayStyle>('all');

  // Modal states
  const [selectedOpponent, setSelectedOpponent] = useState<OpponentProfile | null>(null);
  const [modalTab, setModalTab] = useState<'matches' | 'scouting'>('matches');
  const [isEditing, setIsEditing] = useState(false);
  const [isNewOpponentModal, setIsNewOpponentModal] = useState(false);

  // Form states for opponent edit
  const [editForm, setEditForm] = useState<OpponentProfile>({
    id: '',
    name: '',
    clubName: '',
    association: 'SSTZ',
    handedness: 'unknown',
    forehandRubber: 'soft',
    backhandRubber: 'soft',
    forehandModel: '',
    backhandModel: '',
    bladeModel: '',
    playStyle: 'allround',
    notes: '',
    strengths: '',
    weaknesses: ''
  });

  // Inline match note edit states
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [matchTacticsText, setMatchTacticsText] = useState('');
  const [matchGeneralNotes, setMatchGeneralNotes] = useState('');

  // Map matches by opponent name (normalized lowercase)
  const matchesByOpponent = useMemo(() => {
    const map = new Map<string, MatchRecord[]>();
    for (const m of matches) {
      const oppName = m.opponentName?.trim();
      if (!oppName || oppName === 'Neznámy súper' || oppName.includes('(Tímový zápas)')) continue;
      const key = oppName.toLowerCase();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    return map;
  }, [matches]);

  // Combined list of opponents (from registered state + any from matches not yet registered)
  const allOpponentsList = useMemo(() => {
    const list: OpponentProfile[] = [...opponents];
    const registeredNames = new Set(opponents.map(o => o.name.toLowerCase().trim()));

    for (const [lowerName, oppMatches] of matchesByOpponent.entries()) {
      if (!registeredNames.has(lowerName)) {
        const sampleMatch = oppMatches[0];
        list.push({
          id: sampleMatch.opponentId || `opp-${Math.random().toString(36).substring(2, 9)}`,
          name: sampleMatch.opponentName,
          clubName: sampleMatch.teamAway && sampleMatch.teamHome ? (sampleMatch.teamHome.includes(sampleMatch.opponentName) ? sampleMatch.teamHome : sampleMatch.teamAway) : '',
          handedness: 'unknown',
          forehandRubber: 'soft',
          backhandRubber: 'soft',
          playStyle: 'allround',
          notes: '',
          lastUpdated: new Date().toISOString()
        });
      }
    }

    return list;
  }, [opponents, matchesByOpponent]);

  // Aggregate stats
  const totalOpponents = allOpponentsList.length;
  const totalMatchesAgainstOpponents = matches.filter(m => m.opponentName && !m.opponentName.includes('(Tímový zápas)')).length;
  const totalWinsAgainstOpponents = matches.filter(m => m.opponentName && !m.opponentName.includes('(Tímový zápas)') && m.result === 'WIN').length;
  const overallOpponentWinRate = totalMatchesAgainstOpponents > 0
    ? Math.round((totalWinsAgainstOpponents / totalMatchesAgainstOpponents) * 100)
    : 0;

  // Filtered opponents list
  const filteredOpponents = useMemo(() => {
    return allOpponentsList.filter(opp => {
      // Search
      const matchesSearch =
        !searchQuery.trim() ||
        opp.name.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        (opp.clubName && opp.clubName.toLowerCase().includes(searchQuery.toLowerCase().trim()));

      // Hand
      const matchesHand = filterHand === 'all' || opp.handedness === filterHand;

      // Rubber
      const matchesRubber =
        filterRubber === 'all' ||
        opp.forehandRubber === filterRubber ||
        opp.backhandRubber === filterRubber;

      // Style
      const matchesStyle = filterStyle === 'all' || opp.playStyle === filterStyle;

      return matchesSearch && matchesHand && matchesRubber && matchesStyle;
    }).sort((a, b) => {
      const aMatches = matchesByOpponent.get(a.name.toLowerCase().trim()) || [];
      const bMatches = matchesByOpponent.get(b.name.toLowerCase().trim()) || [];
      return bMatches.length - aMatches.length;
    });
  }, [allOpponentsList, searchQuery, filterHand, filterRubber, filterStyle, matchesByOpponent]);

  // Open modal for opponent detail
  const handleOpenOpponent = (opp: OpponentProfile, defaultTab: 'matches' | 'scouting' = 'matches', startEditing: boolean = false) => {
    setSelectedOpponent(opp);
    setEditForm(opp);
    setModalTab(defaultTab);
    setIsEditing(startEditing);
  };

  const handleSaveOpponent = () => {
    if (!editForm.name.trim()) return;
    updateOpponent(editForm);
    setSelectedOpponent(editForm);
    setIsEditing(false);
    setIsNewOpponentModal(false);
  };

  const handleStartEditMatchNotes = (match: MatchRecord) => {
    setEditingMatchId(match.id);
    setMatchTacticsText(match.tacticsNote || '');
    setMatchGeneralNotes(match.notes || '');
  };

  const handleSaveMatchNotes = (matchId: string) => {
    updateMatchNotes(matchId, matchGeneralNotes, matchTacticsText);
    setEditingMatchId(null);
  };

  // Helper for badges
  const getHandLabel = (hand: Handedness) => {
    switch (hand) {
      case 'right': return 'Pravák';
      case 'left': return 'Ľavák';
      default: return 'Ruka nezadaná';
    }
  };

  const getRubberLabel = (rubber: OpponentRubberType) => {
    switch (rubber) {
      case 'soft': return 'Soft (hladký)';
      case 'long_pips': return 'Tráva (dlhé zúbky)';
      case 'short_pips': return 'Sendvič (krátke zúbky)';
      case 'antispin': return 'Anti-spin';
      default: return 'Iný poťah';
    }
  };

  const getRubberBadgeColor = (rubber: OpponentRubberType) => {
    switch (rubber) {
      case 'soft': return 'badge-green';
      case 'long_pips': return 'badge-orange';
      case 'short_pips': return 'badge-yellow';
      case 'antispin': return 'badge-red';
      default: return 'badge-blue';
    }
  };

  const getStyleLabel = (style: PlayStyle) => {
    switch (style) {
      case 'attacker': return 'Útočník (topspinár)';
      case 'defender': return 'Obranca (čopár)';
      case 'blocker': return 'Blokár pri stole';
      case 'allround': return 'Allround (všestranný)';
      default: return 'Iný štýl';
    }
  };

  // Selected opponent matches history
  const selectedOpponentMatches = useMemo(() => {
    if (!selectedOpponent) return [];
    const list = matchesByOpponent.get(selectedOpponent.name.toLowerCase().trim()) || [];
    // Sort matches by date descending
    return [...list].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [selectedOpponent, matchesByOpponent]);

  const selectedOpponentWins = selectedOpponentMatches.filter(m => m.result === 'WIN').length;
  const selectedOpponentLosses = selectedOpponentMatches.filter(m => m.result === 'LOSS').length;
  const selectedOpponentWinRate = selectedOpponentMatches.length > 0
    ? Math.round((selectedOpponentWins / selectedOpponentMatches.length) * 100)
    : 0;

  // Distinct leagues and seasons played with this opponent
  const distinctCompetitions = useMemo(() => {
    const leagues = new Set<string>();
    const seasons = new Set<string>();
    for (const m of selectedOpponentMatches) {
      if (m.leagueName) leagues.add(m.leagueName);
      if (m.season) seasons.add(m.season);
    }
    return {
      leagues: Array.from(leagues),
      seasons: Array.from(seasons)
    };
  }, [selectedOpponentMatches]);

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Banner */}
      <div className="glass-panel" style={{
        padding: '24px 20px',
        background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.16) 0%, rgba(18, 24, 36, 0.96) 100%)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span className="badge-pill badge-red" style={{ fontSize: '0.72rem' }}>
                <Target size={14} /> Skauting & Databáza Súperov
              </span>
            </div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '6px' }}>
              Databáza Súperov & Skauting
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '720px' }}>
              Kompletná evidencia všetkých súperov zo všetkých líg a sezón. Eviduj si ich ruku (pravák/ľavák), typ poťahov (soft, tráva, sendvič, anti-spin), herný štýl, silné a slabé stránky a podrobné taktické zápisky z každého odohraného vzájomného duelu.
            </p>
          </div>

          <button
            onClick={() => {
              setEditForm({
                id: `opp-${Date.now()}`,
                name: '',
                clubName: '',
                association: 'SSTZ',
                handedness: 'right',
                forehandRubber: 'soft',
                backhandRubber: 'soft',
                forehandModel: '',
                backhandModel: '',
                bladeModel: '',
                playStyle: 'allround',
                notes: '',
                strengths: '',
                weaknesses: ''
              });
              setIsNewOpponentModal(true);
            }}
            className="btn-primary"
            style={{ padding: '10px 18px', fontSize: '0.88rem' }}
          >
            <Plus size={16} /> Pridať nového súpera
          </button>
        </div>

        {/* Global Statistics Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginTop: '20px' }}>
          <div style={{ background: 'var(--bg-card)', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
              Súperi v databáze
            </span>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '2px' }}>
              {totalOpponents}
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
              z {totalMatchesAgainstOpponents} vzájomných zápasov
            </span>
          </div>

          <div style={{ background: 'var(--bg-card)', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
              Celková úspešnosť proti súperom
            </span>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: overallOpponentWinRate >= 50 ? '#34d399' : '#f87171', marginTop: '2px' }}>
              {overallOpponentWinRate}%
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
              {totalWinsAgainstOpponents} výhier / {totalMatchesAgainstOpponents - totalWinsAgainstOpponents} prehier
            </span>
          </div>

          <div style={{ background: 'var(--bg-card)', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
              Hráči s materiálom (Tráva / Sendvič / Anti)
            </span>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f59e0b', marginTop: '2px' }}>
              {allOpponentsList.filter(o => o.forehandRubber !== 'soft' || o.backhandRubber !== 'soft').length}
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
              evidovaní s neštandardným poťahom
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-panel" style={{ padding: '16px 20px', borderRadius: 'var(--radius-lg)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
          
          {/* Search Input */}
          <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
            <input
              type="text"
              placeholder="Hľadať súpera podľa mena alebo klubu..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px 10px 38px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-main)',
                fontSize: '0.88rem'
              }}
            />
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
          </div>

          {/* Filter Hand */}
          <div style={{ minWidth: '130px' }}>
            <select
              value={filterHand}
              onChange={e => setFilterHand(e.target.value as any)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-main)',
                fontSize: '0.82rem',
                cursor: 'pointer'
              }}
            >
              <option value="all">Ruka: Všetky</option>
              <option value="right">Praváci</option>
              <option value="left">Ľaváci</option>
            </select>
          </div>

          {/* Filter Rubber */}
          <div style={{ minWidth: '150px' }}>
            <select
              value={filterRubber}
              onChange={e => setFilterRubber(e.target.value as any)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-main)',
                fontSize: '0.82rem',
                cursor: 'pointer'
              }}
            >
              <option value="all">Poťah: Všetky</option>
              <option value="soft">Soft (hladký)</option>
              <option value="long_pips">Tráva (dlhé zúbky)</option>
              <option value="short_pips">Sendvič (krátke zúbky)</option>
              <option value="antispin">Anti-spin</option>
            </select>
          </div>

          {/* Filter Style */}
          <div style={{ minWidth: '150px' }}>
            <select
              value={filterStyle}
              onChange={e => setFilterStyle(e.target.value as any)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-main)',
                fontSize: '0.82rem',
                cursor: 'pointer'
              }}
            >
              <option value="all">Štýl: Všetky</option>
              <option value="attacker">Útočník</option>
              <option value="defender">Obranca</option>
              <option value="blocker">Blokár</option>
              <option value="allround">Allround</option>
            </select>
          </div>
        </div>
      </div>

      {/* Opponents Cards Grid */}
      {filteredOpponents.length > 0 ? (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))',
          gap: '16px'
        }}>
          {filteredOpponents.map(opp => {
            const oppMatches = matchesByOpponent.get(opp.name.toLowerCase().trim()) || [];
            const wins = oppMatches.filter(m => m.result === 'WIN').length;
            const losses = oppMatches.filter(m => m.result === 'LOSS').length;
            const total = wins + losses;
            const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
            const lastMatch = oppMatches[0];

            // Unique seasons and leagues played
            const seasons = Array.from(new Set(oppMatches.map(m => m.season).filter(Boolean)));
            const leagues = Array.from(new Set(oppMatches.map(m => m.leagueName).filter(Boolean)));

            return (
              <div
                key={opp.id}
                className="glass-panel"
                onClick={() => handleOpenOpponent(opp, 'matches', false)}
                style={{
                  padding: '18px',
                  borderRadius: 'var(--radius-lg)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  border: '1px solid var(--border-subtle)'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = 'var(--border-subtle)';
                }}
              >
                {/* Header with Name & Hand badge */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '12px',
                      background: opp.handedness === 'left'
                        ? 'linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)'
                        : opp.handedness === 'right'
                        ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)'
                        : 'linear-gradient(135deg, #64748b 0%, #475569 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontWeight: 800,
                      fontSize: '1.15rem',
                      boxShadow: '0 4px 10px rgba(0, 0, 0, 0.25)'
                    }}>
                      {opp.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '2px' }}>
                        {opp.name}
                      </h3>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {opp.clubName || 'Klub nešpecifikovaný'}
                      </div>
                    </div>
                  </div>

                  <span className={`badge-pill ${opp.handedness === 'left' ? 'badge-purple' : opp.handedness === 'right' ? 'badge-blue' : 'badge-gray'}`} style={{ fontSize: '0.68rem' }}>
                    {getHandLabel(opp.handedness)}
                  </span>
                </div>

                {/* Rubbers Badges */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  <span className={`badge-pill ${getRubberBadgeColor(opp.forehandRubber)}`} style={{ fontSize: '0.68rem' }}>
                    FH: {getRubberLabel(opp.forehandRubber)}
                  </span>
                  <span className={`badge-pill ${getRubberBadgeColor(opp.backhandRubber)}`} style={{ fontSize: '0.68rem' }}>
                    BH: {getRubberLabel(opp.backhandRubber)}
                  </span>
                  {opp.playStyle && (
                    <span className="badge-pill badge-gray" style={{ fontSize: '0.68rem' }}>
                      {getStyleLabel(opp.playStyle)}
                    </span>
                  )}
                </div>

                {/* Head-to-Head Record */}
                <div style={{
                  padding: '10px 12px',
                  background: 'rgba(0, 0, 0, 0.25)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>
                      Vzájomná bilancia
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                      <strong style={{ fontSize: '1.15rem', color: wins >= losses ? '#34d399' : '#f87171' }}>
                        {wins}V - {losses}P
                      </strong>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        ({winRate}% výhier)
                      </span>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#38bdf8' }}>
                      {total} {total === 1 ? 'zápas' : total < 5 ? 'zápasy' : 'zápasov'}
                    </span>
                    {seasons.length > 0 && (
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                        {seasons.length} {seasons.length === 1 ? 'sezóna' : 'sezóny'}
                      </div>
                    )}
                  </div>
                </div>

                {/* Scouting note preview */}
                {opp.notes ? (
                  <div style={{
                    fontSize: '0.8rem',
                    color: 'var(--text-muted)',
                    background: 'rgba(56, 189, 248, 0.06)',
                    borderLeft: '3px solid #38bdf8',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    💡 {opp.notes}
                  </div>
                ) : (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>
                    Klikni a zapíš si, čo na tohto hráča platí...
                  </div>
                )}

                {/* Footer with action buttons */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-dim)', paddingTop: '6px', borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <span>{lastMatch ? `Naposledy: ${lastMatch.date} (${lastMatch.season || 'Liga'})` : 'Bez zápasu'}</span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        handleOpenOpponent(opp, 'scouting', true);
                      }}
                      className="btn-secondary"
                      style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                    >
                      <Edit3 size={12} /> Upraviť
                    </button>
                    <span style={{ color: '#38bdf8', display: 'flex', alignItems: 'center', fontWeight: 600 }}>
                      Otvoriť <ChevronRight size={13} />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="glass-panel" style={{ padding: '40px 20px', textAlign: 'center', borderRadius: 'var(--radius-lg)' }}>
          <Users size={40} color="var(--text-dim)" style={{ margin: '0 auto 12px auto' }} />
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '6px' }}>
            Žiadni súperi nevyhovujú filtru
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', maxWidth: '460px', margin: '0 auto' }}>
            Skús upraviť vyhľadávací výraz alebo synchronizuj svoj profil v sekcii SSTZ Hub, odkiaľ sa automaticky načítajú všetci tvoji súperi zo zápasov.
          </p>
        </div>
      )}

      {/* OPPONENT DETAIL & SCOUTING MODAL */}
      {(selectedOpponent || isNewOpponentModal) && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '16px'
        }}>
          <div className="glass-panel" style={{
            width: '100%',
            maxWidth: '820px',
            maxHeight: '92vh',
            overflowY: 'auto',
            padding: '24px',
            borderRadius: 'var(--radius-xl)',
            background: 'var(--bg-main)',
            border: '1px solid var(--border-subtle)',
            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.7)'
          }}>
            
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '14px',
                  background: (isNewOpponentModal ? editForm.handedness : selectedOpponent?.handedness) === 'left'
                    ? 'linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)'
                    : 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: '1.3rem'
                }}>
                  {(isNewOpponentModal ? editForm.name : selectedOpponent?.name || 'S').split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <h2 style={{ fontSize: '1.45rem', fontWeight: 800 }}>
                      {isNewOpponentModal ? 'Pridať nového súpera' : selectedOpponent?.name}
                    </h2>
                    {!isNewOpponentModal && (
                      <span className={`badge-pill ${selectedOpponent?.handedness === 'left' ? 'badge-purple' : 'badge-blue'}`} style={{ fontSize: '0.68rem' }}>
                        {getHandLabel(selectedOpponent?.handedness || 'unknown')}
                      </span>
                    )}
                  </div>
                  {!isNewOpponentModal && (
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      {selectedOpponent?.clubName || 'Klub nešpecifikovaný'} {selectedOpponent?.id && `• ID #${selectedOpponent.id}`}
                    </span>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {!isNewOpponentModal && (
                  <button
                    onClick={() => {
                      if (!isEditing) {
                        setEditForm(selectedOpponent!);
                        setModalTab('scouting');
                      }
                      setIsEditing(!isEditing);
                    }}
                    className={isEditing ? 'btn-primary' : 'btn-secondary'}
                    style={{ padding: '8px 14px', fontSize: '0.82rem' }}
                  >
                    <Edit3 size={14} /> {isEditing ? 'Hotovo' : 'Upraviť vlastnosti'}
                  </button>
                )}
                <button
                  onClick={() => {
                    setSelectedOpponent(null);
                    setIsNewOpponentModal(false);
                    setIsEditing(false);
                  }}
                  className="btn-secondary"
                  style={{ padding: '8px', borderRadius: 'var(--radius-full)' }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* TAB SELECTOR (História zápasov vs Skauting) */}
            {!isNewOpponentModal && (
              <div style={{ display: 'flex', gap: '10px', marginBottom: '18px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px' }}>
                <button
                  onClick={() => setModalTab('matches')}
                  className={modalTab === 'matches' ? 'btn-primary' : 'btn-secondary'}
                  style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                >
                  <Clock size={15} /> Všetky vzájomné zápasy ({selectedOpponentMatches.length})
                </button>
                <button
                  onClick={() => setModalTab('scouting')}
                  className={modalTab === 'scouting' ? 'btn-primary' : 'btn-secondary'}
                  style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                >
                  <Target size={15} /> Skauting, poťahy a taktika
                </button>
              </div>
            )}

            {/* TAB 1: ALL MATCHES HISTORY (FROM ALL LEAGUES & SEASONS) */}
            {modalTab === 'matches' && !isNewOpponentModal && (
              <div>
                {/* Head-to-Head summary banner */}
                <div style={{
                  padding: '14px 18px',
                  background: 'var(--bg-card)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  marginBottom: '16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}>
                  <div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>
                      Celková bilancia vzájomných duelov
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '2px' }}>
                      <strong style={{ fontSize: '1.35rem', color: selectedOpponentWins >= selectedOpponentLosses ? '#34d399' : '#f87171' }}>
                        {selectedOpponentWins} VÝHIER - {selectedOpponentLosses} PREHIER
                      </strong>
                      <span className="badge-pill badge-green" style={{ fontSize: '0.75rem' }}>
                        {selectedOpponentWinRate}% úspešnosť
                      </span>
                    </div>
                  </div>

                  {distinctCompetitions.seasons.length > 0 && (
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Odohrané sezóny:
                      </span>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end', marginTop: '3px' }}>
                        {distinctCompetitions.seasons.map(s => (
                          <span key={s} className="badge-pill badge-gray" style={{ fontSize: '0.65rem' }}>
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Match List */}
                {selectedOpponentMatches.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {selectedOpponentMatches.map(m => {
                      const isEditingThisMatch = editingMatchId === m.id;

                      return (
                        <div
                          key={m.id}
                          style={{
                            padding: '14px 16px',
                            background: 'var(--bg-card)',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--border-subtle)',
                            borderLeft: m.result === 'WIN' ? '4px solid #10b981' : '4px solid #ef4444'
                          }}
                        >
                          {/* Match Header */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <span className={`badge-pill ${m.result === 'WIN' ? 'badge-green' : 'badge-red'}`} style={{ fontSize: '0.72rem', fontWeight: 800 }}>
                                  {m.result === 'WIN' ? 'VÝHRA' : 'PREHRA'} {m.score}
                                </span>
                                {m.season && (
                                  <span className="badge-pill badge-blue" style={{ fontSize: '0.68rem' }}>
                                    Sezóna {m.season}
                                  </span>
                                )}
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                                  {m.date} {m.round && `(${m.round})`}
                                </span>
                              </div>

                              {/* League Name & Teams */}
                              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '4px' }}>
                                {m.leagueName || 'SSTZ Súťaž'}
                              </div>
                              {m.teamHome && m.teamAway && (
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                  Stretnutie: {m.teamHome} vs {m.teamAway}
                                </div>
                              )}
                            </div>

                            <button
                              onClick={() => isEditingThisMatch ? handleSaveMatchNotes(m.id) : handleStartEditMatchNotes(m)}
                              className="btn-secondary"
                              style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                            >
                              {isEditingThisMatch ? <Save size={13} /> : <FileText size={13} />}
                              {isEditingThisMatch ? 'Uložiť poznámku' : 'Poznámka k zápasu'}
                            </button>
                          </div>

                          {/* Set Breakdown */}
                          <div style={{ margin: '10px 0' }}>
                            <SetBreakdown
                              sets={m.sets || []}
                              setDetails={m.setDetails}
                              totalPointsWon={m.totalPointsWon}
                              totalPointsLost={m.totalPointsLost}
                              result={m.result}
                              compact
                            />
                          </div>

                          {/* Match Tactics / Notes editing */}
                          {isEditingThisMatch ? (
                            <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(0, 0, 0, 0.3)', padding: '10px', borderRadius: 'var(--radius-sm)' }}>
                              <label style={{ fontSize: '0.78rem', color: '#38bdf8', fontWeight: 700 }}>
                                🎯 Čo fungovalo / čo si vedel hrať v tomto zápase:
                              </label>
                              <input
                                type="text"
                                value={matchTacticsText}
                                onChange={e => setMatchTacticsText(e.target.value)}
                                placeholder="Napr. Rotovaný servis do forhendu a následný topspin do bekhendu, čop na stôl..."
                                style={{
                                  width: '100%',
                                  padding: '8px 10px',
                                  borderRadius: 'var(--radius-sm)',
                                  background: 'var(--bg-card)',
                                  border: '1px solid var(--border-subtle)',
                                  color: 'var(--text-main)',
                                  fontSize: '0.85rem'
                                }}
                              />
                              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                <button
                                  onClick={() => setEditingMatchId(null)}
                                  className="btn-secondary"
                                  style={{ padding: '5px 10px', fontSize: '0.75rem' }}
                                >
                                  Zrušiť
                                </button>
                                <button
                                  onClick={() => handleSaveMatchNotes(m.id)}
                                  className="btn-primary"
                                  style={{ padding: '5px 12px', fontSize: '0.75rem' }}
                                >
                                  <Save size={13} /> Uložiť
                                </button>
                              </div>
                            </div>
                          ) : (
                            m.tacticsNote && (
                              <div style={{
                                marginTop: '8px',
                                padding: '8px 12px',
                                background: 'rgba(16, 185, 129, 0.08)',
                                borderLeft: '3px solid #10b981',
                                borderRadius: 'var(--radius-sm)',
                                fontSize: '0.82rem',
                                color: 'var(--text-main)'
                              }}>
                                🎯 <strong>Čo fungovalo:</strong> {m.tacticsNote}
                              </div>
                            )
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    Žiadne zaznamenané zápasy proti tomuto súperovi v denníku.
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: SCOUTING & RUBBERS (EDIT / VIEW) */}
            {(modalTab === 'scouting' || isNewOpponentModal) && (
              <div style={{
                background: 'var(--bg-card)',
                padding: '20px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)'
              }}>
                <h4 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Shield size={16} color="#38bdf8" /> Herné vlastnosti, ruka a poťahy
                </h4>

                {isEditing || isNewOpponentModal ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {isNewOpponentModal && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 700 }}>
                            Meno súpera *
                          </label>
                          <input
                            type="text"
                            value={editForm.name}
                            onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                            placeholder="Meno a priezvisko"
                            style={{
                              width: '100%',
                              padding: '9px 12px',
                              borderRadius: 'var(--radius-sm)',
                              background: 'var(--bg-card)',
                              border: '1px solid var(--border-subtle)',
                              color: 'var(--text-main)',
                              fontSize: '0.88rem'
                            }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 700 }}>
                            Klub
                          </label>
                          <input
                            type="text"
                            value={editForm.clubName || ''}
                            onChange={e => setEditForm({ ...editForm, clubName: e.target.value })}
                            placeholder="Napr. STK Vyhne"
                            style={{
                              width: '100%',
                              padding: '9px 12px',
                              borderRadius: 'var(--radius-sm)',
                              background: 'var(--bg-card)',
                              border: '1px solid var(--border-subtle)',
                              color: 'var(--text-main)',
                              fontSize: '0.88rem'
                            }}
                          />
                        </div>
                      </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                      {/* Hand */}
                      <div>
                        <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 700 }}>
                          Dominantná ruka
                        </label>
                        <select
                          value={editForm.handedness}
                          onChange={e => setEditForm({ ...editForm, handedness: e.target.value as any })}
                          style={{
                            width: '100%',
                            padding: '9px 12px',
                            borderRadius: 'var(--radius-sm)',
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-main)',
                            fontSize: '0.88rem'
                          }}
                        >
                          <option value="right">Pravák</option>
                          <option value="left">Ľavák</option>
                          <option value="unknown">Neznáme</option>
                        </select>
                      </div>

                      {/* Playstyle */}
                      <div>
                        <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 700 }}>
                          Herný štýl
                        </label>
                        <select
                          value={editForm.playStyle}
                          onChange={e => setEditForm({ ...editForm, playStyle: e.target.value as any })}
                          style={{
                            width: '100%',
                            padding: '9px 12px',
                            borderRadius: 'var(--radius-sm)',
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-main)',
                            fontSize: '0.88rem'
                          }}
                        >
                          <option value="attacker">Útočník (topspinár)</option>
                          <option value="defender">Obranca (čopár)</option>
                          <option value="blocker">Blokár pri stole</option>
                          <option value="allround">Allround (všestranný)</option>
                          <option value="other">Iný štýl</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      {/* FH Rubber */}
                      <div>
                        <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 700 }}>
                          Forehand (FH) Poťah
                        </label>
                        <select
                          value={editForm.forehandRubber}
                          onChange={e => setEditForm({ ...editForm, forehandRubber: e.target.value as any })}
                          style={{
                            width: '100%',
                            padding: '9px 12px',
                            borderRadius: 'var(--radius-sm)',
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-main)',
                            fontSize: '0.88rem'
                          }}
                        >
                          <option value="soft">Soft (hladký poťah)</option>
                          <option value="long_pips">Tráva (dlhé zúbky)</option>
                          <option value="short_pips">Sendvič (krátke zúbky)</option>
                          <option value="antispin">Anti-spin</option>
                          <option value="other">Iné</option>
                        </select>
                        <input
                          type="text"
                          placeholder="Model (napr. Dignics 09C)"
                          value={editForm.forehandModel || ''}
                          onChange={e => setEditForm({ ...editForm, forehandModel: e.target.value })}
                          style={{
                            width: '100%',
                            marginTop: '6px',
                            padding: '7px 10px',
                            borderRadius: 'var(--radius-sm)',
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-main)',
                            fontSize: '0.82rem'
                          }}
                        />
                      </div>

                      {/* BH Rubber */}
                      <div>
                        <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 700 }}>
                          Backhand (BH) Poťah
                        </label>
                        <select
                          value={editForm.backhandRubber}
                          onChange={e => setEditForm({ ...editForm, backhandRubber: e.target.value as any })}
                          style={{
                            width: '100%',
                            padding: '9px 12px',
                            borderRadius: 'var(--radius-sm)',
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-main)',
                            fontSize: '0.88rem'
                          }}
                        >
                          <option value="soft">Soft (hladký poťah)</option>
                          <option value="long_pips">Tráva (dlhé zúbky)</option>
                          <option value="short_pips">Sendvič (krátke zúbky)</option>
                          <option value="antispin">Anti-spin</option>
                          <option value="other">Iné</option>
                        </select>
                        <input
                          type="text"
                          placeholder="Model (napr. Feint Long II)"
                          value={editForm.backhandModel || ''}
                          onChange={e => setEditForm({ ...editForm, backhandModel: e.target.value })}
                          style={{
                            width: '100%',
                            marginTop: '6px',
                            padding: '7px 10px',
                            borderRadius: 'var(--radius-sm)',
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-main)',
                            fontSize: '0.82rem'
                          }}
                        />
                      </div>
                    </div>

                    {/* Notes / Tactics */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 700 }}>
                        Taktické postrehy & Čo na neho hrať (Skauting)
                      </label>
                      <textarea
                        rows={3}
                        value={editForm.notes}
                        onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
                        placeholder="Napr.: Neznáša rýchly hlboký servis do bekhendu. Pri topspine do forhendu má problém s blokom. Vyhýbať sa pasívnemu čopovaniu do jeho forhendu..."
                        style={{
                          width: '100%',
                          padding: '9px 12px',
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border-subtle)',
                          color: 'var(--text-main)',
                          fontSize: '0.88rem',
                          resize: 'vertical'
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                      <button
                        onClick={handleSaveOpponent}
                        className="btn-primary"
                        style={{ padding: '8px 18px', fontSize: '0.85rem' }}
                      >
                        <Save size={15} /> Uložiť skauting súpera
                      </button>
                    </div>
                  </div>
                ) : (
                  /* View Mode */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                      <div>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Dominantná ruka</span>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', marginTop: '2px' }}>
                          {getHandLabel(selectedOpponent?.handedness || 'unknown')}
                        </div>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Herný štýl</span>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', marginTop: '2px' }}>
                          {getStyleLabel(selectedOpponent?.playStyle || 'allround')}
                        </div>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Forehand poťah</span>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', marginTop: '2px', color: '#34d399' }}>
                          {getRubberLabel(selectedOpponent?.forehandRubber || 'soft')} {selectedOpponent?.forehandModel && `(${selectedOpponent.forehandModel})`}
                        </div>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Backhand poťah</span>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', marginTop: '2px', color: '#38bdf8' }}>
                          {getRubberLabel(selectedOpponent?.backhandRubber || 'soft')} {selectedOpponent?.backhandModel && `(${selectedOpponent.backhandModel})`}
                        </div>
                      </div>
                    </div>

                    {selectedOpponent?.notes ? (
                      <div style={{
                        padding: '12px 14px',
                        background: 'rgba(56, 189, 248, 0.08)',
                        borderLeft: '4px solid #38bdf8',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.88rem'
                      }}>
                        <strong style={{ color: '#38bdf8', display: 'block', marginBottom: '4px' }}>💡 Taktika na tohto hráča:</strong>
                        {selectedOpponent.notes}
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>
                        Zatiaľ nemáš k tomuto súperovi žiadne taktické poznámky. Klikni na "Upraviť vlastnosti" a napíš si, čo na neho platí!
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
};
