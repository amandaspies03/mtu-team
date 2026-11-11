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
  const phone = usePhone();
  return (
    <div>
      <PageTitle eyebrow="PERFORMANCE" title="Match Scores">Leaderboards for each match on the Match day page. Tick shooters to compare their trends.</PageTitle>
      <div className="tabs">
        <button className={tab === 'board' ? 'on' : ''} onClick={() => setTab('board')}>Leaderboard</button>
        {isStaff && <button className={tab === 'enter' ? 'on' : ''} onClick={() => setTab('enter')}>Enter scores</button>}
        <button className={tab === 'log' ? 'on' : ''} onClick={() => setTab('log')}>All entries</button>
      </div>
      {tab === 'board' && <Leaderboard />}
      {tab === 'enter' && isStaff && (phone ? <PhoneEnterScores onDone={() => setTab('log')} /> : <EnterScores onDone={() => setTab('log')} />)}
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
              <td>{isStaff ? <a href={`#member/${r.m!.id}`}>{displayName(r.m)}</a> : displayName(r.m)}</td>
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

type Series = { id: string; name: string; color: string; points: { date: string; value: number; score?: Score; label?: string; id?: string }[] };

export function ScoreChart({ series, max }: { series: Series[]; max: number | null }) {
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
          {se.points.map(p => <circle key={p.id ?? p.score?.id} cx={sx(p.date)} cy={sy(p.value)} r="4.5" fill={se.color} stroke="#fffefa" strokeWidth="1.5"
            onMouseEnter={() => setHover({ x: sx(p.date) / W, y: sy(p.value) / H, color: se.color, text: `${se.name} · ${p.label ?? (p.score ? scoreText(p.score.total, p.score.x_count, p.score.raw) : p.value)} · ${milDate(p.date)}${p.score?.session_label ? ' · ' + p.score.session_label : ''}` })} />)}
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

type Row = { key: number; member_id: string; date: string; label: string; code: string; t: string; x: string };
let rowKey = 0;

/** One score per row: shooter, date, practice/match, course, score. "Add row" copies the last row's date, event and course. */
function EnterScores({ onDone }: { onDone: () => void }) {
  const { scores, members, courses, reload, saveOrQueue } = useTeam();
  const [queuedMsg, setQueuedMsg] = useState('');
  const blank = (prev?: Row): Row => ({ key: ++rowKey, member_id: '', date: prev?.date ?? todayISO(), label: prev?.label ?? '', code: prev?.code ?? courses[0]?.code ?? '', t: '', x: '' });
  const [rows, setRows] = useState<Row[]>(() => [blank()]);
  const [busy, setBusy] = useState(false), [err, setErr] = useState('');
  const shooters = members.filter(m => m.team_status !== 'Inactive').sort((a, b) => fullName(a).localeCompare(fullName(b)));
  const set = (key: number, patch: Partial<Row>) => setRows(rows.map(r => (r.key === key ? { ...r, ...patch } : r)));
  const ready = rows.filter(r => r.member_id && r.t !== '');
  const name = (id: string) => fullName(members.find(m => m.id === id));

  async function save() {
    setErr('');
    if (!ready.length) { setErr('Fill in at least one row with a shooter and a score.'); return; }
    const half = rows.find(r => (r.member_id || r.t !== '') && !(r.member_id && r.t !== ''));
    if (half) { setErr(`Row ${rows.indexOf(half) + 1} needs both a shooter and a score (or clear it).`); return; }
    const noLabel = ready.find(r => !r.label.trim());
    if (noLabel) { setErr(`Row ${rows.indexOf(noLabel) + 1}: type the practice or match (e.g. Practice, TAG Match).`); return; }
    const out = ready.map(r => {
      const c = courses.find(x => x.code === r.code);
      const total = Number(r.t), x = c?.has_x && r.x !== '' ? Number(r.x) : null;
      return { r, c, row: { id: crypto.randomUUID(), member_id: r.member_id, course_code: r.code, event_id: null, shot_on: r.date || null, session_label: r.label.trim(), total, x_count: x, raw: scoreText(total, x) } };
    });
    const bad = out.find(o => !scoreOk(o.row.total, o.row.x_count, o.c?.max_score));
    if (bad) { setErr(`Row ${rows.indexOf(bad.r) + 1} (${name(bad.r.member_id)}): score must be 0–${bad.c?.max_score ?? '∞'} and X count a whole number.`); return; }
    setBusy(true);
    let r: 'sent' | 'queued';
    try { r = await saveOrQueue({ kind: 'scores', label: `${out.length} score${out.length === 1 ? '' : 's'} · ${out[0].row.session_label}`, rows: out.map(o => o.row) }); }
    catch (e) { setBusy(false); setErr((e as { message?: string }).message ?? 'Couldn’t save the scores.'); return; }
    setBusy(false);
    setRows([blank(rows[rows.length - 1])]);
    if (r === 'queued') { setQueuedMsg(`No signal. ${out.length} score${out.length === 1 ? ' is' : 's are'} saved on this device and will send when you’re back in signal.`); return; }
    setQueuedMsg('');
    await reload();
    onDone();
  }

  return (
    <section className="panel">
      <datalist id="sessionLabels">{[...new Set(['Practice', 'TAG Match', 'Regionals', 'Nationals (WPW)', '184th Invitational', ...sessionLabels(scores)])].map(l => <option key={l} value={l} />)}</datalist>
      <div className="tableWrap"><table className="entry rowEntry">
        <thead><tr><th>#</th><th>Shooter</th><th>Date</th><th>Practice / match</th><th>Course of fire</th><th className="num">Score</th><th className="num">X</th><th /></tr></thead>
        <tbody>{rows.map((r, i) => {
          const c = courses.find(x => x.code === r.code);
          return (
            <tr key={r.key}>
              <td className="muted">{i + 1}</td>
              <td><select aria-label={`Row ${i + 1} shooter`} value={r.member_id} onChange={e => set(r.key, { member_id: e.target.value })}>
                <option value="">Select shooter…</option>
                {shooters.map(m => <option key={m.id} value={m.id}>{fullName(m)}</option>)}
              </select></td>
              <td><input type="date" aria-label={`Row ${i + 1} date`} value={r.date} onChange={e => set(r.key, { date: e.target.value })} /></td>
              <td><input list="sessionLabels" aria-label={`Row ${i + 1} practice or match`} placeholder="Practice, TAG Match…" value={r.label} onChange={e => set(r.key, { label: e.target.value })} /></td>
              <td><select aria-label={`Row ${i + 1} course`} value={r.code} onChange={e => set(r.key, { code: e.target.value })}>
                {courses.map(co => <option key={co.code} value={co.code}>{co.name}</option>)}
              </select></td>
              <td className="num"><input className="numIn" type="number" inputMode="numeric" min={0} max={c?.max_score ?? undefined} placeholder={c?.max_score ? `/ ${c.max_score}` : ''} aria-label={`Row ${i + 1} score`} value={r.t} onChange={e => set(r.key, { t: e.target.value })} /></td>
              <td className="num">{c?.has_x ? <input className="numIn xIn" type="number" inputMode="numeric" min={0} aria-label={`Row ${i + 1} X count`} value={r.x} onChange={e => set(r.key, { x: e.target.value })} /> : <span className="muted">—</span>}</td>
              <td><button className="iconBtn" aria-label={`Remove row ${i + 1}`} disabled={rows.length === 1} onClick={() => setRows(rows.filter(x => x.key !== r.key))}><X size={14} /></button></td>
            </tr>
          );
        })}</tbody>
      </table></div>
      <div className="row addRow"><button className="secondary" onClick={() => setRows([...rows, blank(rows[rows.length - 1])])}><Plus size={15} /> Add row</button>
        <span className="formNote">New rows copy the date, practice/match and course from the row above.</span></div>
      {err && <p className="alert">{err}</p>}
      {queuedMsg && <p className="queuedMsg" role="status">{queuedMsg}</p>}
      <div className="formActions"><button className="primary" disabled={busy} onClick={save}><Save size={15} /> {busy ? 'Saving…' : ready.length === 1 ? 'Save 1 score' : `Save ${ready.length || ''} scores`}</button></div>
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
            <td>{isStaff ? <a href={`#member/${s.member_id}`}>{fullName(memberById(s.member_id))}</a> : fullName(memberById(s.member_id))}</td>
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

/** True on phone-width screens only. Tablets and desktops keep the table. */
const PHONE_QUERY = '(max-width: 600px)';
function usePhone() {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(PHONE_QUERY);
    const on = () => setPhone(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return phone;
}

type PhoneRow = { key: number; member_id: string; t: string; x: string; own: boolean; date: string; label: string; code: string };

/** Phone layout: batch details set once, one card per shooter, keypad Next moves Score → X → next shooter, pinned Save. */
function PhoneEnterScores({ onDone }: { onDone: () => void }) {
  const { scores, members, courses, reload, saveOrQueue } = useTeam();
  const [queuedMsg, setQueuedMsg] = useState('');
  const [batch, setBatch] = useState({ date: todayISO(), label: '', code: courses[0]?.code ?? '' });
  const blank = (): PhoneRow => ({ key: ++rowKey, member_id: '', t: '', x: '', own: false, date: '', label: '', code: '' });
  const [rows, setRows] = useState<PhoneRow[]>(() => [blank()]);
  const [busy, setBusy] = useState(false), [err, setErr] = useState('');
  const focusNext = useRef<string | null>(null);
  useEffect(() => {
    if (!focusNext.current) return;
    document.getElementById(focusNext.current)?.focus();
    focusNext.current = null;
  });
  const shooters = members.filter(m => m.team_status !== 'Inactive').sort((a, b) => fullName(a).localeCompare(fullName(b)));
  const set = (key: number, patch: Partial<PhoneRow>) => setRows(rs => rs.map(r => (r.key === key ? { ...r, ...patch } : r)));
  const eff = (r: PhoneRow) => (r.own ? { date: r.date, label: r.label, code: r.code } : batch);
  const courseOf = (r: PhoneRow) => courses.find(c => c.code === eff(r).code);
  const ready = rows.filter(r => r.member_id && r.t !== '');
  const name = (id: string) => fullName(members.find(m => m.id === id));
  const digits = (v: string) => v.replace(/\D/g, '').slice(0, 3);
  const batchCourse = courses.find(c => c.code === batch.code);

  function nextShooter(r: PhoneRow) {
    const i = rows.findIndex(x => x.key === r.key);
    const next = rows[i + 1];
    if (next && !next.member_id) { focusNext.current = `ps-who-${next.key}`; document.getElementById(focusNext.current)?.focus(); focusNext.current = null; return; }
    const n = blank();
    focusNext.current = `ps-who-${n.key}`;
    setRows(rs => { const j = rs.findIndex(x => x.key === r.key); return [...rs.slice(0, j + 1), n, ...rs.slice(j + 1)]; });
  }

  async function save() {
    setErr('');
    if (!ready.length) { setErr('Fill in at least one shooter and score.'); return; }
    const half = rows.find(r => (r.member_id || r.t !== '') && !(r.member_id && r.t !== ''));
    if (half) { setErr(`Shooter ${rows.indexOf(half) + 1} needs both a shooter and a score (or remove it).`); return; }
    const noLabel = ready.find(r => !eff(r).label.trim());
    if (noLabel) { setErr(noLabel.own ? `${name(noLabel.member_id)}: type the practice or match.` : 'Type the practice or match at the top (e.g. Practice, TAG Match).'); return; }
    const out = ready.map(r => {
      const d = eff(r), c = courses.find(x => x.code === d.code);
      const total = Number(r.t), x = c?.has_x && r.x !== '' ? Number(r.x) : null;
      return { r, c, row: { id: crypto.randomUUID(), member_id: r.member_id, course_code: d.code, event_id: null, shot_on: d.date || null, session_label: d.label.trim(), total, x_count: x, raw: scoreText(total, x) } };
    });
    const bad = out.find(o => !scoreOk(o.row.total, o.row.x_count, o.c?.max_score));
    if (bad) { setErr(`${name(bad.r.member_id)}: score must be 0–${bad.c?.max_score ?? '∞'} and X count a whole number.`); return; }
    setBusy(true);
    let r: 'sent' | 'queued';
    try { r = await saveOrQueue({ kind: 'scores', label: `${out.length} score${out.length === 1 ? '' : 's'} · ${out[0].row.session_label}`, rows: out.map(o => o.row) }); }
    catch (e) { setBusy(false); setErr((e as { message?: string }).message ?? 'Couldn’t save the scores.'); return; }
    setBusy(false);
    setRows([blank()]);
    if (r === 'queued') { setQueuedMsg(`No signal. ${out.length} score${out.length === 1 ? ' is' : 's are'} saved on this phone and will send when you’re back in signal.`); return; }
    setQueuedMsg('');
    await reload();
    onDone();
  }

  return (
    <div className="phoneEntry">
      <datalist id="sessionLabelsPhone">{[...new Set(['Practice', 'TAG Match', 'Regionals', 'Nationals (WPW)', '184th Invitational', ...sessionLabels(scores)])].map(l => <option key={l} value={l} />)}</datalist>
      <section className="panel peBatch">
        <div className="peBatchHead"><h2>For this batch</h2><span>Applies to every shooter below</span></div>
        <div className="peTwo">
          <label>Date<input type="date" value={batch.date} onChange={e => setBatch({ ...batch, date: e.target.value })} /></label>
          <label>Practice / match<input list="sessionLabelsPhone" placeholder="Practice…" value={batch.label} onChange={e => setBatch({ ...batch, label: e.target.value })} /></label>
        </div>
        <label>Course of fire<select value={batch.code} onChange={e => setBatch({ ...batch, code: e.target.value })}>
          {courses.map(co => <option key={co.code} value={co.code}>{co.name}</option>)}
        </select></label>
      </section>

      {rows.map((r, i) => {
        const c = courseOf(r);
        return (
          <section className="panel peCard" key={r.key}>
            <div className="peTop">
              <span className="peNum">{i + 1}</span>
              <select id={`ps-who-${r.key}`} aria-label={`Shooter ${i + 1}`} value={r.member_id} onChange={e => {
                set(r.key, { member_id: e.target.value });
                if (e.target.value) focusNext.current = `ps-t-${r.key}`;
              }}>
                <option value="">Select shooter…</option>
                {shooters.map(m => <option key={m.id} value={m.id}>{fullName(m)}</option>)}
              </select>
              <button className="iconBtn" aria-label={`Remove shooter ${i + 1}`} disabled={rows.length === 1} onClick={() => setRows(rows.filter(x => x.key !== r.key))}><X size={18} /></button>
            </div>
            <div className={`peScores${c?.has_x ? '' : ' noX'}`}>
              <label>Score<input id={`ps-t-${r.key}`} inputMode="numeric" pattern="[0-9]*" enterKeyHint="next" placeholder={c?.max_score ? `/ ${c.max_score}` : ''} value={r.t}
                onChange={e => set(r.key, { t: digits(e.target.value) })}
                onKeyDown={e => { if (e.key !== 'Enter') return; e.preventDefault(); if (c?.has_x) document.getElementById(`ps-x-${r.key}`)?.focus(); else nextShooter(r); }} /></label>
              {c?.has_x && <label>X count<input id={`ps-x-${r.key}`} inputMode="numeric" pattern="[0-9]*" enterKeyHint="next" placeholder="0" value={r.x}
                onChange={e => set(r.key, { x: digits(e.target.value) })}
                onKeyDown={e => { if (e.key !== 'Enter') return; e.preventDefault(); nextShooter(r); }} /></label>}
            </div>
            {r.own ? (
              <div className="peOwn">
                <span className="tag info">Different from the batch</span>
                <div className="peTwo">
                  <label>Date<input type="date" value={r.date} onChange={e => set(r.key, { date: e.target.value })} /></label>
                  <label>Practice / match<input list="sessionLabelsPhone" value={r.label} onChange={e => set(r.key, { label: e.target.value })} /></label>
                </div>
                <label>Course of fire<select value={r.code} onChange={e => set(r.key, { code: e.target.value })}>
                  {courses.map(co => <option key={co.code} value={co.code}>{co.name}</option>)}
                </select></label>
                <button className="peLink" onClick={() => set(r.key, { own: false })}>Use the batch details instead</button>
              </div>
            ) : <button className="peLink" onClick={() => set(r.key, { own: true, date: batch.date, label: batch.label, code: batch.code })}>Different date, match or course for this shooter?</button>}
          </section>
        );
      })}
      <button className="secondary peAdd" onClick={() => { const n = blank(); focusNext.current = `ps-who-${n.key}`; setRows([...rows, n]); }}><Plus size={15} /> Add shooter</button>
      {err && <p className="alert">{err}</p>}
      {queuedMsg && <p className="queuedMsg" role="status">{queuedMsg}</p>}
      <div className="peSave">
        <div><b>{ready.length} score{ready.length === 1 ? '' : 's'} ready</b><span>{batchCourse?.name ?? ''}</span></div>
        <button className="primary" disabled={busy || !ready.length} onClick={save}><Save size={15} /> {busy ? 'Saving…' : `Save ${ready.length || ''}`}</button>
      </div>
    </div>
  );
}
