'use client';
import { useState } from 'react';
import { useTeam } from '../../lib/data';
import type { Profile } from '../../lib/types';
import { fullName } from '../../lib/util';
import { Empty, PageTitle, Tag } from './ui';

export default function Admin() {
  const { sb, me, profiles, members, reload } = useTeam();
  const [err, setErr] = useState('');
  const pending = profiles.filter(p => !p.approved);
  const approved = profiles.filter(p => p.approved);
  const linkedIds = new Set(profiles.map(p => p.member_id).filter(Boolean));

  async function update(p: Profile, change: Partial<Profile>) {
    setErr('');
    if (p.id === me.id && (change.role === 'shooter' || change.approved === false)) {
      if (!confirm('This removes your own staff access. Continue?')) return;
    }
    const { error } = await sb.from('profiles').update(change).eq('id', p.id);
    if (error) setErr(error.message); else await reload();
  }
  async function remove(p: Profile) {
    if (!confirm(`Deny and remove the access request from ${p.email}?`)) return;
    const { error } = await sb.from('profiles').delete().eq('id', p.id);
    if (error) setErr(error.message); else await reload();
  }

  const row = (p: Profile) => {
    const guess = members.find(m => !linkedIds.has(m.id) && (p.display_name ?? '').toLowerCase().includes(m.last_name.toLowerCase()));
    return (
      <div className="approvalCard" key={p.id}>
        <div className="grow">
          <strong>{p.display_name || p.email}</strong>
          <p>{p.email}</p>
          <small>Requested {new Date(p.created_at).toLocaleDateString()}</small>
        </div>
        <div className="approvalActions">
          <label>Roster entry
            <select value={p.member_id ?? ''} onChange={e => update(p, { member_id: e.target.value || null })}>
              <option value="">{guess ? `Not linked (maybe ${fullName(guess)}?)` : 'Not linked'}</option>
              {members.filter(m => !linkedIds.has(m.id) || m.id === p.member_id).map(m => <option key={m.id} value={m.id}>{fullName(m)}</option>)}
            </select>
          </label>
          <label>Access
            <select value={p.role} onChange={e => update(p, { role: e.target.value as Profile['role'] })}>
              <option value="shooter">Shooter</option><option value="staff">Staff</option>
            </select>
          </label>
          {p.approved
            ? <button className="secondary" onClick={() => update(p, { approved: false })}>Revoke</button>
            : <><button className="primary" onClick={() => update(p, { approved: true, member_id: p.member_id ?? guess?.id ?? null })}>Approve</button><button className="secondary" onClick={() => remove(p)}>Deny</button></>}
        </div>
      </div>
    );
  };

  return (
    <div>
      <PageTitle eyebrow="STAFF ONLY" title="Access">
        Approve sign-ups and link each login to a roster entry. Shooters can see the calendar, roster, scores and their own quals; staff can edit everything.
      </PageTitle>
      {err && <p className="alert">{err}</p>}
      <section className="panel">
        <div className="sectionTitle"><h2>Waiting for approval</h2><Tag tone={pending.length ? 'warn' : 'neutral'}>{pending.length}</Tag></div>
        {pending.length === 0 ? <Empty title="No pending requests">Send teammates the site link and have them choose “Request access”.</Empty> : pending.map(row)}
      </section>
      <section className="panel">
        <div className="sectionTitle"><h2>Approved accounts</h2><Tag>{approved.length}</Tag></div>
        {approved.map(row)}
      </section>
    </div>
  );
}
