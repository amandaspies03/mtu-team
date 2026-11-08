'use client';
import { useMemo, useState } from 'react';
import { Download, Pencil, Save, Trash2, X } from 'lucide-react';
import { useTeam } from '../../lib/data';
import type { Score } from '../../lib/types';
import { displayName, downloadCsv, fiscalYear, fullName, milDate, scoreText, todayISO } from '../../lib/util';
import { Empty, Modal, PageTitle, Sparkline, Tag } from './ui';

type Tab = 'board' | 'enter' | 'log';

export default function Scores() {
  const { isStaff } = useTeam();
  const [tab, setTab] = useState<Tab>('board');
  return (
    <div>
      <PageTitle eyebrow="PERFORMANCE" title="Scores">Leaderboards for each match on the Match day page.</PageTitle>
      <div className="tabs">
        <button className={tab === 'board' ? 'on' : ''} onClick={() => setTab('board')}>Leaderboard</button>
        {isStaff && <button className={tab === 'enter' ? 'on' : ''} onClick={() => setTab('enter')}>Enter scores</button>}
        <button className={tab === 'log' ? 'on' : ''} onClick={() => setTab('log')}>All entries</button>
      </div>
      {tab === 'board' && <Leaderboard />}
      {tab === 'enter' && isStaff && <EnterScores onDone={() => setTab('log')} />}
      {tab === 'log' && <ScoreLog />}
    </div>
  );
}

const better = (a: Score, b: Score | null) => !b || Number(a.total) > Number(b.total) || (Number(a.total) === Number(b.total) && (a.x_count ?? 0) > (b.x_count ?? 0));

