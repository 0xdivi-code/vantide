# Vantide

Vantide perpetual DEX frontend.

## Quick start

```bash
yarn install
yarn dev          # dapp + admin API on http://localhost:5173
```

Step-by-step local setup and Supabase connection guide:
**[`docs/getting-started.md`](docs/getting-started.md)**

## Handing this?

**[`docs/client-setup-guide.md`](docs/client-setup-guide.md)** is a zero-terminal,
click-by-click guide (GitHub → Supabase → Vercel). 

## Admin console

`/admin` is the operator console. It is gated by a Supabase email + password
sign-in (`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` in `public/config.js`)
and reads private operational data from the bundled admin API at `/api/admin`:

- `server/admin/*` — the API (router, auth, data store, Node adapter)
- `api/admin/[...path].ts` — Vercel serverless entrypoint
- `vite-plugins/admin-api.ts` — serves the same API in `yarn dev` / `yarn preview`
- `server/standalone.ts` — standalone Node server for static hosts (`yarn api:dev`)
- `server/admin/supabase/schema.sql` — tables + RLS
- `yarn test:api` — the API test-suite

Reference: [`docs/admin-data-api.md`](docs/admin-data-api.md)

## Development

```bash
yarn install
yarn dev            # dapp + /api/admin on http://localhost:5173
yarn api:dev        # admin API only, on http://0.0.0.0:8787
yarn api:token you@example.com   # mint an admin token for curl
yarn test:api       # admin API tests
yarn typecheck
yarn build
```

Server-side secrets go in `.env.local` (see `.env.example`) — never in
`public/config.js` or any `VITE_` variable, which ship to every browser.
