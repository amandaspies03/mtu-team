'use client';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Backpack, Crosshair, Download, FileText, Info, Search, ShieldCheck, Trash2, Trophy, Upload, UserRound, X } from 'lucide-react';
import { RESOURCES, type ResourceCategory } from '../../lib/resources';
import { useTeam } from '../../lib/data';
import { Modal, PageTitle } from './ui';

const ICONS: Record<ResourceCategory['icon'], React.ReactNode> = {
  crosshair: <Crosshair size={20} />,
  backpack: <Backpack size={20} />,
  trophy: <Trophy size={20} />,
  shield: <ShieldCheck size={20} />,
  user: <UserRound size={20} />,
  info: <Info size={20} />,
};

type ResourceFile = { id: string; category_id: string; title: string; path: string; size_bytes: number | null; mime_type: string | null; created_at: string };

const fmtSize = (n: number | null) => (n == null ? '' : n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

export default function Resources() {
  const { sb, isStaff } = useTeam();
  const [open, setOpen] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [files, setFiles] = useState<ResourceFile[]>([]);
  const [filesErr, setFilesErr] = useState('');
  const [uploading, setUploading] = useState(false);
  const listing = useRef<HTMLElement>(null);
  const category = RESOURCES.categories.find(c => c.id === open);

  const loadFiles = useCallback(async () => {
    const { data, error } = await sb.from('resource_files').select('*').order('title');
    if (error) setFilesErr(error.message); else { setFiles(data as ResourceFile[]); setFilesErr(''); }
  }, [sb]);
  useEffect(() => { loadFiles(); }, [loadFiles]);
  useEffect(() => { if (open) listing.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, [open]);

  const hits = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    return RESOURCES.categories.flatMap(c => c.guides.filter(g => `${g.title} ${g.summary} ${g.body}`.toLowerCase().includes(term)).map(g => ({ c, g })));
  }, [q]);

  async function openFile(f: ResourceFile) {
    const { data, error } = await sb.storage.from('resources').createSignedUrl(f.path, 120);
    if (error || !data) { setFilesErr(error?.message ?? 'Could not open the file.'); return; }
    window.open(data.signedUrl, '_blank', 'noopener');
  }
  async function removeFile(f: ResourceFile) {
    if (!confirm(`Delete “${f.title}” for everyone?`)) return;
    const { error } = await sb.storage.from('resources').remove([f.path]);
    if (error) { setFilesErr(error.message); return; }
    const { error: e2 } = await sb.from('resource_files').delete().eq('id', f.id);
    if (e2) setFilesErr(e2.message); else loadFiles();
  }

  return (
    <div>
      <PageTitle eyebrow="REFERENCE" title={RESOURCES.heading}>{RESOURCES.introduction}</PageTitle>
      <div className="resourceNotice"><p>{RESOURCES.notice}</p></div>

      <div className="resourceTools">
        <label className="search"><Search size={16} /><input placeholder="Search all guides…" value={q} onChange={e => setQ(e.target.value)} aria-label="Search guides" /></label>
        {isStaff && <button className="secondary" onClick={() => setUploading(true)}><Upload size={15} /> Upload file</button>}
      </div>

      {q.trim() ? (
        <section className="panel resourceListing">
          <div className="sectionTitle"><h2>{hits.length} guide{hits.length === 1 ? '' : 's'} match “{q.trim()}”</h2><button className="linkBtn" onClick={() => setQ('')}>Clear</button></div>
          {hits.length === 0 && <p className="formNote">Try a different word, like “prone,” “orders” or “stovepipe.”</p>}
          {hits.map(({ c, g }) => <GuideItem key={c.id + g.id} title={g.title} summary={`${c.title} · ${g.summary}`} body={g.body} defaultOpen={hits.length <= 3} />)}
        </section>
      ) : (
        <>
          <div className="resourceTiles">
            {RESOURCES.categories.map(c => {
              const n = files.filter(f => f.category_id === c.id).length;
              return (
                <button key={c.id} className="resourceTile" aria-pressed={open === c.id} onClick={() => setOpen(open === c.id ? null : c.id)}>
                  <span className="resourceIcon">{ICONS[c.icon]}</span>
                  <span className="resourceTileTitle">{c.title}</span>
                  <span className="resourceTileText">{c.description}</span>
                  <span className="resourceTileAction">{open === c.id ? 'Close' : `${c.guides.length} guides${n ? ` · ${n} file${n === 1 ? '' : 's'}` : ''}`} <ArrowRight size={14} /></span>
                </button>
              );
            })}
          </div>

          {category && (
            <section ref={listing} className="panel resourceListing">
              <div className="sectionTitle"><h2>{category.title}</h2><button className="iconBtn" aria-label="Close" onClick={() => setOpen(null)}><X size={16} /></button></div>
              <p className="formNote">{category.description}</p>
              {category.guides.map(g => <GuideItem key={g.id} title={g.title} summary={g.summary} body={g.body} />)}
              <FileList files={files.filter(f => f.category_id === category.id)} isStaff={isStaff} onOpen={openFile} onDelete={removeFile} />
            </section>
          )}
        </>
      )}
      {filesErr && <p className="alert">{filesErr}</p>}
      {uploading && <UploadFile defaultCategory={open ?? RESOURCES.categories[0].id} onClose={() => setUploading(false)} onDone={() => { setUploading(false); loadFiles(); }} />}
    </div>
  );
}

