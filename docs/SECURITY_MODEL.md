# Security model

## Trust boundaries

The Vercel frontend is public and untrusted. Render terminates HTTPS and forwards
requests to Express. Express is the authorization boundary. MongoDB Atlas and
Brevo credentials exist only in the backend environment; the GitHub token never
enters a browser bundle. User-provided URLs are never fetched except by the
strict GitHub provider, which accepts only `https://github.com` resources and
calls the fixed `https://api.github.com` origin.

## Authentication and sessions

- Access JWTs are short lived and sent as bearer tokens.
- Refresh JWTs rotate on every successful refresh. Only a SHA-256 digest is kept
  in MongoDB, so a database read does not expose a usable refresh token.
- The refresh cookie is HttpOnly, Secure in production, scoped to `/api/auth`,
  and SameSite=None for the cross-site Vercel/Render topology.
- Production login, registration, refresh, and logout require an exact trusted
  `Origin`; exact CORS allowlisting is also enforced. These controls prevent
  cross-site cookie mutation while retaining the split-origin deployment.
- Account status is checked on authenticated requests. Role and organization,
  team, project, opportunity, and application access are enforced on the server.

The current data model supports one active refresh session per user. A new login
invalidates the previous refresh session; this is intentional until per-device
sessions are modeled.

## HTTP and abuse controls

Helmet removes framework disclosure and supplies MIME, frame, referrer, and HSTS
protections. Vercel adds CSP, HSTS, Permissions Policy, COOP, frame denial, and
MIME protections. Request bodies default to 1 MiB. Route-specific limits cover
authentication, refresh, admin writes, task creation, public forms, GitHub,
discovery, collaboration, hackathons, opportunities, and applications. Render's
single trusted proxy hop is explicit so IP-based controls use the client address.

Every request receives a validated or generated request ID. Error responses use
`{ success: false, error: { code, message, request_id } }`; unexpected production
errors never return stack traces. Structured logs redact authorization, cookies,
passwords, secrets, tokens, API keys, and bearer values. Logs avoid email addresses.

## Data and files

Mongoose strict queries and filter sanitization are enabled. Dynamic operators
are wrapped with `mongoose.trusted` only after validation. Input arrays, strings,
URLs, identifiers, pagination, and upload counts/sizes are bounded by validators
or schemas. Attachments are magic-byte checked in local mode. Production refuses
local disk storage; file bytes are not persisted until a durable private object
store with authorization and malware scanning is implemented.

MongoDB notifications are the durable source of truth. SSE connections are an
authenticated, process-local acceleration channel only; clients reconnect and
refetch notifications after disconnects or deploys.

## External providers

Brevo has a 10-second default timeout and two bounded retries. Required mode
fails startup if its credentials are absent. Provider failures are logged without
recipient addresses or credentials and do not print provider payloads. GitHub
requests use an 8-second abort timeout, forbid redirects, handle provider rate
limits, cap accepted response size at 1 MiB, and return sanitized outage errors.

## Known security limitations

- Production Atlas network rules, user roles, backup policy, alert contacts, and
  restore evidence are operational controls and have not been verified here.
- There is no durable production attachment implementation, so attachments are
  deliberately unavailable rather than silently lossy.
- CSP currently names the deployed Render API origin. A custom backend domain
  requires a reviewed CSP update in `frontend/vercel.json`.
- Automated dependency scanning is in CI, but repository secret scanning and
  branch protection must also be enabled in the Git hosting settings.
