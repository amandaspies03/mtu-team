// Made-up team data for the view-only demo site (NEXT_PUBLIC_DEMO=1).
// Every name, unit, phone number, email and score here is invented. Nothing comes from the real roster.
// Dates are built relative to today so the demo always looks current.

export const DEMO_GUEST_ID = '00000000-0000-4000-8000-000000000001';
export const DEMO_GUEST_MEMBER_ID = '00000000-0000-4000-8000-0000000000aa';

type Row = Record<string, unknown>;

// Small seeded random generator so the demo looks the same on every visit.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

const DAY = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const uuid = (prefix: string, n: number) => `${prefix}-0000-4000-8000-${String(n).padStart(12, '0')}`;

const PEOPLE: [string, string, string, string | null, string][] = [
  // rank, first, last, staff role, unit
  ['SMSgt', 'Dana', 'Whitfield', 'NCOIC', '210 ISRG'],
  ['Capt', 'Marcus', 'Ellery', 'OIC', '210 ISRG'],
  ['MSgt', 'Renee', 'Calloway', 'Instructor', '311 IS'],
  ['TSgt', 'Owen', 'Hartley', 'Instructor', '311 IS'],
  ['TSgt', 'Priya', 'Nandakumar', 'Custodian', '87 ACS'],
  ['SSgt', 'Luis', 'Ortega', null, '87 ACS'],
  ['SSgt', 'Kayla', 'Brennan', null, '210 SFS'],
  ['SSgt', 'Tobias', 'Lindqvist', null, '412 NOS'],
  ['SrA', 'Jasmine', 'Okafor', null, '311 IS'],
  ['SrA', 'Caleb', 'Thornbury', null, '210 SFS'],
  ['SrA', 'Mei', 'Castellano', null, '412 NOS'],
  ['SSgt', 'Brady', 'Kowalczyk', null, '87 ACS'],
  ['TSgt', 'Alana', 'Fairweather', null, '210 ISRG'],
  ['A1C', 'Devon', 'Marchetti', null, '210 SFS'],
  ['SrA', 'Hannah', 'Delacroix', null, '311 IS'],
  ['SSgt', 'Grant', 'Abernathy', null, '412 NOS'],
  ['MSgt', 'Felicia', 'Ramsdell', null, '87 ACS'],
  ['A1C', 'Ethan', 'Vasquez-Lowe', null, '210 SFS'],
  ['SrA', 'Noor', 'Haddad', null, '311 IS'],
  ['SSgt', 'Wes', 'Pemberton', null, '210 ISRG'],
  ['A1C', 'Riley', 'Santangelo', null, '412 NOS'],
  ['SrA', 'Gavin', 'Truesdale', null, '87 ACS'],
];
const STATUS = ['Active', 'Active', 'Active', 'Active', 'Active', 'Active', 'Active', 'Active', 'Active', 'Active', 'Active', 'Active', 'Active', 'Active', 'Active', 'Active', 'Inactive', 'New', 'New', 'Tryout', 'Tryout', 'Active'];
const DUTY = ['AGR', 'Traditional', 'Technician', 'Traditional', 'AGR', 'Traditional', 'DSG', 'Traditional', 'Traditional', 'Traditional', 'Technician', 'Traditional', 'AGR', 'Traditional', 'Traditional', 'DSG', 'Technician', 'Traditional', 'Traditional', 'Traditional', 'Traditional', 'AGR'];

const RANGES = ['Prairie Ridge Range', 'Cottonwood Training Area', 'Armory Classroom'];

const COURSES: Row[] = [
  { code: 'PISTOL_EIC', name: 'Combat Pistol EIC (PI2210)', weapon: 'Pistol', max_score: 200, has_x: true, sort: 1 },
  { code: 'RIFLE_EIC', name: 'Rifle EIC', weapon: 'Rifle', max_score: 500, has_x: true, sort: 2 },
  { code: 'PISTOL_AB', name: 'Pistol Anti-Body Armor (PI2250)', weapon: 'Pistol', max_score: 180, has_x: true, sort: 3 },
  { code: 'RIFLE_RR', name: 'Rifle Reflexive Fire (RI3020)', weapon: 'Rifle', max_score: 180, has_x: true, sort: 4 },
];

