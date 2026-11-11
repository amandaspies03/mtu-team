'use client';

import { Fragment, useEffect, useState } from 'react';
import { useTeam } from '../../lib/data';
import { displayName, todayISO } from '../../lib/util';
import { PageTitle, Sparkline } from './ui';
import { ScoreChart } from './scores';

const stages = [
  { name: 'Compressed Ready', par: 1 },
  { name: 'Holster Draw', par: 1.5 },
  { name: 'Low Ready', par: 1 },
  { name: 'High Ready', par: 1 },
  { name: 'Rifle-to-Pistol Transition', par: 2.5 },
];

type Attempt = { time: string; hits: string };
type Card = { id: string; date: string; mode: 'one' | 'two'; notes: string; attempts: [Attempt, Attempt][] };

function blankAttempt(): Attempt {
  return { time: '', hits: '' };
}

function newCard(): Card {
  return {
    id: crypto.randomUUID(), date: todayISO(), mode: 'two', notes: '',
    attempts: stages.map(() => [blankAttempt(), blankAttempt()]),
  };
}

function result(attempt: Attempt, par: number) {
  if (attempt.hits === 'skipped') return 'Skipped';
  if (!attempt.hits || !Number.isFinite(Number(attempt.time)) || Number(attempt.time) <= 0) return 'Incomplete';
  const overTime = Number(attempt.time) > par;
  if (attempt.hits === 'miss') return overTime ? 'Fail · Hit result and over time' : 'Fail · Hit result';
  return overTime ? 'Fail · Over time' : 'Pass';
}

function summarize(card: Card) {
  const outcomes = stages.map(({ par }, index) => {
    const [first, second] = card.attempts[index].map(attempt => result(attempt, par));
    if (first === 'Pass') return 'Passed first try';
    if (first === 'Incomplete') return first;
    if (card.mode === 'one') return 'Failed';
    if (second === 'Pass') return 'Passed on retry';
    return second === 'Incomplete' ? second : 'Failed';
  });
  const cold = outcomes.filter(outcome => outcome === 'Passed first try').length;
  const passed = outcomes.filter(outcome => outcome.startsWith('Passed')).length;
  const remaining = outcomes.filter(outcome => outcome === 'Incomplete').length;
  return { outcomes, cold, passed, remaining };
}

export default function ShooterProgression() {
  const { me, memberById } = useTeam();
  return <Scorecard key={me.id} storageKey={`mtu.man-card.${me.id}`} shooter={displayName(memberById(me.member_id))} />;
}

type Entry = { shooter: string; card: Card; own: boolean };

const sampleEntries: Entry[] = [
  ['Morgan Lee', [2, 3, 4]],
  ['Jordan Reed', [3, 4, 5]],
].flatMap(([name, results]) => (results as number[]).map((cold, index) => ({
  shooter: name as string,
  own: false,
  card: {
    id: `${name}-${index}`,
    date: `2026-${String(9 + index).padStart(2, '0')}-05`,
    mode: 'two' as const,
    notes: '',
    attempts: stages.map(({ par }, stage): [Attempt, Attempt] => [
      { time: String(par), hits: stage < cold ? 'all' : 'miss' },
      stage < cold ? blankAttempt() : { time: String(par), hits: 'all' },
    ]),
  },
})));

