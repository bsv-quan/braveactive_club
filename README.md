# Brave Active Club

Brave Active Club is split into a Next.js frontend and a Python/FastAPI backend. PostgreSQL stores club activities, users, announcements, posts, comments, likes and sessions. Redis is not used.

## Start the entire app with Docker

Requirements: Docker Desktop with Docker Compose.

```sh
cp .env.example .env
docker compose up --build
```

Open the frontend at [http://localhost:3000](http://localhost:3000). The API and WebSocket are available at [http://localhost:8000](http://localhost:8000) and `ws://localhost:8000/ws/feed`. Compose starts PostgreSQL, applies Alembic migrations in the backend container, then starts the frontend. Uploaded images, backend daily logs, and database data are kept in named Docker volumes.

Stop the services with `docker compose down`; database, uploads, and backend logs remain. To also remove local database/uploads/logs, use `docker compose down -v`.

The compose defaults are for local development only. Set a random `SECRET_KEY` and the real admin email list in `.env`. For email delivery, configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` and optionally `MAIL_FROM`. Gmail requires an app password, not the account password.

## Run without Docker

1. Start PostgreSQL 17 and create a database/user matching `backend/.env.example`.
2. Copy `backend/.env.example` to `backend/.env`, set a random secret and configure `DATABASE_URL`.
3. From `backend/`, create a virtual environment, install `requirements.txt`, run `alembic upgrade head`, then run `uvicorn app.main:app --reload`.
4. From `frontend/`, run `npm ci` and `npm run dev`. Set `BACKEND_URL=http://localhost:8000` and `NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws/feed` if they differ from the defaults.

## Authentication and mail

- Only `@bravesoft.com.vn` addresses can register, log in or request a temporary password. The backend enforces this domain; the frontend email step is not the security boundary.
- Registration sends an eight-character temporary password by email. Users must change it immediately after their first login; the backend blocks authenticated actions until they do.
- Forgot password replaces the password with a new temporary password, revokes active sessions and requires the user to change it after signing in.
- Signed-in users can update their display name and upload a square-cropped profile photo from `/profile`; image files are re-encoded by the backend.
- The notification inbox is stored in PostgreSQL for offline delivery; authenticated WebSockets push live unread-count updates. Opening the inbox does not mark items read until it is closed, and only the displayed items are marked read.
- Community author avatars show online/offline presence. Presence is derived from authenticated WebSocket connections and is shared in real time; one backend worker is required for this in-memory live state.
- To grant administrator access, add the user's full company email to `ADMIN_EMAILS` before registration. Admins can manage community posts at `/admin/posts`.
- If SMTP is not configured in development, email delivery is skipped and message bodies are not logged because they can contain credentials or reset links. Configure SMTP to test account emails.
- Backend diagnostics are written to `backend/logs/backend-YYYY-MM-DD.log` (or the Docker `backend_logs` volume). Passwords, reset links, cookies and request bodies are excluded from logs.

## Security and operations

- The frontend proxies API/media requests to the backend so the HttpOnly, SameSite session cookie remains first-party.
- Authenticated writes require a session-bound CSRF token. The backend also checks request Origin, rate limits sensitive operations and applies security headers/body-size limits.
- Link previews restrict protocols, redirects, response size and public IP resolution to reduce SSRF risk. Uploads are verified and re-encoded server-side.
- Community post and comment edits/deletes are enforced by the backend for their authors and administrators; post edits preserve an existing photo attachment.
- Run one backend worker: the WebSocket hub and rate limiter are in-process.
- For production, terminate TLS in a trusted reverse proxy, set `ENVIRONMENT=production`, `COOKIE_SECURE=true`, a strong `SECRET_KEY`, correct `FRONTEND_ORIGINS` and `FRONTEND_BASE_URL`, and only enable `TRUST_PROXY_HEADERS` behind a trusted proxy.
- There is no migration of the old Redis data. Existing Redis-hosted content must be exported/imported separately if it needs to be retained.

## Project layout

- `frontend/`: Next.js App Router UI, reusable components, locale dictionaries (`src/i18n/messages/vi.ts`, `en.ts`, `ja.ts`) and same-origin API client.
- `backend/`: FastAPI routes, SQLAlchemy models/services, PostgreSQL migrations, auth, mail, media upload and WebSocket feed.
- `docker-compose.yml`: local PostgreSQL, backend and frontend services.
