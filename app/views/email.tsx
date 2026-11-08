'use client';
import { useMemo, useState } from 'react';
import { Copy, Mail } from 'lucide-react';
import { useTeam } from '../../lib/data';
import type { Member, TeamEvent } from '../../lib/types';
import { displayName, eventRange, fullName, kindLabel } from '../../lib/util';
import { Modal } from './ui';

type Template = 'reminder' | 'roster' | 'orders' | 'blank';
type Audience = 'going' | 'orders' | 'team' | 'everyone';
type AddressPref = 'mil' | 'personal' | 'both';

const TEMPLATE_LABEL: Record<Template, string> = {
  reminder: 'Practice / match reminder',
  roster: 'Roster for this event',
  orders: '336 / orders reminder',
  blank: 'Blank message',
};

function addresses(m: Member, pref: AddressPref) {
  if (pref === 'mil') return [m.mil_email || m.personal_email].filter(Boolean) as string[];
  if (pref === 'personal') return [m.personal_email || m.mil_email].filter(Boolean) as string[];
  return [m.mil_email, m.personal_email].filter(Boolean) as string[];
}

/** Builds an email in the user's own mail app (BCC to the team). Nothing is sent from this site. */
export function EmailComposer({ event, onClose }: { event?: TeamEvent; onClose: () => void }) {
  const { me, members, attendance, memberById } = useTeam();
  const sender = memberById(me.member_id);
  const rows = event ? attendance.filter(a => a.event_id === event.id) : [];
  const going = rows.filter(a => a.status === 'planned' || a.status === 'attended');
  const ordersOpen = going.filter(a => a.orders_status === 'none' || a.orders_status === 'submitted');

  const [template, setTemplate] = useState<Template>(event ? 'reminder' : 'blank');
  const [audience, setAudience] = useState<Audience>(event ? 'team' : 'team');
  const [pref, setPref] = useState<AddressPref>('both');
  const [copied, setCopied] = useState('');

  const recipients = useMemo(() => {
    const current = members.filter(m => ['Active', 'New', 'Tryout'].includes(m.team_status));
    if (audience === 'going') return going.map(a => memberById(a.member_id)).filter(Boolean) as Member[];
    if (audience === 'orders') return ordersOpen.map(a => memberById(a.member_id)).filter(Boolean) as Member[];
    if (audience === 'everyone') return members.filter(m => m.team_status !== 'Inactive');
    return current;
  }, [audience, members, going, ordersOpen, memberById]);
  const to = [...new Set(recipients.flatMap(m => addresses(m, pref)))];
  const missing = recipients.filter(m => addresses(m, pref).length === 0);

  const draft = useMemo(() => buildDraft(template, event, going.map(a => ({ a, m: memberById(a.member_id) })), sender), [template, event, going, memberById, sender]);
  const [subject, setSubject] = useState(draft.subject);
  const [body, setBody] = useState(draft.body);
  function pickTemplate(t: Template) {
    setTemplate(t);
    const d = buildDraft(t, event, going.map(a => ({ a, m: memberById(a.member_id) })), sender);
    setSubject(d.subject); setBody(d.body);
    if (t === 'orders') setAudience('orders');
    else if (t === 'roster') setAudience('going');
  }

  const mailto = `mailto:?bcc=${encodeURIComponent(to.join(','))}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const tooLong = mailto.length > 1900;
  const copy = (label: string, text: string) => navigator.clipboard.writeText(text).then(() => { setCopied(label); setTimeout(() => setCopied(''), 2000); });

  return (
    <Modal title={event ? `Email: ${event.title}` : 'Email the team'} onClose={onClose}>
      <div className="form">
        <div className="formGrid">
          <label>Template
            <select value={template} onChange={e => pickTemplate(e.target.value as Template)}>
              {(Object.keys(TEMPLATE_LABEL) as Template[]).filter(t => event || t === 'blank').map(t => <option key={t} value={t}>{TEMPLATE_LABEL[t]}</option>)}
            </select>
          </label>
          <label>Send to
            <select value={audience} onChange={e => setAudience(e.target.value as Audience)}>
              {event && <option value="going">Shooters going ({going.length})</option>}
              {event && <option value="orders">Going, orders not cut ({ordersOpen.length})</option>}
              <option value="team">Current team: Active, New, Tryout</option>
              <option value="everyone">Everyone except inactive</option>
            </select>
          </label>
          <label>Addresses
            <select value={pref} onChange={e => setPref(e.target.value as AddressPref)}>
              <option value="both">Military and personal</option>
              <option value="mil">Military (personal if no mil)</option>
              <option value="personal">Personal (mil if no personal)</option>
            </select>
          </label>
          <div className="recipientCount"><b>{to.length}</b> addresses for {recipients.length} shooters
            {missing.length > 0 && <small className="formNote error">No email on file: {missing.map(fullName).join('; ')}</small>}
          </div>
        </div>
        <label>Subject<input value={subject} onChange={e => setSubject(e.target.value)} /></label>
        <label>Message<textarea rows={12} value={body} onChange={e => setBody(e.target.value)} /></label>
        <p className="formNote">Nothing is sent from this site. Start a new message in Outlook, then copy and paste: addresses into BCC, the subject, then the message. Addresses are separated with semicolons so Outlook accepts them as-is. “Open in email app” does the same in one click on computers that allow it{tooLong ? ', but this message may be too long for it' : ''}.</p>
        <div className="formActions">
          <a className={`secondary${to.length ? '' : ' disabledLink'}`} href={to.length ? mailto : undefined} aria-disabled={!to.length}><Mail size={15} /> Open in email app</a>
          <button type="button" className="primary" disabled={!to.length} onClick={() => copy('addresses', to.join('; '))}><Copy size={15} /> {copied === 'addresses' ? 'Copied' : '1. Copy addresses'}</button>
          <button type="button" className="primary" onClick={() => copy('subject', subject)}><Copy size={15} /> {copied === 'subject' ? 'Copied' : '2. Copy subject'}</button>
          <button type="button" className="primary" onClick={() => copy('message', body)}><Copy size={15} /> {copied === 'message' ? 'Copied' : '3. Copy message'}</button>
        </div>
      </div>
    </Modal>
  );
}

function buildDraft(t: Template, e: TeamEvent | undefined, going: { a: { transport: string | null }; m?: Member }[], sender?: Member) {
  const sign = sender ? `\n\nV/R,\n${displayName(sender)}\n184th MTU` : '\n\nV/R,\n184th MTU';
  const site = typeof window !== 'undefined' ? window.location.origin : '';
  if (!e || t === 'blank') return { subject: '184th MTU: ', body: `Team,\n\n${sign}` };
  const when = eventRange(e);
  const where = e.location ? `\nLocation: ${e.location}` : '';
  const plan = e.notes ? `\n\nPlan:\n${e.notes}` : '';
  if (t === 'roster') {
    const list = going.map(({ a, m }) => `- ${m ? displayName(m) : 'Unknown'}${m?.pistol_no ? ` | Pistol #${m.pistol_no}` : ''}${m?.rifle_no ? ` | Rifle #${m.rifle_no}` : ''}${a.transport ? ` | ${a.transport}` : ''}`).join('\n');
    return {
      subject: `184th MTU ${kindLabel[e.kind]} Roster: ${when}`,
      body: `Team,\n\nHere is the roster for ${e.title} on ${when}.${where}\n\n${list || '(No one on the roster yet)'}${plan}\n\nIf you're not on this list and plan to attend, or you can no longer make it, let me know ASAP.${sign}`,
    };
  }
  if (t === 'orders') {
    return {
      subject: `ACTION: Orders for MTU ${kindLabel[e.kind]} ${when}`,
      body: `Team,\n\nOur records show your orders for ${e.title} on ${when} are not cut yet. Orders need to be cut NLT 2 weeks before the practice, and you must bring a printed copy. No orders, no weapons.\n\n1. Complete the ANG 336 from the MTU template and get your supervisor's signature.\n2. Send it to the NCOIC for day allocation.\n3. Have your CSS draft the orders in AROWS.\n\nReply once your orders are cut.${sign}`,
    };
  }
  return {
    subject: `Reminder: MTU ${kindLabel[e.kind]} ${when}`,
    body: `Team,\n\nReminder: ${e.title} is on ${when}.${where}${plan}\n\nPlease RSVP on the team site (${site}) so we can plan ammo and transportation, and make sure your orders are cut and printed. No orders, no weapons.${sign}`,
  };
}

