# Production readiness

Assessment date: 2026-09-15. Starting baseline: Phase 10 commit `91c989d`.

## Decision

Ready for production deployment:
NO

Repository blockers for durable storage, privacy/session behavior and synthetic
scale verification are resolved. External Atlas recovery, monitoring/ownership
and deployed staging evidence are still missing. A template or local pass cannot
substitute for those controls.

## Launch checklist

| Item | Status | Evidence / required action |
| --- | --- | --- |
| Phase 10 baseline | PASS | Clean `91c989d`; existing regression and all domain integration verifiers passed before Phase 11. |
| Production environment contract | PASS | Rejects staging DB name, weak/equal JWT secrets, non-HTTPS origin and non-GridFS storage. |
| Authentication/session deactivation | PASS | Inactive users are denied login/auth/refresh; suspension clears stored refresh digest. |
| HTTP/access controls | PASS | Exact origins, trusted-origin guard, headers, rate limits and contextual authorization. |
| Request observability | PASS | Request ID, timestamp, query-free route, status, latency and safe errors. |
| Durable private attachments | PASS | GridFS, API authorization, bounded parsing, content validation, opaque keys and rollback. |
| Storage persistence | PASS | Atlas staging upload, reconnect, hash retrieval and delete passed via `verify:storage`. |
| Synthetic launch-scale checks | PASS | 183,602 documents; 10 indexed queries; 6 APIs with 0 error rate; isolated DB removed. |
| N+1 review | PASS | High-value list decoration uses bounded bulk queries/aggregations, not per-row awaits. |
| QA production fences | PASS | Phase 2–10 fixtures plus storage/scale scripts refuse production and require confirmation. |
| Production skills/admin bootstrap | PASS | Additive skill seed and non-public, confirmed, database-bound, audited admin CLI. Not executed in production. |
| Privacy inventory/runbook | PASS | `PRIVACY_OPERATIONS.md`; no automated export/delete overbuilt. |
| Privacy owner/contact/dry run | BLOCKED | Name operator/reviewer, verify contact and complete a synthetic dry run. |
| Production Atlas tier/region/replica set | BLOCKED | Atlas tool access is organization-disabled; inspect/provision M10+ target. |
| Cloud Backup + PITR | BLOCKED | Enable and capture policy/latest snapshot evidence. |
| Isolated restore drill | BLOCKED | Execute and complete every field in `BACKUP_RESTORE.md`. |
| Atlas user/access list/alerts | BLOCKED | Read-only inspection and independent review required. |
| External monitors | BLOCKED | Instantiate three checks from the template and test delivery. |
| Alert destinations/on-call | BLOCKED | Name primary, backup and verified critical channel. |
| Production-equivalent staging deployment | BLOCKED | Actual Render service is on old live commit `6a6e77a…`; Phase 10 commit `351b711…` built but failed startup due missing MongoDB/database/origin configuration. Configure a distinct staging runtime and deploy an identifiable Phase 11 revision. |
| HTTPS, CORS, cookies, SPA refresh | BLOCKED | Verify on deployed staging. |
| Collaboration golden path | BLOCKED | Run over deployed HTTP/TLS/browser paths. |
| Hackathon golden path | BLOCKED | Run on deployed staging. |
| External-career golden path | BLOCKED | Run on deployed staging. |
| Native-career golden path | BLOCKED | Run on deployed staging. |
| Cross-role deployed denials | BLOCKED | Run on deployed staging. |
| Responsive 320/375/390/430/768/1024/1440 | BLOCKED | Run on deployed staging. |
| Accessibility/console/network | BLOCKED | Record production-build browser evidence. |
| Email staging QA | BLOCKED | Requires safe recipient/provider sandbox and deployed environment. |
| Storage host restart/resilience | BLOCKED | Reconnect passed; actual deployed host restart is required. |
| Production dependency audits | PASS | Backend and frontend report zero vulnerabilities after Phase 11 changes. |
| Tracked-source secret scan | PASS | Repository scanner passed 355 tracked/unignored files without echoing values. |
| Final local/Atlas staging integration rerun | PASS | Database/model, API, Teams, Projects, Phase 5, GitHub, discovery, hackathon, opportunity, organization and GridFS storage verifiers pass. |
| Deployed acceptance rerun | BLOCKED | Re-run the browser/TLS/golden-path matrix after production-equivalent staging is supplied. |

## Promotion rule

Every `BLOCKED` row is mandatory. Do not deploy the production domain or seed
production data merely to complete this checklist. After external evidence,
re-run `npm run verify:launch`, both production dependency audits and the deployed
matrix; then update the decision and obtain release-owner sign-off.
