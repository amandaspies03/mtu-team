'use client';

import { Fragment, useEffect, useState } from 'react';
import { useTeam } from '../../lib/data';
import { displayName, todayISO } from '../../lib/util';
import { PageTitle } from './ui';

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

export function Scorecard({ storageKey, shooter }: { storageKey: string; shooter: string }) {
  const [cards, setCards] = useState<Card[]>([]);
  const [card, setCard] = useState<Card | null>(null);
  const [status, setStatus] = useState('');
  const [ready, setReady] = useState(false);

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
    } catch {
      setStatus('Could not save this scorecard on this device.');
    }
  }

  const summary = card && summarize(card);
  const reset = () => { setCard(newCard()); setStatus(''); };

  return (
    <div>
      <PageTitle eyebrow="PERFORMANCE" title="Shooter Progression">Man Card · Short Card</PageTitle>
      <p>Draft preview. Scorecards are saved in this browser.</p>
      {ready && card && summary && (
        <form className="panel scorecardPanel manCard" onSubmit={event => { event.preventDefault(); save(card); }}>
          <div className="scHead">
            <div><h2>Scorecard</h2><p className="scNote">Man Card · Short Card</p></div>
            <button className="secondary" type="button" onClick={reset}>Clear card</button>
          </div>
          <p>Shooter {shooter}</p>
          <label>Date <input type="date" required value={card.date} onChange={event => setCard({ ...card, date: event.target.value })} /></label>
          <label>Evaluation mode <select value={card.mode} onChange={event => setCard({ ...card, mode: event.target.value === 'one' ? 'one' : 'two' })}>
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
                  {card.mode === 'two' && <>
                    <th scope="col">Retry time (s)</th>
                    <th scope="col">Retry hits</th>
                    <th scope="col">Retry result</th>
                  </>}
                  <th scope="col">Stage result</th>
                </tr></thead>
                <tbody>
                  {stages.map(({ name, par }, stageIndex) => {
                    const attempts = card.attempts[stageIndex];
                    const canRetry = result(attempts[0], par).startsWith('Fail');
                    return (
                      <tr key={name}>
                        <th scope="row">{name}</th>
                        {attempts.slice(0, card.mode === 'two' ? 2 : 1).map((attempt, attemptIndex) => {
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
                                {isRetry && canRetry && <button className="secondary" type="button" onClick={() => update({ time: '', hits: skipped ? '' : 'skipped' })}>
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
          <label>Session notes <textarea value={card.notes} onChange={event => setCard({ ...card, notes: event.target.value })} /></label>
          <button className="primary" type="submit">{summary.remaining ? 'Save draft' : 'Save scorecard'}</button>
        </form>
      )}
      <p role="status">{status}</p>
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
    </div>
  );
}
