# TASKNEXUS V2 — PHASE 6 COMPLETION REPORT

## 1. Executive Summary

Phase 6 implements opt-in People Discovery, canonical skill/role/interest/availability filtering, evidence-backed developer cards, Team Openings, contextual candidate review, Collaboration Requests, notifications, and blocking. The implementation and local quality gate are complete; final Atlas and browser acceptance remain blocked because the configured MongoDB endpoint refuses connections and the connected Atlas plugin is disabled at the organization level.

## 2. Starting Baseline

Work started from Phase 5 commit `6477d0b` (`feat: add contribution evidence and project showcases`) on a clean `codex/phase5-contributions-showcase` baseline, then moved to `codex/phase6-discovery`. The recorded Phase 5 local baseline was 14 suites and 107 tests with backend/frontend lint and production build passing. Atlas could not be revalidated at Phase 6 startup because the configured endpoint returned `ECONNREFUSED`.

## 3. Discovery Architecture

Discovery uses MongoDB, indexed bounded queries, explicit canonical filters, batched public evidence assembly, and a dedicated output DTO. It deliberately excludes embeddings, vector search, LLM recommendations, personality inference, and opaque quality ranking.

## 4. MongoDB Collections

New permanent collections are `team_openings`, `collaboration_requests`, and `user_blocks`. Existing `user_profiles` gains conservative `discoverable` state and a private collaboration revision used only to serialize block/request races.

## 5. Discoverability & Privacy

`discoverable` defaults to `false`. A profile is eligible only when it is public and its availability is `open` or `limited`; changing visibility to private or availability to unavailable forces discovery off. A public profile may remain directly viewable while excluded from bulk discovery.

## 6. Discovery Profile DTO

Cards contain user ID, username, display name, avatar, headline, public location, availability, commitment, canonical roles/interests, bounded skills, transparent match context, factual evidence counts, and at most two public Project previews. Email, phone, account status/role, education, sessions, private Teams/Projects, raw evidence metadata, drafts, and unpublished showcase content are excluded.

## 7. People Search

Authenticated `GET /api/people` safely searches display name, username, headline, canonical roles/interests, and skill catalog names/slugs/aliases. Search strings are capped at 80 characters, escaped before regex construction, and applied only after the indexed discoverable-profile candidate set is capped at 250.

## 8. Skill Filtering

Multiple skills support explicit `all` and `any` semantics. The default is `all`; selected IDs/slugs must resolve to active canonical skills, and match explanations list the actual matched skills.

## 9. Role / Interest / Availability Filtering

Roles and interests come from the shared contract and fail closed on unknown values. Availability accepts only `open` and `limited`; unavailable profiles cannot enter discovery. Role and interest arrays use explicit all-selected semantics.

## 10. Result Ordering

Ordering is deterministic: text relevance when searching, number of requested skills matched, availability (`open` before `limited`), profile update time, then username. Default browsing uses availability, update time, and username; popularity and evidence counts do not determine rank. No opaque match percentage is created or displayed.

## 11. Evidence-backed Developer Cards

Cards expose factual counts for internally verified task contributions, verified GitHub pull requests, verified external evidence, and published Projects. Evidence is counted only for an opted-in participant in a completed public Project owned by an active public Team with a published showcase; external evidence must also be marked public-safe.

## 12. Public Profile Integration

Public profiles now include the same bounded factual Project/evidence context and a Collaboration Request CTA when the subject is eligible. Signed-out viewers receive a sign-in CTA, and Profile settings provide a clearly constrained People Discovery switch.

## 13. Team Openings

Openings contain Team, title, bounded plain-text description, one canonical role, required/preferred canonical skills, optional canonical commitment, `open`/`closed` state, actors, timestamps, and revision. Only active Team owners/admins may create, edit, close, or review candidates; closed openings are immutable.

## 14. Opening Discovery

Authenticated opening discovery supports role, skill, Team slug, and Team interest filtering. Only open openings belonging to active public Teams are returned; private Team identity and openings are excluded from the global surface.

## 15. Candidate Review

