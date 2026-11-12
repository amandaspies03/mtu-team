import { createClient, SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

export function getSupabase() {
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
  let timedOut = false;
  const t = setTimeout(() => { timedOut = true; ctrl.abort(); }, TIMEOUT_MS);
  return fetch(input, { ...init, signal: ctrl.signal })
    .catch(err => {
      // Show people what happened instead of the browser's "AbortError: signal is aborted without reason".
      // Keep "timed out" in the text: isNetworkError (lib/offline.ts) uses it to keep changes to send later.
      if (timedOut) throw new Error('The connection timed out — the server didn’t answer within 30 seconds. Check your signal and try again.');
      throw err;
    })
    .finally(() => clearTimeout(t));
}
