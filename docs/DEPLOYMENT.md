# Deployment guide

## Environment topology

| Environment | Frontend | Backend | MongoDB |
| --- | --- | --- | --- |
| Development | local Vite | local Node | developer-only database |
| Staging/QA | preview or local | non-production service | Atlas project/database `tasknexus_v2` |
| Production | Vercel production | Render production | separate Atlas project, cluster, user, and database |

Never share database credentials or database names between staging and
production. Preview deployments must not receive production secrets.

## Pre-deployment

1. Use Node 20.19.x and install with `npm ci` in `backend` and `frontend`.
2. Run `npm run verify:production` at the repository root.
3. Review `npm audit --omit=dev` for both packages and document any accepted risk.
4. Confirm the production-readiness checklist and a recent restore drill.
5. Create the production indexes during an approved maintenance window with
   `npm --prefix backend run database:indexes:production`. The command requires
   production configuration and an explicit confirmation and only creates
   declared indexes; it does not drop obsolete indexes.

## Atlas

Create a dedicated production project and non-free production-appropriate cluster
after capacity testing. Enable Cloud/Continuous Backup, alerts, and a narrow IP
access list. Create an application database user limited to the TaskNexus
production database. Create a separate human/automation identity for index and
restore operations. Do not grant the application backup or project-owner access.

## Render backend

Connect the repository blueprint in `render.yaml`. Enter all `sync: false` values
in Render's secret store and add the remaining values from
`backend/.env.production.example`. `MONGODB_DB_NAME` must not be `tasknexus_v2`.
Render checks `/api/ready`; it becomes healthy only after MongoDB is connected.
`/health` is liveness and must remain 200 while the process can serve HTTP.

The service handles `SIGTERM` and closes SSE, HTTP, and MongoDB within 30 seconds.
Render supports a shutdown delay in its Blueprint; its default is 30 seconds:
https://render.com/docs/blueprint-spec

## Vercel frontend

Set the project root to `frontend`, then set production-only `VITE_SITE_URL` and
`VITE_API_URL`. Keep fork/preview secret protections enabled. Deploy only after the
Render readiness endpoint passes. `frontend/vercel.json` owns routing, immutable
asset caching, and browser security headers.

## Cross-site cookie topology

The canonical browser origin is `APP_ORIGIN`; it must appear exactly in
`ALLOWED_ORIGINS`. The API is `VITE_API_URL`. With Vercel and Render on distinct
sites, set `REFRESH_COOKIE_SAME_SITE=none`; Secure and HttpOnly are enforced.
Do not proxy untrusted forwarding hops: `TRUST_PROXY_HOPS=1` assumes one Render
proxy. If custom domains put frontend and API on the same site, test refresh and
logout before considering a SameSite change.

## Post-deployment smoke gate

Check `/health`, `/api/ready`, response security headers, and browser console.
Execute: (1) client creates a task and freelancer progresses it, (2) team creates
a project and publishes evidence/showcase, (3) hackathon registration through
submission, and (4) organization publishes a native opportunity through candidate
application and recruiter stage change. Also test outsider denial for team,
project, and organization resources. Roll back if any gate fails.

## Rollback

Redeploy the last known-good Vercel and Render revisions. Application rollback
must not run an index-removal command. If data changed incompatibly, stop writes
and follow `BACKUP_RESTORE.md`; never improvise an in-place destructive restore.