Team managers receive the same privacy-safe discovery cards, constrained to the opening role and all required skills, excluding current active Team members. Candidate rows show transparent skills/role/availability/evidence context and any existing opening-interest state, with an existing Team invitation action rather than automatic membership.

## 16. Collaboration Requests

Requests support `pending`, `accepted`, `declined`, and `cancelled`. They may reference one validated Team, Project, or Team Opening context; opening interest reuses this aggregate instead of introducing an applications collection. Acceptance records professional intent only and never creates membership, Project access, chat, or messaging.

## 17. Request Authorization

The access token supplies every actor. Senders must be active, cannot target themselves, and may reference only a Team they actively belong to or a Project they actively participate in. Direct recipients must be active, public, discoverable, available, and mutually unblocked; only the recipient may accept/decline and only the sender may cancel.

## 18. Spam Protection

Request creation is limited to 30 attempts per day per authenticated/IP key, messages are plain text capped at 500 characters, a sender may hold at most 20 pending requests, and a 24-hour cooldown applies after a terminal request. A partial unique index prevents duplicate pending sender/recipient/context requests.

## 19. Blocking

`user_blocks` is implemented with a unique blocker/blocked pair. Blocking is idempotent, cancels pending requests in both directions, removes unread request notifications from the blocked actor, excludes both users from each other's actionable discovery, and makes future request failures neutral. Unblocking does not restore cancelled requests.

## 20. Notifications

Canonical notification types now include `collaboration_request_received`, `collaboration_request_accepted`, `collaboration_request_declined`, and `team_opening_interest`. Payloads contain safe entity IDs and internal action URLs only; opening interest notifies active Team managers and private person-to-person requests never enter public Team activity.

## 21. API Endpoints

New authenticated routes are `GET /api/people`; `GET /api/team-openings`; `GET|POST /api/teams/:teamId/openings`; `PATCH /api/team-openings/:id`; `POST /api/team-openings/:id/close`; `GET /api/team-openings/:id/candidates`; `POST /api/team-openings/:id/interest`; `GET|POST /api/collaboration-requests`; `POST /api/collaboration-requests/:id/accept|decline`; `DELETE /api/collaboration-requests/:id`; `GET|POST /api/user-blocks`; and `DELETE /api/user-blocks/:userId`.

## 22. Frontend

The authenticated People page includes People/Open Team Roles tabs, desktop sidebar and mobile disclosure filters, evidence-backed cards, match explanations, pagination, empty/loading states, profiles, and request/interest dialogs. The Collaboration page handles incoming/outgoing/blocked states and actions without chat. Team Settings includes opening creation/edit/close, candidate review, and Team invitations; the Team shell links People and Requests.

## 23. Security

Bulk discovery requires authentication and uses dedicated allowlisted DTOs. Query fields are parsed as bounded primitives, operator objects fail validation, regex text is escaped, and raw request queries are never passed to Mongoose. Explicit action methods prevent mass assignment; contextual Team/Project authorization and actor-derived request mutations prevent IDOR; discovery and request creation have separate rate limits.

## 24. Transactions

Opening create/edit/close is paired with Team activity in transactions. Request creation/interest is paired with notifications; accept/decline is paired with response notifications; blocking is paired with request cancellation and unread-notification cleanup. Search and list reads remain non-transactional.

## 25. Concurrency

Code-level invariants use partial unique indexes, compare-and-set opening revisions, atomic request status predicates, and an ordered two-profile collaboration lock. The Atlas verifier covers duplicate request, accept-versus-cancel, duplicate opening interest, opening close-versus-interest, and block-versus-request races. Real Atlas results are **not available**: the verifier exits before fixture creation with `MongoDB connection failed (ECONNREFUSED)`.

## 26. MongoDB Indexes

Declared indexes cover discoverability/visibility/availability/update time, discoverable roles, discoverable interests, skill-to-user lookup, Team/status/time, opening status/role/time, opening required skills, recipient/status/time, sender/status/time, opening-interest/status/time, unique pending context, and unique block pair. Model-level tests pass; live Atlas index synchronization and inspection are pending connectivity restoration.

## 27. Query Plans / Performance

