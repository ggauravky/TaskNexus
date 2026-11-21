# TaskNexus V2 — G1 release candidate

**Code verification PASS. G1 release gate BLOCKED.** The verified GitHub `main` SHA contains the Multer fix. The current review found zero unresolved code-side P0/P1 findings. Credential revocation, recoverability, live revision provenance and other external gate evidence remain open. Reverified on 2026-11-21 (Asia/Calcutta).

## Release manifest

| Item | Evidence |
| --- | --- |
| Candidate | `main` at `1290d725b8f5a66402e3502b2712ec139afe9ac6` (`Upgrade Multer and harden comment uploads`), committed 2026-11-21 18:29:49 +05:30. Local `HEAD`, `origin/main` and GitHub agreed. |
| Local release-control changes | Both workflow definitions now request Node `24.22.3` and unique check names. The G1/G2, deployment guide and README updates are local. The verified application SHA and package engine ranges are unchanged by this work. |
| Version | TaskNexus V2, backend and frontend package versions `1.0.0`. The SHA uniquely identifies this candidate. No local or remote release tag was found. |
| Repository baseline | Clean before this reverification. Direct parent `0605551d57e4d7178190b684da4fc04331d1de27` contains Phase F. Its parent `d3a94e7619d9f1752e520426bfffa4c3489dc0d1` contains the Phase E proof fixes. |
| Current/previous deployed revisions | Frontend **UNKNOWN** and backend **UNKNOWN**. GitHub refs and historical host reports cannot establish the current production pair or last known-good deployments. A true diff since the deployed version is pending those SHAs. |
| Candidate delta against its parent | Six committed files, 300 insertions, 103 deletions. Backend manifest, lockfile, and comment upload middleware contain the Multer remediation. Workspace upload regressions and the original G1/G2 reports account for the remaining paths. |
| Contract/config delta against its parent | One flat multipart text field and the existing attachment limits. No route files, frontend source, auth contracts, schema, indexes, deployment configuration, attachment IDs, or snapshot format changes. Phase F's versioned submission and public roster behavior was already present in the parent. |

The repository implements a React/Vite/Tailwind/React Router/Axios frontend and a Node/Express API backed by Mongoose/MongoDB. The API owns JWT sessions, contextual permissions, private GridFS attachments and SSE. Calls to transactional email use Brevo SMTP through Nodemailer. A separate optional Brevo Contacts client serves newsletter functionality. Marketplace approval and dispute paths update an internal ledger.

