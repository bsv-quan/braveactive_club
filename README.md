# Brave Active Club

Next.js frontend, Python/FastAPI backend, and PostgreSQL. Redis is not required.

## Quick start with Docker

Install and start Docker Desktop (or Docker Engine with Compose), then run from the project root:

```sh
docker compose up --build -d
```

Open http://localhost:3003. The backend is available at http://localhost:8008/health. Compose waits for PostgreSQL, applies migrations and starts one backend worker. Frontend API and media requests are proxied to the backend; browser WebSockets connect to port 8008. The stack is bound to localhost and uses development-only credentials; it is **not** a production deployment. Compose interpolates project-root `.env` values where explicitly referenced (for example `OPENAI_API_KEY`); it does not load a separate backend or VPS `.env` file.

AI-assisted community posts replace the former external-news crawler. Set `OPENAI_API_KEY` in the project-root `.env` (see `.env.example`) to enable RSS-based previews and replies to comments on approved `braveActive AI` posts. Administrators can choose a topic and a 1-, 4-, 12- or 24-hour freshness window, preview and edit an AI-generated Vietnamese summary, then submit it as a pending post. RSS source URLs are checked against previously used links after removing common tracking parameters; the original URL is retained on the post. The first RSS source set covers VnExpress health, sports, travel, entertainment and science/technology, plus selected AI feeds from GenK, TechCrunch, VentureBeat, OpenAI and Google. Automatic pending drafts run daily at 08:00 and 08:30 (technology), 12:00 (travel, sports or entertainment), 16:00 (sports, entertainment or technology), and 17:30 (AI-only technology feeds), using Vietnam time and sources from the previous four hours. The backend checks the schedule every 30 seconds; each slot is persisted in PostgreSQL to prevent duplicate posts across restarts or multiple workers. Transient failures retry up to three times, five minutes apart. Keep the backend running under a process supervisor in production. Without a key, normal community posting works and AI preview requests report that AI is not configured.

The configured feeds are VnExpress `suc-khoe`, `the-thao`, `du-lich`, `giai-tri`, `thu-gian` and `khoa-hoc-cong-nghe`; GenK AI; TechCrunch AI; VentureBeat AI; OpenAI News; and Google AI. The 17:30 technology slot uses only the AI-focused feeds. The RSS item publication time—not the feed's last-build time—is used for freshness checks. RSS failures are logged and remaining available feeds continue to be searched. The scheduler's persistent state is created by Alembic migration `0015_ai_post_schedule`; Docker Compose and `scripts/run.sh` apply migrations on startup.

Create the initial admin after the backend is healthy:

```sh
docker compose exec backend python bootstrap_admin.py
```

Enter and confirm a password at the prompt. The account is `admin@bravesoft.com.vn` and must change its password on first login. The script does not overwrite existing administrators.

To run backend tests against a separate, temporary PostgreSQL instance:

```sh
docker compose --profile test run --rm backend-tests
```

Tests drop and recreate tables in the dedicated test database, never the application database. The test database exists only inside the test container's temporary filesystem. Stop the stack with `docker compose --profile test down`; application database, uploads and logs remain in named volumes. Do not add `-v` unless you intend to delete that data. Use `docker compose logs -f` to inspect startup.

Docker uses its own Compose project and ports 3003/8008 to avoid disturbing existing stacks. For network access or different ports, update both the port mappings and the frontend URL, WebSocket build argument, and backend origin together, then rebuild. Use the VPS instructions below for production.

## Run locally

Requirements: Node.js 22+, Python 3.12+, PostgreSQL 17, and npm. PostgreSQL must be running before starting the application.

1. Install and start PostgreSQL. On macOS with Homebrew, for example:

   ```sh
   brew install postgresql@17
   brew services start postgresql@17
   /opt/homebrew/opt/postgresql@17/bin/createdb braveactive
   ```

   On Intel macOS the Homebrew prefix is typically `/usr/local` rather than `/opt/homebrew`. If PostgreSQL is already running, use its existing `createdb` command and connection credentials instead.
