'use client';
// Dot Torture: 50 rounds on 10 numbered 2-inch dots. Clean pass = 50/50; then move back a distance.
// No time limit. Target: public/drills/dot-torture-target.pdf (preview .png).
// Sessions are saved to the team record (lib/drills.tsx).
import { useEffect, useState } from 'react';
import { ShooterPick, useDrillRecord, type DrillEntry } from '../../lib/drills';
import { todayISO } from '../../lib/util';
import { Sparkline } from './ui';
import { ScoreChart } from './scores';

const STRINGS = [
  { key: 'd1', dots: 'Dot 1', rounds: 5, how: '5 rounds slow fire, from the holster, two-handed' },
  { key: 'd2', dots: 'Dot 2', rounds: 5, how: 'Draw, 1 round, re-holster · ×5' },
  { key: 'd34', dots: 'Dots 3 & 4', rounds: 8, how: 'Draw, 1 on Dot 3, transition, 1 on Dot 4, re-holster · ×4' },
  { key: 'd5', dots: 'Dot 5', rounds: 5, how: 'Draw, 5 rounds strong hand only' },
  { key: 'd67', dots: 'Dots 6 & 7', rounds: 16, how: 'Draw, 2 on Dot 6, transition, 2 on Dot 7, re-holster · ×4' },
  { key: 'd8', dots: 'Dot 8', rounds: 5, how: 'From low ready, 5 rounds support (weak) hand only' },
  { key: 'd910', dots: 'Dots 9 & 10', rounds: 6, how: 'Draw, 1 on Dot 9 to slide lock, speed reload, 1 on Dot 10, re-holster · ×3' },
] as const;
type Key = typeof STRINGS[number]['key'];
const DISTANCES = ['3', '5', '7', '10'];

type Session = { id: string; date: string; distance: string; hits: Partial<Record<Key, string>>; notes: string };
type Entry = DrillEntry<Session>;
type DotTab = 'leaderboard' | 'drill' | 'entries';

const newSession = (distance = '3'): Session => ({ id: crypto.randomUUID(), date: todayISO(), distance, hits: {}, notes: '' });

function summarize(s: Session) {
  const entered = STRINGS.filter(st => s.hits[st.key] !== undefined && s.hits[st.key] !== '');
  const score = entered.reduce((t, st) => t + Number(s.hits[st.key]), 0);
  const complete = entered.length === STRINGS.length;
  return { score, complete, clean: complete && score === 50, misses: entered.reduce((t, st) => t + st.rounds - Number(s.hits[st.key]), 0) };
}

