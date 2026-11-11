'use client';
// 1-Reload-1 (1R1): one shot to slide lock, emergency reload, one shot. IPSC target; a run passes when
// both shots are inside the C-zone (A-zone counts, it sits inside C) and the time is at or under par.
// Par is chosen on the card: Beginner 7.0 s, Intermediate 5.0 s, Advanced 3.0 s (top of each published range).
// Sessions are saved in this browser, like the other drills (see shooter-progression.tsx).
import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { todayISO } from '../../lib/util';
import { Sparkline } from './ui';
import { ScoreChart } from './scores';

type Start = 'low' | 'holster';
const START_LABEL: Record<Start, string> = { low: 'Low ready', holster: 'Holster' };
type Level = 'beginner' | 'intermediate' | 'advanced';
const LEVELS: { id: Level; label: string; par: number; range: string }[] = [
  { id: 'beginner', label: 'Beginner', par: 7.0, range: '6–7 s' },
  { id: 'intermediate', label: 'Intermediate', par: 5.0, range: '4–5 s' },
  { id: 'advanced', label: 'Advanced', par: 3.0, range: '2–3 s' },
];
const par = (l: Level) => LEVELS.find(x => x.id === l)!.par;
const ZONES = ['A', 'C', 'D', 'Miss'] as const;
const inC = (z: string) => z === 'A' || z === 'C';

type Run = { time: string; shot1: string; shot2: string; reload: string };
type Session = { id: string; date: string; start: Start; level: Level; distance: string; notes: string; runs: Run[] };
type Entry = { shooter: string; session: Session; own: boolean };
type ReloadTab = 'leaderboard' | 'drill' | 'entries';

const blankRun = (): Run => ({ time: '', shot1: '', shot2: '', reload: '' });
const newSession = (): Session => ({ id: crypto.randomUUID(), date: todayISO(), start: 'low', level: 'intermediate', distance: '7', notes: '', runs: [blankRun(), blankRun(), blankRun()] });
const num = (v: string) => (v.trim() === '' ? NaN : Number(v));

function runResult(r: Run, level: Level): { state: 'pass' | 'fail' | 'incomplete'; why?: string } {
  if (!(num(r.time) > 0) || !r.shot1 || !r.shot2) return { state: 'incomplete' };
  const hits = inC(r.shot1) && inC(r.shot2), fast = num(r.time) <= par(level);
  if (hits && fast) return { state: 'pass' };
  return { state: 'fail', why: !hits && !fast ? 'Hit + time' : !hits ? 'Outside C' : 'Over par' };
}

/** The highest standard a passing time meets. */
export function reloadLevel(t: number | null) {
  if (t == null) return '—';
  if (t <= 3.0) return 'Advanced';
  if (t <= 5.0) return 'Intermediate';
  if (t <= 7.0) return 'Beginner';
  return 'Building speed';
}

function summarize(s: Session) {
  const done = s.runs.filter(r => runResult(r, s.level).state !== 'incomplete');
  const passed = done.filter(r => runResult(r, s.level).state === 'pass').map(r => num(r.time));
  const hitTimes = done.filter(r => inC(r.shot1) && inC(r.shot2)).map(r => num(r.time));
  const reloads = done.map(r => num(r.reload)).filter(t => t > 0);
  return {
    runs: done.length, passed: passed.length,
    best: hitTimes.length ? Math.min(...hitTimes) : null, // fastest run with both hits in the C-zone
    avg: hitTimes.length ? hitTimes.reduce((a, b) => a + b, 0) / hitTimes.length : null,
    bestReload: reloads.length ? Math.min(...reloads) : null,
    inC: done.reduce((t, r) => t + (inC(r.shot1) ? 1 : 0) + (inC(r.shot2) ? 1 : 0), 0), shots: done.length * 2,
  };
}
const secs = (v: number | null) => (v == null ? '—' : `${v.toFixed(2)} s`);
const timeOnly = (v: string) => v.replace(/[^0-9.]/g, '').slice(0, 6);

