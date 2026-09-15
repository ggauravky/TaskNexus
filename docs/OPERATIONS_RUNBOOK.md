# Operations runbook

The named primary, backup and alert channel are launch requirements and are not
yet supplied. Severity and thresholds are defined in `MONITORING_RUNBOOK.md`.

## Triage

1. Confirm user impact, deployed frontend/backend revisions and current time.
2. Check `/health`; if it fails, investigate the process/platform. If it is 200
   while `/api/ready` is 503, investigate MongoDB connectivity.
3. Correlate structured logs by request ID, route, status and duration. Never put
   cookies, bearer tokens, environment values, emails, MongoDB URIs or application
   snapshot/private-note contents in an incident record.
4. Contain impact or roll back, preserve evidence, communicate the next update,
   and assign follow-up actions.

## Service down

Check Render status, process restarts, memory/CPU and last release. Confirm
liveness and startup validation. Roll back to the last known-good backend
revision if release-caused; do not bypass readiness to force traffic.

## Database down

Keep traffic closed while readiness is 503. Inspect Atlas cluster state, access
list, database user, DNS and connection utilization. Do not log the URI. If data
loss/corruption is suspected, freeze writes and follow `BACKUP_RESTORE.md`.

## High 5xx

Group by safe error code, route and release revision. Inspect dependencies and
slow-query evidence. Do not globally increase timeouts/retries before cause is
known. Roll back if the release is causal and verify golden paths afterward.

## Storage failure

Attachments use private MongoDB GridFS. Confirm readiness and Atlas capacity,
then inspect the configured bucket's `.files` and `.chunks` health without
exposing content. Comment creation rolls back files uploaded before a failed
comment write. Never switch production to `local`; startup rejects it. Restore an
unavailable stored file from the same Atlas backup as its comment metadata.

## Email failure

Core database writes may succeed while asynchronous email fails. Inspect
sanitized timeout/rate-limit logs and Brevo status. Do not bulk replay blindly;
reconcile from database/audit records and send idempotently to approved targets.

## GitHub failure or exhaustion

Provider failure leaves evidence unverified. Honor reset time, keep the fixed
origin/redirect denial/timeout/size bounds, and do not rotate through credentials
to evade limits.

## Credential rotation

- MongoDB: create a new least-privilege user, update the host secret, verify
  readiness and one read/write path, then revoke the old user.
- JWT: schedule forced sign-in, replace both independent secrets, redeploy and
  verify login/refresh/logout.
- Brevo/GitHub: create minimum-scope credential, update the host secret, verify a
  safe staging call, then revoke the old credential.
- GridFS has no separate credential; it uses MongoDB and a bucket namespace. A
  future provider must use create-test-revoke sequencing.

Never reveal old/new values in commands, logs, screenshots or tickets.

## Deployment rollback

Redeploy the last known-good Vercel and Render revisions. Do not remove indexes as
part of application rollback. If data compatibility changed, stop writes and use
the restore procedure; never improvise an in-place destructive restore.

## Routine checks

- Daily: alerts, failed deploys, 5xx and provider failure trends.
- Weekly: backup/PIT window, access list/users, capacity, dormant admins,
  dependency alerts and log-redaction samples.
- Monthly: isolated restore drill, deployed golden paths, browser/accessibility
  matrix, role review, privacy retention review and credential inventory.
- Release: `npm run verify:launch`, audits, rollback target, smoke owner and
  readiness checklist.
