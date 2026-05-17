-- ============================================================
-- AllyTechSoft Invoice — v5 schema migration
-- ------------------------------------------------------------
-- Adds:
--   - credit_debit_notes + items  (Credit & Debit Notes for GST reversals)
--   - expense_bills + items       (Purchase Expense Bills / Inward Supply)
-- Run once in your Supabase SQL Editor on top of the v4 schema.
-- ============================================================


-- ------------------------------------------------------------
-- 1. Credit / Debit Notes
-- ------------------------------------------------------------

create table if not exists public.credit_debit_notes (
  id                      text primary key,
  user_id                 uuid not null references auth.users(id) on delete cascade,
  note_type               text not null default 'credit' check (note_type in ('credit', 'debit')),
  number                  text not null default '',
  note_date               date,
  original_invoice_id     text references public.invoices(id) on delete set null,
  original_invoice_number text default '',       -- free-text ref when original not in system
  customer_id             text references public.customers(id) on delete set null,
  customer_branch_id      text references public.customer_branches(id) on delete set null,
  branch_id               text references public.branches(id) on delete set null,
  reason                  text default '',
  gst_type                text default 'intra' check (gst_type in ('intra', 'inter')),
  place_of_supply         text default '',
  discount                numeric default 0,
  notes                   text default '',
  status                  text default 'draft' check (status in ('draft', 'issued', 'cancelled')),
  signing_authority       text default '',
  created_at              timestamptz default now()
);

create table if not exists public.credit_debit_note_items (
  id                    text primary key,
  credit_debit_note_id  text not null references public.credit_debit_notes(id) on delete cascade,
  user_id               uuid not null references auth.users(id) on delete cascade,
  product_id            text references public.products(id) on delete set null,
  description           text default '',
  hsn_code              text default '',
  unit                  text default 'Nos',
  quantity              numeric default 0,
  rate                  numeric default 0,
  gst_rate              numeric default 0,
  cgst_amount           numeric default 0,
  sgst_amount           numeric default 0,
  igst_amount           numeric default 0,
  position              integer default 0
);

create index if not exists idx_cdn_user       on public.credit_debit_notes(user_id);
create index if not exists idx_cdn_customer   on public.credit_debit_notes(customer_id);
create index if not exists idx_cdn_items_cdn  on public.credit_debit_note_items(credit_debit_note_id);
create index if not exists idx_cdn_items_user on public.credit_debit_note_items(user_id);

alter table public.credit_debit_notes       enable row level security;
alter table public.credit_debit_note_items  enable row level security;

drop policy if exists "users own CDNs"       on public.credit_debit_notes;
drop policy if exists "users own CDN items"  on public.credit_debit_note_items;

create policy "users own CDNs" on public.credit_debit_notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users own CDN items" on public.credit_debit_note_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ------------------------------------------------------------
-- 2. Expense Bills (Purchase / Inward Supply Bills)
-- ------------------------------------------------------------

create table if not exists public.expense_bills (
  id              text primary key,
  user_id         uuid not null references auth.users(id) on delete cascade,
  bill_number     text not null default '',
  bill_date       date,
  due_date        date,
  vendor_name     text default '',
  vendor_gstin    text default '',
  vendor_address  text default '',
  branch_id       text references public.branches(id) on delete set null,
  gst_type        text default 'intra' check (gst_type in ('intra', 'inter')),
  place_of_supply text default '',
  discount        numeric default 0,
  notes           text default '',
  status          text default 'draft' check (status in ('draft', 'received', 'paid', 'cancelled')),
  created_at      timestamptz default now()
);

create table if not exists public.expense_bill_items (
  id              text primary key,
  expense_bill_id text not null references public.expense_bills(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  product_id      text references public.products(id) on delete set null,
  description     text default '',
  hsn_code        text default '',
  unit            text default 'Nos',
  quantity        numeric default 0,
  rate            numeric default 0,
  gst_rate        numeric default 0,
  cgst_amount     numeric default 0,
  sgst_amount     numeric default 0,
  igst_amount     numeric default 0,
  position        integer default 0
);

create index if not exists idx_eb_user       on public.expense_bills(user_id);
create index if not exists idx_eb_items_eb   on public.expense_bill_items(expense_bill_id);
create index if not exists idx_eb_items_user on public.expense_bill_items(user_id);

alter table public.expense_bills       enable row level security;
alter table public.expense_bill_items  enable row level security;

drop policy if exists "users own EBs"       on public.expense_bills;
drop policy if exists "users own EB items"  on public.expense_bill_items;

create policy "users own EBs" on public.expense_bills
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users own EB items" on public.expense_bill_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ------------------------------------------------------------
-- Done. Verify with:
--   select table_name from information_schema.tables
--   where table_schema = 'public'
--     and table_name in (
--       'credit_debit_notes', 'credit_debit_note_items',
--       'expense_bills', 'expense_bill_items'
--     );
-- Should return 4 rows.
-- ------------------------------------------------------------
