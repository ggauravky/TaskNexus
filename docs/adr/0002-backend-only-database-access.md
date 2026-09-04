# ADR 0002: Backend-only database access

Status: accepted

All browser traffic goes through Express authentication and role middleware.
Direct browser database access would duplicate authorization rules and expose a
larger attack surface. The browser therefore has no database credential or
database-network access. The trusted backend connects with a dedicated,
least-privilege MongoDB application user.

Express authorization and ownership checks are the application boundary.
Mongoose validation, allowlisted query construction, MongoDB unique indexes,
conditional updates, and transactions enforce persistence invariants.
