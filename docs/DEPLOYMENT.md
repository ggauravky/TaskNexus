# Deployment guide

Phase 11 authorizes production-equivalent staging only. It does not authorize a
final production deployment.

## Topology and separation

| Environment | Frontend | Backend | MongoDB / attachments |
| --- | --- | --- | --- |
| Development | local Vite | local Node | developer DB; `local` attachment adapter allowed |
| Staging | Vercel preview/staging | Render staging | Atlas staging DB `tasknexus_v2`; unique GridFS bucket |
| Performance | local verifier | local Express | synthetic `tasknexus_v2_performance`; dropped after run |
| Production | assigned HTTPS domain | Render production | separate project/cluster/user/DB; production GridFS bucket |

Never share database users, database names, GridFS bucket names, origins or
provider secrets across staging and production. Preview deploys receive no
production secrets.

## Pre-deployment

1. Use Node 20.19.x and `npm ci` in both packages.
2. Run `npm run verify:launch` and production dependency audits.
3. Confirm backup/PITR and isolated restore evidence in `BACKUP_RESTORE.md`.
4. Enter provider secrets directly into the host secret stores; independently
   review variable names and environment scope without copying values.
5. Create indexes additively using
   `npm --prefix backend run database:indexes:production`. It requires the
   production runtime contract and explicit confirmation; it never drops indexes.
6. Seed only the canonical skill catalog with
   `PRODUCTION_SEED_DB_NAME` set to the exact `MONGODB_DB_NAME` and
   `npm --prefix backend run database:seed:production`. Do not seed QA users,
   Teams, organizations, opportunities or applications.
7. Provision an admin with an exact `ADMIN_PROVISION_DB_NAME` match and
   `npm --prefix backend run provision:admin`. The command refuses automatic role
   elevation and writes an audit event.

## Atlas

Use a dedicated M10+ production replica set sized after the recorded synthetic
test, then configure Cloud/Continuous Backup, alerts, termination protection and
a narrow access list. The application identity is limited to read/write on the
TaskNexus database. Index and recovery operators use separate identities. GridFS
creates `<GRIDFS_BUCKET_NAME>.files` and `.chunks` in the same database, so they
share backup/restore policy with attachment metadata.

## Render backend

Apply `render.yaml`, then set every `sync: false` secret. `/api/ready` is the
health check and becomes 200 only after MongoDB connects; `/health` is liveness.
The service drains HTTP/SSE and MongoDB on `SIGTERM`. Production startup rejects
staging database names and any attachment mode other than `gridfs`.

## Vercel frontend and domain boundary

Set project root `frontend`, `VITE_SITE_URL` to the assigned frontend HTTPS
origin, and `VITE_API_URL` to the assigned backend HTTPS origin plus `/api`.
Update CSP connect sources when the backend domain is assigned. Do not commit a
guessed domain. SPA routes and headers are owned by `frontend/vercel.json`.

Set backend `APP_ORIGIN` to the exact frontend origin and include only approved
additional origins in `ALLOWED_ORIGINS`. For different Vercel/Render sites use
`REFRESH_COOKIE_SAME_SITE=none`; Secure and HttpOnly are enforced. Keep
`TRUST_PROXY_HOPS=1` only while exactly one trusted Render proxy is present.

## Staging acceptance and rollback

Record frontend/backend URLs, commit, host release IDs and time. Verify HTTPS,
CORS, login/refresh/logout, SPA refresh, public pages, health/readiness, all four
golden paths, cross-role denials, browser widths, console/network, safe email,
GridFS retrieval after backend restart and dependency failure behavior.

Rollback by redeploying the last known-good Vercel and Render revisions. Never
drop indexes during app rollback. Stop writes and follow `BACKUP_RESTORE.md` when
data compatibility or integrity is involved.
