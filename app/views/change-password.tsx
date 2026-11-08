'use client';
import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Modal } from './ui';
import { NewPasswordField } from './password-field';
import { isBreached, passwordError, passwordHelp, passwordOk } from '../../lib/password-policy';

export function ChangePassword({ sb, email, onClose }: { sb: SupabaseClient; email: string; onClose: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false), [err, setErr] = useState(''), [done, setDone] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault(); setErr('');
    if (!passwordOk(next, [email])) { setErr(passwordHelp); return; }
    if (next === current) { setErr('Choose a password different from your current one.'); return; }
    setBusy(true);
    try {
      // Confirm it's really them before changing the password.
      const { error: authErr } = await sb.auth.signInWithPassword({ email, password: current });
      if (authErr) throw new Error('Your current password is incorrect.');
      if (await isBreached(next)) throw new Error('That password has shown up in a known data breach. Please choose a different one.');
      const { error } = await sb.auth.updateUser({ password: next });
      if (error) throw new Error(passwordError(error));
      setDone(true);
    } catch (x) {
      setErr(x instanceof Error ? x.message : 'Could not change your password.');
    } finally { setBusy(false); }
  }

  return (
    <Modal title="Change password" onClose={onClose}>
      {done ? (
        <div className="form"><p className="success">Your password was changed.</p><div className="formActions"><button className="primary" onClick={onClose}>Done</button></div></div>
      ) : (
        <form className="form" onSubmit={save}>
          <label>Current password<input type="password" autoComplete="current-password" value={current} onChange={e => setCurrent(e.target.value)} required /></label>
          <NewPasswordField label="New password" value={next} onChange={setNext} personal={[email]} />
          {err && <p className="alert">{err}</p>}
          <div className="formActions"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Change password'}</button></div>
        </form>
      )}
    </Modal>
  );
}
