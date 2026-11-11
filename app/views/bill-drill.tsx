'use client';
// Bill Drill (Bill Wilson, Wilson Combat): 7 yards, IPSC/USPSA A-zone, 6 rounds as fast as possible.
// A run is clean only when all six hits are in the A-zone. Scored by total time; lower is better.
// Sessions are saved in this browser, like the Man Card (see shooter-progression.tsx).
import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { todayISO } from '../../lib/util';
import { Sparkline } from './ui';
import { ScoreChart } from './scores';

type Start = 'holster' | 'low' | 'high';
const START_LABEL: Record<Start, string> = { holster: 'Holster', low: 'Low ready', high: 'High ready' };
type Run = { time: string; hits: string; draw: string };
type Session = { id: string; date: string; start: Start; notes: string; runs: Run[] };
type Entry = { shooter: string; session: Session; own: boolean };

const blankRun = (): Run => ({ time: '', hits: '', draw: '' });
const newSession = (): Session => ({ id: crypto.randomUUID(), date: todayISO(), start: 'holster', notes: '', runs: [blankRun(), blankRun(), blankRun()] });
const num = (v: string) => (v.trim() === '' ? NaN : Number(v));

function runResult(r: Run): 'clean' | 'not-clean' | 'incomplete' {
  if (!(num(r.time) > 0) || r.hits === '') return 'incomplete';
  return Number(r.hits) === 6 ? 'clean' : 'not-clean';
}

/** Where a clean time sits against the published standards (from the holster). */
export function billLevel(t: number | null) {
  if (t == null) return '—';
  if (t < 2.0) return 'Advanced';
  if (t <= 2.5) return 'Intermediate';
  if (t <= 4.0) return 'Beginner';
  return 'Building speed';
}

function summarize(s: Session) {
  const done = s.runs.filter(r => runResult(r) !== 'incomplete');
  const clean = done.filter(r => runResult(r) === 'clean').map(r => num(r.time));
  const draws = done.map(r => num(r.draw)).filter(d => d > 0);
  return {
    runs: done.length,
    clean: clean.length,
    best: clean.length ? Math.min(...clean) : null,
    avg: clean.length ? clean.reduce((a, b) => a + b, 0) / clean.length : null,
    bestDraw: draws.length ? Math.min(...draws) : null,
    hits: done.reduce((t, r) => t + Number(r.hits), 0),
    shots: done.length * 6,
  };
}
const secs = (v: number | null) => (v == null ? '—' : `${v.toFixed(2)} s`);

