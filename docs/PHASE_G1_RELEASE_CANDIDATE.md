# TaskNexus V2 — G1 release candidate

**Decision: BLOCKED.** The Multer P1 is fixed and verified in the local working tree. The frozen SHA still contains Multer 1.x. A replacement release SHA has not been created. Credential revocation, recoverability, live revision provenance and other external release controls still lack current evidence. This document covers the original candidate and its local remediation on 2026-11-21 (Asia/Calcutta).

## Release manifest

| Item | Evidence |
| --- | --- |
| Candidate | `main` at `0605551d57e4d7178190b684da4fc04331d1de27` (`Complete Phase F remediation`), committed 2026-11-21 04:05:28 +05:30. Local `origin/main` and a read-only `git ls-remote` agreed at inspection time. |
| Tested local remediation | The frozen SHA plus unstaged changes to `backend/package.json`, `backend/package-lock.json`, `backend/src/middleware/upload.js` and `backend/tests/taskWorkspace.test.js`. No replacement commit or tag exists. G2 remains the planning record for the original SHA. |
| Version | TaskNexus V2, backend and frontend package versions `1.0.0`. The SHA uniquely identifies this candidate. No local or remote release tag was found. |
| Repository baseline | Clean before the audit, with no staged, unstaged, or untracked work. Direct parent `d3a94e7619d9f1752e520426bfffa4c3489dc0d1` contains the Phase E proof fixes. |
| Current/previous deployed revisions | Frontend **UNKNOWN** and backend **UNKNOWN**. GitHub refs and historical host reports cannot establish the current production pair or last known-good deployments. A true diff since the deployed version is pending those SHAs. |
| Candidate delta against its parent | 34 files, 1,253 insertions and 540 deletions. Backend changes include refresh CAS, public roster privacy, transactional reviews/disputes/revisions, dashboard reads and supply-chain updates. Frontend changes affect the test script and dependency lock, with no `frontend/src` changes. CI/test scripts and Phase F documentation account for the rest. `git diff --stat 0605551^ 0605551` enumerates all paths. |
| Contract/config delta against its parent | No route files, shared domain contracts, model definitions, index declarations, Render Blueprint, or Vercel header config changed. The resubmission operation creates a new active submission ID. Its clients already reload the active submission. The public roster no longer returns ineligible rows. |

The repository implements a React/Vite/Tailwind/React Router/Axios frontend and a Node/Express API backed by Mongoose/MongoDB. The API owns JWT sessions, contextual permissions, private GridFS attachments and SSE. Calls to transactional email use Brevo SMTP through Nodemailer. A separate optional Brevo Contacts client serves newsletter functionality. Marketplace approval and dispute paths update an internal ledger.

## Phase F evidence assessment

| Phase | Assessment | Basis |
| --- | --- | --- |
| F1 | **COMPLETED** | The candidate contains the architecture audit, prioritized findings and local baseline. Findings trace to the pre-F code and the changed controllers/adapters. |
| F2 | **COMPLETED for its original code scope** | Refresh digest CAS, roster filtering, transactional review/dispute writes, revision versioning and the original dependency patches are in the candidate. Unit and integration entry points exist and the results below are from a fresh run. G1 independently identified an additional affected runtime package. |
| F3 | **COMPLETED** | The projected dashboard queries, grouped totals, focused parity tests and guarded benchmark are committed. The Phase F record measured 10,000-task p95 of 1,380 → 455 ms for clients and 3,181 → 425 ms for freelancers. These are historical loopback measurements. Dashboard work still grows with owner history. |
| F4 | **PARTIALLY COMPLETED overall · repository controls completed** | The candidate includes frontend tests in the launch gate, CI audit checks, and operational runbooks. Hosted credential, recovery, alerting, smoke and rollback evidence is still pending. |

Evidence: [F1 audit](PHASE_F1_AUDIT.md), [F2 remediation](PHASE_F2_REMEDIATION.md), [F3 measurements](PHASE_F3_PERFORMANCE.md), [F4 operations record](PHASE_F4_RELEASE_READINESS.md).

## Security and privacy gate

