'use client';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, MapPin, Plus } from 'lucide-react';
import { useTeam } from '../../lib/data';
import type { TeamEvent } from '../../lib/types';
import { eventRange, kindLabel, todayISO } from '../../lib/util';
import { go } from '../app-shell';
import { Tag } from './ui';

export type CalMode = 'month' | 'week' | 'day';

// All dates are plain YYYY-MM-DD strings handled in local time, so nothing shifts across time zones.
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const toDate = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s: string, n: number) => { const d = toDate(s); d.setDate(d.getDate() + n); return iso(d); };
const addMonths = (s: string, n: number) => { const d = toDate(s); return iso(new Date(d.getFullYear(), d.getMonth() + n, 1)); };
const startOfWeek = (s: string) => addDays(s, -toDate(s).getDay()); // weeks start Sunday
const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

const onDay = (e: TeamEvent, day: string) => e.start_date <= day && (e.end_date ?? e.start_date) >= day;

export function shiftCursor(cursor: string, mode: CalMode, dir: number) {
  if (mode === 'month') return addMonths(cursor, dir);
  return addDays(cursor, mode === 'week' ? 7 * dir : dir);
}

export function cursorTitle(cursor: string, mode: CalMode) {
  const d = toDate(cursor);
  if (mode === 'month') return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  if (mode === 'day') return d.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const start = toDate(startOfWeek(cursor)), end = toDate(addDays(startOfWeek(cursor), 6));
  const mon = (x: Date) => x.toLocaleDateString('en-US', { month: 'short' });
  if (start.getFullYear() !== end.getFullYear()) return `${mon(start)} ${start.getDate()}, ${start.getFullYear()} – ${mon(end)} ${end.getDate()}, ${end.getFullYear()}`;
  if (start.getMonth() !== end.getMonth()) return `${mon(start)} ${start.getDate()} – ${mon(end)} ${end.getDate()}, ${end.getFullYear()}`;
  return `${mon(start)} ${start.getDate()} – ${end.getDate()}, ${end.getFullYear()}`;
}

function Chip({ e, compact }: { e: TeamEvent; compact?: boolean }) {
  return (
    <button className={`calChip k-${e.kind}`} onClick={x => { x.stopPropagation(); go('event', e.id); }} title={`${e.title}${e.location ? ' · ' + e.location : ''}`}>
      {compact ? e.title : <><b>{e.title}</b>{e.location && <small>{e.location}</small>}</>}
    </button>
  );
}

