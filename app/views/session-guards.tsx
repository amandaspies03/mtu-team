'use client';
import { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Modal } from './ui';

const BUILD = process.env.NEXT_PUBLIC_BUILD_ID ?? 'dev';

/** Shows a banner when a newer version of the site has been deployed than the one this tab loaded. */
export function UpdateBanner() {
  const [stale, setStale] = useState(false);
  useEffect(() => {
    let alive = true;
    const check = async () => {
      try {
        const r = await fetch('/api/version', { cache: 'no-store' });
        const { build } = await r.json();
        if (alive && build && build !== BUILD) setStale(true);
      } catch { /* offline; try again later */ }
    };
    const onVis = () => { if (document.visibilityState === 'visible') check(); };
    const id = setInterval(check, 5 * 60 * 1000);
    document.addEventListener('visibilitychange', onVis);
    check();
    return () => { alive = false; clearInterval(id); document.removeEventListener('visibilitychange', onVis); };
  }, []);
  if (!stale) return null;
  return (
    <div className="updateBanner" role="status">
      <span>A new version of the team site is available.</span>
      <button className="primary" onClick={() => window.location.reload()}><RefreshCw size={14} /> Refresh</button>
    </div>
  );
}

const IDLE_MS = 30 * 60 * 1000;
const WARN_MS = 2 * 60 * 1000;
const KEY = 'mtu-last-active';
export const IDLE_FLAG = 'mtu-idle-signout';

const readLast = () => { try { return Number(localStorage.getItem(KEY)) || Date.now(); } catch { return Date.now(); } };
const writeLast = (t: number) => { try { localStorage.setItem(KEY, String(t)); } catch { /* storage blocked */ } };

/** Signs the user out after 30 minutes without activity (shared across open tabs), with a 2-minute warning. */
export function IdleSignOut({ sb }: { sb: SupabaseClient }) {
  const last = useRef(Date.now());
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    writeLast(Date.now());
    let lastWrite = 0;
    const active = () => {
      const now = Date.now();
      last.current = now;
      if (now - lastWrite > 15000) { writeLast(now); lastWrite = now; }
    };
    const evts = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'] as const;
    evts.forEach(e => window.addEventListener(e, active, { passive: true }));
    const id = setInterval(async () => {
      const latest = Math.max(last.current, readLast());
      const idle = Date.now() - latest;
      if (idle >= IDLE_MS) {
        clearInterval(id);
        try { sessionStorage.setItem(IDLE_FLAG, '1'); } catch { /* ignore */ }
        await sb.auth.signOut();
      } else if (idle >= IDLE_MS - WARN_MS) setLeft(Math.ceil((IDLE_MS - idle) / 1000));
      else setLeft(null);
    }, 1000);
    return () => { clearInterval(id); evts.forEach(e => window.removeEventListener(e, active)); };
  }, [sb]);

  if (left === null) return null;
  return (
    <Modal title="Still there?" onClose={() => { last.current = Date.now(); writeLast(last.current); setLeft(null); }}>
      <p>For security, you’ll be signed out in <b>{Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</b> because of inactivity.</p>
      <div className="formActions">
        <button className="secondary" onClick={() => sb.auth.signOut()}>Sign out now</button>
        <button className="primary" onClick={() => { last.current = Date.now(); writeLast(last.current); setLeft(null); }}>Stay signed in</button>
      </div>
    </Modal>
  );
}
