// Offline support: a copy of the last team data on this device, and an outbox of changes made without signal.
// Everything lives in this browser's IndexedDB. The data copy leaves out roster contact info and
// admin-only data, and is deleted on sign-out. Outbox items wait for the same account to come back online.
import type { SupabaseClient } from '@supabase/supabase-js';

const DB = 'mtu-offline', STORE = 'kv';
let dbp: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  if (!dbp) dbp = new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  return dbp;
}
async function get<T>(key: string): Promise<T | undefined> {
  try {
    const d = await db();
    return await new Promise<T | undefined>((res, rej) => { const q = d.transaction(STORE).objectStore(STORE).get(key); q.onsuccess = () => res(q.result as T | undefined); q.onerror = () => rej(q.error); });
  } catch { return undefined; }
}
async function set(key: string, value: unknown) {
  try {
    const d = await db();
    await new Promise<void>((res, rej) => { const t = d.transaction(STORE, 'readwrite'); t.objectStore(STORE).put(value, key); t.oncomplete = () => res(); t.onerror = () => rej(t.error); });
  } catch { /* storage unavailable: offline features just don't work */ }
}
async function del(key: string) {
  try {
    const d = await db();
    await new Promise<void>((res) => { const t = d.transaction(STORE, 'readwrite'); t.objectStore(STORE).delete(key); t.oncomplete = () => res(); t.onerror = () => res(); });
  } catch { /* ignore */ }
}

/** True when an error means "couldn't reach the server" (no signal, timeout), not "the server said no". */
export function isNetworkError(err: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  if (!err) return false;
  const e = err as { message?: string; name?: string; code?: string; status?: number };
  if (e.code && /^(PGRST\w+|[0-9A-Z]{5})$/.test(e.code)) return false; // a database error code means the server answered
  const text = `${e.name ?? ''} ${e.message ?? ''}`.toLowerCase();
  return /failed to fetch|load failed|networkerror|network request failed|fetch failed|aborterror|aborted|timed out|timeout|err_internet|offline/.test(text) || e.status === 0;
}

/** Sign-in expired or not yet refreshed: retry later rather than treating the change as refused. */
function isAuthError(err: unknown) {
  const e = err as { message?: string; code?: string; status?: number };
  return e?.status === 401 || /^PGRST30\d$/.test(e?.code ?? '') || /jwt|token is expired|not authenticated|invalid claim/i.test(e?.message ?? '');
}

// ---- Data copy ---------------------------------------------------------------------------------------------
export type Snapshot<P, D> = { userId: string; savedAt: string; profile: P; data: D };
const SNAP = 'snapshot';
export const saveSnapshot = <P, D>(s: Snapshot<P, D>) => set(SNAP, s);
export const loadSnapshot = <P, D>() => get<Snapshot<P, D>>(SNAP);
export const clearSnapshot = () => del(SNAP);

// ---- Outbox ------------------------------------------------------------------------------------------------
export type OutboxItem =
  | { id: string; userId: string; createdAt: string; label: string; error?: string; kind: 'scores'; rows: Record<string, unknown>[] }
  | { id: string; userId: string; createdAt: string; label: string; error?: string; kind: 'rsvp'; eventId: string; status: 'planned' | 'absent'; previous: string | null; memberId: string }
  | { id: string; userId: string; createdAt: string; label: string; error?: string; kind: 'event'; eventId: string; change: Record<string, unknown> }
  | { id: string; userId: string; createdAt: string; label: string; error?: string; kind: 'duty'; eventId: string; change: Record<string, unknown> };
export type NewOutboxItem = OutboxItem extends infer T ? T extends OutboxItem ? Omit<T, 'id' | 'createdAt' | 'userId' | 'error'> : never : never;

const OUT = 'outbox';
const changed = () => window.dispatchEvent(new Event('mtu-outbox'));
export async function outboxItems(userId?: string): Promise<OutboxItem[]> {
  const all = (await get<OutboxItem[]>(OUT)) ?? [];
  return userId ? all.filter(i => i.userId === userId) : all;
}
async function writeOutbox(items: OutboxItem[]) { await set(OUT, items); changed(); }
export async function discardOutboxItem(id: string) { await writeOutbox((await outboxItems()).filter(i => i.id !== id)); }

