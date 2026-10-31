# Brave Active Club

MVP website for club announcements, posts, and member-created activity sign-ups.
Built with Next.js App Router and Redis REST storage, ready to deploy on Vercel.

## Run locally

1. Install dependencies with `npm install`.
2. Create a Redis database through the Vercel Marketplace (Upstash Redis is supported).
3. Copy `.env.example` to `.env.local` and add the Redis REST URL and token.
   The app accepts `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`, and
   legacy `KV_REST_API_URL` / `KV_REST_API_TOKEN`.
4. Run `npm run dev`.

The first request to `/api/content` stores the sample announcements and posts in
Redis. Activity sign-ups and member lists are stored in Redis. If Redis is not
configured, the app displays a setup error and does not pretend that data was
saved.

## UI structure

- `src/app/club-app.tsx` owns page state, data loading, and action handlers.
- `src/components/club/` contains reusable page sections, calendar and modal UI.
- `src/components/club/month-grid.tsx` shares the month grid between the club
  calendar and date-poll voting.
- `src/lib/club-ui.ts` contains shared date and category presentation helpers.

## Deploy on Vercel

Import the repository into Vercel, add a Redis integration from the Vercel
Marketplace, and deploy. Make sure the integration's REST URL and token are
available to the project in its environment variables.

## API

- `GET /api/content` — initializes sample content on first access and reads the
  welcome announcement, member-created announcements, and posts from Redis.
- `GET /api/badminton?from=YYYY-MM-DD&to=YYYY-MM-DD`, `POST /api/badminton`,
  `DELETE /api/badminton` — legacy endpoints retained for compatibility; the
  calendar UI now uses activity sign-ups instead.
- `GET /api/activities` — lists activities and participants.
- `POST /api/activities` — creates a fixed-date activity or a date poll.
- `GET /api/cron/activity-recurrences` — creates scheduled recurring activity
  occurrences; called daily by Vercel Cron and requires `CRON_SECRET`.
- `POST /api/activities/:id/join` — joins an activity by name.
- `POST /api/activities/:id/comments` — adds a comment to an activity.
- `POST /api/activities/:id/votes` — replaces a member's multi-date availability vote.
- `DELETE /api/activities/:id/join` — removes a participant from an activity.
- `DELETE /api/activities/:id` — deletes an activity (public in this MVP).
- `POST /api/announcements` — creates a club activity announcement.
- `PATCH /api/announcements/:id` — updates an activity announcement.
- `DELETE /api/announcements/:id` — deletes an activity announcement.

## Pages

- `/` — club overview and latest updates.
- `/activities` — shared monthly activity calendar, activity sign-ups, date
  polls, and the activity news feed.
- `/activities/:id` — activity detail, participant registration, date voting,
  and an activity chat that refreshes new messages every five seconds.
- `/activities/announcements/new` — create an activity announcement.
- `/badminton` — redirects to `/activities`.

On `/activities`, members can create full activities with a category,
description, schedule, and creator name; create quick sign-ups by entering only
an activity name for the selected date; and open each item on its detail page.
On the detail page, members can register, vote on dates, and exchange messages.
Each quick sign-up has its own participant list. These actions are stored in
Redis. Activity deletion is currently public and does not require authentication.
Recurring dates appear separately on the calendar for per-date registration,
while the Home activity list groups them as one recurring activity. Deleting a
recurring activity removes the entire series.
Scheduled activities can optionally repeat daily, weekly, or monthly, with no
end date, a total occurrence count, or an end date. Vercel Cron checks due
recurrences daily; configure `CRON_SECRET` in the deployment environment for
the scheduled endpoint (for example, in Vercel Project Settings → Environment
Variables). The next 90 days are created immediately and the daily cron
maintains that rolling calendar window. Deleting any occurrence in a series
stops future occurrences. On the calendar, members can use **+** on an activity
to register for that specific date. The recurring activity detail page lets
members choose an upcoming date and shows upcoming dates that already have
participants, with each date's participant list kept separate.
Activities can have a fixed date or be created without a confirmed date. On a
selected calendar day, members can use **Tạo đăng ký nhanh** to enter an
activity name and open a separate sign-up with its own participant list.
An activity with the same normalized name cannot be created twice on the same day. For
undecided activities, members can select multiple available dates on the
calendar; submitting another vote with the same name replaces their previous
choices.
The old `/api/badminton` endpoints remain available for compatibility, but
badminton registrations are no longer shown in the activity calendar UI.
Legacy vote entries that cannot be parsed are skipped and logged instead of
causing the activities endpoint to fail.

The activity page keeps the welcome announcement first, hides the old sample
announcements, and lists new activities newest-first. Members can create
announcements at `/activities/announcements/new`; creating announcements is
currently public and does not require authentication.
Announcements can also be edited or deleted from the activity feed. Editing
and deleting announcements are currently public and do not require
authentication. The built-in welcome announcement cannot be deleted.

Removing activity participants is also public in this MVP and requires no
authentication. Add user authentication and authorization before using these
deletion actions with a wider audience.
