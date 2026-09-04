# TaskNexus API

Express API backed by Mongoose and MongoDB. See the repository [README](../README.md) for setup, authentication, database operations, deployment, and verification.

Useful commands:

```bash
npm run dev
npm test
npm run test:coverage
npm run database:indexes
npm run database:seed
npm run verify:database
npm run verify:mongodb-integration
npm run provision:admin
```

The API opens one MongoDB connection pool at startup, fails fast on connection errors, and does not fall back to local persistence.