export function Scorecard({ storageKey, shooter, preview = false }: { storageKey: string; shooter: string; preview?: boolean }) {
  const [cards, setCards] = useState<Card[]>([]);
  const [card, setCard] = useState<Card | null>(null);
  const [status, setStatus] = useState('');
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState('leaderboard');
  const [viewing, setViewing] = useState<Entry | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) setCards(JSON.parse(saved));
      setCard(newCard());
      setReady(true);
    } catch {
      setStatus('Saved scorecards could not be opened on this device.');
    }
  }, [storageKey]);

  function save(entry: Card) {
    const next = [entry, ...cards.filter(saved => saved.id !== entry.id)].sort((a, b) => b.date.localeCompare(a.date));
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      setCards(next);
      setStatus('Scorecard saved on this device.');
      if (preview) { setCard(newCard()); setTab('entries'); }
    } catch {
      setStatus('Could not save this scorecard on this device.');
    }
  }

  const activeCard = preview && tab === 'entries' ? viewing?.card : card;
  const summary = activeCard && summarize(activeCard);
  const entries = preview ? [...sampleEntries, ...cards.map(card => ({ shooter, card, own: true }))] : [];
  const readOnly = preview && tab === 'entries';
  const reset = () => { setCard(newCard()); setStatus(''); };

  return (
    <div>
      <PageTitle eyebrow="PERFORMANCE" title="Shooter Progression">Man Card · Short Card</PageTitle>
      <p>Draft preview. Scorecards are saved in this browser.</p>
      {preview && <div className="tabs" aria-label="Shooter Progression views">
        {[['leaderboard', 'Leaderboard'], ['enter', 'Enter scores'], ['entries', 'All entries']].map(([id, title]) =>
          <button type="button" key={id} className={tab === id ? 'on' : ''} onClick={() => { setTab(id); setViewing(null); }}>{title}</button>
        )}
      </div>}
      {preview && tab !== 'enter' && <ProgressionResults entries={entries} leaderboard={tab === 'leaderboard'} onOpen={entry => {
        if (entry.own && summarize(entry.card).remaining) {
          setCard(entry.card);
          setTab('enter');
        } else {
          setViewing(entry);
        }
      }} />}
      {ready && activeCard && summary && (!preview || tab === 'enter' || readOnly) && (
        <form className="panel scorecardPanel manCard" onSubmit={event => { event.preventDefault(); if (!readOnly && card) save(card); }}>
          <div className="scHead">
            <div><h2>Scorecard</h2><p className="scNote">Man Card · Short Card</p></div>
            {!readOnly && <button className="secondary" type="button" onClick={reset}>Clear card</button>}
          </div>
          <p>Shooter {readOnly ? viewing?.shooter : shooter}</p>
          <fieldset disabled={readOnly} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
          <label>Date <input type="date" required value={activeCard.date} onChange={event => setCard({ ...activeCard, date: event.target.value })} /></label>
          <label>Evaluation mode <select value={activeCard.mode} onChange={event => setCard({ ...activeCard, mode: event.target.value === 'one' ? 'one' : 'two' })}>
            <option value="one">One attempt</option>
            <option value="two">Up to two attempts</option>
          </select></label>
          <div className="ringTable manCardTable">
            <div className="tableWrap">
              <table>
                <thead><tr>
                  <th scope="col">Stage</th>
                  <th scope="col">First time (s)</th>
                  <th scope="col">First hits</th>
                  <th scope="col">First result</th>
                  {activeCard.mode === 'two' && <>
                    <th scope="col">Retry time (s)</th>
                    <th scope="col">Retry hits</th>
                    <th scope="col">Retry result</th>
                  </>}
                  <th scope="col">Stage result</th>
                </tr></thead>
                <tbody>
                  {stages.map(({ name, par }, stageIndex) => {
                    const attempts = activeCard.attempts[stageIndex];
                    const canRetry = result(attempts[0], par).startsWith('Fail');
                    return (
                      <tr key={name}>
                        <th scope="row">{name}</th>
                        {attempts.slice(0, activeCard.mode === 'two' ? 2 : 1).map((attempt, attemptIndex) => {
                          const isRetry = attemptIndex === 1;
                          const skipped = isRetry && attempt.hits === 'skipped';
                          const disabled = isRetry && (!canRetry || skipped);
                          const label = `${name}, ${isRetry ? 'retry' : 'first attempt'}`;
                          function update(change: Partial<Attempt>) {
                            setCard(current => current && ({
                              ...current,
                              attempts: current.attempts.map((pair, index) => {
                                if (index !== stageIndex) return pair;
                                const updated: [Attempt, Attempt] = [...pair];
                                updated[attemptIndex] = { ...updated[attemptIndex], ...change };
                                return updated;
                              }),
                            }));
                          }
                          return (
                            <Fragment key={attemptIndex}>
                              <td><input aria-label={`${label} time in seconds`} type="number" min="0.01" step="0.01" inputMode="decimal" placeholder="0.00" disabled={disabled} value={disabled ? '' : attempt.time} onChange={event => update({ time: event.target.value })} /></td>
                              <td><select aria-label={`${label} hit result`} disabled={disabled} value={disabled ? '' : attempt.hits} onChange={event => update({ hits: event.target.value })}>
                                <option value="">Select</option>
                                <option value="all">All in zone</option>
                                <option value="miss">Miss / outside</option>
                              </select></td>
                              <td>
                                {isRetry && !canRetry ? '—' : result(attempt, par)}
                                {!readOnly && isRetry && canRetry && <button className="secondary" type="button" onClick={() => update({ time: '', hits: skipped ? '' : 'skipped' })}>
                                  {skipped ? 'Record retry' : 'Skip retry'}
                                </button>}
                              </td>
                            </Fragment>
                          );
                        })}
                        <td><b>{summary.outcomes[stageIndex]}</b></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <div className="scTotals">
            <div><span>First-attempt passes</span><b>{summary.cold}<small>/5</small></b></div>
            <div><span>Total stages passed</span><b>{summary.passed}<small>/5</small></b></div>
            <div className="scGrand"><span>Card status</span><b>{summary.remaining ? 'In progress' : summary.passed === 5 ? 'Passed' : 'Failed'}</b></div>
          </div>
          <label>Session notes <textarea value={activeCard.notes} onChange={event => setCard({ ...activeCard, notes: event.target.value })} /></label>
          {!readOnly && <button className="primary" type="submit">{summary.remaining ? 'Save draft' : 'Save scorecard'}</button>}
          </fieldset>
        </form>
      )}
      <p role="status">{status}</p>
      {!preview && <>
      <h2>Session history</h2>
      {cards.length === 0 && <p>No saved scorecards yet.</p>}
      <ul>
        {cards.map(saved => {
          const totals = summarize(saved);
          return <li key={saved.id}><button type="button" onClick={() => { setCard(saved); setStatus(''); }}>
            {saved.date} · {totals.cold}/5 first attempt · {totals.passed}/5 total{totals.remaining > 0 ? ' · Draft' : ''}
          </button></li>;
        })}
      </ul>
      </>}
    </div>
  );
}

function ProgressionResults({ entries, leaderboard, onOpen }: { entries: Entry[]; leaderboard: boolean; onOpen: (entry: Entry) => void }) {
  const [period, setPeriod] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const latestFirst = [...entries].sort((a, b) => b.card.date.localeCompare(a.card.date));
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - Number(period));
  const filtered = latestFirst.map(entry => ({ ...entry, result: summarize(entry.card) }))
    .filter(entry => entry.shooter.toLowerCase().includes(search.trim().toLowerCase()))
    .filter(entry => period === 'all' || entry.card.date >= cutoff.toISOString().slice(0, 10));
  const completed = filtered.filter(entry => !entry.result.remaining);
  const rows = [...new Set(completed.map(entry => entry.shooter))].map(name => {
    const sessions = completed.filter(entry => entry.shooter === name);
    const trend = sessions.map(entry => entry.result.cold).reverse();
    return { name, sessions, trend, best: Math.max(...trend), average: trend.reduce((sum, value) => sum + value, 0) / trend.length };
  }).sort((a, b) => b.best - a.best || b.average - a.average || a.name.localeCompare(b.name));

  return (
    <section className="panel">
      <div className="filters">
        <label>Drill<select defaultValue="man-card"><option value="man-card">Man Card · Short Card</option></select></label>
        <label>Period<select value={period} onChange={event => setPeriod(event.target.value)}>
          <option value="all">All time</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="365">Last 12 months</option>
        </select></label>
        <label>Shooter<input type="search" placeholder="Search shooters" value={search} onChange={event => setSearch(event.target.value)} /></label>
      </div>
      {leaderboard ? <>
        <p className="formNote">Ranked by first-attempt passes. Select shooters to compare results by date.</p>
        <div className="tableWrap"><table className="board">
          <thead><tr><th>#</th><th>Compare</th><th>Shooter</th><th>Best</th><th>Average</th><th>Sessions</th><th>Latest</th><th>Trend</th></tr></thead>
          <tbody>{rows.map((row, index) => <tr key={row.name}>
            <td>{index + 1}</td>
            <td><input aria-label={`Compare ${row.name}`} type="checkbox" checked={selected.includes(row.name)} onChange={event => {
              setSelected(event.target.checked ? [...selected, row.name] : selected.filter(name => name !== row.name));
            }} /></td>
            <td>{row.name}</td><td>{row.best}/5</td><td>{row.average.toFixed(1)}/5</td><td>{row.sessions.length}</td>
            <td>{row.sessions[0].result.cold}/5 · {row.sessions[0].card.date}</td><td><Sparkline values={row.trend} max={5} /></td>
          </tr>)}</tbody>
        </table></div>
        {rows.length === 0 && <p>No completed scores match these filters.</p>}
        {rows.some(row => selected.includes(row.name)) && <div className="compare">
          <h3>Compare first-attempt results</h3>
          <ScoreChart max={5} series={rows.filter(row => selected.includes(row.name)).map((row, index) => ({
            id: row.name, name: row.name, color: ['#2563eb', '#b45309', '#047857'][index % 3],
            points: [...row.sessions].reverse().map(entry => ({
              id: entry.card.id, date: entry.card.date, value: entry.result.cold, label: `${entry.result.cold}/5`,
            })),
          }))} />
          <div className="tableWrap"><table>
            <thead><tr><th>Date</th>{rows.filter(row => selected.includes(row.name)).map(row => <th key={row.name}>{row.name}</th>)}</tr></thead>
            <tbody>{[...new Set(completed.filter(entry => selected.includes(entry.shooter)).map(entry => entry.card.date))].sort().map(date => <tr key={date}>
              <th scope="row">{date}</th>{rows.filter(row => selected.includes(row.name)).map(row => <td key={row.name}>
                {row.sessions.filter(entry => entry.card.date === date).map(entry => `${entry.result.cold}/5`).join(', ') || '—'}
              </td>)}
            </tr>)}</tbody>
          </table></div>
        </div>}
      </> : <>
        <div className="tableWrap"><table>
          <thead><tr><th>Date</th><th>Shooter</th><th>First attempt</th><th>Total passed</th><th>Status</th><th>Scorecard</th></tr></thead>
          <tbody>{filtered.map(entry => <tr key={entry.card.id}>
            <td>{entry.card.date}</td><td>{entry.shooter}</td><td>{entry.result.cold}/5</td><td>{entry.result.passed}/5</td>
            <td>{entry.result.remaining ? 'Private draft' : entry.result.passed === 5 ? 'Passed' : 'Failed'}</td>
            <td><button className="secondary" type="button" onClick={() => onOpen(entry)}>{entry.result.remaining ? 'Resume draft' : 'View card'}</button></td>
          </tr>)}</tbody>
        </table></div>
        {filtered.length === 0 && <p>No entries match these filters.</p>}
      </>}
    </section>
  );
}
