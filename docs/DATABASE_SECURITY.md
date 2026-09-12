# MongoDB security and operations

TaskNexus uses a backend-only database architecture. Browsers call Express and never receive the MongoDB URI or database credentials.

## Atlas credentials

- Use a dedicated least-privilege application database user, not an organization-owner credential.
- Store `MONGODB_URI` only in ignored local files or the deployment secret store.
- Require TLS and restrict Atlas network access to development/deployment sources where practical.
- Never log connection strings. Startup and runtime database errors are sanitized.

## Application boundary

- Express authentication, roles, ownership checks, and state machines authorize access.
- DTO serializers whitelist output; password, refresh, and reset fields are excluded by model projection and serialization.
- Request filters and sort fields use explicit allowlists. User input is never spread into a Mongo query or update.
- Search regular expressions are escaped and bounded.
- Mongoose uses strict schemas, enum/range validation, `strictQuery`, and filter sanitization.
- Unique indexes enforce email, username, skill, relationship, and idempotency invariants.
- Team IDOR checks load the target team and active membership before private DTOs, rosters, activity, requests, invitations, or settings are returned.
- Team updates use field allowlists. Ownership, roles, archival, invitations, requests, removal, and leaving use dedicated action endpoints.
- A partial unique index prevents two active owners; compound/partial indexes prevent duplicate memberships and duplicate pending invitations/requests.
- Project IDOR checks combine parent Team visibility, active Team membership, and active Project participation before workspace data is returned.
- Direct Project Task and milestone IDs are resolved back through the Project authorization context; private cross-Team resources are concealed as not found.
- Project write DTOs use explicit allowlists. `team_id`, `project_id`, `created_by`, task status, and participant role cannot be mass-assigned through generic updates.
- Project assignment and status mutations use compare-and-set revisions; participant removal increments an assignment epoch so a concurrent assignment cannot commit contradictory state.
- Repository and demo links accept bounded HTTPS URLs only.
- GitHub URLs are parsed into exact public GitHub shapes before the backend constructs fixed `api.github.com` read-only requests; user input never becomes a provider host. Credentials, query strings, fragments, nested repository paths, private repositories, patch text, and provider email identity are rejected or excluded.
- GitHub verification has a dedicated strict rate limiter. `GITHUB_TOKEN`, when configured, remains backend-only and is never serialized or logged.
- Contribution claimants are derived from the authenticated user, not request fields. System evidence is immutable; only the claimant may verify or revoke user evidence.
- Public showcase DTOs are allowlists assembled independently of internal Project DTOs. Publication requires a public Team, public completed Project, a current revision, and active selected evidence.
- Bulk People Discovery requires authentication and explicit `discoverable=true`; private/unavailable profiles and block relationships are excluded before serialization.
- Discovery queries parse only expected primitive filters, escape and bound text, cap the candidate scan, and never pass request query objects into Mongoose.
- Collaboration request sender identity is derived from authentication. Recipient/context/status fields use explicit validation and action routes; partial uniqueness, cooldown, pending-count limits, and dedicated rate limits constrain spam.
- Team opening mutations require contextual owner/admin membership. Private Team openings never enter global discovery, and global marketplace admin has no implicit override.
- Blocks return neutral collaboration failures and cancel pending request state without exposing the blocker.
- Hackathon catalog mutation is platform-admin-only and uses an explicit field allowlist; lifecycle, ownership, IDs, revisions, and submission state cannot be mass-assigned.
- Hackathon public reads serialize public catalog fields only. Event teammate discovery requires both event visibility opt-in and the Phase 6 public/discoverable/available profile gates.
- Team registration and every registration-scoped mutation resolve an active Team owner/admin relationship. Cross-Team Project IDs are rejected, and global admin status provides no Team override.
- Registration and submission cutoffs are compared against server UTC time inside the transaction. Client clocks and stored lifecycle labels cannot bypass a deadline.
- External event and submission links accept bounded HTTPS URLs only; the backend does not fetch organizer-supplied URLs.
- Unique indexes and revision compare-and-set filters fence duplicate participation/registration and link/draft/final-submit races. Submitted entries cannot be edited or unlinked.

## Deployment operations

1. Confirm the target database name and credential scope.
2. Run `npm --prefix backend run database:indexes` as a reviewed deployment operation.
3. Run `npm --prefix backend run database:seed` for the canonical skill catalog.
4. Run `npm --prefix backend run verify:database`.
5. Run `npm --prefix backend run verify:mongodb-integration` against the non-production target.
6. Smoke-test authentication, profiles, tasks, submissions, notifications, and administration APIs.
7. Run `npm --prefix backend run verify:teams` against the dedicated non-production target and confirm disposable records are removed.
8. Run `npm --prefix backend run verify:projects` and confirm Project transaction, authorization, privacy, concurrency, query-plan, and cleanup checks pass.
9. Run `npm --prefix backend run verify:phase5` and confirm evidence transactions, deduplication races, provider verification, publication privacy, profile opt-in, query-plan, and cleanup checks pass.
10. Run `npm --prefix backend run verify:github` when outbound GitHub access is available; the check is read-only and uses stable public fixtures.
11. Run `npm --prefix backend run verify:discovery` and confirm privacy, filter accuracy, opening RBAC, request/block state, races, indexes, query plans, and disposable cleanup.
12. Run `npm --prefix backend run verify:hackathons` and confirm catalog admin boundaries, event privacy, Team RBAC/size/deadlines, contextual reuse, Project IDOR/CAS, immutable submission, Atlas races, indexes, query plans, and disposable cleanup.
13. Run `npm --prefix backend run verify:opportunities` and confirm Organization/admin boundaries, candidate privacy, deterministic eligibility, source/URL rules, duplicate/CAS/close races, history retention, indexes, query plans, and disposable cleanup.

## Opportunity security boundary

Catalog requests are allowlisted into explicit fields; raw request bodies never reach MongoDB operators. Bounded escaped regex search and `mongoose.trusted` operator construction prevent user-controlled NoSQL operators. HTTPS URLs reject credentials and non-HTTPS schemes. Candidate user IDs come only from verified access tokens, and private state queries always include that ID. Public serializers omit creator/verifier IDs, internal write fences, revisions, eligibility, application state, and notes. Admin catalog routes require the existing global administrator role and revisioned mutations.

The backend fails startup if MongoDB cannot connect. It never silently falls back to JSON files or process memory.

## Recovery

Use Atlas backups/snapshots and application deployment rollback. Never drop a database, collection, or index as an improvised rollback. The previous external database projects remain read-only rollback references until separately authorized for decommissioning.