| Control | Classification and evidence |
| --- | --- |
| Authentication and refresh | **PASS locally.** `authController`, `middleware/auth.js` and `config/jwt.js` implement bcrypt authentication, separate access/refresh keys and token types, active-account checks, one persisted refresh digest and atomic digest rotation. Concurrent refresh, stale cookies and revoked sessions have regression coverage. |
| Session invalidation | **PASS for local refresh/logout and inactive-account behavior.** Logout invalidates the stored refresh digest. An already issued access token remains valid until expiry for an active user. Historical key rotation and deployed invalidation are **BLOCKED** pending receipts. |
| Password reset and account email verification | **NOT VERIFIED as product flows.** Auth and frontend route inventories do not expose either flow. Email templates and model fields are present. Release owner must confirm whether recovery or verification is a launch requirement. |
| CSRF, CORS, CSP | **PASS locally for repository contracts.** Cookie auth mutations require an exact trusted browser origin in production. CORS is credentialed with an explicit allowlist. Refresh cookies use HttpOnly, Secure in production, and the configured SameSite setting. The Vercel CSP and JSON-LD hashes were checked by the build validator. Hosted cross-origin cookies and headers remain **NOT VERIFIED**. |
| Marketplace task and attachment access | **PASS locally.** Task relationship checks precede multipart parsing. Attachment reads require task access and validated references. An authorized multipart upload and private GridFS retrieval passed through the real routes. |
| Team, Project and organization/recruiter RBAC | **PASS locally** for contextual membership, scope changes, and cross-organization denial. Application reads and stage changes are scoped to candidate or permitted organization membership. |
| Public showcase, contribution and application proof | **PASS locally** for publication, explicit opt-in, private evidence filtering, candidate selection, immutable snapshots and applicant isolation. |
| Notification and search privacy | **PASS locally** for recipient isolation, permitted deep links, search role scoping and private-object exclusion. SSE remains process-local. |
| Rate limits and sensitive logging | **PASS for covered local contracts.** Proxy-bound limiters and redacted structured logging are configured. Live proxy depth, aggregate enforcement, log access, retention and error payloads remain **NOT VERIFIED**. |
| Dependencies | **PASS for the local remediation.** The original frozen SHA still fails. The patch was checked against both the npm advisory feed and the upstream Multer release and advisories. See G-SEC-001. |

### G-SEC-001 · P1 · resolved in the working tree

