'use client';
import { AwardsSelect } from './awards-select';
import { useState } from 'react';
import { ArrowLeft, Mail, Pencil, Phone, Trash2 } from 'lucide-react';
import { useTeam } from '../../lib/data';
import { displayName, eventRange, expiryState, formatPhone, kindLabel, milDate, PHONE_PATTERN, scoreText } from '../../lib/util';
import { go } from '../app-shell';
import { ComplianceForm, MemberForm } from './member-form';
import { Empty, ExpiryTag, Modal, Sparkline, Tag } from './ui';

export default function MemberView({ id }: { id: string }) {
  const { sb, isStaff, realStaff, setPreviewShooter, openTour, me, memberById, compliance, attendance, events, scores, courses, profiles, reload } = useTeam();
  const m = memberById(id);
  const [editContact, setEditContact] = useState(false);
  const [editing, setEditing] = useState(false), [editComp, setEditComp] = useState(false), [deleting, setDeleting] = useState(false), [err, setErr] = useState('');
  if (!m) return <Empty title="Shooter not found"><button className="linkBtn" onClick={() => go('roster')}>Back to roster</button></Empty>;
  const isMe = me.member_id === m.id;
  const c = compliance.find(x => x.member_id === m.id);
  const att = attendance.filter(a => a.member_id === m.id)
    .map(a => ({ a, e: events.find(e => e.id === a.event_id)! })).filter(x => x.e)
    .sort((x, y) => (y.e.start_date > x.e.start_date ? 1 : -1));
  const mine = scores.filter(s => s.member_id === m.id);
  const byCourse = courses.map(co => {
    const list = mine.filter(s => s.course_code === co.code);
    const totals = list.filter(s => s.total != null);
    const best = totals.reduce<typeof totals[number] | null>((b, s) => (!b || s.total! > b.total! || (s.total === b.total && (s.x_count ?? 0) > (b.x_count ?? 0)) ? s : b), null);
    const dated = totals.filter(s => s.shot_on);
    const avg = totals.length ? totals.reduce((t, s) => t + Number(s.total), 0) / totals.length : null;
    return { co, list, best, avg, trend: dated.map(s => Number(s.total)) };
  }).filter(x => x.list.length);
  const linked = profiles.find(p => p.member_id === m.id);

  async function remove() {
    setErr('');
    const { error } = await sb.from('members').delete().eq('id', m!.id);
    if (error) { setErr(error.message); return; }
    await reload();
    go('roster');
  }

  return (
    <div>
      <button className="back" onClick={() => history.length > 1 ? history.back() : go('roster')}><ArrowLeft size={14} /> Back</button>
      <div className="pageTitle">
        <div>
          <div className="eyebrow">{[m.unit, m.duty_status, m.staff_role].filter(Boolean).join(' · ').toUpperCase() || 'SHOOTER'}</div>
          <h1>{displayName(m)}</h1>
          <div className="row">
            <Tag tone={m.team_status === 'Active' ? 'good' : m.team_status === 'New' ? 'info' : 'neutral'}>{m.team_status}</Tag>
            <AwardsSelect member={m} />
            {isMe && <Tag tone="brass">This is you</Tag>}
            {isStaff && (linked ? <Tag tone="info">Has login ({linked.email})</Tag> : <Tag>No login linked</Tag>)}
          </div>
        </div>
        {isMe && !isStaff && <div className="titleActions"><button className="secondary" onClick={openTour}>Replay site tour</button></div>}
        {isStaff && <div className="titleActions">
          {isMe && realStaff && <button className="secondary" onClick={() => setPreviewShooter(true)}>View as shooter</button>}
          <button className="secondary" onClick={() => setEditing(true)}><Pencil size={15} /> Edit</button>
          <button className="secondary danger" onClick={() => setDeleting(true)}><Trash2 size={15} /> Remove</button>
        </div>}
      </div>

      <div className="grid2">
        <section className="panel">
          <div className="sectionTitle"><h2>Contact</h2>{isMe && !isStaff && <button onClick={() => setEditContact(true)}>Update</button>}</div>
          <dl className="facts">
            <dt>Cell phone</dt><dd>{m.cell_phone ? <a href={`tel:${m.cell_phone}`}><Phone size={13} /> {m.cell_phone}</a> : '—'}</dd>
            <dt>Military email</dt><dd>{m.mil_email ? <a href={`mailto:${m.mil_email}`}><Mail size={13} /> {m.mil_email}</a> : '—'}</dd>
            <dt>Personal email</dt><dd>{m.personal_email ? <a href={`mailto:${m.personal_email}`}><Mail size={13} /> {m.personal_email}</a> : '—'}</dd>
            <dt>Team weapons</dt><dd>Pistol {m.pistol_no != null ? `#${m.pistol_no}` : 'unassigned'} · Rifle {m.rifle_no != null ? `#${m.rifle_no}` : 'unassigned'}</dd>
            {isStaff && m.notes && <><dt>Notes</dt><dd className="pre">{m.notes}</dd></>}
          </dl>
        </section>
        {(isStaff || isMe) && (
          <section className="panel">
            <div className="sectionTitle"><h2>Quals &amp; paperwork</h2>{isStaff && <button onClick={() => setEditComp(true)}>Update</button>}</div>
            <dl className="facts">
              <dt>Handgun AFQC</dt><dd><ExpiryTag date={c?.handgun_qual_exp ?? null} state={expiryState(c?.handgun_qual_exp)} />{c?.handgun_qual_date && <small> qualified {milDate(c.handgun_qual_date)}</small>}</dd>
              <dt>Rifle AFQC</dt><dd><ExpiryTag date={c?.rifle_qual_exp ?? null} state={expiryState(c?.rifle_qual_exp)} />{c?.rifle_qual_date && <small> qualified {milDate(c.rifle_qual_date)}</small>}</dd>
              <dt>DD 2760</dt><dd>{c?.lautenberg_date ? `Signed ${milDate(c.lautenberg_date)}` : <Tag>Not on file</Tag>}</dd>
              <dt>Range waiver</dt><dd>{c?.range_waiver_date ? `Signed ${milDate(c.range_waiver_date)}` : '—'}</dd>
              <dt>Team van</dt><dd>{c?.gov_license ? `Licensed${c.gov_license_date ? ' ' + milDate(c.gov_license_date) : ''}` : 'Not licensed'}{c?.vco ? ' · VCO' : ''}</dd>
              {c?.notes && <><dt>Notes</dt><dd className="pre">{c.notes}</dd></>}
            </dl>
          </section>
        )}
      </div>

      <section className="panel">
        <div className="sectionTitle"><h2>Scores</h2><button onClick={() => go('scores')}>{isStaff ? 'Enter / view all' : 'Leaderboards'}</button></div>
        {byCourse.length === 0 ? <Empty title="No scores yet" /> : (
          <div className="courseCards">
            {byCourse.map(({ co, list, best, avg, trend }) => (
              <div key={co.code} className="courseCard">
                <div className="eyebrow">{co.weapon.toUpperCase()}</div>
                <h3>{co.name}</h3>
                {best ? <div className="bigNum">{scoreText(best.total, best.x_count)}<small>best{co.max_score ? ` / ${co.max_score}` : ''}</small></div>
                  : <div className="bigNum">{list[list.length - 1].raw ?? '—'}<small>latest</small></div>}
                <div className="row"><small>{list.length} fired{avg ? ` · avg ${avg.toFixed(0)}` : ''}</small><Sparkline values={trend.slice(-12)} max={co.max_score} /></div>
                <details><summary>History</summary>
                  <ul className="mini">{[...list].reverse().map(s => <li key={s.id}><span>{s.shot_on ? milDate(s.shot_on) : s.session_label}</span><b>{scoreText(s.total, s.x_count, s.raw)}</b></li>)}</ul>
                </details>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="sectionTitle"><h2>Attendance</h2><span className="formNote">{att.filter(x => x.a.status === 'attended').length} attended</span></div>
        {att.length === 0 ? <Empty title="No practices recorded" /> : (
          <div className="tableWrap"><table>
            <thead><tr><th>Date</th><th>Event</th><th>Status</th><th>Note</th></tr></thead>
            <tbody>{att.map(({ a, e }) => (
              <tr key={a.id} className="clickable" onClick={() => go('event', e.id)}>
                <td>{eventRange(e)}</td><td>{e.title} <small className="sub">{kindLabel[e.kind]}</small></td>
                <td><Tag tone={a.status === 'attended' ? 'good' : a.status === 'planned' ? 'info' : 'neutral'}>{a.status}</Tag></td>
                <td>{[a.transport, a.note].filter(Boolean).join(' · ')}</td>
              </tr>))}</tbody>
          </table></div>
        )}
      </section>

      {editContact && <ContactForm member={m} onClose={() => setEditContact(false)} />}
      {editing && <MemberForm member={m} onClose={() => setEditing(false)} />}
      {editComp && <ComplianceForm memberId={m.id} current={c} onClose={() => setEditComp(false)} />}
      {deleting && (
        <Modal title="Remove from roster?" onClose={() => setDeleting(false)}>
          <p>This permanently deletes {displayName(m)} along with their scores and attendance history. To keep their history, set their team status to <b>Inactive</b> instead.</p>
          {err && <p className="alert">{err}</p>}
          <div className="formActions">
            <button className="secondary" onClick={() => setDeleting(false)}>Cancel</button>
            <button className="secondary" onClick={() => { setDeleting(false); setEditing(true); }}>Mark as Inactive instead</button>
            <button className="primary dangerBg" onClick={remove}>Delete permanently</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/** Shooters update their own phone and emails. Everything else on their entry is staff-managed. */
function ContactForm({ member, onClose }: { member: import('../../lib/types').Member; onClose: () => void }) {
  const { sb, reload } = useTeam();
  const [f, setF] = useState({ cell: member.cell_phone ?? '', mil: member.mil_email ?? '', personal: member.personal_email ?? '' });
  const [busy, setBusy] = useState(false), [err, setErr] = useState('');
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr('');
    const { error } = await sb.rpc('update_my_contact', { p_cell_phone: f.cell.trim(), p_mil_email: f.mil.trim(), p_personal_email: f.personal.trim() });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    await reload(); onClose();
  }
  return (
    <Modal title="Update my contact info" onClose={onClose}>
      <form className="form" onSubmit={save}>
        <label>Cell phone<input inputMode="tel" pattern={PHONE_PATTERN} placeholder="316-555-0100" value={f.cell} onChange={e => setF({ ...f, cell: formatPhone(e.target.value) })} /></label>
        <label>Military email<input type="email" value={f.mil} onChange={e => setF({ ...f, mil: e.target.value })} /></label>
        <label>Personal email<input type="email" value={f.personal} onChange={e => setF({ ...f, personal: e.target.value })} /></label>
        <p className="formNote">Quals, paperwork, weapon numbers and team status are kept up to date by staff.</p>
        {err && <p className="alert">{err}</p>}
        <div className="formActions"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button></div>
      </form>
    </Modal>
  );
}
