'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { flushOutbox, isNetworkError, loadSnapshot, outboxItems, saveOrQueue, saveSnapshot, type NewOutboxItem, type OutboxItem } from './offline';
import type { Attendance, Compliance, Course, Invite, MatchTeam, StaffEmail, MatchTeamMember, Member, Profile, Range, Score, TeamEvent, Duty, StaffDuty, DrillSession } from './types';

export type TeamData = {
  sb: SupabaseClient;
  me: Profile;
  isStaff: boolean;
  /** True for staff accounts even while previewing the shooter view. */
  realStaff: boolean;
  previewShooter: boolean;
  setPreviewShooter: (on: boolean) => void;
  tourOpen: boolean;
  openTour: () => void;
  closeTour: () => void;
  members: Member[];
  compliance: Compliance[];
  events: TeamEvent[];
  attendance: Attendance[];
  courses: Course[];
  scores: Score[];
  teams: MatchTeam[];
  teamMembers: MatchTeamMember[];
  profiles: Profile[];
  staffEmails: StaffEmail[];
  invites: Invite[];
  ranges: Range[];
  /** Limited roles this account holds (empty for full staff and most shooters). */
  duties: Duty[];
  /** Full staff, or holds this limited role. */
  can: (d: Duty) => boolean;
  /** Everyone's limited roles (staff only). */
  staffDuties: StaffDuty[];
  /** Shooter Progression drill scores for the whole team (everyone approved can read them). */
  drillSessions: DrillSession[];
  loading: boolean;
  error: string;
  reload: () => Promise<void>;
  /** Set when showing the copy saved on this device because the server can't be reached. */
  offline: { savedAt: string } | null;
  /** Changes made without signal, waiting to send (this account only). */
  pending: OutboxItem[];
  /** Save now, or keep it to send when signal returns. The screen updates either way. */
  saveOrQueue: (item: NewOutboxItem) => Promise<'sent' | 'queued'>;
  sendPending: () => Promise<void>;
  memberById: (id: string | null | undefined) => Member | undefined;
};

const Ctx = createContext<TeamData | null>(null);

export function useTeam() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTeam outside provider');
  return v;
}

