# ADR 0001: Shared canonical domain contract

Status: accepted

Backend, frontend, SQL, and tests had independently copied enums and had begun
to drift. Phase 1 adopts `shared/contracts/domain.json` as the executable domain
vocabulary. Runtime modules derive constants from it, validators consume those
values, and tests assert state-machine completeness.

The public API uses `id` and snake_case relationship identifiers to match the
existing PostgreSQL boundary without a destructive field rename migration.
