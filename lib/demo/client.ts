// A stand-in for the Supabase client, used only on the demo site (NEXT_PUBLIC_DEMO=1).
// Reads come from the made-up data in ./data. Every write is refused, so nothing can be changed,
// and there is no connection to the real team database at all.
import type { SupabaseClient } from '@supabase/supabase-js';
import { buildDemoData, DEMO_GUEST_ID, type DemoTables } from './data';

export const DEMO_MESSAGE = 'This is a view-only demo — changes aren’t saved.';
const refused = () => ({ data: null, error: { message: DEMO_MESSAGE, code: '42501', details: null, hint: null }, count: null, status: 403, statusText: 'Forbidden' });
const ok = (data: unknown) => ({ data, error: null, count: Array.isArray(data) ? data.length : null, status: 200, statusText: 'OK' });

type Row = Record<string, unknown>;
let tables: DemoTables | null = null;
const db = () => (tables ??= buildDemoData());

/** Chainable, awaitable query like supabase-js's, over an in-memory table. */
class Query implements PromiseLike<unknown> {
  private filters: ((r: Row) => boolean)[] = [];
  private sorts: { col: string; asc: boolean; nullsFirst: boolean }[] = [];
  private cols: string[] | null = null;
  private max: number | null = null;
  private one: 'single' | 'maybe' | null = null;
  private write = false;
  constructor(private table: string) {}

  select(cols = '*') { if (cols.trim() !== '*') this.cols = cols.split(',').map(c => c.trim()).filter(Boolean); return this; }
  eq(col: string, v: unknown) { this.filters.push(r => r[col] === v); return this; }
  neq(col: string, v: unknown) { this.filters.push(r => r[col] !== v); return this; }
  lt(col: string, v: unknown) { this.filters.push(r => (r[col] as number) < (v as number)); return this; }
  gt(col: string, v: unknown) { this.filters.push(r => (r[col] as number) > (v as number)); return this; }
  in(col: string, vs: unknown[]) { this.filters.push(r => vs.includes(r[col])); return this; }
  match(obj: Row) { for (const [k, v] of Object.entries(obj)) this.eq(k, v); return this; }
  order(col: string, o?: { ascending?: boolean; nullsFirst?: boolean }) { this.sorts.push({ col, asc: o?.ascending ?? true, nullsFirst: o?.nullsFirst ?? false }); return this; }
  limit(n: number) { this.max = n; return this; }
  single() { this.one = 'single'; return this; }
  maybeSingle() { this.one = 'maybe'; return this; }
  insert() { this.write = true; return this; }
  update() { this.write = true; return this; }
  upsert() { this.write = true; return this; }
  delete() { this.write = true; return this; }

  private run() {
    // Marking announcements read isn't a real change; let it "succeed" (nothing is stored) so the page doesn't complain.
    if (this.write) return this.table === 'announcement_reads' ? ok(null) : refused();
    let rows = [...(db()[this.table] ?? [])].filter(r => this.filters.every(f => f(r)));
    if (this.sorts.length) rows.sort((a, b) => {
      for (const s of this.sorts) {
        const x = a[s.col], y = b[s.col];
        if (x === y) continue;
        if (x == null) return s.nullsFirst ? -1 : 1;
        if (y == null) return s.nullsFirst ? 1 : -1;
        const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
        return s.asc ? c : -c;
      }
      return 0;
    });
    if (this.max != null) rows = rows.slice(0, this.max);
    if (this.cols) rows = rows.map(r => Object.fromEntries(this.cols!.map(c => [c, r[c] ?? null])));
    rows = structuredClone(rows);
    if (this.one) {
      if (rows.length === 1) return ok(rows[0]);
      if (this.one === 'maybe' && rows.length === 0) return ok(null);
      return { ...refused(), error: { message: 'Row not found', code: 'PGRST116', details: null, hint: null } };
    }
    return ok(rows);
  }
  then<A = unknown, B = never>(res?: ((v: unknown) => A | PromiseLike<A>) | null, rej?: ((e: unknown) => B | PromiseLike<B>) | null) {
    return Promise.resolve().then(() => this.run()).then(res, rej);
  }
}

const STAFF_FIELDS = ['id', 'notes', 'aar', 'ammo_556', 'ammo_9mm', 'prep_ammo_draw', 'prep_placard', 'prep_van_driver', 'van_driver_id', 'ammo_draw_requested_on', 'ammo_draw_556', 'ammo_draw_9mm', 'groupme_posted_at', 'prep_vehicle_requested', 'prep_vehicle_confirmed'];

