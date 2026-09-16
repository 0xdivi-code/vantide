# Vantide

Vantide is an Orderly-based trading application with a private operator console.

```bash
yarn
yarn dev
yarn typecheck
yarn test:api
```

## Admin console

`/admin` uses MongoDB for operational data and email/password authentication. Sessions are random opaque tokens stored as SHA-256 hashes, so no JWT signing key or external auth service is required.

Configure the server with `MONGODB_URI`, `MONGODB_DATABASE`, `ADMIN_BOOTSTRAP_EMAIL`, and `ADMIN_BOOTSTRAP_PASSWORD`; see [.env.example](./.env.example). The browser only receives `VITE_ADMIN_API_URL=/api/admin`.

Key locations:

- `server/admin/router.ts` — framework-neutral API router
- `server/admin/mongodb.ts` — pooled MongoDB connection
- `server/admin/auth.ts` — scrypt passwords and opaque sessions
- `server/admin/store.ts` — MongoDB resource access
- `app/admin/auth/session.ts` — browser session client
- `api/admin/[...path].ts` — Vercel adapter

Full setup: [Getting started](./docs/getting-started.md) · [Admin API](./docs/admin-data-api.md)
