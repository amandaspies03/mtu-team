'use client';
import { useState } from 'react';
import { Check, Eye, EyeOff, X } from 'lucide-react';
import { MAX_LENGTH, passwordRules } from '../../lib/password-policy';

/** New-password input with a live checklist of the password rules. */
export function NewPasswordField({ value, onChange, personal = [], label = 'Password' }: { value: string; onChange: (v: string) => void; personal?: string[]; label?: string }) {
  const [show, setShow] = useState(false);
  const rules = passwordRules(value, personal);
  return (
    <div className="pwField">
      <label>{label}
        <span className="pwInput">
          <input type={show ? 'text' : 'password'} autoComplete="new-password" value={value} onChange={e => onChange(e.target.value)} maxLength={MAX_LENGTH} required aria-describedby="pw-rules" />
          <button type="button" className="iconBtn" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}>{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>
        </span>
      </label>
      <ul id="pw-rules" className="pwRules">
        {rules.map(r => <li key={r.label} className={r.ok ? 'ok' : ''}>{r.ok ? <Check size={13} /> : <X size={13} />} {r.label}</li>)}
      </ul>
    </div>
  );
}
