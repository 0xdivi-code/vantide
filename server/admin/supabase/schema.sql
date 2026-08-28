-- ============================================================================
-- Vantide admin API schema
--
-- Run this in the Supabase SQL editor (or `supabase db push`) for the project
-- whose URL/keys you put in the server environment. Tables are read/written
-- by the API with the service_role key, so RLS is enabled and locked down:
-- nothing is reachable from the browser's anon key.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Who may use the admin panel / API.
-- An account is an operator when: it exists here with is_active = true,
-- OR its Supabase app_metadata has role = 'admin' / admin = true,
-- OR its email is listed in the ADMIN_ALLOWLIST_EMAILS server variable.
-- ---------------------------------------------------------------------------
create table if not exists public.admin_operators (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique,
  name        text,
  role        text not null default 'operator' check (role in ('owner', 'admin', 'operator')),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Grant the first operator: replace with your own Supabase auth email.
-- insert into public.admin_operators (email, name, role)
-- values ('you@yourdomain.com', 'Owner', 'owner');

-- ---------------------------------------------------------------------------
-- Resources served by GET /api/admin/{resource}
-- ---------------------------------------------------------------------------
create table if not exists public.admin_users (
  id                text primary key,
  name              text,
  email             text,
  address           text,
  status            text not null default 'active',
  tier              text,
  kyc_level         integer default 0,
  equity_usdc       numeric default 0,
  volume_30d_usdc   numeric default 0,
  open_positions    integer default 0,
  maker_fee_bps     integer default 20,
  taker_fee_bps     integer default 45,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

create table if not exists public.admin_kyc (
  id             text primary key,
  user_id        text references public.admin_users (id) on delete set null,
  full_name      text,
  country        text,
  document_type  text,
  status         text not null default 'pending',
  risk_score     integer default 0,
  submitted_at   timestamptz default now(),
  reviewed_at    timestamptz,
  reviewer       text
);

create table if not exists public.admin_treasury (
  id              text primary key,
  label           text,
  chain           text,
  address         text,
  type            text check (type in ('hot', 'cold', 'insurance')),
  balance_usdc    numeric default 0,
  threshold_usdc  numeric default 0,
  status          text default 'healthy',
  updated_at      timestamptz default now()
);

create table if not exists public.admin_funding (
  id             text primary key,
  user_id        text,
  address        text,
  type           text check (type in ('deposit', 'withdrawal')),
  asset          text default 'USDC',
  amount_usdc    numeric default 0,
  status         text default 'pending',
  confirmations  integer default 0,
  tx_hash        text,
  created_at     timestamptz default now()
);

create table if not exists public.admin_referrals (
  id                  text primary key,
  name                text,
  email               text,
  level               text,
  referees            integer default 0,
  commission_rate_bps integer default 0,
  earned_usdc         numeric default 0,
  paid_usdc           numeric default 0,
  status              text default 'active',
  created_at          timestamptz default now()
);

create table if not exists public.admin_rewards (
  id                text primary key,
  name              text,
  type              text,
  budget_usdc       numeric default 0,
  distributed_usdc  numeric default 0,
  participants      integer default 0,
  status            text default 'scheduled',
  starts_at         timestamptz,
  ends_at           timestamptz
);

create table if not exists public.admin_notifications (
  id          text primary key default 'ntf_' || substr(md5(random()::text), 1, 10),
  title       text not null,
  severity    text default 'info' check (severity in ('info', 'warning', 'critical')),
  channel     text default 'in_app',
  audience    text default 'all',
  status      text default 'unread',
  recipients  integer default 0,
  created_at  timestamptz default now()
);

create table if not exists public.admin_cms (
  id            text primary key,
  type          text,
  title         text,
  slug          text,
  status        text default 'draft',
  locale        text default 'en',
  author        text,
  published_at  timestamptz,
  updated_at    timestamptz default now()
);

create table if not exists public.admin_fees (
  id               text primary key,
  name             text,
  tier             integer default 0,
  maker_bps        integer default 0,
  taker_bps        integer default 0,
  min_volume_usdc  numeric default 0,
  status           text default 'active',
  updated_at       timestamptz default now()
);

create table if not exists public.admin_security_events (
  id          text primary key,
  user_id     text,
  event_type  text,
  ip_address  text,
  country     text,
  user_agent  text,
  severity    text default 'low',
  status      text default 'ok',
  created_at  timestamptz default now()
);

create table if not exists public.admin_support_tickets (
  id          text primary key,
  subject     text,
  user_id     text,
  email       text,
  priority    text default 'medium',
  status      text default 'open',
  assignee    text,
  messages    integer default 1,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create table if not exists public.admin_system_flags (
  id          text primary key,
  key         text unique not null,
  label       text,
  value       text,
  scope       text default 'global',
  updated_by  text,
  updated_at  timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- Row level security: the browser must never read these tables directly.
-- The API uses the service_role key, which bypasses RLS by design.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'admin_operators', 'admin_users', 'admin_kyc', 'admin_treasury', 'admin_funding',
    'admin_referrals', 'admin_rewards', 'admin_notifications', 'admin_cms',
    'admin_fees', 'admin_security_events', 'admin_support_tickets', 'admin_system_flags'
  ]
  loop
    execute format('alter table if exists public.%I enable row level security', t);
    execute format('alter table if exists public.%I force row level security', t);
  end loop;
end
$$;

-- Useful indexes for the list endpoints.
create index if not exists admin_users_created_at_idx on public.admin_users (created_at desc);
create index if not exists admin_kyc_submitted_at_idx on public.admin_kyc (submitted_at desc);
create index if not exists admin_funding_created_at_idx on public.admin_funding (created_at desc);
create index if not exists admin_notifications_created_at_idx on public.admin_notifications (created_at desc);
create index if not exists admin_support_created_at_idx on public.admin_support_tickets (created_at desc);
create index if not exists admin_security_created_at_idx on public.admin_security_events (created_at desc);
