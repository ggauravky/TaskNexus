# Production readiness

Assessment date: 2026-09-14. Code baseline: Phase 9 commit `0f924dd0811f` plus
Phase 10 hardening on `codex/phase10-production-hardening`.

## Decision

**Production ready: NO.** The application is materially hardened, but public
production launch is blocked until the external controls below are implemented
and evidenced. The safe next phase is **Option E — stabilization only**.

## Readiness matrix

| Area | Status | Evidence / remaining action |
| --- | --- | --- |
| Environment contract | Pass | Fail-fast validation, separate `APP_ENV`, exact origins, strong independent secrets. |
| Auth/session | Pass | Short access JWT, rotating refresh JWT, digest-at-rest, scoped HttpOnly/Secure cookie, origin/CSRF guard. |
| HTTP security | Pass | Helmet, CSP/HSTS/frame/MIME/referrer/permissions headers, 1 MiB body bound. |
| Abuse controls | Pass | Global and sensitive-route rate limits with proxy-aware IP and canonical 429 envelope. |
| MongoDB client | Pass | Bounded pool and selection/connect/socket timeouts, sanitized failures, graceful disconnect. |
| Schema/index declaration | Pass | 45-model registry and existing Atlas verifier; additive production index command. |
| Query scalability | Conditional | New feature list APIs are bounded; legacy dashboards still aggregate bounded-domain data in application memory and require load testing/aggregation before broad scale. |
| File durability | **Blocker** | Production local storage is rejected and attachments are disabled. Implement private durable object storage, authorization, deletion, and malware scanning. |
| Atlas resilience | **Blocker** | Dedicated production tier/project, backup/PITR, alerting, network rules, least privilege, and restore drill are not yet evidenced. |
| Realtime | Pass with constraint | MongoDB is truth; SSE is authenticated and closed gracefully but process-local by design. |
| Email/GitHub | Pass | Bounded provider timeouts/retries, GitHub redirect/host/rate/size controls, sanitized failure behavior. |
| Health/shutdown | Pass | Independent `/health`, dependency-aware `/api/ready`, idempotent bounded shutdown. |
| Observability | Conditional | Request IDs and sanitized JSON logs exist; external dashboards/on-call routing are not configured. |
| Frontend resilience/SEO | Pass | Error boundary, route loading states, private noindex rules, dynamic metadata, robots/security/LLM files. |
| CI/dependencies | Pass with review | CI uses lockfiles, lint/tests/build/production verifier and high-severity production audits. Hosting branch protection remains external. |
| Deployment validation | **Blocker** | No production Atlas target or production Vercel/Render golden-path smoke has been executed. |
| Privacy operations | Conditional | Data minimization and log sanitation improved; formal retention and verified delete/export process remain operational work. |

## Binary launch checklist

- [x] Runtime fails closed on missing/unsafe production configuration.
- [x] Staging database name is forbidden in production.
- [x] Secrets are excluded from tracked environment files.
- [x] Refresh tokens are rotated and stored only as digests.
- [x] Cross-origin credential policy is exact and CSRF-aware.
- [x] Security headers, request bounds, and rate limits are enabled.
- [x] Liveness and readiness are separate.
- [x] Graceful shutdown closes HTTP, SSE, and MongoDB.
- [x] QA mutation scripts refuse production and require staging confirmation.
- [x] One command runs the application and production-control verification.
- [ ] Dedicated production Atlas project/cluster/user/database created.
- [ ] Cloud Backup + PITR configured and a restore drill meets RPO/RTO.
- [ ] Atlas network access, least privilege, and alert contacts reviewed by two people.
- [ ] Durable private attachment storage implemented and tested, or product explicitly launches without attachments with user-facing disclosure.
- [ ] Render/Vercel production variables entered and independently reviewed.
- [ ] Production index creation and representative query-plan/load checks completed.
- [ ] External log/error dashboards and on-call alerts configured.
- [ ] Privacy retention, export, and deletion process approved.
- [ ] Four golden paths and cross-role denial suite pass in the production topology.
- [ ] Rollback rehearsal and release owner sign-off completed.

## Promotion rule

All unchecked items are mandatory for a public launch. A tightly controlled
private beta may begin only after Atlas backup/restore, least privilege, production
deployment smoke, monitoring, and explicit attachment limitation are complete.
Until then, remain in stabilization and keep staging fixtures isolated.
