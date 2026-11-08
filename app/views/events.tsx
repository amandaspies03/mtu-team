'use client';
import { useState } from 'react';
import { CalendarDays, CalendarPlus, List, Plus } from 'lucide-react';
import { CalendarView, type CalMode } from './calendar-view';
import { downloadIcs } from '../../lib/ics';
import { useTeam } from '../../lib/data';
import { EVENT_KINDS, type TeamEvent } from '../../lib/types';
import { eventRange, fiscalYear, kindLabel, todayISO } from '../../lib/util';
import { go } from '../app-shell';
import { Empty, Modal, PageTitle, Rsvp, Tag } from './ui';

const kindTone = { practice: 'good', match: 'brass', tryout: 'info', qual: 'warn', cleaning: 'neutral', meeting: 'neutral', other: 'neutral' } as const;

export function EventForm({ event, onClose, initialDate }: { event?: TeamEvent; onClose: () => void; initialDate?: string }) {
  const { sb, reload } = useTeam();
  const [f, setF] = useState({
    title: event?.title ?? 'MTU Practice', kind: event?.kind ?? 'practice', start_date: event?.start_date ?? initialDate ?? '', end_date: event?.end_date ?? '',
    location: event?.location ?? '', notes: event?.notes ?? '',
  });
  const [busy, setBusy] = useState(false), [err, setErr] = useState('');
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (f.end_date && f.end_date < f.start_date) { setErr('End date is before the start date.'); return; }
    setBusy(true); setErr('');
    const row = { ...f, end_date: f.end_date || null, location: f.location.trim() || null, notes: f.notes.trim() || null };
    const { data, error } = event
      ? await sb.from('events').update(row).eq('id', event.id).select('id').single()
      : await sb.from('events').insert(row).select('id').single();
    if (error) { setErr(error.message); setBusy(false); return; }
    await reload();
    onClose();
    if (!event) go('event', data.id);
  }
  return (
    <Modal title={event ? 'Edit event' : 'Add to calendar'} onClose={onClose}>
      <form onSubmit={save} className="form">
        <div className="formGrid">
          <label>Title<input value={f.title} onChange={e => setF({ ...f, title: e.target.value })} required /></label>
          <label>Type<select value={f.kind} onChange={e => setF({ ...f, kind: e.target.value as TeamEvent['kind'] })}>{EVENT_KINDS.map(k => <option key={k} value={k}>{kindLabel[k]}</option>)}</select></label>
          <label>Date<input type="date" value={f.start_date} onChange={e => setF({ ...f, start_date: e.target.value })} required /></label>
          <label>End date <span>multi-day matches</span><input type="date" value={f.end_date} onChange={e => setF({ ...f, end_date: e.target.value })} /></label>
        </div>
        <label>Location<input value={f.location} onChange={e => setF({ ...f, location: e.target.value })} placeholder="STC, Cory’s range, McConnell…" /></label>
        <label>Plan / notes<textarea rows={4} value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} placeholder="Drills, courses of fire, uniform, report time…" /></label>
        {err && <p className="alert">{err}</p>}
        <div className="formActions"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button></div>
      </form>
    </Modal>
  );
}

