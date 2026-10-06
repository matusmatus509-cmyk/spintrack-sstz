import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  Rubber,
  Blade,
  RacketSetup,
  TrainingSession,
  MatchRecord,
  SSTZProfile,
  TeamScheduleMatch,
  Badge,
  OpponentProfile
} from '../types';
import { INITIAL_BADGES } from '../data/gearCatalog';

interface AppContextType {
  // Equipment
  rackets: RacketSetup[];
  activeRacket: RacketSetup | undefined;
  activeRacketId: string;
  blades: Blade[];
  rubbers: Rubber[];
  setActiveRacket: (id: string) => void;
  addRacket: (racket: Omit<RacketSetup, 'id' | 'dateCreated' | 'totalHours' | 'winCount' | 'lossCount' | 'gpiScore'>) => string;
  updateRacket: (id: string, updates: Partial<RacketSetup>) => void;
  deleteRacket: (id: string) => void;
  addRubber: (rubber: Omit<Rubber, 'id'>) => string;
  updateRubber: (id: string, updates: Partial<Rubber>) => void;
  deleteRubber: (id: string) => void;
  addBlade: (blade: Omit<Blade, 'id'>) => string;
  updateBlade: (id: string, updates: Partial<Blade>) => void;
  deleteBlade: (id: string) => void;
  getRubberHealth: (rubber: Rubber) => { percent: number; status: 'excellent' | 'good' | 'worn' | 'critical'; remainingHours: number };

  // Training & Diary
  trainingSessions: TrainingSession[];
  addTrainingSession: (session: Omit<TrainingSession, 'id'>) => void;
  deleteTrainingSession: (id: string) => void;

  // Matches
  matches: MatchRecord[];
  addMatch: (match: Omit<MatchRecord, 'id'>) => void;
  deleteMatch: (id: string) => void;
  updateMatchNotes: (matchId: string, notes: string, tacticsNote?: string) => void;

  // Opponents Database & Scouting
  opponents: OpponentProfile[];
  updateOpponent: (opponent: OpponentProfile) => void;
  getOpponent: (idOrName: string) => OpponentProfile | undefined;

  // Stopwatch
  isStopwatchRunning: boolean;
  stopwatchSeconds: number;
  startStopwatch: () => void;
  pauseStopwatch: () => void;
  resetStopwatch: () => void;
  saveStopwatchAsSession: (type: TrainingSession['type'], notes: string, intensity?: number) => void;

  // SSTZ Integration
  sstzProfile: SSTZProfile | null;
  teamSchedule: TeamScheduleMatch[];
  selectedLeagueSlug: string;
  selectedClubId: string;
  isSstzLoading: boolean;
  sstzError: string | null;
  syncSstzPlayer: (playerId: string, allSeasons?: boolean) => Promise<boolean>;
  syncTeamSchedule: (leagueSlug: string, clubId?: string) => Promise<boolean>;
  importAllSstzMatchesToDiary: () => number;
  addScheduleMatchToMatches: (scheduleMatch: TeamScheduleMatch, result: 'WIN' | 'LOSS', score: string) => void;
  disconnectSstz: () => void;

  // Gamification & Badges
  badges: Badge[];
  totalPlayHours: number;
  overallWinRate: number;

  // System
  exportData: () => string;
  importData: (jsonStr: string) => boolean;
  resetToDefaults: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'spintrack_sstz_data_v1';

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Initial default inventory
  const defaultBlades: Blade[] = [
    {
      id: 'blade-1',
      brand: 'Butterfly',
      model: 'Viscaria',
      plies: '5 drevo + 2 ALC',
      weightGrams: 87,
      grip: 'FL',
      speed: 93,
      control: 87,
      hoursPlayed: 34.5,
      dateAcquired: '2026-05-10',
      notes: 'Hlavná zbraň pre ligu a turnaje. Skvelá rovnováha a cit.'
    },
    {
      id: 'blade-2',
      brand: 'Stiga',
      model: 'Clipper CR',
      plies: '7 vrstiev drevo',
      weightGrams: 89,
      grip: 'FL',
      speed: 89,
      control: 88,
      hoursPlayed: 12.0,
      dateAcquired: '2026-02-14',
      notes: 'Záložné celodrevené drevo pre tréning kontroly.'
    }
  ];

