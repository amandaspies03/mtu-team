'use client';
import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { BookOpen, CalendarDays, Crosshair, Gauge, KeyRound, LogOut, Package, ShieldCheck, Timer, Users, Target, UserRound, Eye, Menu, X, Bell, LifeBuoy } from 'lucide-react';
import { getSupabase } from '../lib/supabase';
import { clearSnapshot, isNetworkError, loadSnapshot, signOutHere } from '../lib/offline';
import { OfflineBanner } from './views/offline-banner';
import { TeamProvider, useTeam } from '../lib/data';
import { DUTY_LABEL, type Profile } from '../lib/types';
import { displayName } from '../lib/util';
import Dashboard from './views/dashboard';
import Roster from './views/roster';
import MemberView from './views/member';
import Events from './views/events';
import EventView from './views/event-detail';
import Scores from './views/scores';
import ShooterProgression from './views/shooter-progression';
import MatchDay from './views/matchday';
import Admin from './views/admin';
import AmmoReport from './views/ammo';
import { IdleSignOut, UpdateBanner } from './views/session-guards';
import Resources from './views/resources';
import AuthScreen from './views/auth';
import { ChangePassword } from './views/change-password';
import { Tutorial } from './views/tutorial';
import { WhatsNew, UpdatePopup, useUpdates } from './views/whats-new';
import Support from './views/support';
import { blankProfile, ProfileFields, type ProfileInfo } from './views/profile-fields';
import type { SupabaseClient } from '@supabase/supabase-js';

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
  // No signal and the sign-in couldn't be refreshed: open with the copy saved on this device (read-only until back online).
  const [offlineUser, setOfflineUser] = useState<Profile | null>(null);

  useEffect(() => {
    // Keeps a copy of the app on the device so it opens without signal (see public/sw.js).
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register(`/sw.js?v=${encodeURIComponent(process.env.NEXT_PUBLIC_BUILD_ID ?? 'dev')}`).catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!sb) { setReady(true); return; }
    const { data } = sb.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (s) setOfflineUser(null);
      if (event === 'SIGNED_OUT') { setOfflineUser(null); void clearSnapshot(); }
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
    });
    // With no signal, an expired sign-in can make getSession retry for a long time; don't wait on it.
    const offlineNow = typeof navigator !== 'undefined' && navigator.onLine === false;
    const sessionOrTimeout = offlineNow
      ? Promise.race([sb.auth.getSession(), new Promise<Awaited<ReturnType<typeof sb.auth.getSession>>>(r => setTimeout(() => r({ data: { session: null }, error: new Error('Failed to fetch (offline)') } as never), 3000))])
      : sb.auth.getSession();
    sessionOrTimeout.then(async ({ data, error }) => {
      if (!data.session && (navigator.onLine === false || isNetworkError(error))) {
        const snap = await loadSnapshot<Profile, unknown>();
        if (snap) setOfflineUser(snap.profile);
      }
      setSession(data.session); setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, [sb]);

  async function loadProfile() {
    if (!sb || !session) return;
    setProfileError('');
    if (navigator.onLine === false) {
      const snap = await loadSnapshot<Profile, unknown>();
      if (snap && snap.userId === session.user.id) { setProfile(snap.profile); setProfileLoaded(true); return; }
    }
    const { data, error } = await sb.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
    if (error && isNetworkError(error)) {
      // No signal: use the access record saved with the offline copy, if it's this account's.
      const snap = await loadSnapshot<Profile, unknown>();
      if (snap && snap.userId === session.user.id) { setProfile(snap.profile); setProfileLoaded(true); return; }
    }
    if (error) setProfileError(isNetworkError(error) ? 'No signal. Connect and try again — the first sign-in on a device needs signal.' : error.message);
    setProfile(data as Profile | null);
    setProfileLoaded(true);
  }
  useEffect(() => {
    setProfile(null); setProfileLoaded(false);
    if (!session) return;
    // Defer past the auth event: querying inside Supabase's sign-in callback can wait on its auth lock forever.
    const t = setTimeout(loadProfile, 0);
    return () => clearTimeout(t);
  }, [session?.user.id]);

  if (!sb) return <div className="authShell"><div className="authCard"><h1>Setup needed</h1><p>The Supabase URL and publishable key are not configured for this deployment.</p></div></div>;
  if (!ready) return <div className="loadingScreen">Loading…</div>;
  if (!session && offlineUser && !recovery) return <TeamProvider sb={sb} me={offlineUser}><Workspace /></TeamProvider>;
  if (!session || recovery) return <><UpdateBanner /><AuthScreen sb={sb} recovery={recovery} onRecovered={() => setRecovery(false)} /></>;
  if (!profile) return (
    <div className="authShell"><div className="authCard">
      <h1>{profileLoaded ? 'No access record' : 'Checking your access…'}</h1>
      {profileLoaded && !profileError && <p>This account isn’t set up on the team site. Contact MTU staff for an invite link.</p>}
      {profileError && <p className="alert">{profileError}</p>}
      <button className="secondary" onClick={() => signOutHere(sb)}>Sign out</button>
    </div></div>
  );
  if (!profile.approved && profile.pending) return (
    <div className="authShell"><div className="authCard">
      <div className="brandIcon"><Crosshair size={26} /></div>
      <h1>Waiting for staff approval</h1>
      <p>Thanks for signing up. MTU staff will approve your account shortly — usually the same day. Once they do, you’ll see the team calendar and can RSVP.</p>
      <div className="row">
        <button className="primary" onClick={loadProfile}>Check again</button>
        <button className="secondary" onClick={() => signOutHere(sb)}>Sign out</button>
      </div>
    </div></div>
  );
  if (!profile.approved) return (
    <div className="authShell"><div className="authCard">
      <div className="brandIcon"><Crosshair size={26} /></div>
      <h1>Access turned off</h1>
      <p>MTU staff have turned off access for {profile.email}. If you think that’s a mistake, contact MTU staff.</p>
      <div className="row">
        <button className="primary" onClick={loadProfile}>Check again</button>
        <button className="secondary" onClick={() => signOutHere(sb)}>Sign out</button>
      </div>
    </div></div>
  );
  if (!profile.member_id) return <CompleteProfile sb={sb} onDone={loadProfile} />;
  return <TeamProvider sb={sb} me={profile}><UpdateBanner /><IdleSignOut sb={sb} /><Workspace /></TeamProvider>;
}