export default function Events() {
  const { isStaff, events, attendance } = useTeam();
  const [adding, setAdding] = useState<string | null>(null);
  const [kind, setKind] = useState('');
  const today = todayISO();
  const pref = (k: string, d: string) => { try { return localStorage.getItem(k) || d; } catch { return d; } };
  const save = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } };
  const [view, setViewState] = useState<'list' | 'calendar'>(() => pref('mtu-cal-view', 'list') as 'list' | 'calendar');
  const [mode, setModeState] = useState<CalMode>(() => pref('mtu-cal-mode', 'month') as CalMode);
  // Remember the month/day being viewed for this browser tab, so coming back from an event returns to it.
  const [cursor, setCursorState] = useState(() => { try { return sessionStorage.getItem('mtu-cal-cursor') || today; } catch { return today; } });
  const setCursor = (c: string) => { setCursorState(c); try { sessionStorage.setItem('mtu-cal-cursor', c); } catch { /* storage blocked */ } };
  const setView = (v: 'list' | 'calendar') => { setViewState(v); save('mtu-cal-view', v); };
  const setMode = (m: CalMode) => { setModeState(m); save('mtu-cal-mode', m); };
  const list = events.filter(e => !kind || e.kind === kind);
  const upcoming = list.filter(e => (e.end_date ?? e.start_date) >= today);
  const past = list.filter(e => (e.end_date ?? e.start_date) < today).reverse();
  const byFy = past.reduce<Record<number, TeamEvent[]>>((g, e) => { (g[fiscalYear(e.start_date)] ||= []).push(e); return g; }, {});
  const count = (e: TeamEvent, s: string) => attendance.filter(a => a.event_id === e.id && a.status === s).length;

  const row = (e: TeamEvent, isPast: boolean) => (
    <div key={e.id} className="listRow" role="button" tabIndex={0} onClick={() => go('event', e.id)} onKeyDown={k => k.key === 'Enter' && go('event', e.id)}>
      <div className="dateBlock"><b>{e.start_date.slice(8)}</b><span>{new Date(e.start_date + 'T12:00').toLocaleString('en-US', { month: 'short' }).toUpperCase()}</span></div>
      <div className="grow"><strong>{e.title}</strong><small>{eventRange(e)}{e.location ? ` · ${e.location}` : ''}</small></div>
      <Tag tone={kindTone[e.kind]}>{kindLabel[e.kind]}</Tag>
      {isPast ? <Tag>{count(e, 'attended')} attended</Tag> : (isStaff ? <Tag tone="info">{count(e, 'planned')} going</Tag> : <span onClick={x => x.stopPropagation()}><Rsvp event={e} /></span>)}
    </div>
  );

  return (
    <div>
      <PageTitle eyebrow="SCHEDULE" title="Calendar" actions={<>{upcoming.length > 0 && <button className="secondary" onClick={() => downloadIcs('MTU upcoming events.ics', upcoming)}><CalendarPlus size={15} /> Add all upcoming to my calendar</button>}{isStaff && <button className="primary" onClick={() => setAdding('')}><Plus size={15} /> Add event</button>}</>}>
        Practices, tryouts and matches. Open one to see who’s going, track 336s and orders, and log ammo issued.
      </PageTitle>
      <div className="filters">
        <label><select value={kind} onChange={e => setKind(e.target.value)}><option value="">All types</option>{EVENT_KINDS.map(k => <option key={k} value={k}>{kindLabel[k]}</option>)}</select></label>
        <div className="segmented" role="group" aria-label="View">
          <button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}><List size={15} /> List</button>
          <button className={view === 'calendar' ? 'on' : ''} onClick={() => setView('calendar')}><CalendarDays size={15} /> Calendar</button>
        </div>
      </div>
      {view === 'calendar' ? (
        <CalendarView events={list} mode={mode} setMode={setMode} cursor={cursor} setCursor={setCursor} onAdd={isStaff ? d => setAdding(d) : undefined} />
      ) : <>
      <section className="panel">
        <div className="sectionTitle"><h2>Upcoming</h2></div>
        {upcoming.length === 0 ? <Empty title="Nothing scheduled">{isStaff ? 'Add the next practice so shooters can RSVP and get their 336s in.' : 'Check back soon.'}</Empty> : upcoming.map(e => row(e, false))}
      </section>
      {Object.keys(byFy).sort().reverse().map(fy => (
        <section key={fy} className="panel">
          <div className="sectionTitle"><h2>FY{fy.slice(2)}</h2><span className="formNote">{byFy[+fy].length} events</span></div>
          {byFy[+fy].map(e => row(e, true))}
        </section>
      ))}
      </>}
      {adding !== null && <EventForm initialDate={adding || undefined} onClose={() => setAdding(null)} />}
    </div>
  );
}
