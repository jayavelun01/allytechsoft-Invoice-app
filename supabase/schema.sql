-- ============================================================
-- AllyTechSoft Invoice — Supabase schema
-- ------------------------------------------------------------
-- Run this entire script ONCE in your Supabase project's
-- SQL Editor (Supabase dashboard → SQL Editor → New query →
-- paste → Run).
--
-- It creates:
--   1. 5 tables (companies, settings, customers, invoices, invoice_items)
--   2. Indexes for common queries
--   3. Row Level Security policies — each user only sees their own data
--   4. A trigger that auto-creates company + settings rows on signup
--   5. An atomic save_invoice() RPC for transactional invoice saves
-- ============================================================


-- ------------------------------------------------------------
-- 1. Tables
-- ------------------------------------------------------------

create table if not exists public.companies (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text default '',
  email text default '',
  phone text default '',
  address text default '',
  tax_id text default '',
  logo text default '/logo.png',
  updated_at timestamptz default now()
);

create table if not exists public.settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  currency text default '₹',
  default_tax_rate numeric default 18,
  next_invoice_number integer default 1,
  invoice_prefix text default 'INV-',
  payment_terms text default 'Payment due within 15 days of invoice date. Bank transfer details available on request.',
  updated_at timestamptz default now()
);

create table if not exists public.customers (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  contact_person text default '',
  email text default '',
  phone text default '',
  address text default '',
  tax_id text default '',
  created_at timestamptz default now()
);

create table if not exists public.invoices (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  number text not null,
  customer_id text references public.customers(id) on delete set null,
  issue_date date,
  due_date date,
  tax_rate numeric default 0,
  discount numeric default 0,
  notes text default '',
  status text default 'draft' check (status in ('draft', 'sent', 'paid', 'overdue')),
  created_at timestamptz default now()
);

create table if not exists public.invoice_items (
  id text primary key,
  invoice_id text not null references public.invoices(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  description text default '',
  quantity numeric default 0,
  rate numeric default 0,
  position integer default 0
);


-- ------------------------------------------------------------
-- 2. Indexes
-- ------------------------------------------------------------

create index if not exists idx_customers_user      on public.customers(user_id);
create index if not exists idx_invoices_user       on public.invoices(user_id);
create index if not exists idx_invoices_customer   on public.invoices(customer_id);
create index if not exists idx_invoices_status     on public.invoices(status);
create index if not exists idx_invoice_items_inv   on public.invoice_items(invoice_id);
create index if not exists idx_invoice_items_user  on public.invoice_items(user_id);


-- ------------------------------------------------------------
-- 3. Row Level Security
-- Each user can only read/write their own rows.
-- ------------------------------------------------------------

alter table public.companies      enable row level security;
alter table public.settings       enable row level security;
alter table public.customers      enable row level security;
alter table public.invoices       enable row level security;
alter table public.invoice_items  enable row level security;

-- Drop any old policies (safe to re-run)
drop policy if exists "users own companies"      on public.companies;
drop policy if exists "users own settings"       on public.settings;
drop policy if exists "users own customers"      on public.customers;
drop policy if exists "users own invoices"       on public.invoices;
drop policy if exists "users own invoice_items"  on public.invoice_items;

create policy "users own companies" on public.companies
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users own settings" on public.settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users own customers" on public.customers
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users own invoices" on public.invoices
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users own invoice_items" on public.invoice_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ------------------------------------------------------------
-- 4. Auto-create company + settings on user signup
-- Trigger fires on insert into auth.users (i.e. signup time).
-- SECURITY DEFINER lets it bypass RLS for the seed inserts.
-- ------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.companies (user_id, email)
    values (new.id, coalesce(new.email, ''));

  insert into public.settings (user_id) values (new.id);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ------------------------------------------------------------
-- 5. Atomic invoice save (handles upsert + items + counter)
-- Called from the frontend via supabase.rpc('save_invoice', ...).
-- All work happens in a single transaction; safe across devices.
-- ------------------------------------------------------------

create or replace function public.save_invoice(
  p_invoice jsonb,
  p_items   jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id    uuid := auth.uid();
  v_invoice_id text;
  v_is_new     boolean;
  v_item       jsonb;
  v_position   int := 0;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  v_invoice_id := p_invoice->>'id';
  if v_invoice_id is null or v_invoice_id = '' then
    raise exception 'Invoice id is required';
  end if;

  -- Is this a brand-new invoice for this user?
  select not exists (
    select 1 from public.invoices
    where id = v_invoice_id and user_id = v_user_id
  ) into v_is_new;

  -- Upsert the invoice row
  insert into public.invoices (
    id, user_id, number, customer_id, issue_date, due_date,
    tax_rate, discount, notes, status, created_at
  ) values (
    v_invoice_id,
    v_user_id,
    p_invoice->>'number',
    nullif(p_invoice->>'customerId', ''),
    nullif(p_invoice->>'issueDate', '')::date,
    nullif(p_invoice->>'dueDate', '')::date,
    coalesce((p_invoice->>'taxRate')::numeric, 0),
    coalesce((p_invoice->>'discount')::numeric, 0),
    coalesce(p_invoice->>'notes', ''),
    coalesce(p_invoice->>'status', 'draft'),
    coalesce((p_invoice->>'createdAt')::timestamptz, now())
  )
  on conflict (id) do update set
    number      = excluded.number,
    customer_id = excluded.customer_id,
    issue_date  = excluded.issue_date,
    due_date    = excluded.due_date,
    tax_rate    = excluded.tax_rate,
    discount    = excluded.discount,
    notes       = excluded.notes,
    status      = excluded.status
  where invoices.user_id = v_user_id;

  -- Replace all items for this invoice
  delete from public.invoice_items
    where invoice_id = v_invoice_id and user_id = v_user_id;

  if jsonb_typeof(p_items) = 'array' then
    for v_item in select * from jsonb_array_elements(p_items)
    loop
      insert into public.invoice_items
        (id, invoice_id, user_id, description, quantity, rate, position)
      values (
        coalesce(nullif(v_item->>'id', ''), gen_random_uuid()::text),
        v_invoice_id,
        v_user_id,
        coalesce(v_item->>'description', ''),
        coalesce((v_item->>'quantity')::numeric, 0),
        coalesce((v_item->>'rate')::numeric, 0),
        v_position
      );
      v_position := v_position + 1;
    end loop;
  end if;

  -- Bump the next-invoice-number counter only for new invoices
  if v_is_new then
    update public.settings
       set next_invoice_number = next_invoice_number + 1
     where user_id = v_user_id;
  end if;
end;
$$;

grant execute on function public.save_invoice(jsonb, jsonb) to authenticated;


-- ------------------------------------------------------------
-- Done. Confirm by running:
--   select count(*) from information_schema.tables
--   where table_schema = 'public'
--     and table_name in ('companies','settings','customers','invoices','invoice_items');
-- It should return 5.
-- ------------------------------------------------------------
