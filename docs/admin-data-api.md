# Admin API & admin sign-in

The admin console has two data paths:

1. **Live frontend market data — works without a custom backend.** Dashboard, Trading Pairs, Analytics, public trader lookup and Risk fetch public data from the same Orderly mainnet/testnet the trading frontend uses.
2. **Private operator data — served by the admin API in this repository.** Users, KYC, treasury, funding, referrals, rewards, notifications, CMS, fees, security events, support tickets and system flags come from `/api/admin/*`, authenticated with a Supabase session.

Both are wired up by default: `public/config.js` ships with `VITE_ADMIN_API_URL: "/api/admin"`.

---

## 1. What ships

| Piece | Path | Runs on |
| --- | --- | --- |
| Router + handlers (the whole API) | `server/admin/router.ts`, `server/admin/store.ts`, `server/admin/auth.ts` | everywhere |
| Node adapter (body parsing, responses) | `server/admin/node.ts` | Vercel, Vite, standalone |
| Serverless entrypoint | `api/admin/[...path].ts` | Vercel (`/api/admin/*`) |
| Dev / preview middleware | `vite-plugins/admin-api.ts` | `vite dev`, `vite preview` |
| Standalone HTTP server | `server/standalone.ts` | any Node host |
| Supabase schema + RLS | `server/admin/supabase/schema.sql` | Supabase |
| Browser Supabase sign-in | `app/admin/auth/supabase.ts`, `app/admin/auth/AdminAuthProvider.tsx` | browser |
| Login screen | `app/pages/admin/Login.tsx` | browser |
| Test-suite | `scripts/test-admin-api.ts` (`yarn test:api`) | CI / local |

The three server adapters call the **same** `handleAdminRequest()`, so dev and production behave identically.

---

## 2. Quick start (local, zero config)

```bash
yarn install
yarn dev
```

Open `/admin`. With no Supabase credentials the API serves a deterministic bundled store, so every private screen has rows. `GET /api/admin/health` reports which store is active:

```json
{ "success": true, "data": { "status": "ok", "store": "memory", "jwtVerification": false } }
```

To call the API from curl locally, mint a token:

```bash
export SUPABASE_JWT_SECRET=dev-only-secret
export ADMIN_ALLOWLIST_EMAILS=ops@vantide.io
yarn dev                                   # terminal 1

SUPABASE_JWT_SECRET=dev-only-secret yarn api:token ops@vantide.io   # terminal 2
curl -H "Authorization: Bearer $TOKEN" http://localhost:5173/api/admin/users?limit=2
```

---

## 3. Supabase sign-in for `/admin`

The panel is gated by Supabase email + password. The access token Supabase returns is used twice: it unlocks the UI **and** is sent as `Authorization: Bearer …` on every `/api/admin/*` call, so the UI and the API share one identity.

### Browser side (safe for the browser)

`public/config.js` — or **Admin → Config Editor**:

```js
VITE_SUPABASE_URL: "https://your-project.supabase.co",
VITE_SUPABASE_ANON_KEY: "eyJhbGciOi…",      // anon key, never the service_role key
VITE_ADMIN_AUTH_MODE: "",                   // "" | "supabase" | "passcode" | "none"
VITE_ADMIN_PASSCODE: "",                    // legacy fallback gate
```

`VITE_ADMIN_AUTH_MODE` empty means: use Supabase when it is configured, otherwise fall back to `VITE_ADMIN_PASSCODE`, otherwise no gate.

### Server side (never in the browser)

