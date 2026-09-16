# Getting started

## Install and run

```bash
yarn
yarn dev
```

The app and admin API run together. Open `/admin` for the operator console.

## Connect MongoDB

1. Create a MongoDB Atlas cluster (or use a reachable MongoDB deployment).
2. Create a database user and allow your deployment's network address.
3. Copy `.env.example` to `.env.local`.
4. Set `MONGODB_URI`, `MONGODB_DATABASE`, `ADMIN_BOOTSTRAP_EMAIL`, and a long `ADMIN_BOOTSTRAP_PASSWORD`.
5. Keep `VITE_ADMIN_API_URL: "/api/admin"` in `public/config.js`.
6. Restart `yarn dev`, then sign in at `/admin` with the bootstrap credentials.
7. Once the operator exists, remove `ADMIN_BOOTSTRAP_PASSWORD` from the environment.

MongoDB stores operational data, operator accounts, audit entries, and opaque login sessions. No JWT key is required.

On first use, empty resource collections are filled once from the bundled seed data so admin tables are not blank. Disable with `ADMIN_API_SEED_EMPTY=false` when you only want live records.

## Commands

```bash
yarn dev          # app and same-origin admin API
yarn api:dev      # standalone admin API on port 8787
yarn test:api     # router/API tests
yarn typecheck
yarn build
```

For Vercel, add the server-side MongoDB and bootstrap variables under Project Settings → Environment Variables. Never expose `MONGODB_URI`, `ADMIN_BOOTSTRAP_PASSWORD`, or `ADMIN_API_KEY` through a `VITE_*` variable.

See [Admin API: MongoDB data and authentication](./admin-data-api.md) for collections, endpoints, and production safety settings. See [Client setup](./client-setup-guide.md) for the trading application configuration.
