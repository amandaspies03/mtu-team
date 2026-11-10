'use client';
// Shows when there's no signal, when the screens are showing the copy saved on this device,
// and what's waiting to send. Scores, RSVPs and checklist ticks made offline send on their own.
import { useEffect, useState } from 'react';
import { CloudOff, RefreshCw, Trash2 } from 'lucide-react';
import { useTeam } from '../../lib/data';
import { discardOutboxItem } from '../../lib/offline';

const time = (iso: string) => {
  const d = new Date(iso), today = new Date().toDateString() === d.toDateString();
  return d.toLocaleString('en-US', today ? { hour: 'numeric', minute: '2-digit' } : { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
};

export function OfflineBanner() {
  const { offline, pending, sendPending } = useTeam();
  const [online, setOnline] = useState(true);
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false);
  useEffect(() => {
    const on = () => setOnline(navigator.onLine);
    on();
    window.addEventListener('online', on); window.addEventListener('offline', on);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', on); };
  }, []);

  const failed = pending.filter(p => p.error);
  if (online && !offline && !pending.length) return null;

  async function retry() { setBusy(true); await sendPending(); setBusy(false); }

  return (
    <div className={`offlineBanner${failed.length ? ' hasFailed' : ''}`} role="status">
      <div className="obMain">
        <CloudOff size={18} aria-hidden="true" />
        <div className="obText">
          <b>{!online || offline ? 'No signal' : 'Back online'}</b>
          <span>
            {offline ? `Showing what was saved on this device at ${time(offline.savedAt)}. ` : !online ? 'Showing what was already loaded. ' : ''}
            {pending.length
              ? `${pending.length} change${pending.length === 1 ? '' : 's'} waiting to send${online ? '' : ' when you’re back in signal'}.`
              : 'Scores, RSVPs and checklist ticks you make now will send when signal returns. Other changes need signal.'}
          </span>
        </div>
        {pending.length > 0 && <button className="linkBtn" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? 'Hide' : 'Show'}</button>}
        {(pending.length > 0 || offline) && <button className="secondary obRetry" disabled={busy} onClick={retry}><RefreshCw size={14} /> {busy ? 'Trying…' : 'Try now'}</button>}
      </div>
      {open && pending.length > 0 && (
        <ul className="obList">
          {pending.map(p => (
            <li key={p.id}>
              <span><b>{p.label}</b><small>{time(p.createdAt)}{p.error ? ` · Not saved: ${p.error}` : ' · waiting'}</small></span>
              {p.error && <button className="iconBtn" aria-label={`Discard ${p.label}`} onClick={() => { if (confirm(`Discard “${p.label}”? It was refused by the server and won’t be saved.`)) void discardOutboxItem(p.id); }}><Trash2 size={15} /></button>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
