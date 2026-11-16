// Password rules. Supabase enforces length and "letters and digits" server-side; these mirror them in the UI,
// refuse only the most-guessed passwords, and check the breach list (isBreached) before sign-up.

export const MIN_LENGTH = 12;
export const MAX_LENGTH = 72; // bcrypt only uses the first 72 bytes

export const passwordHelp = `Use at least ${MIN_LENGTH} characters with at least one letter and one number. A short passphrase works well.`;

// Only the most-guessed passwords. Matched against the password with digits and symbols stripped,
// so "Password2026!" is refused but a password that merely contains a word like "rifle" is fine.
const COMMON = ['password', 'passw0rd', 'qwerty', 'qwertyuiop', 'letmein', 'welcome', 'iloveyou', 'abc', 'abcdef', 'changeme', 'trustno'];

export type Rule = { label: string; ok: boolean };

/** Rules shown as a live checklist under the password field. Supabase enforces the first two as well
 *  (Auth > Sign In / Providers > Email: 12 characters, "Letters and digits"). */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function passwordRules(password: string, _personal: string[] = []): Rule[] {
  const core = password.toLowerCase().replace(/[^a-z]/g, '');
  return [
    { label: `At least ${MIN_LENGTH} characters`, ok: password.length >= MIN_LENGTH && password.length <= MAX_LENGTH },
    { label: 'At least one letter and one number', ok: /[a-z]/i.test(password) && /[0-9]/.test(password) },
    { label: 'Not an everyday password like “Password123”', ok: !(core.length > 0 && COMMON.includes(core)) && !/^(.)\1+$/.test(password) },
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