  const defaultRubbers: Rubber[] = [
    {
      id: 'rubber-1',
      brand: 'Butterfly',
      model: 'Dignics 09C',
      type: 'inverted',
      color: 'black',
      spongeThickness: '2.1mm',
      spongeHardness: 44,
      speed: 92,
      spin: 98,
      control: 89,
      hoursPlayed: 32.5,
      maxRecommendedHours: 80,
      dateInstalled: '2026-08-15',
      notes: 'Forehand poťah na Viscarii. Extrémna rotácia pri servise a topspine.'
    },
    {
      id: 'rubber-2',
      brand: 'Butterfly',
      model: 'Tenergy 05',
      type: 'inverted',
      color: 'red',
      spongeThickness: '2.1mm',
      spongeHardness: 36,
      speed: 94,
      spin: 96,
      control: 85,
      hoursPlayed: 34.0,
      maxRecommendedHours: 75,
      dateInstalled: '2026-08-15',
      notes: 'Backhand poťah na Viscarii. Dynamický prechod zo strednej vzdialenosti.'
    },
    {
      id: 'rubber-3',
      brand: 'Yasaka',
      model: 'Rakza 7',
      type: 'inverted',
      color: 'black',
      spongeThickness: '2.0mm',
      spongeHardness: 45,
      speed: 89,
      spin: 92,
      control: 90,
      hoursPlayed: 12.0,
      maxRecommendedHours: 85,
      dateInstalled: '2026-07-01',
      notes: 'Tréningový poťah.'
    }
  ];

  const defaultRackets: RacketSetup[] = [
    {
      id: 'racket-1',
      name: 'Ligová zostava (Viscaria + D09C / T05)',
      bladeId: 'blade-1',
      forehandRubberId: 'rubber-1',
      backhandRubberId: 'rubber-2',
      isActive: true,
      totalHours: 32.5,
      winCount: 14,
      lossCount: 3,
      gpiScore: 94,
      dateCreated: '2026-08-15'
    },
    {
      id: 'racket-2',
      name: 'Tréningové drevo (Clipper + Rakza 7)',
      bladeId: 'blade-2',
      forehandRubberId: 'rubber-3',
      backhandRubberId: 'rubber-2',
      isActive: false,
      totalHours: 12.0,
      winCount: 4,
      lossCount: 2,
      gpiScore: 82,
      dateCreated: '2026-07-01'
    }
  ];

  const defaultSessions: TrainingSession[] = [
    {
      id: 'session-1',
      date: '2026-09-28T18:00:00.000Z',
      durationMinutes: 90,
      type: 'tréning',
      focusDrills: ['Topspin z behu', 'Príjem servisu krátko', 'Falkenberg cvičenie'],
      racketId: 'racket-1',
      intensity: 4,
      location: 'Klubová herňa STK',
      notes: 'Skvelý cit na forhende, dobré zrýchlenie pri protitopspine.'
    },
    {
      id: 'session-2',
      date: '2026-09-30T17:30:00.000Z',
      durationMinutes: 75,
      type: 'multiball',
      focusDrills: ['Multiball práca nôh', 'Backhand flip cez stôl'],
      racketId: 'racket-1',
      intensity: 5,
      location: 'Klubová herňa STK',
      notes: 'Zamerané na rýchlu reakciu po vlastnom servise.'
    }
  ];

  const defaultMatches: MatchRecord[] = [];

  // Helper to sync opponents list from matches
  const extractOpponentsFromMatches = (matchesList: MatchRecord[], existingOpponents: OpponentProfile[]): OpponentProfile[] => {
    const oppMap = new Map<string, OpponentProfile>();

    for (const opp of existingOpponents) {
      if (opp.name) {
        oppMap.set(opp.name.toLowerCase().trim(), opp);
      }
      if (opp.id) {
        oppMap.set(opp.id.toLowerCase().trim(), opp);
      }
    }

    for (const m of matchesList) {
      const oppName = m.opponentName?.trim();
      if (!oppName || oppName === 'Neznámy súper' || oppName.includes('(Tímový zápas)')) continue;
      const key = oppName.toLowerCase();

      if (!oppMap.has(key)) {
        const newOpp: OpponentProfile = {
          id: m.opponentId || `opp-${Math.random().toString(36).substring(2, 9)}`,
          name: oppName,
          clubName: m.teamAway && m.teamHome ? (m.teamHome.includes(oppName) ? m.teamHome : m.teamAway) : '',
          handedness: 'unknown',
          forehandRubber: 'soft',
          backhandRubber: 'soft',
          playStyle: 'allround',
          notes: '',
          lastUpdated: new Date().toISOString()
        };
        oppMap.set(key, newOpp);
      }
    }

    return Array.from(new Set(oppMap.values()));
  };

