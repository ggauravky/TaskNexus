# Environment variables

`backend/.env.example` is the local-development contract and
`backend/.env.production.example` is the production contract. Real values belong
only in the deployment provider's secret store. The application loads
`backend/.env.local` before `backend/.env`; neither file may be committed.

## Required runtime values

| Variable | Scope | Rule |
| --- | --- | --- |
| `NODE_ENV` | all | Use `development`, `test`, or `production` for Node tooling. |
| `APP_ENV` | all | `development`, `test`, `staging`, or `production`; this is the data-safety boundary. |
| `PORT` | backend | HTTP port; Render normally supplies it. |
| `APP_ORIGIN` | backend | One browser origin, no path or trailing slash; HTTPS is mandatory in production. |
| `ALLOWED_ORIGINS` | backend | Optional comma-separated additional exact origins. Never use `*` with credentials. |
| `MONGODB_URI` | backend | Atlas connection string from a least-privilege application user. |
| `MONGODB_DB_NAME` | backend | Explicit in production; local/staging default to `tasknexus_v2`. Production is forbidden from using that staging name. |
| `JWT_ACCESS_SECRET` | backend | Independent random value, at least 32 characters. |
| `JWT_REFRESH_SECRET` | backend | Independent random value, at least 32 characters and different from the access secret. |
| `UPLOAD_STORAGE_MODE` | backend | `local` for local/staging QA or `disabled`. `local` is rejected in production. |
| `EMAIL_DELIVERY_MODE` | backend | `disabled`, `optional`, or `required`; required mode also requires Brevo credentials. |
| `VITE_API_URL` | frontend | Public API base ending in `/api`. |
| `VITE_SITE_URL` | frontend | Canonical public site origin. |

## Tunables and defaults

- MongoDB: selection/connect `10000ms`, socket `45000ms`, heartbeat `10000ms`, pool `0..20` locally and recommended `2..20` in production.
- HTTP: body limit `API_BODY_LIMIT_BYTES=1048576`; proxy hops `0` locally and `1` behind Render.
- JWT: access `15m`, refresh `7d`; cookie maximum age `604800000ms`; production SameSite is `none`, Secure is forced, HttpOnly is always set.
- Rate limiting: general window/max, auth refresh, admin mutations, task creation, public forms, discovery, GitHub verification, hackathon, opportunity, and organization limiters can be tuned independently.
- Brevo: timeout `10s`, retries `2`; sender, reply-to, admin destination, and newsletter list are explicit.
- Logging: `LOG_LEVEL=info`; production logs are structured JSON on stdout. `LOG_TEST_LOGS=true` opts into test logs.

## Startup behavior

`server.js` validates the full contract before connecting or listening. Error
messages name invalid variables but never print their values. Invalid production
origin, weak/equal JWT secrets, staging database reuse, local production uploads,
or incomplete required email configuration stops startup.

## Removed/stale variables

`CLIENT_URL`, `VITE_APP_NAME`, `VITE_APP_ENV`,
`VITE_ENABLE_NOTIFICATIONS`, and `VITE_ENABLE_REAL_TIME` are not part of the
contract. Use `APP_ORIGIN` and the actual implemented runtime behavior instead.
