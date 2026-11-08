// Password rules. Supabase enforces length and character types server-side; these mirror them in the UI
// and add NIST SP 800-63B checks (no common or breached passwords, no passwords built from your own name/email).

export const MIN_LENGTH = 12;
export const MAX_LENGTH = 72; // bcrypt only uses the first 72 bytes

export const passwordHelp = `Use at least ${MIN_LENGTH} characters with an uppercase letter, a lowercase letter, a number and a symbol. A short passphrase works well.`;

const COMMON = ['password', 'passw0rd', 'qwerty', 'letmein', 'welcome', 'admin', 'iloveyou', 'monkey', 'dragon', 'football',
  'baseball', 'abc123', '123456', '654321', '111111', 'changeme', 'trustno1', 'sunshine', 'princess', 'master', 'airforce',
  'usaf', 'military', 'marksman', 'mtu184', '184mtu', 'kansas', 'wichita', 'mcconnell', 'shooter', 'rifle', 'pistol'];

export type Rule = { label: string; ok: boolean };

/** Rules shown as a live checklist under the password field. */
export function passwordRules(password: string, personal: string[] = []): Rule[] {
  const lower = password.toLowerCase();
  const words = personal.flatMap(p => (p || '').toLowerCase().split(/[^a-z0-9]+/)).filter(w => w.length >= 3);
  return [
    { label: `At least ${MIN_LENGTH} characters`, ok: password.length >= MIN_LENGTH && password.length <= MAX_LENGTH },
    { label: 'Uppercase and lowercase letters', ok: /[a-z]/.test(password) && /[A-Z]/.test(password) },
    { label: 'At least one number', ok: /[0-9]/.test(password) },
    { label: 'At least one symbol', ok: /[^a-zA-Z0-9]/.test(password) },
    { label: 'Not a common word, repeat or sequence', ok: !COMMON.some(c => lower.includes(c)) && !/(.)\1{3,}/.test(password) && !/(0123|1234|2345|3456|4567|5678|6789|abcd|qwer|asdf)/i.test(password) },
    { label: 'Doesn’t contain your name or email', ok: !words.some(w => lower.includes(w)) },
  ];
}

export const passwordOk = (password: string, personal: string[] = []) => passwordRules(password, personal).every(r => r.ok);

/** Checks the Have I Been Pwned breach list using k-anonymity: only the first 5 hash characters leave the browser. */
export async function isBreached(password: string): Promise<boolean> {
  try {
    const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(password));
    const hex = [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    const res = await fetch(`https://api.pwnedpasswords.com/range/${hex.slice(0, 5)}`, { headers: { 'Add-Padding': 'true' } });
    if (!res.ok) return false;
    const text = await res.text();
    return text.split('\n').some(line => {
      const [suffix, count] = line.trim().split(':');
      return suffix === hex.slice(5) && Number(count) > 0;
    });
  } catch {
    return false; // never block sign-up because the breach service is unreachable
  }
}

export function passwordError(error: unknown) {
  const e = error as { code?: string; message?: string };
  if (e?.code === 'weak_password') return passwordHelp;
  if (e?.code === 'same_password') return 'Choose a password different from your current one.';
  return e?.message || 'Your password could not be updated. Please try again.';
}