  // Load saved state or defaults
  const loadSavedState = () => {
    try {
      const data = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed.matches && Array.isArray(parsed.matches)) {
          parsed.matches = parsed.matches.filter(
            (m: any) => m.id !== 'match-1' && m.id !== 'match-2'
          );
        }
        return parsed;
      }
    } catch (e) {
      console.error('Error loading saved state:', e);
    }
    return null;
  };

  const saved = loadSavedState();

  const [blades, setBlades] = useState<Blade[]>(saved?.blades || defaultBlades);
  const [rubbers, setRubbers] = useState<Rubber[]>(saved?.rubbers || defaultRubbers);
  const [rackets, setRackets] = useState<RacketSetup[]>(saved?.rackets || defaultRackets);
  const [activeRacketId, setActiveRacketId] = useState<string>(saved?.activeRacketId || 'racket-1');
  const [trainingSessions, setTrainingSessions] = useState<TrainingSession[]>(saved?.trainingSessions || defaultSessions);
  const [matches, setMatches] = useState<MatchRecord[]>(saved?.matches || defaultMatches);
  const [opponents, setOpponents] = useState<OpponentProfile[]>(
    extractOpponentsFromMatches(saved?.matches || defaultMatches, saved?.opponents || [])
  );
  const [sstzProfile, setSstzProfile] = useState<SSTZProfile | null>(saved?.sstzProfile || null);
  const [teamSchedule, setTeamSchedule] = useState<TeamScheduleMatch[]>(saved?.teamSchedule || []);
  const [selectedLeagueSlug, setSelectedLeagueSlug] = useState<string>(saved?.selectedLeagueSlug || 'sezona-2026-27-joola-extraliga-muzi-sstz');
  const [selectedClubId, setSelectedClubId] = useState<string>(saved?.selectedClubId || '');
  const [badges, setBadges] = useState<Badge[]>(saved?.badges || INITIAL_BADGES);

  // Loading & error states
  const [isSstzLoading, setIsSstzLoading] = useState(false);
  const [sstzError, setSstzError] = useState<string | null>(null);

  // Stopwatch state
  const [isStopwatchRunning, setIsStopwatchRunning] = useState(false);
  const [stopwatchSeconds, setStopwatchSeconds] = useState(0);

  // Persist to localStorage
  useEffect(() => {
    const dataToSave = {
      blades,
      rubbers,
      rackets,
      activeRacketId,
      trainingSessions,
      matches,
      opponents,
      sstzProfile,
      teamSchedule,
      selectedLeagueSlug,
      selectedClubId,
      badges
    };
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(dataToSave));
    } catch (e) {
      console.warn('Failed to save state to localStorage:', e);
    }
  }, [
    blades,
    rubbers,
    rackets,
    activeRacketId,
    trainingSessions,
    matches,
    opponents,
    sstzProfile,
    teamSchedule,
    selectedLeagueSlug,
    selectedClubId,
    badges
  ]);

  // Stopwatch timer interval
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isStopwatchRunning) {
      interval = setInterval(() => {
        setStopwatchSeconds(s => s + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isStopwatchRunning]);

  // Active racket getter
  const activeRacket = rackets.find(r => r.id === activeRacketId) || rackets[0];

  // Calculate rubber health
  const getRubberHealth = (rubber: Rubber) => {
    const played = rubber.hoursPlayed || 0;
    const max = rubber.maxRecommendedHours || 80;
    const remainingHours = Math.max(0, Math.round((max - played) * 10) / 10);
    const percent = Math.max(0, Math.min(100, Math.round(((max - played) / max) * 100)));

    let status: 'excellent' | 'good' | 'worn' | 'critical' = 'excellent';
    if (percent < 20) {
      status = 'critical';
    } else if (percent < 50) {
      status = 'worn';
    } else if (percent < 80) {
      status = 'good';
    }

    return { percent, status, remainingHours };
  };

  // Switch active racket
  const setActiveRacket = (id: string) => {
    setActiveRacketId(id);
    setRackets(prev =>
      prev.map(r => ({
        ...r,
        isActive: r.id === id
      }))
    );
  };

  // Add racket setup
  const addRacket = (racketData: Omit<RacketSetup, 'id' | 'dateCreated' | 'totalHours' | 'winCount' | 'lossCount' | 'gpiScore'>) => {
    const id = `racket-${Date.now()}`;
    const newRacket: RacketSetup = {
      ...racketData,
      id,
      dateCreated: new Date().toISOString().split('T')[0],
      totalHours: 0,
      winCount: 0,
      lossCount: 0,
      gpiScore: 85
    };
    setRackets(prev => [...prev, newRacket]);
    if (newRacket.isActive) {
      setActiveRacket(id);
    }
    return id;
  };

  const updateRacket = (id: string, updates: Partial<RacketSetup>) => {
    setRackets(prev => prev.map(r => (r.id === id ? { ...r, ...updates } : r)));
  };

  const deleteRacket = (id: string) => {
    setRackets(prev => prev.filter(r => r.id !== id));
    if (activeRacketId === id) {
      const remaining = rackets.filter(r => r.id !== id);
      if (remaining.length > 0) {
        setActiveRacket(remaining[0].id);
      }
    }
  };

  // Rubbers CRUD
  const addRubber = (rubberData: Omit<Rubber, 'id'>) => {
    const id = `rubber-${Date.now()}`;
    const newRubber: Rubber = { ...rubberData, id };
    setRubbers(prev => [...prev, newRubber]);
    return id;
  };

  const updateRubber = (id: string, updates: Partial<Rubber>) => {
    setRubbers(prev => prev.map(r => (r.id === id ? { ...r, ...updates } : r)));
  };

  const deleteRubber = (id: string) => {
    setRubbers(prev => prev.filter(r => r.id !== id));
  };

  // Blades CRUD
  const addBlade = (bladeData: Omit<Blade, 'id'>) => {
    const id = `blade-${Date.now()}`;
    const newBlade: Blade = { ...bladeData, id };
    setBlades(prev => [...prev, newBlade]);
    return id;
  };

  const updateBlade = (id: string, updates: Partial<Blade>) => {
    setBlades(prev => prev.map(b => (b.id === id ? { ...b, ...updates } : b)));
  };

  const deleteBlade = (id: string) => {
    setBlades(prev => prev.filter(b => b.id !== id));
  };

  // Add play hours to rubbers and blade of active racket
  const addHoursToActiveRacket = (hours: number) => {
    if (!activeRacket) return;

    updateRacket(activeRacket.id, {
      totalHours: Math.round((activeRacket.totalHours + hours) * 10) / 10
    });

    if (activeRacket.bladeId) {
      setBlades(prev =>
        prev.map(b =>
          b.id === activeRacket.bladeId
            ? { ...b, hoursPlayed: Math.round((b.hoursPlayed + hours) * 10) / 10 }
            : b
        )
      );
    }

    if (activeRacket.forehandRubberId) {
      setRubbers(prev =>
        prev.map(r =>
          r.id === activeRacket.forehandRubberId
            ? { ...r, hoursPlayed: Math.round((r.hoursPlayed + hours) * 10) / 10 }
            : r
        )
      );
    }

    if (activeRacket.backhandRubberId) {
      setRubbers(prev =>
        prev.map(r =>
          r.id === activeRacket.backhandRubberId
            ? { ...r, hoursPlayed: Math.round((r.hoursPlayed + hours) * 10) / 10 }
            : r
        )
      );
    }
  };

  // Training Sessions
  const addTrainingSession = (sessionData: Omit<TrainingSession, 'id'>) => {
    const id = `session-${Date.now()}`;
    const newSession: TrainingSession = { ...sessionData, id };
    setTrainingSessions(prev => [newSession, ...prev]);

    const hours = sessionData.durationMinutes / 60;
    addHoursToActiveRacket(hours);

    updateBadgeProgress('badge-hours-10', hours);
    updateBadgeProgress('badge-hours-50', hours);
  };

  const deleteTrainingSession = (id: string) => {
    setTrainingSessions(prev => prev.filter(s => s.id !== id));
  };

  // Matches
  const addMatch = (matchData: Omit<MatchRecord, 'id'>) => {
    const id = `match-${Date.now()}`;
    const newMatch: MatchRecord = { ...matchData, id };
    setMatches(prev => {
      const updated = [newMatch, ...prev];
      setOpponents(curOpp => extractOpponentsFromMatches(updated, curOpp));
      return updated;
    });

    addHoursToActiveRacket(0.5);

    if (activeRacket) {
      const isWin = matchData.result === 'WIN';
      const wins = activeRacket.winCount + (isWin ? 1 : 0);
      const losses = activeRacket.lossCount + (isWin ? 0 : 1);
      const total = wins + losses;
      const gpi = Math.round(50 + (wins / total) * 50);

      updateRacket(activeRacket.id, {
        winCount: wins,
        lossCount: losses,
        gpiScore: gpi
      });
    }
  };

  const deleteMatch = (id: string) => {
    setMatches(prev => prev.filter(m => m.id !== id));
  };

  const updateMatchNotes = (matchId: string, notes: string, tacticsNote?: string) => {
    setMatches(prev => prev.map(m => {
      if (m.id === matchId) {
        return {
          ...m,
          notes,
          tacticsNote: tacticsNote !== undefined ? tacticsNote : m.tacticsNote
        };
      }
      return m;
    }));
  };

  // Opponent management
  const updateOpponent = (opponent: OpponentProfile) => {
    setOpponents(prev => {
      const idx = prev.findIndex(o =>
        (opponent.id && o.id === opponent.id) ||
        o.name.toLowerCase().trim() === opponent.name.toLowerCase().trim()
      );
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], ...opponent, lastUpdated: new Date().toISOString() };
        return copy;
      }
      return [...prev, { ...opponent, lastUpdated: new Date().toISOString() }];
    });
  };

  const getOpponent = (idOrName: string) => {
    if (!idOrName) return undefined;
    const lower = idOrName.toLowerCase().trim();
    return opponents.find(o =>
      (o.id && o.id.toLowerCase() === lower) ||
      o.name.toLowerCase().trim() === lower
    );
  };

  // Stopwatch controls
  const startStopwatch = () => setIsStopwatchRunning(true);
  const pauseStopwatch = () => setIsStopwatchRunning(false);
  const resetStopwatch = () => {
    setIsStopwatchRunning(false);
    setStopwatchSeconds(0);
  };

  const saveStopwatchAsSession = (type: TrainingSession['type'], notes: string, intensity: number = 4) => {
    if (stopwatchSeconds < 60) return;
    const durationMinutes = Math.round(stopwatchSeconds / 60);

    addTrainingSession({
      date: new Date().toISOString(),
      durationMinutes,
      type,
      focusDrills: ['Zaznamenaný tréning cez live stopky'],
      racketId: activeRacketId,
      intensity,
      location: 'Tréningová hala',
      notes: notes || 'Tréning zaznamenaný so stopkami SpinTrack.'
    });

    resetStopwatch();
  };

  // SSTZ Integration calls (supports allSeasons: true)
  const syncSstzPlayer = async (playerId: string, allSeasons: boolean = false): Promise<boolean> => {
    setIsSstzLoading(true);
    setSstzError(null);
    try {
      const url = allSeasons
        ? `/api/sstz/player/${playerId}?allSeasons=true`
        : `/api/sstz/player/${playerId}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Chyba pri sťahovaní SSTZ profilu (HTTP ${res.status})`);
      }
      const data = await res.json();

      const profile: SSTZProfile = {
        id: data.id,
        name: data.name,
        association: data.association,
        clubName: data.clubName,
        clubId: data.clubId,
        leagueSlug: selectedLeagueSlug,
        isAllSeasons: !!data.isAllSeasons,
        syncedSeasonsCount: data.syncedSeasonsCount || 1,
        singlesStats: data.singlesStats || data.singles || { won: 0, played: 0, lost: 0, winRate: 0 },
        doublesStats: data.doublesStats || data.doubles || { won: 0, played: 0, lost: 0, winRate: 0 },
        lastSync: new Date().toISOString()
      };

      setSstzProfile(profile);

      if (data.clubId) {
        setSelectedClubId(data.clubId);
      }

      if (data.matches && data.matches.length > 0) {
        const importedMatches: MatchRecord[] = data.matches.map((m: any) => ({
          id: `sstz-${m.id}`,
          date: m.date || new Date().toISOString().split('T')[0],
          season: m.season || '2026/27',
          competition: 'SSTZ Liga',
          round: m.round,
          teamHome: m.teams ? m.teams.split('-')[0]?.trim() : '',
          teamAway: m.teams ? m.teams.split('-')[1]?.trim() : '',
          opponentName: m.opponentName || 'Neznámy súper',
          opponentId: m.opponentId,
          result: m.result === 'WIN' ? 'WIN' : 'LOSS',
          score: m.score || '3:1',
          sets: m.sets || [],
          setDetails: m.setDetails || [],
          totalPointsWon: m.totalPointsWon || 0,
          totalPointsLost: m.totalPointsLost || 0,
          racketId: activeRacketId,
          sstzMatchId: m.id,
          source: 'SSTZ',
          notes: `Importované z SSTZ (${m.teams || ''})`,
          tacticsNote: ''
        }));

        setMatches(prev => {
          const existingIds = new Set(prev.map(p => p.sstzMatchId).filter(Boolean));
          const newToAdd = importedMatches.filter(im => !existingIds.has(im.sstzMatchId));
          const combined = [...newToAdd, ...prev];

          // Auto-update opponents directory
          setOpponents(curOpp => extractOpponentsFromMatches(combined, curOpp));

          return combined;
        });
      }

      updateBadgeProgress('badge-sstz-connected', 1);
      setIsSstzLoading(false);
      return true;
    } catch (err: any) {
      console.error('Error syncing SSTZ player:', err);
      setSstzError(err.message || 'Nepodarilo sa načítať profil z SSTZ.');
      setIsSstzLoading(false);
      return false;
    }
  };

  const syncTeamSchedule = async (leagueSlug: string, clubId?: string): Promise<boolean> => {
    setIsSstzLoading(true);
    setSstzError(null);
    try {
      const url = clubId
        ? `/api/sstz/team-schedule?leagueSlug=${encodeURIComponent(leagueSlug)}&clubId=${encodeURIComponent(clubId)}`
        : `/api/sstz/team-schedule?leagueSlug=${encodeURIComponent(leagueSlug)}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Chyba pri sťahovaní rozpisu (HTTP ${res.status})`);
      }
      const data = await res.json();
      setTeamSchedule(data.matches || []);
      setSelectedLeagueSlug(leagueSlug);
      if (clubId) {
        setSelectedClubId(clubId);
      }
      setIsSstzLoading(false);
      return true;
    } catch (err: any) {
      console.error('Error syncing team schedule:', err);
      setSstzError(err.message || 'Nepodarilo sa načítať rozpis.');
      setIsSstzLoading(false);
      return false;
    }
  };

  const importAllSstzMatchesToDiary = (): number => {
    if (!sstzProfile) return 0;
    return matches.filter(m => m.source === 'SSTZ').length;
  };

  const addScheduleMatchToMatches = (scheduleMatch: TeamScheduleMatch, result: 'WIN' | 'LOSS', score: string) => {
    addMatch({
      date: scheduleMatch.dateTime.split(' ')[0] || new Date().toISOString().split('T')[0],
      competition: 'SSTZ Liga',
      round: scheduleMatch.round,
      teamHome: scheduleMatch.homeTeam,
      teamAway: scheduleMatch.awayTeam,
      opponentName: `${scheduleMatch.awayTeam} (Tímový zápas)`,
      result,
      score,
      sets: [],
      racketId: activeRacketId,
      notes: `Zaznamenaný ligový zápas: ${scheduleMatch.homeTeam} vs ${scheduleMatch.awayTeam}`,
      source: 'SSTZ'
    });
  };

  const disconnectSstz = () => {
    setSstzProfile(null);
    setTeamSchedule([]);
  };

  // Badges update helper
  const updateBadgeProgress = (badgeId: string, addProgress: number) => {
    setBadges(prev =>
      prev.map(b => {
        if (b.id === badgeId) {
          const newProgress = Math.min(b.maxProgress, b.progress + addProgress);
          const unlocked = newProgress >= b.maxProgress && !b.unlockedAt;
          return {
            ...b,
            progress: newProgress,
            unlockedAt: unlocked ? new Date().toISOString().split('T')[0] : b.unlockedAt
          };
        }
        return b;
      })
    );
  };

  // Aggregate stats
  const totalPlayHours = Math.round((trainingSessions.reduce((acc, s) => acc + s.durationMinutes / 60, 0) + matches.length * 0.5) * 10) / 10;
  const overallWins = matches.filter(m => m.result === 'WIN').length;
  const overallWinRate = matches.length > 0 ? Math.round((overallWins / matches.length) * 100) : 0;

  // Export / Import
  const exportData = () => {
    const data = {
      blades,
      rubbers,
      rackets,
      activeRacketId,
      trainingSessions,
      matches,
      opponents,
      sstzProfile,
      teamSchedule,
      selectedLeagueSlug,
      selectedClubId,
      badges,
      exportedAt: new Date().toISOString()
    };
    return JSON.stringify(data, null, 2);
  };

  const importData = (jsonStr: string) => {
    try {
      const data = JSON.parse(jsonStr);
      if (data.blades) setBlades(data.blades);
      if (data.rubbers) setRubbers(data.rubbers);
      if (data.rackets) setRackets(data.rackets);
      if (data.activeRacketId) setActiveRacketId(data.activeRacketId);
      if (data.trainingSessions) setTrainingSessions(data.trainingSessions);
      if (data.matches) setMatches(data.matches);
      if (data.opponents) setOpponents(data.opponents);
      if (data.sstzProfile) setSstzProfile(data.sstzProfile);
      if (data.teamSchedule) setTeamSchedule(data.teamSchedule);
      if (data.selectedLeagueSlug) setSelectedLeagueSlug(data.selectedLeagueSlug);
      if (data.selectedClubId) setSelectedClubId(data.selectedClubId);
      if (data.badges) setBadges(data.badges);
      return true;
    } catch (e) {
      console.error('Import failed:', e);
      return false;
    }
  };

  const resetToDefaults = () => {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    setBlades(defaultBlades);
    setRubbers(defaultRubbers);
    setRackets(defaultRackets);
    setActiveRacketId('racket-1');
    setTrainingSessions(defaultSessions);
    setMatches(defaultMatches);
    setOpponents([]);
    setSstzProfile(null);
    setTeamSchedule([]);
    setBadges(INITIAL_BADGES);
  };

  return (
    <AppContext.Provider
      value={{
        rackets,
        activeRacket,
        activeRacketId,
        blades,
        rubbers,
        setActiveRacket,
        addRacket,
        updateRacket,
        deleteRacket,
        addRubber,
        updateRubber,
        deleteRubber,
        addBlade,
        updateBlade,
        deleteBlade,
        getRubberHealth,
        trainingSessions,
        addTrainingSession,
        deleteTrainingSession,
        matches,
        addMatch,
        deleteMatch,
        updateMatchNotes,
        opponents,
        updateOpponent,
        getOpponent,
        isStopwatchRunning,
        stopwatchSeconds,
        startStopwatch,
        pauseStopwatch,
        resetStopwatch,
        saveStopwatchAsSession,
        sstzProfile,
        teamSchedule,
        selectedLeagueSlug,
        selectedClubId,
        isSstzLoading,
        sstzError,
        syncSstzPlayer,
        syncTeamSchedule,
        importAllSstzMatchesToDiary,
        addScheduleMatchToMatches,
        disconnectSstz,
        badges,
        totalPlayHours,
        overallWinRate,
        exportData,
        importData,
        resetToDefaults
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
