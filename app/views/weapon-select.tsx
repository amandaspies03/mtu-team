'use client';
import { useState } from 'react';
import { useTeam } from '../../lib/data';
import { WEAPON_COUNT, type Member } from '../../lib/types';

type Kind = 'pistol' | 'rifle';
const col = (k: Kind) => (k === 'pistol' ? 'pistol_no' : 'rifle_no') as 'pistol_no' | 'rifle_no';

/** Staff pick a team weapon number in the roster row; everyone else just sees it. */
export function WeaponSelect({ member, kind }: { member: Member; kind: Kind }) {
  const { sb, isStaff, members, reload } = useTeam();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const key = col(kind);
  const current = member[key];
  if (!isStaff) return <span>{current ?? '—'}</span>;
  const holder = (n: number) => members.find(m => m.id !== member.id && m[key] === n);

  async function change(v: string) {
    setBusy(true); setErr('');
    const { error } = await sb.from('members').update({ [key]: v === '' ? null : Number(v) }).eq('id', member.id);
    if (error) setErr(error.code === '23505' ? 'Already assigned' : error.message);
    await reload();
    setBusy(false);
  }

  return (
    <span className="weaponCell" onClick={e => e.stopPropagation()}>
      <select aria-label={`${kind === 'pistol' ? 'Pistol' : 'Rifle'} number for ${member.last_name}`} className="weaponSelect" value={current ?? ''} disabled={busy} onChange={e => change(e.target.value)}>
        <option value="">—</option>
        {Array.from({ length: WEAPON_COUNT[kind] }, (_, i) => i + 1).map(n => {
          const h = holder(n);
          return <option key={n} value={n} disabled={!!h}>{n}{h ? ` · ${h.last_name}` : ''}</option>;
        })}
      </select>
      {err && <small className="formNote error">{err}</small>}
    </span>
  );
}

