'use client';
import { useEffect, useState } from 'react';
import { DatabaseBackup, Download } from 'lucide-react';
import { useTeam } from '../../lib/data';
import { Empty, Tag } from './ui';

type Backup = { id: number; taken_at: string; kind: string; members: number; scores: number; events: number };

function saveJson(name: string, data: unknown) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const stamp = (iso: string) => iso.slice(0, 16).replace('T', '_').replace(':', '');

export default function Backups() {
  const { sb } = useTeam();
  const [list, setList] = useState<Backup[]>([]);
  const [busy, setBusy] = useState(''), [err, setErr] = useState('');

  async function load() {
    const { data, error } = await sb.rpc('list_backups');
    if (error) setErr(error.message); else setList(data as Backup[]);
  }
  useEffect(() => { load(); }, []);

  async function download(b: Backup) {
    setBusy(String(b.id)); setErr('');
    const { data, error } = await sb.rpc('get_backup', { p_id: b.id });
    setBusy('');
    if (error) { setErr(error.message); return; }
    saveJson(`MTU backup ${stamp(b.taken_at)}.json`, data);
  }
  async function backupAndDownload() {
    setBusy('now'); setErr('');
    const { error } = await sb.rpc('backup_now');
    if (error) { setErr(error.message); setBusy(''); return; }
    const { data } = await sb.rpc('list_backups');
    const latest = (data as Backup[])?.[0];
    setList((data as Backup[]) ?? []);
    setBusy('');
    if (latest) await download(latest);
  }

  return (
    <section className="panel">
      <div className="sectionTitle">
        <h2>Backups</h2>
        <button className="primary" disabled={!!busy} onClick={backupAndDownload}><DatabaseBackup size={15} /> {busy === 'now' ? 'Backing up…' : 'Back up and download now'}</button>
      </div>
      <p className="formNote">A full copy of the team’s data (roster, quals, calendar, attendance, ammo, scores, match teams, accounts and staff list) is saved automatically every night at about 2 AM Central and kept for 30 days. Download one any time and keep it somewhere safe. If something gets deleted by mistake, a backup lets it be restored.</p>
      {err && <p className="alert">{err}</p>}
      {list.length === 0 ? <Empty title="No backups yet" /> : list.map(b => (
        <div key={b.id} className="listRow static">
          <DatabaseBackup size={16} />
          <div className="grow">
            <strong>{new Date(b.taken_at).toLocaleString('en-US', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</strong>
            <small>{b.members} shooters · {b.events} events · {b.scores} scores</small>
          </div>
          <Tag tone={b.kind === 'nightly' ? 'neutral' : 'info'}>{b.kind}</Tag>
          <button className="secondary" disabled={!!busy} onClick={() => download(b)}><Download size={14} /> {busy === String(b.id) ? 'Preparing…' : 'Download'}</button>
        </div>
      ))}
    </section>
  );
}
