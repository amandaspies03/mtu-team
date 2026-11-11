'use client';
// Shared team record for Shooter Progression drills (table drill_sessions).
// Everyone approved can see every score. Shooters add, edit and delete their own; staff can do it for anyone.
// The database enforces the same rules (see supabase/migrations/20261111_drill_sessions.sql).
import { useMemo } from 'react';
import { useTeam } from './data';
import { displayName } from './util';
import type { DrillId } from './types';

export type DrillEntry<S> = { id: string; memberId: string; shooter: string; session: S; own: boolean };
type Base = { id: string; date: string };

const DRILL_TITLE: Record<DrillId, string> = { 'man-card': 'Man Card', 'bill-drill': 'Bill Drill', 'one-reload-one': '1-Reload-1', 'dot-torture': 'Dot Torture' };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function useDrillRecord<S extends Base>(drill: DrillId) {
  const { me, isStaff, drillSessions, members, memberById, saveOrQueue, reload } = useTeam();
  const mine = me.member_id;
  const entries: DrillEntry<S>[] = useMemo(() => drillSessions
    .filter(r => r.drill === drill)
    .map(r => ({
      id: r.id, memberId: r.member_id, shooter: displayName(memberById(r.member_id)),
      session: { ...(r.data as unknown as S), id: r.id, date: r.shot_on },
      own: isStaff || (!!mine && r.member_id === mine),
    }))
    .sort((a, b) => b.session.date.localeCompare(a.session.date)), [drillSessions, drill, memberById, isStaff, mine]);

  // Who a scorecard can be saved for: staff pick anyone on the roster, shooters only themselves.
  const shooters = useMemo(() => (isStaff ? members.filter(m => m.team_status !== 'Inactive' || m.id === mine) : members.filter(m => m.id === mine))
    .map(m => ({ id: m.id, name: displayName(m) }))
    .sort((a, b) => a.name.localeCompare(b.name)), [members, isStaff, mine]);

  async function save(session: S, memberId: string): Promise<string> {
    if (!memberId) return 'Your account isn’t linked to a roster name yet, so scores can’t be saved. Ask staff to link it.';
    if (!isStaff && memberId !== mine) return 'You can only save your own scores.';
    const { id, date, ...rest } = session;
    const r = await saveOrQueue({
      kind: 'drill', label: `${DRILL_TITLE[drill]} score`,
      row: { id: UUID.test(id) ? id : crypto.randomUUID(), member_id: memberId, drill, shot_on: date, data: rest as Record<string, unknown> },
    });
    if (r === 'sent') { await reload(); return 'Saved to the team record.'; }
    return 'No signal — saved on this phone. It will send when you’re back online.';
  }
  async function remove(id: string): Promise<string> {
    const r = await saveOrQueue({ kind: 'drill-delete', label: `Delete ${DRILL_TITLE[drill]} score`, sessionId: id });
    if (r === 'sent') { await reload(); return 'Score deleted.'; }
    return 'No signal — the delete will send when you’re back online.';
  }
  const canSave = isStaff || !!mine;
  return { entries, shooters, save, remove, canSave, myMemberId: mine ?? '', isStaff, currentShooter: displayName(memberById(mine)) };
}

/** Shows the shooter on a scorecard. Staff get a roster dropdown; shooters see their own name. */
export function ShooterPick({ value, onChange, options, readOnly, name }: {
  value: string; onChange: (id: string) => void; options: { id: string; name: string }[]; readOnly?: boolean; name?: string;
}) {
  if (readOnly || options.length <= 1) return <p className="formNote">Shooter: <b>{name ?? options.find(o => o.id === value)?.name ?? '—'}</b></p>;
  return (
    <label className="shooterPick">Shooter
      <select required value={value} onChange={e => onChange(e.target.value)}>
        <option value="">Choose a shooter…</option>
        {options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
    </label>
  );
}

/** Scores saved in this browser before the team record existed. */
export const DEVICE_KEYS: Record<DrillId, (uid: string) => string> = {
  'man-card': uid => `mtu.man-card.${uid}`,
  'bill-drill': uid => `mtu.bill-drill.${uid}`,
  'one-reload-one': uid => `mtu.one-reload-one.${uid}`,
  'dot-torture': uid => `mtu.dot-torture.${uid}`,
};
