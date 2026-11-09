'use client';
// Support: anyone approved can report a bug or send feedback with screenshots.
// Reporters see their own reports and staff replies; staff see every report and set status / reply.
// New reports post to the "Mtu page bugs" GroupMe group (GROUPME_SUPPORT_BOT_ID, see docs/GROUPME.md).
import { useEffect, useState } from 'react';
import { ImagePlus, LifeBuoy, Send, Trash2, X } from 'lucide-react';
import { useTeam } from '../../lib/data';
import type { Member, Profile } from '../../lib/types';
import { groupme } from '../../lib/groupme';
import { fullName, milDate } from '../../lib/util';
import { Empty, Modal, PageTitle, Tag } from './ui';

type Kind = 'bug' | 'feedback' | 'question';
type Status = 'open' | 'in_progress' | 'closed';
type Ticket = {
  id: string; created_by: string; kind: Kind; message: string; page: string | null; device: string | null;
  screenshots: string[]; status: Status; staff_reply: string | null; created_at: string; updated_at: string;
};

const KIND_LABEL: Record<Kind, string> = { bug: 'Bug', feedback: 'Feedback', question: 'Question' };
const STATUS_LABEL: Record<Status, string> = { open: 'Open', in_progress: 'Working on it', closed: 'Closed' };
const STATUS_TONE: Record<Status, 'warn' | 'info' | 'good'> = { open: 'warn', in_progress: 'info', closed: 'good' };
const PAGES = ['Dashboard', 'Calendar / events', 'Roster', 'My profile', 'Scores', 'Match day', 'Resources', 'What’s new', 'Admin', 'Sign in / sign up', 'Other'];
const MAX_FILES = 5, MAX_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];
const COLS = 'id, created_by, kind, message, page, device, screenshots, status, staff_reply, created_at, updated_at';
const when = (iso: string) => `${milDate(iso.slice(0, 10))} ${new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;

export default function Support() {
  const { sb, me, isStaff } = useTeam();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true), [loadErr, setLoadErr] = useState('');
  const [tab, setTab] = useState<'new' | 'mine' | 'all'>('new');
  const [open, setOpen] = useState<Ticket | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await sb.from('support_tickets').select(COLS).order('created_at', { ascending: false }).limit(300);
    setLoading(false);
    if (error) { setLoadErr('Reports could not load. Refresh to try again.'); return; }
    setLoadErr(''); setTickets((data ?? []) as Ticket[]);
  }
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const mine = tickets.filter(t => t.created_by === me.id);
  const openCount = tickets.filter(t => t.status !== 'closed').length;

  return (
    <div className="support">
      <PageTitle eyebrow="HELP" title="Support">Found something broken, or have an idea to make the app better? Tell us here. Screenshots help a lot.</PageTitle>
      <div className="tabs">
        <button className={tab === 'new' ? 'on' : ''} onClick={() => setTab('new')}>New report</button>
        <button className={tab === 'mine' ? 'on' : ''} onClick={() => setTab('mine')}>My reports{mine.length ? ` (${mine.length})` : ''}</button>
        {isStaff && <button className={tab === 'all' ? 'on' : ''} onClick={() => setTab('all')}>All reports{openCount ? ` (${openCount} open)` : ''}</button>}
      </div>
      {loadErr && <div className="alert" role="alert">{loadErr}</div>}
      {tab === 'new' && <NewReport onSent={async () => { await load(); setTab('mine'); }} />}
      {tab === 'mine' && (loading && !tickets.length ? <p className="muted">Loading…</p> : <TicketList tickets={mine} onOpen={setOpen} empty="You haven’t sent any reports yet." />)}
      {tab === 'all' && isStaff && <StaffList tickets={tickets} onOpen={setOpen} />}
      {open && <TicketView ticket={open} onClose={() => setOpen(null)} onSaved={async t => { setOpen(t); await load(); }} onDeleted={async () => { setOpen(null); await load(); }} />}
    </div>
  );
}

function NewReport({ onSent }: { onSent: () => Promise<void> }) {
  const { sb, me } = useTeam();
  const [kind, setKind] = useState<Kind>('bug');
  const [message, setMessage] = useState(''), [page, setPage] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [busy, setBusy] = useState(false), [err, setErr] = useState(''), [done, setDone] = useState('');

  useEffect(() => {
    const urls = files.map(f => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach(u => URL.revokeObjectURL(u));
  }, [files]);

  function addFiles(list: FileList | null) {
    if (!list) return;
    setErr('');
    const next = [...files];
    for (const f of Array.from(list)) {
      if (!IMAGE_TYPES.includes(f.type) && !/\.(png|jpe?g|webp|gif|heic|heif)$/i.test(f.name)) { setErr(`${f.name} isn’t an image. Attach screenshots or photos only.`); continue; }
      if (f.size > MAX_BYTES) { setErr(`${f.name} is over 10 MB.`); continue; }
      if (next.length >= MAX_FILES) { setErr(`Up to ${MAX_FILES} screenshots per report.`); break; }
      next.push(f);
    }
    setFiles(next);
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!message.trim()) { setErr('Tell us what happened or what you’d like.'); return; }
    setBusy(true); setErr(''); setDone('');
    // Screenshots go to a private folder only you and staff can open.
    const paths: string[] = [];
    for (const f of files) {
      const ext = (f.name.match(/\.([a-z0-9]{1,5})$/i)?.[1] ?? (f.type.split('/')[1] || 'png')).toLowerCase().replace(/[^a-z0-9]/g, '');
      const path = `${me.id}/${crypto.randomUUID()}.${ext}`;
      const type = IMAGE_TYPES.includes(f.type) ? f.type : ext === 'heic' || ext === 'heif' ? `image/${ext}` : ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
      const up = await sb.storage.from('support').upload(path, f, { contentType: type, upsert: false });
      if (up.error) { setBusy(false); setErr(`Couldn’t upload ${f.name}: ${up.error.message}`); if (paths.length) await sb.storage.from('support').remove(paths); return; }
      paths.push(path);
    }
    const device = typeof navigator !== 'undefined' ? `${navigator.userAgent.slice(0, 240)} · ${window.innerWidth}×${window.innerHeight}` : null;
    const { data, error } = await sb.from('support_tickets').insert({ kind, message: message.trim().slice(0, 4000), page: page || null, device, screenshots: paths }).select('id').single();
    if (error || !data) { setBusy(false); setErr('Your report couldn’t be sent. Try again in a moment.'); if (paths.length) await sb.storage.from('support').remove(paths); return; }
    await groupme(sb, { type: 'support', ticketId: data.id }); // best effort; the report is saved either way
    setBusy(false);
    setMessage(''); setPage(''); setFiles([]); setKind('bug');
    setDone('Thanks! Your report was sent to the app team.');
    await onSent();
  }

  return (
    <section className="panel supportForm">
      <form onSubmit={send}>
        <fieldset className="kindPick"><legend>What kind of report?</legend>
          {(['bug', 'feedback', 'question'] as Kind[]).map(k => (
            <label key={k} className={kind === k ? 'on' : ''}><input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} />
              <b>{KIND_LABEL[k]}</b><small>{k === 'bug' ? 'Something is broken or wrong' : k === 'feedback' ? 'An idea or something to improve' : 'Not sure how something works'}</small></label>
          ))}
        </fieldset>
        <label>Which page? <span className="muted">(optional)</span>
          <select value={page} onChange={e => setPage(e.target.value)}><option value="">Choose a page…</option>{PAGES.map(p => <option key={p}>{p}</option>)}</select>
        </label>
        <label>{kind === 'bug' ? 'What happened? What did you expect?' : kind === 'feedback' ? 'What’s your idea?' : 'What’s your question?'}
          <textarea rows={6} maxLength={4000} value={message} onChange={e => setMessage(e.target.value)} placeholder={kind === 'bug' ? 'e.g. On my phone the Save button on Enter scores doesn’t do anything after I add a second shooter.' : ''} />
        </label>
        <div className="shotPick">
          <span className="shotPickLabel">Screenshots <span className="muted">(up to {MAX_FILES}, 10 MB each)</span></span>
          <div className="thumbs">
            {previews.map((src, i) => (
              <div className="thumb" key={src}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`Screenshot ${i + 1}`} />
                <button type="button" className="thumbX" aria-label={`Remove screenshot ${i + 1}`} onClick={() => setFiles(files.filter((_, j) => j !== i))}><X size={14} /></button>
              </div>
            ))}
            {files.length < MAX_FILES && (
              <label className="addShot"><ImagePlus size={22} /><span>Add</span>
                <input type="file" accept="image/*" multiple onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />
              </label>
            )}
          </div>
        </div>
        {err && <p className="alert" role="alert">{err}</p>}
        {done && <p className="success" role="status">{done}</p>}
        <div className="formActions"><button className="primary" disabled={busy}><Send size={15} /> {busy ? (files.length ? 'Uploading…' : 'Sending…') : 'Send report'}</button></div>
        <p className="formNote">Staff can see your name, your message, the page, your device type and your screenshots. Don’t include SSNs, DoD IDs or other personal info.</p>
      </form>
    </section>
  );
}

function TicketList({ tickets, onOpen, empty, showWho }: { tickets: Ticket[]; onOpen: (t: Ticket) => void; empty: string; showWho?: boolean }) {
  const { members, profiles } = useTeamNames();
  if (!tickets.length) return <Empty title={empty} />;
  return (
    <section className="panel ticketList">
      {tickets.map(t => (
        <button key={t.id} className="ticketRow" onClick={() => onOpen(t)}>
          <span className="ticketMain">
            <span className="ticketTags"><Tag tone={t.kind === 'bug' ? 'bad' : 'neutral'}>{KIND_LABEL[t.kind]}</Tag><Tag tone={STATUS_TONE[t.status]}>{STATUS_LABEL[t.status]}</Tag>{t.screenshots.length > 0 && <small>{t.screenshots.length} 📷</small>}</span>
            <span className="ticketMsg">{t.message}</span>
            <small>{showWho ? `${reporterName(t.created_by, profiles, members)} · ` : ''}{when(t.created_at)}{t.page ? ` · ${t.page}` : ''}{t.staff_reply ? ' · Staff replied' : ''}</small>
          </span>
        </button>
      ))}
    </section>
  );
}

function StaffList({ tickets, onOpen }: { tickets: Ticket[]; onOpen: (t: Ticket) => void }) {
  const [filter, setFilter] = useState<'active' | 'closed' | 'all'>('active');
  const shown = tickets.filter(t => filter === 'all' || (filter === 'closed' ? t.status === 'closed' : t.status !== 'closed'));
  return (
    <>
      <div className="segmented supportFilter">
        {(['active', 'closed', 'all'] as const).map(f => <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>{f === 'active' ? 'Open & working' : f === 'closed' ? 'Closed' : 'All'}</button>)}
      </div>
      <TicketList tickets={shown} onOpen={onOpen} showWho empty={filter === 'active' ? 'Nothing open. Nice.' : 'No reports here.'} />
    </>
  );
}

function TicketView({ ticket, onClose, onSaved, onDeleted }: { ticket: Ticket; onClose: () => void; onSaved: (t: Ticket) => Promise<void>; onDeleted: () => Promise<void> }) {
  const { sb, me, isStaff } = useTeam();
  const { members, profiles } = useTeamNames();
  const [images, setImages] = useState<string[]>([]);
  const [status, setStatus] = useState<Status>(ticket.status), [reply, setReply] = useState(ticket.staff_reply ?? '');
  const [busy, setBusy] = useState(false), [err, setErr] = useState('');
  const [big, setBig] = useState<string | null>(null);

  // Screenshots are private: download them and show local copies (no public links).
  useEffect(() => {
    let urls: string[] = [], live = true;
    Promise.all(ticket.screenshots.map(p => sb.storage.from('support').download(p).then(r => (r.data ? URL.createObjectURL(r.data) : '')))).then(list => {
      urls = list; if (live) setImages(list); else list.forEach(u => u && URL.revokeObjectURL(u));
    });
    return () => { live = false; urls.forEach(u => u && URL.revokeObjectURL(u)); };
  }, [sb, ticket.screenshots]);

  async function save() {
    setBusy(true); setErr('');
    const { data, error } = await sb.from('support_tickets').update({ status, staff_reply: reply.trim() ? reply.trim().slice(0, 2000) : null }).eq('id', ticket.id).select(COLS).single();
    setBusy(false);
    if (error || !data) { setErr('Couldn’t save. Staff access is required.'); return; }
    await onSaved({ ...ticket, ...(data as Partial<Ticket>) });
  }
  async function remove() {
    if (!window.confirm('Delete this report and its screenshots? This can’t be undone.')) return;
    setBusy(true);
    if (ticket.screenshots.length) await sb.storage.from('support').remove(ticket.screenshots);
    const { error } = await sb.from('support_tickets').delete().eq('id', ticket.id);
    setBusy(false);
    if (error) { setErr('Couldn’t delete the report.'); return; }
    await onDeleted();
  }

  return (
    <Modal title={`${KIND_LABEL[ticket.kind]} report`} onClose={onClose}>
      <div className="ticketView">
        <div className="ticketTags"><Tag tone={STATUS_TONE[ticket.status]}>{STATUS_LABEL[ticket.status]}</Tag>{ticket.page && <Tag>{ticket.page}</Tag>}</div>
        <p className="ticketMeta">{ticket.created_by === me.id ? 'You' : reporterName(ticket.created_by, profiles, members)} · {when(ticket.created_at)}</p>
        <div className="updateBody">{ticket.message}</div>
        {ticket.screenshots.length > 0 && (
          <div className="thumbs view">
            {ticket.screenshots.map((p, i) => images[i]
              // eslint-disable-next-line @next/next/no-img-element
              ? <button key={p} className="thumb" onClick={() => setBig(images[i])} aria-label={`Open screenshot ${i + 1}`}><img src={images[i]} alt={`Screenshot ${i + 1}`} /></button>
              : <div key={p} className="thumb loadingThumb">Loading…</div>)}
          </div>
        )}
        {isStaff && ticket.device && <p className="formNote">Device: {ticket.device}</p>}
        {!isStaff && ticket.staff_reply && <div className="staffReply"><b>Reply from staff</b><div className="updateBody">{ticket.staff_reply}</div></div>}
        {isStaff && (
          <div className="staffBox">
            <label>Status<select value={status} onChange={e => setStatus(e.target.value as Status)}>{(Object.keys(STATUS_LABEL) as Status[]).map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select></label>
            <label>Reply to the reporter <span className="muted">(they see this on their Support page)</span><textarea rows={3} maxLength={2000} value={reply} onChange={e => setReply(e.target.value)} /></label>
            {err && <p className="alert" role="alert">{err}</p>}
            <div className="formActions">
              <button type="button" className="danger" disabled={busy} onClick={remove}><Trash2 size={14} /> Delete</button>
              <button type="button" className="primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        )}
      </div>
      {big && (
        <div className="shotZoom" role="dialog" aria-modal="true" aria-label="Screenshot" onClick={() => setBig(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={big} alt="Screenshot, full size" />
          <button className="iconBtn" aria-label="Close screenshot"><X size={20} /></button>
        </div>
      )}
    </Modal>
  );
}

/** Staff see who sent a report; the roster name is used when the account is linked. */
function useTeamNames() {
  const { members, profiles } = useTeam();
  return { members, profiles };
}
function reporterName(userId: string, profiles: Profile[], members: Member[]) {
  const p = profiles.find(x => x.id === userId);
  const m = p?.member_id ? members.find(x => x.id === p.member_id) : undefined;
  return m ? fullName(m) : p?.display_name || p?.email || 'Team member';
}

export const SupportIcon = LifeBuoy;
