# Monitoring and alerting runbook

External monitoring is required; `/health` and application logs alone are not a
monitor. `ops/monitoring-checks.example.json` is the provider-neutral source
template. Replace its placeholders only in the provider or deployment record, not
with guessed domains committed to source.

## Required external checks

| Monitor | Condition | Severity | Notify | Response |
| --- | --- | --- | --- | --- |
| Frontend availability | HTTPS `/` is not 200 for 2 consecutive 60-second checks | P0 if broad outage, otherwise P1 | Primary and backup operations channel | Validate DNS/TLS/Vercel revision, roll back if release-caused. |
| Backend liveness | HTTPS `/health` is not 200 twice | P0 | Primary and backup | Inspect Render process/restarts and last deploy; roll back or restart only after preserving evidence. |
| Backend readiness | HTTPS `/api/ready` is not 200 twice | P0 | Primary and backup | If liveness is healthy, inspect Atlas/access list/pool; keep traffic closed. |
| API 5xx | More than 2% for 5 minutes with at least 20 requests | P1; P0 if core paths unavailable | Primary | Correlate by request ID/route/status/latency; roll back if release-caused. |
| Atlas storage | Disk space at or above 80% warning, 90% critical | P1/P0 | Operations and database owner | Confirm growth, auto-expand policy and capacity; never delete data as first response. |
| Atlas connections | At or above 80% of configured limit for 5 minutes | P1 | Operations and database owner | Identify pools/deploys, contain leaks and scale only with approval. |
| GitHub provider | Repeated timeout/rate-limit/failure trend for 5 minutes | P2 | Operations | Leave evidence unverified, honor reset time, do not rotate through tokens. |
| Email provider | Repeated rejection/timeout/rate-limit trend for 5 minutes | P2; P1 for password-reset outage | Operations | Check Brevo status/configuration; reconcile idempotently from database/audit records. |
| Backup freshness | No successful snapshot inside approved policy | P0 | Database owner and backup owner | Freeze risky changes and restore backup coverage before continuing. |

## Ownership and acknowledgement

- P0: acknowledge within 10 minutes, establish incident lead and update interval.
- P1: acknowledge within 30 minutes and assign an owner.
- P2: acknowledge by the next staffed operations window.

The release record must name a primary and backup human plus the verified channel.
Placeholders are not ownership. No names or destination are currently evidenced,
so monitoring, alerting and on-call remain `BLOCKED`.

## Provider setup and proof

1. Choose one external uptime provider; do not run a monitor inside TaskNexus.
2. Create all three HTTPS checks exactly as the template describes. Monitor
   readiness separately because liveness can remain healthy during a database
   outage.
3. Add the verified critical destination and both responders. Configure TLS
   certificate-expiry monitoring if offered.
4. Trigger a controlled test alert against staging, acknowledge it, and restore
   the monitor. Do not interrupt production for the test.
5. Record provider, monitor IDs, staging URLs, creation time, delivery time,
   primary, backup and sanitized screenshot/export in the release record.

## Log diagnosis

Production stdout is structured JSON. Each completed request includes timestamp
from Winston, request ID, method, path without query parameters, status and
duration. Error responses include a safe error code and request ID. Never search
or export raw passwords, Authorization/Cookie headers, JWTs, MongoDB URIs,
provider keys or private application notes.