function GuideItem({ title, summary, body, defaultOpen }: { title: string; summary: string; body: string; defaultOpen?: boolean }) {
  return (
    <details className="guide" open={defaultOpen}>
      <summary><strong>{title}</strong><small>{summary}</small></summary>
      <div className="guideBody"><Markdown text={body} /></div>
    </details>
  );
}

function FileList({ files, isStaff, onOpen, onDelete }: { files: ResourceFile[]; isStaff: boolean; onOpen: (f: ResourceFile) => void; onDelete: (f: ResourceFile) => void }) {
  if (files.length === 0) return isStaff ? <p className="formNote fileHint">No printable files here yet. Use “Upload file” to add targets, data book pages or forms.</p> : null;
  return (
    <div className="fileList">
      <h3>Printable files</h3>
      {files.map(f => (
        <div key={f.id} className="fileRow">
          <FileText size={16} />
          <button className="fileOpen" onClick={() => onOpen(f)}>{f.title}<small>{[f.path.split('.').pop()?.toUpperCase(), fmtSize(f.size_bytes)].filter(Boolean).join(' · ')}</small></button>
          <button className="iconBtn" aria-label={`Download ${f.title}`} onClick={() => onOpen(f)}><Download size={15} /></button>
          {isStaff && <button className="iconBtn" aria-label={`Delete ${f.title}`} onClick={() => onDelete(f)}><Trash2 size={15} /></button>}
        </div>
      ))}
    </div>
  );
}

function UploadFile({ defaultCategory, onClose, onDone }: { defaultCategory: string; onClose: () => void; onDone: () => void }) {
  const { sb } = useTeam();
  const [category, setCategory] = useState(defaultCategory);
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false), [err, setErr] = useState('');
  async function save() {
    setErr('');
    if (!file) { setErr('Choose a file.'); return; }
    if (!title.trim()) { setErr('Give it a title.'); return; }
    if (file.size > 25 * 1024 * 1024) { setErr('Files must be 25 MB or smaller.'); return; }
    setBusy(true);
    const ext = (file.name.split('.').pop() ?? 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
    const path = `${category}/${crypto.randomUUID()}.${ext}`;
    const up = await sb.storage.from('resources').upload(path, file, { contentType: file.type || undefined, upsert: false });
    if (up.error) { setBusy(false); setErr(up.error.message); return; }
    const { error } = await sb.from('resource_files').insert({ category_id: category, title: title.trim(), path, size_bytes: file.size, mime_type: file.type || null });
    setBusy(false);
    if (error) { await sb.storage.from('resources').remove([path]); setErr(error.message); return; }
    onDone();
  }
  return (
    <Modal title="Upload a file" onClose={onClose}>
      <div className="form">
        <div className="resourceNotice"><p>Only signed-in team members can open these files. Don’t upload anything with SSNs, DoD IDs, home addresses or other personal information.</p></div>
        <label>File<input type="file" accept=".pdf,.docx,.doc,.pptx,.xlsx,.png,.jpg,.jpeg" onChange={e => { const f = e.target.files?.[0] ?? null; setFile(f); if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ')); }} /></label>
        <label>Title<input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Pistol EIC target" /></label>
        <label>Section<select value={category} onChange={e => setCategory(e.target.value)}>{RESOURCES.categories.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
        {err && <p className="alert">{err}</p>}
        <div className="formActions"><button className="secondary" onClick={onClose}>Cancel</button><button className="primary" disabled={busy} onClick={save}><Upload size={15} /> {busy ? 'Uploading…' : 'Upload'}</button></div>
      </div>
    </Modal>
  );
}

/** Renders the small markdown subset used in lib/resources.ts. */
function Markdown({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  const lines = text.split('\n');
  let i = 0;
  const inline = (s: string) => s.split(/(\*\*[^*]+\*\*)/g).map((part, k) => part.startsWith('**') && part.endsWith('**') ? <strong key={k}>{part.slice(2, -2)}</strong> : <Fragment key={k}>{part}</Fragment>);
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    if (line.startsWith('## ')) { blocks.push(<h4 key={i}>{line.slice(3)}</h4>); i++; continue; }
    if (line.startsWith('> ')) { blocks.push(<p key={i} className="callout">{inline(line.slice(2))}</p>); i++; continue; }
    if (line.startsWith('- ')) {
      const items: string[] = [];
      while (i < lines.length && lines[i].startsWith('- ')) items.push(lines[i++].slice(2));
      blocks.push(<ul key={i}>{items.map((t, k) => <li key={k}>{inline(t)}</li>)}</ul>);
      continue;
    }
    if (/^\d+\. /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) items.push(lines[i++].replace(/^\d+\. /, ''));
      blocks.push(<ol key={i}>{items.map((t, k) => <li key={k}>{inline(t)}</li>)}</ol>);
      continue;
    }
    if (line.startsWith('|')) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].startsWith('|')) rows.push(lines[i++].split('|').slice(1, -1).map(c => c.trim()));
      const [head, ...body] = rows;
      blocks.push(<div key={i} className="tableWrap"><table className="guideTable"><thead><tr>{head.map((c, k) => <th key={k}>{c}</th>)}</tr></thead><tbody>{body.map((r, k) => <tr key={k}>{r.map((c, j) => <td key={j}>{inline(c)}</td>)}</tr>)}</tbody></table></div>);
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(## |> |- |\d+\. |\|)/.test(lines[i])) para.push(lines[i++]);
    blocks.push(<p key={i}>{inline(para.join(' '))}</p>);
  }
  return <>{blocks}</>;
}
