'use client';
import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Crosshair } from 'lucide-react';
import { blankProfile, ProfileFields, type ProfileInfo } from './profile-fields';
import { NewPasswordField } from './password-field';
import { IDLE_FLAG } from './session-guards';
import { isBreached, passwordError, passwordHelp, passwordOk } from '../../lib/password-policy';

type Mode = 'signin' | 'staff' | 'invite' | 'forgot';

const inviteFromHash = () => {
  const m = typeof window === 'undefined' ? null : window.location.hash.match(/^#invite\/([\w-]+)/);
  return m ? m[1] : null;
};

function friendly(msg: string, mode: Mode) {
  if (/database error saving new user/i.test(msg)) {
    return mode === 'staff'
      ? 'That email isn’t on the MTU staff list. Team members need an invite link from staff.'
      : 'This invite link is no longer valid. Ask MTU staff for a new one.';
  }
  return msg;
}

export default function AuthScreen({ sb, recovery, onRecovered }: { sb: SupabaseClient; recovery: boolean; onRecovered: () => void }) {
  const [token] = useState(inviteFromHash);
  const [mode, setMode] = useState<Mode>(token ? 'invite' : 'signin');
  const [invite, setInvite] = useState<{ valid: boolean; reason?: string } | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [info, setInfo] = useState<ProfileInfo>(blankProfile);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(() => {
    try { if (sessionStorage.getItem(IDLE_FLAG)) { sessionStorage.removeItem(IDLE_FLAG); return 'You were signed out after 30 minutes of inactivity.'; } } catch { /* ignore */ }
    return '';
  });
  const signingUp = mode === 'staff' || mode === 'invite';

  useEffect(() => {
    if (!token) return;
    sb.rpc('check_invite', { p_token: token }).then(({ data, error }) => setInvite(error ? { valid: false, reason: error.message } : data));
  }, [sb, token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(''); setNotice('');
    try {
      const redirect = window.location.origin;
      const personal = [email, info.first_name, info.last_name, info.mil_email, info.personal_email];
      if (recovery || signingUp) {
        if (!passwordOk(password, personal)) throw new Error(passwordHelp);
        if (await isBreached(password)) throw new Error('That password has shown up in a known data breach. Please choose a different one.');
      }
      if (recovery) {
        const { error } = await sb.auth.updateUser({ password });
        if (error) throw new Error(passwordError(error));
        onRecovered();
        return;
      }
      if (mode === 'signin') {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (signingUp) {
        const meta = { ...info, ...(mode === 'invite' ? { invite: token } : {}) };
        const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: redirect, data: meta } });
        if (error) throw (error as { code?: string }).code === 'weak_password' ? new Error(passwordHelp) : error;
        if (mode === 'invite') history.replaceState(null, '', window.location.pathname);
        if (!data.session) {
          setNotice('Account created. Check your email for a confirmation link, then sign in.');
          setMode('signin');
        }
      } else {
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: redirect });
        if (error) throw error;
        setNotice('If that email has an account, a reset link is on its way.');
      }
    } catch (err) {
      setError(friendly(err instanceof Error ? err.message : 'Something went wrong', mode));
    } finally {
      setBusy(false);
    }
  }

  const title = recovery ? 'Set a new password' : mode === 'staff' ? 'Staff account' : mode === 'invite' ? 'Join the team' : mode === 'forgot' ? 'Reset password' : 'Team sign in';
  const inviteBad = mode === 'invite' && invite && !invite.valid;

  return (
    <div className="authShell">
      <form className={`authCard${signingUp ? ' wideCard' : ''}`} onSubmit={submit}>
        <div className="brandIcon"><Crosshair size={26} /></div>
        <div className="eyebrow">184TH MARKSMANSHIP TRAINING UNIT</div>
        <h1>{title}</h1>
        {mode === 'staff' && <p className="formNote">For MTU staff only. Your email must already be on the staff list.</p>}
        {mode === 'invite' && !invite && <p className="formNote">Checking your invite…</p>}
        {inviteBad && <p className="alert">{invite!.reason}</p>}
        {mode === 'invite' && invite?.valid && <p className="formNote">Fill in your info below. It goes straight onto the team roster.</p>}

        {!inviteBad && (
          <>
            {signingUp && <ProfileFields value={info} onChange={setInfo} />}
            {!recovery && (
              <label>{signingUp ? 'Sign-in email' : 'Email'}
                {signingUp && <span>The email you’ll use to sign in. It can be your military or personal email.</span>}
                <input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required />
              </label>
            )}
            {(recovery || signingUp) && (
              <NewPasswordField label={recovery ? 'New password' : 'Password'} value={password} onChange={setPassword} personal={[email, info.first_name, info.last_name, info.mil_email, info.personal_email]} />
            )}
            {mode === 'signin' && !recovery && (
              <label>Password<input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required /></label>
            )}
            {error && <p className="alert">{error}</p>}
            {notice && <p className="success">{notice}</p>}
            <button className="primary wide" disabled={busy || (mode === 'invite' && !invite?.valid)}>
              {busy ? 'Working…' : recovery ? 'Save password' : signingUp ? 'Create account' : mode === 'forgot' ? 'Send reset link' : 'Sign in'}
            </button>
          </>
        )}
        {!recovery && (
          <div className="authLinks">
            {mode !== 'signin' && <button type="button" onClick={() => { setMode('signin'); setError(''); }}>Back to sign in</button>}
            {mode === 'signin' && <button type="button" onClick={() => { setMode('forgot'); setError(''); }}>Forgot password</button>}
            {mode === 'signin' && <button type="button" onClick={() => { setMode('staff'); setError(''); }}>MTU staff: create account</button>}
          </div>
        )}
        {mode === 'signin' && <p className="formNote">New to the team? Ask MTU staff for an invite link.</p>}
      </form>
    </div>
  );
}
