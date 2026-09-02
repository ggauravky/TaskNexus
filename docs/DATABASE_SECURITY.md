# Database security and migration operations

TaskNexus is a backend-only database architecture. The browser calls the
Express API and must never receive a Supabase service-role credential.

## Runtime credentials

- Production requires `SUPABASE_SERVICE_ROLE_KEY`.
- `SUPABASE_ANON_KEY` is retained only as a local-development compatibility
  fallback.
- The Supabase client does not persist sessions or refresh tokens.
- Service-role values belong only in backend environment configuration.

## RLS boundary

Migration `20260902_phase1_architecture_stabilization.sql` enables RLS on every
application table and revokes table access from `anon` and `authenticated`.
The backend service role owns application access. Security-definer RPCs revoke
public execution and grant it only to `service_role`.

This model deliberately does not add permissive browser policies: doing so
would create a second authorization system beside the API middleware.

## Applying migrations safely

1. Back up the database or create a provider snapshot.
2. Apply migrations in filename order.
3. Run `npm --prefix backend run validate:migrations` before deployment.
4. Verify that the API environment contains the service-role key before
   enabling the production deployment.
5. Smoke-test health, login, task listing, acceptance, work submission, and
   notification listing.

The Phase 1 migration keeps legacy collaboration JSONB while backfilling the
normalized tables. This provides rollback data. Do not remove those JSON keys
until a later, separately approved cleanup confirms the backfill in production.

## Rollback

Application rollback is preferred: deploy the previous API version while the
legacy JSONB remains available. Dropping new tables, columns, indexes, or RPCs
is destructive and should only be done from an explicit reviewed down-migration
after a backup. RLS/revokes must not be relaxed merely to make a rollback work.
