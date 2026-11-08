'use client';
import { useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { MATCH_CALLS, MATCH_SCORING, type Stage } from '../../lib/tower';
import { PageTitle } from './ui';

let audio: AudioContext | null = null;
function horn(ms = 700, freq = 440) {
  try {
    audio ||= new AudioContext();
    const o = audio.createOscillator(), g = audio.createGain();
    o.type = 'square'; o.frequency.value = freq;
    g.gain.value = 0.25;
    o.connect(g).connect(audio.destination);
    o.start(); o.stop(audio.currentTime + ms / 1000);
  } catch { /* audio not available */ }
}

type Phase = { kind: 'ready' } | { kind: 'fire'; i: number; left: number } | { kind: 'wait'; i: number; left: number } | { kind: 'done' };

function StageTimer({ stage, sound }: { stage: Stage; sound: boolean }) {
  const [phase, setPhaseState] = useState<Phase>({ kind: 'ready' });
  const pRef = useRef<Phase>(phase);
  const setPhase = (p: Phase) => { pRef.current = p; setPhaseState(p); };
  const [running, setRunning] = useState(false);
  const [wait, setWait] = useState(stage.interval ?? 7);
  useEffect(() => { setPhase({ kind: 'ready' }); setRunning(false); setWait(stage.interval ?? 7); }, [stage]);

  useEffect(() => {
    if (!running) return;
    // Track real elapsed time so a throttled tab doesn't slow the clock.
    let lastAt = performance.now();
    const id = setInterval(() => {
      const now = performance.now(), dt = (now - lastAt) / 1000;
      lastAt = now;
      const p = pRef.current;
      if (p.kind !== 'fire' && p.kind !== 'wait') return;
      const left = p.left - dt;
      if (left > 0) { setPhase({ ...p, left }); return; }
      if (p.kind === 'fire') {
        if (sound) horn(900, 330);
        if (p.i + 1 >= stage.exposures.length) { setRunning(false); setPhase({ kind: 'done' }); return; }
        setPhase({ kind: 'wait', i: p.i + 1, left: wait });
        return;
      }
      if (sound) horn(250, 660);
      setPhase({ kind: 'fire', i: p.i, left: stage.exposures[p.i] });
    }, 100);
    return () => clearInterval(id);
  }, [running, stage, sound, wait]);

  function start() {
    if (phase.kind === 'ready' || phase.kind === 'done') {
      if (sound) horn(250, 660);
      setPhase({ kind: 'fire', i: 0, left: stage.exposures[0] });
    }
    setRunning(true);
  }
  const reset = () => { setRunning(false); setPhase({ kind: 'ready' }); };

  const big = phase.kind === 'fire' || phase.kind === 'wait' ? Math.max(0, phase.left).toFixed(1) : phase.kind === 'done' ? 'CEASE FIRE' : `${stage.exposures[0]}s`;
  const label = phase.kind === 'fire' ? `FIRE — exposure ${phase.i + 1} of ${stage.exposures.length}`
    : phase.kind === 'wait' ? `Targets edged — next exposure ${phase.i + 1} of ${stage.exposures.length} (${stage.exposures[phase.i]}s)`
      : phase.kind === 'done' ? 'Stage complete' : `${stage.exposures.length} exposure${stage.exposures.length > 1 ? 's' : ''}: ${stage.exposures.join(' / ')} sec`;

  return (
    <div className={`timer ${phase.kind}`}>
      <div className="timerLabel">{label}</div>
      <div className="timerBig" aria-live="polite">{big}</div>
      <div className="row center">
        {running ? <button className="primary" onClick={() => setRunning(false)}><Pause size={18} /> Pause</button>
          : <button className="primary" onClick={start}><Play size={18} /> {phase.kind === 'fire' || phase.kind === 'wait' ? 'Resume' : 'Start'}</button>}
        <button className="secondary" onClick={reset}><RotateCcw size={16} /> Reset</button>
        {stage.exposures.length > 1 && (
          <label className="inlineLabel">Between exposures
            <input className="numIn" type="number" min={3} max={60} value={wait} onChange={e => setWait(Math.max(3, +e.target.value || 7))} /> sec
          </label>
        )}
      </div>
    </div>
  );
}

export default function MatchDay() {
  const [code, setCode] = useState(MATCH_CALLS[0].code);
  const [si, setSi] = useState(0);
  const [sound, setSound] = useState(true);
  const match = MATCH_CALLS.find(m => m.code === code)!;
  const stage = match.stages[si];
  const scoring = MATCH_SCORING[match.code];

  useEffect(() => {
    // Keep the screen awake while running a line.
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock?.request('screen').then(l => { lock = l; }).catch(() => {});
    return () => { lock?.release().catch(() => {}); };
  }, []);

  return (
    <div className="matchday">
      <PageTitle eyebrow="RANGE TOWER" title="Match day"
        actions={<button className="secondary" onClick={() => setSound(!sound)}>{sound ? <Volume2 size={15} /> : <VolumeX size={15} />} Horn {sound ? 'on' : 'off'}</button>}>
        Tower commands and stage timer from the 2024 Match Call Booklet. Allow about 5 seconds between each command.
      </PageTitle>
      <div className="tabs">
        {MATCH_CALLS.map(m => <button key={m.code} className={m.code === code ? 'on' : ''} onClick={() => { setCode(m.code); setSi(0); }}>{m.title} {/\d/.test(m.code) && <small>{m.code}</small>}</button>)}
      </div>
      <div className="stats">
        <div><strong>{match.rounds}</strong><span>rounds</span></div>
        <div><strong>{match.stages.length}</strong><span>stages</span></div>
        <div><strong>{match.maxPoints}</strong><span>max points</span></div>
        <div><strong>{match.weapon}</strong><span>weapon</span></div>
      </div>

      <details className="panel brief"><summary><h2>Safety briefing &amp; line setup</h2></summary>
        <p className="readAloud">{match.safetyBrief}</p>
        <ol className="calls">{match.setup.map((c, i) => <li key={i}>{c}</li>)}</ol>
      </details>

      <div className="stageTabs">
        {match.stages.map((s, i) => <button key={s.name} className={i === si ? 'on' : ''} onClick={() => setSi(i)}><b>{s.name}</b><small>{s.distance} · {s.position}</small></button>)}
      </div>

      <section className="panel stagePanel">
        <div className="stageFacts">
          <div><span>Distance</span><b>{stage.distance}</b></div>
          <div><span>Position</span><b>{stage.position}</b></div>
          <div><span>Shots</span><b>{stage.shots}</b></div>
          <div><span>Time</span><b>{stage.exposures.join(' / ')} s</b></div>
        </div>
        <p className="sequence">{stage.sequence}</p>
        <StageTimer stage={stage} sound={sound} />
        <div className="grid2">
          <div><h3>Commands</h3><ol className="calls">{stage.commands.map((c, i) => <li key={i}>{c}</li>)}</ol></div>
          <div><h3>After the stage</h3><ol className="calls">{stage.afterStage.map((c, i) => <li key={i}>{c}</li>)}</ol></div>
        </div>
        {si === match.stages.length - 1 ? (
          <div><h3>End of match</h3><ol className="calls">{match.closing.map((c, i) => <li key={i}>{c}</li>)}</ol></div>
        ) : <button className="primary" onClick={() => setSi(si + 1)}>Next: {match.stages[si + 1].name}</button>}
      </section>

      {scoring && (
        <details className="panel scoring" open={false}>
          <summary><h2>How to score</h2><small>{match.title} scorecard{scoring.target ? ' and target' : ''}</small></summary>
          <div className="scoreGrid">
            <div>
              {scoring.table && <table className="guideTable"><thead><tr>{scoring.table[0].map(c => <th key={c}>{c}</th>)}</tr></thead>
                <tbody>{scoring.table.slice(1).map(r => <tr key={r[0]}>{r.map((c, i) => <td key={i}>{c}</td>)}</tr>)}</tbody></table>}
              <ol className="scoreSteps">{scoring.steps.map((t, i) => <li key={i}>{t}</li>)}</ol>
              {scoring.notes.map((n, i) => <p key={i} className="callout">{n}</p>)}
            </div>
            <div className="scoreImages">
              {scoring.target && <figure><a href={scoring.target.src} target="_blank" rel="noopener"><img src={scoring.target.src} alt={scoring.target.caption} loading="lazy" /></a><figcaption>{scoring.target.caption}</figcaption></figure>}
              <figure><a href={scoring.scorecard.src} target="_blank" rel="noopener"><img src={scoring.scorecard.src} alt={scoring.scorecard.caption} loading="lazy" /></a><figcaption>{scoring.scorecard.caption} · tap to enlarge</figcaption></figure>
            </div>
          </div>
        </details>
      )}
    </div>
  );
}
