'use client';
import { useState } from 'react';
import { ExternalLink, Plus, Trash2 } from 'lucide-react';
import { useTeam } from '../../lib/data';
import { Empty, PageTitle } from './ui';

export default function Links() {
  const { sb, isStaff, links, reload } = useTeam();
  const [f, setF] = useState({ title: '', url: '', category: '' });
  const [err, setErr] = useState('');
  const groups = links.reduce<Record<string, typeof links>>((g, l) => { (g[l.category || 'General'] ||= []).push(l); return g; }, {});

  async function add(e: React.FormEvent) {
    e.preventDefault(); setErr('');
    if (!/^https:\/\//i.test(f.url)) { setErr('Links must start with https://'); return; }
    const { error } = await sb.from('links').insert({ title: f.title.trim(), url: f.url.trim(), category: f.category.trim() || null });
    if (error) setErr(error.message); else { setF({ title: '', url: '', category: '' }); reload(); }
  }
  async function del(id: string) {
    const { error } = await sb.from('links').delete().eq('id', id);
    if (error) setErr(error.message); else reload();
  }

  return (
    <div>
      <PageTitle eyebrow="REFERENCE" title="Files & links">
        Shortcuts to match programs, range rules, forms and the team Drive. Files stay where they live — this page only links to them.
      </PageTitle>
      {Object.keys(groups).length === 0 && <Empty title="No links yet" />}
      {Object.entries(groups).map(([cat, ls]) => (
        <section key={cat} className="panel">
          <div className="sectionTitle"><h2>{cat}</h2></div>
          {ls.map(l => (
            <div key={l.id} className="listRow static">
              <ExternalLink size={16} />
              <a className="grow" href={l.url} target="_blank" rel="noopener noreferrer"><strong>{l.title}</strong><small>{new URL(l.url).hostname}</small></a>
              {isStaff && <button className="iconBtn" aria-label={`Delete ${l.title}`} onClick={() => del(l.id)}><Trash2 size={14} /></button>}
            </div>
          ))}
        </section>
      ))}
      {isStaff && (
        <section className="panel">
          <div className="sectionTitle"><h2>Add a link</h2></div>
          <form className="formGrid three" onSubmit={add}>
            <label>Title<input value={f.title} onChange={e => setF({ ...f, title: e.target.value })} placeholder="2026 TAG Match Program" required /></label>
            <label>URL<input value={f.url} onChange={e => setF({ ...f, url: e.target.value })} placeholder="https://drive.google.com/…" required /></label>
            <label>Category<input value={f.category} onChange={e => setF({ ...f, category: e.target.value })} placeholder="Match programs, Forms, Range info…" list="cats" />
              <datalist id="cats">{Object.keys(groups).map(c => <option key={c} value={c} />)}</datalist></label>
            {err && <p className="alert">{err}</p>}
            <div className="formActions"><button className="primary"><Plus size={15} /> Add link</button></div>
          </form>
        </section>
      )}
    </div>
  );
}