/** Sends one change to the server. Throws the server's error, or a network error. */
async function send(sb: SupabaseClient, item: OutboxItem) {
  if (item.kind === 'scores') {
    const { error } = await sb.from('scores').insert(item.rows);
    // 23505 = already saved (an earlier try reached the server but the reply was lost). Not a duplicate.
    if (error && error.code !== '23505') throw error;
  } else if (item.kind === 'rsvp') {
    const { error } = await sb.rpc('rsvp', { p_event: item.eventId, p_status: item.status });
    if (error) throw error;
    if (item.status !== item.previous && (item.status === 'planned' || item.previous === 'planned')) {
      const { data } = await sb.auth.getSession();
      fetch('/api/groupme', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}` }, body: JSON.stringify({ type: 'rsvp', eventId: item.eventId, previous: item.previous }) }).catch(() => {});
    }
  } else if (item.kind === 'event') {
    const { error } = await sb.from('events').update(item.change).eq('id', item.eventId);
    if (error) throw error;
  } else {
    const { error } = await sb.rpc('update_event_duty', { p_event: item.eventId, p_changes: item.change });
    if (error) throw error;
  }
}

/**
 * Save now if possible; if there's no signal, keep it in the outbox to send later.
 * Returns 'sent', 'queued', or throws the server's error (e.g. a validation message).
 */
export async function saveOrQueue(sb: SupabaseClient, userId: string, item: NewOutboxItem): Promise<'sent' | 'queued'> {
  const full = { ...item, id: crypto.randomUUID(), userId, createdAt: new Date().toISOString() } as OutboxItem;
  if (typeof navigator === 'undefined' || navigator.onLine !== false) {
    // Anything already waiting goes first, so changes reach the server in the order they were made.
    const waiting = await outboxItems(userId);
    const signedIn = !!(await sb.auth.getSession()).data.session;
    if (!waiting.length && signedIn) {
      try { await send(sb, full); return 'sent'; }
      catch (e) { if (!isNetworkError(e)) throw e; }
    }
  }
  await writeOutbox([...(await outboxItems()), full]);
  return 'queued';
}

let flushing = false;
/** Sends waiting changes in order. Stops at the first network failure. Returns how many were sent. */
export async function flushOutbox(sb: SupabaseClient, userId: string): Promise<number> {
  if (flushing || (typeof navigator !== 'undefined' && navigator.onLine === false)) return 0;
  flushing = true;
  let sent = 0;
  try {
    // Needs a live sign-in; getSession refreshes it once there's signal. Without one, try again later.
    const { data } = await sb.auth.getSession();
    if (!data.session || data.session.user.id !== userId) return 0;
    for (const item of await outboxItems(userId)) {
      if (item.error) continue; // needs a person to look at it
      try {
        await send(sb, item);
        await writeOutbox((await outboxItems()).filter(i => i.id !== item.id));
        sent++;
      } catch (e) {
        if (isNetworkError(e) || isAuthError(e)) break;
        const msg = (e as { message?: string }).message ?? 'The server refused this change.';
        await writeOutbox((await outboxItems()).map(i => (i.id === item.id ? { ...i, error: msg } : i)));
      }
    }
  } finally { flushing = false; }
  return sent;
}

/** Signs out even with no signal (Supabase keeps the session if it can't reach the server). */
export async function signOutHere(sb: SupabaseClient) {
  await clearSnapshot();
  const { error } = await sb.auth.signOut();
  if (error) {
    await sb.auth.signOut({ scope: 'local' }).catch(() => undefined);
    try { Object.keys(localStorage).filter(k => k.startsWith('sb-') && k.endsWith('-auth-token')).forEach(k => localStorage.removeItem(k)); } catch { /* ignore */ }
    window.location.reload();
  }
}
