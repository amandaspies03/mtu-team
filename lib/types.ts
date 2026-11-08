export type Role = 'staff' | 'shooter';
export type TeamStatus = 'Active' | 'New' | 'Tryout' | 'Inactive';
export const TEAM_STATUSES: TeamStatus[] = ['Active', 'New', 'Tryout', 'Inactive'];
export const DUTY_STATUSES = ['AGR', 'Traditional', 'Technician', 'DSG', 'Civilian', 'Other'] as const;

export type Profile = {
  id: string;
  email: string | null;
  display_name: string | null;
  role: Role;
  approved: boolean;
  member_id: string | null;
  created_at: string;
};

export type Member = {
  id: string;
  last_name: string;
  first_name: string | null;
  rank: string | null;
  unit: string | null;
  duty_status: string | null;
  team_status: TeamStatus;
  staff_role: string | null;
  cell_phone: string | null;
  mil_email: string | null;
  personal_email: string | null;
  pistol_no: number | null;
  rifle_no: number | null;
  notes: string | null;
  gov20_pistol: boolean;
  gov20_rifle: boolean;
  chiefs50: boolean;
  eic_badge: EicBadge | null;
};

export type Range = { id: string; name: string; created_at: string };

export type EicBadge = 'bronze' | 'silver' | 'gold';
export const EIC_LABEL: Record<EicBadge, string> = { bronze: 'Bronze EIC', silver: 'Silver EIC', gold: 'Gold EIC' };

export type Compliance = {
  member_id: string;
  handgun_qual_date: string | null;
  handgun_qual_exp: string | null;
  rifle_qual_date: string | null;
  rifle_qual_exp: string | null;
  lautenberg_date: string | null;
  range_waiver_date: string | null;
  gov_license: boolean;
  gov_license_date: string | null;
  vco: boolean;
  notes: string | null;
};

export type EventKind = 'practice' | 'match' | 'tryout' | 'qual' | 'cleaning' | 'meeting' | 'other';
export const EVENT_KINDS: EventKind[] = ['practice', 'match', 'tryout', 'qual', 'cleaning', 'meeting', 'other'];

export type TeamEvent = {
  id: string;
  title: string;
  kind: EventKind;
  start_date: string;
  end_date: string | null;
  location: string | null;
  notes: string | null;
  aar: string | null;
  ammo_556: number | null;
  ammo_9mm: number | null;
  prep_ammo_draw: boolean;
  prep_placard: boolean;
  prep_van_driver: boolean;
  van_driver_id: string | null;
  ammo_draw_requested_on: string | null;
  ammo_draw_556: number | null;
  ammo_draw_9mm: number | null;
};

/** Practice prep checklist. Van driver counts as done when ticked or a driver is picked. */
export const PREP_ITEMS = [
  { key: 'prep_ammo_draw', label: 'Ammo draw requested' },
  { key: 'prep_placard', label: 'Explosive placard' },
  { key: 'prep_van_driver', label: 'Van driver identified' },
] as const;
export const prepDone = (e: TeamEvent) => PREP_ITEMS.filter(i => (i.key === 'prep_van_driver' ? e.prep_van_driver || !!e.van_driver_id : e[i.key])).length;

export type AttendanceStatus = 'planned' | 'attended' | 'absent' | 'excused';

export type Attendance = {
  id: string;
  event_id: string;
  member_id: string;
  status: AttendanceStatus;
  transport: string | null;
  note: string | null;
};

export type Course = {
  code: string;
  name: string;
  weapon: 'Pistol' | 'Rifle';
  max_score: number | null;
  has_x: boolean;
  sort: number;
};

export type Score = {
  id: string;
  member_id: string;
  course_code: string;
  event_id: string | null;
  shot_on: string | null;
  session_label: string | null;
  total: number | null;
  x_count: number | null;
  raw: string | null;
  notes: string | null;
  created_at: string;
};

export type MatchTeam = {
  id: string;
  event_id: string;
  name: string;
  nickname: string | null;
  captain_id: string | null;
};
export type MatchTeamMember = { team_id: string; member_id: string };


/** Rank options for the shooter form, grouped for the dropdown. */
export const RANK_GROUPS: { label: string; ranks: string[] }[] = [
  { label: 'Air Force enlisted', ranks: ['AB', 'Amn', 'A1C', 'SrA', 'SSgt', 'TSgt', 'MSgt', 'SMSgt', 'CMSgt'] },
  { label: 'Air Force officer', ranks: ['2d Lt', '1st Lt', 'Capt', 'Maj', 'Lt Col', 'Col', 'Brig Gen', 'Maj Gen', 'Lt Gen', 'Gen'] },
  { label: 'Other', ranks: ['Civilian'] },
];

/** Team weapon inventory: numbers 1–N for each type. */
export const WEAPON_COUNT = { pistol: 24, rifle: 24 } as const;

export type StaffEmail = { email: string; added_by: string | null; created_at: string };
export type Invite = {
  id: string; token: string; note: string | null; member_id: string | null; created_by: string | null;
  created_at: string; expires_at: string; used_at: string | null; used_by: string | null;
};