function Workspace() {
  const { sb, me, isStaff, realStaff, previewShooter, setPreviewShooter, memberById, loading, error, reload, tourOpen, closeTour, can, duties } = useTeam();
  const [route, setRoute] = useState<Route>(parseHash);
  const [pwOpen, setPwOpen] = useState(false);
  useEffect(() => {
    const on = () => { setRoute(parseHash()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const meMember = memberById(me.member_id);
  const updates = useUpdates(sb, me.id, isStaff);
  const popupItem = updates.published.find(a => a.popup && !a.read);

  const nav: { view: string; label: string; icon: React.ReactNode; staff?: boolean; show?: boolean; match?: string[]; badge?: number }[] = [
    { view: 'dashboard', label: 'Dashboard', icon: <Gauge size={18} /> },
    { view: 'events', label: 'Calendar', icon: <CalendarDays size={18} />, match: ['event'] },
    ...(isStaff
      ? [{ view: 'roster', label: 'Roster', icon: <Users size={18} />, match: ['member'] }]
      : [{ view: 'me', label: 'My profile', icon: <UserRound size={18} />, match: ['member'] }]),
    { view: 'scores', label: 'Match Scores', icon: <Target size={18} /> },
    { view: 'shooter-progression', label: 'Shooter Progression', icon: <Target size={18} /> },
    { view: 'matchday', label: 'Match day', icon: <Timer size={18} /> },
    { view: 'resources', label: 'Resources', icon: <BookOpen size={18} />, match: ['links'] },
    { view: 'whatsnew', label: 'What’s new', icon: <Bell size={18} />, badge: updates.unread.length },
    { view: 'support', label: 'Support', icon: <LifeBuoy size={18} /> },
    { view: 'ammo', label: 'Ammo', icon: <Package size={18} />, show: can('ammo') },
    { view: 'admin', label: 'Admin', icon: <ShieldCheck size={18} />, staff: true },
  ];

  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => { setMenuOpen(false); }, [route.view, route.id]);
  const currentLabel = nav.find(n => route.view === n.view || n.match?.includes(route.view))?.label ?? 'Dashboard';

  let body: React.ReactNode;
  switch (route.view) {
    case 'roster': body = isStaff ? <Roster /> : <Dashboard />; break;
    case 'me': body = me.member_id ? <MemberView id={me.member_id} /> : <Dashboard />; break;
    case 'member': body = isStaff || route.id === me.member_id ? <MemberView id={route.id!} /> : <Dashboard />; break;
    case 'events': body = <Events />; break;
    case 'event': body = <EventView id={route.id!} />; break;
    case 'scores': body = <Scores />; break;
    case 'shooter-progression': body = <ShooterProgression />; break;
    case 'matchday': body = <MatchDay />; break;
    case 'resources': case 'links': body = <Resources />; break;
    case 'admin': body = isStaff ? <Admin /> : <Dashboard />; break;
    case 'ammo': body = can('ammo') ? <AmmoReport /> : <Dashboard />; break;
    case 'support': body = <Support />; break;
    case 'whatsnew': body = <WhatsNew feed={updates} sb={sb} isStaff={isStaff} />; break;
    default: body = <Dashboard />;
  }

  return (
    <div className="shell">
      <aside className={`sidebar ${menuOpen ? 'menuOpen' : ''}`}>
        <a className="brand" href="#dashboard" onClick={() => setMenuOpen(false)}>
          <span className="brandIcon"><Crosshair size={22} /></span>
          <span><b>184th MTU</b><br />Team Manager</span>
        </a>
        <span className="mobileTitle">{currentLabel}</span>
        {updates.unread.length > 0 && !menuOpen && <b className="navBadge menuBadge" aria-hidden="true">{updates.unread.length}</b>}
        <button className="menuBtn" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
        {menuOpen && <div className="menuShade" onClick={() => setMenuOpen(false)} />}
        <div className="navPanel">
        <nav>
          {nav.filter(n => (n.show ?? true) && (!n.staff || isStaff)).map(n => (
            <button key={n.view} aria-label={n.label} className={route.view === n.view || n.match?.includes(route.view) ? 'active' : ''} onClick={() => { setMenuOpen(false); go(n.view); }}>
              {n.icon}<span>{n.label}</span>{!!n.badge && <b className="navBadge" aria-label={`${n.badge} unread`}>{n.badge}</b>}
            </button>
          ))}
        </nav>
        <div className="sideFoot">
          <div className="who">
            <strong>{meMember ? displayName(meMember) : me.display_name || me.email}</strong>
            <span>{isStaff ? 'Staff' : previewShooter ? 'Staff · shooter view' : duties.length ? `Shooter · ${duties.map(d => DUTY_LABEL[d]).join(', ')}` : 'Shooter'}</span>
          </div>
          {realStaff && <button className="signout previewToggle" onClick={() => { setMenuOpen(false); setPreviewShooter(!previewShooter); }}><Eye size={14} /> {previewShooter ? 'Back to staff view' : 'View as shooter'}</button>}
          <button className="signout" onClick={() => { setMenuOpen(false); setPwOpen(true); }}><KeyRound size={14} /> Change password</button>
          <button className="signout" onClick={() => signOutHere(sb)}><LogOut size={14} /> Sign out</button>
        </div>
        </div>
      </aside>
      <main>
        <OfflineBanner />
        {previewShooter && <div className="previewBar"><Eye size={16} /><span><b>Shooter view.</b> This is what a shooter sees. Anything you change still saves to your real account.</span><button onClick={() => setPreviewShooter(false)}>Back to staff view</button></div>}
        {error && <div className="alert">Couldn’t load team data: {error} <button onClick={reload}>Retry</button></div>}
        {loading ? <div className="loadingScreen">Loading team data…</div> : body}
        {!loading && tourOpen && !isStaff && <Tutorial onClose={closeTour} />}
        {!loading && !(tourOpen && !isStaff) && route.view !== 'whatsnew' && popupItem && (
          <UpdatePopup item={popupItem} onClose={open => { void updates.markRead([popupItem.id]); if (open) go(popupItem.target ?? 'whatsnew'); }} />
        )}
        {pwOpen && <ChangePassword sb={sb} email={me.email ?? ''} onClose={() => setPwOpen(false)} />}
        <footer><span>184th MTU · For official use by team members. Do not store SSNs, DoD IDs, or weapon serial numbers here.</span></footer>
      </main>
    </div>
  );
}

/** Accounts created before invite sign-up (or without roster info) add their roster entry once. */
function CompleteProfile({ sb, onDone }: { sb: SupabaseClient; onDone: () => void }) {
  const [info, setInfo] = useState<ProfileInfo>(blankProfile);
  const [busy, setBusy] = useState(false), [err, setErr] = useState('');
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('');
    const { error } = await sb.rpc('complete_my_profile', { info });
    setBusy(false);
    if (error) setErr(error.message); else onDone();
  }
  return (
    <div className="authShell"><form className="authCard wideCard" onSubmit={save}>
      <div className="brandIcon"><Crosshair size={26} /></div>
      <div className="eyebrow">ONE-TIME SETUP</div>
      <h1>Add your roster info</h1>
      <p className="formNote">This creates your entry on the team roster.</p>
      <ProfileFields value={info} onChange={setInfo} />
      {err && <p className="alert">{err}</p>}
      <button className="primary wide" disabled={busy}>{busy ? 'Saving…' : 'Save and continue'}</button>
      <div className="authLinks"><button type="button" onClick={() => signOutHere(sb)}>Sign out</button></div>
    </form></div>
  );
}
