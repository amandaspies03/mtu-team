'use client';
import { useState } from 'react';
import { Copy, Link2, Plus, Trash2 } from 'lucide-react';
import { useTeam } from '../../lib/data';
import type { Invite, Member, Profile } from '../../lib/types';
import { fullName, milDate } from '../../lib/util';
import { Empty, PageTitle, Tag } from './ui';
import ChangeLog from './changelog';
import Backups from './backups';
import Ranges from './ranges-admin';

const inviteUrl = (i: Invite) => `${window.location.origin}/?invite=${i.token}`;
const isOpen = (i: Invite) => !i.multi_use && !i.used_at && new Date(i.expires_at) > new Date();
const day = (iso: string) => milDate(iso.slice(0, 10));

function Access() {
  const { sb, me, profiles, members, staffEmails, invites, reload } = useTeam();
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState('');
  const [note, setNote] = useState('');
  const [forMember, setForMember] = useState('');
  const [newStaff, setNewStaff] = useState('');
  const [staffMember, setStaffMember] = useState('');
  const [byEmail, setByEmail] = useState(false);
  const [justMade, setJustMade] = useState<Invite | null>(null);

  const linkedIds = new Set(profiles.map(p => p.member_id).filter(Boolean));
  const staffSet = new Set(staffEmails.map(s => s.email));
  const openInvites = invites.filter(isOpen);
  const closedInvites = invites.filter(i => !i.multi_use && !isOpen(i));
  const pending = profiles.filter(p => p.pending && !p.approved);

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

  async function approve(p: Profile, memberId: string) {
    await run(sb.rpc('approve_signup', { p_profile: p.id, p_member: memberId || null }));
  }
  async function reject(p: Profile) {
    if (!confirm(`Reject the sign-up from ${p.email}? They won’t get access. (You can send them an individual invite later.)`)) return;
    await run(sb.from('profiles').delete().eq('id', p.id));
  }

  /** The email a roster member signs in with: their account's email, or their roster personal email if they have no account yet. */
  const signInEmail = (m: Member) => {
    const acct = profiles.find(p => p.member_id === m.id);
    return { email: (acct?.email ?? m.personal_email ?? '').trim().toLowerCase(), hasAccount: !!acct };
  };
  const staffMemberIds = new Set(members.filter(m => { const e = signInEmail(m).email; return e && staffSet.has(e); }).map(m => m.id));
  const staffCandidates = members.filter(m => m.team_status !== 'Inactive' && !staffMemberIds.has(m.id)).sort((a, b) => fullName(a).localeCompare(fullName(b)));
  const picked = members.find(m => m.id === staffMember);
  const pickedEmail = picked ? signInEmail(picked) : null;

  async function addStaff(e: React.FormEvent) {
    e.preventDefault();
    if (byEmail) {
      const email = newStaff.trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(email)) { setErr('Enter a valid email address.'); return; }
      if (await run(sb.from('staff_emails').insert({ email, added_by: me.id }))) setNewStaff('');
      return;
    }
    if (!picked || !pickedEmail) { setErr('Choose someone from the roster.'); return; }
    if (!pickedEmail.email) { setErr(`${fullName(picked)} has no account and no personal email on the roster. Add their personal email on their roster page first, or add them by email.`); return; }
    if (!confirm(`Give ${fullName(picked)} staff access? They’ll be able to see and edit the roster, scores, events and admin settings.`)) return;
    if (await run(sb.from('staff_emails').insert({ email: pickedEmail.email, added_by: me.id }))) setStaffMember('');
  }
  const staffName = (email: string) => {
    const acct = profiles.find(p => (p.email ?? '').toLowerCase() === email);
    const m = members.find(x => (acct?.member_id && x.id === acct.member_id) || (!acct && (x.personal_email ?? '').toLowerCase() === email));
    return m ? fullName(m) : acct?.display_name || email;
  };
  async function removeStaff(email: string) {
    const self = email === (me.email ?? '').toLowerCase();
    if (staffEmails.length === 1) { setErr('The team needs at least one staff email.'); return; }
    const who = staffName(email);
    if (!confirm(self ? 'Remove yourself from staff? You will lose staff access immediately and become a shooter.' : `Make ${who} a shooter? They lose staff access right away; their account, roster entry and scores stay.`)) return;
    await run(sb.from('staff_emails').delete().eq('email', email));
  }
  async function setAccess(p: Profile, approved: boolean) {
    if (!approved && !confirm(`Turn off access for ${p.email}? They won't be able to see the team site until you turn it back on.`)) return;
    await run(sb.from('profiles').update({ approved }).eq('id', p.id));
  }

  return (
    <div>
      <p className="formNote tabIntro">Anyone can create an account from the sign-in page. Staff-list emails get staff access right away; everyone else waits in “Waiting for approval.” When you approve someone they’re linked to their roster entry (matched by email, then cell phone, then name — what they entered replaces the roster’s info; anything they left blank stays as is), or added as a new shooter. Individual invite links skip the approval step.</p>
      {err && <p className="alert">{err}</p>}

      {pending.length > 0 && (
        <section className="panel attention">
          <div className="sectionTitle"><h2>Waiting for approval</h2><Tag tone="warn">{pending.length}</Tag></div>
          <p className="formNote">These people created an account on the site. Approve the ones you recognize. Approving links them to their roster entry and updates it with what they entered (blanks keep your info), or adds them as a new shooter, then lets them in.</p>
          {pending.map(p => <PendingCard key={p.id} p={p} onApprove={approve} onReject={reject} />)}
        </section>
      )}

      <section className="panel">
        <div className="sectionTitle"><h2>Invite a shooter (skips approval)</h2></div>
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
        <div className="sectionTitle"><h2>Staff</h2><Tag>{staffEmails.length}</Tag></div>
        <p className="formNote">Staff can see and edit everything, including this page. Pick someone from the roster to make them staff; use “Make shooter” to take it away. Their account, roster entry and scores don’t change either way.</p>
        {staffEmails.map(s => {
          const acct = profiles.find(p => (p.email ?? '').toLowerCase() === s.email);
          const name = staffName(s.email);
          return (
            <div key={s.email} className="listRow static staffRow">
              <div className="grow"><strong>{name}</strong><small>{name !== s.email ? `${s.email} · ` : ''}{acct ? 'Signed up' : 'No account yet — staff once they sign up with this email'}</small></div>
              <button className="secondary" aria-label={`Make ${name} a shooter`} onClick={() => removeStaff(s.email)}>Make shooter</button>
            </div>
          );
        })}
        <form className="addStaff" onSubmit={addStaff}>
          {!byEmail ? (
            <>
              <label>Add staff from the roster
                <select value={staffMember} onChange={e => { setStaffMember(e.target.value); setErr(''); }}>
                  <option value="">Choose a team member…</option>
                  {staffCandidates.map(m => <option key={m.id} value={m.id}>{fullName(m)}</option>)}
                </select>
              </label>
              {picked && pickedEmail && (
                <p className="formNote">{pickedEmail.email
                  ? (pickedEmail.hasAccount ? `Staff access goes to their account (${pickedEmail.email}) right away.` : `No account yet. They’ll get staff access when they sign up with ${pickedEmail.email}.`)
                  : 'No account and no personal email on the roster yet — add their personal email on their roster page first.'}</p>
              )}
              <div className="row"><button className="primary" disabled={!picked || !pickedEmail?.email}><Plus size={15} /> Make staff</button>
                <button type="button" className="linkBtn" onClick={() => { setByEmail(true); setErr(''); }}>Not on the roster? Add by email</button></div>
            </>
          ) : (
            <>
              <label>Add staff by email <span className="muted">(the email they sign in with)</span>
                <input type="email" value={newStaff} onChange={e => setNewStaff(e.target.value)} placeholder="name@example.com" />
              </label>
              <div className="row"><button className="primary"><Plus size={15} /> Make staff</button>
                <button type="button" className="linkBtn" onClick={() => { setByEmail(false); setErr(''); }}>Pick from the roster instead</button></div>
            </>
          )}
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
  const target = open.find(m => m.id === memberId);
  const FIELDS: [string, string, keyof Member][] = [
    ['rank', 'Rank', 'rank'], ['first_name', 'First name', 'first_name'], ['last_name', 'Last name', 'last_name'], ['unit', 'Unit', 'unit'],
    ['duty_status', 'Duty status', 'duty_status'], ['cell_phone', 'Cell phone', 'cell_phone'], ['mil_email', 'Military email', 'mil_email'], ['personal_email', 'Personal email', 'personal_email'],
  ];
  // What approving will change on the roster entry: their non-blank answers replace the roster's.
  const changes = target ? FIELDS.filter(([k, , mk]) => (info[k] ?? '').trim() && norm(info[k]) !== norm(target[mk] as string | null)).map(([k, label, mk]) => ({ label, from: (target[mk] as string | null) || '—', to: info[k] })) : [];
  return (
    <div className="approvalCard">
      <div className="grow">
        <strong>{[info.rank, info.first_name, info.last_name].filter(Boolean).join(' ') || p.display_name}</strong>
        <p>{p.email}</p>
        <small className="sub">{[info.unit, info.duty_status, info.cell_phone, info.mil_email, info.personal_email].filter(Boolean).join(' · ')}</small>
        {target && (changes.length
          ? <ul className="changeList"><li className="formNote">Approving updates the roster:</li>{changes.map(c => <li key={c.label}><b>{c.label}:</b> <s>{c.from}</s> → {c.to}</li>)}</ul>
          : <small className="sub">Matches the roster. Nothing will change.</small>)}
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
