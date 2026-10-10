export type RubberType = 'inverted' | 'short_pips' | 'long_pips' | 'antispin';

export interface Rubber {
  id: string;
  brand: string;
  model: string;
  type: RubberType;
  color: 'black' | 'red' | 'blue' | 'green' | 'pink' | 'purple';
  spongeThickness: string; // e.g., '2.0mm', 'MAX', '1.8mm'
  spongeHardness?: number; // degrees, e.g. 47.5
  speed?: number; // 1-100, absent when not supplied
  spin?: number; // 1-100, absent when not supplied
  control?: number; // 1-100, absent when not supplied
  hoursPlayed: number;
  maxRecommendedHours: number; // usually 60-90 hours before spin degradation
  dateInstalled: string; // YYYY-MM-DD
  notes?: string;
  isWishlist?: boolean;
}

export interface Blade {
  id: string;
  brand: string;
  model: string;
  plies: string; // e.g. '5 wood + 2 ALC'
  weightGrams?: number;
  grip: 'FL' | 'ST' | 'AN' | 'CPEN';
  speed?: number;
  control?: number;
  hoursPlayed: number;
  dateAcquired: string;
  notes?: string;
  isWishlist?: boolean;
}

export interface RacketSetup {
  id: string;
  name: string;
  bladeId: string;
  forehandRubberId: string;
  backhandRubberId: string;
  isActive: boolean;
  totalHours: number;
  winCount: number;
  lossCount: number;
  gpiScore: number; // Gear Performance Index (0-100)
  dateCreated: string;
}

export type ActivityCategory = 'tréning' | 'priatelsky' | 'turnaj' | 'liga' | 'podujatie';
export type ActivityVisibility = 'private' | 'friends' | 'community';
export type ActivityOpponentRubber = 'in' | 'long_pips' | 'short_pips' | 'anti';

export interface ActivityRecord {
  id: string;
  category: ActivityCategory;
  date: string; // YYYY-MM-DD
  durationMinutes: number;
  focusDrills: string[];
  customTags?: string[];
  title?: string;
  leagueName?: string;
  teamHome?: string;
  teamAway?: string;
  round?: string;
  eventCategory?: string;
  placing?: string;
  eventResult?: string;
  // Opponent / Players (optional)
  opponentName?: string;
  opponentId?: string;
  opponentGrip?: 'left' | 'right';
  opponentFhRubber?: ActivityOpponentRubber;
  opponentBhRubber?: ActivityOpponentRubber;
  matchScore?: string;
  matchResult?: 'WIN' | 'LOSS';
  photos?: string[];
  // Details & Visibility
  location: string;
  publicNote?: string;
  privateNote?: string;
  visibility: ActivityVisibility;
  addEquipmentWear: boolean;
  racketId?: string;
  intensity?: number;
  createdAt: string;
}

export interface TrainingSession {
  id: string;
  date: string; // ISO date string
  durationMinutes: number;
  type: 'tréning' | 'zápas' | 'podania' | 'kondícia' | 'multiball' | 'liga';
  focusDrills: string[];
  racketId?: string;
  intensity: number; // 1 to 5
  location: string;
  notes: string;
}

export interface SetDetail {
  setNumber: number;
  playerPoints: number;
  opponentPoints: number;
  display: string; // e.g. "11:8"
  won: boolean;
  isWalkover?: boolean;
}

export interface MatchRecord {
  id: string;
  date: string;
  season?: string; // e.g. '2026/27' or '2025/26'
  competition: string; // e.g. 'SSTZ Liga', '3. liga', 'Turnaj', 'Priateľský zápas'
  leagueName?: string;
  round?: string;
  teamHome?: string;
  teams?: string;
  teamAway?: string;
  playerClub?: string;
  opponentName: string;
  opponentId?: string;
  opponentUnknown?: boolean;
  result: 'WIN' | 'LOSS';
  score: string; // e.g. '3:1' or '3:2'
  sets: string[]; // e.g. ['+11', '-8', '+9', '+7']
  setDetails?: SetDetail[];
  totalPointsWon?: number;
  totalPointsLost?: number;
  racketId?: string;
  notes?: string;
  tacticsNote?: string; // čo na neho fungovalo / čo si vedel hrať
  sstzMatchId?: string;
  source?: 'SSTZ' | 'SSTZ_TOURNAMENT' | 'manual';
  tournamentName?: string;
  tournamentId?: string;
  category?: string;
  eventUrl?: string;
  opponentClub?: string;
  teamName?: string;
  partnerName?: string;
  matchType?: 'singles' | 'doubles';
  isPlayerHome?: boolean;
  isWalkover?: boolean;
}