`.env.example` lists every variable. On Vercel: Project → Settings → Environment Variables.

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL` | Project URL — enables Postgres as the data store |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only key used to read/write the admin tables |
| `SUPABASE_JWT_SECRET` | Verifies the admin access token (Settings → API → JWT Secret) |
| `ADMIN_ALLOWLIST_EMAILS` | Comma separated emails granted access |
| `ADMIN_API_KEY` | Optional machine key, sent as `x-admin-api-key` |
| `ADMIN_API_ALLOWED_ORIGINS` | Browser origins allowed cross-origin |
| `ADMIN_DATA_FILE` | Persist the memory store between restarts (local dev) |
| `ADMIN_API_REQUIRE_AUTH` | `false` disables auth — local hacking only |
| `ADMIN_API_ALLOW_MEMORY_STORE` | `false` makes the API 503 instead of serving bundled data |

### Granting an account admin access

An account passes when **any** of these is true:

1. it has a row in `public.admin_operators` with `is_active = true`;
2. its Supabase `app_metadata` contains `role: "admin"` (or `"owner"` / `"operator"`), or `admin: true`;
3. its email is in `ADMIN_ALLOWLIST_EMAILS`.

Run `server/admin/supabase/schema.sql` in the Supabase SQL editor, then:

```sql
insert into public.admin_operators (email, name, role)
values ('you@yourdomain.com', 'Owner', 'owner');
```

Any signed-in account that is not an operator receives `403 FORBIDDEN` from the API and stays on the login screen.

The browser talks to Supabase GoTrue (`{SUPABASE_URL}/auth/v1/*`) directly with the anon key — no extra dependency is bundled. Sessions are stored in `localStorage` under `vantide-admin-session`, refreshed 60s before expiry, and a `401` from the admin API triggers one automatic refresh before the login screen returns.

---

## 4. Endpoints

Base URL is `VITE_ADMIN_API_URL` (default `/api/admin`). Everything except `/health` and `/` requires credentials.

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/health` | Public liveness + configuration summary |
| `GET` | `/` | Endpoint index |
| `GET` | `/me` | Caller identity, role, resources, store in use |
| `GET` | `/overview` | Aggregates used for dashboards and alerting |
| `GET` | `/audit?limit=50` | Admin action log |
| `GET` | `/{resource}?limit=100` | List records |
| `GET` | `/{resource}/{id}` | Single record |
| `POST` | `/{resource}` | Create (returns `201`) |
| `PATCH` | `/{resource}/{id}` | Update fields |
| `OPTIONS` | any | CORS preflight |

`{resource}` is one of: `users`, `kyc`, `treasury`, `funding`, `referrals`, `rewards`, `notifications`, `cms`, `fees`, `security`, `support`, `system`.

### Query contract

`limit` (max 500, default 100), `offset`, `order=column.asc|desc`, `q=<search>`, plus any `column=value` filter — this is what the notification bell uses (`/notifications?limit=4&status=unread`).

### Response envelope

```json
{
  "success": true,
  "data": {
    "rows": [{ "id": "usr_tx11", "email": "trader@example.com", "status": "active" }],
    "total": 12,
    "limit": 100,
    "offset": 0,
    "store": "memory",
    "updated_at": 1787923599802
  },
  "meta": { "api": "1.0.0", "resource": "users" }
}
```

Errors use `{ "success": false, "code": "UNAUTHORIZED", "message": "…" }` with the matching HTTP status. The client also accepts a bare array or `items` / `results` / `records` instead of `rows`, and never substitutes demo data for a failure.

| Admin route | API resource |
| --- | --- |
| `/admin/users` | `GET /users?limit=100` |
| `/admin/users/:id` | `GET /users/:id?limit=100` |
| `/admin/fees` | `GET /fees?limit=100` |
| `/admin/treasury` | `GET /treasury?limit=100` |
| `/admin/funding` | `GET /funding?limit=100` |
| `/admin/referrals` | `GET /referrals?limit=100` |
| `/admin/rewards` | `GET /rewards?limit=100` |
| `/admin/notifications` | `GET /notifications?limit=100` |
| `/admin/cms` | `GET /cms?limit=100` |
| `/admin/kyc` | `GET /kyc?limit=100` |
| `/admin/security` | `GET /security?limit=100` |
| `/admin/support` | `GET /support?limit=100` |
| `/admin/system` | `GET /system?limit=100` |

---

## 5. Data store

- **Supabase configured** (`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`) → every read/write goes to the Postgres tables created by `server/admin/supabase/schema.sql`, through PostgREST with `Prefer: count=exact`. RLS is enabled *and* forced on all admin tables, so the browser's anon key cannot read them directly; only the server's service_role key can.
- **Not configured** → an in-process store seeded from `server/admin/seed.ts`. Deterministic, restartable, and optionally persisted with `ADMIN_DATA_FILE`. Set `ADMIN_API_ALLOW_MEMORY_STORE=false` to make the API return `503 STORE_DISABLED` instead.

Mutations are written to the audit log (`GET /audit`) with the actor's email, action, resource, target and changed fields.

---

## 6. Deployment

### Vercel (recommended — API and dapp share an origin)

`vercel.json` already builds the SPA. Add the `SUPABASE_*` variables and deploy; `api/admin/[...path].ts` is picked up automatically and served at `/api/admin/*`.

### Static host (GitHub Pages, S3, IPFS) + separate API host

Static hosts cannot run server code, so run the API elsewhere and point the dapp at it:

```bash
ADMIN_API_ALLOWED_ORIGINS=https://your-dapp.example \
SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… SUPABASE_JWT_SECRET=… \
npx tsx server/standalone.ts        # or: yarn api:dev
```

Then set `VITE_ADMIN_API_URL: "https://api.your-host.example/api/admin"` in `public/config.js`. The API echoes `Access-Control-Allow-Origin` only for origins listed in `ADMIN_API_ALLOWED_ORIGINS`, together with `Access-Control-Allow-Credentials: true`; `*` is never used for a specific origin.

---

## 7. Tests

```bash
yarn test:api
```

`scripts/test-admin-api.ts` drives the real `handleAdminRequest()` — the same function Vercel, the dev middleware and the standalone server call. It covers: public health, anonymous `401`, foreign-secret and expired tokens, `403` for non-operators, allowlist and `app_metadata` grants, the machine API key, all twelve resources, `limit` / `offset` / column filters, detail + `404`, `PATCH` with an audit entry, `POST` + `201`, empty-body `400`, unknown path `404`, unsupported method `405`, CORS preflight and origin rejection, the overview aggregate, `503 STORE_DISABLED`, and environment parsing.

---

## 8. Public Orderly queries used by the frontend views

The live market fallback uses Orderly's zero-auth Public Info API:

- `marketSummary` for Dashboard, Pairs and market Analytics
- `topAddresses` for the no-backend trader view
- `accountState` for a selected public wallet
- `platformPositions` for the no-backend Risk Monitor

These are read-only public network queries. They cannot create markets, move funds, or alter account state. See the [Orderly Public Info API](https://orderly.network/docs/build-on-omnichain/public-info-api/overview) for the upstream schema and rate limits.
