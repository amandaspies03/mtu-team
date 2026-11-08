'use client';
import { useState } from 'react';
import { ArrowLeft, CalendarPlus, ClipboardCopy, Mail, Pencil, Plus, Printer, Trash2, UserPlus, X } from 'lucide-react';
import { useTeam } from '../../lib/data';
import { ORDERS_LABEL, type Attendance, type AttendanceStatus, type OrdersStatus } from '../../lib/types';
import { displayName, eventRange, fullName, kindLabel, scoreText, todayISO } from '../../lib/util';
import { go } from '../app-shell';
import { EventForm } from './events';
import { EmailComposer } from './email';
import { downloadIcs } from '../../lib/ics';
import { Empty, Modal, Rsvp, Tag } from './ui';

const STATUSES: AttendanceStatus[] = ['planned', 'attended', 'absent', 'excused'];

export default function EventView({ id }: { id: string }) {
  const { sb, isStaff, events, attendance, memberById, members, scores, courses, teams, teamMembers, reload } = useTeam();
  const e = events.find(x => x.id === id);
  const [editing, setEditing] = useState(false), [adding, setAdding] = useState(false), [deleting, setDeleting] = useState(false), [emailing, setEmailing] = useState(false);
  const [aar, setAar] = useState<string | null>(null);
  const [err, setErr] = useState(''), [copied, setCopied] = useState(false);
  if (!e) return <Empty title="Event not found"><button className="linkBtn" onClick={() => go('events')}>Back to calendar</button></Empty>;
  const past = (e.end_date ?? e.start_date) < todayISO();
  const rows = attendance.filter(a => a.event_id === e.id)
    .map(a => ({ a, m: memberById(a.member_id) }))
    .sort((x, y) => STATUSES.indexOf(x.a.status) - STATUSES.indexOf(y.a.status) || fullName(x.m).localeCompare(fullName(y.m)));
  const going = rows.filter(r => r.a.status === 'planned' || r.a.status === 'attended');
  const ammo = rows.reduce((t, { a }) => ({ r: t.r + (a.ammo_556 ?? 0), p: t.p + (a.ammo_9mm ?? 0) }), { r: 0, p: 0 });
  const evScores = scores.filter(s => s.event_id === e.id);
  const evTeams = teams.filter(t => t.event_id === e.id);

  async function patch(a: Attendance, change: Partial<Attendance>) {
    setErr('');
    const { error } = await sb.from('attendance').update(change).eq('id', a.id);
    if (error) setErr(error.message); else await reload();
  }
  async function remove(a: Attendance) {
    const { error } = await sb.from('attendance').delete().eq('id', a.id);
    if (error) setErr(error.message); else await reload();
  }
  async function saveAar() {
    const { error } = await sb.from('events').update({ aar: aar?.trim() || null }).eq('id', e!.id);
    if (error) setErr(error.message); else { setAar(null); await reload(); }
  }
  async function deleteEvent() {
    const { error } = await sb.from('events').delete().eq('id', e!.id);
    if (error) { setErr(error.message); return; }
    await reload(); go('events');
  }
  function copyRoster() {
    const lines = [`${e!.title} – ${eventRange(e!)}${e!.location ? ` @ ${e!.location}` : ''}`, ...going.map(({ a, m }) => `${fullName(m)}${a.transport ? ` (${a.transport})` : ''}`)];
    navigator.clipboard.writeText(lines.join('\n')).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  return (
    <div className="eventPage">
      <button className="back" onClick={() => history.length > 1 ? history.back() : go('events')}><ArrowLeft size={14} /> Back</button>
      <div className="pageTitle">
        <div>
          <div className="eyebrow">{kindLabel[e.kind].toUpperCase()} · {eventRange(e)}</div>
          <h1>{e.title}</h1>
          <p>{e.location || 'Location TBD'}</p>
          {!isStaff && !past && <Rsvp event={e} />}
        </div>
        <div className="titleActions noPrint">
          {isStaff && <button className="secondary" onClick={() => setEmailing(true)}><Mail size={15} /> Email</button>}
          {!past && <button className="secondary" onClick={() => downloadIcs(`MTU ${e.title} ${e.start_date}.ics`, [e])}><CalendarPlus size={15} /> Add to calendar</button>}
          <button className="secondary" onClick={copyRoster}><ClipboardCopy size={15} /> {copied ? 'Copied' : 'Copy roster'}</button>
          <button className="secondary" onClick={() => window.print()}><Printer size={15} /> Print</button>
          {isStaff && <button className="secondary" onClick={() => setEditing(true)}><Pencil size={15} /> Edit</button>}
          {isStaff && <button className="secondary danger" onClick={() => setDeleting(true)}><Trash2 size={15} /></button>}
        </div>
      </div>
      {err && <p className="alert">{err}</p>}

      <div className="stats">
        <div><strong>{going.length}</strong><span>{past ? 'on roster' : 'going'}</span></div>
        <div><strong>{going.filter(r => r.a.orders_status === 'cut' || r.a.orders_status === 'signed' || r.a.orders_status === 'not_required').length}/{going.length}</strong><span>orders ready</span></div>
        <div><strong>{ammo.r}</strong><span>rds 5.56 issued</span></div>
        <div><strong>{ammo.p}</strong><span>rds 9mm issued</span></div>
      </div>

      {e.notes && <section className="panel"><div className="sectionTitle"><h2>Plan</h2></div><p className="pre">{e.notes}</p></section>}

      <section className="panel">
        <div className="sectionTitle"><h2>Roster, orders &amp; ammo</h2>{isStaff && <button className="noPrint" onClick={() => setAdding(true)}><UserPlus size={15} /> Add shooters</button>}</div>
        {rows.length === 0 ? <Empty title="No one on the roster yet">{isStaff ? 'Add shooters, or have them RSVP from their dashboard.' : 'Be the first to RSVP.'}</Empty> : (
          <div className="tableWrap"><table className="attTable">
            <thead><tr><th>Shooter</th><th>Status</th><th>336 / orders</th><th>Transport / duty</th><th className="num">5.56</th><th className="num">9mm</th><th>Note</th>{isStaff && <th className="noPrint" />}</tr></thead>
            <tbody>{rows.map(({ a, m }) => isStaff ? (
              <tr key={a.id}>
                <td><a href={`#member/${a.member_id}`}>{fullName(m)}</a>{m?.unit && <small className="sub">{m.unit}</small>}</td>
                <td><select value={a.status} onChange={x => patch(a, { status: x.target.value as AttendanceStatus })}>{STATUSES.map(s => <option key={s}>{s}</option>)}</select></td>
                <td><select value={a.orders_status} onChange={x => patch(a, { orders_status: x.target.value as OrdersStatus })}>{Object.entries(ORDERS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></td>
                <td><input defaultValue={a.transport ?? ''} placeholder="Van, POV, ammo truck…" onBlur={x => x.target.value !== (a.transport ?? '') && patch(a, { transport: x.target.value || null })} /></td>
                <td className="num"><input className="numIn" type="number" min={0} inputMode="numeric" defaultValue={a.ammo_556 ?? ''} onBlur={x => { const v = x.target.value === '' ? null : Math.max(0, Math.round(+x.target.value)); if (v !== a.ammo_556) patch(a, { ammo_556: v }); }} /></td>
                <td className="num"><input className="numIn" type="number" min={0} inputMode="numeric" defaultValue={a.ammo_9mm ?? ''} onBlur={x => { const v = x.target.value === '' ? null : Math.max(0, Math.round(+x.target.value)); if (v !== a.ammo_9mm) patch(a, { ammo_9mm: v }); }} /></td>
                <td><input defaultValue={a.note ?? ''} onBlur={x => x.target.value !== (a.note ?? '') && patch(a, { note: x.target.value || null })} /></td>
                <td className="noPrint"><button className="iconBtn" aria-label={`Remove ${fullName(m)}`} onClick={() => remove(a)}><X size={15} /></button></td>
              </tr>
            ) : (
              <tr key={a.id}>
                <td>{fullName(m)}</td><td><Tag tone={a.status === 'attended' ? 'good' : a.status === 'planned' ? 'info' : 'neutral'}>{a.status}</Tag></td>
                <td>{ORDERS_LABEL[a.orders_status]}</td><td>{a.transport}</td><td className="num">{a.ammo_556 ?? ''}</td><td className="num">{a.ammo_9mm ?? ''}</td><td>{a.note}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
        {isStaff && !past && (
          <details className="noPrint"><summary>336 / orders routing reminder</summary>
            <ol className="steps">
              <li>Member tells their supervisor and the NCOIC which practices they can attend.</li>
              <li>NCOIC updates the AT/ST tracking sheet.</li>
              <li>Member completes the ANG 336 from the MTU template with supervisor signature and sends it to the NCOIC for day allocation.</li>
              <li>Unit CSS signs as Authorizing Official and drafts orders in AROWS.</li>
              <li>Orders cut NLT 2 weeks before practice. Member brings a printed copy — no orders, no weapons.</li>
              <li>Member signs the order in AROWS after the practice.</li>
            </ol>
          </details>
        )}
      </section>

      {(e.kind === 'match' || evTeams.length > 0) && <MatchTeams eventId={e.id} />}

      <section className="panel">
        <div className="sectionTitle"><h2>After action / notes</h2>{isStaff && aar === null && <button className="noPrint" onClick={() => setAar(e.aar ?? '')}>{e.aar ? 'Edit' : 'Add AAR'}</button>}</div>
        {aar !== null ? (
          <div className="form">
            <textarea rows={6} value={aar} onChange={x => setAar(x.target.value)} placeholder="Weather, what worked, what to change, sustains / improves…" />
            <div className="formActions"><button className="secondary" onClick={() => setAar(null)}>Cancel</button><button className="primary" onClick={saveAar}>Save</button></div>
          </div>
        ) : e.aar ? <p className="pre">{e.aar}</p> : <p className="formNote">No AAR yet.</p>}
      </section>

      {evScores.length > 0 && (
        <section className="panel">
          <div className="sectionTitle"><h2>Scores fired</h2></div>
          <div className="tableWrap"><table>
            <thead><tr><th>Shooter</th><th>Course</th><th className="num">Score</th></tr></thead>
            <tbody>{[...evScores].sort((a, b) => a.course_code.localeCompare(b.course_code) || Number(b.total ?? 0) - Number(a.total ?? 0)).map(s => (
              <tr key={s.id}><td>{displayName(memberById(s.member_id))}</td><td>{courses.find(c => c.code === s.course_code)?.name}</td><td className="num">{scoreText(s.total, s.x_count, s.raw)}</td></tr>
            ))}</tbody>
          </table></div>
        </section>
      )}

      {editing && <EventForm event={e} onClose={() => setEditing(false)} />}
      {emailing && <EmailComposer event={e} onClose={() => setEmailing(false)} />}
      {adding && <AddShooters eventId={e.id} past={past} existing={rows.map(r => r.a.member_id)} onClose={() => setAdding(false)} members={members} />}
      {deleting && (
        <Modal title="Delete this event?" onClose={() => setDeleting(false)}>
          <p>This removes the event, its roster, ammo log and match teams. Scores stay on each shooter’s record.</p>
          <div className="formActions"><button className="secondary" onClick={() => setDeleting(false)}>Cancel</button><button className="primary dangerBg" onClick={deleteEvent}>Delete</button></div>
        </Modal>
      )}
    </div>
  );
}

function AddShooters({ eventId, existing, past, members, onClose }: { eventId: string; existing: string[]; past: boolean; members: ReturnType<typeof useTeam>['members']; onClose: () => void }) {
  const { sb, reload } = useTeam();
  const [picked, setPicked] = useState<string[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState(false), [err, setErr] = useState('');
  const pool = members.filter(m => !existing.includes(m.id) && (showAll || ['Active', 'New', 'Tryout'].includes(m.team_status)));
  async function save() {
    setBusy(true); setErr('');
    const { error } = await sb.from('attendance').insert(picked.map(member_id => ({ event_id: eventId, member_id, status: past ? 'attended' : 'planned' })));
    if (error) { setErr(error.message); setBusy(false); return; }
    await reload(); onClose();
  }
  return (
    <Modal title="Add shooters" onClose={onClose}>
      <label className="check"><input type="checkbox" checked={showAll} onChange={x => setShowAll(x.target.checked)} /> Include reserve and alumni</label>
      <div className="pickList">
        {pool.map(m => (
          <label key={m.id} className="check">
            <input type="checkbox" checked={picked.includes(m.id)} onChange={x => setPicked(x.target.checked ? [...picked, m.id] : picked.filter(p => p !== m.id))} />
            {fullName(m)} <small className="sub">{[m.rank, m.unit, m.team_status].filter(Boolean).join(' · ')}</small>
          </label>
        ))}
        {pool.length === 0 && <p className="formNote">Everyone is already on this roster.</p>}
      </div>
      {err && <p className="alert">{err}</p>}
      <div className="formActions"><button className="secondary" onClick={onClose}>Cancel</button><button className="primary" disabled={!picked.length || busy} onClick={save}>Add {picked.length || ''}</button></div>
    </Modal>
  );
}

function MatchTeams({ eventId }: { eventId: string }) {
  const { sb, isStaff, teams, teamMembers, memberById, attendance, members, reload } = useTeam();
  const evTeams = teams.filter(t => t.event_id === eventId);
  const [name, setName] = useState(''), [err, setErr] = useState('');
  const pool = attendance.filter(a => a.event_id === eventId && a.status !== 'absent').map(a => a.member_id);
  const assigned = new Set(teamMembers.filter(tm => evTeams.some(t => t.id === tm.team_id)).map(tm => tm.member_id));
  const candidates = (pool.length ? members.filter(m => pool.includes(m.id)) : members.filter(m => ['Active', 'New'].includes(m.team_status))).filter(m => !assigned.has(m.id));

  const run = async (p: PromiseLike<{ error: { message: string } | null }>) => { setErr(''); const { error } = await p; if (error) setErr(error.message); else await reload(); };
  async function addTeam(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await run(sb.from('match_teams').insert({ event_id: eventId, name: name.trim() }));
    setName('');
  }

  return (
    <section className="panel">
      <div className="sectionTitle"><h2>Match teams</h2></div>
      {err && <p className="alert">{err}</p>}
      {evTeams.length === 0 && <p className="formNote">No teams yet.{isStaff ? ' Create Team A, B… then assign shooters and a team captain.' : ''}</p>}
      <div className="teamGrid">
        {evTeams.map(t => {
          const tms = teamMembers.filter(tm => tm.team_id === t.id);
          return (
            <div key={t.id} className="teamCard">
              <div className="teamHead">
                <h3>{t.name}{t.nickname && <small> “{t.nickname}”</small>}</h3>
                {isStaff && <button className="iconBtn" aria-label="Delete team" onClick={() => run(sb.from('match_teams').delete().eq('id', t.id))}><Trash2 size={14} /></button>}
              </div>
              {isStaff && <input className="nick" defaultValue={t.nickname ?? ''} placeholder="Nickname (optional)" onBlur={x => x.target.value !== (t.nickname ?? '') && run(sb.from('match_teams').update({ nickname: x.target.value || null }).eq('id', t.id))} />}
              <ul>
                {tms.map(tm => (
                  <li key={tm.member_id}>
                    <span>{fullName(memberById(tm.member_id))}{t.captain_id === tm.member_id && <Tag tone="brass">TC</Tag>}</span>
                    {isStaff && <span className="row">
                      {t.captain_id !== tm.member_id && <button className="linkBtn" onClick={() => run(sb.from('match_teams').update({ captain_id: tm.member_id }).eq('id', t.id))}>Make TC</button>}
                      <button className="iconBtn" aria-label="Remove from team" onClick={() => run(sb.from('match_team_members').delete().eq('team_id', t.id).eq('member_id', tm.member_id))}><X size={14} /></button>
                    </span>}
                  </li>
                ))}
              </ul>
              {isStaff && candidates.length > 0 && (
                <select value="" onChange={x => x.target.value && run(sb.from('match_team_members').insert({ team_id: t.id, member_id: x.target.value }))}>
                  <option value="">+ Add shooter…</option>
                  {candidates.map(m => <option key={m.id} value={m.id}>{fullName(m)}</option>)}
                </select>
              )}
            </div>
          );
        })}
      </div>
      {isStaff && (
        <form className="inlineForm noPrint" onSubmit={addTeam}>
          <input value={name} onChange={x => setName(x.target.value)} placeholder={`Team ${String.fromCharCode(65 + evTeams.length)}`} />
          <button className="secondary"><Plus size={15} /> Add team</button>
        </form>
      )}
    </section>
  );
}
