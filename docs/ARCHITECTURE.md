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
