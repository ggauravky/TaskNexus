# ADR 0003: MongoDB and Mongoose persistence

Status: accepted

## Context

TaskNexus V2 previously used a hosted relational data layer. Before Teams and Memberships, the product owner chose MongoDB as the permanent application database. The migration must retain Phase 2 behavior, stable public IDs, normalized high-contention collaboration records, and API contracts.

## Decision

Use MongoDB Atlas with Mongoose. Store existing UUID/string IDs directly as document `_id` values and serialize them as `id`. Keep independent collections for accounts, profiles, skills, education, tasks, submissions, notifications, collaboration records, payments, reviews, public forms, and audit history.

Use the shared domain contract plus Mongoose validation instead of database-specific enums. Enforce uniqueness with MongoDB indexes. Enforce relationship existence and authorization in services, then scan critical references during migration/deployment verification. Use transactions for registration, work submission, and skill replacement; use a conditional atomic update for task acceptance.

## Consequences

- The frontend and public API do not need an ID or payload rewrite.
- The backend has one persistence implementation and fails fast when it is unavailable.
- Relationship integrity requires deliberate service checks and verification because MongoDB has no foreign keys.
- Transactional workflows require a replica-set deployment; Atlas satisfies this requirement.
- Index creation is an explicit production operation rather than an automatic startup side effect.

## Embedding policy

Bounded task presentation/workflow metadata remains nested. Records with independent lifecycles, authorization, growth, query needs, or concurrent writes remain separate collections. Comments, milestones, and activity are not re-embedded into tasks.

## Rollback

The migration branch and pre-migration checkpoint preserve the application rollback path. The former external database projects are not deleted and remain read-only references until separate decommissioning approval. Atlas backups should protect the target before future destructive changes.
