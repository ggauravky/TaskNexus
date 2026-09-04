# MongoDB security and operations

TaskNexus uses a backend-only database architecture. Browsers call Express and never receive the MongoDB URI or database credentials.

## Atlas credentials

- Use a dedicated least-privilege application database user, not an organization-owner credential.
- Store `MONGODB_URI` only in ignored local files or the deployment secret store.
- Require TLS and restrict Atlas network access to development/deployment sources where practical.
- Never log connection strings. Startup and runtime database errors are sanitized.

## Application boundary

- Express authentication, roles, ownership checks, and state machines authorize access.
- DTO serializers whitelist output; password, refresh, and reset fields are excluded by model projection and serialization.
- Request filters and sort fields use explicit allowlists. User input is never spread into a Mongo query or update.
- Search regular expressions are escaped and bounded.
- Mongoose uses strict schemas, enum/range validation, `strictQuery`, and filter sanitization.
- Unique indexes enforce email, username, skill, relationship, and idempotency invariants.

## Deployment operations

1. Confirm the target database name and credential scope.
2. Run `npm --prefix backend run database:indexes` as a reviewed deployment operation.
3. Run `npm --prefix backend run database:seed` for the canonical skill catalog.
4. Run `npm --prefix backend run verify:database`.
5. Run `npm --prefix backend run verify:mongodb-integration` against the non-production target.
6. Smoke-test authentication, profiles, tasks, submissions, notifications, and administration APIs.

The backend fails startup if MongoDB cannot connect. It never silently falls back to JSON files or process memory.

## Recovery

Use Atlas backups/snapshots and application deployment rollback. Never drop a database, collection, or index as an improvised rollback. The previous external database projects remain read-only rollback references until separately authorized for decommissioning.
