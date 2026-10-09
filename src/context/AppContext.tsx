import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  Rubber,
  Blade,
  RacketSetup,
  TrainingSession,
  ActivityRecord,
  ActivityCategory,
  MatchRecord,
  DoublesMatchRecord,
  SSTZProfile,
  SSTZTournamentProfile,
  TeamScheduleMatch,
  Badge,
  OpponentProfile,
  OpponentRubberType
} from '../types';
import { parseTournamentImport, replaceTournamentMatches } from '../utils/tournamentImport';
import { INITIAL_BADGES } from '../data/gearCatalog';

export type SyncKind = 'player' | 'schedule' | 'tournaments';
export interface SyncJob {
  state: 'loading' | 'success' | 'error';
  message: string;
  startedAt: number;
  finishedAt?: number;
}

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

  // Activities & Diary
  activities: ActivityRecord[];
  addActivity: (activity: Omit<ActivityRecord, 'id' | 'createdAt'>) => string;
  updateActivity: (id: string, updates: Partial<ActivityRecord>) => void;
  deleteActivity: (id: string) => void;
  trainingSessions: TrainingSession[];
  addTrainingSession: (session: Omit<TrainingSession, 'id'>) => void;
  deleteTrainingSession: (id: string) => void;

  // Matches
  matches: MatchRecord[];
  addMatch: (match: Omit<MatchRecord, 'id'>) => void;
  deleteMatch: (id: string) => void;
  updateMatchNotes: (matchId: string, notes: string, tacticsNote?: string) => void;

  // Doubles (Štvorhry)
  doublesMatches: DoublesMatchRecord[];
  addDoublesMatch: (match: Omit<DoublesMatchRecord, 'id'>) => void;
  deleteDoublesMatch: (id: string) => void;

  // Opponents Database & Scouting
  opponents: OpponentProfile[];
  updateOpponent: (opponent: OpponentProfile) => void;
  getOpponent: (idOrName: string) => OpponentProfile | undefined;

  syncJobs: Partial<Record<SyncKind, SyncJob>>;

  // SSTZ Integration
  sstzProfile: SSTZProfile | null;
  teamSchedule: TeamScheduleMatch[];
  selectedLeagueSlug: string;
  selectedClubId: string;
  isSstzLoading: boolean;
  sstzError: string | null;
  syncSstzPlayer: (playerId: string, allSeasons?: boolean, showProgress?: boolean) => Promise<boolean>;
  syncTeamSchedule: (leagueSlug: string, clubId?: string, showProgress?: boolean) => Promise<boolean>;
  importAllSstzMatchesToDiary: () => number;
  addScheduleMatchToMatches: (scheduleMatch: TeamScheduleMatch, result: 'WIN' | 'LOSS', score: string) => void;
  disconnectSstz: () => void;

  // SSTZ tournaments use a separate player ID and never replace league matches.
  tournamentProfile: SSTZTournamentProfile | null;
  isTournamentLoading: boolean;
  tournamentError: string | null;
  syncSstzTournaments: (playerId: string, showProgress?: boolean) => Promise<boolean>;

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
      if (m.opponentUnknown || !oppName || oppName === 'Neznámy súper' || oppName.includes('(Tímový zápas)')) continue;
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
  const defaultActivities: ActivityRecord[] = [
    {
      id: 'activity-1',
      category: 'tréning',
      date: '2026-09-28',
      durationMinutes: 90,
      focusDrills: ['Topspin', 'Príjem', 'Práca nôh', 'Rozcvička'],
      location: 'Klubová herňa STK',
      publicNote: 'Skvelý cit na forhende, dobré zrýchlenie pri protitopspine.',
      visibility: 'community',
      addEquipmentWear: true,
      racketId: 'racket-1',
      intensity: 4,
      createdAt: '2026-09-28T18:00:00.000Z'
    },
    {
      id: 'activity-2',
      category: 'tréning',
      date: '2026-09-30',
      durationMinutes: 75,
      focusDrills: ['Multiball', 'Práca nôh', 'Blok / kontra'],
      location: 'Klubová herňa STK',
      publicNote: 'Zamerané na rýchlu reakciu po vlastnom servise.',
      visibility: 'community',
      addEquipmentWear: true,
      racketId: 'racket-1',
      intensity: 5,
      createdAt: '2026-09-30T17:30:00.000Z'
    }
  ];

  const initialActivities: ActivityRecord[] = saved?.activities || (saved?.trainingSessions ? saved.trainingSessions.map((s: any) => ({
    id: s.id,
    category: 'tréning' as ActivityCategory,
    date: s.date ? s.date.split('T')[0] : new Date().toISOString().split('T')[0],
    durationMinutes: s.durationMinutes || 60,
    focusDrills: s.focusDrills || [],
    location: s.location || 'Klubová herňa',
    publicNote: s.notes || '',
    visibility: 'community' as const,
    addEquipmentWear: true,
    racketId: s.racketId,
    intensity: s.intensity || 4,
    createdAt: s.date || new Date().toISOString()
  })) : defaultActivities);

  const [activities, setActivities] = useState<ActivityRecord[]>(initialActivities);
  const [trainingSessions, setTrainingSessions] = useState<TrainingSession[]>(saved?.trainingSessions || defaultSessions);
  const [matches, setMatches] = useState<MatchRecord[]>(saved?.matches || defaultMatches);
  const [doublesMatches, setDoublesMatches] = useState<DoublesMatchRecord[]>(saved?.doublesMatches || []);
  const [opponents, setOpponents] = useState<OpponentProfile[]>(
    extractOpponentsFromMatches(saved?.matches || defaultMatches, saved?.opponents || [])
  );
  const [sstzProfile, setSstzProfile] = useState<SSTZProfile | null>(saved?.sstzProfile || null);
  const [tournamentProfile, setTournamentProfile] = useState<SSTZTournamentProfile | null>(saved?.tournamentProfile || null);
  const [syncJobs, setSyncJobs] = useState<Partial<Record<SyncKind, SyncJob>>>({});
  const runningSyncs = useRef(new Map<SyncKind, { promise: Promise<boolean>; controller: AbortController; showProgress: boolean }>());
  const isTournamentLoading = syncJobs.tournaments?.state === 'loading';
  const [tournamentError, setTournamentError] = useState<string | null>(null);
  const [teamSchedule, setTeamSchedule] = useState<TeamScheduleMatch[]>(saved?.teamSchedule || []);
  const [selectedLeagueSlug, setSelectedLeagueSlug] = useState<string>(saved?.selectedLeagueSlug || 'sezona-2026-27-joola-extraliga-muzi-sstz');
  const [selectedClubId, setSelectedClubId] = useState<string>(saved?.selectedClubId || '');
  const [badges, setBadges] = useState<Badge[]>(saved?.badges || INITIAL_BADGES);

  const [scheduleConnected, setScheduleConnected] = useState(Boolean(saved?.scheduleConnected ?? saved?.teamSchedule?.length));

  // Loading & error states
  const isSstzLoading = syncJobs.player?.state === 'loading' || syncJobs.schedule?.state === 'loading';
  const [sstzError, setSstzError] = useState<string | null>(null);

  // Persist to localStorage
  useEffect(() => {
    const dataToSave = {
      blades,
      rubbers,
      rackets,
      activeRacketId,
      activities,
      trainingSessions,
      matches,
      doublesMatches,
      opponents,
      sstzProfile,
      tournamentProfile,
      teamSchedule,
      selectedLeagueSlug,
      selectedClubId,
      scheduleConnected,
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
    activities,
    trainingSessions,
    matches,
    doublesMatches,
    opponents,
    sstzProfile,
    tournamentProfile,
    teamSchedule,
    selectedLeagueSlug,
    selectedClubId,
    scheduleConnected,
    badges
  ]);

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
  const addHoursToActiveRacket = (hours: number, racket = activeRacket) => {
    if (!racket) return;

    updateRacket(racket.id, {
      totalHours: Math.round((racket.totalHours + hours) * 10) / 10
    });

    if (racket.bladeId) {
      setBlades(prev =>
        prev.map(b =>
          b.id === racket.bladeId
            ? { ...b, hoursPlayed: Math.round((b.hoursPlayed + hours) * 10) / 10 }
            : b
        )
      );
    }

    if (racket.forehandRubberId) {
      setRubbers(prev =>
        prev.map(r =>
          r.id === racket.forehandRubberId
            ? { ...r, hoursPlayed: Math.round((r.hoursPlayed + hours) * 10) / 10 }
            : r
        )
      );
    }

    if (racket.backhandRubberId) {
      setRubbers(prev =>
        prev.map(r =>
          r.id === racket.backhandRubberId
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

  const addDoublesMatch = (matchData: Omit<DoublesMatchRecord, 'id'>) => {
    const id = `doubles-${Date.now()}`;
    const newMatch: DoublesMatchRecord = { ...matchData, id, type: 'doubles' };
    setDoublesMatches(prev => [newMatch, ...prev]);
  };

  const deleteDoublesMatch = (id: string) => {
    setDoublesMatches(prev => prev.filter(m => m.id !== id));
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

  // Activities CRUD
  const addActivity = (activityData: Omit<ActivityRecord, 'id' | 'createdAt'>): string => {
    const id = `act-${Date.now()}`;
    const newActivity: ActivityRecord = {
      ...activityData,
      id,
      createdAt: new Date().toISOString()
    };

    setActivities(prev => [newActivity, ...prev]);

    // Only training activities contribute to the training history.
    const newSession: TrainingSession = {
      id,
      date: newActivity.date,
      durationMinutes: newActivity.durationMinutes,
      type: newActivity.category === 'liga' ? 'liga' : 'tréning',
      focusDrills: newActivity.focusDrills,
      racketId: newActivity.racketId,
      intensity: newActivity.intensity || 4,
      location: newActivity.location,
      notes: [newActivity.publicNote, newActivity.privateNote].filter(Boolean).join(' | ')
    };
    if (newActivity.category === 'tréning') {
      setTrainingSessions(prev => [newSession, ...prev]);
    }

    // Add training wear to the racket chosen in the form.
    if (newActivity.category === 'tréning' && newActivity.addEquipmentWear) {
      const hours = newActivity.durationMinutes / 60;
      const usedRacket = rackets.find(r => r.id === newActivity.racketId);
      if (usedRacket) addHoursToActiveRacket(hours, usedRacket);
    }

    // Auto-register opponent if entered
    if (newActivity.opponentName && newActivity.opponentName.trim()) {
      const oppName = newActivity.opponentName.trim();
      const existing = getOpponent(oppName);

      const rubberMap: Record<string, OpponentRubberType> = {
        'in': 'soft',
        'long_pips': 'long_pips',
        'short_pips': 'short_pips',
        'anti': 'antispin'
      };

      const updatedOpp: OpponentProfile = {
        id: existing?.id || newActivity.opponentId || `opp-${Math.random().toString(36).substring(2, 9)}`,
        name: oppName,
        clubName: existing?.clubName || '',
        association: existing?.association || 'SSTZ',
        handedness: newActivity.opponentGrip ? newActivity.opponentGrip : (existing?.handedness || 'unknown'),
        forehandRubber: newActivity.opponentFhRubber ? (rubberMap[newActivity.opponentFhRubber] || 'soft') : (existing?.forehandRubber || 'soft'),
        backhandRubber: newActivity.opponentBhRubber ? (rubberMap[newActivity.opponentBhRubber] || 'soft') : (existing?.backhandRubber || 'soft'),
        playStyle: existing?.playStyle || 'allround',
        notes: existing?.notes || (newActivity.privateNote ? `Zápis z aktivity: ${newActivity.privateNote}` : ''),
        lastUpdated: new Date().toISOString()
      };
      updateOpponent(updatedOpp);

      // If match score was entered, also save to match records
      if (newActivity.category !== 'tréning' && newActivity.category !== 'podujatie' && newActivity.matchScore && newActivity.matchResult) {
        addMatch({
          date: newActivity.date,
          competition: newActivity.category === 'liga' ? newActivity.leagueName || 'Liga' : (newActivity.category === 'turnaj' ? newActivity.title || 'Turnaj' : 'Priateľský zápas'),
          leagueName: newActivity.category === 'liga' ? newActivity.leagueName : undefined,
          teamHome: newActivity.teamHome,
          teamAway: newActivity.teamAway,
          round: newActivity.round,
          tournamentName: newActivity.category === 'turnaj' ? newActivity.title : undefined,
          category: newActivity.eventCategory,
          opponentName: oppName,
          opponentId: updatedOpp.id,
          result: newActivity.matchResult || 'WIN',
          score: newActivity.matchScore || '3:0',
          sets: [],
          racketId: newActivity.racketId,
          notes: newActivity.publicNote || '',
          tacticsNote: newActivity.privateNote || '',
          source: 'manual'
        });
      }
    }

    if (newActivity.category === 'tréning') {
      const hours = newActivity.durationMinutes / 60;
      updateBadgeProgress('badge-hours-10', hours);
      updateBadgeProgress('badge-hours-50', hours);
    }

    return id;
  };

  const updateActivity = (id: string, updates: Partial<ActivityRecord>) => {
    setActivities(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
  };

  const deleteActivity = (id: string) => {
    setActivities(prev => prev.filter(a => a.id !== id));
    setTrainingSessions(prev => prev.filter(s => s.id !== id));
  };

  // Stopwatch controls (empty stubs for compatibility)
  const isStopwatchRunning = false;
  const stopwatchSeconds = 0;
  const startStopwatch = () => {};
  const pauseStopwatch = () => {};
  const resetStopwatch = () => {};
  const saveStopwatchAsSession = () => {};

  // Applies a full authentic SSTZ profile payload, saving verified matches and updating opponents
  const applySstzPayload = (data: any) => {
    if (!data) return;

    const profile: SSTZProfile = {
      id: data.id.toString(),
      name: data.name || `Hráč #${data.id}`,
      association: data.association || 'SSTZ',
      clubName: data.clubName || '',
      clubId: data.clubId || '',
      leagueSlug: selectedLeagueSlug,
      isAllSeasons: !!data.isAllSeasons,
      syncedSeasonsCount: data.syncedSeasonsCount || (data.seasonsBreakdown ? data.seasonsBreakdown.length : 1),
      seasonsBreakdown: data.seasonsBreakdown || [],
      singlesStats: data.singlesStats || data.singles || { won: 0, played: 0, lost: 0, winRate: 0 },
      doublesStats: data.doublesStats || data.doubles || { won: 0, played: 0, lost: 0, winRate: 0 },
      lastSync: data.syncedAt || new Date().toISOString()
    };

    setSstzProfile(profile);

    if (data.clubId && !scheduleConnected) {
      setSelectedClubId(data.clubId);
    }

    if (Array.isArray(data.matches)) {
      const importedMatches: MatchRecord[] = data.matches.map((m: any) => ({
        id: `sstz-${m.id}`,
        date: m.date || new Date().toISOString().split('T')[0],
        season: m.season || '2026/27',
        competition: m.competition || m.leagueName || 'SSTZ Liga',
        leagueName: m.leagueName || 'SSTZ Liga',
        round: m.round,
        teams: m.teams || '',
        teamHome: m.teams ? m.teams.split('-')[0]?.trim() : '',
        teamAway: m.teams ? m.teams.split('-')[1]?.trim() : '',
        playerClub: m.playerClub || '',
        opponentName: m.opponentName || 'Neznámy súper',
        opponentId: m.opponentId,
        opponentUnknown: m.opponentUnknown,
        result: m.result === 'WIN' ? 'WIN' : 'LOSS',
        score: m.score || '3:0',
        sets: m.sets || [],
        setDetails: m.setDetails || [],
        totalPointsWon: m.totalPointsWon || 0,
        totalPointsLost: m.totalPointsLost || 0,
        racketId: activeRacketId,
        sstzMatchId: m.id,
        source: 'SSTZ',
        isPlayerHome: m.isPlayerHome,
        isWalkover: m.isWalkover,
        notes: `Importované z SSTZ (${m.teams || ''})`,
        tacticsNote: ''
      }));

      setMatches(prev => {
        const nonSstz = prev.filter(p => p.source !== 'SSTZ');
        const previous = new Map(prev.filter(p => p.source === 'SSTZ').map(p => [p.id, p]));
        const combined = [...importedMatches.map(match => {
          const old = previous.get(match.id);
          return old ? { ...match, notes: old.notes, tacticsNote: old.tacticsNote, racketId: old.racketId } : match;
        }), ...nonSstz];
        setOpponents(curOpp => extractOpponentsFromMatches(combined, curOpp));
        return combined;
      });
    }

    if (Array.isArray(data.doublesMatches)) {
      const importedDoubles: DoublesMatchRecord[] = data.doublesMatches.map((dm: any) => ({
        ...dm,
        competition: dm.competition || dm.leagueName || 'SSTZ Liga',
        source: 'SSTZ',
        type: 'doubles' as const
      }));
      setDoublesMatches(prev => {
        const nonSstz = prev.filter(p => p.source !== 'SSTZ');
        const previous = new Map(prev.filter(p => p.source === 'SSTZ').map(p => [p.id, p]));
        return [...importedDoubles.map(match => {
          const old = previous.get(match.id);
          return old ? { ...match, notes: old.notes } : match;
        }), ...nonSstz];
      });
    }

    updateBadgeProgress('badge-sstz-connected', 1);
  };

  // Share in-flight work so automatic refresh and manual imports cannot overlap.
  const runSync = (
    kind: SyncKind, message: string, successMessage: string,
    task: (signal: AbortSignal) => Promise<void>,
    showProgress = true,
  ): Promise<boolean> => {
    const existing = runningSyncs.current.get(kind);
    if (existing) {
      if (showProgress && !existing.showProgress) {
        existing.showProgress = true;
        setSyncJobs(previous => ({ ...previous, [kind]: { state: 'loading', message, startedAt: Date.now() } }));
        if (kind === 'tournaments') setTournamentError(null);
        else setSstzError(null);
      }
      return existing.promise;
    }
    const controller = new AbortController();
    const startedAt = Date.now();
    if (showProgress) {
      setSyncJobs(previous => ({ ...previous, [kind]: { state: 'loading', message, startedAt } }));
      if (kind === 'tournaments') setTournamentError(null);
      else setSstzError(null);
    }
    const promise = (async () => {
      try {
        await task(AbortSignal.any([controller.signal, AbortSignal.timeout(300000)]));
        if (runningSyncs.current.get(kind)?.showProgress) {
          setSyncJobs(previous => ({ ...previous, [kind]: { state: 'success', message: successMessage, startedAt, finishedAt: Date.now() } }));
        }
        return true;
      } catch (error) {
        if (controller.signal.aborted) {
          if (runningSyncs.current.get(kind)?.showProgress) {
            setSyncJobs(previous => { const next = { ...previous }; delete next[kind]; return next; });
          }
          return false;
        }
        const detail = error instanceof Error ? error.message : 'Obnovenie údajov zlyhalo.';
        if (runningSyncs.current.get(kind)?.showProgress) {
          if (kind === 'tournaments') setTournamentError(detail);
          else setSstzError(detail);
          setSyncJobs(previous => ({ ...previous, [kind]: { state: 'error', message: detail, startedAt, finishedAt: Date.now() } }));
        }
        return false;
      } finally {
        runningSyncs.current.delete(kind);
      }
    })();
    runningSyncs.current.set(kind, { promise, controller, showProgress });
    return promise;
  };

  const syncSstzTournaments = (playerId: string, showProgress = true): Promise<boolean> => runSync(
    'tournaments', 'Načítavam turnaje a zápasy zo všetkých sezón…', 'Turnaje a zápasy sú aktualizované.',
    async signal => {
      if (!/^\d+$/.test(playerId)) throw new Error('Zadaj platné SSTZ ID hráča.');
      const response = await fetch(`/api/sstz/tournaments/player/${encodeURIComponent(playerId)}`, { signal, cache: 'no-store' });
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) throw new Error('Turnajový import zatiaľ nie je dostupný na serveri.');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Nepodarilo sa načítať turnaje zo SSTZ.');
      const imported = parseTournamentImport(data, playerId);
      signal.throwIfAborted();
      setMatches(previous => replaceTournamentMatches(previous, imported.matches));
      setDoublesMatches(previous => replaceTournamentMatches(previous, imported.doublesMatches));
      setTournamentProfile(imported.profile);
    }, showProgress,
  );

  useEffect(() => {
    setOpponents(previous => extractOpponentsFromMatches(matches, previous));
  }, [matches]);

  const syncSstzPlayer = (playerId: string, allSeasons = true, showProgress = true): Promise<boolean> => runSync(
    'player', 'Načítavam ligové zápasy a históriu hráča…', 'Ligové zápasy sú aktualizované.',
    async signal => {
      const res = await fetch(`/api/sstz/player/${encodeURIComponent(playerId)}?allSeasons=${allSeasons}`, { signal, cache: 'no-store' });
      if (!res.ok) {
        const failure = await res.json().catch(() => null);
        throw new Error(failure?.error || `Chyba pri sťahovaní SSTZ profilu (HTTP ${res.status})`);
      }
      const data = await res.json();
      if (String(data.id) !== playerId || !Array.isArray(data.matches) || !Array.isArray(data.doublesMatches)) {
        throw new Error('SSTZ neposkytlo úplné údaje hráča. Uložená história zostala zachovaná.');
      }
      signal.throwIfAborted();
      applySstzPayload(data);
    }, showProgress,
  );

  const syncTeamSchedule = (leagueSlug: string, clubId?: string, showProgress = true): Promise<boolean> => runSync(
    'schedule', 'Načítavam ligu, výsledky a rozpis zápasov…', 'Ligový rozpis je aktualizovaný.',
    async signal => {
      const url = clubId
        ? `/api/sstz/team-schedule?leagueSlug=${encodeURIComponent(leagueSlug)}&clubId=${encodeURIComponent(clubId)}`
        : `/api/sstz/team-schedule?leagueSlug=${encodeURIComponent(leagueSlug)}`;
      const res = await fetch(url, { signal, cache: 'no-store' });
      if (!res.ok) throw new Error(`Chyba pri sťahovaní rozpisu (HTTP ${res.status})`);
      const data = await res.json();
      if (!Array.isArray(data.matches)) throw new Error('SSTZ neposkytlo úplný rozpis. Uložené zápasy zostali zachované.');
      signal.throwIfAborted();
      setTeamSchedule(data.matches);
      setSelectedLeagueSlug(leagueSlug);
      setSelectedClubId(clubId || '');
      setScheduleConnected(true);
    }, showProgress,
  );

  // Initial refresh runs once, including under StrictMode. Resume refreshes are throttled.
  const didRefreshOnOpen = useRef(false);
  const lastAutoRefresh = useRef(0);
  const refreshConnected = useRef(() => {});
  refreshConnected.current = () => {
    if (!navigator.onLine || Date.now() - lastAutoRefresh.current < 60000) return;
    lastAutoRefresh.current = Date.now();
    if (sstzProfile) void syncSstzPlayer(sstzProfile.id, true, false);
    if (tournamentProfile) void syncSstzTournaments(tournamentProfile.id, false);
    if (scheduleConnected && selectedLeagueSlug) void syncTeamSchedule(selectedLeagueSlug, selectedClubId || undefined, false);
  };
  useEffect(() => {
    if (!didRefreshOnOpen.current) {
      didRefreshOnOpen.current = true;
      refreshConnected.current();
    }
    let hiddenAt = document.hidden ? Date.now() : 0;
    const resume = () => {
      if (document.hidden) hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt >= 60000) refreshConnected.current();
    };
    const online = () => refreshConnected.current();
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('online', online);
    return () => {
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('online', online);
    };
  }, []);

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
    runningSyncs.current.get('player')?.controller.abort();
    runningSyncs.current.get('schedule')?.controller.abort();
    setScheduleConnected(false);
    setSelectedClubId('');
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
  const totalPlayHours = Math.round((activities.reduce((acc, a) => acc + (a.durationMinutes || 0) / 60, 0) + matches.length * 0.5) * 10) / 10;
  const overallWins = matches.filter(m => m.result === 'WIN').length;
  const overallWinRate = matches.length > 0 ? Math.round((overallWins / matches.length) * 100) : 0;

  // Export / Import
  const exportData = () => {
    const data = {
      blades,
      rubbers,
      rackets,
      activeRacketId,
      activities,
      trainingSessions,
      matches,
      doublesMatches,
      opponents,
      sstzProfile,
      tournamentProfile,
      teamSchedule,
      selectedLeagueSlug,
      selectedClubId,
      scheduleConnected,
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
      if (data.activities) setActivities(data.activities);
      if (data.trainingSessions) setTrainingSessions(data.trainingSessions);
      if (data.matches) setMatches(data.matches);
      if (data.doublesMatches) setDoublesMatches(data.doublesMatches);
      if (data.opponents) setOpponents(data.opponents);
      if (data.tournamentProfile !== undefined) setTournamentProfile(data.tournamentProfile);
      if (data.sstzProfile) setSstzProfile(data.sstzProfile);
      if (data.teamSchedule) setTeamSchedule(data.teamSchedule);
      setScheduleConnected(Boolean(data.scheduleConnected ?? data.teamSchedule?.length));
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
    runningSyncs.current.forEach(job => job.controller.abort());
    setScheduleConnected(false);
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    setBlades(defaultBlades);
    setRubbers(defaultRubbers);
    setRackets(defaultRackets);
    setActiveRacketId('racket-1');
    setActivities(defaultActivities);
    setTrainingSessions(defaultSessions);
    setMatches(defaultMatches);
    setDoublesMatches([]);
    setOpponents([]);
    setSstzProfile(null);
    setTournamentProfile(null);
    setTournamentError(null);
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
        activities,
        addActivity,
        updateActivity,
        deleteActivity,
        trainingSessions,
        addTrainingSession,
        deleteTrainingSession,
        matches,
        addMatch,
        deleteMatch,
        updateMatchNotes,
        doublesMatches,
        addDoublesMatch,
        deleteDoublesMatch,
        opponents,
        updateOpponent,
        getOpponent,
        sstzProfile,
        syncJobs,
        tournamentProfile,
        isTournamentLoading,
        tournamentError,
        syncSstzTournaments,
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
