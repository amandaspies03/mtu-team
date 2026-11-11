import type { SupabaseClient } from '@supabase/supabase-js';
import { DEMO } from './supabase';

/** Calls the server route that posts to GroupMe. Which group gets it is set in Vercel — see docs/GROUPME.md. */
export async function groupme(sb: SupabaseClient, body: Record<string, unknown>): Promise<{ ok: boolean; error?: string; skipped?: boolean }> {
  if (DEMO) return { ok: false, error: 'This is a view-only demo — nothing is posted to GroupMe.' };
  const { data } = await sb.auth.getSession();
  const res = await fetch('/api/groupme', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}` },
    body: JSON.stringify(body),
  }).catch(() => null);
  if (!res) return { ok: false, error: 'Could not reach GroupMe.' };
  const out = await res.json().catch(() => ({}));
  return { ok: res.ok && out.ok !== false, error: out.error, skipped: out.skipped };
}