export default function ReloadDrill({ storageKey, shooter, drillSelect, tab: tabProp, onTab, onOpenDrill, onBack }: {
  storageKey: string; shooter: string; drillSelect?: React.ReactNode;
  tab?: ReloadTab; onTab?: (t: ReloadTab) => void; onOpenDrill?: () => void; onBack?: () => void;
}) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [card, setCard] = useState<Session>(newSession);
  const [tabLocal, setTabLocal] = useState<ReloadTab>('leaderboard');
  const tab = tabProp ?? tabLocal;
  const setTab = (t: ReloadTab) => { if (t === 'drill' && onOpenDrill) onOpenDrill(); else if (onTab) onTab(t); else setTabLocal(t); };
  const [viewing, setViewing] = useState<Session | null>(null);
  const [status, setStatus] = useState('');

  useEffect(() => {
    try { const saved = localStorage.getItem(storageKey); if (saved) setSessions(JSON.parse(saved)); }
    catch { setStatus('Saved 1-Reload-1 sessions could not be opened on this device.'); }
  }, [storageKey]);

  function persist(next: Session[], msg: string) {
    try { localStorage.setItem(storageKey, JSON.stringify(next)); setSessions(next); setStatus(msg); }
    catch { setStatus('Could not save on this device.'); }
  }
  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!summarize(card).runs) { setStatus('Enter a time and both shot zones for at least one run.'); return; }
    if (card.runs.some(r => (r.time !== '' && !(num(r.time) > 0)) || (r.reload !== '' && !(num(r.reload) > 0)))) { setStatus('Times must be in seconds, like 4.35.'); return; }
    persist([card, ...sessions.filter(s => s.id !== card.id)].sort((a, b) => b.date.localeCompare(a.date)), 'Session saved in this browser.');
    setCard(newSession()); setTab('entries');
  }
  function remove(s: Session) {
    if (!window.confirm('Delete this 1-Reload-1 session?')) return;
    persist(sessions.filter(x => x.id !== s.id), 'Session deleted.');
    if (viewing?.id === s.id) setViewing(null);
  }
  const entries: Entry[] = sessions.map(session => ({ shooter, session, own: true }));

  return (
    <div>
      {!tabProp && <div className="tabs" aria-label="1-Reload-1 views">
        {([['leaderboard', 'Leaderboard'], ['drill', 'Drill & scorecard'], ['entries', 'All entries']] as const).map(([id, title]) =>
          <button type="button" key={id} className={tab === id ? 'on' : ''} onClick={() => { setTab(id); setViewing(null); }}>{title}</button>)}
      </div>}

      {tab === 'leaderboard' && <Leaderboard entries={entries} current={shooter} drillSelect={drillSelect} />}

      {tab === 'entries' && (viewing ? (
        <section className="panel">
          <button className="secondary" type="button" onClick={() => setViewing(null)}>Back to entries</button>
          <SessionCard session={viewing} shooter={shooter} readOnly />
        </section>
      ) : (
        <section className="panel">
          {drillSelect && <div className="filters">{drillSelect}</div>}
          {entries.length === 0 ? <p className="muted">No 1-Reload-1 sessions yet. Open it from the Drills tab to log one.</p> : (
            <div className="tableWrap"><table>
              <thead><tr><th>Date</th><th>Shooter</th><th>Start</th><th>Par</th><th className="num">Runs</th><th className="num">Passed</th><th className="num">Best (hits in C)</th><th>Level</th><th /></tr></thead>
              <tbody>{entries.map(({ session: s, shooter: who }) => {
                const t = summarize(s);
                return <tr key={s.id}>
                  <td>{s.date}</td><td>{who}</td><td>{START_LABEL[s.start]}</td><td>{par(s.level).toFixed(1)} s</td>
                  <td className="num">{t.runs}</td><td className="num">{t.passed}/{t.runs}</td><td className="num">{secs(t.best)}</td><td>{reloadLevel(t.best)}</td>
                  <td className="nowrap">
                    <button className="secondary" type="button" onClick={() => setViewing(s)}>View</button>{' '}
                    <button className="secondary" type="button" onClick={() => { setCard(s); setTab('drill'); setStatus(''); }}>Edit</button>{' '}
                    <button className="secondary" type="button" onClick={() => remove(s)}>Delete</button>
                  </td>
                </tr>;
              })}</tbody>
            </table></div>
          )}
        </section>
      ))}

      {tab === 'drill' && <>
        <DrillInstructions onBack={onBack} />
        <form className="panel scorecardPanel billCard reloadCard" onSubmit={save}>
          <div className="scHead">
            <div><h2>Scorecard</h2><p className="scNote">1-Reload-1 · 2 rounds · IPSC C-zone</p></div>
            <button className="secondary" type="button" onClick={() => { setCard(newSession()); setStatus(''); }}>Clear card</button>
          </div>
          <SessionCard session={card} shooter={shooter} onChange={setCard} />
          <button className="primary" type="submit">Save session</button>
        </form>
      </>}
      {status && <p role="status" className="formNote">{status}</p>}
    </div>
  );
}

