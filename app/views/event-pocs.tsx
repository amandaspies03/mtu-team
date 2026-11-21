'use client';
// Points of contact for an event (the van driver and who's opening the vault), shown to shooters read-only.
// Comes from the event_pocs() database function: shooters can't read the driver field or
// other members' phone numbers directly.
import { useEffect, useState } from 'react';
import { MessageCircle, Phone } from 'lucide-react';
import { useTeam } from '../../lib/data';

type Poc = { role: string; rank: string | null; first_name: string | null; last_name: string; cell_phone: string | null };

export function EventPocs({ eventId, driverSet, vaultKey = '' }: { eventId: string; driverSet: boolean; vaultKey?: string }) {
  const { sb, offline } = useTeam();
  const [pocs, setPocs] = useState<Poc[] | null>(null);
  useEffect(() => {
    let live = true;
    sb.rpc('event_pocs', { p_event: eventId }).then(({ data, error }) => { if (live) setPocs(error ? [] : (data as Poc[]) ?? []); });
    return () => { live = false; };
  }, [sb, eventId, driverSet, vaultKey]);
  const tel = (p: string) => p.replace(/[^\d+]/g, '');
  return (
    <section className="panel">
      <div className="sectionTitle"><h2>Points of contact</h2></div>
      {pocs === null ? <p className="muted">{offline ? 'Needs signal to load.' : 'Loading…'}</p>
        : pocs.length === 0 ? <p className="muted">No van driver or vault access assigned yet. If you need a ride, check back closer to the date.</p>
        : <dl className="facts">
          {pocs.map((p, i) => <div key={`${p.role}-${i}`} style={{ display: 'contents' }}>
            <dt>{p.role}</dt>
            <dd>
              <b>{[p.rank, p.first_name, p.last_name].filter(Boolean).join(' ')}</b>
              {p.cell_phone && <span className="pocLinks">
                {' '}<a href={`tel:${tel(p.cell_phone)}`}><Phone size={13} /> {p.cell_phone}</a>
                {' · '}<a href={`sms:${tel(p.cell_phone)}`}><MessageCircle size={13} /> Text</a>
              </span>}
              {p.role === 'Van driver' && <span className="formNote">Riding in the van? Let the driver know.</span>}
            </dd>
          </div>)}
        </dl>}
    </section>
  );
}
