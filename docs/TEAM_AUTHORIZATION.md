# Team authorization

Team authorization is contextual. `users.role` describes the legacy marketplace/global account role and never grants access to a team. Every team permission is derived from an active `team_memberships` record.

## Permission matrix

| Action | Owner | Admin | Member | Non-member |
| --- | ---: | ---: | ---: | ---: |
| View public team/member summaries | Yes | Yes | Yes | Yes |
| View private team | Yes | Yes | Yes | No |
| View private activity | Yes | Yes | Yes | No |
| Edit team identity/access | Yes | Yes | No | No |
| Invite/cancel invitation | Yes | Yes | No | No |
| Review join request | Yes | Yes | No | No |
| Promote or demote admin/member | Yes | No | No | No |
| Remove member | Yes | Yes | No | No |
| Remove admin | Yes | No | No | No |
| Remove owner | No | No | No | No |
| Leave voluntarily | Transfer first | Yes | Yes | N/A |
| Transfer ownership | Yes | No | No | No |
| Archive team | Yes | No | No | No |

An admin may remove a member but not another admin. Only the owner changes admin/member roles. Ownership transfer targets an existing active member and is the only route that can create a new owner.

## Privacy and IDOR

Public active teams appear in discovery and expose explicit team/member summary DTOs. A private team returns `TEAM_NOT_FOUND` to a non-member so its existence and contents are not disclosed. Membership is checked again for activity, invitations, join requests, and settings; knowledge of a team or transition UUID is never sufficient authorization.

## State invariants

- Team creation atomically writes one team, one owner membership, and one activity event.
- A partial unique membership index permits at most one active owner for a team.
- The service never removes or deactivates an active owner. The owner transfers ownership or archives the team.
- Invitations and join requests conditionally transition from `pending` once. Their acceptance/approval and membership creation share one transaction.
- A unique team/user membership index makes retries and concurrency converge on one relationship record.
- Successful membership creation cancels competing pending access paths.

## Global administrator behavior

A global `admin` account is a non-member unless it has an active membership. It cannot inspect a private team, edit it, manage members, or transfer ownership solely because `users.role=admin`.
