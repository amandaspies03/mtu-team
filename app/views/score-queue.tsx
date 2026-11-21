'use client';
// Shooters send a score from the Match day scorecard; staff approve (with edits) or reject it in the Score queue.
// Submitted scores stay off leaderboards and stats until approved: approving copies them into `scores`.
import { useState } from 'react';
import { Check, Send, Trash2, X } from 'lucide-react';
import { useTeam } from '../../lib/data';
import type { ScoreSubmission } from '../../lib/types';
import { displayName, milDate, scoreText, todayISO } from '../../lib/util';
import { Empty, Modal, Tag } from './ui';

/** Match day scorecard code → score course. */
export const SCORECARD_COURSE: Record<string, string> = { PI2210: 'PISTOL_EIC', PI2250: 'PISTOL_AB', RI3020: 'RIFLE_RR', 'RIFLE EIC': 'RIFLE_EIC' };

const when = (iso: string) => new Date(iso).toLocaleString('en-US', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const statusTag = (s: ScoreSubmission['status']) => <Tag tone={s === 'approved' ? 'good' : s === 'rejected' ? 'bad' : 'warn'}>{s === 'pending' ? 'Waiting for approval' : s === 'approved' ? 'Approved' : 'Rejected'}</Tag>;

/** Bottom of a Match day scorecard: send this score to staff for approval. */
export function SubmitScore({ code, title, total, x, parts, entered, expected, onClear }: {
  code: string; title: string; total: number; x: number | null; parts: { label: string; pts: number; max: number }[];
  entered: number; expected: number; onClear: () => void;
}) {
  const { me, events, submissions, saveOrQueue } = useTeam();
  const course = SCORECARD_COURSE[code];
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [label, setLabel] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false), [err, setErr] = useState(''), [done, setDone] = useState('');
  if (!course || !me.member_id) return null;
  const mine = submissions.filter(s => s.member_id === me.member_id && s.course_code === course);
  const last = mine[0];
  const onDate = events.filter(e => e.start_date <= date && (e.end_date ?? e.start_date) >= date);

  async function submit() {
    setBusy(true); setErr('');
    const row = {
      id: crypto.randomUUID(), member_id: me.member_id!, course_code: course, shot_on: date, session_label: label.trim() || null,
      total, x_count: x, breakdown: parts, notes: notes.trim() || null, submitted_by: me.id, submitted_at: new Date().toISOString(), status: 'pending' as const,
    };
    try {
      const r = await saveOrQueue({ kind: 'submission', label: `${title} score ${scoreText(total, x)}`, row });
      setDone(r === 'sent' ? `Sent to staff ${when(row.submitted_at)}. It’ll count once they approve it.` : 'No signal: saved on this phone and it’ll send when you’re back online.');
      setOpen(false); setNotes('');
    } catch (e) { setErr((e as { message?: string }).message ?? 'Couldn’t send.'); }
    setBusy(false);
  }

  return (
    <div className="submitBar">
      <button className="primary" disabled={entered === 0} onClick={() => { setOpen(true); setDone(''); setLabel(l => l || (onDate.length === 1 ? onDate[0].title : '')); }}><Send size={15} /> Submit to staff</button>
      {done ? <span className="formNote">{done} <button className="linkBtn" onClick={onClear}>Clear card</button></span>
        : last && <span className="formNote">Your last {title} score: {scoreText(last.total, last.x_count)} · {statusTag(last.status)}{last.status === 'rejected' && last.review_note ? ` “${last.review_note}”` : ''}</span>}
      {open && (
        <Modal title="Submit score to staff" onClose={() => setOpen(false)}>
          <p><b>{title}: {scoreText(total, x)}</b></p>
          {entered < expected && <p className="alert">Only {entered} of {expected} shots are entered. Submit anyway only if that’s right.</p>}
          <div className="form">
            <label>Date fired<input type="date" value={date} max={todayISO()} onChange={e => setDate(e.target.value)} /></label>
            <label>Practice / match <span className="muted">(optional)</span>
              <input list="submit-events" value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Practice 2" maxLength={120} />
              <datalist id="submit-events">{onDate.map(e => <option key={e.id} value={e.title} />)}</datalist>
            </label>
            <label>Note for staff <span className="muted">(optional)</span><textarea rows={2} maxLength={500} value={notes} onChange={e => setNotes(e.target.value)} /></label>
          </div>
          <p className="formNote">Staff get it in the Score queue with the time you sent it. It won’t show on leaderboards until they approve it.</p>
          {err && <p className="alert">{err}</p>}
          <div className="formActions"><button className="secondary" onClick={() => setOpen(false)}>Cancel</button><button className="primary" disabled={busy || !date} onClick={submit}>{busy ? 'Sending…' : 'Submit'}</button></div>
        </Modal>
      )}
    </div>
  );
}