export type Handedness = 'right' | 'left' | 'unknown';
export type OpponentRubberType = 'soft' | 'long_pips' | 'short_pips' | 'antispin' | 'other';
export type PlayStyle = 'attacker' | 'defender' | 'blocker' | 'allround' | 'other';

export interface OpponentProfile {
  id: string; // Opponent ID or normalized name
  name: string;
  clubName?: string;
  association?: string;
  handedness: Handedness;
  forehandRubber: OpponentRubberType;
  backhandRubber: OpponentRubberType;
  forehandModel?: string;
  backhandModel?: string;
  bladeModel?: string;
  playStyle: PlayStyle;
  notes: string; // scouting postrehy, čo na neho platí
  strengths?: string;
  weaknesses?: string;
  lastUpdated?: string;
}

export interface DoublesMatchRecord {
  id: string;
  teamMatchId?: string;
  season?: string;
  leagueName?: string;
  competition?: string;
  tournamentName?: string;
  category?: string;
  round?: string;
  date: string;
  teams?: string;
  playerClub?: string;
  partnerName: string;
  partnerId?: string;
  opponentPair: string;
  opponents?: { id: string; name: string }[];
  result: 'WIN' | 'LOSS';
  score: string; // e.g. '3:1'
  sets: string[];
  setDetails?: SetDetail[];
  totalPointsWon?: number;
  totalPointsLost?: number;
  notes?: string;
  source?: 'SSTZ' | 'SSTZ_TOURNAMENT' | 'manual';
  tournamentId?: string;
  eventUrl?: string;
  type: 'doubles';
  isPlayerHome?: boolean;
  isWalkover?: boolean;
}

export interface DoublesPartnerStat {
  partnerName: string;
  partnerId?: string;
  matchesCount: number;
  wins: number;
  losses: number;
  winRate: number;
  matches: DoublesMatchRecord[];
}

export interface SeasonBreakdown {
  season: string;
  slug: string;
  leagues: string[];
  singles: number;
  singlesWon: number;
  singlesLost: number;
  singlesWinRate: number;
  doubles: number;
  doublesWon: number;
  doublesLost: number;
  doublesWinRate: number;
  total: number;
}

export interface SSTZProfile {
  id: string;
  name: string;
  association: string;
  clubName?: string;
  clubId?: string;
  leagueSlug?: string;
  isAllSeasons?: boolean;
  syncedSeasonsCount?: number;
  seasonsBreakdown?: SeasonBreakdown[];
  singlesStats: {
    won: number;
    played: number;
    lost: number;
    winRate: number;
    home?: { won: number; total: number };
    away?: { won: number; total: number };
  };
  doublesStats: {
    won: number;
    played: number;
    lost: number;
    winRate: number;
  };
  doublesMatches?: DoublesMatchRecord[];
  lastSync: string;
}

export interface TeamScheduleMatch {
  id: string;
  round: string;
  dateTime: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: string;
  awayScore: string;
  isPlayed: boolean;
  protocolUrl?: string;
}

export interface LeagueStandingsRow {
  position: number;
  clubId: string;
  clubName: string;
  played: number;
  wins: number;
  draws: number;
  losts: number;
  score: string;
  points: number;
}

export interface LeagueData {
  slug: string;
  title: string;
  clubs: { clubId: string; clubName: string }[];
  standings?: LeagueStandingsRow[];
  matches?: TeamScheduleMatch[];
  syncedAt?: string;
}

export interface Badge {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlockedAt?: string;
  progress: number;
  maxProgress: number;
}

export interface SSTZTournamentProfile {
  id: string;
  name: string;
  clubName?: string;
  lastSync: string;
  complete: true;
}
