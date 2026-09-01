# Current canonical contracts

These values describe the intended current API and database contract. Changes that require data migration belong in a tracked SQL migration.

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

## Field naming

- Database and API row identifiers use `id`, not `_id`.
- Task JSON detail data uses `task_details`, not `taskDetails`.
- Foreign keys use snake_case, for example `client_id` and `freelancer_id`.
- Compatibility fallbacks may remain at non-critical boundaries temporarily, but new code must use the canonical names.