The frozen SHA declared Multer directly and locked `1.4.5-lts.2`. `backend/src/routes/task.routes.js` passes authorized marketplace comment uploads through `backend/src/middleware/upload.js`. Task authorization narrows access to the parser, while authenticated task users still control their multipart input. The maintainer documents high-severity availability failures covering the original version. The finding was based on the lock, route, and primary advisories. No exploit or live reproduction was performed. [Maintainer advisory GHSA-4pg4-qvpc-4q3h](https://github.com/expressjs/multer/security/advisories/GHSA-4pg4-qvpc-4q3h) · [Maintainer advisory GHSA-wc9g-mqfw-jrwm](https://github.com/expressjs/multer/security/advisories/GHSA-wc9g-mqfw-jrwm) · [Maintainer advisory GHSA-535w-7cp7-47q4](https://github.com/expressjs/multer/security/advisories/GHSA-535w-7cp7-47q4)

The working tree pins and locks Multer `2.5.0`. The task-comment parser now permits one flat text field with no nesting or indexed fields and retains the existing file size, count, and type limits. The existing authentication and task authorization run before parsing. The endpoint, GridFS bucket configuration, and attachment references are unchanged. `npm ls multer --omit=dev` confirms the installed production tree resolves `2.5.0`. [Upstream release notes](https://github.com/expressjs/multer/releases/tag/v2.5.0) · [Upstream upload limits](https://github.com/expressjs/multer#limits)

The two new limit checks failed against 1.x with `201` for unsupported form shapes and passed with `400` after the patch. Six multipart route regressions cover the five-file success case, nested and extra fields, file count, signature validation, and denial before parsing. The focused workspace and storage run passed 42 tests in three suites. A real loopback HTTP upload reached GridFS, returned matching bytes with private download headers, and returned `401` or `403` on unauthorized upload and download. No unauthorized comment was persisted.

### Credentials

**SECURITY RELEASE BLOCKER — MANUAL ACTION.** There is no current sanitized evidence that the historically shared MongoDB and Brevo SMTP credentials or the JWT access and refresh signing secrets were rotated and rejected after revocation. Require a dated operator and reviewer receipt for all four, plus the sign-in transition and a review of access, SMTP and authentication logs. The phase used synthetic test keys. The source scan excludes ignored environment files and cannot prove revocation.

## Database and API compatibility

- **Parent to candidate** requires no schema migration and introduces no index declarations. Review/dispute/resubmission now require a transaction-capable MongoDB deployment. Confirm required collections, unique submission version index and active-submission lookup index, the one-active-submission invariant, application snapshot compatibility, and GridFS metadata plus bucket collections on an authorized restored sample. Production disables Mongoose automatic index creation. Existing missing indexes would require independently approved additive remediation.
- Fresh local fixtures exercise transaction rollback, competing writes, immutable snapshots, version append, and GridFS reconnect. Historical overwritten submission versions cannot be reconstructed by the new code. Existing duplicate/terminal ledger records are blocked for reconciliation. Audit an approved representative data copy for ambiguous legacy ledger rows, pre-existing missing indexes, historical submissions and legacy malformed values. Any repair requires a distinct decision. Preserve application history and GridFS file IDs.
- Relative to the parent, authentication routes and cookie contract, notification deep links and attachment references are stable. Active submission ID changes after a revision, and the frontend refetches it. Frontend application sources are identical across the two commits. This supports testing a backend-first transition for that pair. Old frontend/new backend and new frontend/new backend must be checked in hosted staging using the actual previous live revisions. If the deployed pair predates the parent or has different schema/config contracts, re-audit before choosing rollout order.

## Fresh verification

The full rerun uses an isolated Git archive of the exact SHA with the four remediation files overlaid. The clean installation had neither the developer's ignored environment files nor its existing dependency tree. Local integration used a fresh MongoDB 8.0.16 replica set bound to loopback, explicit test environments, repository safety flags, distinct fixture databases, and disabled email. No production service was contacted for verification.

| Check | Result |
| --- | --- |
| Reproducible install | **PASS.** `npm ci --prefix backend` and `npm ci --prefix frontend` on Windows with CI-pinned Node `20.19.0`. The installed trees contained 537 and 318 packages respectively. Dev-tooling deprecation warnings remain. Hosted Linux builds remain unverified. |
| Full `npm run verify:launch` | **PASS locally on Node `20.19.0` and `24.22.1`.** Each run passed 49 backend Jest suites and 391 tests, 50 frontend tests, both linters, the Vite 8.3.8 build and frontend configuration validator, seven backend production checks and four launch checks. The built entry was 364.83 kB minified and 99.78 kB gzip. Backend regressions include auth, role/IDOR, marketplace workspace, notifications, search, onboarding, profiles, teams/projects, evidence/showcases, hackathons, opportunities, organizations, applications and storage. |
| Dependency gates | **PASS locally.** Four npm audits reported zero across backend/frontend and full/production-only modes. Production `npm ls` resolves Multer `2.5.0`, which addresses the cited upstream advisories. The only direct dependency change is Multer. |
| MongoDB and API | **PASS.** `verify:mongodb-integration`, `verify:database` (45 collections including declared model indexes), and the API integration script against an explicitly started loopback API. Warmed small-fixture search p95 was 112.7 ms across 20 requests during the concurrent local verification run. |
| Domain and file verifiers | **PASS.** `verify:teams`, `verify:projects`, `verify:phase5`, `verify:discovery`, `verify:hackathons`, `verify:opportunities`, `verify:organizations`, `verify:phase-e`, `verify:phase-f2` and `verify:storage`. Covered role and IDOR boundaries, snapshots, transaction and race behavior, GridFS reconnect/hash and exact fixture cleanup. |
| Health and email | Loopback HTTP returned liveness `200`, readiness `503 → 200 → 503`, and `Cache-Control: no-store`. `verify:email` passed the configuration and template contract without SMTP or delivery. |
| Browser | **PASS for covered flows.** Phase C search/privacy, Phase D role-aware onboarding, and Phase E proof/application Chromium fixtures at 320, 375, 390, 430, 768, 1024 and 1440 px. The fixtures checked keyboard/focus, role/privacy boundaries, and applicable console/network behavior. |
| Secret scan and whitespace | **PASS.** Both isolated launch runs scanned 469 files and the final workspace scan covered 471 files including both G documents. The code changes and both untracked reports passed whitespace checks. |

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

The marketplace and admin evidence includes a disposable supplemental HTTP walkthrough on the patched tree in addition to the F2 verifier. The same walkthrough exercised the real multipart and private download routes. Hosted role walkthroughs remain unverified. Mailbox verification and recovery are separate from the specified registration-to-login journeys.

## Release blockers

| ID | Scope | Status and evidence needed |
| --- | --- | --- |
| G-SEC-001 | Code · P1 | **RESOLVED LOCALLY.** The frozen SHA still requires replacement. Include the patch in a separately approved immutable candidate and verify that exact revision before release. |
| G-EXT-001 | Credentials | **BLOCKED.** Rotation, old-value rejection, access review and JWT reauthentication receipt. |
| G-EXT-002 | Hosting, CI and data compatibility | **BLOCKED.** Current revision IDs, release branch/approval controls, supported runtime and configuration, and authorized existing-data/index/topology compatibility. |
| G-EXT-003 | Recoverability | **BLOCKED.** Backup/PITR policy, recent snapshot and measured isolated restore including GridFS. |
| G-EXT-004 | Monitoring and incident ownership | **BLOCKED.** Named owners, staging test-alert receipt, incident and privacy escalation, and release acceptance thresholds. |
| G-EXT-005 | Hosted smoke and rollback | **BLOCKED.** Verified staging transition, known-good paired artifacts, rollback rehearsal and approved live smoke scope. |

Confirmed unresolved counts for the tested working tree: **0 P0 and 0 P1**. The frozen `0605551` still has **1 P1**. External release blocker groups: **5**. G1 remains blocked pending a verified replacement SHA and external evidence. See the [G2 deployment plan](PHASE_G2_DEPLOYMENT_PLAN.md).
