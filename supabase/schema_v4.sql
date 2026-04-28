-- ============================================================
-- AllyTechSoft Invoice — v4 schema migration
-- ------------------------------------------------------------
-- This migration is ADDITIVE. It does not drop or modify
-- existing data. Run it once in your Supabase SQL Editor on
-- top of an existing v3 database.
--
-- Adds:
--   - branches              (FROM-company branches/units, each with GSTIN)
--   - products              (product catalog)
--   - customer_branches     (multiple billing locations per customer)
--   - purchase_orders + items
--   - delivery_challans + items
--   - extends invoices and invoice_items with v4 fields
--   - new RLS policies and indexes
-- ============================================================


-- ------------------------------------------------------------
-- 1. Branches (multiple FROM-company branches/units)
-- ------------------------------------------------------------

create table if not exists public.branches (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  address text default '',
  state text default '',                 -- e.g. "Tamil Nadu"
  state_code text default '',            -- 2-digit GST state code, e.g. "33"
  gstin text default '',
  email text default '',
  phone text default '',
  signing_authority text default '',
  invoice_prefix text default 'INV-',
  next_invoice_number integer default 1,
  is_default boolean default false,
  created_at timestamptz default now()
);

create index if not exists idx_branches_user on public.branches(user_id);

alter table public.branches enable row level security;

drop policy if exists "users own branches" on public.branches;
create policy "users own branches" on public.branches
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ------------------------------------------------------------
-- 2. Products
-- ------------------------------------------------------------

create table if not exists public.products (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_code text default '',          -- e.g. "PRD-001"; user-managed
  name text not null,
  description text default '',
  hsn_code text default '',
  default_rate numeric default 0,
  default_gst_rate numeric default 18,
  unit text default 'Nos',               -- Nos / Kg / Hrs / Pcs / etc.
  created_at timestamptz default now()
);

create index if not exists idx_products_user on public.products(user_id);

alter table public.products enable row level security;

drop policy if exists "users own products" on public.products;
create policy "users own products" on public.products
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ------------------------------------------------------------
-- 3. Customer branches (multiple billing locations)
-- ------------------------------------------------------------

