'use client';
import { useState } from 'react';
import { Copy, Link2, Plus, Trash2 } from 'lucide-react';
import { useTeam } from '../../lib/data';
import type { Invite, Profile } from '../../lib/types';
import { fullName, milDate } from '../../lib/util';
import { Empty, PageTitle, Tag } from './ui';
import ChangeLog from './changelog';
import Backups from './backups';
import Ranges from './ranges-admin';

const inviteUrl = (i: Invite) => `${window.location.origin}/#invite/${i.token}`;
const isOpen = (i: Invite) => !i.multi_use && !i.used_at && new Date(i.expires_at) > new Date();
const teamLive = (i: Invite) => !!i.multi_use && new Date(i.expires_at) > new Date();
const day = (iso: string) => milDate(iso.slice(0, 10));

function Access() {
  const { sb, me, profiles, members, staffEmails, invites, reload } = useTeam();
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState('');
  const [note, setNote] = useState('');
  const [forMember, setForMember] = useState('');
  const [newStaff, setNewStaff] = useState('');
  const [justMade, setJustMade] = useState<Invite | null>(null);

  const linkedIds = new Set(profiles.map(p => p.member_id).filter(Boolean));
  const staffSet = new Set(staffEmails.map(s => s.email));
  const openInvites = invites.filter(isOpen);
  const closedInvites = invites.filter(i => !i.multi_use && !isOpen(i));
  const teamLinks = invites.filter(teamLive);
  const pending = profiles.filter(p => p.pending && !p.approved);
  const [teamDays, setTeamDays] = useState('7');

  const run = async (p: PromiseLike<{ error: { message: string } | null }>) => {
    setErr('');
    const { error } = await p;
    if (error) setErr(error.message); else await reload();
    return !error;
  };
  const copy = (key: string, text: string) => navigator.clipboard.writeText(text).then(() => { setCopied(key); setTimeout(() => setCopied(''), 2000); });

  async function createInvite(e: React.FormEvent) {
    e.preventDefault(); setErr('');
    const { data, error } = await sb.from('invites').insert({ note: note.trim() || null, member_id: forMember || null, created_by: me.id }).select('*').single();
    if (error) { setErr(error.message); return; }
    setJustMade(data as Invite); setNote(''); setForMember('');
    await reload();
    copy(data.id, inviteUrl(data as Invite));
  }

  async function createTeamLink() {
    setErr('');
    const expires = new Date(Date.now() + Number(teamDays) * 86400000).toISOString();
    const { data, error } = await sb.from('invites').insert({ note: 'Team link', multi_use: true, expires_at: expires, created_by: me.id }).select('*').single();
    if (error) { setErr(error.message); return; }
    await reload();
    copy(data.id, inviteUrl(data as Invite));
  }
  async function turnOffTeamLink(i: Invite) {
    if (!confirm('Turn off this team link? Anyone who hasn’t signed up yet will need a new link.')) return;
    await run(sb.from('invites').update({ expires_at: new Date().toISOString() }).eq('id', i.id));
  }
  async function approve(p: Profile, memberId: string) {
    await run(sb.rpc('approve_signup', { p_profile: p.id, p_member: memberId || null }));
  }
  async function reject(p: Profile) {
    if (!confirm(`Reject the sign-up from ${p.email}? They won’t get access. (You can send them an individual invite later.)`)) return;
    await run(sb.from('profiles').delete().eq('id', p.id));
  }

  async function addStaff(e: React.FormEvent) {
    e.preventDefault();
    const email = newStaff.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) { setErr('Enter a valid email address.'); return; }
    if (await run(sb.from('staff_emails').insert({ email, added_by: me.id }))) setNewStaff('');
  }
  async function removeStaff(email: string) {
    const self = email === (me.email ?? '').toLowerCase();
    if (staffEmails.length === 1) { setErr('The team needs at least one staff email.'); return; }
    if (!confirm(self ? 'Remove yourself from staff? You will lose staff access immediately.' : `Remove ${email} from staff? If they have an account it becomes a regular shooter account.`)) return;
    await run(sb.from('staff_emails').delete().eq('email', email));
  }
  async function setAccess(p: Profile, approved: boolean) {
    if (!approved && !confirm(`Turn off access for ${p.email}? They won't be able to see the team site until you turn it back on.`)) return;
    await run(sb.from('profiles').update({ approved }).eq('id', p.id));
  }

  return (
    <div>
      <p className="formNote tabIntro">Shooters join through invite links; staff sign up with an email on the staff list. If the person is already on the roster (matched by email, then cell phone, then name) their account links to that entry and only fills in blanks; otherwise they’re added as a new shooter.</p>
      {err && <p className="alert">{err}</p>}

      {pending.length > 0 && (
        <section className="panel attention">
          <div className="sectionTitle"><h2>Waiting for approval</h2><Tag tone="warn">{pending.length}</Tag></div>
          <p className="formNote">These people signed up with the team link. Approve the ones you recognize. Approving adds them to the roster (or links them to their existing entry) and lets them in.</p>
          {pending.map(p => <PendingCard key={p.id} p={p} onApprove={approve} onReject={reject} />)}
        </section>
      )}

      <section className="panel">
        <div className="sectionTitle"><h2>Team invite link</h2></div>
        <p className="formNote">One link for the whole team — post it in the MTU GroupMe. Anyone who uses it waits in “Waiting for approval” until staff let them in.</p>
        {teamLinks.length === 0 ? (
          <div className="row">
            <label className="inlineLabel">Works for<select value={teamDays} onChange={e => setTeamDays(e.target.value)}>
              <option value="3">3 days</option><option value="7">7 days</option><option value="14">14 days</option><option value="30">30 days</option>
            </select></label>
            <button className="primary" onClick={createTeamLink}><Link2 size={15} /> Create team link</button>
          </div>
        ) : teamLinks.map(i => (
          <div key={i.id} className="teamLink">
            <code>{inviteUrl(i)}</code>
            <div className="row">
              <span className="formNote">Expires {day(i.expires_at)} · used {i.use_count ?? 0} time{(i.use_count ?? 0) === 1 ? '' : 's'}</span>
              <button className="secondary" onClick={() => copy(i.id, inviteUrl(i))}><Copy size={14} /> {copied === i.id ? 'Copied' : 'Copy link'}</button>
              <button className="secondary danger" onClick={() => turnOffTeamLink(i)}>Turn off</button>
            </div>
          </div>
        ))}
      </section>

      <section className="panel">
        <div className="sectionTitle"><h2>Invite a shooter</h2></div>
        <form className="formGrid three" onSubmit={createInvite}>
          <label>Who is it for? <span>Just a note for staff</span><input value={note} onChange={e => setNote(e.target.value)} placeholder="SrA Jones, 161 IS" /></label>
          <label>Already on the roster? <span>Optional. Sign-ups are matched to the roster automatically by email, phone or name</span>
            <select value={forMember} onChange={e => setForMember(e.target.value)}>
              <option value="">No, add them as a new shooter</option>
              {members.filter(m => !linkedIds.has(m.id)).map(m => <option key={m.id} value={m.id}>{fullName(m)}</option>)}
            </select>
          </label>
          <div className="formActions"><button className="primary"><Plus size={15} /> Create invite link</button></div>
        </form>
        {justMade && (
          <div className="success inviteMade">
            <span>Link copied. It works once and expires {day(justMade.expires_at)}.</span>
            <code>{inviteUrl(justMade)}</code>
          </div>
        )}
        <h3 className="subhead">Open invites</h3>
        {openInvites.length === 0 ? <p className="formNote">No open invites.</p> : openInvites.map(i => (
          <div key={i.id} className="listRow static">
            <Link2 size={16} />
            <div className="grow"><strong>{i.note || 'Invite'}</strong><small>Created {day(i.created_at)} · expires {day(i.expires_at)}{i.member_id ? ` · fills in ${fullName(members.find(m => m.id === i.member_id))}` : ''}</small></div>
            <button className="secondary" onClick={() => copy(i.id, inviteUrl(i))}><Copy size={14} /> {copied === i.id ? 'Copied' : 'Copy link'}</button>
            <button className="iconBtn" aria-label="Cancel invite" onClick={() => run(sb.from('invites').delete().eq('id', i.id))}><Trash2 size={14} /></button>
          </div>
        ))}
        {closedInvites.length > 0 && (
          <details><summary>Used and expired invites ({closedInvites.length})</summary>
            {closedInvites.map(i => {
              const who = profiles.find(p => p.id === i.used_by);
              return (
                <div key={i.id} className="listRow static">
                  <div className="grow"><strong>{i.note || 'Invite'}</strong><small>{i.used_at ? `Used ${day(i.used_at)}${who ? ` by ${who.display_name || who.email}` : ''}` : `Expired ${day(i.expires_at)}`}</small></div>
                  <button className="iconBtn" aria-label="Delete invite record" onClick={() => run(sb.from('invites').delete().eq('id', i.id))}><Trash2 size={14} /></button>
                </div>
              );
            })}
          </details>
        )}
      </section>

      <section className="panel">
        <div className="sectionTitle"><h2>Staff list</h2><Tag>{staffEmails.length}</Tag></div>
        <p className="formNote">Only these emails can create an account without an invite, and only they get staff access. Use the exact email each person will sign in with.</p>
        {staffEmails.map(s => {
          const acct = profiles.find(p => (p.email ?? '').toLowerCase() === s.email);
          return (
            <div key={s.email} className="listRow static">
              <div className="grow"><strong>{s.email}</strong><small>{acct ? `Account created · ${acct.display_name || ''}` : 'No account yet'}</small></div>
              <button className="iconBtn" aria-label={`Remove ${s.email} from staff`} onClick={() => removeStaff(s.email)}><Trash2 size={14} /></button>
            </div>
          );
        })}
        <form className="inlineForm" onSubmit={addStaff}>
          <input type="email" value={newStaff} onChange={e => setNewStaff(e.target.value)} placeholder="name@example.com" />
          <button className="secondary"><Plus size={15} /> Add staff</button>
        </form>
      </section>

      <section className="panel">
        <div className="sectionTitle"><h2>Accounts</h2><Tag>{profiles.length}</Tag></div>
        {profiles.length === 0 ? <Empty title="No accounts yet" /> : profiles.map(p => {
          const staff = staffSet.has((p.email ?? '').toLowerCase());
          return (
            <div key={p.id} className="approvalCard">
              <div className="grow">
                <strong>{p.display_name || p.email}</strong>
                <p>{p.email}</p>
                <div className="row"><Tag tone={staff ? 'brass' : 'neutral'}>{staff ? 'Staff' : 'Shooter'}</Tag>{!p.approved && <Tag tone="bad">Access off</Tag>}</div>
              </div>
              <div className="approvalActions">
                <label>Roster entry
                  <select value={p.member_id ?? ''} onChange={e => run(sb.from('profiles').update({ member_id: e.target.value || null }).eq('id', p.id))}>
                    <option value="">Not linked</option>
                    {members.filter(m => !linkedIds.has(m.id) || m.id === p.member_id).map(m => <option key={m.id} value={m.id}>{fullName(m)}</option>)}
                  </select>
                </label>
                {p.id !== me.id && (p.approved
                  ? <button className="secondary" onClick={() => setAccess(p, false)}>Turn off access</button>
                  : <button className="primary" onClick={() => setAccess(p, true)}>Turn on access</button>)}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}

function PendingCard({ p, onApprove, onReject }: { p: Profile; onApprove: (p: Profile, memberId: string) => void; onReject: (p: Profile) => void }) {
  const { members, profiles } = useTeam();
  const info = p.pending_info ?? {};
  const linked = new Set(profiles.map(x => x.member_id).filter(Boolean));
  const open = members.filter(m => !linked.has(m.id));
  const norm = (v?: string | null) => (v ?? '').trim().toLowerCase();
  const digits = (v?: string | null) => (v ?? '').replace(/\D/g, '');
  // Same order the server uses: email, then phone, then first + last name.
  const guess = open.find(m => [norm(p.email), norm(info.mil_email), norm(info.personal_email)].filter(Boolean).some(e => e === norm(m.mil_email) || e === norm(m.personal_email)))
    ?? (digits(info.cell_phone) ? open.find(m => digits(m.cell_phone) === digits(info.cell_phone)) : undefined)
    ?? open.find(m => norm(m.last_name) === norm(info.last_name) && norm(m.first_name) === norm(info.first_name));
  const [memberId, setMemberId] = useState(guess?.id ?? '');
  return (
    <div className="approvalCard">
      <div className="grow">
        <strong>{[info.rank, info.first_name, info.last_name].filter(Boolean).join(' ') || p.display_name}</strong>
        <p>{p.email}</p>
        <small className="sub">{[info.unit, info.duty_status, info.cell_phone, info.mil_email, info.personal_email].filter(Boolean).join(' · ')}</small>
      </div>
      <div className="approvalActions">
        <label>Roster entry
          <select value={memberId} onChange={e => setMemberId(e.target.value)}>
            <option value="">Add as a new shooter</option>
            {open.map(m => <option key={m.id} value={m.id}>{fullName(m)}{m.id === guess?.id ? ' (match)' : ''}</option>)}
          </select>
        </label>
        <button className="primary" onClick={() => onApprove(p, memberId)}>Approve</button>
        <button className="secondary danger" onClick={() => onReject(p)}>Reject</button>
      </div>
    </div>
  );
}

export default function Admin() {
  const [tab, setTab] = useState<'access' | 'ranges' | 'log' | 'backups'>('access');
  return (
    <div>
      <PageTitle eyebrow="STAFF ONLY" title="Admin">Who can get in, what’s changed, and backups of the team’s data.</PageTitle>
      <div className="tabs">
        <button className={tab === 'access' ? 'on' : ''} onClick={() => setTab('access')}>Access</button>
        <button className={tab === 'ranges' ? 'on' : ''} onClick={() => setTab('ranges')}>Ranges</button>
        <button className={tab === 'log' ? 'on' : ''} onClick={() => setTab('log')}>Change log</button>
        <button className={tab === 'backups' ? 'on' : ''} onClick={() => setTab('backups')}>Backups</button>
      </div>
      {tab === 'access' && <Access />}
      {tab === 'ranges' && <Ranges />}
      {tab === 'log' && <ChangeLog />}
      {tab === 'backups' && <Backups />}
    </div>
  );
}
