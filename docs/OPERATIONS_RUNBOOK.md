# Operations runbook

## Service indicators and alerts

Monitor Render request error rate, p95 latency, restarts, memory, CPU, and
`/api/ready`; Atlas connections, pool pressure, query targeting, replication lag,
storage, backup age, and cluster alerts; Vercel deployment failures and frontend
error telemetry; Brevo rejection/rate-limit trends; and GitHub verification
failure/rate-limit trends. Alert on-call for readiness failure over 2 minutes,
5xx over 2% for 5 minutes, repeated restarts, Atlas critical alerts, backup age
beyond policy, or golden-path failure.

The application emits JSON stdout logs in production. Search by `requestId` and
never paste raw cookies, bearer tokens, environment values, email payloads, or
MongoDB URIs into an incident record.

## Triage order

1. Confirm user impact and current deploy revisions.
2. Check `/health`. If it fails, investigate the process/platform. If it passes
   while `/api/ready` fails, investigate Atlas connectivity and pool health.
3. Correlate sanitized logs by request ID and route, then check Atlas and provider
   status pages. Do not increase timeouts or retry counts before identifying cause.
4. Disable affected traffic or roll back. Preserve audit records.
5. Communicate scope, mitigation, and next update; complete a post-incident review.

## Common incidents

### Database unavailable

Keep traffic closed while readiness is 503. Verify Atlas cluster state, access
list, application user, DNS, connection limit, and secret rotation history. Never
log the URI. If corruption/deletion is suspected, follow `BACKUP_RESTORE.md`.

### Authentication or cookie failures

Compare `APP_ORIGIN`, `ALLOWED_ORIGINS`, `VITE_API_URL`, SameSite, Secure, and
browser Origin. Test login, one refresh after access expiry, rotation/replay
rejection, and logout. Do not relax CORS to `*` or disable trusted-origin checks.

### Email outage

Core database writes may succeed while asynchronous notifications fail. Inspect
sanitized timeout/rate-limit signals and Brevo status. Required startup mode checks
configuration, not provider reachability. Avoid blind bulk replay; reconcile from
audit/application records and send idempotently.

### GitHub outage or rate limit

Evidence remains unverified; it must not be marked verified on provider failure.
Honor provider reset time, do not rotate through credentials, and retry only after
recovery. The fixed provider origin, redirect denial, timeout, and size cap stay on.

### SSE disconnects

SSE is process-local and disposable. Deploys and scaling close streams; clients
must reconnect and refetch MongoDB-backed notifications. A stream interruption is
not data loss. Persistent SSE failures with healthy polling are degraded service,
not a reason to duplicate events in memory.

### Attachment request in production

The API intentionally returns 503 for file attachments while durable storage is
absent. Text-only comments remain supported. Do not switch to `local` on Render;
that would create silently lossy files.

## Routine operations

- Daily: review alerts, failed deploys, 5xx trend, and provider failures.
- Weekly: verify latest backup and PIT window, dependency alerts, dormant admins,
  Atlas users/access list, and error-log samples for accidental PII.
- Monthly: restore drill, golden paths, accessibility/mobile sample, account-role
  review, capacity review, and stale data/retention review.
- Before every release: CI green, production checklist reviewed, migrations/index
  changes approved, rollback target known, and smoke-test owner assigned.

## Data/privacy requests

Authenticate the requester and document scope. Export only the subject's records.
Deletion must preserve legally/operationally required financial and audit records
under an approved retention policy while anonymizing removable profile/contact
data. There is no automated end-user delete workflow yet; production launch must
assign an operator and reviewer for manual requests.
