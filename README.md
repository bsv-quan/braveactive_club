# Brave Active Club

MVP website for club announcements, posts, activities, and badminton sign-ups.
Built with Next.js App Router and Redis REST storage, ready to deploy on Vercel.

## Run locally

1. Install dependencies with `npm install`.
2. Create a Redis database through the Vercel Marketplace (Upstash Redis is supported).
3. Copy `.env.example` to `.env.local` and add the Redis REST URL and token.
   The app accepts `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`, and
   legacy `KV_REST_API_URL` / `KV_REST_API_TOKEN`.
4. Run `npm run dev`.

The first request to `/api/content` stores the sample announcements and posts in
Redis. Badminton registrations are stored by date, and duplicate names for the
same date are rejected. If Redis is not configured, the app displays a setup
error and does not pretend that registrations were saved.

## Deploy on Vercel

Import the repository into Vercel, add a Redis integration from the Vercel
Marketplace, and deploy. Make sure the integration's REST URL and token are
available to the project in its environment variables.

## API

- `GET /api/content` — initializes sample content on first access and reads the
  welcome announcement, member-created announcements, and posts from Redis.
- `GET /api/badminton?from=YYYY-MM-DD&to=YYYY-MM-DD` — reads registrations for
  up to 42 days.
- `POST /api/badminton` — registers a name for one date.
- `DELETE /api/badminton` — removes a name from a date's registrations.
- `GET /api/activities` — lists activities and participants.
- `POST /api/activities` — creates an activity.
- `POST /api/activities/:id/join` — joins an activity by name.
- `DELETE /api/activities/:id/join` — removes a participant from an activity.
- `DELETE /api/activities/:id` — deletes an activity (public in this MVP).
- `POST /api/announcements` — creates a club activity announcement.
- `PATCH /api/announcements/:id` — updates an activity announcement.
- `DELETE /api/announcements/:id` — deletes an activity announcement.

## Pages

- `/` — club overview and latest updates.
- `/activities` — activity news feed with category filters.
- `/activities/announcements/new` — create an activity announcement.
- `/badminton` — monthly badminton calendar and daily sign-ups.

On `/activities`, members can create an activity with its category, description,
schedule, and creator name; join with their name; and delete activities. These
actions are stored in Redis. Activity deletion is currently public and does not
require authentication.

The activity page keeps the welcome announcement first, hides the old sample
announcements, and lists new activities newest-first. Members can create
announcements at `/activities/announcements/new`; creating announcements is
currently public and does not require authentication.
Announcements can also be edited or deleted from the activity feed. Editing
and deleting announcements are currently public and do not require
authentication. The built-in welcome announcement cannot be deleted.

Removing badminton registrations and activity participants is also public in
this MVP and requires no authentication. Add user authentication and
authorization before using these deletion actions with a wider audience.