function Leaderboard() {
  const { me, scores, courses, members } = useTeam();
  const [code, setCode] = useState('PISTOL_EIC');
  const [period, setPeriod] = useState('all');
  const [current, setCurrent] = useState(true);
  const course = courses.find(c => c.code === code);
  const today = todayISO();
  const fy = fiscalYear(today);
  const yearAgo = `${+today.slice(0, 4) - 1}${today.slice(4)}`;
  const rows = useMemo(() => {
    const list = scores.filter(s => s.course_code === code && s.total != null)
      .filter(s => period === 'all' || (s.shot_on && (period === 'fy' ? fiscalYear(s.shot_on) === fy : period === 'lastfy' ? fiscalYear(s.shot_on) === fy - 1 : s.shot_on >= yearAgo)));
    const by = new Map<string, Score[]>();
    list.forEach(s => by.set(s.member_id, [...(by.get(s.member_id) ?? []), s]));
    return [...by.entries()].map(([mid, ss]) => {
      const m = members.find(x => x.id === mid);
      const best = ss.reduce<Score | null>((b, s) => (better(s, b) ? s : b), null)!;
      const avg = ss.reduce((t, s) => t + Number(s.total), 0) / ss.length;
      const dated = ss.filter(s => s.shot_on).sort((a, b) => (a.shot_on! < b.shot_on! ? -1 : 1));
      return { m, best, avg, n: ss.length, last: dated[dated.length - 1], trend: dated.map(s => Number(s.total)) };
    }).filter(r => r.m && (!current || ['Active', 'New', 'Tryout'].includes(r.m.team_status)))
      .sort((a, b) => (better(a.best, b.best) ? -1 : 1));
  }, [scores, code, period, current, members, fy, yearAgo]);

  return (
    <section className="panel">
      <div className="filters">
        <label>Course<select value={code} onChange={e => setCode(e.target.value)}>{courses.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}</select></label>
        <label>Period<select value={period} onChange={e => setPeriod(e.target.value)}>
          <option value="all">All time</option><option value="fy">FY{String(fy).slice(2)}</option><option value="lastfy">FY{String(fy - 1).slice(2)}</option><option value="12m">Last 12 months</option>
        </select></label>
        <label className="check"><input type="checkbox" checked={current} onChange={e => setCurrent(e.target.checked)} /> Current roster only</label>
      </div>
      {rows.length === 0 ? <Empty title="No scores for this filter">{current ? 'Try including everyone, or a longer period.' : 'Scores entered for this course will rank here.'}</Empty> : (
        <div className="tableWrap"><table className="board">
          <thead><tr><th>#</th><th>Shooter</th><th className="num">Best</th><th className="num">Average</th><th className="num">Fired</th><th>Last</th><th>Trend</th></tr></thead>
          <tbody>{rows.map((r, i) => (
            <tr key={r.m!.id} className={r.m!.id === me.member_id ? 'meRow' : ''}>
              <td>{i + 1}</td>
              <td><a href={`#member/${r.m!.id}`}>{displayName(r.m)}</a></td>
              <td className="num"><b>{scoreText(r.best.total, r.best.x_count)}</b>{course?.max_score && <small className="sub">{Math.round((Number(r.best.total) / course.max_score) * 100)}%</small>}</td>
              <td className="num">{r.avg.toFixed(1)}</td>
              <td className="num">{r.n}</td>
              <td>{r.last ? `${scoreText(r.last.total, r.last.x_count)} · ${milDate(r.last.shot_on)}` : '—'}</td>
              <td className="trend"><Sparkline values={r.trend.slice(-10)} max={course?.max_score} /></td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
      <p className="formNote">Ties are broken by X count.</p>
    </section>
  );
}

function sessionLabels(scores: Score[]) {
  return [...new Set(scores.map(s => s.session_label).filter((x): x is string => !!x))].sort();
}

function EnterScores({ onDone }: { onDone: () => void }) {
  const { sb, scores, members, courses, reload } = useTeam();
  const [label, setLabel] = useState('');
  const [date, setDate] = useState(todayISO());
  const [code, setCode] = useState('PISTOL_EIC');
  const course = courses.find(c => c.code === code);
  const [ids, setIds] = useState<string[]>([]);
  const shooters = members.filter(m => ids.includes(m.id)).sort((a, b) => fullName(a).localeCompare(fullName(b)));
  const current = members.filter(m => m.team_status !== 'Inactive');
  const [vals, setVals] = useState<Record<string, { t: string; x: string }>>({});
  const [busy, setBusy] = useState(false), [err, setErr] = useState('');

  const filled = Object.entries(vals).filter(([id, v]) => ids.includes(id) && v.t !== '').length;
  function remove(id: string) {
    setIds(ids.filter(x => x !== id));
    const v = { ...vals }; delete v[id]; setVals(v);
  }
  async function save() {
    setErr('');
    if (!label.trim()) { setErr('Type the practice or match name.'); return; }
    const rows = Object.entries(vals).filter(([id, v]) => ids.includes(id) && v.t !== '').map(([member_id, v]) => {
      const total = Number(v.t), x = v.x === '' ? null : Number(v.x);
      return { member_id, course_code: code, event_id: null, shot_on: date || null, session_label: label.trim(), total, x_count: course?.has_x ? x : null, raw: scoreText(total, course?.has_x ? x : null) };
    });
    if (!rows.length) { setErr('Enter at least one score.'); return; }
    const bad = rows.find(r => !scoreOk(r.total, r.x_count, course?.max_score));
    if (bad) { setErr(`Check ${fullName(members.find(m => m.id === bad.member_id))}: score must be 0–${course?.max_score ?? '∞'} and X count a whole number.`); return; }
    setBusy(true);
    const { error } = await sb.from('scores').insert(rows);
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setVals({});
    await reload();
    onDone();
  }

  return (
    <section className="panel">
      <div className="formGrid three">
        <label>Practice / match<input list="sessionLabels" value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Practice, TAG Match, Winston P. Wilson" required /></label>
        <label>Date fired<input type="date" value={date} onChange={e => setDate(e.target.value)} required /></label>
        <label>Course of fire<select value={code} onChange={e => setCode(e.target.value)}>{courses.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}</select></label>
      </div>
      <datalist id="sessionLabels">{sessionLabels(scores).map(l => <option key={l} value={l} />)}</datalist>
      <div className="tableWrap"><table className="entry">
        <thead><tr><th>Shooter</th><th className="num">Score{course?.max_score ? ` / ${course.max_score}` : ''}</th>{course?.has_x && <th className="num">X count</th>}<th /></tr></thead>
        <tbody>
          {shooters.map(m => (
            <tr key={m.id}>
              <td>{fullName(m)}</td>
              <td className="num"><input className="numIn" type="number" inputMode="numeric" min={0} max={course?.max_score ?? undefined} value={vals[m.id]?.t ?? ''} onChange={e => setVals({ ...vals, [m.id]: { t: e.target.value, x: vals[m.id]?.x ?? '' } })} /></td>
              {course?.has_x && <td className="num"><input className="numIn" type="number" inputMode="numeric" min={0} value={vals[m.id]?.x ?? ''} onChange={e => setVals({ ...vals, [m.id]: { t: vals[m.id]?.t ?? '', x: e.target.value } })} /></td>}
              <td><button className="iconBtn" aria-label={`Remove ${fullName(m)}`} onClick={() => remove(m.id)}><X size={14} /></button></td>
            </tr>
          ))}
          <tr><td colSpan={4}>
            <div className="row">
              <select value="" onChange={e => e.target.value && setIds([...ids, e.target.value])}>
                <option value="">+ Add a shooter…</option>
                {current.filter(m => !ids.includes(m.id)).sort((a, b) => fullName(a).localeCompare(fullName(b))).map(m => <option key={m.id} value={m.id}>{fullName(m)}</option>)}
              </select>
              {current.some(m => !ids.includes(m.id)) && <button className="linkBtn" onClick={() => setIds([...new Set([...ids, ...current.map(m => m.id)])])}>Add everyone not inactive</button>}
            </div>
          </td></tr>
        </tbody>
      </table></div>
      {err && <p className="alert">{err}</p>}
      <div className="formActions"><button className="primary" disabled={busy} onClick={save}><Save size={15} /> {busy ? 'Saving…' : filled === 1 ? 'Save 1 score' : `Save ${filled || ''} scores`}</button></div>
    </section>
  );
}

function scoreOk(total: number, x: number | null, max: number | null | undefined) {
  return Number.isFinite(total) && total >= 0 && (max == null || total <= max) && (x == null || (x >= 0 && Number.isInteger(x)));
}

function EditScore({ score, onClose }: { score: Score; onClose: () => void }) {
  const { sb, scores, courses, memberById, reload } = useTeam();
  const [label, setLabel] = useState(score.session_label ?? '');
  const [date, setDate] = useState(score.shot_on ?? '');
  const [code, setCode] = useState(score.course_code);
  const [t, setT] = useState(score.total == null ? '' : String(score.total));
  const [x, setX] = useState(score.x_count == null ? '' : String(score.x_count));
  const course = courses.find(c => c.code === code);
  const [busy, setBusy] = useState(false), [err, setErr] = useState('');
  async function save() {
    setErr('');
    if (t === '') { setErr('Enter a score.'); return; }
    const total = Number(t), xc = course?.has_x && x !== '' ? Number(x) : null;
    if (!scoreOk(total, xc, course?.max_score)) { setErr(`Score must be 0–${course?.max_score ?? '∞'} and X count a whole number.`); return; }
    setBusy(true);
    const { error } = await sb.from('scores').update({ session_label: label.trim() || null, shot_on: date || null, course_code: code, total, x_count: xc, raw: scoreText(total, xc) }).eq('id', score.id);
    setBusy(false);
    if (error) { setErr(error.message); return; }
    await reload();
    onClose();
  }
  return (
    <Modal title={`Edit score · ${fullName(memberById(score.member_id))}`} onClose={onClose}>
      <div className="form">
        <label>Practice / match<input list="editSessionLabels" value={label} onChange={e => setLabel(e.target.value)} /></label>
        <datalist id="editSessionLabels">{sessionLabels(scores).map(l => <option key={l} value={l} />)}</datalist>
        <div className="formGrid">
          <label>Date fired<input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
          <label>Course of fire<select value={code} onChange={e => setCode(e.target.value)}>{courses.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}</select></label>
          <label>Score{course?.max_score ? ` / ${course.max_score}` : ''}<input type="number" inputMode="numeric" min={0} value={t} onChange={e => setT(e.target.value)} /></label>
          {course?.has_x && <label>X count<input type="number" inputMode="numeric" min={0} value={x} onChange={e => setX(e.target.value)} /></label>}
        </div>
        {err && <p className="alert">{err}</p>}
        <div className="formActions"><button className="secondary" onClick={onClose}>Cancel</button><button className="primary" disabled={busy} onClick={save}><Save size={15} /> {busy ? 'Saving…' : 'Save'}</button></div>
      </div>
    </Modal>
  );
}

function ScoreLog() {
  const { sb, isStaff, scores, courses, members, memberById, reload } = useTeam();
  const [code, setCode] = useState('');
  const [who, setWho] = useState('');
  const [err, setErr] = useState('');
  const [editing, setEditing] = useState<Score | null>(null);
  const list = [...scores].filter(s => (!code || s.course_code === code) && (!who || s.member_id === who))
    .sort((a, b) => (b.shot_on ?? '0') > (a.shot_on ?? '0') ? 1 : (b.shot_on ?? '0') < (a.shot_on ?? '0') ? -1 : (b.created_at > a.created_at ? 1 : -1));
  const cname = (c: string) => courses.find(x => x.code === c)?.name ?? c;
  async function del(s: Score) {
    if (!confirm(`Delete ${scoreText(s.total, s.x_count, s.raw)} for ${fullName(memberById(s.member_id))}?`)) return;
    const { error } = await sb.from('scores').delete().eq('id', s.id);
    if (error) setErr(error.message); else reload();
  }
  return (
    <section className="panel">
      <div className="filters">
        <label>Course<select value={code} onChange={e => setCode(e.target.value)}><option value="">All courses</option>{courses.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}</select></label>
        <label>Shooter<select value={who} onChange={e => setWho(e.target.value)}><option value="">Everyone</option>{members.filter(m => scores.some(s => s.member_id === m.id)).map(m => <option key={m.id} value={m.id}>{fullName(m)}</option>)}</select></label>
        <button className="secondary" onClick={() => downloadCsv(`MTU scores ${todayISO()}.csv`, [['Date', 'Session', 'Last', 'First', 'Course', 'Score', 'X', 'As recorded'], ...list.map(s => { const m = memberById(s.member_id); return [s.shot_on, s.session_label, m?.last_name, m?.first_name, cname(s.course_code), s.total, s.x_count, s.raw]; })])}><Download size={15} /> CSV</button>
      </div>
      {err && <p className="alert">{err}</p>}
      <div className="tableWrap"><table>
        <thead><tr><th>Date</th><th>Practice / match</th><th>Shooter</th><th>Course</th><th className="num">Score</th><th>As recorded</th>{isStaff && <th />}</tr></thead>
        <tbody>{list.slice(0, 400).map(s => (
          <tr key={s.id}>
            <td>{s.shot_on ? milDate(s.shot_on) : <Tag>Undated</Tag>}</td>
            <td>{s.session_label ?? '—'}</td>
            <td><a href={`#member/${s.member_id}`}>{fullName(memberById(s.member_id))}</a></td>
            <td>{cname(s.course_code)}</td>
            <td className="num">{scoreText(s.total, s.x_count, s.raw)}</td>
            <td><small>{s.raw}</small></td>
            {isStaff && <td className="rowActions"><button className="iconBtn" aria-label="Edit score" onClick={() => setEditing(s)}><Pencil size={14} /></button><button className="iconBtn" aria-label="Delete score" onClick={() => del(s)}><Trash2 size={14} /></button></td>}
          </tr>
        ))}</tbody>
      </table></div>
      {editing && <EditScore score={editing} onClose={() => setEditing(null)} />}
      {list.length > 400 && <p className="formNote">Showing the latest 400 of {list.length}. Filter or export to see the rest.</p>}
    </section>
  );
}