async function all<T>(q: PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

const EVENT_PUBLIC = 'id, title, kind, start_date, end_date, location';
const EVENT_STAFF_BLANK = { notes: null, aar: null, ammo_556: null, ammo_9mm: null, prep_ammo_draw: false, prep_placard: false, prep_van_driver: false, van_driver_id: null, ammo_draw_requested_on: null, ammo_draw_556: null, ammo_draw_9mm: null, groupme_posted_at: null, prep_vehicle_requested: false, prep_vehicle_confirmed: false };

/** Everyone gets event basics; staff also get plan, AAR, ammo and prep details. */
async function loadEvents(sb: SupabaseClient, isStaff: boolean, duties: Duty[]): Promise<TeamEvent[]> {
  const base = await all<Pick<TeamEvent, 'id' | 'title' | 'kind' | 'start_date' | 'end_date' | 'location'>>(sb.from('events').select(EVENT_PUBLIC).order('start_date'));
  const pub = (e: typeof base[number]) => ({ id: e.id, title: e.title, kind: e.kind, start_date: e.start_date, end_date: e.end_date, location: e.location });
  if (!isStaff && duties.length) {
    // Vehicle / ammo managers get just the fields their role covers (the database returns the rest as null).
    const { data, error } = await sb.rpc('event_duty_details');
    if (error) throw new Error(error.message);
    const extra = new Map((data as ({ id: string } & Record<string, unknown>)[]).map(d => [d.id, Object.fromEntries(Object.entries(d).filter(([, v]) => v !== null))]));
    return base.map(e => ({ ...EVENT_STAFF_BLANK, ...extra.get(e.id), ...pub(e) }) as TeamEvent);
  }
  if (!isStaff) return base.map(e => ({ ...EVENT_STAFF_BLANK, ...pub(e) }));
  const { data, error } = await sb.rpc('event_staff_details');
  if (error) throw new Error(error.message);
  const extra = new Map((data as (typeof EVENT_STAFF_BLANK & { id: string })[]).map(d => [d.id, d]));
  return base.map(e => ({ ...EVENT_STAFF_BLANK, ...extra.get(e.id), ...pub(e) }));
}

const MEMBER_BLANK = { unit: null, duty_status: null, staff_role: null, cell_phone: null, mil_email: null, personal_email: null, pistol_no: null, rifle_no: null, notes: null, gov20_pistol: false, gov20_rifle: false, chiefs50: false, eic_pistol: null, eic_rifle: null };

/** Staff get the full roster. Shooters get their own full entry plus everyone's names (for leaderboards). */
async function loadMembers(sb: SupabaseClient, isStaff: boolean): Promise<Member[]> {
  if (isStaff) return all<Member>(sb.from('members').select('*').order('last_name').order('first_name'));
  const [names, mine] = await Promise.all([
    sb.rpc('team_names').then(({ data, error }) => { if (error) throw new Error(error.message); return (data ?? []) as Pick<Member, 'id' | 'rank' | 'first_name' | 'last_name' | 'team_status'>[]; }),
    all<Member>(sb.from('members').select('*')),
  ]);
  const own = new Map(mine.map(m => [m.id, m]));
  return names.map(n => own.get(n.id) ?? ({ ...MEMBER_BLANK, ...n } as Member))
    .sort((a, b) => a.last_name.localeCompare(b.last_name) || (a.first_name ?? '').localeCompare(b.first_name ?? ''));
}

export function TeamProvider({ sb, me, children }: { sb: SupabaseClient; me: Profile; children: React.ReactNode }) {
  const isStaff = me.role === 'staff' && me.approved;
  const [state, setState] = useState<Omit<TeamData, 'sb' | 'me' | 'isStaff' | 'realStaff' | 'previewShooter' | 'setPreviewShooter' | 'tourOpen' | 'openTour' | 'closeTour' | 'reload' | 'memberById' | 'can' | 'loading' | 'error' | 'offline' | 'pending' | 'saveOrQueue' | 'sendPending'>>({
    members: [], compliance: [], events: [], attendance: [], courses: [], scores: [], teams: [], teamMembers: [], profiles: [], staffEmails: [], invites: [], ranges: [], duties: [], staffDuties: [], drillSessions: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    setError('');
    try {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new Error('Failed to fetch (offline)');
      let duties: Duty[] = [];
      if (!isStaff) {
        const r = await sb.rpc('my_duties');
        if (!r.error && Array.isArray(r.data)) duties = (r.data as string[]).filter((d): d is Duty => d === 'vehicle' || d === 'ammo');
      }
      const [members, compliance, events, attendance, courses, scores, teams, teamMembers, profiles, staffEmails, invites, ranges, staffDuties, drillSessions] = await Promise.all([
        loadMembers(sb, isStaff),
        all<Compliance>(sb.from('member_compliance').select('*')),
        loadEvents(sb, isStaff, duties),
        all<Attendance>(sb.from('attendance').select('*')),
        all<Course>(sb.from('courses').select('*').order('sort')),
        all<Score>(sb.from('scores').select('*').order('shot_on', { ascending: true, nullsFirst: true }).limit(10000)),
        all<MatchTeam>(sb.from('match_teams').select('*').order('name')),
        all<MatchTeamMember>(sb.from('match_team_members').select('*')),
        isStaff ? all<Profile>(sb.from('profiles').select('*').order('created_at', { ascending: false })) : Promise.resolve([] as Profile[]),
        isStaff ? all<StaffEmail>(sb.from('staff_emails').select('*').order('email')) : Promise.resolve([] as StaffEmail[]),
        isStaff ? all<Invite>(sb.from('invites').select('*').order('created_at', { ascending: false })) : Promise.resolve([] as Invite[]),
        all<Range>(sb.from('ranges').select('*').order('name')),
        isStaff ? all<StaffDuty>(sb.from('staff_duties').select('*').order('email')) : Promise.resolve([] as StaffDuty[]),
        all<DrillSession>(sb.from('drill_sessions').select('id, member_id, drill, shot_on, data, created_by, updated_at').order('shot_on').limit(5000)),
      ]);
      const fresh = { members, compliance, events, attendance, courses, scores, teams, teamMembers, profiles, staffEmails, invites, ranges, duties, staffDuties, drillSessions };
      const waiting = await outboxItems(me.id);
      setState(applyPending(fresh, waiting, me.member_id));
      setOffline(null);
      void saveSnapshot({ userId: me.id, savedAt: new Date().toISOString(), profile: me, data: forDevice(fresh) });
    } catch (e) {
      const snap = isNetworkError(e) ? await loadSnapshot<Profile, typeof state>() : undefined;
      if (snap && snap.userId === me.id) {
        setState(applyPending(snap.data, await outboxItems(me.id), me.member_id));
        setOffline({ savedAt: snap.savedAt });
      } else setError(isNetworkError(e) ? 'No signal, and there’s no saved copy of the team data on this device yet.' : e instanceof Error ? e.message : 'Could not load team data');
    } finally {
      setLoading(false);
    }
  }, [sb, isStaff, me]);

  useEffect(() => { reload(); }, [reload]);

  // ---- Offline: data copy status and the outbox of changes waiting for signal ----
  const [offline, setOffline] = useState<{ savedAt: string } | null>(null);
  const [pending, setPending] = useState<OutboxItem[]>([]);
  const refreshPending = useCallback(async () => setPending(await outboxItems(me.id)), [me.id]);
  const sendPending = useCallback(async () => {
    const sent = await flushOutbox(sb, me.id);
    await refreshPending();
    if (sent > 0 || offline) await reload();
  }, [sb, me.id, refreshPending, reload, offline]);
  useEffect(() => {
    void refreshPending();
    const onChange = () => { void refreshPending(); };
    const onOnline = () => { void sendPending(); };
    window.addEventListener('mtu-outbox', onChange);
    window.addEventListener('online', onOnline);
    // Weak signal often doesn't fire "online": keep trying every 30 s while something is waiting or the copy is showing.
    const t = setInterval(() => { if (pending.length || offline) void sendPending(); }, 30_000);
    return () => { window.removeEventListener('mtu-outbox', onChange); window.removeEventListener('online', onOnline); clearInterval(t); };
  }, [refreshPending, sendPending, pending.length, offline]);
  const queue = useCallback(async (item: NewOutboxItem) => {
    const r = await saveOrQueue(sb, me.id, item);
    if (r === 'queued') {
      setState(st => applyPending(st, [{ ...item, id: 'local', userId: me.id, createdAt: new Date().toISOString() } as OutboxItem], me.member_id));
      await refreshPending();
    }
    return r;
  }, [sb, me.id, me.member_id, refreshPending]);

  // Staff can preview exactly what a shooter sees, using the same trimming the database applies to shooters.
  const [previewShooter, setPreviewState] = useState(() => { try { return isStaff && sessionStorage.getItem('mtu-preview-shooter') === '1'; } catch { return false; } });
  const setPreviewShooter = useCallback((on: boolean) => {
    setPreviewState(on);
    try { if (on) sessionStorage.setItem('mtu-preview-shooter', '1'); else sessionStorage.removeItem('mtu-preview-shooter'); } catch { /* storage unavailable */ }
    window.location.hash = 'dashboard';
  }, []);
  const preview = isStaff && previewShooter;
  const shown = useMemo(() => {
    if (!preview) return state;
    const mine = me.member_id;
    return {
      ...state,
      members: state.members.map(m => (m.id === mine ? m : ({ ...MEMBER_BLANK, id: m.id, rank: m.rank, first_name: m.first_name, last_name: m.last_name, team_status: m.team_status } as Member))),
      compliance: state.compliance.filter(c => c.member_id === mine),
      attendance: state.attendance.filter(a => a.member_id === mine),
      events: state.events.map(e => ({ ...e, ...EVENT_STAFF_BLANK })),
      teams: [], teamMembers: [], profiles: [], staffEmails: [], invites: [], duties: [], staffDuties: [],
    };
  }, [preview, state, me.member_id]);

  const memberById = useCallback((id: string | null | undefined) => shown.members.find(m => m.id === id), [shown.members]);
  const fullStaff = isStaff && !preview;
  const can = useCallback((d: Duty) => fullStaff || shown.duties.includes(d), [fullStaff, shown.duties]);

  // First-login tour for shooters (not staff). Finishing or skipping it is remembered on the account.
  const [tourOpen, setTourOpen] = useState(() => !isStaff && !me.tutorial_done_at);
  const openTour = useCallback(() => setTourOpen(true), []);
  const closeTour = useCallback(() => {
    setTourOpen(false);
    if (!isStaff && !me.tutorial_done_at) sb.rpc('mark_tutorial_done').then(() => {}, () => {});
  }, [isStaff, me.tutorial_done_at, sb]);

  return <Ctx.Provider value={{ sb, me, isStaff: fullStaff, realStaff: isStaff, previewShooter: preview, setPreviewShooter, tourOpen, openTour, closeTour, ...shown, can, loading, error, reload, memberById, offline, pending, saveOrQueue: queue, sendPending }}>{children}</Ctx.Provider>;
}

type TeamState = Omit<TeamData, 'sb' | 'me' | 'isStaff' | 'realStaff' | 'previewShooter' | 'setPreviewShooter' | 'tourOpen' | 'openTour' | 'closeTour' | 'reload' | 'memberById' | 'can' | 'loading' | 'error' | 'offline' | 'pending' | 'saveOrQueue' | 'sendPending'>;

/** The copy kept on this device for offline use: no roster contact info, no admin-only data. */
function forDevice(d: TeamState): TeamState {
  return {
    ...d,
    members: d.members.map(m => ({ ...m, cell_phone: null, mil_email: null, personal_email: null, notes: null })),
    profiles: [], staffEmails: [], invites: [], staffDuties: [],
  };
}

/** Shows changes that are still waiting to send, so the screens match what the person entered. */
function applyPending(d: TeamState, items: OutboxItem[], myMemberId: string | null): TeamState {
  if (!items.length) return d;
  let { scores, attendance, events, drillSessions } = d;
  for (const i of items) {
    if (i.kind === 'drill') { drillSessions = [...drillSessions.filter(x => x.id !== i.row.id), i.row as DrillSession]; continue; }
    if (i.kind === 'drill-delete') { drillSessions = drillSessions.filter(x => x.id !== i.sessionId); continue; }
    if (i.kind === 'scores') {
      const have = new Set(scores.map(x => x.id));
      scores = [...scores, ...(i.rows as unknown as Score[]).filter(r => !have.has(r.id))];
    } else if (i.kind === 'rsvp') {
      const mid = i.memberId || myMemberId;
      if (!mid) continue;
      const cur = attendance.find(a => a.event_id === i.eventId && a.member_id === mid);
      if (cur && cur.status !== 'planned' && cur.status !== 'absent') continue;
      attendance = cur ? attendance.map(a => (a === cur ? { ...a, status: i.status } : a))
        : [...attendance, { id: `pending-${i.eventId}`, event_id: i.eventId, member_id: mid, status: i.status } as Attendance];
    } else {
      events = events.map(e => (e.id === i.eventId ? ({ ...e, ...i.change } as TeamEvent) : e));
    }
  }
  return { ...d, scores, attendance, events, drillSessions };
}
