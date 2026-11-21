'use client';
// Practice weapons: who's opening the vault, the rifle draw, and the turn-in at the end.
// All 24 pistols always go, so only rifles are drawn; both are checked back in.
// Ticks save one number at a time (or a whole section) and wait in the outbox if there's no signal.
import { useEffect, useRef, useState } from 'react';
import { CheckCheck, Lock, X } from 'lucide-react';
import { useTeam } from '../../lib/data';
import { WEAPON_COUNT, type Member, type TeamEvent } from '../../lib/types';
import { displayName, fullName, todayISO } from '../../lib/util';

type List = 'rifles_out' | 'rifles_in' | 'pistols_in';
type Lists = Record<List, number[]>;
const ALL = Array.from({ length: WEAPON_COUNT }, (_, i) => i + 1);

/** Members with the Vault access role (being staff doesn't give it). Staff-only data, so empty for everyone else. */
export function useVaultPeople() {
  const { members, profiles, staffDuties } = useTeam();
  const emailOf = (m: Member) => (profiles.find(p => p.member_id === m.id)?.email ?? m.personal_email ?? '').trim().toLowerCase();
  const vaultEmails = new Set(staffDuties.filter(d => d.duty === 'vault').map(d => d.email));
  return members.filter(m => m.team_status !== 'Inactive' && vaultEmails.has(emailOf(m)));
}