function DrillInstructions({ onBack }: { onBack?: () => void }) {
  return (
    <section className="panel">
      {onBack && <button className="secondary" type="button" onClick={onBack}>Back to drills</button>}
      <h2>1-Reload-1</h2>
      <p className="formNote">Tests emergency slide-lock reload speed, grip consistency and immediate follow-through.</p>
      <div className="drillFacts">
        <div><span>Distance</span><b>5–7 yards (handgun)</b></div>
        <div><span>Target</span><b>IPSC target, C-zone</b></div>
        <div><span>Rounds</span><b>2 (1 · reload · 1)</b></div>
      </div>
      <p className="callout">Pass: both shots inside the C-zone (A-zone hits count) and the total time at or under par. Pick the par on the scorecard: Beginner 7.0 s, Intermediate 5.0 s or Advanced 3.0 s.</p>
      <h3>Setup and gear</h3>
      <ul className="drillList">
        <li><b>Firearm:</b> handgun, rifle or shotgun with a detachable spare magazine.</li>
        <li><b>Ammunition:</b> 1 round in the chamber, with an empty or 1-round magazine inserted (depending on whether you want the first shot to lock the slide back immediately). A spare loaded magazine on your belt or in a pouch.</li>
      </ul>
      <h3>Course of fire</h3>
      <ol className="drillList">
        <li><b>Start:</b> low ready, or drawn from the holster.</li>
        <li><b>First shot:</b> raise the firearm and fire one accurate round. The slide or bolt locks back on an empty chamber.</li>
        <li><b>Reload:</b> emergency/combat reload: drop the empty magazine, index and insert a fresh one, release the slide or bolt.</li>
        <li><b>Second shot:</b> get your sight picture quickly and fire a second accurate round.</li>
      </ol>
      <h3>Par times (handgun)</h3>
      <div className="tableWrap"><table className="guideTable">
        <thead><tr><th>Level</th><th>Benchmark</th><th>Par used on the card</th></tr></thead>
        <tbody>
          {LEVELS.map(l => <tr key={l.id}><td>{l.label}</td><td>{l.range}{l.id === 'advanced' ? ' (top competitors and instructors often push under 2 s)' : ''}</td><td>{l.par.toFixed(1)} s</td></tr>)}
        </tbody>
      </table></div>
      <h3>Skills it stresses</h3>
      <ul className="drillList">
        <li><b>Clean manipulation:</b> drop the mag and seat the new one without looking excessively at the mag well.</li>
        <li><b>Recoil management and grip:</b> re-establish a proper, high master grip right after seating the new magazine.</li>
        <li><b>Trigger control:</b> break the second shot cleanly, without jerking, as the sights align.</li>
      </ul>
      <p className="formNote">Benchmarks: <a href="https://www.agirlandagun.org/pistol-reload-drills-slide-lock/" target="_blank" rel="noopener noreferrer">A Girl &amp; A Gun</a>.</p>
    </section>
  );
}

