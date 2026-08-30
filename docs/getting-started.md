# Getting started: run it locally, then connect Supabase

This walks through every step, in order. Part A gets the app running with zero
configuration. Part B connects a real Supabase project so `/admin` uses email +
password sign-in and stores data in Postgres.

> Handing the project to a non-programmer? Use
> [`docs/client-setup-guide.md`](./client-setup-guide.md) instead — it covers
> the GitHub → Supabase → Vercel flow without a terminal.

---

# Part A — Launch locally (no accounts needed)

### A1. Prerequisites

| Requirement | Check with | Notes |
| --- | --- | --- |
| Node 20 or newer | `node -v` | `package.json` declares `"node": ">=20.0.0"` |
| Yarn 1 (`classic`) | `yarn -v` | The repo ships a `yarn.lock`; npm works too but rewrites that file |
| Git | `git --version` | |

If Yarn is missing: `npm install --g yarn`.

### A2. Clone and install

```bash
git clone <your-repo-url> vantide
cd vantide
yarn install
```

`yarn install` pulls ~2,200 packages and takes a few minutes. If it fails with
`Client network socket disconnected`, your network is blocking
`registry.yarnpkg.com`; use npm instead:

```bash
npm install --legacy-peer-deps --registry https://registry.npmjs.org
```

> npm rewrites `yarn.lock` as a side effect. Run `git checkout -- yarn.lock`
> afterwards so you do not commit it.

### A3. Start the dev server

```bash
yarn dev
```

You should see:

```
✓ Generated: public/manifest.json
Using title from config.js: Vantide
  ➜  admin API  /api/admin (memory store, jwt off)

  VITE v7.1.9  ready in 1480 ms
  ➜  Local:   http://localhost:5173/
```

That `admin API /api/admin` line means the backend is mounted inside the dev
server — you do **not** run a second process. `memory store` means it is serving
the bundled dataset because no Supabase credentials are set yet.

To reach it from your phone or another machine:

```bash
npx vite --host 0.0.0.0
```

### A4. Check it works

| URL | What you should see |
| --- | --- |
| `http://localhost:5173/` | The trading dapp |
| `http://localhost:5173/admin` | The admin gate |
| `http://localhost:5173/api/admin/health` | `{"success":true,"data":{"status":"ok",…}}` |

With no Supabase configured and no passcode set, `/admin` is open. To see the
console with data in it, open `/admin/users`, `/admin/treasury`, `/admin/kyc` —
each one calls `/api/admin/{resource}` and renders the rows.

### A5. Try the API from the terminal

Create `.env.local` in the repo root (gitignored):

```bash
SUPABASE_JWT_SECRET=dev-only-secret
ADMIN_ALLOWLIST_EMAILS=you@example.com
```

`yarn dev`, `yarn api:dev` and `yarn api:token` all read `.env.local`
automatically. Start the dev server, then in a second terminal:

```bash
TOKEN=$(yarn --silent api:token you@example.com)
curl -H "Authorization: Bearer $TOKEN" http://localhost:5173/api/admin/me
curl -H "Authorization: Bearer $TOKEN" 'http://localhost:5173/api/admin/users?limit=2'
```

Without a token you get `401`; with a token for an email that is not an operator
you get `403`.

> If you prefer shell variables over a file, `export SUPABASE_JWT_SECRET=…`
> before `yarn dev` — a real environment variable always wins over `.env.local`.

---

# Part B — Connect Supabase

You need one Supabase project. Everything below happens in three places:

1. the **Supabase dashboard** (create tables, create your user, copy keys),
2. `.env.local` in the repo root — **server** secrets, never committed,
3. `public/config.js` (or the Config Editor) — **browser** settings, committed.

### B1. Create the project

1. Go to <https://supabase.com/dashboard> and sign in.
2. **New project** → pick a name, a strong database password, and the region
   closest to your users.
3. Wait for provisioning to finish (about a minute).

### B2. Create the admin tables

1. In the project sidebar open **SQL Editor** → **New query**.
2. Open [`server/admin/supabase/schema.sql`](../server/admin/supabase/schema.sql)
   from this repo, copy the whole file, paste it into the editor.
3. **Run**.

That creates 13 tables (`admin_operators`, `admin_users`, `admin_kyc`,
`admin_treasury`, `admin_funding`, `admin_referrals`, `admin_rewards`,
`admin_notifications`, `admin_cms`, `admin_fees`, `admin_security_events`,
`admin_support_tickets`, `admin_system_flags`), indexes for the list endpoints,
and enables **and forces** row level security on all of them — so the browser's
anon key can never read them directly. Only the server's `service_role` key can.

You can confirm in **Table Editor**: the tables appear, and the RLS column shows
a shield icon on each.

### B3. Create the sign-in account

`/admin` signs people in with **Supabase Auth**, so the account must exist in
Auth, not just in a table.

1. Sidebar → **Authentication** → **Users** → **Add user** → **Create new user**.
2. Enter the email and password you will type into the login screen.
3. Tick **Auto Confirm User** unless you want to test the email-confirmation
   flow. An unconfirmed user gets `Email not confirmed` at sign-in.

