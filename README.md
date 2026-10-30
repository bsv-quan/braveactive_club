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
  announcements and posts from Redis.
- `GET /api/badminton?from=YYYY-MM-DD&to=YYYY-MM-DD` — reads registrations for
  up to 42 days.
- `POST /api/badminton` — registers a name for one date.
