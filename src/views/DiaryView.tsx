import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Activity,
  Plus,
  Search,
  SlidersHorizontal,
  X,
  ChevronDown,
  CalendarDays,
  MapPin,
  Clock,
  Trophy,
  Shield,
  Users,
  Lock,
  Globe,
  Trash2,
  ArrowDown,
} from 'lucide-react';
import { communityError } from '../views/CommunityView';
import { useApp } from '../context/AppContext';
import { useDialog } from '../hooks/useDialog';
import { AddActivityModal } from '../components/AddActivityModal';
import { SetBreakdown } from '../components/SetBreakdown';
import { ActivityCategory } from '../types';
import {
  DiaryFilters,
  emptyDiaryFilters,
  filterDiaryEntries,
  getDiaryEntries,
} from '../utils/diary';

const categories = [
  { id: 'all', label: 'Všetky', icon: Activity },
  { id: 'tréning', label: 'Tréningy', icon: Clock },
  { id: 'priatelsky', label: 'Zápasy', icon: Users },
  { id: 'liga', label: 'Liga', icon: Shield },
  { id: 'turnaj', label: 'Turnaje', icon: Trophy },
  { id: 'podujatie', label: 'Podujatia', icon: CalendarDays },
] as const;
const pageSize = 20;
const formatDate = (date: string, fallback: string) =>
  date
    ? new Date(`${date}T12:00:00Z`).toLocaleDateString('sk-SK', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      })
    : fallback || 'Dátum neuvedený';
const monthLabel = (date: string) =>
  date
    ? new Date(`${date.slice(0, 7)}-01T12:00:00Z`).toLocaleDateString('sk-SK', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      })
    : 'Bez dátumu';
const rubberLabel = (value: string) =>
  ({
    in: 'Hladký',
    long_pips: 'Tráva',
    short_pips: 'Krátke nopky',
    anti: 'Antispin',
  })[value] || value;

