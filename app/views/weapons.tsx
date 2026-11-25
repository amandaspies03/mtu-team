'use client';
// Weapon roster: every team weapon number 1–24 and who it's assigned to (several people can share a number).
// Staff and vault access can open it; Print gives a one-page list for the vault.
import { useState } from 'react';
import { Printer, Wrench } from 'lucide-react';
import { useTeam } from '../../lib/data';
import { WEAPON_COUNT } from '../../lib/types';
import { displayName, milDate, todayISO } from '../../lib/util';
import { PageTitle, Tag } from './ui';

export default function WeaponRoster() {
  const { sb, members, weaponsDown, can, reload } = useTeam();
  const [err, setErr] = useState(''), [busy, setBusy] = useState<number | null>(null);
  const rifleDown = (n: number) => weaponsDown.find(w => w.weapon_type === 'rifle' && w.weapon_no === n);
  async function toggleRifle(n: number) {
    setErr('');
    const down = rifleDown(n);
    let q;
    if (down) {
      if (!confirm(`Put rifle #${n} back in service? It can be drawn for practices again.`)) return;
      q = sb.from('weapons_out_of_service').delete().eq('weapon_type', 'rifle').eq('weapon_no', n);
    } else {
      const note = prompt(`Mark rifle #${n} out of service. It won't be drawable until it's back. Weapon #${n} can still be assigned (the pistol is fine).\n\nReason (optional):`, '');
      if (note === null) return;
      q = sb.from('weapons_out_of_service').insert({ weapon_type: 'rifle', weapon_no: n, note: note.trim().slice(0, 200) || null });
    }
    setBusy(n);
    const { error } = await q;
    if (error) setErr(error.message); else await reload();
    setBusy(null);
  }
  const downCount = weaponsDown.filter(w => w.weapon_type === 'rifle').length;
  const numbers = Array.from({ length: WEAPON_COUNT }, (_, i) => i + 1);
  const holders = (n: number) => members.filter(m => m.weapon_no === n)
    .sort((a, b) => Number(a.team_status === 'Inactive') - Number(b.team_status === 'Inactive') || a.last_name.localeCompare(b.last_name));
  const assigned = numbers.filter(n => holders(n).length).length;
  return (
    <div className="weaponRoster">
      <PageTitle eyebrow="TEAM" title="Weapon roster"
        actions={<button className="secondary" onClick={() => window.print()}><Printer size={15} /> Print</button>}>
        Each number covers that pistol and that rifle. {assigned} of {WEAPON_COUNT} numbers assigned{downCount > 0 ? ` · ${downCount} rifle${downCount === 1 ? '' : 's'} out of service` : ''}.
      </PageTitle>
      <p className="printOnly printHead"><b>184th MTU · Weapon roster</b> · {milDate(todayISO())}</p>
      {err && <p className="alert">{err}</p>}
      <section className="panel">
        <div className="tableWrap"><table className="weaponTable">
          <thead><tr><th className="num">Weapon #</th><th>Assigned to</th><th>Rifle</th></tr></thead>
          <tbody>{numbers.map(n => {
            const h = holders(n);
            const down = rifleDown(n);
            return (
              <tr key={n} className={h.length ? '' : 'emptyWeapon'}>
                <td className="num"><b>{n}</b></td>
                <td>{h.length ? h.map((m, i) => <span key={m.id}>{i > 0 && ', '}{displayName(m)}{m.team_status === 'Inactive' && <small className="muted"> (inactive)</small>}</span>) : <span className="muted">—</span>}</td>
                <td className="nowrap">
                  {down ? <><Tag tone="bad">Out of service</Tag>{down.note && <small className="sub">{down.note}</small>}</> : <span className="muted printHide">In service</span>}
                  {can('vault') && <button className="linkBtn noPrint" disabled={busy === n} onClick={() => toggleRifle(n)}>{down ? 'Back in service' : <><Wrench size={12} /> Mark out of service</>}</button>}
                </td>
              </tr>
            );
          })}</tbody>
        </table></div>
      </section>
    </div>
  );
}