/** Staff: pending scores to approve, edit or reject; then recent decisions. */
export function ScoreQueue() {
  const { submissions } = useTeam();
  const pending = submissions.filter(s => s.status === 'pending').sort((a, b) => (a.submitted_at < b.submitted_at ? -1 : 1));
  const recent = submissions.filter(s => s.status !== 'pending').sort((a, b) => ((b.reviewed_at ?? '') > (a.reviewed_at ?? '') ? 1 : -1)).slice(0, 20);
  return (
    <section className="panel">
      <div className="sectionTitle"><h2>Waiting for approval</h2><span className="formNote">{pending.length || 'None'}</span></div>
      {pending.length === 0 ? <Empty title="Nothing to approve">Scores shooters submit from the Match day scorecard show up here.</Empty>
        : pending.map(s => <QueueItem key={s.id} s={s} />)}
      {recent.length > 0 && <>
        <div className="sectionTitle"><h2>Recently reviewed</h2></div>
        <SubmissionTable rows={recent} showShooter />
      </>}
    </section>
  );
}

function QueueItem({ s }: { s: ScoreSubmission }) {
  const { sb, memberById, courses, reload } = useTeam();
  const course = courses.find(c => c.code === s.course_code);
  const [t, setT] = useState(String(s.total)), [x, setX] = useState(s.x_count == null ? '' : String(s.x_count));
  const [date, setDate] = useState(s.shot_on), [label, setLabel] = useState(s.session_label ?? ''), [note, setNote] = useState('');
  const [busy, setBusy] = useState(false), [err, setErr] = useState('');
  const total = Number(t), xc = x === '' ? null : Number(x);
  const ok = t !== '' && Number.isFinite(total) && total >= 0 && (course?.max_score == null || total <= course.max_score) && (xc == null || (Number.isInteger(xc) && xc >= 0)) && !!date;
  const edited = total !== Number(s.total) || xc !== s.x_count || date !== s.shot_on || label.trim() !== (s.session_label ?? '');

  async function review(action: 'approve' | 'reject') {
    if (action === 'reject' && !confirm(`Reject this score from ${displayName(memberById(s.member_id))}? They’ll see it was rejected${note.trim() ? ' with your note' : ''}.`)) return;
    setBusy(true); setErr('');
    const { error } = await sb.rpc('review_score_submission', action === 'approve'
      ? { p_id: s.id, p_action: 'approve', p_total: total, p_x: xc, p_shot_on: date, p_label: label.trim() || null, p_note: note.trim() || null }
      : { p_id: s.id, p_action: 'reject', p_note: note.trim() || null });
    if (error) { setErr(error.message); setBusy(false); return; }
    await reload();
  }

  return (
    <div className="queueCard">
      <header>
        <b>{displayName(memberById(s.member_id))}</b>
        <span className="formNote">{course?.name ?? s.course_code} · fired {milDate(s.shot_on)} · submitted {when(s.submitted_at)}</span>
      </header>
      <div className="queueScore">{scoreText(s.total, s.x_count)}{course?.max_score && <small className="muted"> / {course.max_score}</small>}</div>
      {s.breakdown && s.breakdown.length > 0 && <div className="queueParts">{s.breakdown.map(p => <span key={p.label}>{p.label}: <b>{p.pts}</b>/{p.max}</span>)}</div>}
      {s.notes && <p className="formNote">“{s.notes}”</p>}
      <div className="queueEdit">
        <label>Score<input className="numIn" type="number" inputMode="decimal" min={0} max={course?.max_score ?? undefined} value={t} onChange={e => setT(e.target.value)} /></label>
        <label>X<input className="numIn" type="number" inputMode="numeric" min={0} value={x} onChange={e => setX(e.target.value)} /></label>
        <label>Date<input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
        <label>Practice / match<input className="wideIn" value={label} maxLength={120} onChange={e => setLabel(e.target.value)} /></label>
        <label>Note to shooter <span className="muted">(optional)</span><input className="wideIn" value={note} maxLength={500} onChange={e => setNote(e.target.value)} placeholder="e.g. Fixed X count" /></label>
      </div>
      {err && <p className="alert">{err}</p>}
      <div className="queueActions">
        <button className="primary" disabled={busy || !ok} onClick={() => review('approve')}><Check size={15} /> {edited ? 'Approve with changes' : 'Approve'}</button>
        <button className="secondary danger" disabled={busy} onClick={() => review('reject')}><X size={15} /> Reject</button>
      </div>
    </div>
  );
}