GitHub run metadata and jobs confirmed `CI` and `verify` completed successfully on a `push` of this SHA to `main`. Both jobs published the check name `verify`. The workflows at that SHA use Node 20.19.0. GitHub also reports `Vercel: success`. That result leaves the live frontend and backend revisions **UNKNOWN**. GitHub reports `main.protected=false` and no applicable rules. [CI run](https://github.com/ggauravky/TaskNexus/actions/runs/44906618010) · [Verify run](https://github.com/ggauravky/TaskNexus/actions/runs/44906618060) · [Commit status](https://api.github.com/repos/ggauravky/TaskNexus/commits/1290d725b8f5a66402e3502b2712ec139afe9ac6/status) · [Main branch](https://api.github.com/repos/ggauravky/TaskNexus/branches/main)

## Phase F evidence assessment

| Phase | Assessment | Basis |
| --- | --- | --- |
| F1 | **COMPLETED** | The candidate contains the architecture audit, prioritized findings and local baseline. Findings trace to the pre-F code and the changed controllers/adapters. |
| F2 | **COMPLETED for its original code scope** | Refresh digest CAS, roster filtering, transactional review/dispute writes, revision versioning and the original dependency patches are in the candidate. The later G1 Multer finding is resolved in `1290d72`. |
| F3 | **COMPLETED** | The projected dashboard queries, grouped totals, focused parity tests and guarded benchmark are committed. The Phase F record measured 10,000-task p95 of 1,380 → 455 ms for clients and 3,181 → 425 ms for freelancers. These are historical loopback measurements. Dashboard work still grows with owner history. |
| F4 | **PARTIALLY COMPLETED overall · repository controls completed** | The candidate includes frontend tests in the launch gate, CI audit checks, and operational runbooks. Hosted credential, recovery, alerting, smoke and rollback evidence is still pending. |

Evidence: [F1 audit](PHASE_F1_AUDIT.md), [F2 remediation](PHASE_F2_REMEDIATION.md), [F3 measurements](PHASE_F3_PERFORMANCE.md), [F4 operations record](PHASE_F4_RELEASE_READINESS.md).

## Security and privacy gate

| Control | Classification and evidence |
| --- | --- |
| Authentication and refresh | **PASS locally.** `authController`, `middleware/auth.js` and `config/jwt.js` implement bcrypt authentication, separate access/refresh keys and token types, active-account checks, one persisted refresh digest and atomic digest rotation. Concurrent refresh, stale cookies and revoked sessions have regression coverage. |
| Session invalidation | **PASS for local refresh/logout and inactive-account behavior.** Logout invalidates the stored refresh digest. An already issued access token remains valid until expiry for an active user. Historical key rotation and deployed invalidation are **BLOCKED** pending receipts. |
| Password reset and account email verification | **ABSENT · P2 product gap.** Public account authentication works with the supplied password and permits an unverified mailbox. There is no shipped reset or ownership challenge flow. See the product decision below. |
| CSRF, CORS, CSP | **PASS locally for repository contracts.** Cookie auth mutations require an exact trusted browser origin in production. CORS is credentialed with an explicit allowlist. Refresh cookies use HttpOnly, Secure in production, and the configured SameSite setting. The Vercel CSP and JSON-LD hashes were checked by the build validator. Hosted cross-origin cookies and headers remain **NOT VERIFIED**. |
| Marketplace task and attachment access | **PASS locally.** Task relationship checks precede multipart parsing. Attachment reads require task access and validated references. An authorized multipart upload and private GridFS retrieval passed through the real routes. |
| Team, Project and organization/recruiter RBAC | **PASS locally** for contextual membership, scope changes, and cross-organization denial. Application reads and stage changes are scoped to candidate or permitted organization membership. |
| Public showcase, contribution and application proof | **PASS locally** for publication, explicit opt-in, private evidence filtering, candidate selection, immutable snapshots and applicant isolation. |
| Notification and search privacy | **PASS locally** for recipient isolation, permitted deep links, search role scoping and private-object exclusion. SSE remains process-local. |
| Rate limits and sensitive logging | **PASS for covered local contracts.** Proxy-bound limiters and redacted structured logging are configured. Live proxy depth, aggregate enforcement, log access, retention and error payloads remain **NOT VERIFIED**. |
| Dependencies | **PASS for the verified SHA.** Confirmed the committed Multer version in the manifest, lock and installed production tree and cross-checked the affected ranges from the original finding. See G-SEC-001. |

### G-SEC-001 · historical P1 · resolved in `1290d72`

The old baseline `0605551` declared Multer directly and locked `1.4.5-lts.2`. The original npm audit was clean even though upstream advisories covered the version used by the marketplace comment parser. This is historical source and advisory evidence. [Maintainer advisory GHSA-4pg4-qvpc-4q3h](https://github.com/expressjs/multer/security/advisories/GHSA-4pg4-qvpc-4q3h) · [Maintainer advisory GHSA-wc9g-mqfw-jrwm](https://github.com/expressjs/multer/security/advisories/GHSA-wc9g-mqfw-jrwm) · [Maintainer advisory GHSA-535w-7cp7-47q4](https://github.com/expressjs/multer/security/advisories/GHSA-535w-7cp7-47q4)

`1290d72` pins and locks Multer `2.5.0`. The task-comment parser permits one flat text field with no nesting or indexed fields and retains the existing file size, count, and type limits. Authentication and task authorization run before parsing. The endpoint, GridFS configuration, and attachment references are stable. Fresh `npm ls multer --omit=dev` confirms the installed production tree resolves `2.5.0`. [Upstream release notes](https://github.com/expressjs/multer/releases/tag/v2.5.0) · [Upstream upload limits](https://github.com/expressjs/multer#limits)

The original red/green record rejected nested and extra fields after the patch. The fresh full regression includes six multipart route cases covering five-file success, rejection of a sixth file, unsupported text field shapes, content signatures, and authorization before parsing. A new loopback check lowered the fixture file limit to 128 bytes and received `413` for an oversized PDF before any comment persisted. A subsequent valid multipart comment reached GridFS and downloaded byte-for-byte with private cache and attachment headers. Anonymous and unrelated actors received `401` and `403` for upload and download.

### Password reset and mailbox ownership

The backend auth router, frontend routes, controllers, and tests establish registration, password login, refresh, logout, and current-user behavior. The database has a false-by-default verification flag and reserved reset fields. The actual auth email templates are welcome and returning-login notices. They provide neither recovery nor ownership confirmation. Fresh loopback registration and login succeeded while the mailbox flag remained false.

A user who forgets their password cannot regain access through self-service, and no documented admin recovery route was found. An account can claim an unconfirmed address, which carries mistyped-address, impersonation and unintended-mail risks. Treat this as a **P2 product gap for the current update**. The approved existing workflows use password authentication with role and ownership checks, and the current release documents contain no mailbox ownership or recovery dependency. Reassess this gate before introducing a feature that relies on verified mail or making new recovery commitments.

If separately approved, propose two bounded flows using the existing auth and email systems. Use expiring, single-use, hashed tokens and generic responses with rate limits. Reset should revoke stored refresh sessions and define access-token expiry handling. Mailbox confirmation needs a staged policy for legacy accounts. Cover replay, expiry, cross-account isolation, enumeration resistance, session invalidation and a staging-only delivery drill.

### Credentials

**SECURITY RELEASE BLOCKER — MANUAL ACTION.** There is no current sanitized evidence that the historically shared MongoDB and Brevo SMTP credentials or the JWT access and refresh signing secrets were rotated and rejected after revocation. Require a dated operator and reviewer receipt for all four, plus the sign-in transition and a review of access, SMTP and authentication logs. The phase used synthetic test keys. The source scan excludes ignored environment files and cannot prove revocation.

## Database and API compatibility

- **Parent to candidate** requires no schema migration and introduces no index declarations. Review/dispute/resubmission now require a transaction-capable MongoDB deployment. Confirm required collections, unique submission version index and active-submission lookup index, the one-active-submission invariant, application snapshot compatibility, and GridFS metadata plus bucket collections on an authorized restored sample. Production disables Mongoose automatic index creation. Existing missing indexes would require independently approved additive remediation.
- Fresh local fixtures exercise transaction rollback, competing writes, immutable snapshots, version append, and GridFS reconnect. Historical overwritten submission versions cannot be reconstructed by the new code. Existing duplicate/terminal ledger records are blocked for reconciliation. Audit an approved representative data copy for ambiguous legacy ledger rows, pre-existing missing indexes, historical submissions and legacy malformed values. Any repair requires a distinct decision. Preserve application history and GridFS file IDs.
- The direct parent and candidate share authentication routes, cookie contracts, notification links, attachment references and frontend source. The new multipart limits fit the existing UI. Phase F already changed the active submission ID on revision, and the frontend refetches it. Test backend-first against the actual previous live pairing in hosted staging. If the live pair predates Phase F or has different schema/config contracts, re-audit the full diff before choosing rollout order.

## Fresh verification

The full rerun used isolated Git archives of the exact committed SHA with fresh dependency trees and no ignored environment files. MongoDB 8.0.16 integration used loopback, explicit test modes, safety flags, unique fixture databases, and disabled email. Host metadata lookups were read-only and inconclusive. No production functional checks were performed.

| Check | Result |
| --- | --- |
| Reproducible install and native bcrypt | **PASS** for backend and frontend `npm ci` on Windows Node `24.22.1` and Linux x64 Node `24.22.3`. Bcrypt hash/compare passed on both. Linux loaded the packaged `bcrypt.glibc.node` addon. The clean install exercised the package's native installation path. No source rebuild was required. Existing deprecation and npm install-script warnings did not prevent verification. |
| Full `npm run verify:launch` | **PASS on both local Node 24 environments.** Each run passed 49 backend Jest suites and 391 tests, 50 frontend tests, both linters, Vite production build and frontend configuration validation, seven backend production checks, and four launch checks. Regressions cover auth, role/IDOR, workspace, notifications, search, onboarding, profiles, teams/projects, proof/privacy, opportunities, organizations, applications, and storage. |
| Local workflow changes | Both manifests for GitHub Actions pin Node `24.22.3` and give the jobs distinct names. `actionlint` 1.7.12 passed for both. GitHub Actions on the local workflow changes is pending a separately authorized PR. |
| Dependency gates | **PASS locally.** Four npm audits reported zero across backend/frontend and full/production-only modes. Production `npm ls` resolves Multer `2.5.0`, which addresses the cited upstream advisories. The only direct dependency change is Multer. |
| MongoDB and API | **PASS.** `verify:mongodb-integration`, `verify:database` (45 collections including declared model indexes), and the API integration script against an explicitly started loopback API. Warmed small-fixture search p95 was 84.2 ms across 20 requests during concurrent local verification. |
| Domain and file verifiers | **PASS.** `verify:teams`, `verify:projects`, `verify:phase5`, `verify:discovery`, `verify:hackathons`, `verify:opportunities`, `verify:organizations`, `verify:phase-e`, `verify:phase-f2` and `verify:storage`. Covered role and IDOR boundaries, snapshots, transaction and race behavior, GridFS reconnect/hash and exact fixture cleanup. |
| Health and email | Loopback HTTP returned liveness `200`, readiness `503 → 200 → 503`, and `Cache-Control: no-store`. `verify:email` passed the configuration and template contract without SMTP or delivery. |
| Browser | **PASS for covered flows.** Phase C search/privacy, Phase D role-aware onboarding, and Phase E proof/application Chromium fixtures at 320, 375, 390, 430, 768, 1024 and 1440 px. The fixtures checked keyboard/focus, role/privacy boundaries, and applicable console/network behavior. |
| Secret scan and whitespace | **PASS.** Both isolated launch runs and the final workspace scan covered 471 repository files. Git whitespace checks passed. |

The launch gate checks the historical scale artifact's contract. The destructive legacy scale runner was excluded. Phase F benchmark measurements are cited as historical.

## Local release journeys

| Persona | Decision and evidence |
| --- | --- |
| Client | **PASS (local HTTP).** Registered, signed in, opened profile, created task, tracked assignment/progress, requested revision, and approved the revised delivery. |
| Freelancer | **PASS (local HTTP).** Registered, signed in, updated professional profile and skills, found the moderated task, accepted, started, updated progress, delivered, resubmitted and completed. Separate Phase D browser coverage verified onboarding. |
| Team/Project | **PASS (local integration).** Created Team, invited and joined, created Project, assigned and completed work, verified evidence and published a showcase. Tested private membership/evidence boundaries. |
| Candidate | **PASS (local integration and browser).** Profile/skills overlap, proof, explicit evidence selection, application and tracking/immutable snapshot. Cross-candidate and cross-organization denial passed. |
| Recruiter | **PASS (local integration).** Contextual organization access, opportunity publishing, permitted application review and stage changes. Cross-organization and race tests passed. |
| Admin | **PASS (local HTTP).** Authorized dashboard, users, tasks, synthetic dispute resolution and audits. Client attempts to read admin audit logs were denied. Internal ledger only. |

The marketplace and admin evidence includes a fresh disposable HTTP walkthrough of the committed candidate and its actual multipart and private download routes, alongside the F2 verifier. Hosted role walkthroughs remain unverified. Mailbox verification and recovery are separate from the specified registration-to-login journeys.

## Release blockers

| ID | Scope | Status and evidence needed |
| --- | --- | --- |
| G-SEC-001 | Code · historical P1 | **RESOLVED in `1290d72`.** Patched lock, parser authorization, limits and GridFS verified. |
| G-EXT-001 | Credentials | **BLOCKED.** Rotation, old-value rejection, access review and JWT reauthentication receipt. |
| G-EXT-002 | Hosting, CI and data compatibility | **BLOCKED.** GitHub reports unprotected `main` and no applicable rules. Need hosted hold/approval evidence, runtime confirmation, actual deployment IDs and approved existing-data/index/topology compatibility. Vercel read-only returned `403`. Render workspace access could not be confirmed. |
| G-EXT-003 | Recoverability | **BLOCKED.** Backup/PITR policy, recent snapshot and measured isolated restore including GridFS. |
| G-EXT-004 | Monitoring and incident ownership | **BLOCKED.** Named owners, staging test-alert receipt, incident and privacy escalation, and release acceptance thresholds. |
| G-EXT-005 | Hosted smoke and rollback | **BLOCKED.** Verified staging transition, known-good paired artifacts, rollback rehearsal and approved live smoke scope. |

Confirmed unresolved counts for `1290d72`: **0 P0 and 0 P1**. External release blocker groups: **5**. The remaining P2 items are owner-history dashboard growth, process-local SSE and fallback behavior, the legacy scale runner, and the account recovery/mailbox follow-up. G1 stays blocked on external evidence. See the [G2 deployment plan](PHASE_G2_DEPLOYMENT_PLAN.md).
