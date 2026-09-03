# TaskNexus

TaskNexus is a React and Express task workspace for clients, freelancers, and administrators. The current product supports task briefs, role-aware dashboards, task progress, comments, attachments, milestones, notifications, profile management, public service requests, and operational administration.

The active database is Supabase/PostgreSQL. MongoDB and Mongoose are not part of the current runtime.

## Current product scope

- Clients create tasks, monitor work, collaborate, review submissions, and maintain professional profiles.
- Freelancers browse or accept eligible work, update progress, collaborate, submit work, view earnings records, and publish professional profiles.
- Administrators review users, tasks, audit information, and actual aggregate platform data.
- Public pages include the landing page, services, blog, support jar, login, registration, and privacy-controlled profiles at `/u/:username`.

Professional profiles use normalized profile, education, and skill records. Skills come from a canonical catalog with aliases and self-reported proficiency. Collaboration preferences describe how a member wants to contribute; they do not grant application permissions.

Payment-related records are workflow data only. TaskNexus does not currently provide a production payment gateway or real escrow. Team creation, projects, people discovery, contribution proof, opportunities, and AI features are planned direction, not current functionality.

## Stack

- Frontend: React 18, Vite 5, React Router, Tailwind CSS, Axios
- Backend: Node.js, Express, Supabase JavaScript client
- Database: Supabase/PostgreSQL
- Authentication: short-lived JWT access token in frontend memory and rotating refresh token in an HttpOnly cookie
- Realtime: authenticated Server-Sent Events
- Email: Brevo
- File handling: authenticated local-disk task attachments
- Deployment: Vercel frontend and Render backend

## Local setup

Prerequisites: Node.js 18 or newer, npm, and a Supabase project with the schema in `backend/sql/schema.sql`.

```bash
npm run install:all
```

Copy `backend/.env.example` to `backend/.env` and `frontend/.env.example` to `frontend/.env`, then provide the required values.

Start the API:

```bash
npm --prefix backend run dev
```

Start the frontend in another terminal:

```bash
npm --prefix frontend run dev
```

The frontend defaults to `http://localhost:5173`; the API defaults to `http://localhost:5000`.

## Important environment variables

Backend:

- `SUPABASE_URL`, `SUPABASE_ANON_KEY`
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`
- `ALLOWED_ORIGINS`
- `REFRESH_COOKIE_SAME_SITE` (`lax` for same-site/local development, `none` for the current cross-site Vercel/Render deployment)
- `UPLOAD_PATH`, `MAX_FILE_SIZE`
- `BREVO_*` variables when email delivery is enabled

Frontend:

- `VITE_API_URL`
- `VITE_SITE_URL`

Never commit real secrets. Credentialed CORS uses an explicit origin allowlist.

## Authentication overview

Public registration accepts only `client` and `freelancer`. The backend enforces that allowlist. Access tokens remain in JavaScript memory and are sent in the Authorization header. On reload, the app uses the protected refresh cookie to obtain a new access token, then calls `/api/auth/me` before rendering authenticated routes. Logout revokes the matching refresh session when possible and always clears the cookie.

The production frontend and API currently use different sites, so the refresh cookie is `Secure`, `HttpOnly`, and `SameSite=None`. A shared first-party domain is preferable long term because some browsers restrict third-party cookies.

## Admin provisioning

There is no public administrator signup. Set these variables in `backend/.env` or the provisioning environment:

```text
ADMIN_EMAIL=
ADMIN_PASSWORD=
ADMIN_FIRST_NAME=
ADMIN_LAST_NAME=
```

`ADMIN_PASSWORD` must be at least 12 characters. Then run:

```bash
npm --prefix backend run provision:admin
```

The script creates a new administrator through the current Supabase/PostgreSQL data layer. It refuses to elevate an existing non-admin account.

## Database and migrations

- Baseline schema: `backend/sql/schema.sql`
- Incremental migrations: `backend/sql/migrations/`

Apply migrations through the Supabase SQL editor or the project migration workflow before deploying matching API code.

Phase 2 profile endpoints:

- `GET/PUT /api/profile` for the authenticated member
- `PUT /api/profile/onboarding` for guided setup completion
- `GET /api/profile/username` for case-safe availability checks
- `PUT /api/profile/skills` for transactional skill replacement
- `POST/PUT/DELETE /api/profile/education` for owner-scoped education records
- `GET /api/public/skills` for bounded catalog search
- `GET /api/public/profiles/:username` for the explicit public DTO

## Verification

Run the complete baseline verification from the repository root:

```bash
npm run verify
```

Equivalent commands:

```bash
npm --prefix frontend run lint
npm --prefix frontend run build
npm --prefix backend test
```

## Deployment

- Vercel builds `frontend/` with `npm run build` and serves the Vite SPA.
- Render builds `backend/`, starts `server.js`, and checks `/health`.
- The canonical public site is `https://tasknexus.vercel.app`.
- Production API configuration must explicitly allow the canonical frontend origin and send credentialed responses.

Local attachment storage is private but not durable across all Render deployment events. Durable private object storage with signed access is intentionally deferred to a later infrastructure phase.

## Product direction

TaskNexus is evolving toward `Connect -> Build -> Prove -> Grow`. Professional profiles and structured skills are implemented. Teams, projects, project tasks, contribution history, showcases, discovery, and AI features remain future-phase scope and should not be described as available.

See [Architecture baseline](docs/ARCHITECTURE_BASELINE.md) and [Canonical contracts](docs/CANONICAL_CONTRACTS.md).
