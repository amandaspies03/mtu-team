'use client';
import { useState } from 'react';
import { X } from 'lucide-react';
import type { ExpiryState } from '../../lib/util';
import { milDate, daysUntil } from '../../lib/util';
import { useTeam } from '../../lib/data';
import type { TeamEvent } from '../../lib/types';

export function PageTitle({ eyebrow, title, children, actions }: { eyebrow?: string; title: string; children?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="pageTitle">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {children && <p>{children}</p>}
      </div>
      {actions && <div className="titleActions">{actions}</div>}
    </div>
  );
}

export function Tag({ tone = 'neutral', children }: { tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'info' | 'brass'; children: React.ReactNode }) {
  return <span className={`tag ${tone}`}>{children}</span>;
}

export const expiryTone = (s: ExpiryState) => (s === 'ok' ? 'good' : s === 'soon' ? 'warn' : s === 'expired' ? 'bad' : 'neutral');

export function ExpiryTag({ date, state }: { date: string | null; state: ExpiryState }) {
  if (state === 'missing') return <Tag>Not on file</Tag>;
  const d = daysUntil(date!);
  return <Tag tone={expiryTone(state)}>{state === 'expired' ? `Expired ${milDate(date)}` : state === 'soon' ? `${d} days left` : `Exp ${milDate(date)}`}</Tag>;
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="modalBackdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modalHead">
          <h2>{title}</h2>
          <button className="iconBtn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return <div className="empty"><h3>{title}</h3>{children && <p>{children}</p>}</div>;
}

export function Sparkline({ values, max }: { values: number[]; max?: number | null }) {
  if (values.length < 2) return null;
  const w = 120, h = 32, pad = 3;
  const hi = max ?? Math.max(...values), lo = Math.min(...values) * 0.95;
  const pts = values.map((v, i) => [pad + (i * (w - 2 * pad)) / (values.length - 1), h - pad - ((v - lo) / Math.max(1, hi - lo)) * (h - 2 * pad)]);
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-hidden="true">
      <polyline points={pts.map(p => p.join(',')).join(' ')} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="3" fill="currentColor" />
    </svg>
  );
}

/** Lets a shooter say they're coming or not. Staff manage attendance on the event page. */
export function Rsvp({ event }: { event: TeamEvent }) {
  const { sb, me, attendance, reload } = useTeam();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  if (!me.member_id) return <span className="formNote">Ask staff to link your account to the roster to RSVP.</span>;
  const mine = attendance.find(a => a.event_id === event.id && a.member_id === me.member_id);
  const locked = mine && (mine.status === 'attended' || mine.status === 'excused');
  async function set(status: 'planned' | 'absent') {
    setBusy(true); setErr('');
    const { error } = await sb.rpc('rsvp', { p_event: event.id, p_status: status });
    if (error) setErr(error.message); else await reload();
    setBusy(false);
  }
  if (locked) return <Tag tone="good">{mine!.status === 'attended' ? 'Attended' : 'Excused'}</Tag>;
  return (
    <div className="rsvp">
      <button className={mine?.status === 'planned' ? 'chip on' : 'chip'} disabled={busy} onClick={() => set('planned')}>I’m going</button>
      <button className={mine?.status === 'absent' ? 'chip on bad' : 'chip'} disabled={busy} onClick={() => set('absent')}>Can’t make it</button>
      {err && <span className="formNote error">{err}</span>}
    </div>
  );
}
