'use client';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useTeam } from '../../lib/data';
import { EIC_LABEL, type EicBadge, type Member } from '../../lib/types';

/** Chips for a shooter's awards. */
export function AwardChips({ member, none = "—" }: { member: Member; none?: string }) {
  const chips = [member.gov20_pistol && 'Gov 20 Pistol', member.gov20_rifle && 'Gov 20 Rifle', member.eic_pistol && `${EIC_LABEL[member.eic_pistol]} Pistol`, member.eic_rifle && `${EIC_LABEL[member.eic_rifle]} Rifle`, member.chiefs50 && "Chief's 50"].filter(Boolean) as string[];
  if (!chips.length) return <span className="muted">{none}</span>;
  return <span className="awardChips">{chips.map(c => <span key={c} className={`award ${c.startsWith('Bronze') ? 'bronze' : c.startsWith('Silver') ? 'silver' : c.startsWith('Gold') ? 'gold' : ''}`}>{c}</span>)}</span>;
}

/** Staff pick any combination of Gov 20 (pistol/rifle), EIC badges (pistol/rifle) and Chief's 50 from a dropdown in the roster row. */
export function AwardsSelect({ member }: { member: Member }) {
  const { sb, isStaff, reload } = useTeam();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [err, setErr] = useState('');
  const box = useRef<HTMLSpanElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const place = () => {
    const r = btn.current?.getBoundingClientRect(); if (!r) return;
    setPos({ top: Math.min(r.bottom + 4, window.innerHeight - 290), left: Math.max(8, Math.min(r.left, window.innerWidth - 232)) });
  };
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const shut = () => place();
    document.addEventListener('keydown', esc);
    window.addEventListener('resize', shut); window.addEventListener('scroll', shut, true);
    return () => { document.removeEventListener('keydown', esc); window.removeEventListener('resize', shut); window.removeEventListener('scroll', shut, true); };
  }, [open]);
  if (!isStaff) return <AwardChips member={member} />;

  async function save(change: Partial<Pick<Member, 'gov20_pistol' | 'gov20_rifle' | 'chiefs50' | 'eic_pistol' | 'eic_rifle'>>) {
    setErr('');
    const { error } = await sb.from('members').update(change).eq('id', member.id);
    if (error) setErr(error.message); else await reload();
  }

  return (
    <span className="awardsCell" ref={box} onClick={e => e.stopPropagation()}>
      <button ref={btn} className="awardsBtn" aria-haspopup="true" aria-expanded={open} aria-label={`Awards for ${member.last_name}`} onClick={() => { place(); setOpen(!open); }}>
        <AwardChips member={member} /><ChevronDown size={14} />
      </button>
      {/* A click outside only closes the menu; the invisible backdrop keeps it from opening the shooter behind it. */}
      {open && <div className="awardsBackdrop" onClick={e => { e.stopPropagation(); setOpen(false); }} />}
      {open && (
        <div className="awardsPop" role="group" aria-label="Awards" style={{ top: pos.top, left: pos.left }}>
          <label className="check"><input type="checkbox" checked={member.gov20_pistol} onChange={e => save({ gov20_pistol: e.target.checked })} /> Governor&apos;s 20 – Pistol</label>
          <label className="check"><input type="checkbox" checked={member.gov20_rifle} onChange={e => save({ gov20_rifle: e.target.checked })} /> Governor&apos;s 20 – Rifle</label>
          <label className="check"><input type="checkbox" checked={member.chiefs50} onChange={e => save({ chiefs50: e.target.checked })} /> Chief&apos;s 50</label>
          <div className="awardsGroup">
            <span>EIC badges</span>
            {(['eic_pistol', 'eic_rifle'] as const).map(k => (
              <label key={k} className="eicRow">{k === 'eic_pistol' ? 'Pistol' : 'Rifle'}
                <select value={member[k] ?? ''} onChange={e => save({ [k]: (e.target.value || null) as EicBadge | null })}>
                  <option value="">None</option>
                  {(['bronze', 'silver', 'gold'] as EicBadge[]).map(b => <option key={b} value={b}>{EIC_LABEL[b]}</option>)}
                </select>
              </label>
            ))}
          </div>
          {err && <small className="formNote error">{err}</small>}
        </div>
      )}
    </span>
  );
}
