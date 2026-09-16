# Client setup guide

This repository has two separate integrations:

1. Orderly and wallet settings in `public/config.js` power the trading app.
2. MongoDB powers the private admin console, operator accounts, and opaque sessions.

## Trading client

Set the broker ID, broker name, EOA address, enabled networks, wallet providers, branding, and links in `public/config.js`. Values in this file are public and shipped to every visitor; never place a database URI or password there.

## Admin API and MongoDB

Create a MongoDB Atlas cluster or another reachable MongoDB deployment. Create a least-privilege database user and allow network access from the API deployment. Then configure these **server-side** variables:

```env
MONGODB_URI=mongodb+srv://user:password@cluster.example.net/?retryWrites=true&w=majority
MONGODB_DATABASE=vantide
ADMIN_BOOTSTRAP_EMAIL=admin@example.com
ADMIN_BOOTSTRAP_PASSWORD=use-a-long-random-password
ADMIN_SESSION_TTL_HOURS=24
ADMIN_API_ALLOW_MEMORY_STORE=false
```

In `public/config.js`, leave only the browser-safe API location:

```js
VITE_ADMIN_API_URL: "/api/admin",
VITE_ADMIN_AUTH_MODE: "mongodb",
```

Deploy, visit `/admin`, and use the bootstrap credentials. The server creates the first `admin_operators` document with a salted scrypt password hash. Remove `ADMIN_BOOTSTRAP_PASSWORD` from the deployment after that first successful setup.

The login response is an opaque random token, not a JWT. MongoDB stores only its SHA-256 hash in `admin_sessions`, and a TTL index removes expired sessions.

## Vercel

Add all non-`VITE_*` settings under Project Settings → Environment Variables. The function at `api/admin/[...path].ts` serves the API. Keep `VITE_ADMIN_API_URL` same-origin (`/api/admin`) unless you intentionally run the standalone API elsewhere and configure `ADMIN_API_ALLOWED_ORIGINS`.

## Verify

- `GET /api/admin/health` should report `"store":"mongodb"` and `"auth":"opaque-session"`.
- `/admin` should accept the bootstrap operator.
- Private requests should include `Authorization: Bearer <opaque token>`.
- MongoDB should contain `admin_operators`, `admin_sessions`, and the resource collections as data is created.

If health reports `memory`, the server did not receive `MONGODB_URI`. If login reports that MongoDB auth is not configured, check the deployed server environment and redeploy. If Atlas times out, check its network access list and database-user permissions.

More detail: [Admin API](./admin-data-api.md) · [Getting started](./getting-started.md)
