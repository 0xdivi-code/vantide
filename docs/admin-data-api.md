# Admin API: MongoDB data and authentication

The private operator console uses MongoDB for both operational records and authentication. It does **not** use JWT signing keys. A successful email/password login creates a cryptographically random, opaque session token; only its SHA-256 hash is stored in `admin_sessions`.

## Configuration

Copy `.env.example` to `.env.local` and set:

```env
MONGODB_URI=mongodb+srv://user:password@cluster.example.net/?retryWrites=true&w=majority
MONGODB_DATABASE=vantide
ADMIN_BOOTSTRAP_EMAIL=admin@example.com
ADMIN_BOOTSTRAP_PASSWORD=a-long-random-password
ADMIN_SESSION_TTL_HOURS=24
```

Keep all of these server-side. `public/config.js` only needs:

```js
VITE_ADMIN_API_URL: "/api/admin",
VITE_ADMIN_AUTH_MODE: "mongodb",
```

On the first login, the bootstrap operator is inserted into `admin_operators` if that email does not exist. Afterward, remove `ADMIN_BOOTSTRAP_PASSWORD` from the deployed environment. Passwords are stored as salted scrypt hashes.

## Collections

The API maps resources to these collections:

- `admin_users`, `admin_kyc`, `admin_treasury`, `admin_funding`
- `admin_referrals`, `admin_rewards`, `admin_notifications`, `admin_cms`
- `admin_fees`, `admin_security_events`, `admin_support_tickets`, `admin_system_flags`
- `admin_operators` — login accounts
- `admin_sessions` — hashed opaque sessions, with a TTL index
- `admin_audit` — mutation audit trail

Every operational document needs a unique application-level `id` field. MongoDB's internal `_id` is not returned to the browser.

## Auth endpoints

- `POST /api/admin/auth/login` with `{ "email": "…", "password": "…" }`
- `POST /api/admin/auth/refresh` with `Authorization: Bearer <opaque token>`
- `POST /api/admin/auth/logout` with the same header

Private resource requests use that bearer token. `ADMIN_API_KEY` remains available for trusted machine clients through `x-admin-api-key`.

## Data endpoints

`GET /api/admin/{resource}` supports `limit`, `offset`, `order=field.desc`, `q`, and exact field filters. `GET /{resource}/{id}`, `POST /{resource}`, and `PATCH /{resource}/{id}` provide reads and mutations. `/overview`, `/me`, and `/audit` are also private; `/health` is public.

With no `MONGODB_URI`, local development can use the bundled in-memory data. Email/password login is unavailable in that mode; use `ADMIN_API_REQUIRE_AUTH=false` only for local work. Set `ADMIN_API_ALLOW_MEMORY_STORE=false` in production to fail closed when MongoDB is unavailable or unconfigured.