Discovery limits the candidate pool to 250 and page size to 30, projects no private account fields, uses batched/set-based user/skill/Project/showcase/evidence loads, and returns at most two Project previews per card. The verifier requests Atlas explain plans for People availability, skill lookup, Team Opening list, and collaboration inbox and requires `IXSCAN`; these live plans remain unverified because Atlas is unreachable.

## 28. Automated Tests

The final local gate passes 16 Jest suites and 122 tests, backend ESLint with zero warnings, frontend ESLint with zero warnings, and the Vite production build (1,488 modules). Phase 6 tests cover canonical enums, conservative discovery defaults, schema validation, DTO exclusions, filter semantics, indexes, authentication, request actor derivation, mass-assignment boundaries, and operator-object rejection.

## 29. API Integration QA

In-process Supertest API contracts pass for authenticated bulk discovery, canonical response envelopes, invalid structured query rejection, Team/actor derivation, Collaboration Request identity, action identity, and blocking identity. The disposable authenticated Atlas scenario is implemented for privacy/filter accuracy, openings, candidate review, requests, blocking, notifications, and cleanup, but could not run because connection fails before startup.

## 30. Browser QA

Not run. Browser flows require an operational backend fixture, and the backend cannot start against the configured MongoDB endpoint. People/filter/profile/request/recipient/opening/interest/manager flows must be executed after Atlas connectivity is restored; no browser-console PASS is claimed.

## 31. Responsive QA

The responsive implementations and production build pass static/local compilation, including mobile disclosure filters and wrapping card/action layouts. Actual browser checks at 320, 375, 390, 430, 768, 1024, and 1440 pixels remain pending with Browser QA; no no-overflow PASS is claimed.

## 32. Accessibility

Implementation uses visible labels, native inputs/buttons, text status in addition to color, semantic dialogs, close/cancel controls, and keyboard-focusable actions. Automated/runtime inspection of landmarks, focus restoration, accessible names, keyboard traversal, and mobile disclosure behavior remains pending with Browser QA.

## 33. Documentation

Updated README, architecture, architecture baseline, data model, API contracts, canonical contracts, and database security. Added `PEOPLE_DISCOVERY.md`, `COLLABORATION_REQUESTS.md`, ADR 0007 (Deterministic Discovery Before AI Matching), and this report.

## 34. Files Changed

Frontend changes cover routes, People/Collaboration pages, dialogs, Team opening management, Team navigation, profile settings/public profile, and shared display helpers. Backend changes cover Mongoose models/indexes, discovery/opening/request services, controller/routes, profile/invitation reuse, serializers, rate limiting, verifiers, and tests. Shared/contracts and documentation define canonical roles, interests, statuses, notification/activity types, privacy, authorization, and operating procedures.

## 35. Remaining Technical Debt

Restore the V2/staging Atlas URI, enable MCP/AI client access in the Atlas organization, synchronize indexes, and run every database/integration/query-plan gate. Then run the complete browser/responsive/accessibility/console matrix and rotate the MongoDB credential that appeared in local command output during diagnosis. At greater scale, the bounded regex/text candidate stage may warrant Atlas Search, but that is intentionally outside Phase 6 and must retain transparent semantics.

## 36. Phase 7 Readiness

Ready for Hackathon Collaboration Mode: **NO**, pending Atlas race/query-plan/API verification and browser acceptance. Ready for deterministic Opportunity Platform foundation: **NO**, for the same acceptance blockers and because Jobs/ATS behavior has not been designed or authorized. The Phase 6 architecture is implementation-ready for both, but neither should begin before the unresolved gates pass.

## 37. Recommended Phase 7 Scope

After Phase 6 acceptance, plan a bounded Hackathon Collaboration Mode around Team role requirements, target Team size, submission deadline, missing-role discovery, hackathon-specific Team Openings, submission checklist, and Project/submission link. Reuse deterministic discovery and opening-interest contracts; do not add jobs, recruiters, chat, or AI matching.

## 38. Git Status

Delivery branch: `codex/phase6-discovery`. Starting HEAD: `6477d0b`. The final handoff records the resulting completion commit and working-tree state after this report is committed. Phase 7 has not started.
