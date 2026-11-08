import type { Member, Compliance, TeamEvent } from './types';

export const fullName = (m?: Member | null) =>
  m ? `${m.last_name}${m.first_name ? ', ' + m.first_name : ''}` : 'Unknown';

export const displayName = (m?: Member | null) =>
  m ? [m.rank, m.first_name, m.last_name].filter(Boolean).join(' ') : 'Unknown';

export const todayISO = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

/** Dates are stored as plain YYYY-MM-DD; parse them as local dates, never UTC. */
export const parseDate = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const fmtDate = (s: string | null | undefined, opts?: Intl.DateTimeFormatOptions) =>
  s ? parseDate(s).toLocaleDateString('en-US', opts ?? { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

/** Military style: 07 NOV 2026 */
export const milDate = (s: string | null | undefined) =>
  s ? fmtDate(s).replace(/(\w{3}) (\d{2}), (\d{4})/, '$2 $1 $3').toUpperCase() : '—';

export const daysUntil = (s: string) => Math.round((parseDate(s).getTime() - parseDate(todayISO()).getTime()) / 86400000);

export const eventRange = (e: TeamEvent) =>
  e.end_date && e.end_date !== e.start_date ? `${milDate(e.start_date)} – ${milDate(e.end_date)}` : milDate(e.start_date);

export type ExpiryState = 'missing' | 'expired' | 'soon' | 'ok';
export function expiryState(exp: string | null | undefined, warnDays = 60): ExpiryState {
  if (!exp) return 'missing';
  const d = daysUntil(exp);
  if (d < 0) return 'expired';
  if (d <= warnDays) return 'soon';
  return 'ok';
}

/** Items a staff member should act on for one shooter. */
export function complianceIssues(c?: Compliance | null): { label: string; state: ExpiryState }[] {
  if (!c) return [{ label: 'No compliance record', state: 'missing' }];
  const out: { label: string; state: ExpiryState }[] = [];
  const h = expiryState(c.handgun_qual_exp);
  const r = expiryState(c.rifle_qual_exp);
  if (h !== 'ok') out.push({ label: 'Handgun qual', state: h });
  if (r !== 'ok') out.push({ label: 'Rifle qual', state: r });
  if (!c.lautenberg_date) out.push({ label: 'DD 2760 (Lautenberg)', state: 'missing' });
  return out;
}

export const scoreText = (total: number | null, x: number | null, raw?: string | null) => {
  if (total == null) return raw || '—';
  return x != null ? `${total}-${x}X` : String(total);
};

export const fiscalYear = (iso: string) => {
  const d = parseDate(iso);
  return d.getMonth() >= 9 ? d.getFullYear() + 1 : d.getFullYear();
};

export const kindLabel: Record<string, string> = {
  practice: 'Practice', match: 'Match', tryout: 'Tryout', qual: 'Qual / Staff',
  cleaning: 'Cleaning', meeting: 'Meeting', other: 'Other',
};

export function downloadCsv(name: string, rows: (string | number | null | undefined)[][]) {
  // Prefix cells that spreadsheets would treat as formulas.
  const cell = (v: string | number | null | undefined) => {
    let s = v == null ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const blob = new Blob([rows.map(r => r.map(cell).join(',')).join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
