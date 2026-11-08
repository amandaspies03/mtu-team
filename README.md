# 184th MTU Team Manager

Team management app for the 184th Marksmanship Training Unit: roster and quals, practice
calendar with RSVPs, 336/orders tracking and ammo issue, score tracking with leaderboards,
match teams, and a match-day tower command reader with stage timer.

Same stack as Battle Buddy: Next.js 16 on Vercel, Supabase (Postgres + Auth), GitHub.

## Setup
- Env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- Database schema: `supabase/migrations/` (Supabase project `mtu-team`)
- `npm install && npm run dev`

## Access model
- Anyone can request access; the account is created unapproved.
- Staff approve accounts and link them to a roster entry on the **Access** page.
- `amandaspies03@gmail.com` is made staff automatically on sign-up.
- Shooters: read the calendar, roster, scores and match-day tools; RSVP for themselves; see only their own quals.
- Staff: edit everything. All rules are enforced by Postgres row-level security.

Do not store SSNs, DoD IDs, DOBs, license numbers or weapon serial numbers in this app.
