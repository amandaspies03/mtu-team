'use client';
import { useState } from 'react';
import { useTeam } from '../../lib/data';
import { WEAPON_COUNT, type Member } from '../../lib/types';

/**
 * Staff pick a shooter's team weapon number (same number for pistol and rifle); everyone else just sees it.
 * Numbers can be shared: not everyone comes to every practice, so two shooters may hold the same number.
 */
export function WeaponSelect({ member }: { member: Member }) {
  const { sb, isStaff, members, reload } = useTeam();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const current = member.weapon_no;
  if (!isStaff) return <span className={current == null ? 'muted' : ''}>{current ?? 'Unassigned'}</span>;
  const holders = (n: number) => members.filter(m => m.id !== member.id && m.weapon_no === n).map(m => m.last_name);

  async function change(v: string) {
    setBusy(true); setErr('');
    const { error } = await sb.from('members').update({ weapon_no: v === '' ? null : Number(v) }).eq('id', member.id);
    if (error) setErr(error.message);
    await reload();
    setBusy(false);
  }

  return (
    <span className="weaponCell" onClick={e => e.stopPropagation()}>
      <select aria-label={`Weapon number for ${member.last_name}`} className="weaponSelect" value={current ?? ''} disabled={busy} onChange={e => change(e.target.value)}>
        <option value="">Unassigned</option>
        {Array.from({ length: WEAPON_COUNT }, (_, i) => i + 1).map(n => {
          const h = holders(n);
          return <option key={n} value={n}>{n}{h.length ? ` · also ${h.join(', ')}` : ''}</option>;
        })}
      </select>
      {err && <small className="formNote error">{err}</small>}
    </span>
  );
}