type BillTab = 'leaderboard' | 'drill' | 'entries';
export default function BillDrill({ storageKey, shooter, drillSelect, tab: tabProp, onTab, onOpenDrill, onBack }: {
  storageKey: string; shooter: string; drillSelect?: React.ReactNode;
  tab?: BillTab; onTab?: (t: BillTab) => void; onOpenDrill?: () => void; onBack?: () => void;
}) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [card, setCard] = useState<Session>(newSession);
  const [tabLocal, setTabLocal] = useState<BillTab>('leaderboard');
  const tab = tabProp ?? tabLocal;
  const setTab = (t: BillTab) => { if (t === 'drill' && onOpenDrill) onOpenDrill(); else if (onTab) onTab(t); else setTabLocal(t); };
  const [viewing, setViewing] = useState<Session | null>(null);
  const [status, setStatus] = useState('');

  useEffect(() => {
    try { const saved = localStorage.getItem(storageKey); if (saved) setSessions(JSON.parse(saved)); }
    catch { setStatus('Saved Bill Drill sessions could not be opened on this device.'); }
  }, [storageKey]);

  function persist(next: Session[], msg: string) {
    try { localStorage.setItem(storageKey, JSON.stringify(next)); setSessions(next); setStatus(msg); }
    catch { setStatus('Could not save on this device.'); }
  }
  function save(e: React.FormEvent) {
    e.preventDefault();
    const sum = summarize(card);
    if (!sum.runs) { setStatus('Enter a time and A-zone hits for at least one run.'); return; }
    const bad = card.runs.find(r => (r.time !== '' && !(num(r.time) > 0)) || (r.draw !== '' && !(num(r.draw) > 0)));
    if (bad) { setStatus('Times must be in seconds, like 2.35.'); return; }
    persist([card, ...sessions.filter(s => s.id !== card.id)].sort((a, b) => b.date.localeCompare(a.date)), 'Session saved in this browser.');
    setCard(newSession()); setTab('entries');
  }
  function remove(s: Session) {
    if (!window.confirm('Delete this Bill Drill session?')) return;
    persist(sessions.filter(x => x.id !== s.id), 'Session deleted.');
    if (viewing?.id === s.id) setViewing(null);
  }
  const entries: Entry[] = sessions.map(session => ({ shooter, session, own: true }));

  return (
    <div>
      {!tabProp && <div className="tabs" aria-label="Bill Drill views">
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
          {entries.length === 0 ? <p className="muted">No Bill Drill sessions yet. Open “Drill & scorecard” to log one.</p> : (
            <div className="tableWrap"><table>
              <thead><tr><th>Date</th><th>Shooter</th><th>Start</th><th className="num">Runs</th><th className="num">Clean</th><th className="num">Best clean</th><th className="num">Avg clean</th><th>Level</th><th /></tr></thead>
              <tbody>{entries.map(({ session: s, shooter: who }) => {
                const t = summarize(s);
                return <tr key={s.id}>
                  <td>{s.date}</td><td>{who}</td><td>{START_LABEL[s.start]}</td><td className="num">{t.runs}</td><td className="num">{t.clean}/{t.runs}</td>
                  <td className="num">{secs(t.best)}</td><td className="num">{secs(t.avg)}</td><td>{s.start === 'holster' ? billLevel(t.best) : '—'}</td>
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
        <form className="panel scorecardPanel billCard" onSubmit={save}>
          <div className="scHead">
            <div><h2>Scorecard</h2><p className="scNote">Bill Drill · 6 rounds · 7 yards</p></div>
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
      <h2>Bill Drill</h2>
      <p className="formNote">A foundational speed-and-accuracy drill developed by Bill Wilson of Wilson Combat.</p>
      <div className="drillFacts">
        <div><span>Distance</span><b>7 yards</b></div>
        <div><span>Target</span><b>One IPSC/USPSA torso target, A-zone</b></div>
        <div><span>Rounds</span><b>6</b></div>
      </div>
      <h3>Setup and procedure</h3>
      <ul className="drillList">
        <li><b>Start:</b> from the holster on the timer beep (newer shooters can start from low or high ready).</li>
        <li><b>On the beep:</b> draw and fire 6 rounds as fast as possible into the A-zone.</li>
        <li><b>Clean run:</b> all six shots inside the A-zone. Any shot outside it means the run isn’t clean (shown as “Miss” on the scorecard).</li>
      </ul>
      <h3>Time standards (total time, clean runs)</h3>
      <div className="tableWrap"><table className="guideTable">
        <thead><tr><th>Level</th><th>Goal</th><th>Notes</th></tr></thead>
        <tbody>
          <tr><td>Beginner</td><td>3.0–4.0 s</td><td>About 1.5 s on the draw, then controlled splits. Start from low ready rather than the holster.</td></tr>
          <tr><td>Intermediate</td><td>About 2.5 s</td><td>From the holster.</td></tr>
          <tr><td>Advanced / competitor</td><td>Under 2.0 s</td><td>About a 1.0 s draw and 0.2 s splits. Top shooters push toward 1.4 s from an open holster; the world record is around 1.11 s.</td></tr>
        </tbody>
      </table></div>
      <h3>Skills it tests</h3>
      <ul className="drillList">
        <li><b>Grip and recoil control:</b> a high, firm, consistent grip to manage muzzle rise and keep the support hand from shifting.</li>
        <li><b>Trigger manipulation:</b> rhythmic, rapid presses rather than a slow, hesitant squeeze.</li>
        <li><b>Vision and tracking:</b> stay focused on the center of the A-zone and index the sights or red dot; don’t chase individual holes.</li>
      </ul>
      <p className="formNote">Level is shown for clean runs from the holster. Source: <a href="https://premierbodyarmor.com/blogs/pba/bill-drill-shooting-guide" target="_blank" rel="noopener noreferrer">Premier Body Armor Bill Drill guide</a>.</p>
    </section>
  );
}

function SessionCard({ session: s, shooter, onChange, readOnly = false }: { session: Session; shooter: string; onChange?: (s: Session) => void; readOnly?: boolean }) {
  const sum = summarize(s);
  const set = (patch: Partial<Session>) => onChange?.({ ...s, ...patch });
  const setRun = (i: number, patch: Partial<Run>) => set({ runs: s.runs.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  return (
    <fieldset disabled={readOnly} className="billFields">
      <p className="formNote">Shooter: <b>{shooter}</b></p>
      <div className="billTop">
        <label>Date<input type="date" required value={s.date} onChange={e => set({ date: e.target.value })} /></label>
        <label>Start position<select value={s.start} onChange={e => set({ start: e.target.value as Start })}>
          {(Object.keys(START_LABEL) as Start[]).map(k => <option key={k} value={k}>{START_LABEL[k]}</option>)}
        </select></label>
      </div>
      <div className="ringTable">
        <div className="tableWrap"><table>
          <thead><tr><th>Run</th><th>Time (s)</th><th>A-zone</th><th>Draw (s)</th><th>Result</th>{!readOnly && <th />}</tr></thead>
          <tbody>{s.runs.map((r, i) => {
            const res = runResult(r);
            return (
              <tr key={i}>
                <th scope="row">{i + 1}</th>
                <td><input className="billNum" type="text" inputMode="decimal" placeholder="0.00" aria-label={`Run ${i + 1} total time`} value={r.time} onChange={e => setRun(i, { time: e.target.value.replace(/[^0-9.]/g, '').slice(0, 6) })} /></td>
                <td><select aria-label={`Run ${i + 1} A-zone hits`} value={r.hits} onChange={e => setRun(i, { hits: e.target.value })}>
                  <option value="">–</option>{[6, 5, 4, 3, 2, 1, 0].map(n => <option key={n} value={n}>{n}</option>)}
                </select></td>
                <td><input className="billNum" type="text" inputMode="decimal" placeholder="opt." aria-label={`Run ${i + 1} draw time`} value={r.draw} onChange={e => setRun(i, { draw: e.target.value.replace(/[^0-9.]/g, '').slice(0, 6) })} /></td>
                <td className={`billRes ${res}`}>{res === 'clean' ? 'Clean' : res === 'not-clean' ? 'Miss' : '—'}</td>
                {!readOnly && <td><button type="button" className="iconBtn" aria-label={`Remove run ${i + 1}`} disabled={s.runs.length === 1} onClick={() => set({ runs: s.runs.filter((_, j) => j !== i) })}><X size={14} /></button></td>}
              </tr>
            );
          })}</tbody>
        </table></div>
        {!readOnly && s.runs.length < 12 && <button type="button" className="secondary" onClick={() => set({ runs: [...s.runs, blankRun()] })}><Plus size={14} /> Add run</button>}
      </div>
      <div className="scTotals">
        <div><span>Clean runs</span><b>{sum.clean}<small>/{sum.runs}</small></b></div>
        <div><span>A-zone hits</span><b>{sum.hits}<small>/{sum.shots}</small></b></div>
        <div><span>Avg clean</span><b>{sum.avg == null ? '—' : sum.avg.toFixed(2)}<small>{sum.avg == null ? '' : ' s'}</small></b></div>
        <div><span>Best draw</span><b>{sum.bestDraw == null ? '—' : sum.bestDraw.toFixed(2)}<small>{sum.bestDraw == null ? '' : ' s'}</small></b></div>
        <div className="scGrand"><span>Best clean run{s.start === 'holster' && sum.best != null ? ` · ${billLevel(sum.best)}` : ''}</span><b>{sum.best == null ? '—' : sum.best.toFixed(2)}<small>{sum.best == null ? '' : ' s'}</small></b></div>
      </div>
      <label>Session notes<textarea value={s.notes} onChange={e => set({ notes: e.target.value })} /></label>
    </fieldset>
  );
}

function Leaderboard({ entries, current, drillSelect }: { entries: Entry[]; current: string; drillSelect?: React.ReactNode }) {
  const [period, setPeriod] = useState('all'), [start, setStart] = useState<Start | 'all'>('holster');
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
          <option value="holster">Holster</option><option value="low">Low ready</option><option value="high">High ready</option><option value="all">Any start</option>
        </select></label>
        <label>Period<select value={period} onChange={e => setPeriod(e.target.value)}>
          <option value="all">All time</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="365">Last 12 months</option>
        </select></label>
      </div>
      <p className="formNote">Ranked by best clean run (all six in the A-zone). Lower is better.</p>
      {rows.length === 0 ? <p className="muted">No clean runs logged for these filters yet.</p> : <>
        <div className="tableWrap"><table className="board">
          <thead><tr><th>#</th><th>Compare</th><th>Shooter</th><th className="num">Best clean</th><th>Level</th><th className="num">Avg of session bests</th><th className="num">Sessions</th><th>Trend</th></tr></thead>
          <tbody>{rows.map((r, i) => <tr key={r.name}>
            <td>{i + 1}</td>
            <td><input type="checkbox" aria-label={`Compare ${r.name}`} checked={selected.includes(r.name)} onChange={e => setSelected(e.target.checked ? [...selected, r.name] : selected.filter(n => n !== r.name))} /></td>
            <td>{r.name}</td><td className="num"><b>{r.best.toFixed(2)} s</b></td><td>{start === 'holster' ? billLevel(r.best) : '—'}</td>
            <td className="num">{r.avg.toFixed(2)} s</td><td className="num">{r.mine.length}</td><td><Sparkline values={r.trend.map(t => -t)} /></td>
          </tr>)}</tbody>
        </table></div>
        {rows.some(r => selected.includes(r.name)) && <div className="compare">
          <h3>Best clean run by session (seconds)</h3>
          <ScoreChart max={null} series={rows.filter(r => selected.includes(r.name)).map((r, i) => ({
            id: r.name, name: r.name, color: ['#2f5a78', '#b8893e', '#9a3a2c'][i % 3],
            points: r.mine.map(e => ({ id: e.session.id, date: e.session.date, value: e.t.best!, label: `${e.t.best!.toFixed(2)} s` })),
          }))} />
        </div>}
      </>}
    </section>
  );
}
