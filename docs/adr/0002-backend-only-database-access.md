# ADR 0002: Backend-only database access

Status: accepted

All browser traffic goes through Express authentication and role middleware.
Direct browser database access would duplicate authorization rules and expose a
larger attack surface. RLS is therefore enabled as deny-by-default for browser
roles, while the trusted backend uses a service-role credential.

Atomic business operations are narrow security-definer functions with public
execution revoked. They use a fixed `search_path` and are callable only by the
service role.
