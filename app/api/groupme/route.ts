// Posts a team notice to the 184th MTU GroupMe group through the "MTU Bot".
// Event announcements: only signed-in, approved staff, only for an event that exists (GROUPME_BOT_ID).
// RSVP alerts: any approved member, about their own RSVP only, to the staff group (GROUPME_STAFF_BOT_ID).
// The bot ID lives in the GROUPME_BOT_ID environment variable and never reaches the browser.
// Live vs. test group = which bot ID is in that variable. See docs/GROUPME.md before switching.
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const KIND: Record<string, string> = { practice: 'Practice', match: 'Match', tryout: 'Tryout', qual: 'Qualification', cleaning: 'Weapons cleaning', meeting: 'Meeting', other: 'Event' };
const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const mil = (d: string) => `${d.slice(8, 10)} ${MON[+d.slice(5, 7) - 1]} ${d.slice(0, 4)}`;

async function post(botId: string, text: string) {
  return fetch('https://api.groupme.com/v3/bots/post', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bot_id: botId, text: text.slice(0, 1000) }),
  });
}

export async function POST(req: Request) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return Response.json({ error: 'Not signed in' }, { status: 401 });
  const body = await req.json().catch(() => null) as { type?: string; eventId?: string; previous?: string | null } | null;
  if ((body?.type !== 'event' && body?.type !== 'rsvp') || typeof body.eventId !== 'string') return Response.json({ error: 'Bad request' }, { status: 400 });

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: user } = await sb.auth.getUser(token);
  if (!user.user) return Response.json({ error: 'Not signed in' }, { status: 401 });
  const { data: me } = await sb.from('profiles').select('role, approved, member_id').eq('id', user.user.id).single();
  if (!me?.approved) return Response.json({ error: 'Not approved' }, { status: 403 });

  // RSVP alert for the NCOIC/staff group. Any approved member triggers it for their own RSVP only.
  if (body.type === 'rsvp') {
    const staffBot = process.env.GROUPME_STAFF_BOT_ID;
    if (!staffBot || !me.member_id) return Response.json({ ok: false, skipped: true });
    const [{ data: a }, { data: ev }, { data: m }] = await Promise.all([
      sb.from('attendance').select('status').eq('event_id', body.eventId).eq('member_id', me.member_id).single(),
      sb.from('events').select('title, start_date').eq('id', body.eventId).single(),
      sb.from('members').select('rank, first_name, last_name').eq('id', me.member_id).single(),
    ]);
    if (!a || !ev || !m) return Response.json({ ok: false, skipped: true });
    const who = [m.rank, m.first_name, m.last_name].filter(Boolean).join(' ');
    let text = '';
    if (a.status === 'planned') text = `✅ ${who} is going to ${ev.title} (${mil(ev.start_date)}).`;
    else if (a.status === 'absent' && body.previous === 'planned') text = `❌ ${who} can no longer make ${ev.title} (${mil(ev.start_date)}).`;
    if (!text) return Response.json({ ok: false, skipped: true });
    const res = await post(staffBot, text);
    return Response.json({ ok: res.ok });
  }

  const botId = process.env.GROUPME_BOT_ID;
  if (!botId) return Response.json({ ok: false, error: 'GroupMe is not set up yet' }, { status: 503 });
  // Event announcements are staff-only.
  if (me.role !== 'staff') return Response.json({ error: 'Staff only' }, { status: 403 });
  const { data: staffCheck } = await sb.rpc('event_staff_details');
  if (!Array.isArray(staffCheck) || staffCheck.length === 0) return Response.json({ error: 'Staff only' }, { status: 403 });

  const { data: e } = await sb.from('events').select('id, title, kind, start_date, end_date, location').eq('id', body.eventId).single();
  if (!e) return Response.json({ error: 'Event not found' }, { status: 404 });

  const origin = new URL(req.url).origin;
  const when = e.end_date && e.end_date !== e.start_date ? `${mil(e.start_date)} – ${mil(e.end_date)}` : mil(e.start_date);
  const text = [
    `📅 New ${KIND[e.kind] ?? 'event'}: ${e.title}`,
    `${when}${e.location ? ` · ${e.location}` : ''}`,
    `Tap to RSVP (I'm going / Can't make it): ${origin}/#event/${e.id}`,
  ].join('\n').slice(0, 1000);

  const res = await post(botId, text);
  if (!res.ok) return Response.json({ ok: false, error: `GroupMe returned ${res.status}` }, { status: 502 });
  const postedAt = new Date().toISOString();
  await sb.from('events').update({ groupme_posted_at: postedAt }).eq('id', e.id);
  return Response.json({ ok: true, postedAt });
}
