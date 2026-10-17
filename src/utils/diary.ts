import type {
  ActivityCategory,
  ActivityRecord,
  DoublesMatchRecord,
  MatchRecord,
} from '../types';

export interface DiaryEntry {
  id: string;
  date: string;
  originalDate: string;
  startTime?: string;
  category: ActivityCategory;
  source: 'manual' | 'sstz';
  title: string;
  subtitle: string;
  searchText: string;
  result?: 'WIN' | 'LOSS';
  score?: string;
  activity?: ActivityRecord;
  match?: MatchRecord | DoublesMatchRecord;
}
export interface DiaryFilters {
  category: 'all' | ActivityCategory;
  query: string;
  source: 'all' | 'manual' | 'sstz';
  result: 'all' | 'WIN' | 'LOSS';
  from: string;
  to: string;
}
export const emptyDiaryFilters: DiaryFilters = {
  category: 'all',
  query: '',
  source: 'all',
  result: 'all',
  from: '',
  to: '',
};
const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

/** Both SSTZ's day.month.year and local ISO dates sort as calendar days. */
export function normalizeDiaryDate(value: string | null | undefined): string {
  if (typeof value !== 'string') return '';
  value = value.trim();
  const iso = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:$|T|\s)/);
  const local = value.match(/^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})(?:$|T|\s|,)/);
  if (!iso && !local) return '';
  const [year, month, day] = iso
    ? [Number(iso[1]), Number(iso[2]), Number(iso[3])]
    : [Number(local![3]), Number(local![2]), Number(local![1])];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  )
    return '';
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export interface DatedRecord {
  id?: string;
  date?: string | null;
  startTime?: string;
}

/** Only the time of the event itself; never its creation/import timestamp. */
export function occurrenceTime(record: DatedRecord): string {
  const value = record.startTime?.trim() ||
    record.date?.match(/(?:T|[\s,])(\d{1,2}:\d{2}(?::\d{2})?)/)?.[1] || '';
  const match = value.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59 || Number(match[3] || 0) > 59) return '';
  return `${match[1].padStart(2, '0')}:${match[2]}:${match[3] || '00'}`;
}

/** Latest occurrence first. Undated records go last; ties never use import order. */
export function compareOccurrenceDesc(a: DatedRecord, b: DatedRecord): number {
  const left = normalizeDiaryDate(a.date);
  const right = normalizeDiaryDate(b.date);
  const dayOrder = right.localeCompare(left);
  if (dayOrder) return dayOrder;
  const timeOrder = left ? occurrenceTime(b).localeCompare(occurrenceTime(a)) : 0;
  return timeOrder || (a.id || '').localeCompare(b.id || '');
}

export function getDiaryEntries(
  activities: ActivityRecord[],
  matches: MatchRecord[],
  doubles: DoublesMatchRecord[],
): DiaryEntry[] {
  const entries: DiaryEntry[] = activities.map((activity) => {
    const title =
      activity.title ||
      (activity.opponentName
        ? `Zápas proti ${activity.opponentName}`
        : activity.leagueName ||
          (activity.category === 'tréning'
            ? 'Tréning pri stole'
            : activity.category === 'podujatie'
              ? 'Podujatie'
              : activity.category === 'turnaj'
                ? 'Turnaj'
                : 'Zápas'));
    const subtitle = [activity.leagueName, activity.location, activity.round]
      .filter(Boolean)
      .join(' · ');
    return {
      id: `activity-${activity.id}`,
      date: normalizeDiaryDate(activity.date),
      originalDate: activity.date,
      startTime: occurrenceTime(activity),
      category: activity.category,
      source: 'manual',
      title,
      subtitle,
      result: activity.matchResult,
      score: activity.matchScore || activity.eventResult || activity.placing,
      activity,
      searchText: normalizeText(
        [
          title,
          subtitle,
          activity.opponentName,
          activity.eventCategory,
          activity.publicNote,
          activity.privateNote,
          activity.teamHome,
          activity.teamAway,
          ...activity.focusDrills,
        ]
          .filter(Boolean)
          .join(' '),
      ),
    };
  });
  for (const match of [...matches, ...doubles]) {
    if (match.source !== 'SSTZ' && match.source !== 'SSTZ_TOURNAMENT') continue;
    const opponent =
      'opponentPair' in match ? match.opponentPair : match.opponentName;
    const title = `Zápas proti ${opponent}`;
    const subtitle = [
      match.tournamentName || match.leagueName || match.competition,
      match.round,
      match.season,
    ]
      .filter(Boolean)
      .join(' · ');
    entries.push({
      id: `${'opponentPair' in match ? 'doubles' : 'match'}-${match.id}`,
      date: normalizeDiaryDate(match.date),
      originalDate: match.date,
      startTime: occurrenceTime(match),
      category: match.source === 'SSTZ' ? 'liga' : 'turnaj',
      source: 'sstz',
      title,
      subtitle,
      result: match.result,
      score: match.score,
      match,
      searchText: normalizeText(
        [
          title,
          subtitle,
          match.notes,
          'tacticsNote' in match ? match.tacticsNote : '',
          'partnerName' in match ? match.partnerName : '',
          match.teams,
        ]
          .filter(Boolean)
          .join(' '),
      ),
    });
  }
  return entries.sort(compareOccurrenceDesc);
}

export function filterDiaryEntries(
  entries: DiaryEntry[],
  filters: DiaryFilters,
): DiaryEntry[] {
  const terms = normalizeText(filters.query.trim())
    .split(/\s+/)
    .filter(Boolean);
  return entries.filter(
    (entry) =>
      (filters.category === 'all' || entry.category === filters.category) &&
      (filters.source === 'all' || entry.source === filters.source) &&
      (filters.result === 'all' || entry.result === filters.result) &&
      (!filters.from || (!!entry.date && entry.date >= filters.from)) &&
      (!filters.to || (!!entry.date && entry.date <= filters.to)) &&
      terms.every((term) => entry.searchText.includes(term)),
  );
}
