'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Pencil, Plus, Save, Search, Trash2, X } from 'lucide-react';
import type { Member } from '../../lib/types';
import { useTeam } from '../../lib/data';
import type { Score } from '../../lib/types';

const matches = (m: Member | undefined, q: string) => !q.trim() || (!!m && `${m.last_name} ${m.first_name ?? ''} ${m.rank ?? ''} ${m.unit ?? ''}`.toLowerCase().includes(q.trim().toLowerCase()));
import { displayName, downloadCsv, fiscalYear, fullName, milDate, scoreText, todayISO } from '../../lib/util';
import { Empty, Modal, PageTitle, Sparkline, Tag } from './ui';

type Tab = 'board' | 'enter' | 'log';

export default function Scores() {
  const { isStaff } = useTeam();
  const [tab, setTab] = useState<Tab>('board');
  return (
    <div>
      <PageTitle eyebrow="PERFORMANCE" title="Scores">Leaderboards for each match on the Match day page. Tick shooters to compare their trends.</PageTitle>
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
  const { me, isStaff, scores, courses, members, memberById } = useTeam();
  const [picked, setPicked] = useState<string[] | null>(null);
  const [editing, setEditing] = useState<Score | null>(null);
  const [code, setCode] = useState('PISTOL_EIC');
  const [period, setPeriod] = useState('all');
  const [current, setCurrent] = useState(true);
  const [q, setQ] = useState('');
  const course = courses.find(c => c.code === code);
  const today = todayISO();
  const fy = fiscalYear(today);
  const yearAgo = `${+today.slice(0, 4) - 1}${today.slice(4)}`;
  const filtered = useMemo(() => scores.filter(s => s.course_code === code && s.total != null)
    .filter(s => period === 'all' || (s.shot_on && (period === 'fy' ? fiscalYear(s.shot_on) === fy : period === 'lastfy' ? fiscalYear(s.shot_on) === fy - 1 : s.shot_on >= yearAgo))), [scores, code, period, fy, yearAgo]);
  const rows = useMemo(() => {
    const list = filtered;
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
  }, [filtered, current, members]);
  // Default selection: you (if you have scores here), otherwise the top three.
  const selected = (picked ?? (rows.some(r => r.m!.id === me.member_id) ? [me.member_id!] : rows.slice(0, 3).map(r => r.m!.id))).filter(id => rows.some(r => r.m!.id === id));
  const colorOf = (id: string) => SERIES_COLORS[selected.indexOf(id) % SERIES_COLORS.length];
  function toggle(id: string) {
    setPicked(selected.includes(id) ? selected.filter(x => x !== id) : selected.length >= SERIES_COLORS.length ? selected : [...selected, id]);
  }
  const series = selected.map(id => ({ id, name: displayName(memberById(id)), color: colorOf(id), points: filtered.filter(s => s.member_id === id && s.shot_on).map(s => ({ date: s.shot_on!, value: Number(s.total), score: s })).sort((a, b) => (a.date < b.date ? -1 : 1)) }));
  const detail = filtered.filter(s => selected.includes(s.member_id)).sort((a, b) => ((b.shot_on ?? '') > (a.shot_on ?? '') ? 1 : (b.shot_on ?? '') < (a.shot_on ?? '') ? -1 : 0));

  return (
    <section className="panel">
      <div className="filters">
        <label>Course<select value={code} onChange={e => setCode(e.target.value)}>{courses.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}</select></label>
        <label>Period<select value={period} onChange={e => setPeriod(e.target.value)}>
          <option value="all">All time</option><option value="fy">FY{String(fy).slice(2)}</option><option value="lastfy">FY{String(fy - 1).slice(2)}</option><option value="12m">Last 12 months</option>
        </select></label>
        <label className="check"><input type="checkbox" checked={current} onChange={e => setCurrent(e.target.checked)} /> Current roster only</label>
        <label className="search"><Search size={16} /><input placeholder="Search shooters…" value={q} onChange={e => setQ(e.target.value)} aria-label="Search shooters" /></label>
      </div>
      {rows.length === 0 ? <Empty title="No scores for this filter">{current ? 'Try including everyone, or a longer period.' : 'Scores entered for this course will rank here.'}</Empty> : (
        <div className="tableWrap"><table className="board">
          <thead><tr><th>#</th><th><span className="sr">Compare</span></th><th>Shooter</th><th className="num">Best</th><th className="num">Average</th><th className="num">Fired</th><th>Last</th><th>Trend</th></tr></thead>
          <tbody>{rows.map((r, i) => matches(r.m, q) && (
            <tr key={r.m!.id} className={`${r.m!.id === me.member_id ? 'meRow' : ''} ${selected.includes(r.m!.id) ? 'picked' : ''}`}>
              <td>{i + 1}</td>
              <td className="pick"><label className="pickBox" style={selected.includes(r.m!.id) ? { background: colorOf(r.m!.id), borderColor: colorOf(r.m!.id) } : undefined}>
                <input type="checkbox" checked={selected.includes(r.m!.id)} disabled={!selected.includes(r.m!.id) && selected.length >= SERIES_COLORS.length} onChange={() => toggle(r.m!.id)} aria-label={`Compare ${displayName(r.m)}`} />
              </label></td>
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
      <p className="formNote">Ties are broken by X count. Tick up to {SERIES_COLORS.length} shooters to compare them below.</p>
      {q && rows.every(r => !matches(r.m, q)) && <p className="formNote">No one on this leaderboard matches “{q}”.</p>}

      {rows.length > 0 && (
        <div className="compare">
          <div className="sectionTitle"><h2>Trends · {course?.name ?? code}</h2>
            {selected.length > 0 && <button className="linkBtn" onClick={() => setPicked([])}>Clear selection</button>}
          </div>
          {selected.length === 0 ? <p className="formNote">Tick shooters in the leaderboard to see their trends.</p> : <>
            <div className="legend">{series.map(se => <button key={se.id} className="legendItem" onClick={() => toggle(se.id)} title="Remove from chart"><i style={{ background: se.color }} />{se.name}<X size={12} /></button>)}</div>
            <ScoreChart series={series} max={course?.max_score ?? null} />
            <h3 className="compareHead">Individual scores</h3>
            <div className="tableWrap"><table>
              <thead><tr><th>Date</th><th>Practice / match</th>{selected.length > 1 && <th>Shooter</th>}<th className="num">Score</th>{course?.max_score && <th className="num">%</th>}{isStaff && <th />}</tr></thead>
              <tbody>{detail.map(s => (
                <tr key={s.id}>
                  <td>{s.shot_on ? milDate(s.shot_on) : <Tag>Undated</Tag>}</td>
                  <td>{s.session_label ?? '—'}</td>
                  {selected.length > 1 && <td className="nowrap"><span className="dot" style={{ background: colorOf(s.member_id) }} />{memberById(s.member_id)?.last_name}</td>}
                  <td className="num"><b>{scoreText(s.total, s.x_count, s.raw)}</b></td>
                  {course?.max_score && <td className="num">{Math.round((Number(s.total) / course.max_score) * 100)}%</td>}
                  {isStaff && <td><button className="iconBtn" aria-label="Edit score" onClick={() => setEditing(s)}><Pencil size={14} /></button></td>}
                </tr>
              ))}</tbody>
            </table></div>
          </>}
        </div>
      )}
      {editing && <EditScore score={editing} onClose={() => setEditing(null)} />}
    </section>
  );
}

const SERIES_COLORS = ['#2f5a78', '#b8893e', '#9a3a2c', '#3f6b45', '#6b4c8a', '#1f8a86'];

type Series = { id: string; name: string; color: string; points: { date: string; value: number; score: Score }[] };

function ScoreChart({ series, max }: { series: Series[]; max: number | null }) {
  const [hover, setHover] = useState<{ x: number; y: number; text: string; color: string } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(760);
  useEffect(() => {
    const el = box.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el); return () => ro.disconnect();
  }, []);
  const all = series.flatMap(s => s.points);
  if (all.length === 0) return <div ref={box}><p className="formNote">No dated scores for the selected shooters in this period.</p></div>;
  const H = W < 500 ? 220 : 280, L = 40, R = 12, T = 14, B = 30;
  const nX = W < 500 ? 3 : 5;
  const toDay = (d: string) => Date.parse(d + 'T00:00:00Z') / 86400000;
  let x0 = Math.min(...all.map(p => toDay(p.date))), x1 = Math.max(...all.map(p => toDay(p.date)));
  if (x0 === x1) { x0 -= 15; x1 += 15; }
  const vals = all.map(p => p.value);
  const top = max ?? Math.max(...vals);
  const step = niceStep((top - Math.min(...vals)) / 4 || top / 4);
  const lo = Math.max(0, Math.floor((Math.min(...vals) - step / 2) / step) * step);
  const hi = Math.ceil(top / step) * step;
  const sx = (d: string) => L + ((toDay(d) - x0) / (x1 - x0)) * (W - L - R);
  const sy = (v: number) => T + (1 - (v - lo) / Math.max(1, hi - lo)) * (H - T - B);
  const yTicks: number[] = []; for (let v = lo; v <= hi + 1e-9; v += step) yTicks.push(v);
  const xTicks = Array.from({ length: nX }, (_, i) => x0 + ((x1 - x0) * i) / (nX - 1));
  const fmt = (day: number) => new Date(day * 86400000).toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' });
  return (
    <div className="chartBox" ref={box} onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label="Score trends for the selected shooters">
        {yTicks.map(v => <g key={v}><line x1={L} x2={W - R} y1={sy(v)} y2={sy(v)} className="grid" /><text x={L - 8} y={sy(v) + 4} textAnchor="end" className="axis">{v}</text></g>)}
        {xTicks.map((d, i) => <text key={i} x={L + ((d - x0) / (x1 - x0)) * (W - L - R)} y={H - 10} textAnchor={i === 0 ? 'start' : i === nX - 1 ? 'end' : 'middle'} className="axis">{fmt(d)}</text>)}
        {series.map(se => <g key={se.id}>
          {se.points.length > 1 && <polyline points={se.points.map(p => `${sx(p.date)},${sy(p.value)}`).join(' ')} fill="none" stroke={se.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
          {se.points.map(p => <circle key={p.score.id} cx={sx(p.date)} cy={sy(p.value)} r="4.5" fill={se.color} stroke="#fffefa" strokeWidth="1.5"
            onMouseEnter={() => setHover({ x: sx(p.date) / W, y: sy(p.value) / H, color: se.color, text: `${se.name} · ${scoreText(p.score.total, p.score.x_count, p.score.raw)} · ${milDate(p.date)}${p.score.session_label ? ' · ' + p.score.session_label : ''}` })} />)}
        </g>)}
      </svg>
      {hover && <div className="chartTip" style={{ left: `${hover.x * 100}%`, top: `${hover.y * 100}%`, borderColor: hover.color, transform: `translate(${hover.x > 0.7 ? '-100%' : hover.x < 0.3 ? '0' : '-50%'}, calc(-100% - 12px))`, whiteSpace: W < 500 ? 'normal' : 'nowrap', maxWidth: W < 500 ? 220 : undefined }}>{hover.text}</div>}
    </div>
  );
}

function niceStep(raw: number) {
  const p = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1))));
  const n = raw / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

function sessionLabels(scores: Score[]) {
  return [...new Set(scores.map(s => s.session_label).filter((x): x is string => !!x))].sort();
}

type Entry = { key: number; member_id: string; t: string; x: string };
let entryKey = 0;
const newEntry = (member_id: string): Entry => ({ key: ++entryKey, member_id, t: '', x: '' });

function EnterScores({ onDone }: { onDone: () => void }) {
  const { sb, scores, members, courses, reload } = useTeam();
  const [label, setLabel] = useState('');
  const [date, setDate] = useState(todayISO());
  const [code, setCode] = useState('PISTOL_EIC');
  const course = courses.find(c => c.code === code);
  const [entries, setEntries] = useState<Entry[]>([]);
  const name = (id: string) => fullName(members.find(m => m.id === id));
  const ordered = [...entries].sort((a, b) => name(a.member_id).localeCompare(name(b.member_id)) || a.key - b.key);
  const has = new Set(entries.map(e => e.member_id));
  const current = members.filter(m => m.team_status !== 'Inactive').sort((a, b) => fullName(a).localeCompare(fullName(b)));
  const [busy, setBusy] = useState(false), [err, setErr] = useState('');
  const filled = entries.filter(e => e.t !== '').length;
  const set = (key: number, patch: Partial<Entry>) => setEntries(entries.map(e => (e.key === key ? { ...e, ...patch } : e)));

  async function save() {
    setErr('');
    if (!label.trim()) { setErr('Type the practice or match name.'); return; }
    const rows = entries.filter(e => e.t !== '').map(e => {
      const total = Number(e.t), x = course?.has_x && e.x !== '' ? Number(e.x) : null;
      return { member_id: e.member_id, course_code: code, event_id: null, shot_on: date || null, session_label: label.trim(), total, x_count: x, raw: scoreText(total, x) };
    });
    if (!rows.length) { setErr('Enter at least one score.'); return; }
    const bad = rows.find(r => !scoreOk(r.total, r.x_count, course?.max_score));
    if (bad) { setErr(`Check ${name(bad.member_id)}: score must be 0–${course?.max_score ?? '∞'} and X count a whole number.`); return; }
    setBusy(true);
    const { error } = await sb.from('scores').insert(rows);
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setEntries([]);
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
          {ordered.map((e, i) => {
            const first = i === 0 || ordered[i - 1].member_id !== e.member_id;
            const n = entries.filter(x => x.member_id === e.member_id).length;
            const idx = ordered.slice(0, i + 1).filter(x => x.member_id === e.member_id).length;
            return (
              <tr key={e.key} className={first ? '' : 'again'}>
                <td>{first ? name(e.member_id) : ''}{n > 1 && <small className="sub">Score {idx} of {n}</small>}</td>
                <td className="num"><input className="numIn" type="number" inputMode="numeric" min={0} max={course?.max_score ?? undefined} value={e.t} onChange={ev => set(e.key, { t: ev.target.value })} aria-label={`${name(e.member_id)} score ${idx}`} /></td>
                {course?.has_x && <td className="num"><input className="numIn" type="number" inputMode="numeric" min={0} value={e.x} onChange={ev => set(e.key, { x: ev.target.value })} aria-label={`${name(e.member_id)} X count ${idx}`} /></td>}
                <td className="rowActions">
                  <button className="iconBtn" title="Add another score for this shooter" aria-label={`Add another score for ${name(e.member_id)}`} onClick={() => setEntries([...entries, newEntry(e.member_id)])}><Plus size={14} /></button>
                  <button className="iconBtn" title="Remove this row" aria-label="Remove this row" onClick={() => setEntries(entries.filter(x => x.key !== e.key))}><X size={14} /></button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table></div>
      <div className="row addRow">
              <select value="" onChange={e => e.target.value && setEntries([...entries, newEntry(e.target.value)])}>
          <option value="">+ Add a shooter…</option>
          {current.filter(m => !has.has(m.id)).map(m => <option key={m.id} value={m.id}>{fullName(m)}</option>)}
        </select>
              {current.some(m => !has.has(m.id)) && <button className="linkBtn" onClick={() => setEntries([...entries, ...current.filter(m => !has.has(m.id)).map(m => newEntry(m.id))])}>Add everyone not inactive</button>}
            </div>
      <p className="formNote">Shot the same course more than once today? Use + on a shooter’s row to add another score for them.</p>
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
  const list = [...scores].filter(s => (!code || s.course_code === code) && matches(memberById(s.member_id), who))
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
        <label className="search"><Search size={16} /><input placeholder="Search shooters…" value={who} onChange={e => setWho(e.target.value)} aria-label="Search shooters" /></label>
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
