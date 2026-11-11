import { createClient, SupabaseClient } from '@supabase/supabase-js';

/** The view-only demo site: made-up data, no database, nothing can be saved. */
export const DEMO = process.env.NEXT_PUBLIC_DEMO === '1';

let client: SupabaseClient | null = null;

export function getSupabase() {
  // Checked inline so the real site's build leaves the demo code out entirely.
  if (process.env.NEXT_PUBLIC_DEMO === '1') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (client ??= (require('./demo/client') as typeof import('./demo/client')).createDemoClient());
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  if (!client) {
    client = createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      // With weak signal a request can hang for minutes. Give up after 30 s so the app can fall back
      // to the copy on this device (reads) or keep the change to send later (scores, RSVPs, checklists).
      global: { fetch: timedFetch },
    });
  }
  return client;
}

const TIMEOUT_MS = 30_000;
function timedFetch(input: RequestInfo | URL, init?: RequestInit) {
  const ctrl = new AbortController();
  const outer = init?.signal;
  if (outer) { if (outer.aborted) ctrl.abort(); else outer.addEventListener('abort', () => ctrl.abort(), { once: true }); }
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  return fetch(input, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(t));
}
