'use client';
import { useState } from 'react';
import { X } from 'lucide-react';
import { useTeam } from '../../lib/data';
import type { AmmoType, EventAmmo, TeamEvent } from '../../lib/types';

const num = (v: string) => (v === '' ? null : Math.max(0, Math.round(+v)));

/** Rounds drawn on an event, totalled by caliber (5.56, 9mm, …). */
export function drawnByCaliber(lines: EventAmmo[], types: AmmoType[]) {
  const out = new Map<string, number>();
  for (const l of lines) {
    const t = types.find(x => x.id === l.ammo_type_id);
    if (!t || !l.drawn) continue;
    out.set(t.caliber, (out.get(t.caliber) ?? 0) + l.drawn);
  }
  return out;
}

/**
 * Ammo for one event, one line per type: rounds requested and rounds drawn.
 * Drawn fills in from the request until someone types a different number. Ammo managers and staff only.
 */
export function AmmoLines({ event: e }: { event: TeamEvent }) {
  const { sb, ammoTypes, eventAmmo, reload } = useTeam();
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const typeOf = (id: string) => ammoTypes.find(t => t.id === id);
  const lines = eventAmmo.filter(a => a.event_id === e.id)
    .sort((a, b) => (typeOf(a.ammo_type_id)?.sort ?? 99) - (typeOf(b.ammo_type_id)?.sort ?? 99));
  const used = new Set(lines.map(l => l.ammo_type_id));
  const unused = ammoTypes.filter(t => t.active && !used.has(t.id));

  async function run(q: PromiseLike<{ error: { message: string } | null }>) {
    setErr(''); setBusy(true);
    const { error } = await q;
    setBusy(false);
    if (error) setErr(error.message); else await reload();
  }
  const add = (typeId: string) => typeId && run(sb.from('event_ammo').insert({ event_id: e.id, ammo_type_id: typeId }));
  const patch = (l: EventAmmo, change: Partial<EventAmmo>) => run(sb.from('event_ammo').update(change).eq('id', l.id));
  const remove = (l: EventAmmo) => {
    if ((l.requested || l.drawn) && !confirm(`Remove ${typeOf(l.ammo_type_id)?.nomenclature ?? 'this ammo'} from ${e.title}?`)) return;
    void run(sb.from('event_ammo').delete().eq('id', l.id));
  };

  return (
    <div className="ammoLines">
      {lines.length > 0 && (
        <div className="tableWrap"><table className="rowEntry ammoLineTable">
          <thead><tr><th>Ammo type</th><th className="num">Requested</th><th className="num">Drawn</th><th /></tr></thead>
          <tbody>
            {lines.map(l => {
              const t = typeOf(l.ammo_type_id);
              return (
                <tr key={l.id}>
                  <td>
                    <select aria-label="Ammo type" value={l.ammo_type_id} disabled={busy} onChange={x => patch(l, { ammo_type_id: x.target.value })}>
                      {[...(t ? [t] : []), ...unused].sort((a, b) => a.sort - b.sort).map(o => <option key={o.id} value={o.id}>{o.nomenclature} ({o.dodic})</option>)}
                    </select>
                  </td>
                  <td className="num"><input className="numIn" type="number" min={0} inputMode="numeric" aria-label={`Rounds of ${t?.nomenclature ?? 'ammo'} requested`} defaultValue={l.requested ?? ''} key={`r-${l.id}-${l.requested}`}
                    onBlur={x => { const v = num(x.target.value); if (v !== l.requested) void patch(l, { requested: v }); }} /></td>
                  <td className="num"><input className="numIn" type="number" min={0} inputMode="numeric" aria-label={`Rounds of ${t?.nomenclature ?? 'ammo'} drawn`} defaultValue={l.drawn ?? ''} key={`d-${l.id}-${l.drawn}`}
                    onBlur={x => { const v = num(x.target.value); if (v !== l.drawn) void patch(l, { drawn: v }); }} /></td>
                  <td><button className="iconBtn" aria-label={`Remove ${t?.nomenclature ?? 'ammo'}`} disabled={busy} onClick={() => remove(l)}><X size={15} /></button></td>
                </tr>
              );
            })}
          </tbody>
        </table></div>
      )}
      {unused.length > 0 && (
        <select className="ammoAdd" aria-label="Add an ammo type" value="" disabled={busy} onChange={x => void add(x.target.value)}>
          <option value="">+ Add ammo type…</option>
          {unused.map(t => <option key={t.id} value={t.id}>{t.nomenclature} ({t.dodic})</option>)}
        </select>
      )}
      {lines.length === 0 && unused.length === 0 && <p className="formNote">No ammo types set up yet. Add them on the Ammo page.</p>}
      <p className="formNote">Drawn fills in from the request; change it if you drew a different amount. Everything drawn counts as expended once the event date passes.</p>
      {err && <p className="alert">{err}</p>}
    </div>
  );
}
