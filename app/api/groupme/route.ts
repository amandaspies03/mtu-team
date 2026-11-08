// Posts a team notice to the 184th MTU GroupMe group through the "MTU Bot".
// Only signed-in, approved staff can trigger it, and only for an event that exists.
// The bot ID lives in the GROUPME_BOT_ID environment variable and never reaches the browser.
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const KIND: Record<string, string> = { practice: 'Practice', match: 'Match', tryout: 'Tryout', qual: 'Qualification', cleaning: 'Weapons cleaning', meeting: 'Meeting', other: 'Event' };
const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const mil = (d: string) => `${d.slice(8, 10)} ${MON[+d.slice(5, 7) - 1]} ${d.slice(0, 4)}`;

export async function POST(req: Request) {
  const botId = process.env.GROUPME_BOT_ID;
  if (!botId) return Response.json({ ok: false, error: 'GroupMe is not set up yet' }, { status: 503 });

  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return Response.json({ error: 'Not signed in' }, { status: 401 });
  const body = await req.json().catch(() => null) as { type?: string; eventId?: string } | null;
  if (body?.type !== 'event' || typeof body.eventId !== 'string') return Response.json({ error: 'Bad request' }, { status: 400 });

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: user } = await sb.auth.getUser(token);
  if (!user.user) return Response.json({ error: 'Not signed in' }, { status: 401 });
  const { data: me } = await sb.from('profiles').select('role, approved').eq('id', user.user.id).single();
  if (!me || me.role !== 'staff' || !me.approved) return Response.json({ error: 'Staff only' }, { status: 403 });

  const { data: e } = await sb.from('events').select('id, title, kind, start_date, end_date, location').eq('id', body.eventId).single();
  if (!e) return Response.json({ error: 'Event not found' }, { status: 404 });

  const origin = new URL(req.url).origin;
  const when = e.end_date && e.end_date !== e.start_date ? `${mil(e.start_date)} – ${mil(e.end_date)}` : mil(e.start_date);
  const text = [
    `📅 New ${KIND[e.kind] ?? 'event'}: ${e.title}`,
    `${when}${e.location ? ` · ${e.location}` : ''}`,
    `RSVP on the team site: ${origin}/#event/${e.id}`,
  ].join('\n').slice(0, 1000);

  const res = await fetch('https://api.groupme.com/v3/bots/post', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bot_id: botId, text }),
  });
  if (!res.ok) return Response.json({ ok: false, error: `GroupMe returned ${res.status}` }, { status: 502 });
  const postedAt = new Date().toISOString();
  await sb.from('events').update({ groupme_posted_at: postedAt }).eq('id', e.id);
  return Response.json({ ok: true, postedAt });
}
