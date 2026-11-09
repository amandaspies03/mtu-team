'use client';
import { useMemo, useState } from 'react';
import { Download, Mail, Plus, Search } from 'lucide-react';
import { useTeam } from '../../lib/data';
import { TEAM_STATUSES } from '../../lib/types';
import { downloadCsv, fiscalYear, fullName, milDate, todayISO } from '../../lib/util';
import { go } from '../app-shell';
import { MemberForm } from './member-form';
import { WeaponSelect } from './weapon-select';
import { AwardsSelect } from './awards-select';
import { EmailComposer } from './email';
import { PageTitle, Tag } from './ui';

const statusTone = { Active: 'good', New: 'info', Tryout: 'brass', Inactive: 'neutral' } as const;

export default function Roster() {
  const { isStaff, members, compliance, attendance, events } = useTeam();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('current');
  const inactiveCount = members.filter(m => m.team_status === 'Inactive').length;
  const [adding, setAdding] = useState(false);
  const [emailing, setEmailing] = useState(false);
  const today = todayISO();
  const fy = fiscalYear(today);

  const rows = useMemo(() => members
    .filter(m => status === 'all' || (status === 'current' ? ['Active', 'New', 'Tryout'].includes(m.team_status) : m.team_status === status))
    .filter(m => !q || `${m.last_name} ${m.first_name ?? ''} ${m.rank ?? ''} ${m.unit ?? ''} ${m.staff_role ?? ''} ${m.mil_email ?? ''} ${m.personal_email ?? ''} ${m.cell_phone ?? ''}`.toLowerCase().includes(q.toLowerCase()))
    .map(m => {
      const c = compliance.find(x => x.member_id === m.id);
      const att = attendance.filter(a => a.member_id === m.id && a.status === 'attended').map(a => events.find(e => e.id === a.event_id)).filter(Boolean);
      const last = att.map(e => e!.start_date).sort().pop();
      const fyCount = att.filter(e => fiscalYear(e!.start_date) === fy).length;
      return { m, c, last, fyCount };
    }), [members, compliance, attendance, events, q, status, fy]);

  function exportCsv() {
    downloadCsv(`MTU roster ${today}.csv`, [
      ['Last', 'First', 'Rank', 'Unit', 'Duty status', 'Team status', 'Staff role', 'Pistol #', 'Rifle #', 'Gov 20 pistol', 'Gov 20 rifle', 'EIC pistol', 'EIC rifle', "Chief's 50", 'Cell phone', 'Military email', 'Personal email', 'DD2760', 'Van license', `FY${String(fy).slice(2)} practices`, 'Last practice'],
      ...rows.map(({ m, c, last, fyCount }) => [m.last_name, m.first_name, m.rank, m.unit, m.duty_status, m.team_status, m.staff_role, m.pistol_no, m.rifle_no, m.gov20_pistol ? 'Y' : '', m.gov20_rifle ? 'Y' : '', m.eic_pistol ?? '', m.eic_rifle ?? '', m.chiefs50 ? 'Y' : '', m.cell_phone, m.mil_email, m.personal_email, c?.lautenberg_date, c?.gov_license ? 'Y' : '', fyCount, last]),
    ]);
  }

  return (
    <div>
      <PageTitle eyebrow="TEAM" title="Roster"
        actions={isStaff && <><button className="secondary" onClick={() => setEmailing(true)}><Mail size={15} /> Email team</button><button className="secondary" onClick={exportCsv}><Download size={15} /> Export CSV</button><button className="primary" onClick={() => setAdding(true)}><Plus size={15} /> Add shooter</button></>}>
        Everyone on the team. Contact info is for team coordination only.
      </PageTitle>
      <div className="filters">
        <label className="search"><Search size={16} /><input placeholder="Search name, rank, unit…" value={q} onChange={e => setQ(e.target.value)} /></label>
        <label><select value={status} onChange={e => setStatus(e.target.value)}>
          <option value="current">All except inactive</option>
          {TEAM_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          <option value="all">Everyone, including inactive</option>
        </select></label>
        <span className="formNote">{rows.length} shown{status === 'current' && inactiveCount > 0 && <> · {inactiveCount} inactive hidden <button className="linkBtn" onClick={() => setStatus('Inactive')}>Show inactive</button></>}</span>
      </div>
      <div className="tableWrap"><table className="roster">
        <thead><tr><th>Name</th><th>Rank</th><th>Unit</th><th>Status</th><th>Pistol #</th><th>Rifle #</th><th>Awards</th><th>Cell phone</th><th>Military email</th><th>Personal email</th><th className="num">FY{String(fy).slice(2)}</th><th>Last seen</th></tr></thead>
        <tbody>
          {rows.map(({ m, c, last, fyCount }) => (
            <tr key={m.id} onClick={() => go('member', m.id)} className="clickable">
              <td><a href={`#member/${m.id}`} onClick={e => e.stopPropagation()}><strong>{fullName(m)}</strong></a>{m.staff_role && <small className="sub">{m.staff_role}</small>}</td>
              <td>{m.rank ?? '—'}</td>
              <td>{m.unit ?? '—'}</td>
              <td><Tag tone={statusTone[m.team_status]}>{m.team_status}</Tag></td>
              <td><WeaponSelect member={m} kind="pistol" /></td>
              <td><WeaponSelect member={m} kind="rifle" /></td>
              <td><AwardsSelect member={m} /></td>
              <td className="nowrap">{m.cell_phone ? <a href={`tel:${m.cell_phone}`} onClick={e => e.stopPropagation()}>{m.cell_phone}</a> : '—'}</td>
              <td>{m.mil_email ? <a href={`mailto:${m.mil_email}`} onClick={e => e.stopPropagation()}>{m.mil_email}</a> : '—'}</td>
              <td>{m.personal_email ? <a href={`mailto:${m.personal_email}`} onClick={e => e.stopPropagation()}>{m.personal_email}</a> : '—'}</td>
              <td className="num">{fyCount || '—'}</td>
              <td>{milDate(last)}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
      {emailing && <EmailComposer onClose={() => setEmailing(false)} />}
      {adding && <MemberForm onClose={() => setAdding(false)} onSaved={id => go('member', id)} />}
    </div>
  );
}