2. From the project root, copy `.env.example` to `.env`. Set `DATABASE_URL` to the PostgreSQL database and set a random `SECRET_KEY`. The example database URL uses the current operating-system PostgreSQL user. Values containing shell-special characters must be single-quoted: the run script sources this trusted configuration file.
3. Install application dependencies:

   ```sh
   python3 -m venv backend/.venv
   backend/.venv/bin/pip install -r backend/requirements.txt
   npm --prefix frontend ci
   ```

4. Run both services with one command:

   ```sh
   bash scripts/run.sh
   ```

   The script applies database migrations and runs the API on `127.0.0.1:8000` and Next.js on `127.0.0.1:3000`. Open http://localhost:3000; Ctrl+C stops both. PostgreSQL remains running.

5. After migrations, bootstrap the first admin once from another terminal:

   ```sh
   set -a; source .env; set +a
   cd backend && .venv/bin/python bootstrap_admin.py
   ```

   Enter the initial password securely at the prompt. The script creates `admin@bravesoft.com.vn` only when no active admin exists, never overwrites an existing account, and requires a password change on first login. Do not put credentials in the repository or shell history.

### Run backend tests

The test suite **drops and recreates tables** in its database. Create a separate empty test database and never point `TEST_DATABASE_URL` at application or production data:

```sh
createdb braveactive_test
cd backend
TEST_DATABASE_URL='postgresql+asyncpg://localhost:5432/braveactive_test' .venv/bin/pytest
```

Use the appropriate PostgreSQL credentials in `TEST_DATABASE_URL` if your local server requires them. Account requests do not send email.

## VPS / cPanel deployment

This deployment assumes a VPS with SSH, Node.js, Python, PostgreSQL, HTTPS, and a reverse proxy that supports WebSocket upgrades. Shared cPanel hosting without long-running processes or WebSockets is not supported by this script.

1. Provision PostgreSQL and a dedicated database/user. Install dependencies as above. Make the project, `backend/uploads`, and `backend/logs` writable by the service account. Keep `.env` outside public web directories and restrict its permissions (`chmod 600 .env`).
2. Set `RUN_MODE=production`, `ENVIRONMENT=production`, a random `SECRET_KEY` of at least 32 characters, `COOKIE_SECURE=true`, and your public HTTPS origin in `FRONTEND_ORIGINS` and `FRONTEND_BASE_URL`. Set `DATABASE_URL`. Use `BACKEND_URL=http://127.0.0.1:8000` and set `NEXT_PUBLIC_WS_URL=wss://your-domain/ws/feed`. Next.js embeds the WebSocket URL and backend proxy destination at build time; rebuild after changing either.
3. Point the HTTPS reverse proxy's `/ws/feed` route to `http://127.0.0.1:8000/ws/feed` with HTTP/1.1 WebSocket upgrade headers. Proxy all other paths to `http://127.0.0.1:3000`. The Next.js server forwards `/api` and `/media` to the backend. Ensure the proxy forwards the original `Origin` header.
4. Run `bash scripts/run.sh` under a process supervisor such as systemd or Supervisor, configured to restart on failure and stop the process group. The script builds Next.js, applies Alembic migrations and starts one backend worker and one frontend process in the foreground. Configure the supervisor and TLS reverse proxy according to your cPanel server setup.
5. Only set `TRUST_PROXY_HEADERS=true` behind a trusted proxy that overwrites forwarded headers. Back up PostgreSQL and `backend/uploads`; retain `backend/logs` according to your operational policy.

### Automatic deployment with GitHub Actions

The workflow in `.github/workflows/deploy.yml` deploys pushes to `main` (including merged pull requests). Direct pushes to `main` also deploy; protect the branch if deployments must only come from reviewed pull requests. A manual run is available from the Actions tab. Deployments use the Git commit that triggered the workflow and are serialized.

