'use client';
import { useState } from 'react';
import { ArrowLeft, CalendarPlus, MessageCircle, ClipboardCopy, Mail, Search, Pencil, Plus, Printer, Trash2, UserPlus, X } from 'lucide-react';
import { useTeam } from '../../lib/data';
import { PREP_ITEMS, prepDone, type Attendance, type AttendanceStatus } from '../../lib/types';
import { WeaponSelect } from './weapon-select';
import { groupme } from '../../lib/groupme';
import { displayName, eventRange, fullName, kindLabel, todayISO } from '../../lib/util';
import { go } from '../app-shell';
import { EventForm } from './events';
import { EmailComposer } from './email';
import { downloadIcs } from '../../lib/ics';
import { Empty, Modal, Rsvp, Tag } from './ui';

const STATUSES: AttendanceStatus[] = ['planned', 'attended', 'absent', 'excused'];

export default function EventView({ id }: { id: string }) {
  const { sb, me, isStaff, events, attendance, memberById, members, teams, teamMembers, reload } = useTeam();
  const e = events.find(x => x.id === id);
  const [editing, setEditing] = useState(false), [adding, setAdding] = useState(false), [deleting, setDeleting] = useState(false), [emailing, setEmailing] = useState(false);
  const [aar, setAar] = useState<string | null>(null);
  const [err, setErr] = useState(''), [copied, setCopied] = useState(false);
  const [posting, setPosting] = useState(false), [posted, setPosted] = useState('');
  const [announceCancel, setAnnounceCancel] = useState(() => !!events.find(x => x.id === id)?.groupme_posted_at);
  if (!e) return <Empty title="Event not found"><button className="linkBtn" onClick={() => go('events')}>Back to calendar</button></Empty>;
  const past = (e.end_date ?? e.start_date) < todayISO();
  const rows = attendance.filter(a => a.event_id === e.id)
    .map(a => ({ a, m: memberById(a.member_id) }))
    .sort((x, y) => STATUSES.indexOf(x.a.status) - STATUSES.indexOf(y.a.status) || fullName(x.m).localeCompare(fullName(y.m)));
  const going = rows.filter(r => r.a.status === 'planned' || r.a.status === 'attended');
  const evTeams = teams.filter(t => t.event_id === e.id);
  const isPractice = e.kind === 'practice';

  function AmmoStat({ label, field }: { label: string; field: 'ammo_556' | 'ammo_9mm' }) {
    const value = e![field];
    if (!isStaff) return <div><strong>{value ?? '—'}</strong><span>rds {label} issued</span></div>;
    return (
      <div className="ammoStat">
        <input className="numIn ammoIn" type="number" min={0} inputMode="numeric" aria-label={`Rounds of ${label} issued`} defaultValue={value ?? ''} key={`${field}-${value}`}
          onBlur={x => { const v = x.target.value === '' ? null : Math.max(0, Math.round(+x.target.value)); if (v !== value) saveEvent({ [field]: v }); }} />
        <span>rds {label} issued</span>
      </div>
    );
  }
  async function saveEvent(change: Record<string, number | boolean | string | null>) {
    setErr('');
    const { error } = await sb.from('events').update(change).eq('id', e!.id);
    if (error) setErr(error.message); else await reload();
  }
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
    setErr('');
    if (!past && announceCancel) {
      const r = await groupme(sb, { type: 'cancel', eventId: e!.id });
      if (!r.ok) { setErr(`GroupMe post failed (${r.error ?? 'unknown error'}). The event was not deleted — untick the GroupMe box to delete without posting.`); setDeleting(false); return; }
    }
    const { error } = await sb.from('events').delete().eq('id', e!.id);
    if (error) { setErr(error.message); return; }
    await reload(); go('events');
  }
  // Which GroupMe group receives this is set by GROUPME_BOT_ID in Vercel — see docs/GROUPME.md.
  async function postToGroupMe() {
    if (!confirm(`Post "${e!.title}" to the team GroupMe? Everyone in the group will see it.${e!.groupme_posted_at ? ' (It was already posted once.)' : ''}`)) return;
    setPosting(true); setErr(''); setPosted('');
    const { data: sess } = await sb.auth.getSession();
    const res = await fetch('/api/groupme', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sess.session?.access_token ?? ''}` }, body: JSON.stringify({ type: 'event', eventId: e!.id }) }).catch(() => null);
    const out = res ? await res.json().catch(() => ({})) : {};
    setPosting(false);
    if (!res?.ok) { setErr(out.error ?? 'Could not post to GroupMe.'); return; }
    setPosted('Posted to GroupMe.'); await reload();
  }
  function copyRoster() {
    const lines = [`${e!.title} – ${eventRange(e!)}${e!.location ? ` @ ${e!.location}` : ''}`, ...going.map(({ a, m }) => `${fullName(m)}${a.transport ? ` (${a.transport})` : ''}`)];
    navigator.clipboard.writeText(lines.join('\n')).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  if (!isStaff) {
    const mine = rows.find(r => r.a.member_id === me.member_id);
    const myRifle = memberById(me.member_id)?.rifle_no;
    return (
      <div className="eventPage">
        <button className="back" onClick={() => history.length > 1 ? history.back() : go('events')}><ArrowLeft size={14} /> Back</button>
        <div className="pageTitle">
          <div>
            <div className="eyebrow">{kindLabel[e.kind].toUpperCase()} · {eventRange(e)}</div>
            <h1>{e.title}</h1>
            <p>{e.location || 'Location TBD'}</p>
          </div>
          <div className="titleActions">
            {!past && <button className="secondary" onClick={() => downloadIcs(`MTU ${e.title} ${e.start_date}.ics`, [e])}><CalendarPlus size={15} /> Add to calendar</button>}
          </div>
        </div>
        {!past && me.member_id && <div className="rsvpCard"><div><b>Are you going?</b><span>{kindLabel[e.kind]} · {eventRange(e)}</span></div><Rsvp event={e} /></div>}
        <section className="panel">
          <div className="sectionTitle"><h2>Your details</h2></div>
          <dl className="facts">
            <dt>Your status</dt><dd>{mine ? (mine.a.status === 'planned' ? 'Going' : mine.a.status === 'absent' ? 'Not going' : mine.a.status === 'attended' ? 'Attended' : 'Excused') : past ? 'Not on the roster' : 'No RSVP yet'}</dd>
            {myRifle != null && <><dt>Your rifle</dt><dd>Rifle #{myRifle}</dd></>}
          </dl>
        </section>
      </div>
    );
  }

  return (
    <div className="eventPage">
      <button className="back" onClick={() => history.length > 1 ? history.back() : go('events')}><ArrowLeft size={14} /> Back</button>
      <div className="pageTitle">
        <div>
          <div className="eyebrow">{kindLabel[e.kind].toUpperCase()} · {eventRange(e)}</div>
          <h1>{e.title}</h1>
          <p>{e.location || 'Location TBD'}</p>
        </div>
        <div className="titleActions noPrint">
          {isStaff && !past && <button className="secondary" disabled={posting} onClick={postToGroupMe}><MessageCircle size={15} /> {posting ? 'Posting…' : e.groupme_posted_at ? 'Post to GroupMe again' : 'Post to GroupMe'}</button>}
          {isStaff && <button className="secondary" onClick={() => setEmailing(true)}><Mail size={15} /> Email</button>}
          {!past && <button className="secondary" onClick={() => downloadIcs(`MTU ${e.title} ${e.start_date}.ics`, [e])}><CalendarPlus size={15} /> Add to calendar</button>}
          <button className="secondary" onClick={copyRoster}><ClipboardCopy size={15} /> {copied ? 'Copied' : 'Copy roster'}</button>
          <button className="secondary" onClick={() => window.print()}><Printer size={15} /> Print</button>
          {isStaff && <button className="secondary" onClick={() => setEditing(true)}><Pencil size={15} /> Edit</button>}
          {isStaff && <button className="secondary danger" onClick={() => setDeleting(true)}><Trash2 size={15} /></button>}
        </div>
      </div>
      {!past && me.member_id && <div className="rsvpCard"><div><b>Are you going?</b><span>{kindLabel[e.kind]} · {eventRange(e)}</span></div><Rsvp event={e} /></div>}
      {err && <p className="alert">{err}</p>}
      {isStaff && (posted || e.groupme_posted_at) && <p className="formNote">{posted || `Posted to GroupMe ${new Date(e.groupme_posted_at!).toLocaleString('en-US', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}.`}</p>}

      <div className="stats">
        <div><strong>{going.length}</strong><span>{past ? 'on roster' : 'going'}</span></div>
        {isPractice && isStaff && <div><strong>{prepDone(e)}/{PREP_ITEMS.length}</strong><span>prep done</span></div>}
        {AmmoStat({ label: "5.56", field: "ammo_556" })}
        {AmmoStat({ label: "9mm", field: "ammo_9mm" })}
      </div>

      {isPractice && isStaff && (
        <section className="panel prep">
          <div className="sectionTitle"><h2>Prep checklist</h2><span className="formNote">{prepDone(e) === PREP_ITEMS.length ? 'All set' : `${PREP_ITEMS.length - prepDone(e)} to go`}</span></div>
          <div className="prepList">
            {PREP_ITEMS.map(i => {
              const done = i.key === 'prep_van_driver' ? e.prep_van_driver || !!e.van_driver_id : e[i.key];
              return (
                <div key={i.key} className={`prepItem ${done ? 'done' : ''}`}>
                  <label className="check"><input type="checkbox" checked={done} onChange={x => saveEvent(i.key === 'prep_van_driver' && !x.target.checked ? { prep_van_driver: false, van_driver_id: null }
                    : i.key === 'prep_vehicle_confirmed' && x.target.checked ? { prep_vehicle_confirmed: true, prep_vehicle_requested: true } // confirmed implies requested
                    : i.key === 'prep_vehicle_requested' && !x.target.checked ? { prep_vehicle_requested: false, prep_vehicle_confirmed: false }
                    : { [i.key]: x.target.checked })} /> {i.label}</label>
                  {i.key === 'prep_ammo_draw' && (
                    <div className="drawFields">
                      <label>Requested<input type="date" defaultValue={e.ammo_draw_requested_on ?? ''} key={`d-${e.ammo_draw_requested_on}`}
                        onBlur={x => { const v = x.target.value || null; if (v !== e.ammo_draw_requested_on) saveEvent(v ? { ammo_draw_requested_on: v, prep_ammo_draw: true } : { ammo_draw_requested_on: null }); }} /></label>
                      {(['ammo_draw_556', 'ammo_draw_9mm'] as const).map(f => (
                        <label key={f}>{f === 'ammo_draw_556' ? '5.56 rds' : '9mm rds'}<input className="numIn" type="number" min={0} inputMode="numeric" defaultValue={e[f] ?? ''} key={`${f}-${e[f]}`}
                          onBlur={x => { const v = x.target.value === '' ? null : Math.max(0, Math.round(+x.target.value)); if (v !== e[f]) saveEvent({ [f]: v }); }} /></label>
                      ))}
                    </div>
                  )}
                  {i.key === 'prep_van_driver' && (
                    <select aria-label="Van driver" value={e.van_driver_id ?? ''} onChange={x => saveEvent({ van_driver_id: x.target.value || null, prep_van_driver: !!x.target.value || e.prep_van_driver })}>
                      <option value="">Who’s driving?</option>
                      {[...going.map(r => r.m!).filter(Boolean), ...members.filter(m => m.team_status !== 'Inactive' && !going.some(r => r.a.member_id === m.id))]
                        .map(m => <option key={m.id} value={m.id}>{fullName(m)}</option>)}
                    </select>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {e.notes && <section className="panel"><div className="sectionTitle"><h2>Plan</h2></div><p className="pre">{e.notes}</p></section>}

      <section className="panel">
        <div className="sectionTitle"><h2>Roster</h2>{isStaff && <button className="noPrint" onClick={() => setAdding(true)}><UserPlus size={15} /> Add shooters</button>}</div>
        {rows.length === 0 ? <Empty title="No one on the roster yet">{isStaff ? 'Add shooters, or have them RSVP from their dashboard.' : 'Be the first to RSVP.'}</Empty> : (
          <div className="tableWrap"><table className="attTable">
            <thead><tr><th>Shooter</th><th>Status</th>{isPractice && <th>Rifle #</th>}<th>Transport / duty</th><th>Note</th>{isStaff && <th className="noPrint" />}</tr></thead>
            <tbody>{rows.map(({ a, m }) => isStaff ? (
              <tr key={a.id}>
                <td><a href={`#member/${a.member_id}`}>{fullName(m)}</a>{m?.unit && <small className="sub">{m.unit}</small>}</td>
                <td><select value={a.status} onChange={x => patch(a, { status: x.target.value as AttendanceStatus })}>{STATUSES.map(s => <option key={s}>{s}</option>)}</select></td>
                {isPractice && <td>{m ? <WeaponSelect member={m} kind="rifle" /> : '—'}</td>}
                <td><input defaultValue={a.transport ?? ''} placeholder="Van, POV, ammo truck…" onBlur={x => x.target.value !== (a.transport ?? '') && patch(a, { transport: x.target.value || null })} /></td>
                <td><input defaultValue={a.note ?? ''} onBlur={x => x.target.value !== (a.note ?? '') && patch(a, { note: x.target.value || null })} /></td>
                <td className="noPrint"><button className="iconBtn" aria-label={`Remove ${fullName(m)}`} onClick={() => remove(a)}><X size={15} /></button></td>
              </tr>
            ) : (
              <tr key={a.id}>
                <td>{fullName(m)}</td><td><Tag tone={a.status === 'attended' ? 'good' : a.status === 'planned' ? 'info' : 'neutral'}>{a.status}</Tag></td>
                {isPractice && <td>{m?.rifle_no ?? <span className="muted">Unassigned</span>}</td>}<td>{a.transport}</td><td>{a.note}</td>
              </tr>
            ))}</tbody>
          </table></div>
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

      {editing && <EventForm event={e} onClose={() => setEditing(false)} />}
      {emailing && <EmailComposer event={e} onClose={() => setEmailing(false)} />}
      {adding && <AddShooters eventId={e.id} past={past} existing={rows.map(r => r.a.member_id)} onClose={() => setAdding(false)} members={members} />}
      {deleting && (
        <Modal title="Delete this event?" onClose={() => setDeleting(false)}>
          <p>This removes the event, its roster, ammo count and match teams. Scores stay on each shooter’s record.</p>
          {!past && <label className="check notifyBox"><input type="checkbox" checked={announceCancel} onChange={x => setAnnounceCancel(x.target.checked)} /> Post a cancellation notice to the team GroupMe</label>}
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
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false), [err, setErr] = useState('');
  const pool = members.filter(m => !existing.includes(m.id) && (showAll || ['Active', 'New', 'Tryout'].includes(m.team_status)))
    .filter(m => !q.trim() || `${m.last_name} ${m.first_name ?? ''} ${m.rank ?? ''} ${m.unit ?? ''}`.toLowerCase().includes(q.trim().toLowerCase()));
  async function save() {
    setBusy(true); setErr('');
    const { error } = await sb.from('attendance').insert(picked.map(member_id => ({ event_id: eventId, member_id, status: past ? 'attended' : 'planned' })));
    if (error) { setErr(error.message); setBusy(false); return; }
    await reload(); onClose();
  }
  return (
    <Modal title="Add shooters" onClose={onClose}>
      <label className="search pickSearch"><Search size={16} /><input autoFocus placeholder="Search name, rank or unit…" value={q} onChange={x => setQ(x.target.value)} aria-label="Search shooters" /></label>
      <label className="check"><input type="checkbox" checked={showAll} onChange={x => setShowAll(x.target.checked)} /> Include inactive shooters</label>
      <div className="pickList">
        {pool.map(m => (
          <label key={m.id} className="check">
            <input type="checkbox" checked={picked.includes(m.id)} onChange={x => setPicked(x.target.checked ? [...picked, m.id] : picked.filter(p => p !== m.id))} />
            {fullName(m)} <small className="sub">{[m.rank, m.unit, m.team_status].filter(Boolean).join(' · ')}</small>
          </label>
        ))}
        {pool.length === 0 && <p className="formNote">{q ? 'No shooters match that search.' : 'Everyone is already on this roster.'}</p>}
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