function SessionCard({ session: s, shooter, onChange, readOnly = false }: { session: Session; shooter: string; onChange?: (s: Session) => void; readOnly?: boolean }) {
  const sum = summarize(s);
  const set = (patch: Partial<Session>) => onChange?.({ ...s, ...patch });
  const setRun = (i: number, patch: Partial<Run>) => set({ runs: s.runs.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  const zoneSelect = (i: number, k: 'shot1' | 'shot2', v: string) => (
    <select aria-label={`Run ${i + 1} ${k === 'shot1' ? 'first' : 'second'} shot zone`} value={v} onChange={e => setRun(i, { [k]: e.target.value })}>
      <option value="">–</option>{ZONES.map(z => <option key={z} value={z}>{z}</option>)}
    </select>
  );
  return (
    <fieldset disabled={readOnly} className="billFields">
      <p className="formNote">Shooter: <b>{shooter}</b></p>
      <div className="billTop">
        <label>Date<input type="date" required value={s.date} onChange={e => set({ date: e.target.value })} /></label>
        <label>Start position<select value={s.start} onChange={e => set({ start: e.target.value as Start })}>
          {(Object.keys(START_LABEL) as Start[]).map(k => <option key={k} value={k}>{START_LABEL[k]}</option>)}
        </select></label>
        <label>Par<select value={s.level} onChange={e => set({ level: e.target.value as Level })}>
          {LEVELS.map(l => <option key={l.id} value={l.id}>{l.par.toFixed(1)} s · {l.label}</option>)}
        </select></label>
        <label>Distance<select value={s.distance} onChange={e => set({ distance: e.target.value })}>
          {['5', '6', '7'].map(d => <option key={d} value={d}>{d} yards</option>)}
        </select></label>
      </div>
      <div className="ringTable">
        <div className="tableWrap"><table>
          <thead><tr><th>Run</th><th>Time (s)</th><th>1st</th><th>2nd</th><th>Reload</th><th>Result</th>{!readOnly && <th />}</tr></thead>
          <tbody>{s.runs.map((r, i) => {
            const res = runResult(r, s.level);
            return (
              <tr key={i}>
                <th scope="row">{i + 1}</th>
                <td><input className="billNum" type="text" inputMode="decimal" placeholder="0.00" aria-label={`Run ${i + 1} total time`} value={r.time} onChange={e => setRun(i, { time: timeOnly(e.target.value) })} /></td>
                <td>{zoneSelect(i, 'shot1', r.shot1)}</td>
                <td>{zoneSelect(i, 'shot2', r.shot2)}</td>
                <td><input className="billNum" type="text" inputMode="decimal" placeholder="opt." aria-label={`Run ${i + 1} reload time`} value={r.reload} onChange={e => setRun(i, { reload: timeOnly(e.target.value) })} /></td>
                <td className={`billRes ${res.state === 'pass' ? 'clean' : res.state === 'fail' ? 'not-clean' : ''}`}>{res.state === 'pass' ? 'Pass' : res.state === 'fail' ? <>Fail<small className="sub">{res.why}</small></> : '—'}</td>
                {!readOnly && <td><button type="button" className="iconBtn" aria-label={`Remove run ${i + 1}`} disabled={s.runs.length === 1} onClick={() => set({ runs: s.runs.filter((_, j) => j !== i) })}><X size={14} /></button></td>}
              </tr>
            );
          })}</tbody>
        </table></div>
        {!readOnly && s.runs.length < 12 && <button type="button" className="secondary" onClick={() => set({ runs: [...s.runs, blankRun()] })}><Plus size={14} /> Add run</button>}
      </div>
      <div className="scTotals">
        <div><span>Runs passed</span><b>{sum.passed}<small>/{sum.runs}</small></b></div>
        <div><span>Shots in C-zone</span><b>{sum.inC}<small>/{sum.shots}</small></b></div>
        <div><span>Avg (hits in C)</span><b>{sum.avg == null ? '—' : sum.avg.toFixed(2)}<small>{sum.avg == null ? '' : ' s'}</small></b></div>
        <div><span>Best reload</span><b>{sum.bestReload == null ? '—' : sum.bestReload.toFixed(2)}<small>{sum.bestReload == null ? '' : ' s'}</small></b></div>
        <div className="scGrand"><span>Best run with both hits in C{sum.best != null ? ` · ${reloadLevel(sum.best)}` : ''}</span><b>{sum.best == null ? '—' : sum.best.toFixed(2)}<small>{sum.best == null ? '' : ' s'}</small></b></div>
      </div>
      <label>Session notes<textarea value={s.notes} onChange={e => set({ notes: e.target.value })} /></label>
    </fieldset>
  );
}

function Leaderboard({ entries, current, drillSelect }: { entries: Entry[]; current: string; drillSelect?: React.ReactNode }) {
  const [period, setPeriod] = useState('all'), [start, setStart] = useState<Start | 'all'>('all');
  const [selected, setSelected] = useState<string[]>([current]);
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - Number(period));
  const shown = entries
    .filter(e => period === 'all' || e.session.date >= cutoff.toISOString().slice(0, 10))
    .filter(e => start === 'all' || e.session.start === start)
    .map(e => ({ ...e, t: summarize(e.session) }))
    .filter(e => e.t.best != null)
    .sort((a, b) => a.session.date.localeCompare(b.session.date));
  const rows = [...new Set(shown.map(e => e.shooter))].map(name => {
    const mine = shown.filter(e => e.shooter === name);
    const bests = mine.map(e => e.t.best!);
    return { name, mine, best: Math.min(...bests), avg: bests.reduce((a, b) => a + b, 0) / bests.length, trend: bests };
  }).sort((a, b) => a.best - b.best);
  return (
    <section className="panel">
      <div className="filters">
        {drillSelect}
        <label>Start<select value={start} onChange={e => setStart(e.target.value as Start | 'all')}>
          <option value="all">Any start</option><option value="low">Low ready</option><option value="holster">Holster</option>
        </select></label>
        <label>Period<select value={period} onChange={e => setPeriod(e.target.value)}>
          <option value="all">All time</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="365">Last 12 months</option>
        </select></label>
      </div>
      <p className="formNote">Ranked by fastest run with both shots in the C-zone. Lower is better; level shows which par that time meets.</p>
      {rows.length === 0 ? <p className="muted">No runs with both shots in the C-zone for these filters yet.</p> : <>
        <div className="tableWrap"><table className="board">
          <thead><tr><th>#</th><th>Compare</th><th>Shooter</th><th className="num">Best</th><th>Level</th><th className="num">Avg of session bests</th><th className="num">Sessions</th><th>Trend</th></tr></thead>
          <tbody>{rows.map((r, i) => <tr key={r.name}>
            <td>{i + 1}</td>
            <td><input type="checkbox" aria-label={`Compare ${r.name}`} checked={selected.includes(r.name)} onChange={e => setSelected(e.target.checked ? [...selected, r.name] : selected.filter(n => n !== r.name))} /></td>
            <td>{r.name}</td><td className="num"><b>{r.best.toFixed(2)} s</b></td><td>{reloadLevel(r.best)}</td>
            <td className="num">{r.avg.toFixed(2)} s</td><td className="num">{r.mine.length}</td><td><Sparkline values={r.trend.map(t => -t)} /></td>
          </tr>)}</tbody>
        </table></div>
        {rows.some(r => selected.includes(r.name)) && <div className="compare">
          <h3>Best time by session (seconds)</h3>
          <ScoreChart max={null} series={rows.filter(r => selected.includes(r.name)).map((r, i) => ({
            id: r.name, name: r.name, color: ['#2f5a78', '#b8893e', '#9a3a2c'][i % 3],
            points: r.mine.map(e => ({ id: e.session.id, date: e.session.date, value: e.t.best!, label: `${e.t.best!.toFixed(2)} s` })),
          }))} />
        </div>}
      </>}
    </section>
  );
}
