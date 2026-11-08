import type { TeamEvent } from './types';

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const ymd = (iso: string) => iso.replace(/-/g, '');
const nextDay = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + 1));
  return t.toISOString().slice(0, 10).replace(/-/g, '');
};
// iCalendar lines must be folded at 75 octets.
const fold = (line: string) => {
  const out: string[] = [];
  let cur = '';
  for (const ch of line) {
    if (new TextEncoder().encode(cur + ch).length > (out.length ? 74 : 75)) { out.push(cur); cur = ch; } else cur += ch;
  }
  out.push(cur);
  return out.join('\r\n ');
};

/** All-day calendar entries for team events; works in Outlook, Google Calendar and phone calendars. */
export function buildIcs(events: TeamEvent[], site: string) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//184th MTU//Team Manager//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  for (const e of events) {
    const desc = [e.notes, `Details and RSVP: ${site}/#event/${e.id}`, 'Bring printed orders. No orders, no weapons.'].filter(Boolean).join('\n\n');
    lines.push('BEGIN:VEVENT', `UID:${e.id}@mtu-team`, `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${ymd(e.start_date)}`, `DTEND;VALUE=DATE:${nextDay(e.end_date ?? e.start_date)}`,
      `SUMMARY:${esc(`184th MTU: ${e.title}`)}`, ...(e.location ? [`LOCATION:${esc(e.location)}`] : []),
      `DESCRIPTION:${esc(desc)}`, 'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY', `DESCRIPTION:${esc(`Tomorrow: ${e.title}`)}`, 'END:VALARM', 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

export function downloadIcs(name: string, events: TeamEvent[]) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([buildIcs(events, window.location.origin)], { type: 'text/calendar;charset=utf-8' }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