One-time VPS setup:

1. As a dedicated deployment/service user, clone this repository on the VPS and check out `main`. Configure SSH authentication for `git fetch origin main` from the VPS without interactive prompts, including GitHub's verified host key. Create the backend virtual environment and configure the VPS `.env` as described above; `RUN_MODE` and `ENVIRONMENT` must both be `production`. The deployment path must be an absolute path using only letters, digits, `/`, `.`, `_` and `-`.
2. Copy `scripts/braveactive.service.example` to `/etc/systemd/system/braveactive.service`, replace `User` and both paths with the actual deployment user and repository path, then run `sudo systemctl daemon-reload` and `sudo systemctl enable --now braveactive.service`. Check `systemctl status braveactive.service` and verify both services respond. The service runs the existing start script, which builds the frontend and applies migrations on startup.
3. Allow the deployment user to run **only** `systemctl restart braveactive.service` without a password using a narrowly scoped sudoers entry installed with `visudo` (verify the `systemctl` path on the VPS):

   ```text
   DEPLOY_USER ALL=(root) NOPASSWD: /usr/bin/systemctl restart braveactive.service
   ```

4. Create a GitHub **Environment** named `production`. Configure its secrets `DEPLOY_SSH_PRIVATE_KEY` (dedicated SSH key for the VPS deployment user) and `DEPLOY_SSH_KNOWN_HOSTS` (the VPS host-key line, independently verified against the server's fingerprint). Set environment variables `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_PATH`, and optionally `DEPLOY_PORT` (defaults to `22`). For a non-default port, use the `[host]:port` format in the known-hosts entry. Do not disable SSH host-key checking.

`DATABASE_URL`, `SECRET_KEY` and other runtime settings remain in the protected VPS `.env`, not in workflow output. They are **not** automatically synchronized from GitHub Secrets. `NEXT_PUBLIC_WS_URL` is read from the VPS `.env` during each build. If you change GitHub or VPS settings, rerun the workflow manually to apply them; the bootstrap admin script is never run automatically.

Deployment refuses to overwrite locally modified tracked files and requires a fast-forward from the server's `main` checkout. It installs dependencies, restarts the service, and checks backend `/health` and the frontend. Startup may interrupt service while the build and migrations run. A failed deployment does **not** roll back the source or database; inspect `journalctl -u braveactive.service`, repair the issue and rerun the workflow. Back up the database before applying migrations.

## Authentication and administration

- Only `@bravesoft.vn` and `@bravesoft.com.vn` addresses can register, log in or request a reset. Registration and reset create pending requests for an administrator; no email is sent.
- Admins **must verify the requester's identity through an internal channel before approval**, manually set a temporary password, and send it separately. The user must change it after signing in. A reset does not affect the account until approval; approval revokes existing sessions and authenticated WebSockets.
- `/admin` supports user management, account-request approval/rejection, post moderation and an activity-approval queue. Member-created activities remain private until approved; activities created by admins are published immediately. Deleting a user permanently removes their posts, comments and likes; activity registrations are name-based and are not linked to user accounts.
- The notification inbox is stored in PostgreSQL for offline delivery; authenticated WebSockets push live updates. Presence uses the in-memory WebSocket hub, so run exactly one backend worker.

## Security and operations

- The frontend proxies API/media requests to the backend so the HttpOnly, SameSite session cookie remains first-party.
- Authenticated writes require a session-bound CSRF token; the backend also checks Origin and limits request rates.
- Link previews restrict protocols, redirects, response size and public IP resolution. Uploaded images are verified and re-encoded.
- Backend diagnostics are written to `backend/logs/backend-YYYY-MM-DD.log`. Do not log passwords, codes, cookies or request bodies.
- There is no migration of old Redis data; export/import separately if needed.
