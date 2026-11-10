'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Attendance, Compliance, Course, Invite, MatchTeam, StaffEmail, MatchTeamMember, Member, Profile, Range, Score, TeamEvent, Duty, StaffDuty } from './types';

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
  loading: boolean;
  error: string;
  reload: () => Promise<void>;
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
  const [state, setState] = useState<Omit<TeamData, 'sb' | 'me' | 'isStaff' | 'realStaff' | 'previewShooter' | 'setPreviewShooter' | 'tourOpen' | 'openTour' | 'closeTour' | 'reload' | 'memberById' | 'can' | 'loading' | 'error'>>({
    members: [], compliance: [], events: [], attendance: [], courses: [], scores: [], teams: [], teamMembers: [], profiles: [], staffEmails: [], invites: [], ranges: [], duties: [], staffDuties: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    setError('');
    try {
      let duties: Duty[] = [];
      if (!isStaff) {
        const r = await sb.rpc('my_duties');
        if (!r.error && Array.isArray(r.data)) duties = (r.data as string[]).filter((d): d is Duty => d === 'vehicle' || d === 'ammo');
      }
      const [members, compliance, events, attendance, courses, scores, teams, teamMembers, profiles, staffEmails, invites, ranges, staffDuties] = await Promise.all([
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
      ]);
      setState({ members, compliance, events, attendance, courses, scores, teams, teamMembers, profiles, staffEmails, invites, ranges, duties, staffDuties });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load team data');
    } finally {
      setLoading(false);
    }
  }, [sb, isStaff]);

  useEffect(() => { reload(); }, [reload]);

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

  return <Ctx.Provider value={{ sb, me, isStaff: fullStaff, realStaff: isStaff, previewShooter: preview, setPreviewShooter, tourOpen, openTour, closeTour, ...shown, can, loading, error, reload, memberById }}>{children}</Ctx.Provider>;
}
