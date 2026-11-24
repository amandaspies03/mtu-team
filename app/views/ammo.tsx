'use client';
import { useMemo, useState } from 'react';
import { Download, Settings2 } from 'lucide-react';
import { useTeam } from '../../lib/data';
import type { AmmoType } from '../../lib/types';
import { downloadCsv, fiscalYear, fmtDate, kindLabel, todayISO } from '../../lib/util';
import { go } from '../app-shell';
import { Empty, Modal, PageTitle } from './ui';

const num = (v: string) => (v === '' ? null : Math.max(0, Math.round(+v)));
const n = (v: number) => v.toLocaleString();

/**
 * FY ammo usage, laid out like the team's ammo spreadsheet: one row per ammo type, one column per
 * practice on the calendar. Everything drawn for an event is shot, so drawn rounds count as expended
 * once the event date has passed. Remaining = forecasted - expended.
 */
export default function AmmoReport() {
  const { sb, events, ammoTypes, ammoForecasts, eventAmmo, reload } = useTeam();
  const today = todayISO();
  const thisFy = fiscalYear(today);
  const fys = useMemo(() => [...new Set([thisFy, ...events.map(e => fiscalYear(e.start_date)), ...ammoForecasts.map(f => f.fiscal_year)])].sort((a, b) => b - a), [events, ammoForecasts, thisFy]);
  const [fy, setFy] = useState(thisFy);
  const [managing, setManaging] = useState(false);
  const [err, setErr] = useState('');
  const fyLabel = `FY${String(fy).slice(2)}`;

  // Columns: every practice in the fiscal year, plus any other event that has ammo on it.
  const withAmmo = new Set(eventAmmo.map(a => a.event_id));
  const cols = events.filter(e => fiscalYear(e.start_date) === fy && (e.kind === 'practice' || withAmmo.has(e.id)))
    .sort((a, b) => a.start_date.localeCompare(b.start_date));
  const colIds = new Set(cols.map(c => c.id));
  const lines = eventAmmo.filter(a => colIds.has(a.event_id));
  const cell = (typeId: string, eventId: string) => lines.find(a => a.ammo_type_id === typeId && a.event_id === eventId)?.drawn ?? null;
  const past = (eventId: string) => (cols.find(c => c.id === eventId)?.start_date ?? '9999') <= today;
  const forecast = (typeId: string) => ammoForecasts.find(f => f.fiscal_year === fy && f.ammo_type_id === typeId)?.rounds ?? null;

  // Active types, plus any retired type that still has numbers this year.
  const rows = ammoTypes.filter(t => t.active || forecast(t.id) != null || lines.some(l => l.ammo_type_id === t.id)).map(t => {
    const expended = lines.filter(l => l.ammo_type_id === t.id && past(l.event_id)).reduce((s, l) => s + (l.drawn ?? 0), 0);
    const planned = lines.filter(l => l.ammo_type_id === t.id && !past(l.event_id)).reduce((s, l) => s + (l.drawn ?? 0), 0);
    const f = forecast(t.id);
    return { t, f, expended, planned, remaining: f == null ? null : f - expended };
  });
  const totals = rows.reduce((s, r) => ({ expended: s.expended + r.expended, planned: s.planned + r.planned }), { expended: 0, planned: 0 });

  async function saveForecast(t: AmmoType, value: number | null) {
    setErr('');
    const { error } = value == null
      ? await sb.from('ammo_forecasts').delete().eq('fiscal_year', fy).eq('ammo_type_id', t.id)
      : await sb.from('ammo_forecasts').upsert({ fiscal_year: fy, ammo_type_id: t.id, rounds: value, updated_at: new Date().toISOString() });
    if (error) setErr(error.message); else await reload();
  }

  function exportCsv() {
    downloadCsv(`MTU ammo usage ${fyLabel}.csv`, [
      [`${fyLabel} Ammo Usage`, '', '', '', '', 'Practice dates'],
      ['', '', '', '', '', ...cols.map(c => fmtDate(c.start_date, { day: '2-digit', month: 'short', year: 'numeric' }) + (c.kind === 'practice' ? '' : ` (${kindLabel[c.kind]})`))],
      ['Nomenclature', 'Forecasted', 'DODIC', 'Remaining', 'Expended', ...cols.map(() => 'Ammo draw')],
      ...rows.map(r => [r.t.nomenclature, r.f, r.t.dodic, r.remaining, r.expended, ...cols.map(c => cell(r.t.id, c.id))]),
    ]);
  }

  return (
    <div>
      <PageTitle eyebrow="CUSTODIAN" title="Ammo report"
        actions={<>
          <label className="inlineLabel">Fiscal year<select value={fy} onChange={e => setFy(+e.target.value)}>{fys.map(y => <option key={y} value={y}>FY{String(y).slice(2)}</option>)}</select></label>
          <button className="secondary" onClick={() => setManaging(true)}><Settings2 size={15} /> Ammo types</button>
          {rows.length > 0 && <button className="secondary" onClick={exportCsv}><Download size={15} /> Export for Excel</button>}
        </>}>
        Forecasted rounds for {fyLabel} and what’s drawn for each practice. Everything drawn is shot, so a practice’s rounds count as expended once its date has passed. Remaining is forecasted minus expended. Enter ammo on each practice’s page; type the forecast right in the table. Fiscal year runs 1 Oct – 30 Sep.
      </PageTitle>

      <div className="stats">
        <div><strong>{n(totals.expended)}</strong><span>rds expended</span></div>
        <div><strong>{n(totals.planned)}</strong><span>rds planned for upcoming practices</span></div>
        <div><strong>{cols.filter(c => past(c.id)).length}/{cols.length}</strong><span>practices done</span></div>
        <div><strong>{rows.filter(r => r.remaining != null && r.remaining < 0).length}</strong><span>types over forecast</span></div>
      </div>
      {err && <p className="alert">{err}</p>}

      {rows.length === 0 ? <Empty title="No ammo types yet">Use “Ammo types” to add the ammo assigned to the team.</Empty> : (
        <section className="panel">
          <div className="tableWrap"><table className="ammoGrid">
            <thead>
              <tr>
                <th>Nomenclature</th><th className="num">Forecasted</th><th>DODIC</th><th className="num">Remaining</th><th className="num">Expended</th><th className="num">Planned</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.t.id} className={r.t.active ? '' : 'muted'}>
                  <td><b>{r.t.nomenclature}</b></td>
                  <td className="num"><input className="numIn" type="number" min={0} inputMode="numeric" aria-label={`${fyLabel} forecast for ${r.t.nomenclature}`} defaultValue={r.f ?? ''} key={`${fy}-${r.t.id}-${r.f}`}
                    onBlur={x => { const v = num(x.target.value); if (v !== r.f) void saveForecast(r.t, v); }} /></td>
                  <td>{r.t.dodic}</td>
                  <td className={`num ${r.remaining != null && r.remaining < 0 ? 'over' : ''}`}><b>{r.remaining == null ? '—' : n(r.remaining)}</b></td>
                  <td className="num">{n(r.expended)}</td>
                  <td className="num muted">{r.planned ? n(r.planned) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
          <p className="formNote">Planned is ammo entered on upcoming practices. It doesn’t count against the forecast until the practice date passes.</p>
        </section>
      )}

      {rows.length > 0 && (
        <section className="panel">
          <div className="sectionTitle"><h2>Practices</h2><span className="formNote">Rounds drawn · click a row to open it</span></div>
          {cols.length === 0 ? <p className="formNote">No practices on the calendar for {fyLabel} yet.</p> : (
            <div className="tableWrap"><table className="ammoGrid">
              <thead><tr><th>Date</th><th>Event</th>{rows.map(r => <th key={r.t.id} className="num" title={`${r.t.nomenclature} (${r.t.dodic})`}>{r.t.nomenclature}</th>)}</tr></thead>
              <tbody>
                {cols.map(c => (
                  <tr key={c.id} className={`clickable ${past(c.id) ? '' : 'upcoming'}`} onClick={() => go('event', c.id)}>
                    <td>{fmtDate(c.start_date)}</td>
                    <td>{c.title}{c.kind !== 'practice' && <small className="sub">{kindLabel[c.kind]}</small>}{!past(c.id) && <small className="sub">Upcoming</small>}</td>
                    {rows.map(r => { const v = cell(r.t.id, c.id); return <td key={r.t.id} className="num">{v == null ? '' : n(v)}</td>; })}
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
          <p className="formNote">Grey rows are upcoming. Their numbers are the planned draw.</p>
        </section>
      )}
      {managing && <AmmoTypes onClose={() => setManaging(false)} />}
    </div>
  );
}

/** Add, rename or retire ammo types. Retired types drop off the practice dropdown but keep their history. */
function AmmoTypes({ onClose }: { onClose: () => void }) {
  const { sb, ammoTypes, eventAmmo, reload } = useTeam();
  const [f, setF] = useState({ nomenclature: '', dodic: '', caliber: '' });
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const calibers = [...new Set(['5.56', '9mm', '7.62', '12 ga', ...ammoTypes.map(t => t.caliber)])];

  async function run(q: PromiseLike<{ error: { message: string } | null }>) {
    setErr(''); setBusy(true);
    const { error } = await q;
    setBusy(false);
    if (error) { setErr(/duplicate key/.test(error.message) ? 'That DODIC is already on the list.' : error.message); return false; }
    await reload(); return true;
  }
  async function addType() {
    if (!f.nomenclature.trim() || !f.dodic.trim()) { setErr('Enter the nomenclature and the DODIC.'); return; }
    const ok = await run(sb.from('ammo_types').insert({ nomenclature: f.nomenclature.trim(), dodic: f.dodic.trim().toUpperCase(), caliber: f.caliber.trim() || 'Other', sort: Math.max(0, ...ammoTypes.map(t => t.sort)) + 1 }));
    if (ok) setF({ nomenclature: '', dodic: '', caliber: '' });
  }
  const patch = (t: AmmoType, change: Partial<AmmoType>) => run(sb.from('ammo_types').update(change).eq('id', t.id));
  async function remove(t: AmmoType) {
    if (eventAmmo.some(a => a.ammo_type_id === t.id)) { setErr(`${t.nomenclature} has been used on events, so it can’t be deleted. Untick “In use” to retire it instead.`); return; }
    if (confirm(`Delete ${t.nomenclature} (${t.dodic}) and its forecasts?`)) await run(sb.from('ammo_types').delete().eq('id', t.id));
  }

  return (
    <Modal title="Ammo types" onClose={onClose}>
      <p className="formNote">Every ammo type assigned to the team. Each one gets a row on the ammo report and shows up in the practice ammo dropdown while it’s in use.</p>
      <div className="tableWrap"><table className="rowEntry">
        <thead><tr><th>Nomenclature</th><th>DODIC</th><th>Caliber</th><th>In use</th><th /></tr></thead>
        <tbody>
          {ammoTypes.map(t => (
            <tr key={t.id}>
              <td><input defaultValue={t.nomenclature} key={`n-${t.nomenclature}`} aria-label="Nomenclature" onBlur={x => { const v = x.target.value.trim(); if (v && v !== t.nomenclature) void patch(t, { nomenclature: v }); }} /></td>
              <td><input defaultValue={t.dodic} key={`d-${t.dodic}`} aria-label="DODIC" onBlur={x => { const v = x.target.value.trim().toUpperCase(); if (v && v !== t.dodic) void patch(t, { dodic: v }); }} /></td>
              <td><select value={t.caliber} aria-label="Caliber" onChange={x => void patch(t, { caliber: x.target.value })}>{calibers.map(c => <option key={c}>{c}</option>)}</select></td>
              <td><input type="checkbox" checked={t.active} aria-label="In use" onChange={x => void patch(t, { active: x.target.checked })} /></td>
              <td><button className="linkBtn" disabled={busy} onClick={() => remove(t)}>Delete</button></td>
            </tr>
          ))}
          <tr>
            <td><input value={f.nomenclature} onChange={x => setF({ ...f, nomenclature: x.target.value })} placeholder="e.g. 9mm M1152 Ball" aria-label="New nomenclature" /></td>
            <td><input value={f.dodic} onChange={x => setF({ ...f, dodic: x.target.value })} placeholder="AC20" aria-label="New DODIC" /></td>
            <td><select value={f.caliber} onChange={x => setF({ ...f, caliber: x.target.value })} aria-label="New caliber"><option value="">Caliber…</option>{calibers.map(c => <option key={c}>{c}</option>)}</select></td>
            <td colSpan={2}><button className="primary" disabled={busy} onClick={addType}>Add</button></td>
          </tr>
        </tbody>
      </table></div>
      {err && <p className="alert">{err}</p>}
      <div className="formActions"><button className="secondary" onClick={onClose}>Done</button></div>
    </Modal>
  );
}
