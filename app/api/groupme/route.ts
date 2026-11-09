// Posts a team notice to the 184th MTU GroupMe group through the "MTU Bot".
// Event announcements: only signed-in, approved staff, only for an event that exists (GROUPME_BOT_ID).
// RSVP alerts: any approved member, about their own RSVP only, to the staff group (GROUPME_STAFF_BOT_ID).
// Support reports: the reporter, once per report, to the "Mtu page bugs" group (GROUPME_SUPPORT_BOT_ID).
// The bot ID lives in the GROUPME_BOT_ID environment variable and never reaches the browser.
// Live vs. test group = which bot ID is in that variable. See docs/GROUPME.md before switching.
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const KIND: Record<string, string> = { practice: 'Practice', match: 'Match', tryout: 'Tryout', qual: 'Qualification', cleaning: 'Weapons cleaning', meeting: 'Meeting', other: 'Event' };
const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const mil = (d: string) => `${d.slice(8, 10)} ${MON[+d.slice(5, 7) - 1]} ${d.slice(0, 4)}`;

// Public site address for links in posts. Never built from the request, so a forged Host header can't redirect them.
const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://mtu-team.vercel.app').replace(/\/$/, '');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BODY = 8_000;

// Text typed by people outside staff (sign-up names) goes to GroupMe as plain words only:
// no links, no line breaks, no control characters, short.
const clean = (v: unknown, max: number) => String(v ?? '')
  .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, ' ')
  .replace(/\b(?:https?:\/\/|www\.)\S*/gi, '')
  .replace(/\b[\w-]+(?:\.[\w-]+)*\.(?:com|net|org|io|co|gov|mil|us|me|ly|app|xyz|info|biz)\b\S*/gi, '')
  .replace(/\s+/g, ' ').trim().slice(0, max);

// Best-effort limiter per client address (resets when the server instance recycles).
const hits = new Map<string, number[]>();
function limited(req: Request, max: number, windowMs = 60_000) {
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
  const now = Date.now(), list = (hits.get(ip) ?? []).filter(t => now - t < windowMs);
  list.push(now); hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length > max;
}

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

async function post(botId: string, text: string) {
  return fetch('https://api.groupme.com/v3/bots/post', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bot_id: botId, text: text.slice(0, 1000) }),
  });
}