export default function DotTorture({ drillSelect, tab: tabProp, onTab, onOpenDrill, onBack }: {
  drillSelect?: React.ReactNode;
  tab?: DotTab; onTab?: (t: DotTab) => void; onOpenDrill?: () => void; onBack?: () => void;
}) {
  const rec = useDrillRecord<Session>('dot-torture');
  const [cardFor, setCardFor] = useState(rec.myMemberId);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [card, setCard] = useState<Session>(() => newSession());
  const [tabLocal, setTabLocal] = useState<DotTab>('leaderboard');
  const tab = tabProp ?? tabLocal;
  const setTab = (t: DotTab) => { if (t === 'drill' && onOpenDrill) onOpenDrill(); else if (onTab) onTab(t); else setTabLocal(t); };
  const [viewing, setViewing] = useState<Entry | null>(null);
  const [status, setStatus] = useState('');

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const sum = summarize(card);
    if (!sum.complete) { setStatus('Enter hits for all seven strings (0 if none hit).'); return; }
    if (!cardFor) { setStatus('Choose a shooter.'); return; }
    setBusy(true);
    try {
      const msg = await rec.save(card, cardFor);
      setStatus(`${msg} ${sum.clean ? `Clean run at ${card.distance} yards. Next time, move back a distance.` : `${sum.score}/50. Stay at ${card.distance} yards until it's clean.`}`);
      setEditing(false); setCard(newSession(card.distance)); setCardFor(rec.myMemberId); setTab('entries');
    } catch (err) { setStatus(`Could not save: ${(err as Error).message}`); }
    finally { setBusy(false); }
  }
  async function remove(en: Entry) {
    if (!en.own || !window.confirm(`Delete this Dot Torture session for ${en.shooter}?`)) return;
    try { setStatus(await rec.remove(en.id)); if (viewing?.id === en.id) setViewing(null); }
    catch (err) { setStatus(`Could not delete: ${(err as Error).message}`); }
  }
  function edit(en: Entry) { if (!en.own) return; setEditing(true); setCard(en.session); setCardFor(en.memberId); setTab('drill'); setStatus(''); }
  const entries = rec.entries;
  // Start a new card at the distance this shooter is working on: one step back after a clean run.
  const latest = entries.find(en => en.memberId === cardFor)?.session;
  const latestKey = latest ? `${latest.id}:${latest.distance}:${summarize(latest).clean}` : '';
  useEffect(() => {
    if (editing || !latest) return;
    const i = DISTANCES.indexOf(latest.distance);
    const next = summarize(latest).clean && i >= 0 && i < DISTANCES.length - 1 ? DISTANCES[i + 1] : latest.distance;
    setCard(c => (c.distance === next ? c : { ...c, distance: next }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestKey, editing]);
  const shooter = rec.currentShooter;

  return (
    <div>
      {!tabProp && <div className="tabs" aria-label="Dot Torture views">
        {([['leaderboard', 'Leaderboard'], ['drill', 'Drill & scorecard'], ['entries', 'All entries']] as const).map(([id, title]) =>
          <button type="button" key={id} className={tab === id ? 'on' : ''} onClick={() => { setTab(id); setViewing(null); }}>{title}</button>)}
      </div>}

      {tab === 'leaderboard' && <Leaderboard entries={entries} current={shooter} drillSelect={drillSelect} />}

      {tab === 'entries' && (viewing ? (
        <section className="panel">
          <button className="secondary" type="button" onClick={() => setViewing(null)}>Back to entries</button>
          <SessionCard session={viewing.session} who={<ShooterPick readOnly name={viewing.shooter} value={viewing.memberId} onChange={() => {}} options={[]} />} readOnly />
        </section>
      ) : (
        <section className="panel">
          {drillSelect && <div className="filters">{drillSelect}</div>}
          {entries.length === 0 ? <p className="muted">No Dot Torture sessions yet. Open it from the Drills tab to log one.</p> : (
            <div className="tableWrap"><table>
              <thead><tr><th>Date</th><th>Shooter</th><th className="num">Distance</th><th className="num">Score</th><th>Result</th><th /></tr></thead>
              <tbody>{entries.map(en => {
                const { session: s, shooter: who } = en;
                const t = summarize(s);
                return <tr key={s.id}>
                  <td>{s.date}</td><td>{who}</td><td className="num">{s.distance} yd</td><td className="num"><b>{t.score}</b>/50</td>
                  <td className={t.clean ? 'billRes clean' : 'billRes not-clean'}>{t.clean ? 'Clean' : `${t.misses} miss${t.misses === 1 ? '' : 'es'}`}</td>
                  <td className="nowrap">
                    <button className="secondary" type="button" onClick={() => setViewing(en)}>View</button>
                    {en.own && <>{' '}<button className="secondary" type="button" onClick={() => edit(en)}>Edit</button>{' '}
                    <button className="secondary" type="button" onClick={() => remove(en)}>Delete</button></>}
                  </td>
                </tr>;
              })}</tbody>
            </table></div>
          )}
        </section>
      ))}

      {tab === 'drill' && <>
        <DrillInstructions onBack={onBack} />
        <form className="panel scorecardPanel billCard dotCard" onSubmit={save}>
          <div className="scHead">
            <div><h2>Scorecard</h2><p className="scNote">Dot Torture · 50 rounds · no time limit</p></div>
            <button className="secondary" type="button" onClick={() => { setEditing(false); setCard(newSession(card.distance)); setCardFor(rec.myMemberId); setStatus(''); }}>Clear card</button>
          </div>
          <SessionCard session={card} who={<ShooterPick value={cardFor} onChange={setCardFor} options={rec.shooters} />} onChange={setCard} />
          <button className="primary" type="submit" disabled={busy || !rec.canSave}>{busy ? 'Saving…' : 'Save session'}</button>
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
      <h2>Dot Torture</h2>
      <p className="formNote">A 50-round marksmanship and trigger-control drill: draw stroke, recoil management, transitions, one-handed shooting and speed reloads.</p>
      <div className="drillFacts">
        <div><span>Distance</span><b>Start at 3 yards (then 5, 7, 10)</b></div>
        <div><span>Target</span><b>10 numbered 2-inch dots</b></div>
        <div><span>Rounds</span><b>50 · no time limit</b></div>
      </div>
      <p className="callout">Pass: 50 out of 50. Any miss means you didn’t pass clean, so stay at that distance. Focus on clean, deliberate execution, not speed.</p>
      <div className="dotGrid">
        <div>
          <h3>Course of fire</h3>
          <ol className="drillStages">
            {STRINGS.map(st => (
              <li key={st.key}>
                <div className="drillStageHead"><b>{st.dots}</b><span className="drillPar">{st.rounds} rds</span></div>
                <dl><dt>Task</dt><dd>{st.how}</dd></dl>
              </li>
            ))}
          </ol>
        </div>
        <figure className="dotTarget">
          <a href="/drills/dot-torture-target.pdf" target="_blank" rel="noopener"><img src="/drills/dot-torture-target.png" alt="Dot Torture target: ten numbered dots with the course of fire under each" loading="lazy" /></a>
          <figcaption><a href="/drills/dot-torture-target.pdf" target="_blank" rel="noopener">Open the target PDF to print</a> (letter size)</figcaption>
        </figure>
      </div>
    </section>
  );
}

function SessionCard({ session: s, who, onChange, readOnly = false }: { session: Session; who: React.ReactNode; onChange?: (s: Session) => void; readOnly?: boolean }) {
  const sum = summarize(s);
  const set = (patch: Partial<Session>) => onChange?.({ ...s, ...patch });
  const setHits = (k: Key, v: string) => set({ hits: { ...s.hits, [k]: v } });
  return (
    <fieldset disabled={readOnly} className="billFields">
      {who}
      <div className="billTop">
        <label>Date<input type="date" required value={s.date} onChange={e => set({ date: e.target.value })} /></label>
        <label>Distance<select value={s.distance} onChange={e => set({ distance: e.target.value })}>
          {DISTANCES.map(d => <option key={d} value={d}>{d} yards</option>)}
        </select></label>
      </div>
      <div className="dotRows">
        {STRINGS.map(st => {
          const v = s.hits[st.key] ?? '';
          const miss = v !== '' && Number(v) < st.rounds;
          return (
            <div className={`dotRow${miss ? ' miss' : v !== '' ? ' ok' : ''}`} key={st.key}>
              <div className="dotLabel"><b>{st.dots}</b><small>{st.how}</small></div>
              <div className="dotHits">
                <select aria-label={`${st.dots} hits out of ${st.rounds}`} value={v} onChange={e => setHits(st.key, e.target.value)}>
                  <option value="">–</option>{Array.from({ length: st.rounds + 1 }, (_, n) => st.rounds - n).map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                <span>/ {st.rounds}</span>
                {!readOnly && v === '' && <button type="button" className="linkBtn" onClick={() => setHits(st.key, String(st.rounds))}>All hit</button>}
              </div>
            </div>
          );
        })}
      </div>
      <div className="scTotals">
        <div><span>Strings entered</span><b>{STRINGS.filter(st => (s.hits[st.key] ?? '') !== '').length}<small>/7</small></b></div>
        <div><span>Misses</span><b>{sum.misses}</b></div>
        <div className="scGrand"><span>{sum.complete ? (sum.clean ? `Clean at ${s.distance} yd · move back` : `Not clean · stay at ${s.distance} yd`) : 'Score'}</span><b>{sum.score}<small>/50</small></b></div>
      </div>
      <label>Session notes<textarea value={s.notes} onChange={e => set({ notes: e.target.value })} /></label>
    </fieldset>
  );
}

function Leaderboard({ entries, current, drillSelect }: { entries: Entry[]; current: string; drillSelect?: React.ReactNode }) {
  const [period, setPeriod] = useState('all');
  const [selected, setSelected] = useState<string[]>([current]);
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - Number(period));
  const shown = entries
    .filter(e => period === 'all' || e.session.date >= cutoff.toISOString().slice(0, 10))
    .map(e => ({ ...e, t: summarize(e.session) }))
    .filter(e => e.t.complete)
    .sort((a, b) => a.session.date.localeCompare(b.session.date));
  const rows = [...new Set(shown.map(e => e.shooter))].map(name => {
    const mine = shown.filter(e => e.shooter === name);
    const clean = mine.filter(e => e.t.clean).map(e => Number(e.session.distance));
    return { name, mine, farthest: clean.length ? Math.max(...clean) : 0, best: Math.max(...mine.map(e => e.t.score)), trend: mine.map(e => e.t.score) };
  }).sort((a, b) => b.farthest - a.farthest || b.best - a.best);
  return (
    <section className="panel">
      <div className="filters">
        {drillSelect}
        <label>Period<select value={period} onChange={e => setPeriod(e.target.value)}>
          <option value="all">All time</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="365">Last 12 months</option>
        </select></label>
      </div>
      <p className="formNote">Ranked by the farthest distance run clean (50/50), then best score.</p>
      {rows.length === 0 ? <p className="muted">No completed Dot Torture runs for these filters yet.</p> : <>
        <div className="tableWrap"><table className="board">
          <thead><tr><th>#</th><th>Compare</th><th>Shooter</th><th className="num">Farthest clean</th><th className="num">Best score</th><th className="num">Runs</th><th>Trend</th></tr></thead>
          <tbody>{rows.map((r, i) => <tr key={r.name}>
            <td>{i + 1}</td>
            <td><input type="checkbox" aria-label={`Compare ${r.name}`} checked={selected.includes(r.name)} onChange={e => setSelected(e.target.checked ? [...selected, r.name] : selected.filter(n => n !== r.name))} /></td>
            <td>{r.name}</td><td className="num"><b>{r.farthest ? `${r.farthest} yd` : '—'}</b></td><td className="num">{r.best}/50</td><td className="num">{r.mine.length}</td>
            <td><Sparkline values={r.trend} max={50} /></td>
          </tr>)}</tbody>
        </table></div>
        {rows.some(r => selected.includes(r.name)) && <div className="compare">
          <h3>Score by session (out of 50)</h3>
          <ScoreChart max={50} series={rows.filter(r => selected.includes(r.name)).map((r, i) => ({
            id: r.name, name: r.name, color: ['#2f5a78', '#b8893e', '#9a3a2c'][i % 3],
            points: r.mine.map(e => ({ id: e.session.id, date: e.session.date, value: e.t.score, label: `${e.t.score}/50 at ${e.session.distance} yd` })),
          }))} />
        </div>}
      </>}
    </section>
  );
}
