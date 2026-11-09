'use client';
// Digital scorecards for each match, laid out like the paper NGMTC cards. Totals add up as you type.
// Entries are kept in this browser (per match) so a page reload on the range doesn't lose them.
import { useEffect, useState } from 'react';
import { Delete, RotateCcw } from 'lucide-react';

type Grid = number[][]; // [row][target]
type RingCard = { kind: 'ring'; blocks: Grid[]; penalties: number };
type ShotCard = { kind: 'shots'; shots: (string | null)[] };
type Card = RingCard | ShotCard;

const TARGETS = [0, 1, 2, 3];
const zeros = (rows: number): Grid => Array.from({ length: rows }, () => [0, 0, 0, 0]);
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

// ---- Match definitions -------------------------------------------------------------
const PI2210_ROWS = [{ label: 'X', pts: 5 }, { label: '5', pts: 5 }, { label: '4', pts: 4 }, { label: '3', pts: 3 }, { label: '2', pts: 2 }];
const FIG11_S1_ROWS = [{ label: 'Facial', pts: 5 }, { label: '5', pts: 5 }, { label: '4', pts: 4 }, { label: '3', pts: 3 }, { label: '2', pts: 2 }];
const FIG11_S2_ROWS = [{ label: '5', pts: 5 }, { label: '4', pts: 4 }, { label: '3', pts: 3 }, { label: '2', pts: 2 }];
const RIFLE_ROWS = [{ label: 'Stage 1', sub: 'Standing' }, { label: 'Stage 2', sub: 'Kneeling' }, { label: 'Stage 3', sub: 'Sitting' }, { label: 'Stage 4', sub: 'Prone' }, { label: 'Stage 4', sub: 'Prone (cont.)' }];
const RIFLE_KEYS: { key: string; label: string; pts: number }[] = [
  { key: 'X', label: 'X', pts: 10 }, { key: '9', label: '9', pts: 9 }, { key: '8', label: '8', pts: 8 }, { key: '7', label: '7', pts: 7 }, { key: 'M', label: 'Miss / 6', pts: 0 },
];
const rifleValue = (k: string | null) => RIFLE_KEYS.find(r => r.key === k)?.pts ?? 0;

function blank(code: string): Card | null {
  if (code === 'PI2210') return { kind: 'ring', blocks: [zeros(5), zeros(5)], penalties: 0 };
  if (code === 'PI2250' || code === 'RI3020') return { kind: 'ring', blocks: [zeros(5), zeros(4)], penalties: 0 };
  if (code === 'RIFLE EIC') return { kind: 'shots', shots: Array(50).fill(null) };
  return null;
}

// ---- Scoring -----------------------------------------------------------------------
type Result = { total: number; x: number; parts: { label: string; pts: number; max: number }[]; perTarget: number[][]; warnings: string[]; entered: number; expected: number; max: number };

function scorePI2210(c: RingCard): Result {
  const warnings: string[] = [];
  const parts = c.blocks.map((g, b) => {
    TARGETS.forEach(t => { const h = sum(g.map(r => r[t])); if (h > 5) warnings.push(`Stages ${b ? '3 & 4' : '1 & 2'}, target ${t + 1}: ${h} hits recorded — only 5 count per target. Check with the block officer.`); });
    return { label: b ? 'Stages 3 & 4' : 'Stages 1 & 2', pts: sum(g.map((r, i) => sum(r) * PI2210_ROWS[i].pts)), max: 100 };
  });
  const x = sum(c.blocks.map(g => sum(g[0])));
  const entered = sum(c.blocks.map(g => sum(g.map(sum))));
  return { total: Math.max(0, sum(parts.map(p => p.pts)) - c.penalties * 5), x, parts, perTarget: [], warnings, entered, expected: 40, max: 200 };
}

function scoreFig11(c: RingCard): Result {
  const warnings: string[] = [];
  const [s1, s2] = c.blocks;
  const s1Targets = TARGETS.map(t => {
    const facial = s1[0][t], body = [1, 2, 3, 4].map(i => s1[i][t]);
    const hits = facial + sum(body);
    if (hits > 3) warnings.push(`Stage 1, target ${t + 1}: ${hits} hits recorded — only 3 count per target.`);
    if (facial === 0) { if (sum(body) > 0) warnings.push(`Stage 1, target ${t + 1}: no facial hit, so its body hits score 0.`); return 0; }
    return 5 + (facial - 1) * 2 + sum(body.map((n, i) => n * FIG11_S1_ROWS[i + 1].pts));
  });
  const s2Targets = TARGETS.map(t => {
    const hits = sum(s2.map(r => r[t]));
    if (hits > 6) warnings.push(`Stage 2, target ${t + 1}: ${hits} hits recorded — only 6 count per target.`);
    return sum(s2.map((r, i) => r[t] * FIG11_S2_ROWS[i].pts));
  });
  const parts = [{ label: 'Stage 1', pts: sum(s1Targets), max: 60 }, { label: 'Stage 2', pts: sum(s2Targets), max: 120 }];
  const entered = sum(s1.map(sum)) + sum(s2.map(sum));
  return { total: Math.max(0, sum(parts.map(p => p.pts)) - c.penalties * 5), x: 0, parts, perTarget: [s1Targets, s2Targets], warnings, entered, expected: 36, max: 180 };
}

