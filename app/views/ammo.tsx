'use client';
import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { useTeam } from '../../lib/data';
import { downloadCsv, eventRange, fiscalYear, kindLabel, todayISO } from '../../lib/util';
import { go } from '../app-shell';
import { Empty, PageTitle } from './ui';

export default function AmmoReport() {
  const { events, attendance } = useTeam();
  const thisFy = fiscalYear(todayISO());
  const fys = useMemo(() => [...new Set([thisFy, ...events.map(e => fiscalYear(e.start_date))])].sort((a, b) => b - a), [events, thisFy]);
  const [fy, setFy] = useState(thisFy);

  const rows = events.filter(e => fiscalYear(e.start_date) === fy && ((e.ammo_556 ?? 0) > 0 || (e.ammo_9mm ?? 0) > 0)).map(e => ({
    e,
    shooters: attendance.filter(a => a.event_id === e.id && a.status === 'attended').length,
    r: e.ammo_556 ?? 0,
    p: e.ammo_9mm ?? 0,
  }));
  const total = rows.reduce((t, x) => ({ r: t.r + x.r, p: t.p + x.p }), { r: 0, p: 0 });
  const fyLabel = `FY${String(fy).slice(2)}`;

  function exportCsv() {
    downloadCsv(`MTU ammo ${fyLabel}.csv`, [
      ['Date', 'Event', 'Type', 'Shooters attended', '5.56 rds issued', '9mm rds issued'],
      ...rows.map(x => [x.e.start_date, x.e.title, kindLabel[x.e.kind], x.shooters, x.r, x.p]),
      [], ['', 'TOTAL', '', '', total.r, total.p],
    ]);
  }

  return (
    <div>
      <PageTitle eyebrow="CUSTODIAN" title="Ammo report"
        actions={<>
          <label className="inlineLabel">Fiscal year<select value={fy} onChange={e => setFy(+e.target.value)}>{fys.map(y => <option key={y} value={y}>FY{String(y).slice(2)}</option>)}</select></label>
          {rows.length > 0 && <button className="secondary" onClick={exportCsv}><Download size={15} /> Export CSV</button>}
        </>}>
        Rounds issued for each practice and match. Enter them on the event’s page. Fiscal year runs 1 Oct – 30 Sep.
      </PageTitle>
      <div className="stats">
        <div><strong>{total.r.toLocaleString()}</strong><span>rds 5.56 issued</span></div>
        <div><strong>{total.p.toLocaleString()}</strong><span>rds 9mm issued</span></div>
        <div><strong>{rows.length}</strong><span>events with ammo</span></div>
        <div><strong>{rows.reduce((t, x) => t + x.shooters, 0)}</strong><span>shooter visits</span></div>
      </div>
      {rows.length === 0 ? <Empty title={`No ammo logged for ${fyLabel}`}>Open a practice or match and enter the rounds issued at the top of the page.</Empty> : (
        <section className="panel">
          <div className="tableWrap"><table>
            <thead><tr><th>Date</th><th>Event</th><th className="num">Shooters</th><th className="num">5.56</th><th className="num">9mm</th></tr></thead>
            <tbody>
              {rows.map(x => <tr key={x.e.id} className="clickable" onClick={() => go('event', x.e.id)}><td>{eventRange(x.e)}</td><td>{x.e.title} <small className="sub">{kindLabel[x.e.kind]}</small></td><td className="num">{x.shooters || '—'}</td><td className="num">{x.r}</td><td className="num">{x.p}</td></tr>)}
              <tr className="totalRow"><td colSpan={3}>Total</td><td className="num">{total.r}</td><td className="num">{total.p}</td></tr>
            </tbody>
          </table></div>
        </section>
      )}
    </div>
  );
}
