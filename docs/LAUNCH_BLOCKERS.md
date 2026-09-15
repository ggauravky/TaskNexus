# Phase 11 launch blocker matrix

Assessment date: 2026-09-15. Starting commit: `91c989d`. Branch:
`codex/phase11-launch-stabilization`.

`PASS` means repository or live evidence exists. A configuration template or a
written procedure is not evidence that external infrastructure is enabled.

| Blocker | Current state | Required state | Owner | Evidence required | Status |
| --- | --- | --- | --- | --- | --- |
| Atlas backup / PITR | The connected Atlas tool cannot inspect the organization because organization-wide AI client access is disabled. Production cluster/tier is unverified. | Dedicated M10+ production cluster, Cloud Backup and Continuous Cloud Backup enabled, seven-day PIT window, approved retention and alert destination. | MongoDB Atlas Organization/Project Owner — **not assigned** | Atlas cluster, backup-policy and latest-snapshot screenshots/exports with secrets removed. | **BLOCKED** |
| Restore test | No production backup restore has been run. | Restore a snapshot/PIT into an isolated target, verify relationships/indexes, record RPO/RTO, then remove the target. | Database operator and independent reviewer — **not assigned** | Completed restore record defined in `BACKUP_RESTORE.md`. | **BLOCKED** |
| Attachment durability | Local disk was the only persistence option before Phase 11. | Private durable storage with validation, rollback and restart-safe retrieval. | Backend owner | GridFS code/tests plus `npm run verify:storage` reconnect/hash/delete evidence. | **PASS** |
| External monitoring | A provider-ready three-check template exists; no live monitor is evidenced. | External HTTPS checks for frontend, liveness and readiness at 60-second cadence. | Operations primary — **not assigned** | Provider monitor IDs/screenshots and a successful test-alert delivery. | **BLOCKED** |
| Alerting | Thresholds and response actions are documented; destinations are not configured. | Delivery for uptime, 5xx, Atlas capacity/connections, email and GitHub failures. | Operations primary/backup — **not assigned** | Alert configurations and test-delivery record. | **BLOCKED** |
| On-call ownership | No named primary or backup has been supplied. | Named primary, backup, channel and acknowledgement expectations accepted. | Product owner | Written acceptance in the release record. | **BLOCKED** |
| Privacy operations | Inventory, lifecycle, deactivation behavior and manual workflows exist. Contact and operator identities are not verified. | Named privacy operator/reviewer and verified user contact route. | Privacy operator/reviewer — **not assigned** | Test request completed without exposing another subject's data. | **BLOCKED** |
| Production-scale query checks | Synthetic, isolated performance database was populated and removed. | Representative indexed query/API results with no destructive production access. | Backend owner | `artifacts/phase11-scale-results.json`: 183,602 documents, 10 indexed queries, 6 endpoints, 0 API errors. | **PASS** |
| Deployed golden paths | Connected Render inspection found `tasknexus-942u.onrender.com` tracking `main`. Phase 10 merge commit `351b711…` built but failed startup because MongoDB/database/origin configuration was missing; Render retained live commit `6a6e77a…`. `/health` is 200 on that old build, `/api/ready` is 404, and the HTTP health-check path is unset. | HTTPS staging on intended frontend/backend/Atlas/GridFS topology; all paths, security, browser, email, storage and restart checks pass. | Release owner and QA owner — **not assigned** | Signed deployed QA record with URLs, build revisions, timestamps and sanitized captures. | **BLOCKED** |

## Exact unblock sequence

1. An Atlas Organization Owner enables AI client access for the organization.
   Then re-run read-only Atlas inspection; do not grant database write or backup
   mutation rights to the application identity.
2. Provision or identify the dedicated production cluster and configure the
   policy in `BACKUP_RESTORE.md`. Execute the isolated restore drill.
3. Supply the staging frontend and backend HTTPS URLs and the deployed commit.
   Configure the three external checks from
   `ops/monitoring-checks.example.json`, test delivery, and record monitor IDs.
4. Name the operations primary, backup, critical channel, privacy operator and
   privacy reviewer. Verify the public privacy contact.
5. Execute and sign the deployed QA checklist in `PRODUCTION_READINESS.md`.

Until all five steps have evidence, production readiness remains `NO`.
