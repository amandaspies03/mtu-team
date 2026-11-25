'use client';
import { useState } from 'react';
import { useTeam } from '../../lib/data';
import { WEAPON_COUNT, type Member } from '../../lib/types';

/**
 * Staff pick a shooter's team weapon number (same number for pistol and rifle); everyone else just sees it.
 * Numbers can be shared: not everyone comes to every practice, so two shooters may hold the same number.
 */
export function WeaponSelect({ member }: { member: Member }) {
  const { sb, isStaff, members, reload, weaponsDown } = useTeam();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const current = member.weapon_no;
  const curDown = current != null && weaponsDown.some(w => w.weapon_type === 'rifle' && w.weapon_no === current);
  if (!isStaff) return <span className={current == null ? 'muted' : ''}>{current ?? 'Unassigned'}{curDown && <small className="sub error">rifle out of service</small>}</span>;
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
          const down = weaponsDown.some(w => w.weapon_type === 'rifle' && w.weapon_no === n);
          // Out of service: can't be given out (whoever already has it keeps it, flagged).
          return <option key={n} value={n} disabled={down && n !== current}>{n}{down ? ' · out of service' : ''}{h.length ? ` · also ${h.join(', ')}` : ''}</option>;
        })}
      </select>
      {curDown && <small className="formNote error">Rifle out of service</small>}
      {err && <small className="formNote error">{err}</small>}
    </span>
  );
}
