# Security model

## Trust boundaries

The browser and uploaded bytes are untrusted. Express is the authorization
boundary. Atlas/Brevo credentials and GitHub token remain backend-only. Private
attachment bytes never receive a permanent public URL.

## Authentication and sessions

- Short-lived bearer access JWTs and rotating refresh JWTs; only refresh digests
  are stored.
- Refresh cookie is HttpOnly, Secure in production, scoped to `/api/auth` and uses
  reviewed SameSite behavior for the deployment topology.
- Exact CORS origins and trusted-Origin checks protect cookie mutations.
- Login, authenticated access and refresh reject inactive accounts. Suspension
  or blocking clears the persisted refresh digest; already-issued access tokens
  cease working because every protected request reloads account status.
- Global admin, Team, Project, Organization, Opportunity and application roles
  are distinct and enforced server-side. Public registration cannot create admin.

One active refresh session per account is intentional until device sessions are
modeled.

## HTTP, logs and failures

Helmet/Vercel apply CSP, HSTS, frame, MIME, referrer and permissions controls.
Bodies, uploads and list pages are bounded; sensitive routes are rate-limited.
Every response has a request ID. Completed request logs contain timestamp,
request ID, method, query-free route, status and latency. Safe error envelopes do
not expose production stacks. Redaction covers Authorization/Cookie headers,
passwords, JWTs, reset/refresh tokens, MongoDB URI and provider secrets; private
application notes are not logged.

## Data and attachments

Mongoose strict queries, sanitization and validated `mongoose.trusted` operators
limit query injection. Private attachment access first authorizes the task, then
locates stored metadata and streams GridFS through the API with `private,
no-store` and `nosniff`. Multer uses bounded memory and verifies allowed MIME,
matching extension, magic bytes, size/count, sanitized display name and opaque
generated key. A failed comment write rolls back already-uploaded files.

Development may use local storage. Production requires GridFS and fails startup
otherwise. GridFS shares Atlas durability/backup controls, which also means Atlas
capacity and recovery are launch dependencies. No malware scanner is currently
present; allowed formats/signatures and size limits reduce but do not eliminate
malicious-document risk. This is P1 technical debt for broader untrusted upload
volume.

Inactive/private users are removed from public discovery/profile identity.
Historical collaborative records remain, while public summaries use generic
`TaskNexus member` attribution without profile identifiers when identity is not
visible.

## External providers

Brevo and GitHub use bounded timeouts/retries and sanitized errors. GitHub fetches
only fixed official origins, refuses redirects, limits response size and leaves
evidence unverified on failure. MongoDB notifications are durable truth; SSE is
authenticated, process-local acceleration and clients refetch after reconnect.

## Unresolved external controls

Atlas tier/access list/backup/PITR/alerts/restore, external monitoring/on-call and
deployed staging security evidence are unverified. These are release blockers,
not code assertions. Repository secret scanning and branch protection must be
enabled in the Git host as an external control.
