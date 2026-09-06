# MongoDB data model

MongoDB is the durable source of truth. Application UUID/string identifiers are stored directly as document `_id` values and serialized as API `id` fields.

| Collection | Purpose | Principal relationships/indexes |
| --- | --- | --- |
| `users` | Accounts, password hashes, roles, session state | unique email; role/status |
| `user_profiles` | One professional profile per account | `_id` = user ID; unique sparse username |
| `skills` | Canonical skill catalog | unique slug/name; category/name; aliases |
| `user_skills` | Profile-to-skill assignments | unique user/skill; user/primary |
| `user_education` | Multiple education entries | user/position/start year |
| `tasks` | Task brief and lifecycle summary | unique human task ID; client/status; freelancer/status |
| `submissions` | Versioned task deliveries | task/active/version; unique freelancer/idempotency key |
| `payments` | Existing payment workflow records | unique payment ID; task/client/freelancer |
| `reviews` | Existing review records | unique task/reviewer/type; reviewee/time |
| `notifications` | Durable inbox items | recipient/status/created time |
| `task_comments` | Concurrent task discussion | task/created time; author |
| `task_milestones` | Independently updated task milestones | task/position/time |
| `task_activity` | Append-oriented task history | task/time; actor |
| `newsletter_subscriptions` | Public newsletter requests | unique email; status |
| `service_bookings` | Public service booking requests | unique booking/session IDs; email |
| `support_jar_contributions` | Existing support records | email; created time |
| `audit_logs` | Append-oriented accountability data | user/time; resource/id; time |
| `teams` | Team identity, privacy, access policy, and current owner | unique slug; owner; visibility/status/time; interests |
| `team_memberships` | First-class contextual user/team relationship | unique team/user; one active owner per team; user/status |
| `team_invitations` | Invitation lifecycle independent from membership | one pending team/user invitation; inbox/status/time |
| `team_join_requests` | Request lifecycle independent from membership | one pending team/user request; team/status/time |
| `team_activity` | Bounded, meaningful team history | team/created time; actor/time |
| `projects` | Team-owned collaboration workspace | unique team/slug; team/status/time; visibility/status |
| `project_participants` | Contextual Project membership | unique project/user; user/status; project/role |
| `project_tasks` | Collaboration work, separate from marketplace tasks | project/status/time; project/due date; assignee/status; project/milestone |
| `project_milestones` | Project delivery checkpoints | project/status; project/target date |
| `project_activity` | Meaningful Project history | project/created time; actor/time |
| `contribution_evidence` | Append-oriented contribution facts and user claims | unique project/source; user/status/time; project/status/time; project/user/status/time |
| `project_repositories` | Canonical public GitHub repositories linked to a Project | unique project/provider/owner/repository; project/created time |
| `project_showcases` | One revisioned publication workspace per Project | unique project; team/status/published time |
| `team_openings` | Structured roles a Team is seeking | team/status/time; status/role/time; required skills |
| `collaboration_requests` | Person-to-person collaboration intent with optional context | recipient/status/time; sender/status/time; one pending sender/recipient/context |
| `user_blocks` | Minimal anti-harassment boundary | unique blocker/blocked pair; reverse lookup |

## Relationship policy

MongoDB does not enforce foreign keys. Controllers and services validate resource existence, ownership, and state before writes; migration and deployment verification scan critical relationships for orphans. Independent collections are used where records have their own lifecycle, authorization boundary, query pattern, or concurrent writes.

## Atomicity

- Registration creates the user and one-to-one profile in a transaction.
- Task acceptance is one conditional `findOneAndUpdate`.
- Work submission transitions the task, deactivates older submissions, and inserts the next version in one transaction.
- Profile skill replacement validates references and replaces assignments in one transaction.
- Team creation writes the team, owner membership, and creation activity together.
- Invitation acceptance and join-request approval conditionally transition one pending record, create/reactivate one membership, and write activity/notification records together.
- Ownership transfer conditionally changes `team.owner_id`, demotes the previous owner, promotes one existing member, and writes activity/notification records together.
- Project creation writes the Project, creator lead participation, and creation activity together.
- Participant removal deactivates participation, unassigns open tasks, and writes activity/notification records together. Completed-task attribution is retained.
- Team departure/removal deactivates all Project participations and unassigns open Project Tasks in the same transaction as the Team membership transition.
- Milestone completion and Project task assignment/status effects write their durable activity/notifications atomically.
- Project Task completion creates one evidence record per assignee in the same transaction; reopening revokes the active completion evidence instead of deleting it.
- Project creation, participant activation, and role changes create internal evidence in their owning transaction.
- Showcase publish/unpublish uses revision compare-and-set and writes Project activity plus publish notifications atomically.
- Opening create/close writes the opening and meaningful Team activity transactionally; edits use a revision compare-and-set.
- Collaboration request creation validates both users and context, writes the pending request and notification together, and relies on a partial unique index for concurrent deduplication.
- Accept/decline conditionally transitions only a recipient-owned pending request; cancel conditionally transitions only a sender-owned pending request. Neither creates membership.
- Blocking creates the unique block and cancels pending requests between both users in one transaction.

Transactions are sequential within a session; transaction-dependent operations are not grouped with `Promise.all`.

## Team relationships

```text
User ──< TeamMembership >── Team
                         ├── TeamInvitation
                         ├── TeamJoinRequest
                         └── TeamActivity
```

Membership status is `active`, `left`, or `removed`. Pending invitation/request state never appears on membership documents. A unique compound team/user index preserves one relationship record, while a partial unique `team_id` index where `role=owner` and `status=active` prevents multiple active owners.

## Project relationships

```text
Team ──< Project ──< ProjectParticipant >── User
                  ├──< ProjectTask ──> optional ProjectMilestone
                  ├──< ProjectMilestone
                  ├──< ProjectActivity
                  ├──< ContributionEvidence >── User
                  ├──< ProjectRepository
                  └── ProjectShowcase
```

Every Project relationship repeats `team_id` only where it materially supports integrity and indexed authorization. Services validate the parent Team/Project relationship. `ProjectTask.revision` provides compare-and-set mutation control; `ProjectParticipant.assignment_epoch` fences concurrent assignment against participant removal.

`ContributionEvidence.source_key` is selected out by default and uniquely deduplicates a source within a Project. Evidence has independent verification (`internal_verified`, `external_verified`, `unverified`) and lifecycle (`active`, `revoked`, `superseded`) dimensions. `ProjectShowcase.revision` fences publication races, while `featured_evidence_ids` is capped at 12 active Project records. `ProjectParticipant.show_on_profile` is an explicit, user-controlled opt-in.

## Discovery relationships

```text
UserProfile ── discoverable/public ──> People Discovery
Team ──< TeamOpening ──< CollaborationRequest >── User
User ──< UserBlock >── User
```

`UserProfile.discoverable` defaults to `false` independently of public profile visibility. Its selected-out `collaboration_revision` serializes request/block races without entering API DTOs. `TeamOpening` reuses canonical skill IDs, collaboration roles, and commitments. `CollaborationRequest.context_key` is selected out by default and supports partial pending-state uniqueness. Optional context IDs are validated by services before insertion.
