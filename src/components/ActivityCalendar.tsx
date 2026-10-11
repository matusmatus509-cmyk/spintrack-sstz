import React, { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Clock, MapPin, Plus, Trophy, Shield, Users } from 'lucide-react';
import type { ActivityCategory } from '../types';
import { calendarDate, calendarDays } from '../utils/calendar';
import { formatDuration } from '../utils/formatDuration';

export const activityCategories = [
  { id: 'tréning', label: 'Tréning', icon: Clock },
  { id: 'liga', label: 'Liga', icon: Shield },
  { id: 'turnaj', label: 'Turnaj', icon: Trophy },
  { id: 'priatelsky', label: 'Priateľský zápas', icon: Users },
  { id: 'podujatie', label: 'Podujatie', icon: CalendarDays },
] as const;

export interface CalendarEvent {
  id: string;
  date: string;
  category: ActivityCategory;
  title: string;
  time?: string;
  location?: string;
  duration?: number;
  detail?: string;
  planned?: boolean;
  actionLabel?: string;
}

interface Props {
  events: CalendarEvent[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onAdd: () => void;
  onAction: (event: CalendarEvent) => void;
  busy?: boolean;
}

export const ActivityCalendar: React.FC<Props> = ({ events, selectedDate, onSelectDate, onAdd, onAction, busy }) => {
  const [month, setMonth] = useState(() => new Date(`${selectedDate}T12:00:00`));
  const today = calendarDate(new Date());
  const days = calendarDays(month);
  const byDay = useMemo(() => {
    const result = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      if (!event.date) continue;
      const day = result.get(event.date) || [];
      day.push(event);
      result.set(event.date, day);
    }
    for (const day of result.values()) day.sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    return result;
  }, [events]);
  const selected = byDay.get(selectedDate) || [];
  const monthLabel = month.toLocaleDateString('sk-SK', { month: 'long', year: 'numeric' });
  const dayLabel = new Date(`${selectedDate}T12:00:00`).toLocaleDateString('sk-SK', { weekday: 'long', day: 'numeric', month: 'long' });
  const selectDay = (date: Date) => {
    onSelectDate(calendarDate(date));
    if (date.getMonth() !== month.getMonth() || date.getFullYear() !== month.getFullYear()) setMonth(new Date(date.getFullYear(), date.getMonth(), 1));
  };

  return <div className="calendar-workspace">
    <section className="month-calendar" aria-label="Mesačný kalendár aktivít">
      <div className="calendar-toolbar">
        <div><span className="calendar-eyebrow">TVOJ ŠPORTOVÝ PROGRAM</span><h2 aria-live="polite">{monthLabel}</h2></div>
        <div className="calendar-month-controls">
          <button type="button" onClick={() => { setMonth(new Date()); onSelectDate(today); }}>Dnes</button>
          <button type="button" aria-label="Predchádzajúci mesiac" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft size={18} /></button>
          <button type="button" aria-label="Nasledujúci mesiac" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight size={18} /></button>
        </div>
      </div>
      <div className="calendar-legend" aria-label="Farby aktivít">{activityCategories.map(category => <span key={category.id} data-category={category.id}><i />{category.label}</span>)}</div>
      <div className="calendar-weekdays" aria-hidden="true">{['Po', 'Ut', 'St', 'Št', 'Pi', 'So', 'Ne'].map(day => <span key={day}>{day}</span>)}</div>
      <div className="calendar-month-grid" role="group" aria-label={monthLabel}>
        {days.map(date => {
          const key = calendarDate(date);
          const dayEvents = byDay.get(key) || [];
          const categories = [...new Set(dayEvents.map(event => event.category))];
          return <button type="button" key={key} data-date={key}
            className={`calendar-day ${date.getMonth() !== month.getMonth() ? 'outside-month' : ''} ${key === today ? 'is-today' : ''} ${key === selectedDate ? 'is-selected' : ''}`}
            aria-pressed={key === selectedDate}
            aria-label={`${date.toLocaleDateString('sk-SK', { day: 'numeric', month: 'long', year: 'numeric' })}${key === today ? ', dnes' : ''}, ${dayEvents.length} aktivít${dayEvents.length ? ': ' + dayEvents.map(event => event.title).join(', ') : ''}`}
            onClick={() => selectDay(date)}>
            <span className="calendar-day-top"><span className="calendar-day-number">{date.getDate()}</span>{dayEvents.length > 0 && <small>{dayEvents.length}</small>}</span>
            <span className="calendar-event-dots" aria-hidden="true">{categories.map(category => <i key={category} data-category={category} />)}</span>
            <span className="calendar-cell-events" aria-hidden="true">{dayEvents.slice(0, 2).map(event => <span key={event.id} data-category={event.category}>{event.title}</span>)}{dayEvents.length > 2 && <small>+{dayEvents.length - 2} ďalšie</small>}</span>
          </button>;
        })}
      </div>
    </section>
    <section className="calendar-day-panel" aria-label="Aktivity vybraného dňa">
      <header><div><span className="calendar-eyebrow">VYBRANÝ DEŇ</span><h2>{dayLabel}</h2><p>{selected.length ? `${selected.length} aktivít v programe` : 'Priestor na ďalší zážitok'}</p></div><button type="button" className="calendar-add-day" aria-label="Pridať aktivitu na vybraný deň" onClick={onAdd}><Plus size={20} /></button></header>
      {selected.length ? <div className="calendar-day-events">{selected.map(event => {
        const category = activityCategories.find(category => category.id === event.category)!;
        const Icon = category.icon;
        return <article className="calendar-event-card" data-category={event.category} key={event.id}>
          <div className="calendar-event-heading"><span className="calendar-category-icon"><Icon size={18} /></span><span className="calendar-category-name">{category.label}</span>{event.planned && <span className="activity-status">Naplánované</span>}</div>
          <h3>{event.title}</h3>
          <div className="calendar-event-meta">{event.time && <span><Clock size={14} />{event.time}</span>}{!!event.duration && <span>{formatDuration(event.duration)}</span>}{event.location && <span><MapPin size={14} />{event.location}</span>}</div>
          {event.detail && <p>{event.detail}</p>}
          {event.actionLabel && <button type="button" disabled={busy} onClick={() => onAction(event)}>{event.actionLabel}<ChevronRight size={15} /></button>}
        </article>;
      })}</div> : <div className="calendar-day-empty"><CalendarDays size={32} /><h3>Zatiaľ bez aktivít</h3><p>Pridaj tréning, turnaj či podujatie. Každý typ má svoju farbu.</p><button className="btn-secondary" onClick={onAdd}><Plus size={16} />Pridať aktivitu</button></div>}
    </section>
  </div>;
};
