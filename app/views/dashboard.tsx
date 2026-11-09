'use client';
import { AlertTriangle, CalendarDays, ClipboardCheck, Target, Users } from 'lucide-react';
import { useTeam } from '../../lib/data';
import { complianceIssues, daysUntil, displayName, eventRange, fiscalYear, fullName, kindLabel, milDate, scoreText, todayISO } from '../../lib/util';
import { PREP_ITEMS, prepDone } from '../../lib/types';
import { go } from '../app-shell';
import { Empty, Rsvp, Tag } from './ui';

export default function Dashboard() {
  const { me, isStaff, members, events, attendance, compliance, scores, courses, memberById, profiles } = useTeam();
  const pendingSignups = profiles.filter(p => p.pending && !p.approved).length;
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

  const prepOpen = upcoming.filter(e => e.kind === 'practice' && prepDone(e) < PREP_ITEMS.length);

  const mine = scores.filter(s => s.member_id === me.member_id).slice(-6).reverse();
  const recent = [...scores].filter(s => s.shot_on).sort((a, b) => (b.shot_on! > a.shot_on! ? 1 : -1)).slice(0, 8);
  const course = (c: string) => courses.find(x => x.code === c)?.name ?? c;

  // Shooter-only numbers: just their own attendance.
  const myAttended = attendance.filter(a => a.member_id === me.member_id && a.status === 'attended')
    .map(a => events.find(e => e.id === a.event_id)).filter(e => e && e.kind === 'practice');
  const myFyPractices = myAttended.filter(e => fiscalYear(e!.start_date) === fy).length;
  const myAllPractices = myAttended.length;

  // Where this shooter ranks on each course, by best score among current shooters.
  const currentIds = new Set(members.filter(m => ['Active', 'New', 'Tryout'].includes(m.team_status)).map(m => m.id));
  const standings = courses.flatMap(c => {
    const best = new Map<string, { t: number; x: number; s: typeof scores[number] }>();
    scores.filter(s => s.course_code === c.code && s.total != null && (currentIds.has(s.member_id) || s.member_id === me.member_id)).forEach(s => {
      const cur = best.get(s.member_id), t = Number(s.total), x = s.x_count ?? 0;
      if (!cur || t > cur.t || (t === cur.t && x > cur.x)) best.set(s.member_id, { t, x, s });
    });
    const ranked = [...best.entries()].sort((a, b) => b[1].t - a[1].t || b[1].x - a[1].x);
    const i = ranked.findIndex(([id]) => id === me.member_id);
    if (i < 0) return [];
    const mineB = ranked[i][1].s, topB = ranked[0][1].s;
    return [{ code: c.code, name: c.name, rank: i + 1, of: ranked.length, best: scoreText(mineB.total, mineB.x_count, mineB.raw), top: scoreText(topB.total, topB.x_count, topB.raw) }];
  });

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
              <Rsvp event={next} />
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

      {!isStaff && (
        <div className="stats">
          <div><CalendarDays size={18} /><strong>{myFyPractices}</strong><span>practices attended in FY{String(fy).slice(2)}</span></div>
          <div><ClipboardCheck size={18} /><strong>{myAllPractices}</strong><span>practices attended, all time</span></div>
          <div><Target size={18} /><strong>{scores.filter(s => s.member_id === me.member_id).length}</strong><span>of my scores on record</span></div>
        </div>
      )}

      {isStaff && <div className="stats">
        <div><Users size={18} /><strong>{active.length}</strong><span>active &amp; new shooters</span></div>
        <div><CalendarDays size={18} /><strong>{fyPractices.length}</strong><span>FY{String(fy).slice(2)} events so far</span></div>
        <div><ClipboardCheck size={18} /><strong>{fyPractices.length ? (fyAttendance / fyPractices.length).toFixed(1) : (lastFy.length ? (lastFyAtt / lastFy.length).toFixed(1) : '—')}</strong><span>avg shooters per {fyPractices.length ? 'event' : `event (FY${String(fy - 1).slice(2)})`}</span></div>
        <div><Target size={18} /><strong>{scores.length}</strong><span>scores on record</span></div>
      </div>}

      <div className="grid2">
        <section className="panel">
          <div className="sectionTitle"><h2>Upcoming</h2><button onClick={() => go('events')}>Full calendar</button></div>
          {upcoming.length === 0 ? <Empty title="No upcoming events" /> : upcoming.map(e => {
            const planned = attendance.filter(a => a.event_id === e.id && a.status === 'planned').length;
            const mineA = attendance.find(a => a.event_id === e.id && a.member_id === me.member_id);
            return (
              <button key={e.id} className="listRow" onClick={() => go('event', e.id)}>
                <div className="dateBlock"><b>{e.start_date.slice(8)}</b><span>{new Date(e.start_date + 'T12:00').toLocaleString('en-US', { month: 'short' }).toUpperCase()}</span></div>
                <div className="grow"><strong>{e.title}</strong><small>{kindLabel[e.kind]}{e.location ? ` · ${e.location}` : ''}</small></div>
                {isStaff ? <Tag>{planned} going</Tag> : mineA ? <Tag tone={mineA.status === 'planned' ? 'info' : 'neutral'}>{mineA.status === 'planned' ? 'You’re going' : mineA.status === 'absent' ? 'Not going' : mineA.status}</Tag> : <Tag>No RSVP</Tag>}
              </button>
            );
          })}
        </section>

        {isStaff ? (
          <section className="panel">
            <div className="sectionTitle"><h2>Needs attention</h2></div>
            {pendingSignups > 0 && (
              <button className="listRow" onClick={() => go('admin')}>
                <Users size={16} />
                <div className="grow"><strong>{pendingSignups} sign-up{pendingSignups === 1 ? '' : 's'} waiting for approval</strong><small>New accounts · Admin → Access</small></div>
                <Tag tone="warn">Review</Tag>
              </button>
            )}
            {alerts.length === 0 && prepOpen.length === 0 && pendingSignups === 0 && <Empty title="All clear">No expiring quals or unfinished practice prep.</Empty>}
            {prepOpen.slice(0, 8).map(e => (
              <button key={e.id} className="listRow" onClick={() => go('event', e.id)}>
                <ClipboardCheck size={16} />
                <div className="grow"><strong>{e.title}</strong><small>{eventRange(e)} · prep checklist</small></div>
                <Tag tone="warn">{prepDone(e)}/{PREP_ITEMS.length} done</Tag>
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

      {!isStaff && standings.length > 0 && (
        <section className="panel">
          <div className="sectionTitle"><h2>How I stack up</h2><button onClick={() => go('scores')}>Leaderboards</button></div>
          <div className="standings">
            {standings.map(st => (
              <div key={st.code} className="standing">
                <span className="formNote">{st.name}</span>
                <strong>#{st.rank} <small>of {st.of}</small></strong>
                <span>Best {st.best} · team best {st.top}</span>
              </div>
            ))}
          </div>
          <p className="formNote">Ranked by best score among current shooters. Ties go to X count.</p>
        </section>
      )}

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
