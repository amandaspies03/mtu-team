'use client';
import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Crosshair } from 'lucide-react';

type Mode = 'signin' | 'signup' | 'forgot';

export default function AuthScreen({ sb, recovery, onRecovered }: { sb: SupabaseClient; recovery: boolean; onRecovered: () => void }) {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(''); setNotice('');
    try {
      const redirect = window.location.origin;
      if (recovery) {
        if (password.length < 10) throw new Error('Use at least 10 characters.');
        const { error } = await sb.auth.updateUser({ password });
        if (error) throw error;
        onRecovered();
        return;
      }
      if (mode === 'signin') {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (mode === 'signup') {
        if (password.length < 10) throw new Error('Use at least 10 characters for your password.');
        const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: redirect, data: { display_name: name } } });
        if (error) throw error;
        if (!data.session) setNotice('Check your email to confirm your account, then sign in. Staff will approve you after that.');
      } else {
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: redirect });
        if (error) throw error;
        setNotice('If that email has an account, a reset link is on its way.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="authShell">
      <form className="authCard" onSubmit={submit}>
        <div className="brandIcon"><Crosshair size={26} /></div>
        <div className="eyebrow">184TH MARKSMANSHIP TRAINING UNIT</div>
        <h1>{recovery ? 'Set a new password' : mode === 'signup' ? 'Request access' : mode === 'forgot' ? 'Reset password' : 'Team sign in'}</h1>
        {!recovery && mode === 'signup' && (
          <label>Name and rank<input value={name} onChange={e => setName(e.target.value)} placeholder="TSgt Jane Doe" required /></label>
        )}
        {!recovery && (
          <label>Email<input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required /></label>
        )}
        {(recovery || mode !== 'forgot') && (
          <label>{recovery ? 'New password' : 'Password'}
            <input type="password" autoComplete={mode === 'signin' && !recovery ? 'current-password' : 'new-password'} value={password} onChange={e => setPassword(e.target.value)} required minLength={recovery || mode === 'signup' ? 10 : undefined} />
          </label>
        )}
        {error && <p className="alert">{error}</p>}
        {notice && <p className="success">{notice}</p>}
        <button className="primary wide" disabled={busy}>{busy ? 'Working…' : recovery ? 'Save password' : mode === 'signup' ? 'Create account' : mode === 'forgot' ? 'Send reset link' : 'Sign in'}</button>
        {!recovery && (
          <div className="authLinks">
            {mode !== 'signin' && <button type="button" onClick={() => setMode('signin')}>Back to sign in</button>}
            {mode === 'signin' && <button type="button" onClick={() => setMode('signup')}>New to the team? Request access</button>}
            {mode === 'signin' && <button type="button" onClick={() => setMode('forgot')}>Forgot password</button>}
          </div>
        )}
        <p className="formNote">Accounts are approved by MTU staff. Don’t enter SSNs, DoD ID numbers or weapon serial numbers anywhere in this app.</p>
      </form>
    </div>
  );
}