function scoreRifle(c: ShotCard): Result {
  const rows = RIFLE_ROWS.map((_, r) => c.shots.slice(r * 10, r * 10 + 10));
  const rowPts = rows.map(row => sum(row.map(rifleValue)));
  const parts = [
    { label: 'Stage 1', pts: rowPts[0], max: 100 }, { label: 'Stage 2', pts: rowPts[1], max: 100 },
    { label: 'Stage 3', pts: rowPts[2], max: 100 }, { label: 'Stage 4', pts: rowPts[3] + rowPts[4], max: 200 },
  ];
  return { total: sum(rowPts), x: c.shots.filter(s => s === 'X').length, parts, perTarget: [rowPts], warnings: [], entered: c.shots.filter(Boolean).length, expected: 50, max: 500 };
}

function score(code: string, c: Card): Result {
  if (c.kind === 'shots') return scoreRifle(c);
  return code === 'PI2210' ? scorePI2210(c) : scoreFig11(c);
}

// ---- Storage -----------------------------------------------------------------------
const storeKey = (code: string) => `mtu-scorecard-${code}`;
function load(code: string): Card | null {
  const fresh = blank(code);
  if (!fresh) return null;
  try {
    const saved = JSON.parse(localStorage.getItem(storeKey(code)) ?? 'null') as Card | null;
    if (saved && saved.kind === fresh.kind && JSON.stringify(Object.keys(saved)) === JSON.stringify(Object.keys(fresh))) {
      if (saved.kind === 'ring' && fresh.kind === 'ring' && saved.blocks.length === fresh.blocks.length && saved.blocks.every((g, i) => g.length === fresh.blocks[i].length)) return saved;
      if (saved.kind === 'shots' && saved.shots.length === 50) return saved;
    }
  } catch { /* storage unavailable or bad data: start fresh */ }
  return fresh;
}

