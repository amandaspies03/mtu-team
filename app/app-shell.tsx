'use client';
import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { CalendarDays, Crosshair, Gauge, Link2, LogOut, ShieldCheck, Timer, Users, Target } from 'lucide-react';
import { getSupabase } from '../lib/supabase';
import { TeamProvider, useTeam } from '../lib/data';
import type { Profile } from '../lib/types';
import { displayName } from '../lib/util';
import Dashboard from './views/dashboard';
import Roster from './views/roster';
import MemberView from './views/member';
import Events from './views/events';
import EventView from './views/event-detail';
import Scores from './views/scores';
import MatchDay from './views/matchday';
import Admin from './views/admin';
import Links from './views/links';
import AuthScreen from './views/auth';

export type Route = { view: string; id?: string };
const parseHash = (): Route => {
  const [view, id] = (typeof window === 'undefined' ? '' : window.location.hash.slice(1)).split('/');
  return { view: view || 'dashboard', id };
};
export const go = (view: string, id?: string) => { window.location.hash = id ? `${view}/${id}` : view; };

export default function AppShell() {
  const sb = getSupabase();
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileError, setProfileError] = useState('');
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [recovery, setRecovery] = useState(false);

  useEffect(() => {
    if (!sb) { setReady(true); return; }
    const { data } = sb.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
    });
    sb.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    return () => data.subscription.unsubscribe();
  }, [sb]);

  async function loadProfile() {
    if (!sb || !session) return;
    setProfileError('');
    const { data, error } = await sb.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
    if (error) setProfileError(error.message);
    setProfile(data as Profile | null);
    setProfileLoaded(true);
  }
  useEffect(() => { setProfile(null); setProfileLoaded(false); if (session) loadProfile(); }, [session?.user.id]);

  if (!sb) return <div className="authShell"><div className="authCard"><h1>Setup needed</h1><p>The Supabase URL and publishable key are not configured for this deployment.</p></div></div>;
  if (!ready) return <div className="loadingScreen">Loading…</div>;
  if (!session || recovery) return <AuthScreen sb={sb} recovery={recovery} onRecovered={() => setRecovery(false)} />;
  if (!profile) return (
    <div className="authShell"><div className="authCard">
      <h1>{profileLoaded ? 'No access record' : 'Checking your access…'}</h1>
      {profileLoaded && !profileError && <p>Your access request was removed or never finished setting up. Contact MTU staff.</p>}
      {profileError && <p className="alert">{profileError}</p>}
      <button className="secondary" onClick={() => sb.auth.signOut()}>Sign out</button>
    </div></div>
  );
  if (!profile.approved) return (
    <div className="authShell"><div className="authCard">
      <div className="brandIcon"><Crosshair size={26} /></div>
      <h1>Waiting for approval</h1>
      <p>Your account ({profile.email}) was created. MTU staff need to approve it and link it to your roster entry before you can see team information.</p>
      <p className="formNote">Let SMSgt Howard or TSgt Spies know you signed up.</p>
      <div className="row">
        <button className="primary" onClick={loadProfile}>Check again</button>
        <button className="secondary" onClick={() => sb.auth.signOut()}>Sign out</button>
      </div>
    </div></div>
  );
  return <TeamProvider sb={sb} me={profile}><Workspace /></TeamProvider>;
}

function Workspace() {
  const { sb, me, isStaff, memberById, loading, error, reload, profiles } = useTeam();
  const [route, setRoute] = useState<Route>(parseHash);
  useEffect(() => {
    const on = () => { setRoute(parseHash()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const pending = profiles.filter(p => !p.approved).length;
  const meMember = memberById(me.member_id);

  const nav: { view: string; label: string; icon: React.ReactNode; staff?: boolean; match?: string[] }[] = [
    { view: 'dashboard', label: 'Dashboard', icon: <Gauge size={18} /> },
    { view: 'events', label: 'Calendar', icon: <CalendarDays size={18} />, match: ['event'] },
    { view: 'roster', label: 'Roster', icon: <Users size={18} />, match: ['member'] },
    { view: 'scores', label: 'Scores', icon: <Target size={18} /> },
    { view: 'matchday', label: 'Match day', icon: <Timer size={18} /> },
    { view: 'links', label: 'Files & links', icon: <Link2 size={18} /> },
    { view: 'admin', label: 'Access', icon: <ShieldCheck size={18} />, staff: true },
  ];

  let body: React.ReactNode;
  switch (route.view) {
    case 'roster': body = <Roster />; break;
    case 'member': body = <MemberView id={route.id!} />; break;
    case 'events': body = <Events />; break;
    case 'event': body = <EventView id={route.id!} />; break;
    case 'scores': body = <Scores />; break;
    case 'matchday': body = <MatchDay />; break;
    case 'links': body = <Links />; break;
    case 'admin': body = isStaff ? <Admin /> : <Dashboard />; break;
    default: body = <Dashboard />;
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <a className="brand" href="#dashboard">
          <span className="brandIcon"><Crosshair size={22} /></span>
          <span><b>184th MTU</b><br />Team Manager</span>
        </a>
        <nav>
          {nav.filter(n => !n.staff || isStaff).map(n => (
            <button key={n.view} className={route.view === n.view || n.match?.includes(route.view) ? 'active' : ''} onClick={() => go(n.view)}>
              {n.icon}<span>{n.label}</span>
              {n.view === 'admin' && pending > 0 && <span className="navCount">{pending}</span>}
            </button>
          ))}
        </nav>
        <div className="sideFoot">
          <div className="who">
            <strong>{meMember ? displayName(meMember) : me.display_name || me.email}</strong>
            <span>{isStaff ? 'Staff' : 'Shooter'}</span>
          </div>
          <button className="signout" onClick={() => sb.auth.signOut()}><LogOut size={14} /> Sign out</button>
        </div>
      </aside>
      <main>
        {error && <div className="alert">Couldn’t load team data: {error} <button onClick={reload}>Retry</button></div>}
        {loading ? <div className="loadingScreen">Loading team data…</div> : body}
        <footer><span>184th MTU · For official use by team members. Do not store SSNs, DoD IDs, or weapon serial numbers here.</span></footer>
      </main>
    </div>
  );
}
