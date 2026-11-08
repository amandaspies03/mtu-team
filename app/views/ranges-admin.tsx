'use client';
import { useState } from 'react';
import { Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import { useTeam } from '../../lib/data';
import type { Range } from '../../lib/types';

/** Staff manage the ranges offered in the event Location dropdown. */
export default function Ranges() {
  const { sb, ranges, events, reload } = useTeam();
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false), [err, setErr] = useState('');
  const uses = (r: Range) => events.filter(e => e.location === r.name).length;

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim(); if (!n) return;
    setBusy(true); setErr('');
    const { error } = await sb.from('ranges').insert({ name: n });
    setBusy(false);
    if (error) { setErr(error.code === '23505' ? 'That range is already on the list.' : error.message); return; }
    setName(''); reload();
  }
  async function rename(r: Range) {
    const n = editing?.name.trim(); if (!n || n === r.name) { setEditing(null); return; }
    setBusy(true); setErr('');
    const { error } = await sb.from('ranges').update({ name: n }).eq('id', r.id);
    if (!error) await sb.from('events').update({ location: n }).eq('location', r.name);
    setBusy(false);
    if (error) { setErr(error.code === '23505' ? 'That range is already on the list.' : error.message); return; }
    setEditing(null); reload();
  }
  async function remove(r: Range) {
    const n = uses(r);
    if (!confirm(`Remove “${r.name}” from the list?${n ? ` ${n} event${n === 1 ? '' : 's'} will keep it as their location.` : ''}`)) return;
    const { error } = await sb.from('ranges').delete().eq('id', r.id);
    if (error) setErr(error.message); else reload();
  }

  return (
    <section className="panel">
      <div className="sectionTitle"><h2>Ranges</h2></div>
      <p className="formNote tabIntro">These are the choices in the Location dropdown when staff add or edit an event. Renaming a range updates every event that uses it.</p>
      <div className="tableWrap"><table>
        <thead><tr><th>Range</th><th className="num">Events</th><th /></tr></thead>
        <tbody>{ranges.map(r => (
          <tr key={r.id}>
            <td>{editing?.id === r.id
              ? <input autoFocus value={editing.name} onChange={e => setEditing({ id: r.id, name: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') rename(r); if (e.key === 'Escape') setEditing(null); }} aria-label="Range name" />
              : <strong>{r.name}</strong>}</td>
            <td className="num">{uses(r)}</td>
            <td className="rowActions">
              {editing?.id === r.id ? <>
                <button className="iconBtn" aria-label="Save" disabled={busy} onClick={() => rename(r)}><Save size={15} /></button>
                <button className="iconBtn" aria-label="Cancel" onClick={() => setEditing(null)}><X size={15} /></button>
              </> : <>
                <button className="iconBtn" aria-label={`Rename ${r.name}`} onClick={() => setEditing({ id: r.id, name: r.name })}><Pencil size={15} /></button>
                <button className="iconBtn" aria-label={`Remove ${r.name}`} onClick={() => remove(r)}><Trash2 size={15} /></button>
              </>}
            </td>
          </tr>
        ))}</tbody>
      </table></div>
      <form className="row addRow" onSubmit={add}>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="New range, e.g. Camp Robinson, AR" aria-label="New range name" style={{ flex: 1, maxWidth: 420 }} />
        <button className="primary" disabled={busy || !name.trim()}><Plus size={15} /> Add range</button>
      </form>
      {err && <p className="alert">{err}</p>}
    </section>
  );
}
