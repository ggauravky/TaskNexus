# Hackathon submissions

## Requirements and readiness

Each Hackathon catalog record contains up to 12 typed requirement definitions. Supported types are `project_title`, `project_description`, `repository`, `demo`, `presentation`, `video`, `team_confirmed`, `required_form`, and `submission_url`.

The submission service builds a checklist in catalog order and marks each item complete from authoritative state:

- Project title and description come from the linked existing Project.
- Repository, demo, presentation, video, and final-submission requirements use the submission's bounded HTTPS fields.
- Team confirmation is an explicit Team-owner/admin checkbox.
- Team-size eligibility is recomputed from active Team memberships.

The response reports completed/required counts, missing required items, and `ready`. The stored status becomes `ready` only when every required item is complete; otherwise it remains `draft`. Final submission recomputes readiness rather than trusting the stored checklist or client UI.

## Status

- `draft`: at least one required item is incomplete.
- `ready`: all current required items are complete, but the Team has not submitted.
- `submitted`: final, immutable entry with `submitted_by` and `submitted_at`.

Linking an existing Project opens the submission workspace. Unlinking removes a non-submitted workspace. A submitted entry cannot be unlinked, edited, or replaced.

## Authorization

Every route starts from the `HackathonTeam` registration, resolves its existing Team, and requires an active Team `owner` or `admin` membership for mutations. Global platform admin status alone does not grant Team submission authority. The Project must belong to the registered Team. Direct IDs from another Team are rejected.

Authenticated active Team members may receive final-submission notifications, but member status does not grant mutation access.

## Deadline enforcement

Draft save and final submit compare server UTC time to the Hackathon's `submission_deadline` inside the transaction. A missing deadline means the catalog has no date cutoff; otherwise writes at or after the cutoff fail. Event lifecycle remains stored separately and cannot override the date boundary.

## Immutability

Final submit requires `confirm: true`, a ready recomputation, and the current revision. The conditional update only matches a non-submitted record. Once `submitted`, all link, unlink, draft-update, and repeated-submit paths reject the operation. The record remains durable for auditability.

## Revision behavior

`HackathonTeam.revision` fences Project link/unlink. `HackathonSubmission.revision` begins at zero and increments on each successful update and final submit. A stale revision produces a conflict and instructs the client to refresh. In Atlas race verification:

- one concurrent duplicate Team registration won;
- one of two Project-link writes won;
- update-versus-final-submit produced a single coherent state;
- one of two final submits won;
- exactly one submitted record remained.

Unique `(hackathon_id, team_id)` and unique `hackathon_team_id` indexes complement revisions by preventing duplicate durable relationships.