/** Shooters: scores you've sent, with their status. Pending ones can be withdrawn. */
export function MySubmissions() {
  const { me, submissions } = useTeam();
  const mine = submissions.filter(s => s.member_id === me.member_id);
  return (
    <section className="panel">
      <div className="sectionTitle"><h2>Your submitted scores</h2></div>
      {mine.length === 0 ? <Empty title="Nothing submitted yet">Fill in a scorecard on the Match day page and tap “Submit to staff.” It shows on leaderboards once staff approve it.</Empty>
        : <SubmissionTable rows={mine} withdraw />}
    </section>
  );
}

function SubmissionTable({ rows, showShooter, withdraw }: { rows: ScoreSubmission[]; showShooter?: boolean; withdraw?: boolean }) {
  const { sb, courses, scores, memberById, reload } = useTeam();
  const [err, setErr] = useState('');
  // Approved with changes: show what went on the record.
  const final = (s: ScoreSubmission) => scores.find(x => x.id === s.score_id) ?? s;
  async function remove(s: ScoreSubmission) {
    if (!confirm('Withdraw this score? Staff won’t see it anymore.')) return;
    const { error } = await sb.from('score_submissions').delete().eq('id', s.id);
    if (error) setErr(error.message); else await reload();
  }
  return (
    <div className="tableWrap">
      {err && <p className="alert">{err}</p>}
      <table>
        <thead><tr>{showShooter && <th>Shooter</th>}<th>Course</th><th>Fired</th><th className="num">Score</th><th>Submitted</th><th>Status</th>{withdraw && <th />}</tr></thead>
        <tbody>{rows.map(s => (
          <tr key={s.id}>
            {showShooter && <td>{displayName(memberById(s.member_id))}</td>}
            <td>{courses.find(c => c.code === s.course_code)?.name ?? s.course_code}</td>
            <td>{milDate(s.shot_on)}{s.session_label && <small className="sub">{s.session_label}</small>}</td>
            <td className="num"><b>{scoreText(Number(final(s).total), final(s).x_count)}</b></td>
            <td className="nowrap">{when(s.submitted_at)}</td>
            <td>{statusTag(s.status)}{s.review_note && <small className="sub">“{s.review_note}”</small>}</td>
            {withdraw && <td>{s.status === 'pending' && <button className="iconBtn" aria-label="Withdraw" onClick={() => remove(s)}><Trash2 size={14} /></button>}</td>}
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}
