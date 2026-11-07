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
- `admin_runtime_config` — one allowlisted public-frontend override document

Every operational document needs a unique application-level `id` field. MongoDB's internal `_id` is not returned to the browser.

### First-run seed

When `ADMIN_API_SEED_EMPTY=true`, the API inserts the bundled sample rows into any **empty** operational collection the first time it is read or written. Existing documents are never overwritten. The default is `true` for local development and **`false` when `NODE_ENV=production`**. Never enable these seeds in a real operator database: the bundled users, balances, KYC, treasury, and funding rows are demonstrations, not chain or Orderly records.

## Shared runtime configuration

`GET /api/admin/runtime-config` is public and returns only the string values in `shared/runtime-config.ts`'s allowlist, plus an update timestamp. It never returns the updating operator's identity. `PATCH /api/admin/runtime-config` requires the same admin session or machine key as private resources:

```json
{
  "changes": {
    "VITE_APP_NAME": "My DEX",
    "THEME_COLOR_PRIMARY": "#B084E9",
    "VITE_CUSTOM_LOGO_URL": "https://cdn.example.com/logo.svg",
    "VITE_ENABLE_CAMPAIGNS": null
  }
}
```

A string sets a value; `null` removes that shared override. Every successful update records the actor, changed keys, and removed keys in `admin_audit` (not the potentially large values). Values are validated for their field: theme colors are hex, menu/social links use HTTP(S), image data URLs are restricted to supported base64 image formats, and size/count limits apply. Invalid stored values are also filtered from public reads.

The browser resolves configuration in this order: local preview, shared override, `public/config.js`, build-time environment. Shared values load before the first render; API failure leaves the static fallback intact. Visitors receive new values on their next page load. Settings and Appearance clearly separate local previews from shared publishes.

The allowlist intentionally excludes broker IDs/EOAs, chain and wallet credentials, admin authentication, admin API location, and executable analytics markup. Keep those in deployment-controlled `public/config.js` or server environment variables. GitHub Pages cannot run the shared API; export and deploy `config.js` there instead.

## Auth endpoints

- `POST /api/admin/auth/login` with `{ "email": "…", "password": "…" }`
- `POST /api/admin/auth/refresh` with `Authorization: Bearer <opaque token>`
- `POST /api/admin/auth/logout` with the same header

Private resource requests use that bearer token. `ADMIN_API_KEY` remains available for trusted machine clients through `x-admin-api-key`.

## Data endpoints

`GET /api/admin/{resource}` supports `limit`, `offset`, `order=field.desc`, `q`, and exact field filters. `GET /{resource}/{id}`, `POST /{resource}`, and `PATCH /{resource}/{id}` provide reads and mutations. `/overview`, `/me`, and `/audit` are also private; `/health` is public.

With no `MONGODB_URI`, local development can explicitly use the bundled in-memory data. Email/password login is unavailable in that mode; use `ADMIN_API_REQUIRE_AUTH=false` only for local work. When `NODE_ENV=production`, `ADMIN_API_ALLOW_MEMORY_STORE` defaults to `false`, so private operational requests fail closed with `STORE_DISABLED` instead of displaying fake memory-backed operations. The public safe runtime-config read remains available for static fallback compatibility.
