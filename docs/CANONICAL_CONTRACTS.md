# Current canonical contracts

These values describe the intended current API and database contract. Changes that require data migration need a reviewed, idempotent MongoDB migration or backfill.

## Roles

- `client`: public registration allowed
- `freelancer`: public registration allowed
- `admin`: controlled provisioning only

## Account statuses

- `active`
- `suspended`
- `blocked`

`banned` is not a canonical value.

## Task statuses

- `submitted`
- `under_review`
- `assigned`
- `in_progress`
- `submitted_work`
- `qa_review`
- `revision_requested`
- `delivered`
- `client_revision`
- `completed`
- `cancelled`
- `disputed`

`rejected` is not a task status. A rejected initial task transitions to `cancelled` with a cancellation reason.

## Notification types

- `task_assigned`
- `task_submitted`
- `qa_feedback`
- `client_approval`
- `revision_requested`
- `payment_released`
- `deadline_reminder`
- `task_cancelled`
- `dispute_raised`
- `account_warning`
- `task_started`
- `task_unaccepted`
- `task_progress`
- `submission_updated`
- `account_status_changed`
- `task_approved`
- `task_rejected`
- `submission_approved`
- `new_review`
- `team_invitation`
- `team_invitation_accepted`
- `team_join_request`
- `team_join_request_accepted`
- `team_join_request_rejected`
- `team_member_removed`
- `team_role_changed`
- `team_ownership_transferred`
- `project_showcase_published`
- `collaboration_request_received`
- `collaboration_request_accepted`
- `collaboration_request_declined`
- `team_opening_interest`
- `hackathon_registration_confirmed`
- `hackathon_team_registered`
- `hackathon_submission_ready`
- `hackathon_submission_submitted`

## Team contracts

- Visibility: `public`, `private`
- Join policy: `open`, `request`, `invite_only`
- Team status: `active`, `archived`
- Contextual role: `owner`, `admin`, `member`
- Membership status: `active`, `left`, `removed`
- Invitation status: `pending`, `accepted`, `declined`, `cancelled`, `expired`
- Join-request status: `pending`, `accepted`, `rejected`, `cancelled`

Account roles (`client`, `freelancer`, `admin`) are never team authorization roles. Team permissions are derived from active `team_memberships` records.

## Project contracts

- Project status: `planning`, `active`, `completed`, `archived`
- Project visibility: `team`, `public`
- Project role: `lead`, `contributor`
- Project participant status: `active`, `removed`
- Project Task status: `todo`, `in_progress`, `blocked`, `done`
- Project Task priority: `low`, `medium`, `high`, `urgent`
- Project milestone status: `planned`, `in_progress`, `completed`

Project lifecycle and Project Task transitions are defined in `shared/contracts/domain.json`. Project status changes use action endpoints, never generic metadata PATCH. Marketplace Task statuses remain a separate contract.

## Contribution contracts

- Evidence type: `project_participation`, `project_role`, `project_task_completion`, `github_commit`, `github_pull_request`, `external_link`
- Verification: `internal_verified`, `external_verified`, `unverified`
- Lifecycle: `active`, `revoked`, `superseded`
- Origin: `system`, `user`
- Repository provider: `github`
- Repository verification: `pending`, `verified`, `unavailable`
- Showcase status: `draft`, `published`, `unpublished`

Verification and lifecycle are independent. Revoked records remain durable history. Counts are factual summaries and never scores or ranks.

## Discovery contracts

- Discoverability: boolean, default `false`; effective only with public visibility and `open` or `limited` availability
- Team opening status: `open`, `closed`
- Collaboration request status: `pending`, `accepted`, `declined`, `cancelled`
- Skill mode: request-level `all` or `any`, with `all` as the default
- Opening role and profile preferred roles: `shared/contracts/domain.json#collaborationRoles`
- Discovery/team interests: `shared/contracts/domain.json#profileInterests`

## Hackathon contracts

- Lifecycle: `upcoming`, `registration_open`, `active`, `submission_closed`, `completed`, `archived`
- Mode: `online`, `offline`, `hybrid`
- Visibility: `public`, `private`
- Participation: `interested`, `participating`, `withdrawn`
- Team registration: `registered`, `withdrawn`
- Submission: `draft`, `ready`, `submitted`
- Requirements: `project_title`, `project_description`, `repository`, `demo`, `presentation`, `video`, `team_confirmed`, `required_form`, `submission_url`

Lifecycle status is stored, while UTC dates independently enforce registration and submission cutoffs on the server. `HackathonTeam` relates an existing Team; it does not define Hackathon member roles. Team and Project authorization continues to use their canonical contracts.

## Opportunity contracts

- Organization type: `company`, `startup`, `nonprofit`, `government`, `educational`, `other`; status: `active`, `archived`; verification: `unverified`, `verified`.
- Opportunity type: `internship`, `entry_level_job`; lifecycle: `draft`, `published`, `closed`, `archived`.
- Work mode: `remote`, `hybrid`, `onsite`; employment: `full_time`, `part_time`.
- Eligibility: `eligible`, `possibly_eligible`, `not_eligible`, `unknown`; check facts: `pass`, `gap`, `fail`, `unknown`.
- Candidate-reported application: `interested`, `applied`, `assessment`, `interview`, `offer`, `rejected`, `withdrawn`.
- Provenance: `official`, `admin_curated`, `external`; compensation period: `hour`, `month`, `year`, `fixed`.
- Organization management: `platform_managed`, `organization_managed`; contextual roles: `owner`, `admin`, `recruiter`.
- Organization invitation: `pending`, `accepted`, `declined`, `cancelled`, `expired`.
- Opportunity application mode: `external`, `tasknexus`; Organization-owned provenance: `organization_owned`.
- Native application stage: `submitted`, `reviewing`, `shortlisted`, `assessment`, `interview`, `offer`, `rejected`, `withdrawn`.
- Application activity: `submitted`, `stage_changed`, `withdrawn`.

These values originate only in `shared/contracts/domain.json`; generated frontend/backend maps must stay byte-for-byte aligned with the arrays.

## Field naming

- API identifiers use `id`; MongoDB stores the same string as `_id` internally.
- Task JSON detail data uses `task_details`, not `taskDetails`.
- Foreign keys use snake_case, for example `client_id` and `freelancer_id`.
- Data adapters translate storage representation; callers use only canonical names.
