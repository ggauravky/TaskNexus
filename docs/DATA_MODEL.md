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

Transactions are sequential within a session; transaction-dependent operations are not grouped with `Promise.all`.

## Team relationships

```text
User ──< TeamMembership >── Team
                         ├── TeamInvitation
                         ├── TeamJoinRequest
                         └── TeamActivity
```

Membership status is `active`, `left`, or `removed`. Pending invitation/request state never appears on membership documents. A unique compound team/user index preserves one relationship record, while a partial unique `team_id` index where `role=owner` and `status=active` prevents multiple active owners.
