# TaskNexus

TaskNexus is a React and Express workspace for clients, freelancers, and administrators. It supports task briefs, role-aware dashboards, task progress, comments, attachments, milestones, notifications, professional profiles, contextual collaboration teams, public service requests, and operational administration.

## Current product scope

- Clients create tasks, monitor work, collaborate, review submissions, and maintain professional profiles.
- Freelancers browse or accept eligible work, update progress, collaborate, submit work, view earnings records, and publish professional profiles.
- Administrators review users, tasks, audit information, and aggregate platform data.
- Authenticated users may create, discover, join, and manage teams through contextual `owner`, `admin`, and `member` roles that are independent from account roles.
- Public pages include services, blog, support jar, login, registration, and privacy-controlled profiles at `/u/:username`.

Payment records are workflow data; TaskNexus does not provide a production payment gateway or real escrow. Team Projects, Project Tasks, broad People Discovery, opportunities, and AI features remain future work.

## Stack

- Frontend: React 18, Vite 5, React Router, Tailwind CSS, Axios
- Backend: Node.js, Express, Mongoose
- Database: MongoDB Atlas (`tasknexus_v2` by default)
- Authentication: short-lived JWT access token in memory and rotating refresh token in an HttpOnly cookie
- Realtime: authenticated Server-Sent Events
- Email: Brevo
- File handling: authenticated local-disk task attachments
- Deployment: Vercel frontend and Render backend

## Local setup

Prerequisites: Node.js 20.19 or newer, npm, and a MongoDB deployment that supports transactions.

```bash
npm run install:all
```

Copy `backend/.env.example` to `backend/.env.local` and `frontend/.env.example` to `frontend/.env.local`, then provide the required values. Never commit either file.

```bash
npm --prefix backend run database:indexes
npm --prefix backend run database:seed
npm --prefix backend run dev
```

Start the frontend in another terminal with `npm --prefix frontend run dev`.

## Important environment variables

Backend:

- `MONGODB_URI`, `MONGODB_DB_NAME`
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`
- `ALLOWED_ORIGINS`, `REFRESH_COOKIE_SAME_SITE`
- `UPLOAD_PATH`, `MAX_FILE_SIZE`
- `BREVO_*` when email delivery is enabled

Frontend: `VITE_API_URL` and `VITE_SITE_URL`.

The MongoDB URI is backend-only. Use a dedicated least-privilege Atlas database user and restricted network access.

## Authentication and admin provisioning

Public registration accepts only `client` and `freelancer`. Access tokens remain in JavaScript memory. The protected refresh cookie restores a session; `/api/auth/me` confirms the identity. Logout revokes the matching stored refresh token and clears the cookie.

There is no public administrator signup. Set `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_FIRST_NAME`, and `ADMIN_LAST_NAME`, then run `npm --prefix backend run provision:admin`. The script refuses to elevate an existing non-admin account.

## Database operations

```bash
npm --prefix backend run database:indexes
npm --prefix backend run database:seed
npm --prefix backend run verify:database
npm --prefix backend run verify:mongodb-integration
npm --prefix backend run verify:teams
npm --prefix backend run verify:api-integration
```

Index synchronization is an explicit deployment operation. Production startup does not build indexes automatically. The API fails fast when MongoDB is unavailable; there is no JSON or memory persistence fallback.

## Verification

```bash
npm run verify
npm run verify:database
npm run verify:teams
```

The first command runs backend lint/tests and frontend lint/build. The database command checks connected collections, declared indexes, relationships, and representative query plans. `verify:teams` creates disposable Atlas records to verify transactions, contextual RBAC, privacy, concurrency, idempotency, and cleanup.

## Deployment

- Vercel builds `frontend/` and serves the Vite SPA.
- Render starts `backend/server.js` and checks `/health`.
- One shared Mongoose pool is opened per backend process and closed on `SIGTERM`/`SIGINT`.
- Production configures MongoDB, JWT secrets, and the canonical frontend origin in its secret store.

Local attachment storage is private but not durable across all deployment events. Durable object storage remains later infrastructure work.

See [Architecture baseline](docs/ARCHITECTURE_BASELINE.md), [Data model](docs/DATA_MODEL.md), [Canonical contracts](docs/CANONICAL_CONTRACTS.md), and [Team authorization](docs/TEAM_AUTHORIZATION.md).
