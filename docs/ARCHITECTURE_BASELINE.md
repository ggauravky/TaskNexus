# TaskNexus architecture baseline

## Frontend

The frontend is a React 18 SPA built with Vite and Tailwind CSS. React Router owns public, client, freelancer, and admin routes. Axios provides the JSON API client. The authenticated identity is kept in `AuthContext`; it is not restored from a cached user object.

Public UI is composed from shared navigation and footer components. Core task dialogs use the shared accessible `Dialog` foundation.

## Backend

The backend is a single Express application. Routes call controllers, controllers coordinate data modules and services, and data modules query Supabase. A local file-backed fallback exists only for non-production development when Supabase is unreachable.

## Database

Supabase/PostgreSQL is the canonical database. UUIDs identify rows. JSONB currently stores profile fragments, task details, workflow data, comments, activity, and milestones. The tracked SQL schema and incremental migrations define expected enum values and tables.

The repository does not currently define or verify Supabase Row Level Security policies. The backend is the authorization boundary and the deployed database grants must be reviewed separately.

## Authentication and authorization

- Public registration roles: `client`, `freelancer`
- Privileged role: `admin`, provisioned through `npm run provision:admin`
- Access token: short lived, stored in frontend memory, sent as a Bearer token
- Refresh token: rotating, stored in an HttpOnly cookie and matched against the user record
- Startup: refresh when necessary, then `/api/auth/me`, then render protected routes
- Logout: refresh-cookie based, idempotent, clears the server session when the token is valid
- Authorization: backend authentication plus role and resource-ownership checks

## Realtime

Realtime updates use Server-Sent Events at `/api/realtime/stream`. The frontend uses a fetch-based stream so it can send the access token in the Authorization header. Tokens are never placed in the URL. The realtime hub is process-local and is not suitable for horizontal scaling without a shared broker.

## Uploads

Task comment attachments are written below `UPLOAD_PATH/comments`. Filenames are generated UUIDs, type and extension are allowlisted, file signatures are checked, and downloads require authentication plus task access. Files are returned as downloads with private no-store caching.

Local disk is not durable infrastructure on every hosted deployment. Private object storage and signed access are deferred.

## Email and public forms

Brevo sends configured login and public-flow emails. Newsletter, service booking, and support-jar submissions use validation and a dedicated public-form rate limiter. Email failures are recorded without exposing credentials.

## Deployment

- Frontend: Vercel, canonical origin `https://tasknexus.vercel.app`
- Backend: Render, Express health endpoint `/health`
- CORS: explicit `ALLOWED_ORIGINS`, credentialed requests enabled
- Production refresh cookie: `Secure`, `HttpOnly`, `SameSite=None`, path `/api/auth`
- Production source maps: disabled

## Current roles and workflow

Clients create tasks in `submitted`. Admin approval moves them to `under_review`; assignment moves them to `assigned`; freelancer work advances through `in_progress`, `submitted_work`, and review states. Delivery, client approval, completion, revision, dispute, and cancellation states remain in the current state machine.

## Important boundaries

- Public users cannot choose the admin role.
- Private task data and attachments require authenticated task access.
- Admin UI and APIs use PostgreSQL-shaped `id` and `task_details` fields.
- Marketing copy must distinguish current features from planned teams, projects, discovery, contributions, opportunities, and AI work.

## Known technical debt

- Several task lifecycle screens still need full end-to-end contract tests.
- Some collaboration data remains JSONB read-modify-write and is vulnerable to concurrent update loss.
- Task acceptance and other multi-write operations need database transactions or compare-and-set protection.
- Supabase RLS and production grants are not tracked in this repository.
- Realtime delivery is process-local.
- Upload storage is private but not durable object storage.
- Cross-site refresh cookies can be affected by browser third-party-cookie policy; a shared first-party domain is preferred.
- Dashboard modules remain large and should be decomposed after contract stabilization.

## Future direction

Future phases may add professional profiles, structured skills, teams, memberships, projects, project tasks, discovery, contributions, showcases, and eventually opportunities. None of these entities exist in the Phase 0 architecture.
