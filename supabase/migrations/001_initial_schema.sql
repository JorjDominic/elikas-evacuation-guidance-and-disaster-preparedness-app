-- ──────────────────────────────────────────────────────────────────────────────
-- eLikas — Initial Database Schema
-- Run against your Supabase project via:
--   supabase db push           (using Supabase CLI)
-- or paste into Supabase Dashboard → SQL Editor.
-- ──────────────────────────────────────────────────────────────────────────────

-- ── Enable pgcrypto for gen_random_uuid() on older Postgres versions ─────────
create extension if not exists pgcrypto;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. PROFILES
--    Synced from auth.users via trigger.  One row per registered user.
-- ═══════════════════════════════════════════════════════════════════════════════
create table if not exists profiles (
  id          uuid        primary key references auth.users on delete cascade,
  name        text,
  email       text,
  role        text        not null default 'user' check (role in ('user', 'admin')),
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table profiles enable row level security;

-- Users can read/update their own profile
create policy "users can read own profile"
  on profiles for select
  using (auth.uid() = id);

create policy "users can update own profile"
  on profiles for update
  using (auth.uid() = id);

-- Admins can read all profiles
create policy "admins can read all profiles"
  on profiles for select
  using (
    (select role from profiles where id = auth.uid()) = 'admin'
  );

-- Admins can update all profiles (e.g. toggle is_active, change role)
create policy "admins can update all profiles"
  on profiles for update
  using (
    (select role from profiles where id = auth.uid()) = 'admin'
  );

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'user')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();


-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. AUDIT LOGS
--    Append-only log of admin actions.
-- ═══════════════════════════════════════════════════════════════════════════════
create table if not exists audit_logs (
  id           uuid        primary key default gen_random_uuid(),
  actor_id     uuid        references auth.users on delete set null,
  actor_name   text,
  action       text        not null,           -- e.g. 'create_alert', 'delete_center'
  target_type  text,                            -- e.g. 'alert', 'center', 'user'
  target_id    text,
  meta         jsonb       not null default '{}',
  created_at   timestamptz not null default now()
);

alter table audit_logs enable row level security;

create policy "admins can read audit_logs"
  on audit_logs for select
  using (
    (select role from profiles where id = auth.uid()) = 'admin'
  );

create policy "admins can insert audit_logs"
  on audit_logs for insert
  with check (
    (select role from profiles where id = auth.uid()) = 'admin'
  );

-- Index for common filters
create index if not exists idx_audit_logs_created_at on audit_logs (created_at desc);
create index if not exists idx_audit_logs_action on audit_logs (action);