export const DiaryView: React.FC<{ initialCategory?: 'all' | ActivityCategory }> = ({ initialCategory = 'all' }) => {
  const { activities, matches, doublesMatches, deleteActivity } = useApp();
  const [deleting, setDeleting] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [filters, setFilters] = useState<DiaryFilters>({ ...emptyDiaryFilters, category: initialCategory });
  const [showFilters, setShowFilters] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [limit, setLimit] = useState(pageSize);
  const [photo, setPhoto] = useState<string | null>(null);
  const photoRef = useDialog(!!photo, () => setPhoto(null));
  const entries = useMemo(
    () => getDiaryEntries(activities, matches, doublesMatches),
    [activities, matches, doublesMatches],
  );
  const filtered = useMemo(
    () => filterDiaryEntries(entries, filters),
    [entries, filters],
  );
  useEffect(() => setLimit(pageSize), [filters]);
  const setFilter = <K extends keyof DiaryFilters>(
    key: K,
    value: DiaryFilters[K],
  ) => setFilters((previous) => ({ ...previous, [key]: value }));
  const advancedCount = [
    filters.source !== 'all',
    filters.result !== 'all',
    !!filters.from,
    !!filters.to,
  ].filter(Boolean).length;
  const hasFilters =
    advancedCount > 0 || filters.category !== 'all' || !!filters.query.trim();
  const visible = filtered.slice(0, limit);
  const reset = () => setFilters({ ...emptyDiaryFilters });

  return (
    <div className="page-view diary-view animate-fade-in">
      {deleteError && <p role="alert" className="community-error">{deleteError}</p>}
      <header className="diary-header">
        <div>
          <span className="diary-eyebrow">TVOJ ŠPORTOVÝ DENNÍK</span>
          <h1>Aktivity</h1>
          <p>Každý tréning, zápas a zážitok na jednom mieste.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowAdd(true)}>
          <Plus size={18} /> Pridať aktivitu
        </button>
      </header>
      <section
        className="diary-controls"
        aria-label="Výber a filtrovanie aktivít"
      >
        <div
          className="diary-categories"
          role="group"
          aria-label="Typ aktivity"
        >
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              aria-pressed={filters.category === category.id}
              className={filters.category === category.id ? 'selected' : ''}
              onClick={() => setFilter('category', category.id)}
            >
              <category.icon size={17} />
              <span>{category.label}</span>
              <small>
                {category.id === 'all'
                  ? entries.length
                  : entries.filter((entry) => entry.category === category.id)
                      .length}
              </small>
            </button>
          ))}
        </div>
        <div className="diary-search-row">
          <label className="diary-search">
            <Search size={18} />
            <input
              type="search"
              aria-label="Vyhľadať aktivity"
              placeholder="Hľadať súpera, turnaj, miesto alebo poznámku…"
              value={filters.query}
              onChange={(event) => setFilter('query', event.target.value)}
            />
          </label>
          <button
            type="button"
            className={`diary-filter-toggle ${advancedCount ? 'active' : ''}`}
            aria-expanded={showFilters}
            aria-controls="diary-filters"
            onClick={() => setShowFilters(!showFilters)}
          >
            <SlidersHorizontal size={18} /> Filtre{' '}
            {advancedCount > 0 && <span>{advancedCount}</span>}
          </button>
        </div>
        <div
          id="diary-filters"
          className="diary-filter-fields"
          hidden={!showFilters}
        >
          <label>
            Zdroj
            <select
              aria-label="Zdroj"
              value={filters.source}
              onChange={(event) =>
                setFilter(
                  'source',
                  event.target.value as DiaryFilters['source'],
                )
              }
            >
              <option value="all">Všetky záznamy</option>
              <option value="manual">Ručne pridané</option>
              <option value="sstz">Importované zo SSTZ</option>
            </select>
          </label>
          <label>
            Výsledok
            <select
              aria-label="Výsledok"
              value={filters.result}
              onChange={(event) =>
                setFilter(
                  'result',
                  event.target.value as DiaryFilters['result'],
                )
              }
            >
              <option value="all">Všetky výsledky</option>
              <option value="WIN">Výhry</option>
              <option value="LOSS">Prehry</option>
            </select>
          </label>
          <label>
            Od dátumu
            <input
              type="date"
              value={filters.from}
              max={filters.to || undefined}
              onChange={(event) => setFilter('from', event.target.value)}
            />
          </label>
          <label>
            Do dátumu
            <input
              type="date"
              value={filters.to}
              min={filters.from || undefined}
              onChange={(event) => setFilter('to', event.target.value)}
            />
          </label>
        </div>
        {hasFilters && (
          <div className="diary-active-filters">
            <span>
              {[
                filters.category !== 'all'
                  ? categories.find((c) => c.id === filters.category)?.label
                  : '',
                filters.query.trim() ? `„${filters.query.trim()}“` : '',
                filters.source === 'manual'
                  ? 'Ručné záznamy'
                  : filters.source === 'sstz'
                    ? 'SSTZ'
                    : '',
                filters.result === 'WIN'
                  ? 'Výhry'
                  : filters.result === 'LOSS'
                    ? 'Prehry'
                    : '',
                filters.from ? `Od ${formatDate(filters.from, '')}` : '',
                filters.to ? `Do ${formatDate(filters.to, '')}` : '',
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
            <button type="button" onClick={reset}>
              <X size={14} /> Vymazať filtre
            </button>
          </div>
        )}
      </section>
      <div className="diary-list-info">
        <span role="status" aria-live="polite">
          <strong>{filtered.length}</strong>{' '}
          {hasFilters ? `z ${entries.length} aktivít` : 'aktivít v denníku'}
        </span>
        <span>
          <ArrowDown size={14} /> Od najnovších
        </span>
      </div>
      <section className="diary-timeline" aria-label="Zoznam aktivít">
        {visible.map((entry, index) => {
          const category = categories.find((c) => c.id === entry.category)!;
          const Icon = category.icon;
          const activity = entry.activity;
          const match = entry.match;
          const doubles = match && 'opponentPair' in match;
          const month = entry.date.slice(0, 7);
          return (
            <React.Fragment key={entry.id}>
              {(index === 0 ||
                visible[index - 1].date.slice(0, 7) !== month) && (
                <h2 className="diary-month">{monthLabel(entry.date)}</h2>
              )}
              <details className={`diary-card diary-${entry.category}`}>
                <summary>
                  <span className="diary-card-icon">
                    <Icon size={21} />
                  </span>
                  <div className="diary-card-main">
                    <div className="diary-card-meta">
                      <span>
                        {category.label}
                        {doubles ? ' · Štvorhra' : ''}
                      </span>
                      <span className="diary-source">
                        {entry.source === 'sstz' ? 'SSTZ' : 'Vlastný záznam'}
                      </span>
                    </div>
                    <h3>{entry.title}</h3>
                    <p>
                      {entry.subtitle ||
                        (activity?.focusDrills.length
                          ? activity.focusDrills.slice(0, 3).join(' · ')
                          : 'Tvoj záznam aktivity')}
                    </p>
                    <time dateTime={entry.date || undefined}>
                      {formatDate(entry.date, entry.originalDate)}
                    </time>
                  </div>
                  <div className="diary-card-result">
                    {activity?.category === 'tréning' ? (
                      <strong>
                        {activity.durationMinutes}
                        <small> min</small>
                      </strong>
                    ) : entry.score ? (
                      <>
                        <strong
                          className={
                            entry.result === 'WIN'
                              ? 'win'
                              : entry.result === 'LOSS'
                                ? 'loss'
                                : ''
                          }
                        >
                          {entry.score}
                        </strong>
                        {entry.result && (
                          <small>
                            {entry.result === 'WIN' ? 'Výhra' : 'Prehra'}
                          </small>
                        )}
                      </>
                    ) : (
                      <small>Záznam</small>
                    )}
                    <ChevronDown size={18} />
                  </div>
                </summary>
                <div className="diary-card-detail">
                  {activity && (
                    <>
                      <div className="diary-detail-meta">
                        <span>
                          <MapPin size={14} />{' '}
                          {activity.location || 'Miesto neuvedené'}
                        </span>
                        <span>
                          {activity.visibility === 'private' ? (
                            <Lock size={14} />
                          ) : activity.visibility === 'friends' ? (
                            <Users size={14} />
                          ) : (
                            <Globe size={14} />
                          )}
                          {activity.visibility === 'private'
                            ? 'Len ja'
                            : activity.visibility === 'friends'
                              ? 'Priatelia'
                              : 'Verejná'}
                        </span>
                      </div>
                      {(activity.teamHome || activity.teamAway) && (
                        <p>
                          <strong>Tímy:</strong>{' '}
                          {[activity.teamHome, activity.teamAway]
                            .filter(Boolean)
                            .join(' – ')}
                        </p>
                      )}
                      {(activity.eventCategory || activity.placing) && (
                        <p>
                          {[activity.eventCategory, activity.placing]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      )}
                      {activity.opponentName && (
                        <p>
                          <strong>Súper:</strong> {activity.opponentName}
                        </p>
                      )}
                      {(activity.opponentGrip ||
                        activity.opponentFhRubber ||
                        activity.opponentBhRubber) && (
                        <p className="diary-muted">
                          {[
                            activity.opponentGrip
                              ? activity.opponentGrip === 'left'
                                ? 'Ľavák'
                                : 'Pravák'
                              : '',
                            activity.opponentFhRubber
                              ? `FH: ${rubberLabel(activity.opponentFhRubber)}`
                              : '',
                            activity.opponentBhRubber
                              ? `BH: ${rubberLabel(activity.opponentBhRubber)}`
                              : '',
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      )}
                      {activity.category === 'tréning' && !!activity.focusDrills.length && (
                        <div className="diary-drills">
                          {activity.focusDrills.map((drill) => (
                            <span key={drill}>{drill}</span>
                          ))}
                        </div>
                      )}
                      {activity.publicNote && (
                        <p className="diary-note">{activity.publicNote}</p>
                      )}
                      {activity.privateNote && (
                        <div className="diary-private-note">
                          <Lock size={15} />
                          <div>
                            <strong>Súkromná poznámka</strong>
                            <p>{activity.privateNote}</p>
                          </div>
                        </div>
                      )}
                      {!!activity.photos?.length && (
                        <div className="diary-photos">
                          {activity.photos.map((src, photoIndex) => (
                            <button
                              key={photoIndex}
                              type="button"
                              aria-label={`Otvoriť fotku ${photoIndex + 1}`}
                              onClick={() => setPhoto(src)}
                            >
                              <img
                                src={src}
                                alt={`Fotka aktivity ${photoIndex + 1}`}
                              />
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="diary-card-actions">
                        <span className="diary-muted">
                          {activity.category === 'tréning' &&
                          activity.addEquipmentWear
                            ? `+${activity.durationMinutes} min k opotrebovaniu rakety`
                            : ''}
                        </span>
                        <button
                          type="button"
                          disabled={Boolean(deleting)}
                          onClick={async () => {
                            if (!window.confirm('Naozaj chceš zmazať túto aktivitu?')) return;
                            setDeleting(activity.id); setDeleteError('');
                            try { await deleteActivity(activity.id); }
                            catch (error) { setDeleteError(communityError(error)); }
                            finally { setDeleting(''); }
                          }}
                        >
                          <Trash2 size={15} /> Zmazať
                        </button>
                      </div>
                    </>
                  )}
                  {match && (
                    <>
                      <p className="diary-muted">
                        {entry.source === 'sstz'
                          ? 'Importované z oficiálnej histórie SSTZ'
                          : 'Vlastný záznam'}
                      </p>
                      {match.teams && (
                        <p>
                          <strong>Tímy:</strong> {match.teams}
                        </p>
                      )}
                      {'partnerName' in match && match.partnerName && (
                        <p>
                          <strong>Spoluhráč:</strong> {match.partnerName}
                        </p>
                      )}
                      {match.sets.length || match.setDetails?.length ? (
                        <SetBreakdown
                          sets={match.sets}
                          setDetails={match.setDetails}
                          totalPointsWon={match.totalPointsWon}
                          totalPointsLost={match.totalPointsLost}
                          result={match.result}
                          compact
                        />
                      ) : (
                        <p className="diary-muted">
                          Podrobné body jednotlivých setov nie sú v zdroji k
                          dispozícii.
                        </p>
                      )}
                      {match.notes && (
                        <p className="diary-note">{match.notes}</p>
                      )}
                      {'tacticsNote' in match && match.tacticsNote && (
                        <div className="diary-private-note">
                          <Lock size={15} />
                          <div>
                            <strong>Taktické poznámky</strong>
                            <p>{match.tacticsNote}</p>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </details>
            </React.Fragment>
          );
        })}
        {!filtered.length && (
          <div className="diary-empty">
            <Search size={32} />
            <h2>
              {entries.length
                ? 'Žiadna aktivita nevyhovuje filtrom'
                : 'Tvoj denník čaká na prvý záznam'}
            </h2>
            <p>
              {entries.length
                ? 'Skús iný výraz, obdobie alebo typ aktivity.'
                : 'Pridaj tréning, zápas alebo podujatie.'}
            </p>
            <button
              type="button"
              className="btn-primary"
              onClick={entries.length ? reset : () => setShowAdd(true)}
            >
              {entries.length ? 'Vymazať filtre' : 'Pridať aktivitu'}
            </button>
          </div>
        )}
      </section>
      {filtered.length > visible.length && (
        <button
          type="button"
          className="diary-load-more"
          onClick={() => setLimit((previous) => previous + pageSize)}
        >
          Zobraziť ďalších{' '}
          {Math.min(pageSize, filtered.length - visible.length)}{' '}
          <ChevronDown size={17} />
        </button>
      )}
      {visible.length > 0 && (
        <p className="diary-bottom-count">
          Zobrazené {visible.length} z {filtered.length} aktivít
        </p>
      )}
      <AddActivityModal
        isOpen={showAdd}
        onClose={() => setShowAdd(false)}
        defaultCategory={
          filters.category === 'all'
            ? 'tréning'
            : (filters.category as ActivityCategory)
        }
      />
      {photo &&
        createPortal(
          <div className="diary-photo-overlay" onClick={() => setPhoto(null)}>
            <div
              ref={photoRef}
              role="dialog"
              aria-modal="true"
              aria-label="Fotka aktivity"
              tabIndex={-1}
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                aria-label="Zavrieť fotku"
                onClick={() => setPhoto(null)}
              >
                <X size={22} />
              </button>
              <img src={photo} alt="Zväčšená fotka aktivity" />
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};
