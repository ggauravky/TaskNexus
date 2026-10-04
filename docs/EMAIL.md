# Email delivery

TaskNexus has one transactional email path:

```text
controllers/services -> emailService -> Nodemailer -> Brevo SMTP relay
```

`backend/src/services/email/transporter.js` owns SMTP configuration and the
singleton transporter. Port 587 uses `secure: false` with STARTTLS required.
Controllers never construct transports and Gmail is not a fallback.

When `EMAIL_ENABLED=false`, delivery returns a truthful `EMAIL_DISABLED`
skipped result. When enabled, startup validates every required SMTP field but
does not contact Brevo. This keeps the core application available during an
SMTP outage. Delivery failures are logged without credentials, bodies, tokens,
or raw provider responses and do not roll back already-persisted business data.

Transient network errors and SMTP 4xx responses are retried up to
`EMAIL_MAX_ATTEMPTS` with exponential backoff from `EMAIL_RETRY_BASE_MS`.
Invalid recipients, template/configuration problems, and SMTP 5xx rejections
are not retried.

`npm run verify:email` checks configuration and templates without network
access. `npm run verify:email -- --connect` explicitly calls
`transporter.verify()` and never sends a message.

Brevo contact-list synchronization is separate from mail delivery and remains
optional through `BREVO_CONTACTS_API_KEY`. It does not make the HTTP API a mail
provider and is not required for application startup.
