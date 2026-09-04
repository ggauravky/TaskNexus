# TaskNexus architecture baseline

## Frontend

The frontend is a React 18 SPA built with Vite and Tailwind CSS. React Router owns public, client, freelancer, and admin routes. Axios provides the JSON API client. Authenticated identity is restored through the refresh flow and `/api/auth/me`, not a cached user object.

## Backend and database

The backend is one Express application. Routes call controllers, controllers coordinate services, services enforce business rules, and focused data modules call Mongoose models. MongoDB is the only canonical application database.

```text
React → Express → services/data modules → Mongoose → MongoDB Atlas
```

TaskNexus uses UUID/string values as MongoDB `_id` values. The API exposes them as `id`; no ObjectId compatibility layer exists. Independent or high-contention records—skills, education, submissions, comments, milestones, activity, and notifications—remain separate collections. Flexible task details and workflow metadata remain bounded nested objects.

Multi-document writes use MongoDB transactions. Task acceptance uses a conditional atomic update so only one freelancer can win. Team creation, membership transitions, invitation acceptance, request approval, and ownership transfer use transactions plus unique indexes. Production disables automatic index creation; indexes are synchronized as an explicit deployment step.

## Authentication and authorization

- Public roles: `client`, `freelancer`
- Privileged role: `admin`, created only by the provisioning command
- Access token: short lived, frontend memory, Bearer header
- Refresh token: rotating, HttpOnly cookie, matched to the user record
- Authorization: API authentication, role checks, and resource ownership
- Team authorization: active membership plus contextual `owner`, `admin`, or `member`; global account role never grants team access
- Sensitive model fields: excluded from queries by default and omitted by DTO serializers

## Realtime, uploads, and email

Realtime uses authenticated Server-Sent Events. The hub is process-local and needs a shared broker before horizontal scaling. Task attachments are signature-checked, privately downloaded, and stored under `UPLOAD_PATH`; durable object storage is deferred. Brevo handles configured email flows, and public forms have dedicated validation and rate limiting.

## Deployment

- Frontend: Vercel
- Backend: Render
- Database: MongoDB Atlas
- Health: `/health` returns minimal application/database readiness
- CORS: explicit credentialed origin allowlist
- Shutdown: closes the shared MongoDB pool on `SIGTERM` and `SIGINT`

## Known technical debt

- Realtime delivery is process-local.
- Attachment storage is private but not durable object storage.
- Cross-site refresh cookies remain subject to browser third-party-cookie policy.
- Several dashboard modules remain large.
- Realtime team notifications are durable immediately but the process-local SSE hub does not publish transaction-created team events until clients refresh/poll.
- Teams currently calculate member counts; no denormalized counter is stored.
- Projects and project-scoped permissions intentionally remain outside this baseline.