export function WeaponsPanel({ event: e }: { event: TeamEvent }) {
  const { isStaff, members, attendance, saveOrQueue, reload, can } = useTeam();
  const lists: Lists = { rifles_out: e.rifles_out ?? [], rifles_in: e.rifles_in ?? [], pistols_in: e.pistols_in ?? [] };
  // Show taps right away; the saved copy replaces this once every save has finished.
  const [local, setLocal] = useState<Lists | null>(null);
  const inFlight = useRef(0);
  const cur = local ?? lists;
  const [err, setErr] = useState('');
  const started = (e.end_date ?? e.start_date) <= todayISO();
  const [mode, setMode] = useState<'out' | 'in'>(() => (started && lists.rifles_out.length ? 'in' : 'out'));
  useEffect(() => { if (!inFlight.current) setLocal(null); }, [e.rifles_out, e.rifles_in, e.pistols_in]);
  if (!can('vault')) return null;

  async function set(list: List, numbers: number[], on: boolean) {
    if (!numbers.length) return;
    setErr('');
    setLocal(prev => {
      const base = prev ?? lists;
      const next = { ...base, [list]: on ? [...new Set([...base[list], ...numbers])].sort((a, b) => a - b) : base[list].filter(n => !numbers.includes(n)) };
      if (list === 'rifles_out' && !on) next.rifles_in = next.rifles_in.filter(n => !numbers.includes(n));
      return next;
    });
    inFlight.current++;
    const what = list === 'rifles_out' ? 'rifle draw' : list === 'rifles_in' ? 'rifle turn-in' : 'pistol turn-in';
    try {
      await saveOrQueue({ kind: 'weapons', label: `${e.title}: ${what} ${on ? '+' : '−'}${numbers.join(', ')}`, eventId: e.id, list, numbers, on });
    } catch (x) { setErr((x as { message?: string }).message ?? 'Couldn’t save.'); }
    inFlight.current--;
    if (!inFlight.current) { await reload(); setLocal(null); }
  }

  const goingIds = new Set(attendance.filter(a => a.event_id === e.id && (a.status === 'planned' || a.status === 'attended')).map(a => a.member_id));
  /** Who has this number: people at this practice first. */
  const holders = (n: number) => members.filter(m => m.weapon_no === n && m.team_status !== 'Inactive')
    .sort((a, b) => Number(goingIds.has(b.id)) - Number(goingIds.has(a.id)) || a.last_name.localeCompare(b.last_name));
  const missingPistols = ALL.filter(n => !cur.pistols_in.includes(n));
  const missingRifles = cur.rifles_out.filter(n => !cur.rifles_in.includes(n));
  const turnInStarted = cur.pistols_in.length + cur.rifles_in.length > 0;
  const allBack = missingPistols.length === 0 && missingRifles.length === 0;

  const Tile = ({ n, on, list, sub }: { n: number; on: boolean; list: List; sub?: string }) => (
    <label className={`wTile ${on ? 'on' : ''}`}>
      <input type="checkbox" checked={on} onChange={x => void set(list, [n], x.target.checked)} aria-label={`${list === 'pistols_in' ? 'Pistol' : 'Rifle'} ${n}`} />
      <b>{n}</b>{sub && <small>{sub}</small>}
    </label>
  );
  const shortNames = (n: number) => holders(n).filter(m => goingIds.has(m.id)).map(m => m.last_name).join(', ');

  return (
    <section className="panel weaponsPanel">
      <div className="sectionTitle">
        <h2>Weapons</h2>
        <div className="wCount" aria-live="polite"><span>Pistols: <b>{WEAPON_COUNT}</b></span><span>Rifles: <b>{cur.rifles_out.length}</b></span></div>
      </div>
      <VaultPeople event={e} editable={isStaff} />
      <div className="tabs wTabs noPrint">
        <button className={mode === 'out' ? 'on' : ''} onClick={() => setMode('out')}>Draw</button>
        <button className={mode === 'in' ? 'on' : ''} onClick={() => setMode('in')}>Turn in</button>
      </div>

      {mode === 'out' && <>
        <p className="formNote">Tick each rifle as it’s drawn. All {WEAPON_COUNT} pistols go every time.</p>
        <div className="wGrid">{ALL.map(n => <Tile key={n} n={n} list="rifles_out" on={cur.rifles_out.includes(n)} sub={shortNames(n)} />)}</div>
        {cur.rifles_out.length > 0 && <p className="formNote">Drawn: {cur.rifles_out.join(', ')} <button className="linkBtn noPrint" onClick={() => { if (confirm('Clear the whole rifle draw for this practice?')) void set('rifles_out', cur.rifles_out, false); }}>Clear draw</button></p>}
      </>}

      {mode === 'in' && <>
        <div className={`wStatus ${allBack ? 'good' : turnInStarted ? 'warn' : ''}`} role="status">
          {allBack ? <><CheckCheck size={16} /> All weapons back: {WEAPON_COUNT} pistols, {cur.rifles_out.length} rifles.</>
            : !turnInStarted ? <>Tick each weapon as it’s packed up. Anything not ticked shows here with who has that number.</>
            : <div className="wMissing">
                <b>Still out: {missingPistols.length + missingRifles.length}</b>
                <ul>
                  {missingRifles.map(n => <li key={`r${n}`}><b>Rifle #{n}</b> {who(holders(n), goingIds)}</li>)}
                  {missingPistols.map(n => <li key={`p${n}`}><b>Pistol #{n}</b> {who(holders(n), goingIds)}</li>)}
                </ul>
              </div>}
        </div>
        <div className="wHead"><h3>Pistols <small>{cur.pistols_in.length}/{WEAPON_COUNT}</small></h3>
          <div className="row noPrint">
            <button className="secondary" disabled={!missingPistols.length} onClick={() => void set('pistols_in', missingPistols, true)}><CheckCheck size={15} /> All pistols present</button>
            {cur.pistols_in.length > 0 && <button className="linkBtn" onClick={() => void set('pistols_in', cur.pistols_in, false)}>Untick all</button>}
          </div>
        </div>
        <div className="wGrid">{ALL.map(n => <Tile key={n} n={n} list="pistols_in" on={cur.pistols_in.includes(n)} />)}</div>
        <div className="wHead"><h3>Rifles <small>{cur.rifles_in.length}/{cur.rifles_out.length}</small></h3>
          {cur.rifles_out.length > 0 && <div className="row noPrint">
            <button className="secondary" disabled={!missingRifles.length} onClick={() => void set('rifles_in', missingRifles, true)}><CheckCheck size={15} /> All rifles present</button>
            {cur.rifles_in.length > 0 && <button className="linkBtn" onClick={() => void set('rifles_in', cur.rifles_in, false)}>Untick all</button>}
          </div>}
        </div>
        {cur.rifles_out.length === 0 ? <p className="formNote">No rifles drawn. Tick them on the Draw tab first.</p>
          : <div className="wGrid">{cur.rifles_out.map(n => <Tile key={n} n={n} list="rifles_in" on={cur.rifles_in.includes(n)} />)}</div>}
      </>}
      {err && <p className="alert" role="alert">{err}</p>}
    </section>
  );
}

function who(h: Member[], going: Set<string>) {
  if (!h.length) return <span className="muted">· not assigned to anyone</span>;
  const here = h.filter(m => going.has(m.id));
  const list = here.length ? here : h;
  return <span>· {list.map(m => displayName(m)).join(', ')}{here.length ? '' : <span className="muted"> (none of them RSVP’d)</span>}</span>;
}

/** Who's opening the vault. Full staff pick; vault access sees the names. */
function VaultPeople({ event: e, editable }: { event: TeamEvent; editable: boolean }) {
  const { memberById, saveOrQueue, reload } = useTeam();
  const vault = useVaultPeople();
  const [err, setErr] = useState('');
  const ids = e.vault_ids ?? [];
  async function save(next: string[]) {
    setErr('');
    try {
      const r = await saveOrQueue({ kind: 'event', label: `${e.title}: vault access`, eventId: e.id, change: { vault_ids: next } });
      if (r === 'sent') await reload();
    } catch (x) { setErr((x as { message?: string }).message ?? 'Couldn’t save.'); }
  }
  const pickVault = vault.filter(m => !ids.includes(m.id));
  return (
    <div className="vaultRow">
      <span className="vaultLabel"><Lock size={14} /> Vault</span>
      <div className="dutyChips">
        {ids.length === 0 && <span className="muted">{editable ? 'No one assigned yet.' : 'No one assigned yet — staff pick who opens the vault.'}</span>}
        {ids.map(id => (
          <span key={id} className="dutyChip">{fullName(memberById(id))}
            {editable && <button aria-label={`Remove ${fullName(memberById(id))} from vault access`} onClick={() => void save(ids.filter(x => x !== id))}><X size={12} /></button>}
          </span>
        ))}
      </div>
      {editable && pickVault.length > 0 && (
        <select className="noPrint" aria-label="Add who's opening the vault" value="" onChange={x => x.target.value && void save([...ids, x.target.value])}>
          <option value="">+ Who’s opening the vault?</option>
          {pickVault.map(m => <option key={m.id} value={m.id}>{fullName(m)}</option>)}
        </select>
      )}
      {editable && vault.length === 0 && <small className="formNote">Only people with the Vault access role are listed. Give it on Admin → Access (staff need it too).</small>}
      {err && <p className="alert" role="alert">{err}</p>}
    </div>
  );
}
