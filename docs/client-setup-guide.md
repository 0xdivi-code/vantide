# Vantide — Client Setup Guide

**Read this once, top to bottom, before touching anything.**
It walks you from "I have a zip / a link to some code" to "my trading site is
live on the internet with a private admin panel" — **without installing any
software and without writing any code.**

Everything is done through three free websites in your browser.

---

## What you are setting up (the 60-second version)

This app is made of three parts, each living on a different service:

| Part | What it is | Where it lives |
| --- | --- | --- |
| **The website code** | The trading site itself | **GitHub** (stores the code) |
| **The admin login + data** | Email/password sign-in and the data behind your admin panel | **Supabase** (a database service) |
| **The hosting** | The computers that run the site 24/7 and put it on the internet | **Vercel** |

You will create accounts on all three, connect them to each other, and you're
done. After the initial setup, the site updates itself whenever a file changes.

**Total time:** about 60–90 minutes, most of it waiting for things to finish.
**Total cost to start:** $0. (Paid upgrades are listed in
[Part 8 — Costs](#part-8--what-this-costs).)

### What you need before you start

- [ ] An email address you check regularly (used for all three sign-ups)
- [ ] A password manager or a safe place to write down passwords (you will
      create **five** — listed in [Appendix A](#appendix-a--every-password-you-will-create))
- [ ] Your own domain name, *if* you want one (e.g. `vantide.com`). This is
      optional — you get a working `something.vercel.app` address for free.
      You can add a domain at any time, including later.
- [ ] The code, handed to you by your developer (see next section)

> **A note on passwords:** the only genuinely secret ones are your **Supabase
> database password** and your **admin panel password**. Treat those like bank
> passwords. The other three are just account logins.

---

## Part 0 — Receive the code (GitHub)

Your developer will send you one of these:

- **An invitation email from GitHub** saying you've been added to a repository
  ("repo" = a folder of code stored on GitHub), **or**
- **A link to a public GitHub repository.**

1. **Create your GitHub account** (if you don't have one):
   go to <https://github.com/signup>, enter your email, pick a username and
   password, verify your email.
2. **Open the invitation email** and click **Accept** — or open the repo link.
   You should now see a page listing files and folders like `app`, `public`,
   `server`, `docs`. That's the website's code. Bookmark this page.

> Prefer the code in **your own** GitHub account instead of the developer's?
> Ask your developer to transfer the repo, or — once you're logged in — use
> <https://github.com/new/import>, paste the repo's address into "Your old
> repository's clone URL", give it a name, and click **Begin import**.

### The one skill you need: editing a file on GitHub

You'll use this in Part 2 and whenever you want to change settings later:

1. Open the file (click through the folders until you see the file, then click
   the file name).
2. Click the **pencil icon** (✏️ "Edit this file") at the top right of the file
   view.
3. Make your change — usually pasting a value between two quotes.
4. Scroll down and click the green **Commit changes** button. That's it —
   you've saved the file. (On Vercel, saving a file automatically triggers a
   rebuild of the site — see Part 3.)

**Golden rule:** only ever edit the file `public/config.js` (and only the
values listed in this guide). Every other file is the machinery — changing it
can break the site.

---

## Part 1 — Create the database (Supabase)

Supabase is a free (to start) online database. It does two jobs here: it holds
your admin panel's data, and it handles the email + password sign-in for the
admin panel.

### 1.1 Create the project

1. Go to <https://supabase.com> → **Start your project** → sign up (you can
   sign in with GitHub — one less password).
2. Click **New project**.
   - **Name:** anything, e.g. `vantide-production`
   - **Organization:** the default (your name)
   - **Database Password:** click **Generate a password** and **save it
     somewhere safe** — you won't see it again. *(Password #2 in Appendix A.)*
   - **Region:** pick the one closest to most of your users.
3. Click **Create new project** and wait ~2 minutes while it builds.

### 1.2 Create the admin tables

The admin panel expects 13 database tables. They're created by running one
script — copy/paste, no typing:

1. In a **new browser tab**, open your GitHub repo and navigate to:
   `server` → `admin` → `supabase` → `schema.sql`
2. Click the **"Copy raw contents"** button (top-right of the file view — the
   icon looks like two overlapping squares). The whole file is now copied.
3. Back in the **Supabase tab**: in the left sidebar, click **SQL Editor**
   (the icon with `>_`), then **New query**.
4. Click inside the big empty box and paste (Ctrl+V / Cmd+V).
5. Click **Run** (or press Ctrl+Enter).

You should see **"Success. No rows returned"** in green. You can now close
that query. The tables exist — you can see them under **Table Editor** in the
sidebar (each with a little shield icon, meaning they're private).

### 1.3 Create YOUR admin account

This is the email + password you'll type into the site's admin panel.

1. Sidebar → **Authentication** → **Users** → **Add user** → **Create new user**.
2. Enter:
   - **Email:** your email
   - **Password:** a strong one — **save it** *(Password #3 in Appendix A)*
   - Tick ✅ **Auto Confirm User** (otherwise sign-in will refuse you later)
3. Click **Create user**.

### 1.4 Give that account admin rights

Creating the account isn't enough — it also has to be marked as an operator.

1. Back in **SQL Editor** → **New query**.
2. Paste this, **replacing the email and name with yours**:

   ```sql
   insert into public.admin_operators (email, name, role)
   values ('you@example.com', 'Your Name', 'owner');
   ```

3. **Run**. Again: **"Success. No rows returned."**

### 1.5 Collect your four keys (important — do this carefully)

Your app needs four values from Supabase. Open them now and keep the tab open:
sidebar → **Project Settings** (gear icon, bottom-left) → **API**.

| # | Supabase calls it | Looks like | Goes to |
| --- | --- | --- | --- |
| 1 | **Project URL** | `https://abcdefgh.supabase.co` | GitHub (Part 2) **and** Vercel (Part 3) |
| 2 | **anon** / **public** key *(on newer projects: "publishable" key)* | `eyJhbGciOi...` (very long) | GitHub (Part 2) |
| 3 | **service_role** key *(on newer projects: "secret" key)* | `eyJhbGciOi...` (very long) | Vercel **only** (Part 3) |
| 4 | **JWT Secret** (under "JWT Settings" on the same page) | ~60 random characters | Vercel **only** (Part 3) |

> ⚠️ **Keep 3 and 4 secret.** The service_role key and the JWT secret are the
> master keys to your data. They only ever get pasted into Vercel's
> environment-variable screen (Part 4) — **never** into GitHub, never into an
> email, never into `config.js`.
>
> The Project URL and anon key are *not* secret — they're designed to be
> visible in a browser. Pasting them into GitHub in Part 3 is safe and normal.
>
> ⚠️ **If you can't find the JWT Secret:** Supabase is mid-migration to a new
> key system. Look for "JWT Settings" → "JWT Secret" on the API settings page
> (you may have to click *Reveal*). If your project only offers "Signing keys"
> (asymmetric), ask your developer for help before continuing — this app needs
> the classic symmetric secret.

Paste all four into a temporary note. (Not into a shared doc! They're keys.)

---

## Part 2 — Connect the app to Supabase (GitHub)

Now tell the website which Supabase project to use. This is a file edit in
GitHub — the skill from Part 0.

1. In your GitHub repo, open `public` → `config.js` → **pencil icon**.
2. Use the browser's Find (Ctrl+F / Cmd+F) to locate each line below, and
   replace **only the text between the quotes** on the right side. Keep the
   quotes, keep the comma at the end of the line.

Find:

```js
VITE_SUPABASE_URL: "",
```

change to (your value #1):

```js
VITE_SUPABASE_URL: "https://abcdefgh.supabase.co",
```

Find:

```js
VITE_SUPABASE_ANON_KEY: "",
```

change to (your value #2):

```js
VITE_SUPABASE_ANON_KEY: "eyJhbGciOi...your-long-anon-key...",
```

3. While you're in here, set the site's name — find and edit:

```js
VITE_APP_NAME: "Vantide",
VITE_ORDERLY_BROKER_NAME: "Vantide",
```

   (Both should usually be the same — your brand name.)

4. Scroll down, **Commit changes**.

> You'll notice other empty settings in this file (Privy, WalletConnect,
> Telegram…). All optional — covered in [Part 7](#part-7--optional-extras). Leave them empty for now.

---

## Part 3 — Put it on the internet (Vercel)

Vercel hosts the site and runs the private admin backend. It connects straight
to GitHub and rebuilds the site automatically whenever a file changes.

### 3.1 Create the project

1. Go to <https://vercel.com> → **Sign Up** → **Continue with GitHub**
   (this links the two accounts — accept the permissions).
2. Click **Add New…** → **Project**.
3. Find the repo in the list and click **Import**.
   - *Don't see it?* Next to the search box click **Adjust GitHub App
     Permissions** → **All repositories** (or select the repo) → Save, then
     come back.
4. On the configuration screen:
   - **Framework Preset:** leave whatever it shows (the repo includes a
     `vercel.json` that configures everything automatically).
   - **Root Directory:** leave as-is.
   - **Build and Output Settings:** leave as-is.
   - Do **not** click Deploy yet — first add the secrets (next step) so the
     very first deploy works.

### 3.2 Add the server secrets

Still on the same configuration screen, find **Environment Variables** and add
these three, one by one (click **Add** after each):

| Name (copy exactly) | Value |
| --- | --- |
| `SUPABASE_URL` | your value #1 (Project URL) |
| `SUPABASE_SERVICE_ROLE_KEY` | your value #3 (service_role / secret key) |
| `SUPABASE_JWT_SECRET` | your value #4 (JWT Secret) |

Leave "Environments" at the default (all three ticked).

### 3.3 Deploy

Click **Deploy**. The build takes **10–15 minutes** (it's a big app — go get a
coffee; the progress bar lies a little near the end, be patient).

When it finishes you'll see **Congratulations** and a link like
`vantide-xxxx.vercel.app`. **That's your live site.** Click it.

---

## Part 4 — Check everything works

Go through all five checks. If any fails, see [Troubleshooting](#troubleshooting).

1. **The site loads.** Open `https://your-site.vercel.app` — you should see
   the trading page with live prices.
2. **The backend is connected.** Open `https://your-site.vercel.app/api/admin/health`
   — you should see a line of text containing:
   `"supabaseConfigured":true,"jwtVerification":true,"store":"supabase"`
3. **The admin panel is locked.** Open `https://your-site.vercel.app/admin` —
   you should see a **sign-in box**, not a dashboard.
4. **You can sign in.** Enter the email + password from step 1.3 → you land in
   the Control Panel (dashboard, users, treasury, KYC, …).
5. **Data wiring works.** In the admin panel open **Users** (or
   **Notifications**): the page should load cleanly — rows, or an empty
   "no records yet" state — **without a red error banner**. That proves the
   panel is talking to your Supabase database with your signed-in identity.
   (The panel itself is read-only by design; all record changes happen through
   the systems behind it.)

🎉 **Done.** The site is live, the admin panel is private, and data persists.
Everything after this point is optional.

---

## Part 5 — Make it yours (branding)

All of this happens in that same `public/config.js` file on GitHub
(Part 0 skill), followed by **Commit changes**. Each commit redeploys the site
automatically (~10 min). Safe, commonly-changed settings:

| Setting | What it does |
| --- | --- |
| `VITE_APP_NAME` / `VITE_ORDERLY_BROKER_NAME` | The name shown in the browser tab and around the app |
| `VITE_SEO_SITE_URL` | Your site's address for search engines — set it to your real URL (e.g. `https://vantide.com/`) |
| `VITE_SEO_SITE_DESCRIPTION` | One-line description for Google results |
| `VITE_TELEGRAM_URL` / `VITE_DISCORD_URL` / `VITE_TWITTER_URL` | Your community links (full `https://…` URLs) |
| `VITE_ENABLED_MENUS` | Which top-menu sections appear: `Trading,Markets,Portfolio,Swap,Vaults,Rewards,Leaderboard,Points` — remove entries to hide sections |
| `VITE_CUSTOM_LOGO_URL` | A link to your logo image (upload it anywhere public, e.g. to the repo's `public/` folder — ask your developer for a hand the first time) |
| `VITE_ORDERLY_BROKER_ID` | ⚠️ See "Going live for real" below before touching this |

**Leave everything else alone** — especially anything containing the word
`CHAIN`, `SYMBOL_LIST`, or `ADMIN`. Those are wired to how the app works.

### Day-2: how changes work from now on

- **Change a setting** → edit `public/config.js` on GitHub → Commit → wait
  ~10 min → live. No other action needed.
- **Everything else** (new features, layout, bug fixes) → that's your
  developer's job. Ask them to make the change; once they commit, Vercel
  rebuilds automatically.

---

## Part 6 — Admin accounts: add and remove people

**Add a colleague** (they get their own login — never share yours):

1. Supabase → **Authentication** → **Users** → **Add user** → email +
   password + ✅ Auto Confirm → **Create user**.
2. **SQL Editor** → New query → paste (their email this time) → **Run**:

   ```sql
   insert into public.admin_operators (email, name, role)
   values ('colleague@example.com', 'Their Name', 'operator');
   ```

**Remove someone's access:**

```sql
update public.admin_operators set is_active = false
where email = 'colleague@example.com';
```

(Keeping the row with `is_active = false` is better than deleting it — instant
lockout, and history is preserved.)

---

## Part 7 — Optional extras

### Your own domain

1. Buy the domain anywhere (Namecheap, Cloudflare, GoDaddy… ~$10–15/yr).
2. Vercel → your project → **Settings** → **Domains** → enter the domain →
   **Add**.
3. Vercel shows you DNS records to create at the company where you bought the
   domain. Usually:
   - root domain (`vantide.com`) → **A record** → `76.76.21.21`
   - `www` → **CNAME** → `cname.vercel-dns.com`
4. Wait for DNS (minutes to a few hours), then Vercel issues HTTPS
   automatically.
5. Finally, set `VITE_SEO_SITE_URL` in `config.js` to the new domain.

### WalletConnect (QR-code wallet scanning in the wallet picker)

Without this, users with browser-extension wallets (MetaMask, Phantom…) can
connect fine; mobile-wallet users need WalletConnect:

1. <https://cloud.walletconnect.com> → sign up → **Create** a project (name it
   your brand) → copy the **Project ID**.
2. `config.js` → `VITE_WALLETCONNECT_PROJECT_ID: "paste-the-id-here"` → Commit.

### Privy (email / social login instead of crypto wallets)

Optional, changes how users sign in. Create an app at
<https://dashboard.privy.io>, put its **App ID** into `VITE_PRIVY_APP_ID`.
Leave empty to keep standard wallet connect. Ask your developer before
switching this on.

### Hiding the admin panel entirely

If you'd rather the panel not exist publicly at all, set
`VITE_ADMIN_ENABLED: "false"` in `config.js`. You can flip it back to `"true"`
any time.

### Going live for real (important — read this once)

Out of the box the app runs under Orderly Network's **demo broker ID**
(`VITE_ORDERLY_BROKER_ID: "demo"`). That's fine to launch and test with, but
it means accounts and fee arrangements run through Orderly's demo setup. To
operate under your own brand — your own broker ID, your own fee share — you
register with **Orderly Network** (<https://orderly.network>), and then simply
replace `demo` with the broker ID they issue. Ask your developer to coordinate
that switch; it's a one-line change plus a review.

---

## Part 8 — What this costs

| Service | Free tier | When you'd pay |
| --- | --- | --- |
| GitHub | Free forever | Rarely needed |
| Supabase | Free — **pauses after ~1 week of inactivity** (the site can't reach its data until you open the Supabase dashboard and click Restore; real traffic keeps it awake) | **Pro $25/mo** — recommended once the site is getting real visitors |
| Vercel | **Hobby** — free, but licensed for non-commercial/personal use | **Pro $20/mo** — required for a commercial business site |
| Domain | — | ~$10–15/year |

A realistic "we're live and serious" budget is therefore about **$45/month
plus the domain**.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Vercel build fails with "Killed" or out-of-memory | Transient build failure (this is a heavy build) | Deployments → ⋯ → **Redeploy**. If it keeps failing, contact your developer |
| `/admin` says "Supabase is not configured" | `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` missing/wrong in `config.js` | Part 2 — fix the two lines, Commit |
| Sign-in says email/password not accepted | User doesn't exist, or wrong password | Supabase → Authentication → Users — check the user exists; reset their password there if needed |
| "Confirm your email address…" at sign-in | User was created without Auto Confirm | Authentication → Users → open the user → **Confirm** |
| Signed in, but every screen shows 403 | The account isn't an operator | Redo step 1.4 (the `insert into admin_operators…`) |
| Signed in, but data screens show errors / "memory store" | Vercel env vars missing or typo'd | Part 3.2 — check the three names are exactly right, then Deployments → **Redeploy** |
| `/api/admin/health` shows `"store":"memory"` | Same as above — server can't see Supabase | Same as above |
| Everything worked, then stopped weeks later | Supabase free project paused | Open the Supabase dashboard → **Restore project** (or upgrade to Pro) |
| Site is fine but the address is `vercel.app` | You haven't added a domain | Part 7 — custom domain |
| You edited `config.js` but nothing changed | The rebuild is still running, or you edited a different file | Wait 10 min; Deployments tab shows the progress; verify the edit is in `public/config.js` |
| Something else | — | Screenshot the URL + the error message, send both to your developer |

**Before contacting your developer**, gather: the URL you were on, what you
expected, what happened instead, and a screenshot. That solves half of every
support ticket.

---

## Appendix A — Every password you will create

| # | For | Where it's used | Secret? |
| --- | --- | --- | --- |
| 1 | GitHub | github.com login | Normal account |
| 2 | Supabase **database password** | Generated in 1.1 — almost never typed again, but **losing it locks the database** | 🔐 **High** |
| 3 | **Admin panel user** | Sign-in at `your-site.vercel.app/admin` | 🔐 **High** |
| 4 | Vercel | vercel.com login | Normal account |
| 5 | (optional) domain registrar | Where you bought the domain | Normal account |

Plus three **keys** (not passwords — you copy/paste them): the Supabase
Project URL and anon key (not secret), and the service_role key + JWT secret
(🔐 **high** — Vercel only).

## Appendix B — Quick reference

| Thing | Address |
| --- | --- |
| Your code | `https://github.com/<you>/<repo>` |
| The only file you edit | `public/config.js` |
| Your database / admin users | `https://supabase.com/dashboard` |
| Your hosting / deploys | `https://vercel.com/dashboard` |
| Your live site | `https://<your-project>.vercel.app` (or your domain) |
| Admin panel | `https://<your-site>/admin` |
| Backend health check | `https://<your-site>/api/admin/health` |

## Appendix C — Tiny glossary

- **Deploy / build** — turning the code into the running website. Happens
  automatically on Vercel after every change (~10 min).
- **Environment variables** — private settings Vercel keeps on the server,
  invisible to visitors.
- **Repo (repository)** — the folder of code on GitHub.
- **Commit** — saving a file on GitHub. Always via the green button.
- **Broker ID** — your identifier with Orderly Network, the trading
  infrastructure this site runs on.

---

*Questions, errors, or anything that doesn't match this guide? Contact your
developer with a screenshot and the URL.*
