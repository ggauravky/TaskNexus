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

## Field naming

- API identifiers use `id`; MongoDB stores the same string as `_id` internally.
- Task JSON detail data uses `task_details`, not `taskDetails`.
- Foreign keys use snake_case, for example `client_id` and `freelancer_id`.
- Data adapters translate storage representation; callers use only canonical names.
