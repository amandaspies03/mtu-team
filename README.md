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
- Staff sign up with an email on the staff list; everyone else needs a single-use invite link from staff.
- Each sign-up creates (or fills in) the person's roster entry. Staff manage invites, the staff list and accounts on the **Access** page.
- Staff access comes only from the staff list (`staff_emails`).
- Shooters: read the calendar, roster, scores and match-day tools; RSVP for themselves; see only their own quals.
- Staff: edit everything. All rules are enforced by Postgres row-level security.
- Every change is recorded in `audit_log` (Admin → Change log). A full snapshot is saved nightly at 08:15 UTC and kept 30 days (Admin → Backups).
- Sessions sign out after 30 minutes of inactivity; open tabs show a refresh banner after each deploy.

Do not store SSNs, DoD IDs, DOBs, license numbers or weapon serial numbers in this app.

## GroupMe

Staff can post events to the team GroupMe. Which group receives posts (live team group vs. test group) is controlled by the `GROUPME_BOT_ID` environment variable in Vercel. See [docs/GROUPME.md](docs/GROUPME.md) before changing it.