export async function POST(req: Request) {
  // New team-link sign-up: no session yet (they may still need to confirm their email), so this path
  // needs no sign-in. claim_signup_notice only answers once per real pending sign-up from the last hour.
  if (limited(req, 20)) return json({ error: 'Too many requests. Try again in a minute.' }, 429);
  if (!(req.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) return json({ error: 'Bad request' }, 415);
  // Only this site's own pages may call this route from a browser.
  const from = req.headers.get('origin');
  if (from && from !== SITE && from !== new URL(req.url).origin) return json({ error: 'Forbidden' }, 403);
  const rawText = await req.text().catch(() => '');
  if (!rawText || rawText.length > MAX_BODY) return json({ error: 'Bad request' }, 400);
  let parsed: unknown = null;
  try { parsed = JSON.parse(rawText); } catch { return json({ error: 'Bad request' }, 400); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return json({ error: 'Bad request' }, 400);
  const raw = parsed as { type?: string; email?: string };
  if (raw.type === 'signup' && typeof raw.email === 'string') {
    if (limited(req, 3, 10 * 60_000) || raw.email.length > 320 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(raw.email)) return json({ ok: false, skipped: true });
    const staffBot = process.env.GROUPME_STAFF_BOT_ID;
    if (!staffBot) return Response.json({ ok: false, skipped: true });
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data } = await anon.rpc('claim_signup_notice', { p_email: raw.email });
    if (!data) return Response.json({ ok: false, skipped: true });
    const d = data as { name: string; unit?: string | null };
    const name = clean(d.name, 60) || 'Someone', unit = clean(d.unit, 40);
    const res = await post(staffBot, `🆕 New sign-up waiting for approval: ${name}${unit ? ` (${unit})` : ''}\nApprove or reject in Admin → Access: ${SITE}/#admin`);
    return Response.json({ ok: res.ok });
  }

  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token || token.length > 4096) return Response.json({ error: 'Not signed in' }, { status: 401 });
  type Prev = { title?: string; start_date?: string; end_date?: string | null; location?: string | null };
  const body = parsed as { type?: string; ticketId?: string; eventId?: string; previous?: string | null; before?: Prev };
  if (!['event', 'rsvp', 'change', 'cancel', 'support'].includes(body.type ?? '') || (body.type !== 'support' && (typeof body.eventId !== 'string' || !UUID.test(body.eventId)))) return Response.json({ error: 'Bad request' }, { status: 400 });
  if (body.previous != null && !['planned', 'absent', 'attended', 'excused'].includes(String(body.previous))) body.previous = null;
  if (body.before !== undefined && (typeof body.before !== 'object' || body.before === null || Array.isArray(body.before))) return Response.json({ error: 'Bad request' }, { status: 400 });
  if (body.before) {
    const b = body.before;
    body.before = {
      title: typeof b.title === 'string' ? b.title.slice(0, 200) : undefined,
      start_date: typeof b.start_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.start_date) ? b.start_date : undefined,
      end_date: typeof b.end_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.end_date) ? b.end_date : null,
      location: typeof b.location === 'string' ? b.location.slice(0, 200) : b.location === null ? null : undefined,
    };
  }

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: user } = await sb.auth.getUser(token);
  if (!user.user) return Response.json({ error: 'Not signed in' }, { status: 401 });
  const { data: me } = await sb.from('profiles').select('role, approved, member_id').eq('id', user.user.id).single();
  if (!me?.approved) return Response.json({ error: 'Not approved' }, { status: 403 });

  // Support report: posts once to the "Mtu page bugs" group (GROUPME_SUPPORT_BOT_ID). Only the reporter can trigger it,
  // only within 10 minutes of filing, and only once (claim_support_notice enforces all three).
  if (body.type === 'support') {
    const supportBot = process.env.GROUPME_SUPPORT_BOT_ID;
    if (!supportBot || typeof body.ticketId !== 'string' || !UUID.test(body.ticketId)) return json({ ok: false, skipped: true });
    const { data: t } = await sb.rpc('claim_support_notice', { p_ticket: body.ticketId });
    if (!t) return json({ ok: false, skipped: true });
    const d = t as { kind: string; message: string; page: string | null; shots: number; who: string };
    const icon = d.kind === 'bug' ? '🐞 Bug' : d.kind === 'feedback' ? '💡 Feedback' : '❓ Question';
    const text = [
      `${icon} from ${clean(d.who, 60)}${d.page ? ` · ${clean(d.page, 40)}` : ''}`,
      clean(d.message, 600) + (d.message.length > 600 ? '…' : ''),
      d.shots ? `📷 ${d.shots} screenshot${d.shots === 1 ? '' : 's'} attached` : '',
      `Open: ${SITE}/#support`,
    ].filter(Boolean).join('\n');
    const res = await post(supportBot, text);
    return json({ ok: res.ok });
  }

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

  const origin = SITE;
  const range = (s: string, en?: string | null) => (en && en !== s ? `${mil(s)} – ${mil(en)}` : mil(s));
  const when = range(e.start_date, e.end_date);
  const kind = KIND[e.kind] ?? 'Event';

  // Cancellation: posted just before staff delete the event.
  if (body.type === 'cancel') {
    const res = await post(botId, [`🚫 CANCELLED: ${e.title}`, `${when}${e.location ? ` · ${e.location}` : ''}`, `This ${kind.toLowerCase()} has been cancelled.`].join('\n'));
    return res.ok ? Response.json({ ok: true }) : Response.json({ ok: false, error: `GroupMe returned ${res.status}` }, { status: 502 });
  }

  // Change: list what changed compared with the values before the edit.
  if (body.type === 'change') {
    const b = body.before ?? {};
    const lines: string[] = [];
    if (b.title !== undefined && b.title !== e.title) lines.push(`Renamed from "${b.title}"`);
    if (b.start_date && (b.start_date !== e.start_date || (b.end_date ?? null) !== (e.end_date ?? null))) lines.push(`New date: ${when} (was ${range(b.start_date, b.end_date)})`);
    if (b.location !== undefined && (b.location ?? null) !== (e.location ?? null)) lines.push(`New location: ${e.location ?? 'TBD'}${b.location ? ` (was ${b.location})` : ''}`);
    if (!lines.length) return Response.json({ ok: false, skipped: true });
    const res = await post(botId, [`⚠️ UPDATED ${kind}: ${e.title}`, ...lines, `Check your RSVP: ${origin}/#event/${e.id}`].join('\n'));
    return res.ok ? Response.json({ ok: true }) : Response.json({ ok: false, error: `GroupMe returned ${res.status}` }, { status: 502 });
  }

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
