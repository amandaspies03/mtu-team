'use client';
import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { useTeam } from '../../lib/data';
import { downloadCsv, eventRange, fiscalYear, fullName, todayISO } from '../../lib/util';
import { go } from '../app-shell';
import { Empty, PageTitle } from './ui';

export default function AmmoReport() {
  const { events, attendance, members } = useTeam();
  const thisFy = fiscalYear(todayISO());
  const fys = useMemo(() => [...new Set([thisFy, ...events.map(e => fiscalYear(e.start_date))])].sort((a, b) => b - a), [events, thisFy]);
  const [fy, setFy] = useState(thisFy);

  const rows = events.filter(e => fiscalYear(e.start_date) === fy).map(e => {
    const att = attendance.filter(a => a.event_id === e.id);
    return {
      e,
      shooters: att.filter(a => (a.ammo_556 ?? 0) > 0 || (a.ammo_9mm ?? 0) > 0).length,
      r: att.reduce((t, a) => t + (a.ammo_556 ?? 0), 0),
      p: att.reduce((t, a) => t + (a.ammo_9mm ?? 0), 0),
    };
  }).filter(x => x.r || x.p);
  const total = rows.reduce((t, x) => ({ r: t.r + x.r, p: t.p + x.p }), { r: 0, p: 0 });

  const ids = new Set(rows.map(x => x.e.id));
  const byShooter = members.map(m => {
    const att = attendance.filter(a => a.member_id === m.id && ids.has(a.event_id));
    return { m, n: att.filter(a => (a.ammo_556 ?? 0) > 0 || (a.ammo_9mm ?? 0) > 0).length, r: att.reduce((t, a) => t + (a.ammo_556 ?? 0), 0), p: att.reduce((t, a) => t + (a.ammo_9mm ?? 0), 0) };
  }).filter(x => x.r || x.p).sort((a, b) => b.r + b.p - (a.r + a.p));

  function exportEvents() {
    const detail = rows.flatMap(({ e }) => attendance.filter(a => a.event_id === e.id && ((a.ammo_556 ?? 0) > 0 || (a.ammo_9mm ?? 0) > 0)).map(a => {
      const m = members.find(x => x.id === a.member_id);
      return [e.start_date, e.title, m?.last_name, m?.first_name, m?.rank, a.ammo_556 ?? 0, a.ammo_9mm ?? 0];
    }));
    downloadCsv(`MTU ammo FY${String(fy).slice(2)} by practice.csv`, [['Date', 'Event', 'Last', 'First', 'Rank', '5.56 rds', '9mm rds'], ...detail, [], ['', 'TOTAL', '', '', '', total.r, total.p]]);
  }
  function exportShooters() {
    downloadCsv(`MTU ammo FY${String(fy).slice(2)} by shooter.csv`, [['Last', 'First', 'Rank', 'Events', '5.56 rds', '9mm rds'], ...byShooter.map(x => [x.m.last_name, x.m.first_name, x.m.rank, x.n, x.r, x.p]), [], ['TOTAL', '', '', '', total.r, total.p]]);
  }

  return (
    <div>
      <PageTitle eyebrow="CUSTODIAN" title="Ammo report"
        actions={<label className="inlineLabel">Fiscal year<select value={fy} onChange={e => setFy(+e.target.value)}>{fys.map(y => <option key={y} value={y}>FY{String(y).slice(2)}</option>)}</select></label>}>
        Rounds issued at each practice and match, from the ammo columns on each event’s roster. Fiscal year runs 1 Oct – 30 Sep.
      </PageTitle>
      <div className="stats">
        <div><strong>{total.r.toLocaleString()}</strong><span>rds 5.56 issued</span></div>
        <div><strong>{total.p.toLocaleString()}</strong><span>rds 9mm issued</span></div>
        <div><strong>{rows.length}</strong><span>events with ammo</span></div>
        <div><strong>{byShooter.length}</strong><span>shooters issued</span></div>
      </div>
      {rows.length === 0 ? <Empty title={`No ammo logged for FY${String(fy).slice(2)}`}>Enter rounds issued on each practice’s roster and they’ll total up here.</Empty> : (
        <div className="grid2">
          <section className="panel">
            <div className="sectionTitle"><h2>By practice / match</h2><button onClick={exportEvents}><Download size={14} /> CSV</button></div>
            <div className="tableWrap"><table>
              <thead><tr><th>Date</th><th>Event</th><th className="num">Shooters</th><th className="num">5.56</th><th className="num">9mm</th></tr></thead>
              <tbody>
                {rows.map(x => <tr key={x.e.id} className="clickable" onClick={() => go('event', x.e.id)}><td>{eventRange(x.e)}</td><td>{x.e.title}</td><td className="num">{x.shooters}</td><td className="num">{x.r}</td><td className="num">{x.p}</td></tr>)}
                <tr className="totalRow"><td colSpan={3}>Total</td><td className="num">{total.r}</td><td className="num">{total.p}</td></tr>
              </tbody>
            </table></div>
          </section>
          <section className="panel">
            <div className="sectionTitle"><h2>By shooter</h2><button onClick={exportShooters}><Download size={14} /> CSV</button></div>
            <div className="tableWrap"><table>
              <thead><tr><th>Shooter</th><th className="num">Events</th><th className="num">5.56</th><th className="num">9mm</th></tr></thead>
              <tbody>{byShooter.map(x => <tr key={x.m.id}><td><a href={`#member/${x.m.id}`}>{fullName(x.m)}</a></td><td className="num">{x.n}</td><td className="num">{x.r}</td><td className="num">{x.p}</td></tr>)}</tbody>
            </table></div>
          </section>
        </div>
      )}
    </div>
  );
}