> Only people who exist in Auth *and* pass the operator check in B5 can get in.

### B4. Copy the four credentials

Open **Project Settings** (gear icon, bottom left) → **API**:

| What | Where it is in the dashboard | Where it goes |
| --- | --- | --- |
| Project URL | "Project URL", looks like `https://abcdefgh.supabase.co` | browser + server |
| `anon` `public` key | "Project API keys" → `anon` `public` | browser |
| `service_role` `secret` key | "Project API keys" → `service_role` `secret` | **server only** |
| JWT secret | "JWT Settings" → JWT Secret | **server only** |

Menu labels move around as Supabase ships changes; if you cannot find one,
search the settings page for the key name.

> **Heads-up on the JWT secret.** Supabase is migrating projects from the
> symmetric HS256 "JWT Secret" to asymmetric JWT signing keys. This API verifies
> tokens with **HS256** (`server/admin/jwt.ts`), so it needs the symmetric
> secret. If your project only offers signing keys, either use the legacy
> symmetric secret shown on that page, or keep the allowlist path
> (`ADMIN_ALLOWLIST_EMAILS`) and set `SUPABASE_JWT_SECRET` to the legacy value.

### B5. Grant that account admin access

An account is an operator if **any** of these is true:

1. it has a row in `admin_operators` with `is_active = true` ← recommended,
2. its Supabase `app_metadata` has `role: "admin"` (or `"owner"` / `"operator"`,
   or `admin: true`),
3. its email is listed in the server variable `ADMIN_ALLOWLIST_EMAILS`.

**Option 1 — the table (recommended).** In **SQL Editor**:

```sql
insert into public.admin_operators (email, name, role)
values ('you@example.com', 'Your Name', 'owner');
```

**Option 2 — app_metadata.** **Authentication** → **Users** → open the user →
**App Metadata** → set `{ "role": "admin" }`.

**Option 3 — env allowlist.** Add the email to `ADMIN_ALLOWLIST_EMAILS` in
`.env.local` (step B6). Fine for a solo operator; the table is better for teams.

A signed-in account that fails all three gets `403 FORBIDDEN` from the API and
stays on the login screen.

### B6. Give the server its secrets — `.env.local`

Create `.env.local` in the repo root (it is gitignored; `.env.example` documents
every variable):

```bash
SUPABASE_URL=https://abcdefgh.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi…service_role…
SUPABASE_JWT_SECRET=your-symmetric-jwt-secret

# Optional
ADMIN_ALLOWLIST_EMAILS=you@example.com
ADMIN_API_KEY=some-long-random-string
ADMIN_API_ALLOWED_ORIGINS=
```

Both `yarn dev` and `yarn api:dev` read `.env.local` (and `.env`) automatically:

- the Vite plugin loads them with Vite's `loadEnv` — see
  `vite-plugins/admin-api.ts`,
- the standalone server loads them with `loadDotEnv` — see `server/standalone.ts`.

A variable exported in your shell always wins over the file.

> Never put `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_JWT_SECRET` in
> `public/config.js`, a `VITE_` variable, or anywhere in `app/`. Everything
> there ships to every browser.

### B7. Give the browser its settings — `public/config.js`

Open `public/config.js` and fill in the two Supabase values:

```js
VITE_SUPABASE_URL: "https://abcdefgh.supabase.co",
VITE_SUPABASE_ANON_KEY: "eyJhbGciOi…anon…",
VITE_ADMIN_AUTH_MODE: "",          // "" = Supabase when configured
VITE_ADMIN_API_URL: "/api/admin",  // already set, leave it
```

These are safe for the browser — the anon key is designed to be public and RLS
keeps it away from the admin tables.

You can also set them without editing the file: open **/admin → Config Editor**,
fill in "Supabase project URL" and "Supabase anon key", **Save**, then **Export
config.js** and replace `public/config.js` with the download. Until you export,
the override lives only in your browser's localStorage.

> Local shortcut: `VITE_*` variables also work from `.env.local`, which is handy
> for keeping personal values out of git — e.g. `VITE_ADMIN_AUTH_MODE=passcode`
> plus `VITE_ADMIN_PASSCODE=…` to skip the Supabase login while developing.

### B8. Restart and sign in

Restart `yarn dev` (config changes need a restart). The startup line should now
read:

```
  ➜  admin API  /api/admin (supabase, jwt on)
```

`supabase` means reads and writes go to Postgres; `jwt on` means tokens are
being verified. Then:

1. Open `http://localhost:5173/admin`.
2. Enter the email and password you created in B3.
3. You land in the console, with your email in the top-right menu.

### B9. Confirm the wiring

| Check | Expected |
| --- | --- |
| `curl http://localhost:5173/api/admin/health` | `"supabaseConfigured":true,"jwtVerification":true,"store":"supabase"` |
| `/admin/users` | Rows from the `admin_users` table (empty until you insert some) |
| DevTools → Network → any `/api/admin/*` request | Request header `Authorization: Bearer eyJ…` |
| `admin_notifications` in Table Editor after creating a notification | A new row appears |

