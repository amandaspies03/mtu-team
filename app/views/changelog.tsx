'use client';
import { useEffect, useState } from 'react';
import { useTeam } from '../../lib/data';
import { fullName } from '../../lib/util';
import { Empty, Tag } from './ui';

type Entry = {
  id: number; at: string; actor_email: string | null; table_name: string; op: 'INSERT' | 'UPDATE' | 'DELETE';
  row_id: string | null; old_data: Record<string, unknown> | null; new_data: Record<string, unknown> | null;
};

const TABLES: Record<string, string> = {
  members: 'Roster', member_compliance: 'Quals', events: 'Calendar', attendance: 'Attendance', scores: 'Scores',
  match_teams: 'Match teams', match_team_members: 'Match team members', profiles: 'Accounts', staff_emails: 'Staff list', invites: 'Invites',
};
const OPS = { INSERT: ['Added', 'good'], UPDATE: ['Changed', 'info'], DELETE: ['Deleted', 'bad'] } as const;
const HIDDEN = new Set(['id', 'created_at', 'updated_at', 'event_id', 'member_id', 'team_id', 'token', 'created_by', 'used_by', 'added_by']);
const label = (k: string) => k.replace(/_/g, ' ').replace(/\bno\b/, '#').replace(/^mil /, 'military ').replace(/ammo 556/, '5.56 issued').replace(/ammo 9mm/, '9mm issued');
const show = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : typeof v === 'boolean' ? (v ? 'yes' : 'no') : String(v));
const PAGE = 100;

export default function ChangeLog() {
  const { sb, members, events } = useTeam();
  const [rows, setRows] = useState<Entry[]>([]);
  const [table, setTable] = useState('');
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false), [err, setErr] = useState('');

  async function load(append = false) {
    setBusy(true); setErr('');
    let q = sb.from('audit_log').select('*').order('id', { ascending: false }).limit(PAGE);
    if (table) q = q.eq('table_name', table);
    if (append && rows.length) q = q.lt('id', rows[rows.length - 1].id);
    const { data, error } = await q;
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setRows(append ? [...rows, ...(data as Entry[])] : (data as Entry[]));
    setMore((data ?? []).length === PAGE);
  }
  useEffect(() => { load(); }, [table]);

  function subject(e: Entry) {
    const d = { ...(e.old_data ?? {}), ...(e.new_data ?? {}) } as Record<string, string>;
    const member = members.find(m => m.id === (d.member_id || (e.table_name === 'members' ? d.id : undefined)));
    const ev = events.find(x => x.id === (d.event_id || (e.table_name === 'events' ? d.id : undefined)));
    const name = member ? fullName(member) : d.last_name ? `${d.last_name}${d.first_name ? ', ' + d.first_name : ''}` : '';
    const evText = ev ? `${ev.title} ${ev.start_date}` : d.title ? `${d.title} ${d.start_date ?? ''}` : '';
    if (e.table_name === 'staff_emails' || e.table_name === 'profiles') return d.email || d.display_name || '';
    if (e.table_name === 'invites') return d.note || 'Invite';
    return [name, evText, d.course_code].filter(Boolean).join(' · ');
  }

  function details(e: Entry) {
    const o = e.old_data ?? {}, n = e.new_data ?? {};
    if (e.op === 'UPDATE') {
      return Object.keys(n).filter(k => !HIDDEN.has(k) && JSON.stringify(o[k]) !== JSON.stringify(n[k]))
        .map(k => <li key={k}><b>{label(k)}:</b> {show(o[k])} → {show(n[k])}</li>);
    }
    const d = e.op === 'INSERT' ? n : o;
    return Object.entries(d).filter(([k, v]) => !HIDDEN.has(k) && v !== null && v !== '' && v !== false)
      .slice(0, 8).map(([k, v]) => <li key={k}><b>{label(k)}:</b> {show(v)}</li>);
  }

  return (
    <section className="panel">
      <div className="filters">
        <label>Show<select value={table} onChange={e => setTable(e.target.value)}>
          <option value="">All changes</option>
          {Object.entries(TABLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select></label>
        <span className="formNote">Every add, change and delete is recorded with who did it. The log can’t be edited.</span>
      </div>
      {err && <p className="alert">{err}</p>}
      {!busy && rows.length === 0 ? <Empty title="No changes recorded yet" /> : (
        <div className="logList">
          {rows.map(e => {
            const [verb, tone] = OPS[e.op];
            return (
              <div key={e.id} className="logRow">
                <div className="logMeta">
                  <span>{new Date(e.at).toLocaleString('en-US', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                  <small>{e.actor_email ?? 'System'}</small>
                </div>
                <div className="grow">
                  <div className="row"><Tag tone={tone}>{verb}</Tag><strong>{TABLES[e.table_name] ?? e.table_name}</strong><span className="formNote">{subject(e)}</span></div>
                  <ul className="logDetails">{details(e)}</ul>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {more && <div className="row center"><button className="secondary" disabled={busy} onClick={() => load(true)}>{busy ? 'Loading…' : 'Load older changes'}</button></div>}
    </section>
  );
}
