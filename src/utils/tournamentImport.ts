import type {
  MatchRecord,
  DoublesMatchRecord,
  SSTZTournamentProfile,
} from '../types';

export interface TournamentImport {
  profile: SSTZTournamentProfile;
  matches: MatchRecord[];
  doublesMatches: DoublesMatchRecord[];
}

// Reject incomplete or malformed responses before replacing any saved history.
export function parseTournamentImport(
  payload: unknown,
  playerId: string,
): TournamentImport {
  const data = payload as Record<string, any> | null;
  if (
    !data ||
    data.complete !== true ||
    String(data.id) !== playerId ||
    typeof data.name !== 'string' ||
    !data.name.trim() ||
    !Array.isArray(data.matches) ||
    !Array.isArray(data.doublesMatches)
  ) {
    throw new Error(
      'SSTZ neposkytlo overenú kompletnú históriu turnajov. Doterajšie zápasy zostali zachované.',
    );
  }
  const ids = new Set<string>();
  const normalize = (m: any, doubles: boolean): any => {
    if (
      !m ||
      typeof m.id !== 'string' ||
      !m.id ||
      !/^\d{4}-\d{2}-\d{2}$/.test(m.date) ||
      typeof m.tournamentName !== 'string' ||
      !m.tournamentName.trim() ||
      typeof (doubles ? m.opponentPair : m.opponentName) !== 'string' ||
      !(doubles ? m.opponentPair : m.opponentName).trim() ||
      !['WIN', 'LOSS'].includes(m.result) ||
      typeof m.score !== 'string' ||
      !m.score.trim() ||
      !Array.isArray(m.sets) ||
      m.sets.some((set: unknown) => typeof set !== 'string') ||
      (doubles && (typeof m.partnerName !== 'string' || !m.partnerName.trim()))
    ) {
      throw new Error(
        'Turnajový zápas obsahuje neúplné údaje. Import sa neuložil.',
      );
    }
    const id = `sstz-tournament-${playerId}-${doubles ? 'd' : 's'}-${m.id}`;
    if (ids.has(id))
      throw new Error(
        'SSTZ vrátilo duplicitný turnajový zápas. Import sa neuložil.',
      );
    ids.add(id);
    return {
      ...m,
      id,
      source: 'SSTZ_TOURNAMENT',
      competition: m.tournamentName,
      ...(doubles ? { type: 'doubles' } : { sstzMatchId: m.id }),
    };
  };
  return {
    profile: {
      id: playerId,
      name: data.name.trim(),
      clubName: data.clubName,
      lastSync: new Date().toISOString(),
      complete: true,
    },
    matches: data.matches.map((m) => normalize(m, false)),
    doublesMatches: data.doublesMatches.map((m) => normalize(m, true)),
  };
}

export function replaceTournamentMatches<
  T extends {
    id: string;
    source?: string;
    notes?: string;
    tacticsNote?: string;
    racketId?: string;
  },
>(existing: T[], incoming: T[]): T[] {
  const previous = new Map(
    existing
      .filter((m) => m.source === 'SSTZ_TOURNAMENT')
      .map((m) => [m.id, m]),
  );
  const imported = incoming.map((m) => {
    const old = previous.get(m.id);
    return old
      ? {
          ...m,
          notes: old.notes,
          tacticsNote: old.tacticsNote,
          racketId: old.racketId,
        }
      : m;
  });
  return [
    ...existing.filter((m) => m.source !== 'SSTZ_TOURNAMENT'),
    ...imported,
  ];
}