-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. EVACUATION CENTERS
-- ═══════════════════════════════════════════════════════════════════════════════
create table if not exists evacuation_centers (
  id                 uuid        primary key default gen_random_uuid(),
  name               text        not null,
  municipality       text        not null,
  barangay           text,
  address            text,
  latitude           numeric(10, 6),
  longitude          numeric(10, 6),
  capacity           integer     not null check (capacity > 0),
  current_occupancy  integer     not null default 0 check (current_occupancy >= 0),
  status             text        not null default 'open' check (status in ('open', 'full', 'closed')),
  facilities         text[]      not null default '{}',  -- e.g. ['Toilets', 'Medical', 'Food']
  contact_person     text,
  contact_number     text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

alter table evacuation_centers enable row level security;

-- All authenticated users can read
create policy "authenticated users can read centers"
  on evacuation_centers for select
  using (auth.role() = 'authenticated');

-- Admins can manage
create policy "admins can manage centers"
  on evacuation_centers for all
  using (
    (select role from profiles where id = auth.uid()) = 'admin'
  );

create index if not exists idx_centers_municipality on evacuation_centers (municipality);
create index if not exists idx_centers_status on evacuation_centers (status);


-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. ALERTS
-- ═══════════════════════════════════════════════════════════════════════════════
create table if not exists alerts (
  id           uuid        primary key default gen_random_uuid(),
  title        text        not null,
  level        text        not null default 'medium' check (level in ('low', 'medium', 'high')),
  area         text        not null,
  description  text,
  latitude     numeric(10, 6),
  longitude    numeric(10, 6),
  created_by   uuid        references auth.users on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table alerts enable row level security;

-- All authenticated users can read
create policy "authenticated users can read alerts"
  on alerts for select
  using (auth.role() = 'authenticated');

-- Admins can manage
create policy "admins can manage alerts"
  on alerts for all
  using (
    (select role from profiles where id = auth.uid()) = 'admin'
  );

create index if not exists idx_alerts_created_at on alerts (created_at desc);
create index if not exists idx_alerts_level on alerts (level);


-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. GUIDES  (educational / preparedness content)
-- ═══════════════════════════════════════════════════════════════════════════════
create table if not exists guides (
  id           uuid        primary key default gen_random_uuid(),
  title        text        not null,
  type         text        not null default 'Guide',  -- 'Guide', 'Tip', 'Checklist', etc.
  content      text,
  created_by   uuid        references auth.users on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table guides enable row level security;

create policy "authenticated users can read guides"
  on guides for select
  using (auth.role() = 'authenticated');

create policy "admins can manage guides"
  on guides for all
  using (
    (select role from profiles where id = auth.uid()) = 'admin'
  );

create index if not exists idx_guides_type on guides (type);


-- ═══════════════════════════════════════════════════════════════════════════════
-- 6. HAZARD REPORTS  (user-submitted field reports)
-- ═══════════════════════════════════════════════════════════════════════════════
create table if not exists hazard_reports (
  id             uuid        primary key default gen_random_uuid(),
  hazard_type    text        not null,   -- 'Flooding', 'Landslide', 'Fire', 'Road Damage', 'Other'
  location       text,
  latitude       numeric(10, 6),
  longitude      numeric(10, 6),
  description    text,
  photo_url      text,                   -- public URL from Supabase Storage bucket 'hazard-photos'
  status         text        not null default 'pending' check (status in ('pending', 'reviewing', 'resolved', 'dismissed')),
  reporter_id    uuid        references auth.users on delete set null,
  reporter_name  text,
  reviewed_by    uuid        references auth.users on delete set null,
  reviewed_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table hazard_reports enable row level security;

-- Authenticated users can insert and read their own reports
create policy "users can insert hazard reports"
  on hazard_reports for insert
  with check (auth.role() = 'authenticated');

create policy "users can read own hazard reports"
  on hazard_reports for select
  using (reporter_id = auth.uid());

-- Admins can read and update all reports
create policy "admins can read all hazard reports"
  on hazard_reports for select
  using (
    (select role from profiles where id = auth.uid()) = 'admin'
  );

create policy "admins can update hazard reports"
  on hazard_reports for update
  using (
    (select role from profiles where id = auth.uid()) = 'admin'
  );

create index if not exists idx_hazard_reports_status on hazard_reports (status);
create index if not exists idx_hazard_reports_reporter on hazard_reports (reporter_id);
create index if not exists idx_hazard_reports_created_at on hazard_reports (created_at desc);


-- ═══════════════════════════════════════════════════════════════════════════════
-- 7. PUSH SUBSCRIPTIONS  (Web Push VAPID — for send-push-notification function)
-- ═══════════════════════════════════════════════════════════════════════════════
create table if not exists push_subscriptions (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        references auth.users on delete cascade,
  endpoint    text        not null unique,   -- Push service URL (unique per device+browser)
  p256dh      text        not null,          -- Public key from PushSubscription.getKey('p256dh')
  auth        text        not null,          -- Auth secret from PushSubscription.getKey('auth')
  created_at  timestamptz not null default now()
);

alter table push_subscriptions enable row level security;

-- Users can manage their own subscriptions
create policy "users can manage own push subscriptions"
  on push_subscriptions for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Service-role key (used by Edge Functions) bypasses RLS automatically.

create index if not exists idx_push_subs_user_id on push_subscriptions (user_id);


-- ═══════════════════════════════════════════════════════════════════════════════
-- 8. STORAGE BUCKETS
--    Run these separately in Supabase Dashboard → Storage, or via CLI.
--    Included here for documentation.
-- ═══════════════════════════════════════════════════════════════════════════════
-- bucket: hazard-photos  (public, 5 MB max, images only)
-- insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- values (
--   'hazard-photos', 'hazard-photos', true,
--   5242880,
--   array['image/jpeg','image/png','image/webp','image/gif']
-- ) on conflict (id) do nothing;
--
-- Storage RLS policy example (Dashboard → Storage → Policies):
--   Allow authenticated users to upload to hazard-photos:
--     bucket_id = 'hazard-photos' AND auth.role() = 'authenticated'
--   Allow public read:
--     bucket_id = 'hazard-photos'
