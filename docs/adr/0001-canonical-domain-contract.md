# ADR 0001: Shared canonical domain contract

Status: accepted

Backend, frontend, persistence schemas, and tests had independently copied enums and had begun
to drift. Phase 1 adopts `shared/contracts/domain.json` as the executable domain
vocabulary. Runtime modules derive constants from it, validators consume those
values, and tests assert state-machine completeness.

The public API uses `id` and snake_case relationship identifiers. MongoDB stores
the same canonical string as `_id`, which keeps the public boundary independent
from the persistence representation.