export function CalendarView({ events, mode, cursor, setCursor, setMode, onAdd }: {
  events: TeamEvent[]; mode: CalMode; cursor: string;
  setCursor: (c: string) => void; setMode: (m: CalMode) => void; onAdd?: (date: string) => void;
}) {
  const { attendance, isStaff } = useTeam();
  const today = todayISO();
  const openDay = (day: string) => { setCursor(day); setMode('day'); };

  return (
    <section className="panel calPanel">
      <div className="calBar">
        <div className="row">
          <button className="secondary" onClick={() => setCursor(today)}>Today</button>
          <button className="iconBtn" aria-label="Previous" onClick={() => setCursor(shiftCursor(cursor, mode, -1))}><ChevronLeft size={18} /></button>
          <button className="iconBtn" aria-label="Next" onClick={() => setCursor(shiftCursor(cursor, mode, 1))}><ChevronRight size={18} /></button>
          <DateJump cursor={cursor} mode={mode} setCursor={setCursor} years={events.map(e => +e.start_date.slice(0, 4))} />
        </div>
        <div className="segmented" role="group" aria-label="Calendar range">
          {(['month', 'week', 'day'] as CalMode[]).map(m => <button key={m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>{m[0].toUpperCase() + m.slice(1)}</button>)}
        </div>
      </div>

      {mode === 'month' && (() => {
        const first = startOfWeek(addMonths(cursor, 0));
        const month = toDate(cursor).getMonth();
        const days = Array.from({ length: 42 }, (_, i) => addDays(first, i));
        const rows = days[35] && toDate(days[35]).getMonth() !== month ? days.slice(0, 35) : days;
        return (
          <div className="monthGrid">
            {WEEKDAYS.map(w => <div key={w} className="calHead">{w}</div>)}
            {rows.map(day => {
              const evs = events.filter(e => onDay(e, day));
              const out = toDate(day).getMonth() !== month;
              return (
                <div key={day} className={`calCell${out ? ' out' : ''}${day === today ? ' today' : ''}`} onClick={() => openDay(day)} role="button" tabIndex={0} onKeyDown={k => k.key === 'Enter' && openDay(day)} aria-label={`${toDate(day).toDateString()}, ${evs.length} events`}>
                  <span className="calNum">{toDate(day).getDate()}</span>
                  {evs.slice(0, 3).map(e => <Chip key={e.id} e={e} compact />)}
                  {evs.length > 3 && <small className="calMore">+{evs.length - 3} more</small>}
                </div>
              );
            })}
          </div>
        );
      })()}

      {mode === 'week' && (() => {
        const days = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(cursor), i));
        return (
          <div className="weekGrid">
            {days.map(day => {
              const evs = events.filter(e => onDay(e, day));
              return (
                <div key={day} className={`weekCol${day === today ? ' today' : ''}`}>
                  <button className="weekHead" onClick={() => openDay(day)}><span>{WEEKDAYS[toDate(day).getDay()]}</span><b>{toDate(day).getDate()}</b></button>
                  <div className="weekBody">
                    {evs.map(e => <Chip key={e.id} e={e} />)}
                    {evs.length === 0 && onAdd && <button className="calAdd" onClick={() => onAdd(day)} aria-label={`Add event on ${day}`}><Plus size={14} /></button>}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      {mode === 'day' && (() => {
        const evs = events.filter(e => onDay(e, cursor));
        return (
          <div className="dayList">
            {evs.length === 0 ? (
              <div className="empty"><h3>Nothing scheduled</h3>{onAdd && <button className="primary" onClick={() => onAdd(cursor)}><Plus size={15} /> Add event on this day</button>}</div>
            ) : evs.map(e => {
              const going = attendance.filter(a => a.event_id === e.id && (a.status === 'planned' || a.status === 'attended')).length;
              return (
                <button key={e.id} className={`dayCard k-${e.kind}`} onClick={() => go('event', e.id)}>
                  <div className="row"><Tag>{kindLabel[e.kind]}</Tag>{e.end_date && e.end_date !== e.start_date && <small>{eventRange(e)}</small>}</div>
                  <h3>{e.title}</h3>
                  {e.location && <p><MapPin size={13} /> {e.location}</p>}
                  {e.notes && <p className="pre dayNotes">{e.notes}</p>}
                  {isStaff && <small>{going} {e.start_date < today ? 'on roster' : 'going'}</small>}
                </button>
              );
            })}
          </div>
        );
      })()}
    </section>
  );
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Click the calendar title to jump straight to any month, year or date. */
function DateJump({ cursor, mode, setCursor, years }: { cursor: string; mode: CalMode; setCursor: (c: string) => void; years: number[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const d = toDate(cursor);
  const thisYear = new Date().getFullYear();
  const lo = Math.min(thisYear - 5, ...years), hi = Math.max(thisYear + 3, ...years);
  const yearOpts = Array.from({ length: hi - lo + 1 }, (_, i) => hi - i);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  const setYM = (y: number, m: number) => {
    const last = new Date(y, m + 1, 0).getDate();
    setCursor(iso(new Date(y, m, Math.min(d.getDate(), last))));
  };

  return (
    <div className="dateJump" ref={ref}>
      <button className="calTitle" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(!open)}>
        {cursorTitle(cursor, mode)} <ChevronDown size={16} />
      </button>
      {open && (
        <div className="jumpPop" role="dialog" aria-label="Go to date">
          <div className="jumpRow">
            <label>Month<select value={d.getMonth()} onChange={e => setYM(d.getFullYear(), +e.target.value)}>{MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}</select></label>
            <label>Year<select value={d.getFullYear()} onChange={e => setYM(+e.target.value, d.getMonth())}>{yearOpts.map(y => <option key={y} value={y}>{y}</option>)}</select></label>
          </div>
          <label>Exact date<input type="date" value={cursor} onChange={e => e.target.value && setCursor(e.target.value)} /></label>
          <div className="formActions"><button className="primary" onClick={() => setOpen(false)}>Done</button></div>
        </div>
      )}
    </div>
  );
}
