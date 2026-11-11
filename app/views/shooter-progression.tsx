'use client';

import { useEffect, useState } from 'react';
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

function Scorecard({ storageKey, shooter }: { storageKey: string; shooter: string }) {
  const [cards, setCards] = useState<Card[]>([]);
  const [card, setCard] = useState<Card | null>(null);
  const [status, setStatus] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) setCards(JSON.parse(saved));
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

  return (
    <div>
      <PageTitle eyebrow="PERFORMANCE" title="Shooter Progression">Man Card · Short Card</PageTitle>
      <p>Draft preview. Scorecards are saved in this browser.</p>
      {ready && <button type="button" onClick={() => { setCard(newCard()); setStatus(''); }}>New scorecard</button>}
      {card && summary && (
        <form onSubmit={event => { event.preventDefault(); save(card); }}>
          <h2>Man Card scorecard</h2>
          <p>Shooter {shooter}</p>
          <label>Date <input type="date" required value={card.date} onChange={event => setCard({ ...card, date: event.target.value })} /></label>
          <label>Evaluation mode <select value={card.mode} onChange={event => setCard({ ...card, mode: event.target.value === 'one' ? 'one' : 'two' })}>
            <option value="one">One attempt</option>
            <option value="two">Up to two attempts</option>
          </select></label>
          {stages.map(({ name, par }, stageIndex) => {
            const attempts = card.attempts[stageIndex];
            const first = result(attempts[0], par);
            const showRetry = card.mode === 'two' && first.startsWith('Fail');
            return (
              <details key={name} className="card">
                <summary>{name} · {summary.outcomes[stageIndex]}</summary>
                {attempts.slice(0, showRetry ? 2 : 1).map((attempt, attemptIndex) => {
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
                    <fieldset key={attemptIndex}>
                      <legend>Attempt {attemptIndex + 1}</legend>
                      <label>Time (seconds) <input type="number" min="0.01" step="0.01" inputMode="decimal" value={attempt.time} onChange={event => update({ time: event.target.value })} /></label>
                      <label>Hit result <select value={attempt.hits} onChange={event => update({ hits: event.target.value })}>
                        <option value="">Select hit result</option>
                        <option value="all">All hits in zone</option>
                        <option value="miss">Miss or outside zone</option>
                      </select></label>
                      <p>{result(attempt, par)}</p>
                      {attemptIndex === 1 && <button type="button" onClick={() => update({
                        time: '', hits: attempt.hits === 'skipped' ? '' : 'skipped',
                      })}>{attempt.hits === 'skipped' ? 'Record retry' : 'Skip retry'}</button>}
                    </fieldset>
                  );
                })}
              </details>
            );
          })}
          <p>First-attempt passes {summary.cold} of 5</p>
          <p>Total stages passed {summary.passed} of 5</p>
          <p>{summary.remaining ? `In progress · ${summary.remaining} stages left` : summary.passed === 5 ? 'Passed' : 'Failed'}</p>
          <label>Session notes <textarea value={card.notes} onChange={event => setCard({ ...card, notes: event.target.value })} /></label>
          <button type="submit">{summary.remaining ? 'Save draft' : 'Save scorecard'}</button>
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
