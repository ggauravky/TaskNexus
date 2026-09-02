# Data model ownership

PostgreSQL is the durable source of truth. JSONB remains appropriate for
low-contention aggregates such as profiles, task presentation details, and
workflow timestamps. Frequently appended or independently updated collections
are relational.

| Concern | Storage | Reason |
| --- | --- | --- |
| User/profile preferences | `users` JSONB fields | Read and updated as one aggregate |
| Task details/workflow summary | `tasks` JSONB fields | Flexible presentation metadata |
| Comments | `task_comments` | Concurrent appends and indexed chronology |
| Milestones/subtasks | `task_milestones` | Independent updates without lost writes |
| Activity | `task_activity` | Append-only chronological history |
| Submission attempts | `submissions` | Versioning and idempotency |
| Notifications | `notifications` | Recipient/status pagination and entity links |

The Phase 1 migration backfills comments, milestones, and activity from legacy
task JSONB. Development environments without the migration retain a temporary
JSONB fallback; production treats normalized relations as required.
