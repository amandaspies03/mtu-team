'use client';
// What's new: published app updates, unread badge, staff editor (drafts, staff-only notes, one-time popups).
import { useCallback, useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ArrowRight, Bell, Check, Pencil, Trash2, X } from 'lucide-react';
import { go } from '../app-shell';
import { PageTitle } from './ui';

export type Announcement = {
  id: string; title: string; body: string; popup: boolean; target: string | null; audience: 'all' | 'staff';
  created_at: string; published_at: string | null; read: boolean;
};

export const UPDATE_TARGETS: Record<string, string> = {
  dashboard: 'Dashboard', events: 'Calendar', scores: 'Scores', matchday: 'Match day', resources: 'Resources', me: 'My profile',
};

const isLive = (a: Announcement) => !!a.published_at && Date.parse(a.published_at) <= Date.now();

export function useUpdates(sb: SupabaseClient, userId: string, isStaff: boolean) {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  const gen = useRef(0);

  const refresh = useCallback(async () => {
    const id = ++gen.current;
    setLoading(true);
    const [a, r] = await Promise.all([
      sb.from('announcements').select('id, title, body, popup, target, audience, created_at, published_at').order('created_at', { ascending: false }).limit(100),
      sb.from('announcement_reads').select('announcement_id').eq('user_id', userId),
    ]);
    if (id !== gen.current) return;
    setLoading(false);
    if (a.error || r.error) { setError('Updates could not load. Refresh to try again.'); return; }
    const read = new Set((r.data ?? []).map(x => x.announcement_id as string));
    setItems((a.data ?? []).map(x => ({ ...(x as Omit<Announcement, 'read'>), read: read.has(x.id as string) })));
    setError('');
  }, [sb, userId]);

  useEffect(() => {
    void refresh();
    const onFocus = () => { void refresh(); };
    window.addEventListener('focus', onFocus);
    return () => { gen.current++; window.removeEventListener('focus', onFocus); };
  }, [refresh]);

  const markRead = useCallback(async (ids: string[]) => {
    if (!ids.length) return true;
    const { error: e } = await sb.from('announcement_reads').upsert(ids.map(id => ({ user_id: userId, announcement_id: id })), { onConflict: 'user_id,announcement_id' });
    if (e) { setError('Could not save read status. Try again.'); return false; }
    setItems(prev => prev.map(a => (ids.includes(a.id) ? { ...a, read: true } : a)));
    return true;
  }, [sb, userId]);

  // Staff previewing the shooter view only see what shooters see.
  const published = items.filter(a => isLive(a) && (isStaff || a.audience === 'all'))
    .sort((a, b) => Date.parse(b.published_at!) - Date.parse(a.published_at!));
  const unread = published.filter(a => !a.read);
  const drafts = isStaff ? items.filter(a => !isLive(a)) : [];
  return { items, published, unread, drafts, loading, error, refresh, markRead };
}
export type UpdatesFeed = ReturnType<typeof useUpdates>;

const longDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });

export function WhatsNew({ feed, sb, isStaff }: { feed: UpdatesFeed; sb: SupabaseClient; isStaff: boolean }) {
  const { markRead } = feed;
  const unreadKey = feed.unread.map(a => a.id).join(',');
  // Opening this page counts as reading everything on it.
  useEffect(() => { if (unreadKey) void markRead(unreadKey.split(',')); }, [unreadKey, markRead]);
  const [editing, setEditing] = useState<Announcement | 'new' | null>(null);

  return (
    <div className="whatsNew">
      <PageTitle eyebrow="APP UPDATES" title="What’s new">Changes and new features in the 184th MTU Team Manager.</PageTitle>
      {feed.error && <div className="alert" role="alert">{feed.error}</div>}
      {isStaff && !editing && <div className="updateActions"><button className="primary" onClick={() => setEditing('new')}>Post an update</button></div>}
      {isStaff && editing && <UpdateEditor sb={sb} item={editing === 'new' ? null : editing} onDone={async () => { setEditing(null); await feed.refresh(); }} />}
      {isStaff && feed.drafts.length > 0 && (
        <section className="panel">
          <h2>Drafts</h2>
          {feed.drafts.map(a => (
            <div className="draftRow" key={a.id}>
              <span><b>{a.title}</b><small className="sub">Saved {longDate(a.created_at)}{a.audience === 'staff' ? ' · staff only' : ''}</small></span>
              <button className="secondary" onClick={() => setEditing(a)}><Pencil size={14} /> Edit</button>
            </div>
          ))}
        </section>
      )}
      {feed.loading && !feed.published.length ? <p className="muted">Loading updates…</p>
        : !feed.published.length ? <div className="empty"><Bell size={22} /><h3>No updates yet.</h3></div>
        : feed.published.map(a => (
          <article className="panel updateCard" key={a.id}>
            <div className="updateMeta">
              <small>{longDate(a.published_at!)}</small>
              {a.audience === 'staff' && <span className="tag">Staff only</span>}
              {isStaff && <button className="iconBtn" aria-label={`Edit ${a.title}`} onClick={() => setEditing(a)}><Pencil size={15} /></button>}
            </div>
            <h2>{a.title}</h2>
            <div className="updateBody">{a.body}</div>
            {a.target && UPDATE_TARGETS[a.target] && <button className="secondary" onClick={() => go(a.target!)}>Open {UPDATE_TARGETS[a.target]} <ArrowRight size={14} /></button>}
          </article>
        ))}
    </div>
  );
}

