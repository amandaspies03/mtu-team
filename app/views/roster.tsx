'use client';
import { useMemo, useState } from 'react';
import { Download, Plus, Search } from 'lucide-react';
import { useTeam } from '../../lib/data';
import { TEAM_STATUSES } from '../../lib/types';
import { downloadCsv, expiryState, fiscalYear, fullName, milDate, todayISO } from '../../lib/util';
import { go } from '../app-shell';
import { MemberForm } from './member-form';
import { ExpiryTag, PageTitle, Tag } from './ui';

const statusTone = { Active: 'good', New: 'info', Tryout: 'brass', Reserve: 'neutral', Alumni: 'neutral' } as const;

export default function Roster() {
  const { isStaff, members, compliance, attendance, events } = useTeam();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('current');
  const [adding, setAdding] = useState(false);
  const today = todayISO();
  const fy = fiscalYear(today);

  const rows = useMemo(() => members
    .filter(m => status === 'all' || (status === 'current' ? ['Active', 'New', 'Tryout'].includes(m.team_status) : m.team_status === status))
    .filter(m => !q || `${m.last_name} ${m.first_name ?? ''} ${m.rank ?? ''} ${m.unit ?? ''} ${m.staff_role ?? ''}`.toLowerCase().includes(q.toLowerCase()))
    .map(m => {
      const c = compliance.find(x => x.member_id === m.id);
      const att = attendance.filter(a => a.member_id === m.id && a.status === 'attended').map(a => events.find(e => e.id === a.event_id)).filter(Boolean);
      const last = att.map(e => e!.start_date).sort().pop();
      const fyCount = att.filter(e => fiscalYear(e!.start_date) === fy).length;
      return { m, c, last, fyCount };
    }), [members, compliance, attendance, events, q, status, fy]);

  function exportCsv() {
    downloadCsv(`MTU roster ${today}.csv`, [
      ['Last', 'First', 'Rank', 'Unit', 'Duty status', 'Team status', 'Staff role', 'Email', 'Phone', 'Handgun qual exp', 'Rifle qual exp', 'DD2760', 'Van license', `FY${String(fy).slice(2)} practices`, 'Last practice'],
      ...rows.map(({ m, c, last, fyCount }) => [m.last_name, m.first_name, m.rank, m.unit, m.duty_status, m.team_status, m.staff_role, m.email, m.phone, c?.handgun_qual_exp, c?.rifle_qual_exp, c?.lautenberg_date, c?.gov_license ? 'Y' : '', fyCount, last]),
    ]);
  }

  return (
    <div>
      <PageTitle eyebrow="TEAM" title="Roster"
        actions={isStaff && <><button className="secondary" onClick={exportCsv}><Download size={15} /> Export CSV</button><button className="primary" onClick={() => setAdding(true)}><Plus size={15} /> Add shooter</button></>}>
        {isStaff ? 'Everyone who has shot with the team. Qual dates come from each shooter’s AF 522.' : 'Your teammates. Contact info is for team coordination only.'}
      </PageTitle>
      <div className="filters">
        <label className="search"><Search size={16} /><input placeholder="Search name, rank, unit…" value={q} onChange={e => setQ(e.target.value)} /></label>
        <label><select value={status} onChange={e => setStatus(e.target.value)}>
          <option value="current">Current (Active, New, Tryout)</option>
          {TEAM_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          <option value="all">Everyone</option>
        </select></label>
        <span className="formNote">{rows.length} shown</span>
      </div>
      <div className="tableWrap"><table className="roster">
        <thead><tr><th>Name</th><th>Rank</th><th>Unit</th><th>Status</th>{isStaff && <><th>Handgun qual</th><th>Rifle qual</th></>}<th className="num">FY{String(fy).slice(2)}</th><th>Last seen</th></tr></thead>
        <tbody>
          {rows.map(({ m, c, last, fyCount }) => (
            <tr key={m.id} onClick={() => go('member', m.id)} className="clickable">
              <td><a href={`#member/${m.id}`} onClick={e => e.stopPropagation()}><strong>{fullName(m)}</strong></a>{m.staff_role && <small className="sub">{m.staff_role}</small>}</td>
              <td>{m.rank ?? '—'}</td>
              <td>{m.unit ?? '—'}</td>
              <td><Tag tone={statusTone[m.team_status]}>{m.team_status}</Tag></td>
              {isStaff && <>
                <td><ExpiryTag date={c?.handgun_qual_exp ?? null} state={expiryState(c?.handgun_qual_exp)} /></td>
                <td><ExpiryTag date={c?.rifle_qual_exp ?? null} state={expiryState(c?.rifle_qual_exp)} /></td>
              </>}
              <td className="num">{fyCount || '—'}</td>
              <td>{milDate(last)}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
      {adding && <MemberForm onClose={() => setAdding(false)} onSaved={id => go('member', id)} />}
    </div>
  );
}