create table if not exists public.customer_branches (
  id text primary key,
  customer_id text not null references public.customers(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,                    -- e.g. "Chennai HQ", "Bengaluru Warehouse"
  address text default '',
  state text default '',
  state_code text default '',
  gstin text default '',
  contact_person text default '',
  email text default '',
  phone text default '',
  is_default boolean default false,
  created_at timestamptz default now()
);

create index if not exists idx_cust_branches_customer on public.customer_branches(customer_id);
create index if not exists idx_cust_branches_user     on public.customer_branches(user_id);

alter table public.customer_branches enable row level security;

drop policy if exists "users own customer_branches" on public.customer_branches;
create policy "users own customer_branches" on public.customer_branches
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ------------------------------------------------------------
-- 4. Add GST fields to existing customers table
-- ------------------------------------------------------------

alter table public.customers
  add column if not exists gstin text default '';

-- (v3 already has tax_id; we keep it for non-GST tax IDs / PAN.)


-- ------------------------------------------------------------
-- 5. Purchase orders + items
-- ------------------------------------------------------------

create table if not exists public.purchase_orders (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  number text not null,                  -- PO #
  po_date date,
  customer_id text references public.customers(id) on delete set null,
  customer_branch_id text references public.customer_branches(id) on delete set null,
  notes text default '',
  status text default 'open' check (status in ('open','closed','cancelled')),
  created_at timestamptz default now()
);

create table if not exists public.purchase_order_items (
  id text primary key,
  purchase_order_id text not null references public.purchase_orders(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text references public.products(id) on delete set null,
  description text default '',
  quantity numeric default 0,
  rate numeric default 0,
  unit text default 'Nos',
  position integer default 0
);

create index if not exists idx_po_user      on public.purchase_orders(user_id);
create index if not exists idx_po_customer  on public.purchase_orders(customer_id);
create index if not exists idx_po_items_po  on public.purchase_order_items(purchase_order_id);
create index if not exists idx_po_items_user on public.purchase_order_items(user_id);

alter table public.purchase_orders       enable row level security;
alter table public.purchase_order_items  enable row level security;

drop policy if exists "users own POs"       on public.purchase_orders;
drop policy if exists "users own PO items"  on public.purchase_order_items;

create policy "users own POs" on public.purchase_orders
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users own PO items" on public.purchase_order_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ------------------------------------------------------------
-- 6. Delivery challans + items
-- ------------------------------------------------------------

create table if not exists public.delivery_challans (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  number text not null,                  -- DC #
  dc_date date,
  customer_id text references public.customers(id) on delete set null,
  customer_branch_id text references public.customer_branches(id) on delete set null,
  purchase_order_id text references public.purchase_orders(id) on delete set null,
  vehicle_number text default '',
  lr_number text default '',
  lr_date date,
  delivery_mode text default '',
  notes text default '',
  status text default 'open' check (status in ('open','delivered','cancelled')),
  created_at timestamptz default now()
);

create table if not exists public.delivery_challan_items (
  id text primary key,
  delivery_challan_id text not null references public.delivery_challans(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text references public.products(id) on delete set null,
  description text default '',
  quantity numeric default 0,
  unit text default 'Nos',
  position integer default 0
);

create index if not exists idx_dc_user        on public.delivery_challans(user_id);
create index if not exists idx_dc_customer    on public.delivery_challans(customer_id);
create index if not exists idx_dc_items_dc    on public.delivery_challan_items(delivery_challan_id);
create index if not exists idx_dc_items_user  on public.delivery_challan_items(user_id);

alter table public.delivery_challans       enable row level security;
alter table public.delivery_challan_items  enable row level security;

drop policy if exists "users own DCs"       on public.delivery_challans;
drop policy if exists "users own DC items"  on public.delivery_challan_items;

create policy "users own DCs" on public.delivery_challans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users own DC items" on public.delivery_challan_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ------------------------------------------------------------
-- 7. Extend invoices with v4 fields
-- ------------------------------------------------------------

alter table public.invoices
  add column if not exists branch_id            text references public.branches(id) on delete set null,
  add column if not exists customer_branch_id   text references public.customer_branches(id) on delete set null,
  add column if not exists purchase_order_id    text references public.purchase_orders(id) on delete set null,
  add column if not exists delivery_challan_id  text references public.delivery_challans(id) on delete set null,
  add column if not exists gst_type             text default 'intra' check (gst_type in ('intra','inter')),
  add column if not exists place_of_supply      text default '',
  add column if not exists expected_delivery_date date,
  add column if not exists signing_authority    text default '',
  add column if not exists terms_and_conditions text default '',
  add column if not exists vehicle_number       text default '',
  add column if not exists lr_number            text default '',
  add column if not exists lr_date              date,
  add column if not exists delivery_mode        text default '';


-- ------------------------------------------------------------
-- 8. Extend invoice_items with v4 fields
-- ------------------------------------------------------------

alter table public.invoice_items
  add column if not exists product_id   text references public.products(id) on delete set null,
  add column if not exists hsn_code     text default '',
  add column if not exists unit         text default 'Nos',
  add column if not exists gst_rate     numeric default 18,
  add column if not exists cgst_amount  numeric default 0,
  add column if not exists sgst_amount  numeric default 0,
  add column if not exists igst_amount  numeric default 0;


-- ------------------------------------------------------------
-- 9. Updated atomic save_invoice() RPC
-- Replaces the v3 version. Handles all v4 fields including
-- per-line GST.
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
  v_branch_id  text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  v_invoice_id := p_invoice->>'id';
  if v_invoice_id is null or v_invoice_id = '' then
    raise exception 'Invoice id is required';
  end if;

  v_branch_id := nullif(p_invoice->>'branchId', '');

  select not exists (
    select 1 from public.invoices
    where id = v_invoice_id and user_id = v_user_id
  ) into v_is_new;

  insert into public.invoices (
    id, user_id, number, customer_id, customer_branch_id, branch_id,
    purchase_order_id, delivery_challan_id,
    issue_date, due_date, expected_delivery_date,
    tax_rate, discount, notes, status,
    gst_type, place_of_supply, signing_authority, terms_and_conditions,
    vehicle_number, lr_number, lr_date, delivery_mode,
    created_at
  ) values (
    v_invoice_id, v_user_id,
    p_invoice->>'number',
    nullif(p_invoice->>'customerId', ''),
    nullif(p_invoice->>'customerBranchId', ''),
    v_branch_id,
    nullif(p_invoice->>'purchaseOrderId', ''),
    nullif(p_invoice->>'deliveryChallanId', ''),
    nullif(p_invoice->>'issueDate', '')::date,
    nullif(p_invoice->>'dueDate', '')::date,
    nullif(p_invoice->>'expectedDeliveryDate', '')::date,
    coalesce((p_invoice->>'taxRate')::numeric, 0),
    coalesce((p_invoice->>'discount')::numeric, 0),
    coalesce(p_invoice->>'notes', ''),
    coalesce(p_invoice->>'status', 'draft'),
    coalesce(p_invoice->>'gstType', 'intra'),
    coalesce(p_invoice->>'placeOfSupply', ''),
    coalesce(p_invoice->>'signingAuthority', ''),
    coalesce(p_invoice->>'termsAndConditions', ''),
    coalesce(p_invoice->>'vehicleNumber', ''),
    coalesce(p_invoice->>'lrNumber', ''),
    nullif(p_invoice->>'lrDate', '')::date,
    coalesce(p_invoice->>'deliveryMode', ''),
    coalesce((p_invoice->>'createdAt')::timestamptz, now())
  )
  on conflict (id) do update set
    number                = excluded.number,
    customer_id           = excluded.customer_id,
    customer_branch_id    = excluded.customer_branch_id,
    branch_id             = excluded.branch_id,
    purchase_order_id     = excluded.purchase_order_id,
    delivery_challan_id   = excluded.delivery_challan_id,
    issue_date            = excluded.issue_date,
    due_date              = excluded.due_date,
    expected_delivery_date = excluded.expected_delivery_date,
    tax_rate              = excluded.tax_rate,
    discount              = excluded.discount,
    notes                 = excluded.notes,
    status                = excluded.status,
    gst_type              = excluded.gst_type,
    place_of_supply       = excluded.place_of_supply,
    signing_authority     = excluded.signing_authority,
    terms_and_conditions  = excluded.terms_and_conditions,
    vehicle_number        = excluded.vehicle_number,
    lr_number             = excluded.lr_number,
    lr_date               = excluded.lr_date,
    delivery_mode         = excluded.delivery_mode
  where invoices.user_id = v_user_id;

  delete from public.invoice_items
    where invoice_id = v_invoice_id and user_id = v_user_id;

  if jsonb_typeof(p_items) = 'array' then
    for v_item in select * from jsonb_array_elements(p_items)
    loop
      insert into public.invoice_items (
        id, invoice_id, user_id, product_id,
        description, hsn_code, unit, quantity, rate,
        gst_rate, cgst_amount, sgst_amount, igst_amount,
        position
      ) values (
        coalesce(nullif(v_item->>'id', ''), gen_random_uuid()::text),
        v_invoice_id, v_user_id,
        nullif(v_item->>'productId', ''),
        coalesce(v_item->>'description', ''),
        coalesce(v_item->>'hsnCode', ''),
        coalesce(v_item->>'unit', 'Nos'),
        coalesce((v_item->>'quantity')::numeric, 0),
        coalesce((v_item->>'rate')::numeric, 0),
        coalesce((v_item->>'gstRate')::numeric, 0),
        coalesce((v_item->>'cgstAmount')::numeric, 0),
        coalesce((v_item->>'sgstAmount')::numeric, 0),
        coalesce((v_item->>'igstAmount')::numeric, 0),
        v_position
      );
      v_position := v_position + 1;
    end loop;
  end if;

  -- Bump per-branch counter for new invoices when a branch is set,
  -- else fall back to the global settings counter (legacy v3 behavior).
  if v_is_new then
    if v_branch_id is not null then
      update public.branches
         set next_invoice_number = next_invoice_number + 1
       where id = v_branch_id and user_id = v_user_id;
    else
      update public.settings
         set next_invoice_number = next_invoice_number + 1
       where user_id = v_user_id;
    end if;
  end if;
end;
$$;

grant execute on function public.save_invoice(jsonb, jsonb) to authenticated;


-- ------------------------------------------------------------
-- 10. Block deletion of non-draft invoices (GST compliance)
-- A trigger that prevents removing invoices once issued.
-- ------------------------------------------------------------

create or replace function public.prevent_non_draft_invoice_delete()
returns trigger
language plpgsql
as $$
begin
  if old.status is not null and old.status <> 'draft' then
    raise exception
      'Cannot delete invoice % with status %. GST law requires invoice numbers to remain in sequence.',
      old.number, old.status
      using hint = 'Mark the invoice as cancelled instead, or issue a credit note.';
  end if;
  return old;
end;
$$;

drop trigger if exists trg_prevent_non_draft_invoice_delete on public.invoices;
create trigger trg_prevent_non_draft_invoice_delete
  before delete on public.invoices
  for each row execute function public.prevent_non_draft_invoice_delete();


-- ------------------------------------------------------------
-- 11. Allow 'cancelled' as a valid invoice status
-- ------------------------------------------------------------

alter table public.invoices drop constraint if exists invoices_status_check;
alter table public.invoices
  add constraint invoices_status_check
  check (status in ('draft', 'sent', 'paid', 'overdue', 'cancelled'));


-- ------------------------------------------------------------
-- Done. Verify by running:
--   select count(*) from information_schema.tables
--   where table_schema = 'public'
--     and table_name in (
--       'branches', 'products', 'customer_branches',
--       'purchase_orders', 'purchase_order_items',
--       'delivery_challans', 'delivery_challan_items'
--     );
-- It should return 7.
-- ------------------------------------------------------------
