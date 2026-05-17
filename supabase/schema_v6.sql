-- schema_v6.sql — Vendor/Supplier Master
-- Run this in the Supabase SQL editor after schema_v5.sql

-- ------------------------------------------------------------
-- 1. Vendors table
-- ------------------------------------------------------------

create table if not exists public.vendors (
  id             text primary key,
  user_id        uuid not null references auth.users(id) on delete cascade,
  name           text not null default '',
  gstin          text default '',
  address        text default '',
  contact_person text default '',
  email          text default '',
  phone          text default '',
  notes          text default '',
  created_at     timestamptz default now()
);

create index if not exists idx_vendors_user on public.vendors(user_id);

alter table public.vendors enable row level security;

drop policy if exists "users own vendors" on public.vendors;
create policy "users own vendors" on public.vendors
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 2. Add vendor_id reference to expense_bills
-- ------------------------------------------------------------

alter table public.expense_bills
  add column if not exists vendor_id text references public.vendors(id) on delete set null;

create index if not exists idx_eb_vendor on public.expense_bills(vendor_id);