function UpdateEditor({ sb, item, onDone }: { sb: SupabaseClient; item: Announcement | null; onDone: () => Promise<void> }) {
  const [title, setTitle] = useState(item?.title ?? ''), [body, setBody] = useState(item?.body ?? '');
  const [target, setTarget] = useState(item?.target ?? ''), [popup, setPopup] = useState(item?.popup ?? false);
  const [audience, setAudience] = useState<'all' | 'staff'>(item?.audience ?? 'all');
  const [busy, setBusy] = useState(false), [err, setErr] = useState('');
  const live = !!item && isLive(item);
  const ok = title.trim().length > 0 && body.trim().length > 0;

  async function save(publish: boolean) {
    if (!ok || busy) return;
    setBusy(true); setErr('');
    const row = {
      title: title.trim().slice(0, 120), body: body.trim().slice(0, 4000), target: target || null, popup, audience,
      published_at: publish ? (live ? item!.published_at : new Date().toISOString()) : null,
    };
    const { error } = item ? await sb.from('announcements').update(row).eq('id', item.id) : await sb.from('announcements').insert(row);
    setBusy(false);
    if (error) setErr('The update could not be saved. Staff access is required.'); else await onDone();
  }
  async function remove() {
    if (!item || busy || !window.confirm(`Delete “${item.title}”? This can’t be undone.`)) return;
    setBusy(true);
    const { error } = await sb.from('announcements').delete().eq('id', item.id);
    setBusy(false);
    if (error) setErr('Could not delete the update.'); else await onDone();
  }

  return (
    <section className="panel updateEditor">
      <h2>{item ? (live ? 'Edit published update' : 'Edit draft') : 'Post an update'}</h2>
      <form onSubmit={e => { e.preventDefault(); void save(true); }}>
        <label>Title<input required maxLength={120} value={title} disabled={busy} onChange={e => setTitle(e.target.value)} /></label>
        <label>What changed<textarea required rows={6} maxLength={4000} value={body} disabled={busy} onChange={e => setBody(e.target.value)} placeholder="Plain words. Blank lines start new paragraphs." /></label>
        <div className="grid2">
          <label>Button to open a page<select value={target} disabled={busy} onChange={e => setTarget(e.target.value)}>
            <option value="">No button</option>
            {Object.entries(UPDATE_TARGETS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select></label>
          <label>Who sees it<select value={audience} disabled={busy} onChange={e => setAudience(e.target.value as 'all' | 'staff')}>
            <option value="all">Everyone</option><option value="staff">Staff only</option>
          </select></label>
        </div>
        <label className="check"><input type="checkbox" checked={popup} disabled={busy} onChange={e => setPopup(e.target.checked)} /> Show a one-time popup for this update (for big changes)</label>
        {err && <p className="alert" role="alert">{err}</p>}
        <div className="formActions">
          {item && <button type="button" className="danger" disabled={busy} onClick={() => { void remove(); }}><Trash2 size={14} /> Delete</button>}
          <button type="button" disabled={busy} onClick={() => { void onDone(); }}>Cancel</button>
          {!live && <button type="button" className="secondary" disabled={busy || !ok} onClick={() => { void save(false); }}>Save draft</button>}
          <button className="primary" disabled={busy || !ok}>{busy ? 'Saving…' : live ? 'Save changes' : 'Publish'}</button>
        </div>
      </form>
    </section>
  );
}

/** One-time popup for the newest unread update marked "popup". */
export function UpdatePopup({ item, onClose }: { item: Announcement; onClose: (open: boolean) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.querySelector<HTMLButtonElement>('button.primary')?.focus(); }, []);
  return (
    <div className="modalBackdrop" onKeyDown={e => { if (e.key === 'Escape') onClose(false); }}>
      <div className="modal updatePopup" ref={ref} role="dialog" aria-modal="true" aria-labelledby="update-popup-title">
        <div className="modalHead">
          <div><div className="eyebrow">WHAT’S NEW</div><h2 id="update-popup-title">{item.title}</h2></div>
          <button className="iconBtn" onClick={() => onClose(false)} aria-label="Dismiss"><X size={18} /></button>
        </div>
        <div className="updateBody">{item.body}</div>
        <div className="formActions">
          <button onClick={() => onClose(false)}>Dismiss</button>
          <button className="primary" onClick={() => onClose(true)}><Check size={15} /> {item.target && UPDATE_TARGETS[item.target] ? `Open ${UPDATE_TARGETS[item.target]}` : 'Got it'}</button>
        </div>
      </div>
    </div>
  );
}