function rpc(name: string): PromiseLike<unknown> {
  const d = db();
  const answer = (() => {
    switch (name) {
      case 'event_staff_details': return ok(d.events.map(e => Object.fromEntries(STAFF_FIELDS.map(k => [k, e[k] ?? null]))));
      case 'event_duty_details': return ok([]);
      case 'my_duties': return ok([]);
      case 'team_names': return ok(d.members.map(m => ({ id: m.id, rank: m.rank, first_name: m.first_name, last_name: m.last_name, team_status: m.team_status })));
      case 'list_backups': return ok([0, 1, 2].map(i => ({ id: 30 - i, taken_at: new Date(Date.now() - i * 86_400_000).toISOString(), kind: i === 1 ? 'manual' : 'nightly', members: d.members.length, scores: d.scores.length, events: d.events.length })));
      case 'get_backup': return ok({ note: 'Demo backup — made-up data only.', members: d.members, events: d.events, scores: d.scores });
      case 'check_invite': return ok({ valid: false, reason: 'Sign-up is turned off on the demo site.' });
      case 'mark_tutorial_done': return ok(null); // harmless: nothing is stored
      default: return refused();
    }
  })();
  return Promise.resolve(answer);
}

// ---- Sign-in: one shared guest login, set in Vercel (NEXT_PUBLIC_DEMO_EMAIL / NEXT_PUBLIC_DEMO_PASSWORD_SHA256) ----
const KEY = 'mtu-demo-session';
type Listener = (event: string, session: unknown) => void;
const listeners = new Set<Listener>();
const guestEmail = () => (process.env.NEXT_PUBLIC_DEMO_EMAIL || 'guest@mtu-demo.example').toLowerCase();
const makeSession = () => ({
  access_token: 'demo', refresh_token: 'demo', token_type: 'bearer', expires_in: 86_400, expires_at: Math.floor(Date.now() / 1000) + 86_400,
  user: { id: DEMO_GUEST_ID, email: guestEmail(), aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() },
});
const readSession = () => { try { return localStorage.getItem(KEY) ? makeSession() : null; } catch { return null; } };
const emit = (event: string) => { const s = readSession(); listeners.forEach(l => l(event, s)); };

async function sha256(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

const auth = {
  async getSession() { return { data: { session: readSession() }, error: null }; },
  async getUser() { const s = readSession(); return { data: { user: s?.user ?? null }, error: s ? null : { message: 'Not signed in' } }; },
  onAuthStateChange(cb: Listener) {
    listeners.add(cb);
    setTimeout(() => cb('INITIAL_SESSION', readSession()), 0);
    return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } };
  },
  async signInWithPassword({ email, password }: { email: string; password: string }) {
    const want = process.env.NEXT_PUBLIC_DEMO_PASSWORD_SHA256;
    const good = email.trim().toLowerCase() === guestEmail() && !!want && (await sha256(password)) === want.toLowerCase();
    if (!good) return { data: { session: null, user: null }, error: Object.assign(new Error('Invalid login credentials'), { status: 400 }) };
    try { localStorage.setItem(KEY, '1'); } catch { /* storage unavailable */ }
    setTimeout(() => emit('SIGNED_IN'), 0);
    const s = makeSession();
    return { data: { session: s, user: s.user }, error: null };
  },
  async signOut() {
    try { localStorage.removeItem(KEY); } catch { /* storage unavailable */ }
    setTimeout(() => emit('SIGNED_OUT'), 0);
    return { error: null };
  },
  async updateUser() { return { data: { user: null }, error: { message: DEMO_MESSAGE } }; },
  async signUp() { return { data: { user: null, session: null }, error: { message: 'Sign-up is turned off on the demo site.' } }; },
  async resetPasswordForEmail() { return { data: null, error: { message: 'Password reset is turned off on the demo site.' } }; },
};

const storage = {
  from() {
    const no = async () => ({ data: null, error: { message: DEMO_MESSAGE } });
    return { upload: no, remove: no, download: no, createSignedUrl: async () => ({ data: null, error: { message: 'Files aren’t available on the demo site.' } }) };
  },
};

export function createDemoClient(): SupabaseClient {
  return { from: (t: string) => new Query(t), rpc, auth, storage } as unknown as SupabaseClient;
}
