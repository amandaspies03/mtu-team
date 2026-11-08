'use client';
import { AlertTriangle, CalendarDays, ClipboardCheck, Target, Users } from 'lucide-react';
import { useTeam } from '../../lib/data';
import { complianceIssues, daysUntil, displayName, eventRange, fiscalYear, fullName, kindLabel, milDate, scoreText, todayISO } from '../../lib/util';
import { ORDERS_LABEL } from '../../lib/types';
import { go } from '../app-shell';
import { Empty, Rsvp, Tag } from './ui';

export default function Dashboard() {
  const { me, isStaff, members, events, attendance, compliance, scores, courses, memberById } = useTeam();
  const today = todayISO();
  const upcoming = events.filter(e => (e.end_date ?? e.start_date) >= today).slice(0, 5);
  const next = upcoming[0];
  const active = members.filter(m => m.team_status === 'Active' || m.team_status === 'New');
  const fy = fiscalYear(today);
  const fyPractices = events.filter(e => e.kind !== 'match' && e.start_date < today && fiscalYear(e.start_date) === fy);
  const fyAttendance = attendance.filter(a => a.status === 'attended' && fyPractices.some(e => e.id === a.event_id)).length;
  const lastFy = events.filter(e => e.kind !== 'match' && fiscalYear(e.start_date) === fy - 1);
  const lastFyAtt = attendance.filter(a => a.status === 'attended' && lastFy.some(e => e.id === a.event_id)).length;
  const me_ = memberById(me.member_id);
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const alerts = active
    .map(m => ({ m, issues: complianceIssues(compliance.find(c => c.member_id === m.id)) }))
    .filter(x => x.issues.some(i => i.state === 'expired' || i.state === 'soon'));

  const ordersOpen = upcoming.flatMap(e => attendance
    .filter(a => a.event_id === e.id && a.status === 'planned' && (a.orders_status === 'none' || a.orders_status === 'submitted'))
    .map(a => ({ e, a, m: memberById(a.member_id) })));

  const mine = scores.filter(s => s.member_id === me.member_id).slice(-6).reverse();
  const recent = [...scores].filter(s => s.shot_on).sort((a, b) => (b.shot_on! > a.shot_on! ? 1 : -1)).slice(0, 8);
  const course = (c: string) => courses.find(x => x.code === c)?.name ?? c;

  return (
    <div>
      <div className="heading">
        <div className="eyebrow">{new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase()}</div>
        <h1>{greet}{me_ ? `, ${[me_.rank, me_.last_name].filter(Boolean).join(' ')}` : ''}.</h1>
      </div>

      {next ? (
        <div className="heroCard">
          <div className="circle"><CalendarDays size={24} /></div>
          <div className="grow">
            <div className="eyebrow">NEXT UP · {daysUntil(next.start_date) <= 0 ? 'TODAY' : `IN ${daysUntil(next.start_date)} DAYS`}</div>
            <h2>{next.title}</h2>
            <p>{eventRange(next)}{next.location ? ` · ${next.location}` : ''}</p>
            <div className="row">
              <button className="primary" onClick={() => go('event', next.id)}>Open {kindLabel[next.kind].toLowerCase()}</button>
              {!isStaff && <Rsvp event={next} />}
              {isStaff && <span className="formNote">{attendance.filter(a => a.event_id === next.id && a.status === 'planned').length} planning to attend</span>}
            </div>
          </div>
        </div>
      ) : (
        <div className="heroCard">
          <div className="circle"><CalendarDays size={24} /></div>
          <div className="grow"><h2>Nothing on the calendar</h2><p>{isStaff ? 'Add the next practice or match so the team can RSVP.' : 'Staff haven’t posted the next practice yet.'}</p>
            {isStaff && <button className="primary" onClick={() => go('events')}>Go to calendar</button>}</div>
        </div>
      )}

      <div className="stats">
        <div><Users size={18} /><strong>{active.length}</strong><span>active &amp; new shooters</span></div>
        <div><CalendarDays size={18} /><strong>{fyPractices.length}</strong><span>FY{String(fy).slice(2)} events so far</span></div>
        <div><ClipboardCheck size={18} /><strong>{fyPractices.length ? (fyAttendance / fyPractices.length).toFixed(1) : (lastFy.length ? (lastFyAtt / lastFy.length).toFixed(1) : '—')}</strong><span>avg shooters per {fyPractices.length ? 'event' : `event (FY${String(fy - 1).slice(2)})`}</span></div>
        <div><Target size={18} /><strong>{scores.length}</strong><span>scores on record</span></div>
      </div>

      <div className="grid2">
        <section className="panel">
          <div className="sectionTitle"><h2>Upcoming</h2><button onClick={() => go('events')}>Full calendar</button></div>
          {upcoming.length === 0 ? <Empty title="No upcoming events" /> : upcoming.map(e => {
            const planned = attendance.filter(a => a.event_id === e.id && a.status === 'planned').length;
            return (
              <button key={e.id} className="listRow" onClick={() => go('event', e.id)}>
                <div className="dateBlock"><b>{e.start_date.slice(8)}</b><span>{new Date(e.start_date + 'T12:00').toLocaleString('en-US', { month: 'short' }).toUpperCase()}</span></div>
                <div className="grow"><strong>{e.title}</strong><small>{kindLabel[e.kind]}{e.location ? ` · ${e.location}` : ''}</small></div>
                <Tag>{planned} going</Tag>
              </button>
            );
          })}
        </section>

        {isStaff ? (
          <section className="panel">
            <div className="sectionTitle"><h2>Needs attention</h2></div>
            {alerts.length === 0 && ordersOpen.length === 0 && <Empty title="All clear">No expiring quals or open orders for upcoming events.</Empty>}
            {ordersOpen.slice(0, 8).map(({ e, a, m }) => (
              <button key={a.id} className="listRow" onClick={() => go('event', e.id)}>
                <ClipboardCheck size={16} />
                <div className="grow"><strong>{fullName(m)}</strong><small>{e.title} · {eventRange(e)}</small></div>
                <Tag tone="warn">{ORDERS_LABEL[a.orders_status]}</Tag>
              </button>
            ))}
            {alerts.slice(0, 10).map(({ m, issues }) => (
              <button key={m.id} className="listRow" onClick={() => go('member', m.id)}>
                <AlertTriangle size={16} />
                <div className="grow"><strong>{fullName(m)}</strong><small>{issues.filter(i => i.state !== 'missing').map(i => `${i.label} ${i.state === 'expired' ? 'expired' : 'expiring'}`).join(' · ')}</small></div>
                <Tag tone={issues.some(i => i.state === 'expired') ? 'bad' : 'warn'}>{issues.some(i => i.state === 'expired') ? 'Expired' : 'Soon'}</Tag>
              </button>
            ))}
            {alerts.length > 10 && <button className="linkBtn" onClick={() => go('roster')}>+{alerts.length - 10} more on the roster</button>}
          </section>
        ) : (
          <section className="panel">
            <div className="sectionTitle"><h2>My recent scores</h2><button onClick={() => go('scores')}>All scores</button></div>
            {mine.length === 0 ? <Empty title="No scores yet">Scores staff enter for you will show up here.</Empty> : mine.map(s => (
              <div key={s.id} className="listRow static">
                <Target size={16} />
                <div className="grow"><strong>{course(s.course_code)}</strong><small>{s.shot_on ? milDate(s.shot_on) : s.session_label}</small></div>
                <span className="score">{scoreText(s.total, s.x_count, s.raw)}</span>
              </div>
            ))}
          </section>
        )}
      </div>

      {isStaff && (
        <section className="panel">
          <div className="sectionTitle"><h2>Latest scores entered</h2><button onClick={() => go('scores')}>Scores</button></div>
          <div className="tableWrap"><table>
            <thead><tr><th>Date</th><th>Shooter</th><th>Course</th><th className="num">Score</th></tr></thead>
            <tbody>{recent.map(s => <tr key={s.id}><td>{milDate(s.shot_on)}</td><td><a href={`#member/${s.member_id}`}>{displayName(memberById(s.member_id))}</a></td><td>{course(s.course_code)}</td><td className="num">{scoreText(s.total, s.x_count, s.raw)}</td></tr>)}</tbody>
          </table></div>
        </section>
      )}
    </div>
  );
}
