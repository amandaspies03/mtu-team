'use client';
import { DUTY_STATUSES, RANK_GROUPS } from '../../lib/types';

export type ProfileInfo = {
  first_name: string; last_name: string; rank: string; unit: string; duty_status: string;
  cell_phone: string; mil_email: string; personal_email: string;
};
export const blankProfile: ProfileInfo = { first_name: '', last_name: '', rank: '', unit: '', duty_status: '', cell_phone: '', mil_email: '', personal_email: '' };

/** The roster details every new account fills in; they become the person's roster entry. */
export function ProfileFields({ value, onChange }: { value: ProfileInfo; onChange: (v: ProfileInfo) => void }) {
  const set = (k: keyof ProfileInfo) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => onChange({ ...value, [k]: e.target.value });
  return (
    <div className="formGrid">
      <label>First name<input value={value.first_name} onChange={set('first_name')} autoComplete="given-name" required /></label>
      <label>Last name<input value={value.last_name} onChange={set('last_name')} autoComplete="family-name" required /></label>
      <label>Rank
        <select value={value.rank} onChange={set('rank')} required>
          <option value="">Select rank…</option>
          {RANK_GROUPS.map(g => <optgroup key={g.label} label={g.label}>{g.ranks.map(r => <option key={r} value={r}>{r}</option>)}</optgroup>)}
        </select>
      </label>
      <label>Unit<input value={value.unit} onChange={set('unit')} placeholder="161 IS" /></label>
      <label>Duty status
        <select value={value.duty_status} onChange={set('duty_status')}><option value="">—</option>{DUTY_STATUSES.map(s => <option key={s}>{s}</option>)}</select>
      </label>
      <label>Cell phone<input type="tel" value={value.cell_phone} onChange={set('cell_phone')} autoComplete="tel" placeholder="316-555-0100" required /></label>
      <label>Military email<input type="email" value={value.mil_email} onChange={set('mil_email')} placeholder="first.last.1@us.af.mil" /></label>
      <label>Personal email<input type="email" value={value.personal_email} onChange={set('personal_email')} autoComplete="email" /></label>
    </div>
  );
}
