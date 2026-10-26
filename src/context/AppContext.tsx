import { startSstzAutoRefresh } from '../utils/sstzAutoRefresh';
import { buildRecaps, currentMonth, type Recap } from '../utils/recaps';
import {loadSstzAccountImport, sstzNameKey, type SstzPlayerChoice} from '../utils/sstzAccountImport';
import { mergeLocationHistory } from '../utils/locations';
import { mergeCandidates, mergeMatchNotes, matchDay } from '../utils/matchMerge';
import { compareOccurrenceDesc, normalizeDiaryDate, occurrenceTime } from '../utils/diary';
import { newActivityId } from '../utils/activityId';
import React, { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react';
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
import { emptyAccountData } from '../utils/community';
import { INITIAL_BADGES } from '../data/gearCatalog';

export type SyncKind = 'player' | 'schedule' | 'tournaments' | 'account';
export interface SyncJob {
  state: 'loading' | 'success' | 'error';
  message: string;
  startedAt: number;
  finishedAt?: number;
}

interface AppContextType {
  recaps: Recap[];
  seenRecaps: string[];
  markRecapsSeen: (ids: string[]) => void;
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
  savedLocations: string[];
  rememberLocation: (location: string) => void;
  activities: ActivityRecord[];
  addActivity: (activity: Omit<ActivityRecord, 'id' | 'createdAt'>, localId?: string) => string;
  updateActivity: (id: string, updates: Partial<ActivityRecord>) => void;
  deleteActivity: (id: string) => Promise<void>;
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

  matchMergeCandidates: ReturnType<typeof mergeCandidates>;
  resolveMatchMerge: (manualId: string, importedId: string, merge: boolean) => void;
  syncJobs: Partial<Record<SyncKind, SyncJob>>;

  // SSTZ Integration
  sstzProfile: SSTZProfile | null;
  teamSchedule: TeamScheduleMatch[];
  selectedLeagueSlug: string;
  selectedClubId: string;
  isSstzLoading: boolean;
  sstzError: string | null;
  syncSstzAccount: (choice: SstzPlayerChoice, showProgress?: boolean) => Promise<boolean>;
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

  localSaveError: boolean;
  // System
  exportData: () => string;
  importData: (jsonStr: string) => boolean;
  resetToDefaults: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'spintrack_sstz_data_v1';

export const AppProvider: React.FC<{ children: React.ReactNode; storageKey?: string; initialData?: Record<string, any> | null; onPersist?: (data: Record<string, any>) => void; beforeDeleteActivity?: (id: string) => Promise<void>; beforeReset?: () => Promise<void> }> = ({ children, storageKey = LOCAL_STORAGE_KEY, initialData, onPersist, beforeDeleteActivity, beforeReset }) => {
  // Personal records start empty; the equipment catalog remains available separately.
  const defaultBlades: Blade[] = [];
  const defaultRubbers: Rubber[] = [];
  const defaultRackets: RacketSetup[] = [];
  const defaultSessions: TrainingSession[] = [];
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
      const data = localStorage.getItem(storageKey);
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

  const [saved] = useState(() => initialData ?? loadSavedState());

  const [blades, setBlades] = useState<Blade[]>(saved?.blades || defaultBlades);
  const [rubbers, setRubbers] = useState<Rubber[]>(saved?.rubbers || defaultRubbers);
  const [rackets, setRackets] = useState<RacketSetup[]>(saved?.rackets || defaultRackets);
  const [activeRacketId, setActiveRacketId] = useState<string>(saved?.activeRacketId || '');
  const defaultActivities: ActivityRecord[] = [];

  const initialActivities: ActivityRecord[] = saved?.activities || (saved?.trainingSessions ? saved.trainingSessions.map((s: any) => ({
    id: s.id,
    category: 'tréning' as ActivityCategory,
    date: normalizeDiaryDate(s.date),
    startTime: occurrenceTime(s).slice(0, 5) || undefined,
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

  const [savedLocations, setSavedLocations] = useState<string[]>(() => mergeLocationHistory(
    saved?.savedLocations,
    [...initialActivities].sort(compareOccurrenceDesc).map(activity => activity.location),
    (saved?.trainingSessions || []).map((session: TrainingSession) => session.location),
  ));
  const rememberLocation = (location: string) => {
    if (location.trim()) setSavedLocations(previous => mergeLocationHistory([location], previous));
  };
  const [activities, setActivities] = useState<ActivityRecord[]>(initialActivities);
  const [trainingSessions, setTrainingSessions] = useState<TrainingSession[]>(saved?.trainingSessions || defaultSessions);
  const [matches, setMatches] = useState<MatchRecord[]>(saved?.matches || defaultMatches);
  const [doublesMatches, setDoublesMatches] = useState<DoublesMatchRecord[]>(saved?.doublesMatches || []);
  const [opponents, setOpponents] = useState<OpponentProfile[]>(
    extractOpponentsFromMatches(saved?.matches || defaultMatches, saved?.opponents || [])
  );
  const [sstzProfile, setSstzProfile] = useState<SSTZProfile | null>(saved?.sstzProfile || null);
  const [tournamentProfile, setTournamentProfile] = useState<SSTZTournamentProfile | null>(saved?.tournamentProfile || null);
  const [ignoredMerges, setIgnoredMerges] = useState<string[]>(saved?.ignoredMerges || []);
  const [syncJobs, setSyncJobs] = useState<Partial<Record<SyncKind, SyncJob>>>({});
  const runningSyncs = useRef(new Map<SyncKind, { promise: Promise<boolean>; controller: AbortController; showProgress: boolean; key?: string }>());
  const isTournamentLoading = syncJobs.tournaments?.state === 'loading' || syncJobs.account?.state === 'loading';
  const [tournamentError, setTournamentError] = useState<string | null>(null);
  const [teamSchedule, setTeamSchedule] = useState<TeamScheduleMatch[]>(saved?.teamSchedule || []);
  const [selectedLeagueSlug, setSelectedLeagueSlug] = useState<string>(saved?.selectedLeagueSlug || '');
  const [selectedClubId, setSelectedClubId] = useState<string>(saved?.selectedClubId || '');
  const [badges, setBadges] = useState<Badge[]>(saved?.badges || INITIAL_BADGES);

  const [scheduleConnected, setScheduleConnected] = useState(Boolean(saved?.scheduleConnected ?? saved?.teamSchedule?.length));

  // Loading & error states
  const isSstzLoading = syncJobs.player?.state === 'loading' || syncJobs.schedule?.state === 'loading' || syncJobs.account?.state === 'loading';
  const [sstzError, setSstzError] = useState<string | null>(null);

  const [localSaveError, setLocalSaveError] = useState(false);

  const [seenRecaps, setSeenRecaps] = useState<string[]>(() => Array.isArray(saved?.seenRecaps) ? saved.seenRecaps.filter((id: unknown) => typeof id === 'string') : []);
  const markRecapsSeen = (ids: string[]) => setSeenRecaps(previous => [...new Set([...previous, ...ids])]);
  const [recapMonth, setRecapMonth] = useState(currentMonth);
  useEffect(() => {
    const update = () => setRecapMonth(currentMonth());
    const timer = window.setInterval(update, 60000);
    window.addEventListener('focus', update);
    document.addEventListener('visibilitychange', update);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', update); document.removeEventListener('visibilitychange', update); };
  }, []);
  const recaps = useMemo(() => buildRecaps(activities, matches, doublesMatches, recapMonth), [activities, matches, doublesMatches, recapMonth]);

  // Persist to localStorage
  useEffect(() => {
    const dataToSave = {
      blades,
      rubbers,
      rackets,
      activeRacketId,
      activities,
      savedLocations,
      recaps,
      seenRecaps,
      trainingSessions,
      matches,
      doublesMatches,
      opponents,
      sstzProfile,
      tournamentProfile,
      ignoredMerges,
      teamSchedule,
      selectedLeagueSlug,
      selectedClubId,
      scheduleConnected,
      badges,
      _updatedAt: new Date().toISOString()
    };
    try {
      localStorage.setItem(storageKey, JSON.stringify(dataToSave));
      setLocalSaveError(false);
    } catch (e) {
      setLocalSaveError(true);
      console.warn('Failed to save state to localStorage:', e);
    }
    onPersist?.(dataToSave);
  }, [
    onPersist,
    storageKey,
    blades,
    rubbers,
    rackets,
    activeRacketId,
    activities,
    savedLocations,
    recaps,
    seenRecaps,
    trainingSessions,
    matches,
    doublesMatches,
    opponents,
    sstzProfile,
    tournamentProfile,
    ignoredMerges,
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
    rememberLocation(sessionData.location);
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
  const addActivity = (activityData: Omit<ActivityRecord, 'id' | 'createdAt'>, localId?: string): string => {
    rememberLocation(activityData.location);
    const id = localId || newActivityId();
    const newActivity: ActivityRecord = {
      ...activityData,
      id,
      createdAt: new Date().toISOString()
    };

    setActivities(prev => [newActivity, ...prev]);
    if (newActivity.planned) return id;

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
          sourceActivityId: id,
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
    const existing = activities.find(activity => activity.id === id);
    if (!existing) return;
    const updated = { ...existing, ...updates };
    rememberLocation(updated.location);
    setActivities(prev => prev.map(activity => activity.id === id ? updated : activity));
    if (existing.category === 'tréning' || updated.category === 'tréning') {
      const session: TrainingSession = {
        id,
        date: updated.date,
        durationMinutes: updated.category === 'tréning' ? updated.durationMinutes : 0,
        type: 'tréning',
        focusDrills: updated.category === 'tréning' ? updated.focusDrills : [],
        racketId: updated.racketId,
        intensity: updated.intensity || 4,
        location: updated.location,
        notes: [updated.publicNote, updated.privateNote].filter(Boolean).join(' | '),
      };
      setTrainingSessions(prev => updated.category === 'tréning' && !updated.planned
        ? [session, ...prev.filter(item => item.id !== id)]
        : prev.filter(item => item.id !== id));
    }
    const wearHours = (activity: ActivityRecord) =>
      activity.category === 'tréning' && !activity.planned && activity.addEquipmentWear
        ? activity.durationMinutes / 60
        : 0;
    const previousRacket = rackets.find(racket => racket.id === existing.racketId);
    const nextRacket = rackets.find(racket => racket.id === updated.racketId);
    if (previousRacket && existing.racketId !== updated.racketId) {
      addHoursToActiveRacket(-wearHours(existing), previousRacket);
    } else if (previousRacket) {
      addHoursToActiveRacket(wearHours(updated) - wearHours(existing), previousRacket);
    }
    if (nextRacket && existing.racketId !== updated.racketId) {
      addHoursToActiveRacket(wearHours(updated), nextRacket);
    }
  };

  const deleteActivity = async (id: string) => {
    await beforeDeleteActivity?.(id);
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

  const matchMergeCandidates = mergeCandidates(matches, ignoredMerges);
  const resolveMatchMerge = (manualId: string, importedId: string, merge: boolean) => {
    const pair = mergeCandidates(matches).find(p => p.manual.id === manualId && p.imported.id === importedId);
    if (!pair) return;
    if (!merge) { setIgnoredMerges(previous => [...previous, `${manualId}|${importedId}`]); return; }
    const matchingActivities = activities.filter(a => !a.planned && a.category !== 'tréning' && matchDay(a.date) === matchDay(pair.manual.date) && a.opponentName?.trim().toLowerCase() === pair.manual.opponentName.trim().toLowerCase() && a.matchScore === pair.manual.score);
    const sourceActivityId = pair.manual.sourceActivityId || (matchingActivities.length === 1 ? matchingActivities[0].id : undefined);
    const combined = mergeMatchNotes({...pair.manual, sourceActivityId}, pair.imported);
    setMatches(previous => previous.filter(m => m.id !== manualId).map(m => m.id === importedId ? combined : m));
    if (sourceActivityId) setActivities(previous => previous.map(a => a.id === sourceActivityId ? {...a, linkedMatchId: importedId, matchScore: combined.score, matchResult: combined.result} : a));
  };

  // Applies a full authentic SSTZ profile payload, saving verified matches and updating opponents
  const applySstzPayload = (data: any) => {
    if (!data) return;

    const preserveLeagueNotes = !sstzProfile || sstzProfile.id === String(data.id);
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
      lastImportCount: Array.isArray(data.matches) ? data.matches.filter((m: any) => !matches.some(old => old.id === `sstz-${m.id}`)).length + (data.doublesMatches || []).filter((m: any) => !doublesMatches.some(old => old.source === 'SSTZ' && old.id === m.id)).length : 0,
      lastSync: data.syncedAt || new Date().toISOString()
    };

    setSstzProfile(profile);

    if (data.clubId && !scheduleConnected) {
      setSelectedClubId(data.clubId);
    }

    if (Array.isArray(data.matches)) {
      const importedMatches: MatchRecord[] = data.matches.map((m: any) => ({
        id: `sstz-${m.id}`,
        date: m.date || '',
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
        const previous = new Map((preserveLeagueNotes ? prev.filter(p => p.source === 'SSTZ') : []).map(p => [p.id, p]));
        const combined = [...importedMatches.map(match => {
          const old = previous.get(match.id);
          return old ? { ...match, notes: old.notes, tacticsNote: old.tacticsNote, racketId: old.racketId, sourceActivityId: old.sourceActivityId } : match;
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
        const previous = new Map((preserveLeagueNotes ? prev.filter(p => p.source === 'SSTZ') : []).map(p => [p.id, p]));
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
    key?: string,
  ): Promise<boolean> => {
    if ((kind === 'player' || kind === 'tournaments') && runningSyncs.current.has('account')) return runningSyncs.current.get('account')!.promise;
    const existing = runningSyncs.current.get(kind);
    if (existing) {
      if (showProgress && !existing.showProgress) {
        existing.showProgress = true;
        setSyncJobs(previous => ({ ...previous, [kind]: { state: 'loading', message, startedAt: Date.now() } }));
        if (kind === 'tournaments' || kind === 'account') setTournamentError(null);
        if (kind !== 'tournaments') setSstzError(null);
      }
      return existing.promise;
    }
    const controller = new AbortController();
    const startedAt = Date.now();
    if (showProgress) {
      setSyncJobs(previous => ({ ...previous, [kind]: { state: 'loading', message, startedAt } }));
      if (kind === 'tournaments' || kind === 'account') setTournamentError(null);
      if (kind !== 'tournaments') setSstzError(null);
    }
    const promise = (async () => {
      try {
        await task(AbortSignal.any([controller.signal, AbortSignal.timeout(300000)]));
        if (kind === 'tournaments' || kind === 'account') setTournamentError(null);
        if (kind !== 'tournaments') setSstzError(null);
        if (runningSyncs.current.get(kind)?.showProgress) {
          setSyncJobs(previous => ({ ...previous, [kind]: { state: 'success', message: successMessage, startedAt, finishedAt: Date.now() } }));
        } else {
          setSyncJobs(previous => { const next = {...previous}; delete next[kind]; return next; });
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
        if (kind === 'tournaments' || kind === 'account') setTournamentError(detail);
        if (kind !== 'tournaments') setSstzError(detail);
        setSyncJobs(previous => ({ ...previous, [kind]: { state: 'error', message: detail, startedAt, finishedAt: Date.now() } }));
        return false;
      } finally {
        controller.abort();
        runningSyncs.current.delete(kind);
      }
    })();
    runningSyncs.current.set(kind, { promise, controller, showProgress, key });
    return promise;
  };

  const applyTournamentImport = (
    imported: ReturnType<typeof parseTournamentImport>,
  ) => {
    setMatches((previous) =>
      replaceTournamentMatches(previous, imported.matches),
    );
    setDoublesMatches((previous) =>
      replaceTournamentMatches(previous, imported.doublesMatches),
    );
    setTournamentProfile({
      ...imported.profile,
      lastImportCount:
        imported.matches.filter((m) => !matches.some((old) => old.id === m.id))
          .length +
        imported.doublesMatches.filter(
          (m) => !doublesMatches.some((old) => old.id === m.id),
        ).length,
    });
  };

  const syncSstzAccount = async (
    choice: SstzPlayerChoice,
    showProgress = true,
  ): Promise<boolean> => {
    const key = `${choice.registryId || ""}:${choice.leagueId || ""}`;
    const previousAccount = runningSyncs.current.get("account");
    if (previousAccount && (!showProgress || previousAccount.key === key))
      return runSync(
        "account",
        "Načítavam ligy aj turnaje…",
        "Ligy aj turnaje sú aktualizované.",
        async () => {},
        showProgress,
        key,
      );
    if (previousAccount) {
      previousAccount.controller.abort();
      await previousAccount.promise;
    }
    return runSync(
      "account",
      "Načítavam ligy aj turnaje zo všetkých dostupných sezón…",
      "Dostupné ligové a turnajové zápasy sú aktualizované.",
      async (signal) => {
        const previous = ["player", "tournaments"]
          .map((kind) => runningSyncs.current.get(kind as SyncKind))
          .filter(Boolean);
        previous.forEach((job) => job!.controller.abort());
        await Promise.all(previous.map((job) => job!.promise));
        signal.throwIfAborted();
        const untouchedProfile =
          choice.registryId && !choice.leagueId
            ? sstzProfile
            : choice.leagueId && !choice.registryId
              ? tournamentProfile
              : null;
        if (
          untouchedProfile &&
          sstzNameKey(untouchedProfile.name) !== sstzNameKey(choice.name)
        )
          throw new Error(
            "Pre iného hráča sa našiel iba jeden zdroj. Najprv odpoj predchádzajúci profil, aby sa nezmiešali histórie rôznych hráčov.",
          );
        const imported = await loadSstzAccountImport(
          choice,
          async (url) => {
            const response = await fetch(url, { signal, cache: "no-store" });
            if (
              !(response.headers.get("content-type") || "").includes(
                "application/json",
              )
            )
              throw new Error("SSTZ import zatiaľ nie je dostupný na serveri.");
            const data = await response.json();
            if (!response.ok)
              throw new Error(data.error || "Spoločný import SSTZ zlyhal.");
            return data;
          },
          signal,
        );
        signal.throwIfAborted();
        // Both sources are validated before either history is changed. Functional
        // updates preserve the other source, manual entries and personal notes.
        if (imported.league) applySstzPayload(imported.league);
        if (imported.tournaments) applyTournamentImport(imported.tournaments);
      },
      showProgress,
      key,
    );
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
      applyTournamentImport(imported);
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

  // Keep all personal results fresh, including events saved in the calendar.
  // Each source commits independently: a league outage must not block new tournaments.
  const refreshConnected = useRef(() => {});
  refreshConnected.current = () => {
    if (sstzProfile) void syncSstzPlayer(sstzProfile.id, true, false);
    if (tournamentProfile) void syncSstzTournaments(tournamentProfile.id, false);
    if (scheduleConnected && selectedLeagueSlug) void syncTeamSchedule(selectedLeagueSlug, selectedClubId || undefined, false);
  };
  useEffect(() => startSstzAutoRefresh(() => refreshConnected.current(), {
    visible: () => !document.hidden,
    online: () => navigator.onLine,
    now: () => Date.now(),
    every: (callback, milliseconds) => {
      const timer = window.setInterval(callback, milliseconds);
      return () => window.clearInterval(timer);
    },
    listen: (event, callback) => {
      const target = event === 'visibilitychange' ? document : window;
      target.addEventListener(event, callback);
      return () => target.removeEventListener(event, callback);
    },
  }), []);

  const importAllSstzMatchesToDiary = (): number => {
    if (!sstzProfile) return 0;
    return matches.filter(m => m.source === 'SSTZ').length;
  };

  const addScheduleMatchToMatches = (scheduleMatch: TeamScheduleMatch, result: 'WIN' | 'LOSS', score: string) => {
    addMatch({
      date: scheduleMatch.dateTime || '',
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
    runningSyncs.current.get('account')?.controller.abort();
    runningSyncs.current.get('tournaments')?.controller.abort();
    setTournamentProfile(null);
    setTournamentError(null);
    setSstzError(null);
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
      savedLocations,
      recaps,
      seenRecaps,
      trainingSessions,
      matches,
      doublesMatches,
      opponents,
      sstzProfile,
      tournamentProfile,
      ignoredMerges,
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
      if (data.activeRacketId !== undefined) setActiveRacketId(data.activeRacketId);
      if (data.activities) setActivities(data.activities);
      if (Array.isArray(data.seenRecaps)) setSeenRecaps(data.seenRecaps.filter((id: unknown) => typeof id === 'string'));
      if (data.savedLocations !== undefined || data.activities || data.trainingSessions) {
        setSavedLocations(mergeLocationHistory(data.savedLocations, (data.activities || []).map((a: ActivityRecord) => a.location), (data.trainingSessions || []).map((a: TrainingSession) => a.location)));
      }
      if (data.ignoredMerges) setIgnoredMerges(data.ignoredMerges);
      if (data.trainingSessions) setTrainingSessions(data.trainingSessions);
      if (data.matches) setMatches(data.matches);
      if (data.doublesMatches) setDoublesMatches(data.doublesMatches);
      if (data.opponents) setOpponents(data.opponents);
      if (data.tournamentProfile !== undefined) setTournamentProfile(data.tournamentProfile);
      if (data.sstzProfile !== undefined) setSstzProfile(data.sstzProfile);
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

  const resetToDefaults = async () => {
    await beforeReset?.();
    runningSyncs.current.forEach(job => job.controller.abort());
    importData(JSON.stringify({ ...emptyAccountData(), badges: INITIAL_BADGES }));
    setActiveRacketId('');
    setSelectedClubId('');
    setSelectedLeagueSlug('');
    setSstzError(null);
    setIgnoredMerges([]);
    setTournamentError(null);
  };

  // Every consumer sees occurrence order, even when an import appends old records.
  const orderedActivities = useMemo(() => [...activities].sort(compareOccurrenceDesc), [activities]);
  const orderedSessions = useMemo(() => [...trainingSessions].sort(compareOccurrenceDesc), [trainingSessions]);
  const orderedMatches = useMemo(() => [...matches].sort(compareOccurrenceDesc), [matches]);
  const orderedDoubles = useMemo(() => [...doublesMatches].sort(compareOccurrenceDesc), [doublesMatches]);

  return (
    <AppContext.Provider
      value={{
        recaps,
        seenRecaps,
        markRecapsSeen,
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
        activities: orderedActivities,
        addActivity,
        updateActivity,
        deleteActivity,
        trainingSessions: orderedSessions,
        addTrainingSession,
        deleteTrainingSession,
        matches: orderedMatches,
        addMatch,
        deleteMatch,
        updateMatchNotes,
        doublesMatches: orderedDoubles,
        addDoublesMatch,
        deleteDoublesMatch,
        opponents,
        updateOpponent,
        getOpponent,
        sstzProfile,
        rememberLocation,
        savedLocations,
        localSaveError,
        matchMergeCandidates,
        resolveMatchMerge,
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
        syncSstzAccount,
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
