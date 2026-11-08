'use client';
import { useState } from 'react';
import { useTeam } from '../../lib/data';
import { DUTY_STATUSES, TEAM_STATUSES, type Compliance, type Member } from '../../lib/types';
import { Modal } from './ui';

const blank = { last_name: '', first_name: '', rank: '', unit: '', duty_status: '', team_status: 'New', staff_role: '', email: '', phone: '', notes: '' };

export function MemberForm({ member, onClose, onSaved }: { member?: Member; onClose: () => void; onSaved?: (id: string) => void }) {
  const { sb, reload } = useTeam();
  const [f, setF] = useState<Record<string, string>>(() => member ? Object.fromEntries(Object.keys(blank).map(k => [k, (member as unknown as Record<string, string | null>)[k] ?? ''])) : { ...blank });
  const [busy, setBusy] = useState(false), [err, setErr] = useState('');
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr('');
    const row = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.trim() === '' ? null : v.trim()]));
    row.team_status = row.team_status ?? 'Active';
    const q = member ? sb.from('members').update(row).eq('id', member.id).select('id').single() : sb.from('members').insert(row).select('id').single();
    const { data, error } = await q;
    if (error) { setErr(error.message); setBusy(false); return; }
    await reload();
    onSaved?.(data.id);
    onClose();
  }

  return (
    <Modal title={member ? 'Edit shooter' : 'Add shooter'} onClose={onClose}>
      <form onSubmit={save} className="form">
        <div className="formGrid">
          <label>Last name<input value={f.last_name} onChange={set('last_name')} required /></label>
          <label>First name<input value={f.first_name} onChange={set('first_name')} /></label>
          <label>Rank<input value={f.rank} onChange={set('rank')} placeholder="SSgt" /></label>
          <label>Unit<input value={f.unit} onChange={set('unit')} placeholder="161 IS" /></label>
          <label>Duty status
            <select value={f.duty_status} onChange={set('duty_status')}><option value="">—</option>{DUTY_STATUSES.map(s => <option key={s}>{s}</option>)}</select>
          </label>
          <label>Team status
            <select value={f.team_status} onChange={set('team_status')}>{TEAM_STATUSES.map(s => <option key={s}>{s}</option>)}</select>
          </label>
          <label>Staff role<input value={f.staff_role} onChange={set('staff_role')} placeholder="OIC, NCOIC, Instructor…" /></label>
          <label>Email<input type="email" value={f.email} onChange={set('email')} /></label>
          <label>Phone<input type="tel" value={f.phone} onChange={set('phone')} /></label>
        </div>
        <label>Notes<textarea rows={3} value={f.notes} onChange={set('notes')} placeholder="Match intent, gear, MTU history…" /></label>
        {err && <p className="alert">{err}</p>}
        <div className="formActions"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button></div>
      </form>
    </Modal>
  );
}

const cBlank: Omit<Compliance, 'member_id'> = {
  handgun_qual_date: null, handgun_qual_exp: null, rifle_qual_date: null, rifle_qual_exp: null,
  lautenberg_date: null, range_waiver_date: null, gov_license: false, gov_license_date: null, vco: false, notes: null,
};

/** AF quals expire the last day of the month, one year after the qual. */
const qualExp = (d: string) => {
  const [y, m] = d.split('-').map(Number);
  const last = new Date(y + 1, m, 0);
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;
};

export function ComplianceForm({ memberId, current, onClose }: { memberId: string; current?: Compliance; onClose: () => void }) {
  const { sb, reload } = useTeam();
  const [c, setC] = useState({ ...cBlank, ...current });
  const [busy, setBusy] = useState(false), [err, setErr] = useState('');
  const d = (k: keyof typeof c) => ({
    value: (c[k] as string | null) ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value || null;
      const next = { ...c, [k]: v };
      if (k === 'handgun_qual_date' && v && !c.handgun_qual_exp) next.handgun_qual_exp = qualExp(v);
      if (k === 'rifle_qual_date' && v && !c.rifle_qual_exp) next.rifle_qual_exp = qualExp(v);
      setC(next);
    },
  });
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr('');
    const { error } = await sb.from('member_compliance').upsert({ ...c, member_id: memberId, updated_at: new Date().toISOString() });
    if (error) { setErr(error.message); setBusy(false); return; }
    await reload();
    onClose();
  }
  return (
    <Modal title="Quals & paperwork" onClose={onClose}>
      <form onSubmit={save} className="form">
        <p className="formNote">Dates only. Keep the signed forms (AF 522, DD 2760, AF 171, waivers) in the Drive folder — never upload or type SSNs, DoD IDs, DOBs or license numbers here.</p>
        <div className="formGrid">
          <label>Handgun AFQC date<input type="date" {...d('handgun_qual_date')} /></label>
          <label>Handgun qual expires<input type="date" {...d('handgun_qual_exp')} /></label>
          <label>Rifle/carbine AFQC date<input type="date" {...d('rifle_qual_date')} /></label>
          <label>Rifle qual expires<input type="date" {...d('rifle_qual_exp')} /></label>
          <label>DD 2760 (Lautenberg) signed<input type="date" {...d('lautenberg_date')} /></label>
          <label>Range waiver signed<input type="date" {...d('range_waiver_date')} /></label>
          <label>Gov vehicle (AF 171) date<input type="date" {...d('gov_license_date')} /></label>
        </div>
        <label className="check"><input type="checkbox" checked={c.gov_license} onChange={e => setC({ ...c, gov_license: e.target.checked })} /> Licensed to drive the team van</label>
        <label className="check"><input type="checkbox" checked={c.vco} onChange={e => setC({ ...c, vco: e.target.checked })} /> Appointed VCO / vehicle trainer</label>
        <label>Notes<textarea rows={2} value={c.notes ?? ''} onChange={e => setC({ ...c, notes: e.target.value || null })} /></label>
        {err && <p className="alert">{err}</p>}
        <div className="formActions"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button></div>
      </form>
    </Modal>
  );
}
