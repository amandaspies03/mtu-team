'use client';
// Weapon roster: every team weapon number 1–24 and who it's assigned to (several people can share a number).
// Staff and vault access can open it; Print gives a one-page list for the vault.
import { Printer } from 'lucide-react';
import { useTeam } from '../../lib/data';
import { WEAPON_COUNT } from '../../lib/types';
import { displayName, milDate, todayISO } from '../../lib/util';
import { PageTitle } from './ui';

export default function WeaponRoster() {
  const { members } = useTeam();
  const numbers = Array.from({ length: WEAPON_COUNT }, (_, i) => i + 1);
  const holders = (n: number) => members.filter(m => m.weapon_no === n)
    .sort((a, b) => Number(a.team_status === 'Inactive') - Number(b.team_status === 'Inactive') || a.last_name.localeCompare(b.last_name));
  const assigned = numbers.filter(n => holders(n).length).length;
  return (
    <div className="weaponRoster">
      <PageTitle eyebrow="TEAM" title="Weapon roster"
        actions={<button className="secondary" onClick={() => window.print()}><Printer size={15} /> Print</button>}>
        Each number covers that pistol and that rifle. {assigned} of {WEAPON_COUNT} numbers assigned.
      </PageTitle>
      <p className="printOnly printHead"><b>184th MTU · Weapon roster</b> · {milDate(todayISO())}</p>
      <section className="panel">
        <div className="tableWrap"><table className="weaponTable">
          <thead><tr><th className="num">Weapon #</th><th>Assigned to</th></tr></thead>
          <tbody>{numbers.map(n => {
            const h = holders(n);
            return (
              <tr key={n} className={h.length ? '' : 'emptyWeapon'}>
                <td className="num"><b>{n}</b></td>
                <td>{h.length ? h.map((m, i) => <span key={m.id}>{i > 0 && ', '}{displayName(m)}{m.team_status === 'Inactive' && <small className="muted"> (inactive)</small>}</span>) : <span className="muted">—</span>}</td>
              </tr>
            );
          })}</tbody>
        </table></div>
      </section>
    </div>
  );
}