// ---- Component ---------------------------------------------------------------------
export function Scorecard({ code, title }: { code: string; title: string }) {
  const [card, setCard] = useState<Card | null>(() => blank(code));
  const [cursor, setCursor] = useState(0);
  useEffect(() => { const c = load(code); setCard(c); setCursor(c?.kind === 'shots' ? Math.max(0, c.shots.findIndex(s => !s)) : 0); }, [code]);
  useEffect(() => { if (card) try { localStorage.setItem(storeKey(code), JSON.stringify(card)); } catch { /* ignore */ } }, [card, code]);
  if (!card) return null;
  const res = score(code, card);
  const totalText = `${res.total}${code === 'PI2210' || code === 'RIFLE EIC' ? `-${res.x}X` : ''}`;

  function clear() {
    if (!window.confirm('Clear this scorecard?')) return;
    setCard(blank(code)); setCursor(0);
  }

  return (
    <section className="panel scorecardPanel" aria-label={`${title} scorecard`}>
      <div className="scHead">
        <div><h2>Scorecard</h2><small>{title} · fill it in like the paper card</small></div>
        <button className="secondary" onClick={clear}><RotateCcw size={14} /> Clear card</button>
      </div>

      {card.kind === 'ring' && code === 'PI2210' && card.blocks.map((g, b) => (
        <RingTable key={b} title={b ? 'Stages 3 & 4' : 'Stages 1 & 2'} note="Max 5 hits per target" rows={PI2210_ROWS} grid={g} sub={res.parts[b]}
          onChange={ng => setCard({ ...card, blocks: card.blocks.map((x, i) => (i === b ? ng : x)) })} />
      ))}
      {card.kind === 'ring' && code !== 'PI2210' && <>
        <RingTable title="Stage 1" note="Needs a facial hit to score. Max 3 hits per target. Extra facial hits = 2 pts." rows={FIG11_S1_ROWS} grid={card.blocks[0]} sub={res.parts[0]} targetPts={res.perTarget[0]}
          factorNote={(i) => (i === 0 ? '5 / 2' : undefined)}
          onChange={ng => setCard({ ...card, blocks: [ng, card.blocks[1]] })} />
        <RingTable title="Stage 2" note="Max 6 hits per target" rows={FIG11_S2_ROWS} grid={card.blocks[1]} sub={res.parts[1]} targetPts={res.perTarget[1]}
          onChange={ng => setCard({ ...card, blocks: [card.blocks[0], ng] })} />
      </>}
      {card.kind === 'ring' && (
        <label className="penalty">Late shots / penalties (−5 each)
          <Stepper value={card.penalties} max={50} label="Late shots or penalties" onChange={v => setCard({ ...card, penalties: v })} />
        </label>
      )}

      {card.kind === 'shots' && (
        <div className="shotCard">
          <p className="scNote">Tap a box, then tap the ring value. It moves to the next box on its own. A 6 or off the target is a miss.</p>
          <div className="shotRows">
            {RIFLE_ROWS.map((r, ri) => (
              <div className="shotRow" key={ri}>
                <span className="shotLabel"><b>{r.label}</b><small>{r.sub}</small></span>
                <div className="shotBoxes">
                  {card.shots.slice(ri * 10, ri * 10 + 10).map((s, i) => {
                    const idx = ri * 10 + i;
                    return <button key={idx} className={`shotBox${idx === cursor ? ' cur' : ''}${s === 'X' ? ' x' : ''}${s === 'M' ? ' miss' : ''}`} aria-label={`Shot ${i + 1}, ${r.label}${s ? `: ${s === 'M' ? 'miss' : s}` : ': empty'}`} onClick={() => setCursor(idx)}>{s === 'M' ? '0' : s ?? ''}</button>;
                  })}
                </div>
                <b className="shotTotal">{sum(card.shots.slice(ri * 10, ri * 10 + 10).map(rifleValue))}</b>
              </div>
            ))}
          </div>
          <div className="keypad" role="group" aria-label="Shot value">
            {RIFLE_KEYS.map(k => (
              <button key={k.key} className={k.key === 'X' ? 'primary' : 'secondary'} onClick={() => {
                const shots = card.shots.slice(); shots[cursor] = k.key; setCard({ ...card, shots }); setCursor(Math.min(49, cursor + 1));
              }}>{k.label}</button>
            ))}
            <button className="secondary" aria-label="Erase shot" onClick={() => {
              const at = card.shots[cursor] ? cursor : Math.max(0, cursor - 1);
              const shots = card.shots.slice(); shots[at] = null; setCard({ ...card, shots }); setCursor(at);
            }}><Delete size={16} /></button>
          </div>
        </div>
      )}

      {res.warnings.length > 0 && <ul className="scWarn">{res.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>}

      <div className="scTotals">
        {res.parts.map(p => <div key={p.label}><span>{p.label}</span><b>{p.pts}<small>/{p.max}</small></b></div>)}
        {card.kind === 'ring' && card.penalties > 0 && <div><span>Penalties</span><b>−{card.penalties * 5}</b></div>}
        <div className="scGrand"><span>Total</span><b>{totalText}<small>/{res.max}</small></b></div>
      </div>
      <p className="scNote">{res.entered} of {res.expected} shots entered.{res.entered > res.expected ? ' That’s more than the match fires — double-check the card.' : ''} The paper card signed by the scorer and shooter is still the official score.</p>
    </section>
  );
}

function RingTable({ title, note, rows, grid, sub, targetPts, factorNote, onChange }: {
  title: string; note: string; rows: { label: string; pts: number }[]; grid: Grid; sub: { pts: number; max: number };
  targetPts?: number[]; factorNote?: (i: number) => string | undefined; onChange: (g: Grid) => void;
}) {
  const set = (r: number, t: number, v: number) => onChange(grid.map((row, ri) => (ri === r ? row.map((c, ti) => (ti === t ? v : c)) : row)));
  return (
    <div className="ringTable">
      <div className="ringHead"><h3>{title}</h3><small>{note}</small></div>
      <div className="tableWrap">
        <table>
          <thead><tr><th>Ring</th>{TARGETS.map(t => <th key={t}>T{t + 1}</th>)}<th>Hits</th><th>×</th><th>Pts</th></tr></thead>
          <tbody>
            {rows.map((row, ri) => {
              const hits = sum(grid[ri]);
              return (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  {TARGETS.map(t => <td key={t}><Stepper value={grid[ri][t]} max={9} label={`${title}, ${row.label} ring, target ${t + 1}`} onChange={v => set(ri, t, v)} compact /></td>)}
                  <td className="num">{hits}</td>
                  <td className="num muted">{factorNote?.(ri) ?? row.pts}</td>
                  <td className="num">{factorNote ? '' : hits * row.pts}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            {targetPts && <tr><th scope="row">Pts</th>{targetPts.map((p, t) => <td key={t} className="num"><b>{p}</b></td>)}<td colSpan={3} /></tr>}
            <tr><th scope="row" colSpan={7}>{title} sub total</th><td className="num"><b>{sub.pts}</b></td></tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

/** Big-target number entry: type a digit or tap − / +. */
function Stepper({ value, max, label, onChange, compact }: { value: number; max: number; label: string; onChange: (v: number) => void; compact?: boolean }) {
  return (
    <span className={`stepper${compact ? ' compact' : ''}`}>
      {!compact && <button type="button" aria-label={`Less: ${label}`} onClick={() => onChange(Math.max(0, value - 1))}>−</button>}
      <input aria-label={label} inputMode="numeric" pattern="[0-9]*" maxLength={2} value={value || ''} placeholder="0"
        onFocus={e => e.currentTarget.select()}
        onChange={e => { const n = parseInt(e.target.value.replace(/\D/g, '') || '0', 10); onChange(Math.min(max, Math.max(0, n))); }} />
      {!compact && <button type="button" aria-label={`More: ${label}`} onClick={() => onChange(Math.min(max, value + 1))}>+</button>}
    </span>
  );
}
