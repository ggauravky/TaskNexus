# Architecture boundaries

## Request flow

```text
Browser → Express validation/auth → domain service → Mongo data adapter → Mongoose → MongoDB
        ← serializer/DTO ← canonical response envelope
```

The backend is authoritative for authorization and state transitions. Shared frontend constants support presentation but never grant access. Mongoose documents do not cross the API boundary; serializers expose canonical string `id` values and whitelisted fields.

## Identity and authorization

`client`, `freelancer`, and `admin` remain global marketplace roles. Team permissions are derived only from an active `TeamMembership` and its contextual `owner`, `admin`, or `member` role. Project permissions combine that active Team membership with an optional active `ProjectParticipant` role. Team membership is the root boundary: Project participation can narrow context but can never restore authority after Team membership ends. A global administrator receives no implicit Team or Project access.

## Collaboration hierarchy

```text
Team
  └── Project
       ├── ProjectParticipant
       ├── ProjectTask
       ├── ProjectMilestone
       ├── ProjectActivity
       ├── ContributionEvidence
       ├── ProjectRepository
       └── ProjectShowcase
```

Marketplace `Task` and collaboration `ProjectTask` are separate aggregates, collections, routes, serializers, and state machines. Project creation and participant/revocation workflows use transactions; task mutations use compare-and-set revisions where concurrent writes matter.

Contribution evidence is an append-oriented record of work, not a score. Internal facts originate from transactional Project actions. User claims start unverified, GitHub claims can be verified through a narrowly scoped provider, and revocation changes lifecycle state without deleting history. Public showcases are separate publication records and pass through a dedicated public serializer; they never reuse the internal Project DTO.

## Discovery boundary

Bulk People Discovery is authenticated and starts from `UserProfile.discoverable=true`, a public profile, an active account, and `open` or `limited` availability. Structured inputs are parsed into allowlisted primitives; escaped bounded text search and indexed MongoDB queries build a candidate set capped at 250. Skill semantics are explicit (`all` by default, optional `any`). Ordering uses text relevance, requested-skill matches, availability, profile update time, and username as deterministic tie-breakers. The API returns match facts and public evidence counts, never a hidden score.

Team openings belong to Teams and inherit Team privacy. Owners/admins manage them; public discovery sees only open records for active public Teams. Opening candidate search reuses the same discovery boundary and excludes active Team members. Collaboration requests are person-to-person intent with optional validated Team, Project, or opening context. Acceptance never mutates membership or participation. Blocks remove actionable relationships and transactionally cancel pending requests without revealing which side blocked.

## Hackathon collaboration boundary

Hackathon mode is an orchestration layer over existing collaboration domains. `HackathonParticipant` stores event opt-in and privacy, while `HackathonTeam` relates one existing Team to one Hackathon and optionally to one Team-owned Project. Team membership and authorization remain exclusively in `TeamMembership`; Project work remains in `Project`, `ProjectParticipant`, `ProjectTask`, milestones, evidence, repositories, and showcases.

```text
Hackathon ──< HackathonParticipant >── UserProfile / People Discovery
          └──< HackathonTeam >──────── Team ──< TeamOpening
                       └── Project ──< ProjectTask / Evidence / Showcase
                       └── HackathonSubmission
```

Public catalog reads use stored lifecycle status and exact UTC dates. Platform administrators alone maintain catalog records; global administrator status does not grant Team workspace authority. Team owners/admins register eligible Teams, link Projects, and control submissions. Server-side registration/submission deadlines, active-member counts, contextual ID checks, compare-and-set revisions, unique indexes, and MongoDB transactions protect state changes. Final submission is immutable.

## External provider boundary

The GitHub adapter parses exact `https://github.com/{owner}/{repository}` repository, commit, pull-request, and profile URLs. It rejects credentials, fragments, queries, unsupported hosts, and unexpected path shapes before constructing fixed `https://api.github.com` read-only requests. An optional backend-only `GITHUB_TOKEN` may authenticate those requests. Provider metadata is bounded and never supplies TaskNexus identity by email or patch content.

## Public publication boundary

The public showcase is the intersection of a public Team, public completed Project, published `ProjectShowcase`, active selected evidence, and public participant profiles. Internal task titles/descriptions, activity metadata, hidden profiles, drafts, revoked evidence, credentials, and raw database documents are excluded. Public-profile Project cards additionally require the participant's explicit `show_on_profile` opt-in.

## Event meanings

- A domain event describes a business fact.
- A realtime event is an ephemeral SSE refresh hint.
- A notification is a durable recipient-facing record.
- An audit entry records accountability and operational history.

These concepts may originate from one action but are not interchangeable.

## Pagination

Current list endpoints use bounded page/offset pagination with allowlisted sort fields. Composite MongoDB indexes serve task, notification, profile, and administration query patterns. Cursor pagination remains a later option for genuinely high-write feeds.

## Opportunity platform boundary

Organizations are controlled catalog identities and never inherit Team membership or roles. An Opportunity belongs to one Organization and supports only internship or entry-level-job types. Administrator CAS operations own draft, publish, close, and archive transitions. Public discovery reads only currently open published records.

Candidate eligibility and state are private overlays. One batched read loads the caller's profile, education, skills, and candidate-state rows; deterministic checks then decorate the page in memory. `opportunity_candidate_states` uniquely owns one user's save/application relationship. External apply URLs remain HTTPS-only and TaskNexus never submits an application or exposes candidate state to an Organization.

## Organization hiring boundary

Phase 9 adds contextual employer authority without changing global account roles. `OrganizationMembership` is independent from Team membership and grants `owner`, `admin`, or `recruiter` authority for exactly one Organization. Platform administrators approve initial control; they do not automatically gain applicant access. Organization-managed listings are explicitly `organization_owned` and use either external or TaskNexus application mode.

Native applications are separate from candidate-owned external tracking. Submission stores a bounded consented profile snapshot, creates immutable application activity, and notifies Organization members in one transaction. Recruiter stage changes and candidate withdrawal use revision compare-and-set writes. Applicant access always derives Organization authority from the authenticated actor and never exposes email, phone, private Projects, saved Opportunities, external notes, blocks, or account-security data.