export type DemoTables = Record<string, Row[]>;

export function buildDemoData(): DemoTables {
  const r = rng(184);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const between = (lo: number, hi: number) => Math.round(lo + r() * (hi - lo));
  const today = new Date(); today.setHours(12, 0, 0, 0);
  const at = (days: number) => new Date(today.getTime() + days * DAY);
  const created = at(-200).toISOString();

  // ---- Roster ----
  const members: Row[] = PEOPLE.map(([rank, first, last, role, unit], i) => {
    const handle = `${first}.${last}`.toLowerCase().replace(/[^a-z.]/g, '');
    return {
      id: uuid('00000000', 100 + i), last_name: last, first_name: first, rank, unit, duty_status: DUTY[i], team_status: STATUS[i],
      staff_role: role, mil_email: `${handle}@example.mil`, personal_email: i % 3 === 0 ? `${handle}@example.com` : null,
      cell_phone: `555-${String(100 + i).slice(-3)}-${String(2000 + i * 113).slice(-4)}`,
      notes: i === 16 ? 'On orders until spring — back for next season.' : i === 19 ? 'Interested in rifle team captain role.' : null,
      pistol_no: STATUS[i] === 'Active' || STATUS[i] === 'New' ? i + 1 : null, rifle_no: STATUS[i] === 'Active' && i < 20 ? 20 - i : null,
      gov20_pistol: i < 6 || i === 12, gov20_rifle: i < 4 || i === 15, chiefs50: i < 3,
      eic_pistol: i === 0 ? 'gold' : i < 4 ? 'silver' : i < 8 ? 'bronze' : null,
      eic_rifle: i === 1 ? 'silver' : i < 5 ? 'bronze' : null,
      created_at: created,
    };
  });
  members.push({
    id: DEMO_GUEST_MEMBER_ID, last_name: 'Guest', first_name: 'Demo', rank: null, unit: null, duty_status: 'Civilian', team_status: 'Inactive',
    staff_role: null, mil_email: null, personal_email: null, cell_phone: null, notes: 'View-only demo account.', pistol_no: null, rifle_no: null,
    gov20_pistol: false, gov20_rifle: false, chiefs50: false, eic_pistol: null, eic_rifle: null, created_at: created,
  });
  const team = members.filter(m => m.id !== DEMO_GUEST_MEMBER_ID);
  const active = team.filter(m => m.team_status !== 'Inactive');

  const compliance: Row[] = team.map((m, i) => {
    const hq = at(-between(20, 400)), rq = at(-between(20, 380));
    const expired = i === 9, soon = i === 5 || i === 13;
    return {
      member_id: m.id,
      handgun_qual_date: iso(hq), handgun_qual_exp: iso(expired ? at(-12) : soon ? at(between(10, 40)) : new Date(hq.getTime() + 365 * DAY)),
      rifle_qual_date: i % 4 === 3 ? null : iso(rq), rifle_qual_exp: i % 4 === 3 ? null : iso(new Date(rq.getTime() + 365 * DAY)),
      lautenberg_date: i === 18 ? null : iso(at(-between(30, 300))), range_waiver_date: i === 20 ? null : iso(at(-between(10, 250))),
      gov_license: i % 3 !== 2, gov_license_date: i % 3 !== 2 ? iso(at(-between(60, 700))) : null, vco: i % 3 === 0,
      notes: null, updated_at: created,
    };
  });

  // ---- Calendar ----
  type Plan = { d: number; len?: number; kind: string; title: string; loc: string };
  const plans: Plan[] = [];
  for (let d = -126; d <= 70; d += 14) plans.push({ d, kind: 'practice', title: d % 28 === 0 ? 'Pistol practice' : 'Rifle & pistol practice', loc: RANGES[0] });
  plans.push(
    { d: -98, len: 2, kind: 'match', title: 'Heartland Combat Pistol Match', loc: 'Cottonwood Training Area' },
    { d: -63, kind: 'qual', title: 'Annual quals (M18 / M4)', loc: RANGES[0] },
    { d: -42, len: 3, kind: 'match', title: 'Regional Rifle & Pistol Championship', loc: 'Fort Wayland Range Complex' },
    { d: -20, kind: 'cleaning', title: 'Weapons cleaning & inventory', loc: RANGES[2] },
    { d: -9, kind: 'meeting', title: 'Season planning meeting', loc: RANGES[2] },
    { d: 12, kind: 'tryout', title: 'New shooter tryouts', loc: RANGES[1] },
    { d: 33, len: 3, kind: 'match', title: 'Winter State Guard Match', loc: 'Fort Wayland Range Complex' },
    { d: 54, kind: 'cleaning', title: 'Post-match cleaning', loc: RANGES[2] },
  );
  plans.sort((a, b) => a.d - b.d);

  const events: Row[] = [], attendance: Row[] = [], scores: Row[] = [];
  let attN = 0, scoreN = 0;
  plans.forEach((p, i) => {
    const id = uuid('00000000', 1000 + i);
    const past = p.d < 0, soon = p.d >= 0 && p.d < 21;
    const shooting = p.kind === 'practice' || p.kind === 'match' || p.kind === 'qual' || p.kind === 'tryout';
    const roster = (p.kind === 'tryout' ? active.filter(m => m.team_status === 'Tryout' || m.team_status === 'New' || m.staff_role) : active)
      .filter(() => r() < (p.kind === 'match' ? 0.55 : 0.75));
    const driver = shooting ? pick(active.slice(0, 13)).id as string : null;
    events.push({
      id, title: p.title, kind: p.kind, start_date: iso(at(p.d)), end_date: p.len ? iso(at(p.d + p.len - 1)) : null, location: p.loc,
      notes: shooting ? (p.kind === 'match' ? 'Report time 0630. Bring ear/eye pro, ID card and a copy of your orders.' : 'Bring eye/ear pro and water. Range opens at 0800.') : p.kind === 'meeting' ? 'Agenda: match schedule, ammo forecast, new shooter pipeline.' : null,
      aar: past && shooting ? pick(['Good turnout. Trigger control drills helped — groups tightened up noticeably on the second relay.', 'Wind picked up after noon; worked on holdoffs. Need more mags loaded before the first relay next time.', 'Strong showing. Two shooters moved up a bracket. Timer battery died — bring spares.', 'Range ran smoothly. Snap-fire transitions still slow; focus there next practice.']) : null,
      ammo_556: shooting && past ? between(6, 18) * 100 : shooting && soon ? 1200 : null,
      ammo_9mm: shooting && past ? between(8, 24) * 100 : shooting && soon ? 1500 : null,
      prep_ammo_draw: shooting && (past || soon), prep_placard: shooting && (past || p.d < 7), prep_van_driver: shooting && past,
      van_driver_id: shooting && (past || soon) ? driver : null,
      ammo_draw_requested_on: shooting && (past || soon) ? iso(at(p.d - 10)) : null,
      ammo_draw_556: shooting && (past || soon) ? between(10, 20) * 100 : null, ammo_draw_9mm: shooting && (past || soon) ? between(12, 25) * 100 : null,
      groupme_posted_at: past || soon ? at(p.d - 14).toISOString() : null,
      prep_vehicle_requested: shooting && (past || soon), prep_vehicle_confirmed: shooting && past,
      created_at: at(p.d - 30).toISOString(),
    });
    for (const m of roster) {
      const status = past ? (r() < 0.85 ? 'attended' : r() < 0.5 ? 'excused' : 'absent') : r() < 0.85 ? 'planned' : 'absent';
      attendance.push({
        id: uuid('00000000', 50000 + attN++), event_id: id, member_id: m.id, status,
        orders_status: m.duty_status === 'AGR' || m.duty_status === 'Civilian' ? 'not_required' : past ? 'signed' : pick(['submitted', 'cut', 'none']),
        transport: p.kind === 'match' ? pick(['Team van', 'Team van', 'POV']) : null, note: null,
      });
      if (past && status === 'attended' && shooting && p.kind !== 'tryout') {
        const skill = 1 - team.indexOf(m) / team.length; // senior shooters score a bit higher
        const label = p.kind === 'match' ? p.title : p.kind === 'qual' ? 'Qualification' : 'Practice';
        const shots: [string, number, number, number][] = [['PISTOL_EIC', 140, 195, 12], ['RIFLE_RR', 120, 178, 9]];
        if (p.kind === 'match') shots.push(['RIFLE_EIC', 380, 488, 18], ['PISTOL_AB', 120, 176, 8]);
        for (const [code, lo, hi, xmax] of shots) {
          if (p.kind !== 'match' && r() < 0.3) continue;
          const total = Math.min(hi, Math.round(lo + (hi - lo) * (0.35 * r() + 0.65 * skill)));
          const x = Math.round(xmax * (0.2 + 0.8 * skill) * r());
          scores.push({ id: uuid('00000000', 90000 + scoreN++), member_id: m.id, course_code: code, event_id: id, shot_on: iso(at(p.d)), session_label: label, total, x_count: x, raw: `${total}-${x}X`, notes: null, created_at: at(p.d).toISOString() });
        }
      }
    }
  });

  // ---- Match teams for the past championship and the upcoming match ----
  const match_teams: Row[] = [], match_team_members: Row[] = [];
  events.filter(e => e.kind === 'match').slice(-2).forEach((e, k) => {
    const going = attendance.filter(a => a.event_id === e.id && (a.status === 'attended' || a.status === 'planned')).map(a => a.member_id as string);
    [['Team 1', 'Gold'], ['Team 2', 'Black']].forEach(([name, nick], t) => {
      const tid = uuid('00000000', 7000 + k * 10 + t);
      const four = going.slice(t * 4, t * 4 + 4);
      if (!four.length) return;
      match_teams.push({ id: tid, event_id: e.id, name, nickname: nick, captain_id: four[0] });
      four.forEach(mid => match_team_members.push({ team_id: tid, member_id: mid }));
    });
  });

  // ---- Accounts and access ----
  const profiles: Row[] = [
    { id: DEMO_GUEST_ID, email: 'guest@mtu-demo.example', display_name: 'Demo Guest', role: 'staff', approved: true, member_id: DEMO_GUEST_MEMBER_ID, created_at: at(-1).toISOString(), pending: false, pending_info: null, pending_notified: false, tutorial_done_at: at(-1).toISOString() },
    ...team.slice(0, 14).map((m, i) => ({ id: uuid('00000000', 200 + i), email: m.mil_email, display_name: `${m.rank} ${m.first_name} ${m.last_name}`, role: i < 5 ? 'staff' : 'shooter', approved: true, member_id: m.id, created_at: at(-180 + i * 5).toISOString(), pending: false, pending_info: null, pending_notified: true, tutorial_done_at: at(-170 + i * 5).toISOString() })),
    { id: uuid('00000000', 299), email: 'jordan.kimura@example.mil', display_name: 'A1C Jordan Kimura', role: 'shooter', approved: false, member_id: null, created_at: at(-1).toISOString(), pending: true, pending_info: { rank: 'A1C', first_name: 'Jordan', last_name: 'Kimura', unit: '412 NOS', duty_status: 'Traditional' }, pending_notified: true, tutorial_done_at: null },
  ];
  const staffEmails = team.slice(0, 5).map(m => ({ email: m.mil_email, added_by: uuid('00000000', 200), created_at: created }));
  const staff_duties: Row[] = [
    { email: team[6].mil_email, duty: 'vehicle', added_by: uuid('00000000', 200), created_at: created },
    { email: team[7].mil_email, duty: 'ammo', added_by: uuid('00000000', 200), created_at: created },
  ];
  const invites: Row[] = [
    { id: uuid('00000000', 300), token: 'demo-team-link-not-real-0001', note: 'Team sign-up link', member_id: null, created_by: uuid('00000000', 200), created_at: at(-3).toISOString(), expires_at: at(11).toISOString(), used_at: at(-1).toISOString(), used_by: null, multi_use: true, use_count: 3 },
    { id: uuid('00000000', 301), token: 'demo-single-invite-not-real-02', note: 'For SrA Truesdale', member_id: team[21].id, created_by: uuid('00000000', 200), created_at: at(-20).toISOString(), expires_at: at(-6).toISOString(), used_at: at(-18).toISOString(), used_by: uuid('00000000', 213), multi_use: false, use_count: 1 },
  ];
  const ranges = RANGES.map((name, i) => ({ id: uuid('00000000', 400 + i), name, created_at: created }));

  const announcements: Row[] = [
    { id: uuid('00000000', 500), title: 'Winter State Guard Match roster is up', body: 'Check the Calendar for the match and RSVP by the end of the week so orders can be cut in time.', popup: false, target: 'events', audience: 'all', created_by: uuid('00000000', 200), created_at: at(-4).toISOString(), published_at: at(-4).toISOString() },
    { id: uuid('00000000', 501), title: 'Offline mode for the range', body: 'The app now keeps a copy on your phone. Scores and RSVPs entered with no signal send automatically once you’re back in coverage.', popup: false, target: 'scores', audience: 'all', created_by: uuid('00000000', 200), created_at: at(-10).toISOString(), published_at: at(-10).toISOString() },
    { id: uuid('00000000', 502), title: 'Staff: ammo forecast due', body: 'Ammo managers — please confirm next quarter’s 5.56 and 9mm forecast on the Ammo page.', popup: false, target: 'dashboard', audience: 'staff', created_by: uuid('00000000', 200), created_at: at(-2).toISOString(), published_at: at(-2).toISOString() },
  ];
  const announcement_reads = announcements.slice(1).map(a => ({ user_id: DEMO_GUEST_ID, announcement_id: a.id, read_at: at(-1).toISOString() }));

  const support_tickets: Row[] = [
    { id: uuid('00000000', 600), created_by: uuid('00000000', 208), kind: 'feedback', message: 'Could the leaderboard show personal bests too?', page: 'scores', device: 'iPhone · Safari', screenshots: [], status: 'in_progress', staff_reply: 'Good idea — working on it.', notified_at: at(-6).toISOString(), created_at: at(-6).toISOString(), updated_at: at(-5).toISOString() },
    { id: uuid('00000000', 601), created_by: uuid('00000000', 210), kind: 'question', message: 'How do I change my RSVP after the deadline?', page: 'events', device: 'Android · Chrome', screenshots: [], status: 'closed', staff_reply: 'Just tap the event and change it — staff will see the update.', notified_at: at(-15).toISOString(), created_at: at(-15).toISOString(), updated_at: at(-14).toISOString() },
  ];

  // ---- Change log ----
  const audit_log: Row[] = [];
  const staffNames = profiles.filter(p => p.role === 'staff' && p.id !== DEMO_GUEST_ID);
  for (let i = 0; i < 40; i++) {
    const who = pick(staffNames);
    const kind = pick(['scores', 'attendance', 'events', 'members']);
    const row = kind === 'scores' ? pick(scores) : kind === 'attendance' ? pick(attendance) : kind === 'events' ? pick(events) : pick(team);
    const op = kind === 'scores' ? 'INSERT' : 'UPDATE';
    const when = at(-i * 2 - r()).toISOString();
    audit_log.push({
      id: 1000 - i, at: when, actor_id: who.id, actor_email: who.email, table_name: kind, op, row_id: String(row.id),
      old_data: op === 'UPDATE' ? (kind === 'attendance' ? { ...row, status: 'planned' } : kind === 'events' ? { ...row, prep_placard: false } : { ...row, team_status: 'New' }) : null,
      new_data: row,
    });
  }

  return {
    members, member_compliance: compliance, events, attendance, courses: COURSES, scores, match_teams, match_team_members,
    profiles, staff_emails: staffEmails, invites, ranges, staff_duties, announcements, announcement_reads, support_tickets,
    audit_log, resource_files: [],
  };
}
