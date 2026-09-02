# ADR 0003: Normalize collaboration collections

Status: accepted

Comments, activity entries, and milestones were arrays nested in a task JSONB
document. Every append or edit rewrote the whole task and could overwrite a
concurrent change. Phase 1 introduces `task_comments`, `task_activity`, and
`task_milestones`, with task/time indexes and an in-place backfill.

Legacy JSONB is retained during the migration window for rollback. New
production reads and writes use normalized relations; local development can
temporarily fall back when its database has not been migrated.
