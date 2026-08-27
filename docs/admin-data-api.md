# Live admin data integration

The admin console no longer fills operational screens with browser-generated users, balances, tickets, or transactions.

It has two data paths:

1. **Live frontend market data — works without a custom backend.** Dashboard, Trading Pairs, Analytics, public trader lookup, and Risk fetch public data from the same Orderly mainnet/testnet selected by the trading frontend. The dashboard applies `VITE_SYMBOL_LIST`, so it reports the markets visitors can actually use.
2. **Private operator data — requires an authenticated backend.** Customer identity, KYC, treasury, support, notifications, fees, and operations data must not be embedded in a browser bundle. Configure an API URL for these routes instead of falling back to sample records.

## Configure the API

Set this in `public/config.js` (or in **Admin → Settings**, then export the generated `config.js`):

```js
window.__RUNTIME_CONFIG__ = {
  // Same-origin is preferred: cookies and CSRF protections stay on the app host.
  VITE_ADMIN_API_URL: "/api/admin",

  // Optional. Leave empty to use the Orderly endpoint implied by the active
  // frontend network. This can be an upstream-compatible server-side proxy.
  VITE_ORDERLY_API_URL: "",

  // Optional. Market telemetry is clamped to 5 seconds–5 minutes.
  VITE_ADMIN_LIVE_REFRESH_MS: "15000",
};
```

A `VITE_ORDERLY_API_URL` override must expose the upstream-compatible `/v1/public/query` endpoint (and `/v1/public/futures_market` for the compatibility fallback) below that base path.

`VITE_*` values are public at runtime. **Never put a bearer token, database credential, signing key, or admin secret in `VITE_ADMIN_API_URL` or any other browser setting.** Use an HttpOnly session cookie (or an equivalent server-managed session) and enforce authorization on every backend request.

When `VITE_ADMIN_API_URL` is not set, private pages render a connection state rather than fabricated data. Public market views remain live.

## Read contract

Each private page sends a request like:

```http
GET /api/admin/users?limit=100
Accept: application/json
Cookie: session=…
```

The generic resource view accepts either a raw array or a JSON envelope. The recommended response is:

```json
{
  "data": {
    "rows": [
      {
        "id": "usr_123",
        "email": "trader@example.com",
        "status": "active",
        "created_at": 1787875200000
      }
    ],
    "total": 1,
    "updated_at": 1787875200000
  }
}
```

The client also understands `items`, `results`, or `records` in place of `rows`. Fields are rendered dynamically, and selecting a row exposes the full JSON payload for troubleshooting. A non-2xx response or `{ "success": false, "message": "…" }` is shown to the operator; it is never replaced with demo data.

The console requests these resources:

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

The notification bell additionally requests `GET /notifications?limit=4&status=unread`.

## Write operations

This change intentionally removes browser-only “approve”, “ban”, “transfer”, and similar actions. Those controls appeared to succeed locally but did not affect the exchange.

Add write routes only behind backend authorization and audit logging, for example:

```http
POST /api/admin/withdrawals/wdr_123/approve
Content-Type: application/json
X-CSRF-Token: <server-issued token>

{ "reason": "Reviewed by finance" }
```

After a successful write, call the page query's refresh function or return the updated collection. Do not rely on a frontend-only mutation for funds, KYC, market status, or account restrictions.

## CORS and authentication

- Prefer `/api/admin` on the same origin as the app.
- If the API must be cross-origin, allow the exact application origin, set `Access-Control-Allow-Credentials: true`, and do **not** use `*` for the allowed origin.
- Protect every endpoint with server-side role checks. The existing client-side admin passcode is only a convenience lock, not access control.
- Return no more data than the operator's role is allowed to inspect.

## Public Orderly queries used by the frontend views

The live fallback uses Orderly's zero-auth Public Info API:

- `marketSummary` for Dashboard, Pairs, and market Analytics
- `topAddresses` for the no-backend trader view
- `accountState` for a selected public wallet
- `platformPositions` for the no-backend Risk Monitor

These are read-only public network queries. They cannot create markets, move funds, or alter account state. See the [Orderly Public Info API](https://orderly.network/docs/build-on-omnichain/public-info-api/overview) for the upstream schema and rate limits.
