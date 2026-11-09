# GroupMe posting (for whoever maintains this site — person or AI assistant)

Staff can post an upcoming event to GroupMe with the **Post to GroupMe** button on the event page.
The post includes the date, location and an RSVP link back to the event.

## How it works

- `app/api/groupme/route.ts` does the posting. It runs on the server, checks that the caller is
  signed-in, approved staff, then sends the message through the GroupMe Bots API
  (`POST https://api.groupme.com/v3/bots/post` with `bot_id` + `text`).
- The button is in `app/views/event-detail.tsx` (`postToGroupMe`). After a successful post the
  event's `groupme_posted_at` column is set so staff can see it already went out.
- **Which group gets the post is decided only by the `GROUPME_BOT_ID` environment variable** in
  Vercel (project `mtu-team`, Production). Each GroupMe bot belongs to exactly one group.

## RSVP alerts to staff

When anyone taps **I'm going** (or switches from going to **Can't make it**), the site posts a short
note like "✅ SrA Jones is going to MTU Practice (19 NOV 2026)" to the **MTU Staff** GroupMe group so the
NCOIC sees it. This uses a separate variable, `GROUPME_STAFF_BOT_ID` (bot "MTU RSVPs" in "MTU Staff").
The RSVP button calls `/api/groupme` with `type: 'rsvp'` (see `Rsvp` in `app/views/ui.tsx`). If the
variable is empty, RSVPs still work and no alert is sent.

## The event-announcement bots

| Bot name | GroupMe group | Use |
| --- | --- | --- |
| MTU Events | 184th MTU | **Live** — the real team group. This is the normal setting. |
| MTU Events (test) | Mtu event test | Testing, so the team group doesn't get spammed. |
| MTU RSVPs | MTU Staff | RSVP alerts (`GROUPME_STAFF_BOT_ID`), always on. |

Both bots are managed at https://dev.groupme.com → **Bots** (signed in as the team GroupMe owner).
Each card there has a "Show bot ID" button.

**Never put a bot ID in this repo.** The repository is public, and anyone with a bot ID can post
to that group. Bot IDs live only in Vercel's environment variables.

## Switching between live and test

1. Go to https://dev.groupme.com → **Bots** and copy the bot ID for the group you want
   (live = "MTU Events", test = "MTU Events (test)").
2. In Vercel: project **mtu-team** → **Settings → Environment Variables** → edit
   `GROUPME_BOT_ID` (Production) and paste the new value. Update the variable's comment to say
   LIVE or TEST.
3. **Redeploy** (Deployments → latest → Redeploy). Environment variable changes only take effect on
   a new deployment.
4. Test with **Post to GroupMe** on a throwaway upcoming event, then delete the event (and the
   GroupMe message, if it went to the live group).

Always switch back to the live bot when testing is done.

## If posting fails

- "GroupMe is not set up yet" → `GROUPME_BOT_ID` is missing in Vercel.
- "GroupMe returned 404" → the bot ID is wrong or the bot was deleted. Copy it again from
  dev.groupme.com.
- Check the function logs in Vercel (Deployments → latest → Functions / Runtime logs) for
  `/api/groupme`.
