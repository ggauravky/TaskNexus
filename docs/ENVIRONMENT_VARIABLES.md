# Environment variables

Use `backend/.env.example` for development and
`backend/.env.production.example` for production. Real values exist only in the
deployment secret store. `.env.local` and `.env` are untracked local inputs.

## Runtime contract

| Variable | Rule |
| --- | --- |
| `NODE_ENV` | `production` for production; must agree with `APP_ENV`. |
| `APP_ENV` | `development`, `test`, `staging` or `production`; primary mutation safety boundary. |
| `PORT` | HTTP port; hosting platform normally supplies it. |
| `APP_ORIGIN` | Exact frontend origin; HTTPS and no path/trailing slash in production. |
| `ALLOWED_ORIGINS` | Optional comma-separated exact origins; never `*` with credentials. |
| `MONGODB_URI` | Least-privilege environment-specific application credential. |
| `MONGODB_DB_NAME` | Explicit; production rejects `tasknexus_v2` and test/staging-like names. |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Independent random values, each at least 32 characters. |
| `UPLOAD_STORAGE_MODE` | `local`, `gridfs`, or `disabled`; production requires `gridfs`. |
| `GRIDFS_BUCKET_NAME` | Environment-specific safe bucket, 3–64 characters; production example is `tasknexus_attachments_production`. |
| `UPLOAD_PATH` | Development-only local adapter root; never use for production persistence. |
| `EMAIL_ENABLED` | `true` or `false`; when true, Nodemailer sends through Brevo SMTP. |
| `BREVO_SMTP_HOST` / `BREVO_SMTP_PORT` | Brevo relay host and numeric port; production uses `smtp-relay.brevo.com:587`. |
| `BREVO_SMTP_USER` / `BREVO_SMTP_PASS` | SMTP credentials; required when email is enabled and never exposed to the frontend. |
| `BREVO_SENDER_EMAIL` / `BREVO_SENDER_NAME` | Verified Brevo sender identity; required when email is enabled. |
| `BREVO_REPLY_TO_EMAIL` / `BREVO_REPLY_TO_NAME` | Optional reply-to identity; defaults to the sender. |
| `EMAIL_APP_URL` / `EMAIL_SUPPORT_URL` | User-facing TaskNexus HTTPS URLs used by templates. |
| `VITE_API_URL` | Public backend base ending `/api`; production must match `frontend/production.config.json`. |
| `VITE_SITE_URL` | Canonical frontend origin; production defaults to `frontend/production.config.json`. |

## Controlled command confirmations

These are operator safeguards, not long-lived application configuration:

- `PRODUCTION_SEED_DB_NAME` must exactly match `MONGODB_DB_NAME` for the additive
  canonical skill seed.
- `ADMIN_PROVISION_DB_NAME` must exactly match `MONGODB_DB_NAME`; admin email and
  password are supplied transiently through the secret environment.
- QA integrations require `--confirm-tasknexus-v2-staging` and only allow the
  staging database. Scale verification hardcodes `tasknexus_v2_performance` and
  requires `--confirm-phase11-synthetic-scale`.

## Tunables

MongoDB selection/connect default 10s, socket 45s, heartbeat 10s, pool up to 20.
HTTP body default 1 MiB; upload limit 10 MiB and five files. Access JWT default
15m, refresh 7d, cookie age 7d. Production SameSite defaults to `none`, Secure is
forced and HttpOnly always set. Request/provider rate limits, bounded SMTP
retries, and GitHub behavior are configurable using the documented example
files.

Production logs are structured JSON stdout at `LOG_LEVEL=info`. The application
fails before listening on unsafe origin, database, secrets, storage, proxy or
enabled SMTP settings and names variables without printing values. SMTP
availability is not probed during normal startup; use `npm run verify:email --
--connect` for an explicit connection/authentication check that sends no mail.
