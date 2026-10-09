import { useDialog } from '../hooks/useDialog';
import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../context/AppContext';
import { SetBreakdown } from '../components/SetBreakdown';
import { SstzMatchHistory } from '../components/SstzMatchHistory';
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
  Clock,
  UserCheck,
  UserPlus
} from 'lucide-react';
import {
  OpponentProfile,
  Handedness,
  OpponentRubberType,
  PlayStyle,
  MatchRecord,
  DoublesMatchRecord,
  DoublesPartnerStat
} from '../types';

export const OpponentsView: React.FC = () => {
  const {
    opponents,
    updateOpponent,
    matches,
    updateMatchNotes,
    doublesMatches
  } = useApp();

  // Opponent records and complete SSTZ match history
  const [mainMode, setMainMode] = useState<'singles' | 'doubles' | 'history'>('singles');

  // Singles search & filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterHand, setFilterHand] = useState<'all' | Handedness>('all');
  const [filterRubber, setFilterRubber] = useState<'all' | OpponentRubberType>('all');
  const [filterStyle, setFilterStyle] = useState<'all' | PlayStyle>('all');

  // Doubles partner filter state
  const [selectedPartnerFilter, setSelectedPartnerFilter] = useState<string>('all');

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

  // Map pure singles matches by opponent name (normalized lowercase)
  const matchesByOpponent = useMemo(() => {
    const map = new Map<string, MatchRecord[]>();
    for (const m of matches) {
      const oppName = m.opponentName?.trim();
      if (m.opponentUnknown || !oppName || oppName === 'Neznámy súper' || oppName.includes('(Tímový zápas)')) continue;
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

  // Aggregate stats for singles
  const totalOpponents = allOpponentsList.length;
  const totalSinglesMatches = matches.filter(m => m.opponentName && !m.opponentName.includes('(Tímový zápas)')).length;
  const totalSinglesWins = matches.filter(m => m.opponentName && !m.opponentName.includes('(Tímový zápas)') && m.result === 'WIN').length;
  const overallSinglesWinRate = totalSinglesMatches > 0
    ? Math.round((totalSinglesWins / totalSinglesMatches) * 100)
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

  // Aggregate stats for doubles
  const doublesStatsByPartner = useMemo(() => {
    const map = new Map<string, DoublesPartnerStat>();

    for (const dm of doublesMatches) {
      const partner = dm.partnerName?.trim() || 'Neznámy spoluhráč';
      const key = partner.toLowerCase();

      if (!map.has(key)) {
        map.set(key, {
          partnerName: partner,
          partnerId: dm.partnerId,
          matchesCount: 0,
          wins: 0,
          losses: 0,
          winRate: 0,
          matches: []
        });
      }

      const current = map.get(key)!;
      current.matchesCount++;
      if (dm.result === 'WIN') current.wins++;
      else current.losses++;
      current.matches.push(dm);
    }

    const list = Array.from(map.values());
    for (const item of list) {
      item.winRate = item.matchesCount > 0 ? Math.round((item.wins / item.matchesCount) * 100) : 0;
    }
    return list.sort((a, b) => b.matchesCount - a.matchesCount);
  }, [doublesMatches]);

  const totalDoublesMatches = doublesMatches.length;
  const totalDoublesWins = doublesMatches.filter(d => d.result === 'WIN').length;
  const overallDoublesWinRate = totalDoublesMatches > 0
    ? Math.round((totalDoublesWins / totalDoublesMatches) * 100)
    : 0;

  const filteredDoublesMatches = useMemo(() => {
    if (selectedPartnerFilter === 'all') return doublesMatches;
    return doublesMatches.filter(d => (d.partnerName?.trim() || 'Neznámy spoluhráč').toLowerCase() === selectedPartnerFilter.toLowerCase());
  }, [doublesMatches, selectedPartnerFilter]);

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
    return [...list].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [selectedOpponent, matchesByOpponent]);

  const selectedOpponentWins = selectedOpponentMatches.filter(m => m.result === 'WIN').length;
  const selectedOpponentLosses = selectedOpponentMatches.filter(m => m.result === 'LOSS').length;
  const selectedOpponentWinRate = selectedOpponentMatches.length > 0
    ? Math.round((selectedOpponentWins / selectedOpponentMatches.length) * 100)
    : 0;

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

  const dialogRef = useDialog(!!selectedOpponent || isNewOpponentModal, () => { setSelectedOpponent(null); setIsNewOpponentModal(false); setIsEditing(false); });

  return (
    <div className="page-view opponents-view animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* Top Header & Segmented Mode Switch */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h1 style={{ fontSize: '1.45rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
            {mainMode === 'history' ? 'História zápasov' : mainMode === 'singles' ? 'Moji súperi' : 'Štvorhry a spoluhráči'}
          </h1>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {mainMode === 'history' ? 'Všetky ligy a sezóny na jednom mieste' : mainMode === 'singles' ? 'Vzájomná bilancia, sety a body po kliknutí na súpera' : 'Zápasy a bilancia vo štvorhre'}
          </span>
        </div>

        {/* Opponents and match history navigation */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          maxWidth: '100%',
          gap: '4px',
          background: 'var(--bg-card)',
          padding: '3px',
          borderRadius: 'var(--radius-full)',
          border: '1px solid var(--border-subtle)'
        }}>
          <button
            onClick={() => setMainMode('singles')}
            aria-pressed={mainMode === 'singles'}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-full)',
              border: 'none',
              background: mainMode === 'singles' ? 'var(--accent-tt-green)' : 'transparent',
              color: mainMode === 'singles' ? '#fff' : 'var(--text-muted)',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            🏓 Dvojhry ({totalOpponents})
          </button>
          <button
            onClick={() => setMainMode('doubles')}
            aria-pressed={mainMode === 'doubles'}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-full)',
              border: 'none',
              background: mainMode === 'doubles' ? '#38bdf8' : 'transparent',
              color: mainMode === 'doubles' ? '#0f172a' : 'var(--text-muted)',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            👥 Štvorhry ({totalDoublesMatches})
          </button>
          <button
            className="btn-secondary"
            onClick={() => setMainMode('history')}
            aria-pressed={mainMode === 'history'}
            style={{ borderRadius: 'var(--radius-full)', border: 'none', padding: '6px 14px', fontSize: '0.8rem', background: mainMode === 'history' ? 'var(--accent-tt-green)' : 'transparent', color: mainMode === 'history' ? '#fff' : 'var(--text-muted)' }}
          >
            Všetky zápasy
          </button>
        </div>
      </div>

      {mainMode === 'history' && <SstzMatchHistory />}

      {/* ========================================================
          MODE 1: DVOJHRY (SINGLES OPPONENTS DATABASE & SCOUTING)
         ======================================================== */}
      {mainMode === 'singles' && (
        <>
          {/* Global Statistics Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))', gap: '10px' }}>
            <div style={{ background: 'var(--bg-card)', padding: '12px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Súperi (1v1)
              </span>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, marginTop: '2px' }}>
                {totalOpponents}
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                z {totalSinglesMatches} duelov
              </span>
            </div>

            <div style={{ background: 'var(--bg-card)', padding: '12px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Úspešnosť v dvojhre
              </span>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: overallSinglesWinRate >= 50 ? '#34d399' : '#f87171', marginTop: '2px' }}>
                {overallSinglesWinRate}%
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                {totalSinglesWins}V / {totalSinglesMatches - totalSinglesWins}P
              </span>
            </div>

            <div style={{ background: 'var(--bg-card)', padding: '12px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Materiál (Tráva / Sendvič)
              </span>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#f59e0b', marginTop: '2px' }}>
                {allOpponentsList.filter(o => o.forehandRubber !== 'soft' || o.backhandRubber !== 'soft').length}
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                špecifické poťahy
              </span>
            </div>
          </div>

          {/* Search and Filters Bar */}
          <div className="glass-panel" style={{ padding: '14px 16px', borderRadius: 'var(--radius-lg)' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
                <input
                  type="text"
                  placeholder="Hľadať súpera podľa mena alebo klubu..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px 9px 36px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-main)',
                    fontSize: '0.85rem'
                  }}
                />
                <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <select
                  value={filterHand}
                  onChange={e => setFilterHand(e.target.value as any)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-main)',
                    fontSize: '0.8rem',
                    cursor: 'pointer'
                  }}
                >
                  <option value="all">Ruka: Všetci</option>
                  <option value="right">Praváci</option>
                  <option value="left">Ľaváci</option>
                </select>

                <select
                  value={filterRubber}
                  onChange={e => setFilterRubber(e.target.value as any)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-main)',
                    fontSize: '0.8rem',
                    cursor: 'pointer'
                  }}
                >
                  <option value="all">Poťah: Všetky</option>
                  <option value="soft">Soft (hladký)</option>
                  <option value="long_pips">Tráva (dlhé zúbky)</option>
                  <option value="short_pips">Sendvič (krátke zúbky)</option>
                  <option value="antispin">Anti-spin</option>
                </select>

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
                  style={{ padding: '8px 12px', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                >
                  <Plus size={14} /> Nový súper
                </button>
              </div>
            </div>
          </div>

          {/* Opponents Cards Grid */}
          {filteredOpponents.length > 0 ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))',
              gap: '14px'
            }}>
              {filteredOpponents.map(opp => {
                const oppMatches = matchesByOpponent.get(opp.name.toLowerCase().trim()) || [];
                const wins = oppMatches.filter(m => m.result === 'WIN').length;
                const losses = oppMatches.filter(m => m.result === 'LOSS').length;
                const total = wins + losses;
                const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
                const lastMatch = oppMatches[0];

                const seasons = Array.from(new Set(oppMatches.map(m => m.season).filter(Boolean)));

                return (
                  <div
                    key={opp.id}
                    className="glass-panel"
                    onClick={() => handleOpenOpponent(opp, 'matches', false)}
                    style={{
                      padding: '16px',
                      borderRadius: 'var(--radius-lg)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '11px',
                          background: opp.handedness === 'left'
                            ? 'linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)'
                            : 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#fff',
                          fontWeight: 800,
                          fontSize: '1.1rem'
                        }}>
                          {opp.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0 }}>
                            {opp.name}
                          </h3>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {opp.clubName || 'Klub nešpecifikovaný'}
                          </div>
                        </div>
                      </div>

                      <span className={`badge-pill ${opp.handedness === 'left' ? 'badge-purple' : 'badge-blue'}`} style={{ fontSize: '0.66rem' }}>
                        {getHandLabel(opp.handedness)}
                      </span>
                    </div>

                    {/* Rubbers Badges */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                      <span className={`badge-pill ${getRubberBadgeColor(opp.forehandRubber)}`} style={{ fontSize: '0.66rem' }}>
                        FH: {getRubberLabel(opp.forehandRubber)}
                      </span>
                      <span className={`badge-pill ${getRubberBadgeColor(opp.backhandRubber)}`} style={{ fontSize: '0.66rem' }}>
                        BH: {getRubberLabel(opp.backhandRubber)}
                      </span>
                      {opp.playStyle && (
                        <span className="badge-pill badge-gray" style={{ fontSize: '0.66rem' }}>
                          {getStyleLabel(opp.playStyle)}
                        </span>
                      )}
                    </div>

                    {/* Head-to-Head Record */}
                    <div style={{
                      padding: '8px 10px',
                      background: 'rgba(0, 0, 0, 0.25)',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>
                          Vzájomná bilancia
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <strong style={{ fontSize: '1.1rem', color: wins >= losses ? '#34d399' : '#f87171' }}>
                            {wins}V - {losses}P
                          </strong>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            ({winRate}%)
                          </span>
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#38bdf8' }}>
                          {total} {total === 1 ? 'zápas' : total < 5 ? 'zápasy' : 'zápasov'}
                        </span>
                        {seasons.length > 0 && (
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                            {seasons.length} {seasons.length === 1 ? 'sezóna' : 'sezóny'}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Scouting preview */}
                    {opp.notes ? (
                      <div style={{
                        fontSize: '0.78rem',
                        color: 'var(--text-muted)',
                        background: 'rgba(56, 189, 248, 0.06)',
                        borderLeft: '3px solid #38bdf8',
                        padding: '6px 8px',
                        borderRadius: 'var(--radius-sm)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        💡 {opp.notes}
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>
                        Klikni a zapíš si taktiku...
                      </div>
                    )}

                    {/* Footer with action buttons */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: 'var(--text-dim)', paddingTop: '4px', borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <span>{lastMatch ? `Naposledy: ${lastMatch.date}` : 'Bez zápasu'}</span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            handleOpenOpponent(opp, 'scouting', true);
                          }}
                          className="btn-secondary"
                          style={{ padding: '3px 7px', fontSize: '0.7rem' }}
                        >
                          <Edit3 size={11} /> Upraviť
                        </button>
                        <span style={{ color: '#38bdf8', display: 'flex', alignItems: 'center', fontWeight: 600 }}>
                          Zápasy <ChevronRight size={12} />
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="glass-panel" style={{ padding: '30px 20px', textAlign: 'center', borderRadius: 'var(--radius-lg)' }}>
              <Users size={36} color="var(--text-dim)" style={{ margin: '0 auto 10px auto' }} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '4px' }}>
                Žiadni súperi nevyhovujú filtru
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', maxWidth: '420px', margin: '0 auto' }}>
                V sekcii SSTZ Hub si prepoj svoj profil a načítaj všetky minulé sezóny, čím sa automaticky vytvorí kompletný register súperov.
              </p>
            </div>
          )}
        </>
      )}

      {/* ========================================================
          MODE 2: ŠTVORHRY (DOUBLES SECTION & PARTNER STATS)
         ======================================================== */}
      {mainMode === 'doubles' && (
        <>
          {/* Doubles Global Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))', gap: '10px' }}>
            <div style={{ background: 'var(--bg-card)', padding: '12px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Odohrané štvorhry
              </span>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, marginTop: '2px', color: '#38bdf8' }}>
                {totalDoublesMatches}
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                {doublesStatsByPartner.length} rôznych spoluhráčov
              </span>
            </div>

            <div style={{ background: 'var(--bg-card)', padding: '12px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Úspešnosť vo štvorhre
              </span>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: overallDoublesWinRate >= 50 ? '#34d399' : '#f87171', marginTop: '2px' }}>
                {overallDoublesWinRate}%
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                {totalDoublesWins} výhier / {totalDoublesMatches - totalDoublesWins} prehier
              </span>
            </div>
          </div>

          {/* Partners Grid: Bilancia s jednotlivými spoluhráčmi */}
          {doublesStatsByPartner.length > 0 && (
            <div className="glass-panel" style={{ padding: '16px', borderRadius: 'var(--radius-lg)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <UserCheck size={16} color="#34d399" /> Tvoji spoluhráči & Úspešnosť vo štvorhre
                </h3>
                {selectedPartnerFilter !== 'all' && (
                  <button
                    onClick={() => setSelectedPartnerFilter('all')}
                    className="btn-secondary"
                    style={{ padding: '4px 10px', fontSize: '0.72rem' }}
                  >
                    Zrušiť filter spoluhráča
                  </button>
                )}
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 240px), 1fr))',
                gap: '10px'
              }}>
                {doublesStatsByPartner.map(p => {
                  const isSelected = selectedPartnerFilter.toLowerCase() === p.partnerName.toLowerCase();

                  return (
                    <div
                      key={p.partnerName}
                      onClick={() => setSelectedPartnerFilter(isSelected ? 'all' : p.partnerName)}
                      style={{
                        padding: '12px 14px',
                        background: isSelected ? 'rgba(56, 189, 248, 0.15)' : 'var(--bg-card)',
                        border: `1px solid ${isSelected ? '#38bdf8' : 'var(--border-subtle)'}`,
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <strong style={{ fontSize: '0.95rem', color: isSelected ? '#38bdf8' : 'var(--text-main)' }}>
                          {p.partnerName}
                        </strong>
                        <span className={`badge-pill ${p.winRate >= 50 ? 'badge-green' : 'badge-red'}`} style={{ fontSize: '0.68rem' }}>
                          {p.wins}V - {p.losses}P
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        <span>Spoločná úspešnosť: <strong style={{ color: p.winRate >= 50 ? '#34d399' : '#f87171' }}>{p.winRate}%</strong></span>
                        <span>{p.matchesCount} {p.matchesCount === 1 ? 'štvorhra' : p.matchesCount < 5 ? 'štvorhry' : 'štvorhier'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* List of all Doubles Matches */}
          <div className="glass-panel" style={{ padding: '16px', borderRadius: 'var(--radius-lg)' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: '12px' }}>
              Zoznam odohraných štvorhier ({filteredDoublesMatches.length})
              {selectedPartnerFilter !== 'all' && ` • so spoluhráčom ${selectedPartnerFilter}`}
            </h3>

            {filteredDoublesMatches.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {filteredDoublesMatches.map(dm => (
                  <div
                    key={dm.id}
                    style={{
                      padding: '12px 14px',
                      background: 'var(--bg-card)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-subtle)',
                      borderLeft: dm.result === 'WIN' ? '4px solid #10b981' : '4px solid #ef4444'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px', marginBottom: '6px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span className={`badge-pill ${dm.result === 'WIN' ? 'badge-green' : 'badge-red'}`} style={{ fontSize: '0.7rem', fontWeight: 800 }}>
                            {dm.result === 'WIN' ? 'VÝHRA' : 'PREHRA'} {dm.score}
                          </span>
                          {dm.season && (
                            <span className="badge-pill badge-blue" style={{ fontSize: '0.65rem' }}>
                              {dm.season}
                            </span>
                          )}
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                            {dm.date} {dm.round && `(${dm.round})`}
                          </span>
                        </div>

                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '4px' }}>
                          {dm.tournamentName || dm.leagueName || 'SSTZ Liga'}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Spoluhráč: <strong style={{ color: '#38bdf8' }}>{dm.partnerName || 'SSTZ neuvádza'}</strong>
                        </span>
                      </div>
                    </div>

                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                      Súperi: <strong>{dm.opponentPair}</strong>
                    </div>

                    {/* Set breakdown */}
                    <SetBreakdown
                      sets={dm.sets || []}
                      setDetails={dm.setDetails}
                      totalPointsWon={dm.totalPointsWon}
                      totalPointsLost={dm.totalPointsLost}
                      result={dm.result}
                      compact
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Žiadne nájdené štvorhry pre vybrané kritériá.
              </div>
            )}
          </div>
        </>
      )}

      {/* ========================================================
          OPPONENT DETAIL & SCOUTING MODAL (1v1 INDIVIDUAL)
         ======================================================== */}
      {(selectedOpponent || isNewOpponentModal) && createPortal(
        <div
          className="mobile-sheet-container"
          onClick={() => {
            setSelectedOpponent(null);
            setIsNewOpponentModal(false);
            setIsEditing(false);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '16px',
            boxSizing: 'border-box'
          }}
        >
          <div
            className="glass-panel mobile-sheet-content"
            ref={dialogRef} role="dialog" aria-modal="true" aria-label="Súper a skauting" tabIndex={-1}
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '820px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '22px',
              borderRadius: 'var(--radius-xl)',
              background: 'var(--bg-main)',
              border: '1px solid var(--border-subtle)',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.7)',
              boxSizing: 'border-box',
              margin: 'auto'
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '14px',
                  background: (isNewOpponentModal ? editForm.handedness : selectedOpponent?.handedness) === 'left'
                    ? 'linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)'
                    : 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: '1.25rem'
                }}>
                  {(isNewOpponentModal ? editForm.name : selectedOpponent?.name || 'S').split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <h2 style={{ fontSize: '1.35rem', fontWeight: 800 }}>
                      {isNewOpponentModal ? 'Pridať nového súpera' : selectedOpponent?.name}
                    </h2>
                    {!isNewOpponentModal && (
                      <span className={`badge-pill ${selectedOpponent?.handedness === 'left' ? 'badge-purple' : 'badge-blue'}`} style={{ fontSize: '0.66rem' }}>
                        {getHandLabel(selectedOpponent?.handedness || 'unknown')}
                      </span>
                    )}
                  </div>
                  {!isNewOpponentModal && (
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                      {selectedOpponent?.clubName || 'Klub nešpecifikovaný'} {selectedOpponent?.id && `• ID #${selectedOpponent.id}`}
                    </span>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
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
                    style={{ padding: '7px 12px', fontSize: '0.8rem' }}
                  >
                    <Edit3 size={13} /> {isEditing ? 'Hotovo' : 'Upraviť vlastnosti'}
                  </button>
                )}
                <button
                  onClick={() => {
                    setSelectedOpponent(null);
                    setIsNewOpponentModal(false);
                    setIsEditing(false);
                  }}
                  className="btn-secondary"
                  style={{ padding: '7px', borderRadius: 'var(--radius-full)' }}
                >
                  <X size={17} />
                </button>
              </div>
            </div>

            {/* TAB SELECTOR: Matches History vs Scouting */}
            {!isNewOpponentModal && (
              <div className="opponent-modal-tabs" style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
                <button
                  onClick={() => setModalTab('matches')}
                  className={modalTab === 'matches' ? 'btn-primary' : 'btn-secondary'}
                  style={{ padding: '7px 14px', fontSize: '0.82rem' }}
                >
                  <Clock size={14} /> Všetky vzájomné zápasy ({selectedOpponentMatches.length})
                </button>
                <button
                  onClick={() => setModalTab('scouting')}
                  className={modalTab === 'scouting' ? 'btn-primary' : 'btn-secondary'}
                  style={{ padding: '7px 14px', fontSize: '0.82rem' }}
                >
                  <Target size={14} /> Poťahy, ruka a taktika
                </button>
              </div>
            )}

            {/* TAB 1: ALL INDIVIDUAL MATCHES HISTORY */}
            {modalTab === 'matches' && !isNewOpponentModal && (
              <div>
                {/* Head-to-Head summary */}
                <div style={{
                  padding: '12px 16px',
                  background: 'var(--bg-card)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  marginBottom: '14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '10px'
                }}>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>
                      Vzájomná bilancia
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                      <strong style={{ fontSize: '1.25rem', color: selectedOpponentWins >= selectedOpponentLosses ? '#34d399' : '#f87171' }}>
                        {selectedOpponentWins} VÝHIER - {selectedOpponentLosses} PREHIER
                      </strong>
                      <span className="badge-pill badge-green" style={{ fontSize: '0.72rem' }}>
                        {selectedOpponentWinRate}% úspešnosť
                      </span>
                    </div>
                  </div>

                  {distinctCompetitions.seasons.length > 0 && (
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        Sezóny:
                      </span>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end', marginTop: '2px' }}>
                        {distinctCompetitions.seasons.map(s => (
                          <span key={s} className="badge-pill badge-gray" style={{ fontSize: '0.62rem' }}>
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Match List */}
                {selectedOpponentMatches.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {selectedOpponentMatches.map(m => {
                      const isEditingThisMatch = editingMatchId === m.id;

                      return (
                        <div
                          key={m.id}
                          style={{
                            padding: '12px 14px',
                            background: 'var(--bg-card)',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--border-subtle)',
                            borderLeft: m.result === 'WIN' ? '4px solid #10b981' : '4px solid #ef4444'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px', marginBottom: '6px' }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                <span className={`badge-pill ${m.result === 'WIN' ? 'badge-green' : 'badge-red'}`} style={{ fontSize: '0.7rem', fontWeight: 800 }}>
                                  {m.result === 'WIN' ? 'VÝHRA' : 'PREHRA'} {m.score}
                                </span>
                                {m.season && (
                                  <span className="badge-pill badge-blue" style={{ fontSize: '0.65rem' }}>
                                    {m.season}
                                  </span>
                                )}
                                <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                                  {m.date} {m.round && `(${m.round})`}
                                </span>
                              </div>

                              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '4px' }}>
                                {m.tournamentName || m.leagueName || 'SSTZ Liga'}
                              </div>
                              {m.teamHome && m.teamAway && (
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                  {m.teamHome} vs {m.teamAway}
                                </div>
                              )}
                            </div>

                            <button
                              onClick={() => isEditingThisMatch ? handleSaveMatchNotes(m.id) : handleStartEditMatchNotes(m)}
                              className="btn-secondary"
                              style={{ padding: '5px 10px', fontSize: '0.72rem' }}
                            >
                              {isEditingThisMatch ? <Save size={12} /> : <FileText size={12} />}
                              {isEditingThisMatch ? 'Uložiť' : 'Poznámka k zápasu'}
                            </button>
                          </div>

                          {/* Sets breakdown */}
                          <div style={{ margin: '8px 0' }}>
                            <SetBreakdown
                              sets={m.sets || []}
                              setDetails={m.setDetails}
                              totalPointsWon={m.totalPointsWon}
                              totalPointsLost={m.totalPointsLost}
                              result={m.result}
                              compact
                            />
                          </div>

                          {/* Match Tactics / Notes */}
                          {isEditingThisMatch ? (
                            <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px', background: 'rgba(0, 0, 0, 0.3)', padding: '8px 10px', borderRadius: 'var(--radius-sm)' }}>
                              <label style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 700 }}>
                                🎯 Čo fungovalo / čo si vedel hrať v tomto zápase:
                              </label>
                              <input
                                type="text"
                                value={matchTacticsText}
                                onChange={e => setMatchTacticsText(e.target.value)}
                                placeholder="Napr. Rotovaný servis do forhendu, topspin do bekhendu..."
                                style={{
                                  width: '100%',
                                  padding: '7px 10px',
                                  borderRadius: 'var(--radius-sm)',
                                  background: 'var(--bg-card)',
                                  border: '1px solid var(--border-subtle)',
                                  color: 'var(--text-main)',
                                  fontSize: '0.82rem'
                                }}
                              />
                              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                                <button
                                  onClick={() => setEditingMatchId(null)}
                                  className="btn-secondary"
                                  style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                                >
                                  Zrušiť
                                </button>
                                <button
                                  onClick={() => handleSaveMatchNotes(m.id)}
                                  className="btn-primary"
                                  style={{ padding: '4px 10px', fontSize: '0.72rem' }}
                                >
                                  <Save size={12} /> Uložiť
                                </button>
                              </div>
                            </div>
                          ) : (
                            m.tacticsNote && (
                              <div style={{
                                marginTop: '6px',
                                padding: '6px 10px',
                                background: 'rgba(16, 185, 129, 0.08)',
                                borderLeft: '3px solid #10b981',
                                borderRadius: 'var(--radius-sm)',
                                fontSize: '0.8rem',
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
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    Žiadne zaznamenané individuálne zápasy proti tomuto súperovi.
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: SCOUTING ATTRIBUTES (EDIT OR VIEW) */}
            {(modalTab === 'scouting' || isNewOpponentModal) && (
              <div style={{
                background: 'var(--bg-card)',
                padding: '16px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)'
              }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 800, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Shield size={15} color="#38bdf8" /> Herné vlastnosti, ruka a poťahy
                </h4>

                {isEditing || isNewOpponentModal ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {isNewOpponentModal && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '10px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '3px', fontWeight: 700 }}>
                            Meno súpera *
                          </label>
                          <input
                            type="text"
                            value={editForm.name}
                            onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                            placeholder="Meno a priezvisko"
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
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '3px', fontWeight: 700 }}>
                            Klub
                          </label>
                          <input
                            type="text"
                            value={editForm.clubName || ''}
                            onChange={e => setEditForm({ ...editForm, clubName: e.target.value })}
                            placeholder="Napr. STK Vyhne"
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
                        </div>
                      </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: '10px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '3px', fontWeight: 700 }}>
                          Dominantná ruka
                        </label>
                        <select
                          value={editForm.handedness}
                          onChange={e => setEditForm({ ...editForm, handedness: e.target.value as any })}
                          style={{
                            width: '100%',
                            padding: '8px 10px',
                            borderRadius: 'var(--radius-sm)',
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-main)',
                            fontSize: '0.85rem'
                          }}
                        >
                          <option value="right">Pravák</option>
                          <option value="left">Ľavák</option>
                          <option value="unknown">Neznáme</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '3px', fontWeight: 700 }}>
                          Herný štýl
                        </label>
                        <select
                          value={editForm.playStyle}
                          onChange={e => setEditForm({ ...editForm, playStyle: e.target.value as any })}
                          style={{
                            width: '100%',
                            padding: '8px 10px',
                            borderRadius: 'var(--radius-sm)',
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-main)',
                            fontSize: '0.85rem'
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

                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '10px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '3px', fontWeight: 700 }}>
                          Forehand (FH) Poťah
                        </label>
                        <select
                          value={editForm.forehandRubber}
                          onChange={e => setEditForm({ ...editForm, forehandRubber: e.target.value as any })}
                          style={{
                            width: '100%',
                            padding: '8px 10px',
                            borderRadius: 'var(--radius-sm)',
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-main)',
                            fontSize: '0.85rem'
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
                            marginTop: '5px',
                            padding: '6px 8px',
                            borderRadius: 'var(--radius-sm)',
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-main)',
                            fontSize: '0.78rem'
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '3px', fontWeight: 700 }}>
                          Backhand (BH) Poťah
                        </label>
                        <select
                          value={editForm.backhandRubber}
                          onChange={e => setEditForm({ ...editForm, backhandRubber: e.target.value as any })}
                          style={{
                            width: '100%',
                            padding: '8px 10px',
                            borderRadius: 'var(--radius-sm)',
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-main)',
                            fontSize: '0.85rem'
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
                            marginTop: '5px',
                            padding: '6px 8px',
                            borderRadius: 'var(--radius-sm)',
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-main)',
                            fontSize: '0.78rem'
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '3px', fontWeight: 700 }}>
                        Taktické postrehy & Čo na neho hrať (Skauting)
                      </label>
                      <textarea
                        rows={3}
                        value={editForm.notes}
                        onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
                        placeholder="Napr.: Neznáša rýchly hlboký servis do bekhendu. Vyhýbať sa pasívnej hre..."
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border-subtle)',
                          color: 'var(--text-main)',
                          fontSize: '0.85rem',
                          resize: 'vertical'
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', marginTop: '4px' }}>
                      <button
                        onClick={handleSaveOpponent}
                        className="btn-primary"
                        style={{ padding: '7px 16px', fontSize: '0.82rem' }}
                      >
                        <Save size={13} /> Uložiť skauting
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: '10px' }}>
                      <div>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Dominantná ruka</span>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', marginTop: '2px' }}>
                          {getHandLabel(selectedOpponent?.handedness || 'unknown')}
                        </div>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Herný štýl</span>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', marginTop: '2px' }}>
                          {getStyleLabel(selectedOpponent?.playStyle || 'allround')}
                        </div>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Forehand poťah</span>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', marginTop: '2px', color: '#34d399' }}>
                          {getRubberLabel(selectedOpponent?.forehandRubber || 'soft')} {selectedOpponent?.forehandModel && `(${selectedOpponent.forehandModel})`}
                        </div>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Backhand poťah</span>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', marginTop: '2px', color: '#38bdf8' }}>
                          {getRubberLabel(selectedOpponent?.backhandRubber || 'soft')} {selectedOpponent?.backhandModel && `(${selectedOpponent.backhandModel})`}
                        </div>
                      </div>
                    </div>

                    {selectedOpponent?.notes ? (
                      <div style={{
                        padding: '10px 12px',
                        background: 'rgba(56, 189, 248, 0.08)',
                        borderLeft: '4px solid #38bdf8',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.85rem'
                      }}>
                        <strong style={{ color: '#38bdf8', display: 'block', marginBottom: '3px' }}>💡 Taktika na tohto hráča:</strong>
                        {selectedOpponent.notes}
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>
                        Zatiaľ nemáš k tomuto súperovi žiadne taktické poznámky. Klikni na "Upraviť vlastnosti" a napíš si, čo na neho platí!
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>,
        document.body
      )}

    </div>
  );
};