Because the Postgres tables start empty, the screens will show "no records"
rather than the bundled demo rows. Insert rows through the API or the Table
Editor:

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"title":"Hello from the API","severity":"info"}' \
  http://localhost:5173/api/admin/notifications
```

---

# Part C — Running the API as a separate process

`yarn dev` bundles the API into the dev server. If you would rather run it on its
own (a different port, a container, or a static-host setup where the dapp has no
server at all):

```bash
yarn api:dev          # reads .env / .env.local, listens on 0.0.0.0:8787
```

```
[admin-api] loaded from .env: SUPABASE_JWT_SECRET, …
[admin-api] listening on http://0.0.0.0:8787/api/admin
```

Then point the dapp at it in `public/config.js`:

```js
VITE_ADMIN_API_URL: "http://localhost:8787/api/admin",
```

Cross-origin needs an explicit allow-list — set
`ADMIN_API_ALLOWED_ORIGINS=http://localhost:5173` in `.env.local`. The API then
echoes that exact origin with `Access-Control-Allow-Credentials: true`; it never
answers `*` for a specific origin.

For a real deployment on a static host, use the HTTPS origin of the dapp:
`ADMIN_API_ALLOWED_ORIGINS=https://your-dapp.example`.

---

# Part D — Deploy

### Vercel (API and dapp share one origin)

1. Import the repo. `vercel.json` already sets the build command
   (`yarn run build`) and output directory (`build/client`).
2. Project → Settings → Environment Variables: add `SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, and optionally
   `ADMIN_ALLOWLIST_EMAILS` / `ADMIN_API_KEY`.
3. Deploy. `api/admin/[...path].ts` is picked up automatically and served at
   `/api/admin/*`, which is what `VITE_ADMIN_API_URL` already points at.
4. Add the deployed origin to Supabase → **Auth** → **URL Configuration** if
   sign-in reports a redirect/CORS problem.

### GitHub Pages / S3 / any static host

Static hosts cannot run server code, so deploy the API elsewhere (a Vercel
project, Fly, Render, a container running `server/standalone.ts`) and set
`VITE_ADMIN_API_URL` to that absolute URL plus `ADMIN_API_ALLOWED_ORIGINS` to the
dapp's origin. Note the existing workflow in `.github/workflows/deploy.yml`
builds with `yarn build:spa` and publishes `build/client` — it ships the dapp
only.

---

# Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `/admin` shows "Supabase is not configured" | `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` missing/empty | Add both to `public/config.js` (B7) and restart |
| "That email and password combination was not accepted" | Wrong credentials, or user does not exist in Auth | Create the user in Authentication → Users (B3) |
| "Confirm your email address in Supabase before signing in" | Email confirmation is on and the address is unconfirmed | Confirm the user, or tick **Auto Confirm User** |
| Signed in, but screens show 403 | Account is not an operator | B5 — add an `admin_operators` row, `app_metadata.role`, or allowlist the email |
| API returns 401 "SUPABASE_JWT_SECRET is not set" | Server variable missing | Add it to `.env.local` (B6) and restart |
| API returns 401 with a valid login | Project uses asymmetric JWT signing keys | Use the legacy symmetric secret, or rely on `ADMIN_ALLOWLIST_EMAILS` (B4) |
| Startup says `memory store` but you configured Supabase | `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` not reaching the server | Check `.env.local` spelling; a shell export overrides the file |
| API returns 503 `STORE_DISABLED` | `ADMIN_API_ALLOW_MEMORY_STORE=false` and no Supabase credentials | Set both Supabase server variables, or remove that flag |
| API returns 502 `SUPABASE_ERROR` | Table missing, or service_role key wrong | Re-run `schema.sql` (B2) and re-copy the key (B4) |
| Sign-in fails with a network/CORS error in the console | Origin not allowed by the Supabase project | Add your origin in Supabase → Auth → URL Configuration / API settings |
| Cross-origin API calls fail in the browser | `ADMIN_API_ALLOWED_ORIGINS` not set | Add the dapp's exact origin (Part C) |
| Private screens show "Connect an admin data source" | `VITE_ADMIN_API_URL` empty or invalid | Set it to `/api/admin` (or the absolute API URL) |

---

# Command reference

```bash
yarn install          # dependencies
yarn dev              # dapp + admin API on http://localhost:5173
yarn api:dev          # admin API only, on http://0.0.0.0:8787
yarn api:token <email>  # mint an admin token for curl (needs SUPABASE_JWT_SECRET)
yarn test:api         # 23 API tests against the real router
yarn typecheck        # tsc
yarn lint             # eslint
yarn build            # production build → build/client
yarn preview          # serve the production build (admin API included)
```

Reference docs: [admin API & sign-in](./admin-data-api.md) ·
[schema](../server/admin/supabase/schema.sql) ·
[environment variables](../.env.example)
