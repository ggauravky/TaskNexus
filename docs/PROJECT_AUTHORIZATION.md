# Project authorization

Project permissions are contextual. A global `client`, `freelancer`, or marketplace `admin` role never grants Project authority.

## Root boundary

```text
active TeamMembership
        ↓ required
optional active ProjectParticipant
        ↓ narrows one Project
Project permission
```

An inactive, removed, or missing Team membership terminates every Project permission immediately, even if a stale participant document exists. Private Project and direct Project Task requests from outsiders are concealed as not found.

## Permission matrix

| Action | Team owner | Team admin | Project lead | Contributor | Team member only | Non-member / marketplace admin |
| --- | --- | --- | --- | --- | --- | --- |
| View effective-public summary | Yes | Yes | Yes | Yes | Yes | Yes |
| View team-only summary | Yes | Yes | Yes | Yes | Yes | No |
| View tasks, milestones, activity | Yes | Yes | Yes | Yes | No | No |
| Create Project | Yes | Yes | No | No | No | No |
| Edit Project metadata | Yes | Yes | Yes | No | No | No |
| Change planning/active/completed state | Yes | Yes | Yes | No | No | No |
| Archive Project | Yes | Yes | No | No | No | No |
| Add/remove participants | Yes | Yes | Yes* | No | No | No |
| Change Project roles | Yes | Yes | Yes* | No | No | No |
| Create task | Yes | Yes | Yes | Yes | No | No |
| Edit task metadata/assignments | Yes | Yes | Yes | No | No | No |
| Move task through all valid transitions | Yes | Yes | Yes | Only when assigned† | No | No |
| Manage milestones | Yes | Yes | Yes | No | No | No |

`*` A Project lead cannot override or remove the Team owner or a Team admin.

`†` An assignee may move `todo → in_progress`, `todo → blocked`, `in_progress → blocked`, `blocked → in_progress`, or `in_progress → done`. Reopening and other management transitions require a manager.

## Lifecycle restrictions

- `planning` and `active` Projects accept ordinary edits.
- `completed` Projects preserve participants, tasks, milestones, and activity and reject collaboration mutations until explicitly reopened.
- Only a Team owner/admin may archive a Project.
- A private Team always forces effective Project visibility to `team`, regardless of stored Project visibility.

## Membership termination

Leaving or removal performs one transaction that changes Team membership, removes active Project participation, increments its assignment fence, and removes the user from open-task assignments. Completed-task attribution remains immutable historical evidence.

## Concurrency and integrity

`ProjectTask.revision` protects task metadata, assignment, and status writes from stale updates. `ProjectParticipant.assignment_epoch` joins participant eligibility to assignment writes, preventing a concurrent removal/assignment race from leaving an inactive participant assigned. Unique indexes prevent duplicate team-scoped slugs and duplicate Project participation.
