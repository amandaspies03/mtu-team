'use client';
import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, CalendarDays, Crosshair, MessageCircle, Smartphone, Target, Timer, UserRound } from 'lucide-react';
import { go } from '../app-shell';

type Step = { icon: React.ReactNode; title: string; body: React.ReactNode; view?: string };

const STEPS: Step[] = [
  {
    icon: <Crosshair size={22} />, title: 'Welcome to the 184th MTU site', view: 'dashboard',
    body: <>
      <p>This is where you RSVP for practices and matches, track your scores, and find team guides. Here’s a 1-minute tour.</p>
      <p className="formNote">You can skip it now and replay it any time from <b>My profile</b>.</p>
    </>,
  },
  {
    icon: <CalendarDays size={22} />, title: 'RSVP for practices', view: 'dashboard',
    body: <>
      <p>Your <b>Dashboard</b> shows the next practice or match. Tap <b>I’m going</b> or <b>Can’t make it</b>.</p>
      <p>When staff post a practice in the team GroupMe, the link opens it right here with the same buttons.</p>
      <p className="formNote">Staff use your RSVP to plan ammo, weapons and the van, so please answer even if you can’t go.</p>
    </>,
  },
  {
    icon: <CalendarDays size={22} />, title: 'The calendar', view: 'events',
    body: <>
      <p><b>Calendar</b> lists every upcoming practice and match. Switch between the list and a month view, and RSVP from either.</p>
      <p>Open an event to see the date and location, your status, and your assigned rifle if you have one. <b>Add to calendar</b> puts it on your phone.</p>
    </>,
  },
  {
    icon: <UserRound size={22} />, title: 'My profile', view: 'me',
    body: <>
      <p><b>My profile</b> shows your contact info, team weapons, quals, scores and attendance.</p>
      <p>Tap <b>Update</b> on Contact to change your cell phone or emails. Quals, paperwork and weapon numbers are kept up to date by staff — let them know if something’s wrong.</p>
    </>,
  },
  {
    icon: <Target size={22} />, title: 'Match Scores', view: 'scores',
    body: <>
      <p>Staff enter scores after each practice and match. <b>Match Scores</b> has the team leaderboards for each course of fire.</p>
      <p>Tick names to compare trends on the graph. Your Dashboard also shows <b>how you stack up</b> on each course.</p>
    </>,
  },
  {
    icon: <Timer size={22} />, title: 'Match day', view: 'matchday',
    body: <>
      <p><b>Match day</b> has the tower commands, a stage timer and <b>how to score</b> each of our matches: Pistol EIC, Rifle EIC, Anti-Body Armor and Reflexive Fire.</p>
      <p>Great for learning the courses of fire before your first match.</p>
    </>,
  },
  {
    icon: <BookOpen size={22} />, title: 'Resources', view: 'resources',
    body: <>
      <p><b>Resources</b> has team guides: shooting tips and drills, what gear to buy (and what the team provides), match guides, range safety, and orders/336 steps for new shooters.</p>
      <p>Start with <b>New Shooters</b>. Use the search box to find anything fast.</p>
    </>,
  },
  {
    icon: <Smartphone size={22} />, title: 'Put it on your home screen', view: 'dashboard',
    body: <HomeScreenHelp />,
  },
  {
    icon: <MessageCircle size={22} />, title: 'You’re all set', view: 'dashboard',
    body: <>
      <p>Keep an eye on the team GroupMe for new practices and changes. Bring printed orders to every practice — no orders, no weapons.</p>
      <p>Questions? Ask any MTU staff member. See you on the line.</p>
    </>,
  },
];

/** Add-to-home-screen steps for the phone they're on (both if we can't tell). */
function HomeScreenHelp() {
  const [env, setEnv] = useState<{ ios: boolean; android: boolean; installed: boolean }>({ ios: false, android: false, installed: false });
  useEffect(() => {
    const ua = navigator.userAgent;
    const nav = navigator as Navigator & { standalone?: boolean };
    setEnv({
      ios: /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && 'ontouchend' in document),
      android: /Android/.test(ua),
      installed: window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true,
    });
  }, []);
  if (env.installed) return <p>You’re already using the home-screen app. Nice. It opens full screen like any other app.</p>;
  const iphone = <><b>iPhone (Safari):</b> tap the <b>Share</b> button (square with an arrow), scroll down, tap <b>Add to Home Screen</b>, then <b>Add</b>.</>;
  const android = <><b>Android (Chrome):</b> tap the <b>⋮</b> menu, then <b>Add to Home screen</b> (or <b>Install app</b>), then <b>Install</b>.</>;
  return <>
    <p>Save the site to your phone so it opens like an app, full screen and one tap away, with the MTU icon.</p>
    {env.ios ? <p>{iphone}</p> : env.android ? <p>{android}</p> : <><p>{iphone}</p><p>{android}</p></>}
    <p className="formNote">On iPhone this only works from Safari. If you opened the link inside GroupMe, tap the compass or “Open in Safari” first.</p>
  </>;
}

/** First-login walkthrough for shooters. Each step opens the page it describes behind the card. */
export function Tutorial({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0);
  const step = STEPS[i];
  const last = i === STEPS.length - 1;
  useEffect(() => { if (step.view) go(step.view); }, [step.view]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose]);
  return (
    <div className="tourShade">
      <div className="tourCard" role="dialog" aria-modal="true" aria-label={step.title}>
        <div className="tourTop">
          <span className="tourIcon">{step.icon}</span>
          <span className="formNote">Step {i + 1} of {STEPS.length}</span>
        </div>
        <h2>{step.title}</h2>
        <div className="tourBody">{step.body}</div>
        <div className="tourDots">{STEPS.map((_, k) => <button key={k} aria-label={`Go to step ${k + 1}`} className={k === i ? 'on' : ''} onClick={() => setI(k)} />)}</div>
        <div className="tourActions">
          {!last && <button className="linkBtn" onClick={onClose}>Skip tour</button>}
          <span className="grow" />
          {i > 0 && <button className="secondary" onClick={() => setI(i - 1)}><ArrowLeft size={15} /> Back</button>}
          {last
            ? <button className="primary" onClick={() => { go('dashboard'); onClose(); }}>Get started</button>
            : <button className="primary" onClick={() => setI(i + 1)}>Next <ArrowRight size={15} /></button>}
        </div>
      </div>
    </div>
  );
}
