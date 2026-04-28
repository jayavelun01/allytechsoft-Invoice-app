# AllyTechSoft Invoice — v4

A multi-device, GST-compliant invoicing system built with **React + Vite + Tailwind CSS** and **Supabase** (PostgreSQL + Auth).

## What's new in v4

- **Multiple branches/units** under your company, each with its own GSTIN and invoice number sequence
- **Product catalog** — pick from saved products when creating invoices, POs, and DCs
- **Customer branches** — multiple billing locations per customer, each with its own GSTIN and state
- **Purchase Orders** — track PO # / date / products from customers
- **Delivery Challans** — track DC # / vehicle / LR / dispatched products
- **Per-line GST** — mix 12%, 18%, 28% on the same invoice
- **CGST + SGST vs IGST** — manual selection per invoice (auto-detected from states as a hint)
- **Logistics fields** on invoices — delivery mode, vehicle number, LR number/date, expected delivery date
- **Signing authority** + **T&C** per invoice
- **PDF download** for invoices (multi-page A4)
- **Email-to** opens the user's mail client with pre-filled recipient/subject/body
- **GST Dashboard** — collected/outstanding GST by period, by rate, by customer, by month, with CSV export
- **GST compliance** — non-draft invoices cannot be deleted (use Cancelled status instead)

## Architecture

```
┌─────────────────────────────────┐
│  React frontend (Hostinger)     │
└────────────┬────────────────────┘
             │ HTTPS
             ▼
┌─────────────────────────────────┐
│  Supabase                       │
│  ├─ PostgreSQL                  │
│  ├─ Auth                        │
│  ├─ Auto REST API               │
│  └─ Row Level Security          │
└─────────────────────────────────┘
```

One codebase, one frontend deployment, no backend code to maintain.

---

## Part A — Apply the v4 schema migration

If you're upgrading from v3, your existing data (customers, invoices, settings, company) is preserved. The v4 migration is **additive** — it adds new tables and columns without dropping anything.

### Steps

1. Open your Supabase project → **SQL Editor** → **+ New query**
2. Open `supabase/schema_v4.sql` from this repo, copy the entire contents, paste into the SQL editor
3. Click **Run** (Ctrl/Cmd + Enter)
4. Verify by running:
   ```sql
   select count(*) from information_schema.tables
   where table_schema = 'public'
     and table_name in (
       'branches', 'products', 'customer_branches',
       'purchase_orders', 'purchase_order_items',
       'delivery_challans', 'delivery_challan_items'
     );
   ```
   Should return **7**.

### What the migration does

- Creates 7 new tables (branches, products, customer_branches, purchase_orders + items, delivery_challans + items)
- Adds `gstin` to `customers`
- Adds 14 new columns to `invoices` (branch_id, customer_branch_id, PO/DC links, GST type, place of supply, vehicle, LR, expected delivery, signing authority, T&C, etc.)
- Adds 7 new columns to `invoice_items` (product_id, hsn_code, unit, gst_rate, cgst/sgst/igst amounts)
- Replaces `save_invoice()` RPC with v4 version supporting all new fields
- Adds a trigger preventing deletion of non-draft invoices (GST compliance)
- Allows `'cancelled'` as a new invoice status
- Sets up RLS policies on all new tables

### If you're starting fresh (no v3 data)

Run **both** schema files in order:
1. `supabase/schema.sql` (creates the v3 base)
2. `supabase/schema_v4.sql` (adds v4 extensions)

---

## Part B — Local development

```bash
npm install
cp .env.example .env.local      # then edit .env.local with your Supabase URL + key
npm run dev                     # http://localhost:5174
```

Build for production:
```bash
npm run build
```

---

## Part C — First-time setup checklist

After signing in for the first time (or with fresh data), do these in order:

1. **Settings** — fill in your company name, currency, default GST rate
2. **Branches** — add at least one branch with GSTIN and state
3. **Products** — add your common products (you can add more later)
4. **Customers** — add a customer; click "branches" to add their billing locations
5. **Invoices** — create your first invoice

The Dashboard shows a setup checklist that walks through this.

---

## Workflow: PO → DC → Invoice

The three documents are **independent** — you can create them in any order, or skip steps. They connect via optional links:

- **PO** captures the customer's order details (just qty + rate, no GST)
- **DC** captures dispatch (vehicle, LR). Can pull items from a linked PO.
- **Invoice** is the final taxable document. Can link to a PO and/or DC, and pull items from the PO.

When you select a linked PO on an invoice, items are imported with the right HSN/GST from your product catalog.

---

## GST handling

### Manual CGST+SGST vs IGST per invoice
Each invoice has a "GST type" toggle. The app auto-detects from the branch state vs customer-branch state and shows a hint, but the final choice is yours.

### Per-line GST rates
Each line item has its own GST % dropdown (0/5/12/18/28). The summary shows totals per rate slab. So a single invoice can mix 12% products with 18% services — the GST calculation is correct for each line.

### GST Dashboard
Filter by period (this/last month, this/last FY, all time). Shows:
- Total taxable, total GST, collected (paid invoices), outstanding (sent/overdue)
- Bars for CGST / SGST / IGST split
- Per-rate breakdown table
- Per-month timeline
- Top customers by GST contribution
- **CSV export** with all taxable values for GSTR filing

### Non-draft invoices can't be deleted
GST law requires invoice numbers to be sequential without gaps. Once an invoice is sent/paid/overdue, deletion is blocked at the database level. To void an invoice, change its status to **Cancelled** instead — the number stays in sequence.

---

## PDF download & email

Each invoice's view page has:
- **↓ PDF** — generates a multi-page A4 PDF using html2canvas + jsPDF and downloads it
- **Email** — opens the user's default mail client (Gmail/Outlook/etc.) with the customer's address, subject, and body pre-filled. Attach the downloaded PDF and send.

True server-side email-with-PDF-attached can be added later (would need a backend like Supabase Edge Functions + Resend or SendGrid).

---

## Project structure

```
allytechsoft-invoice-app/
├── .env.example
├── .gitignore
├── README.md
├── index.html
├── package.json                    # adds: jspdf, html2canvas
├── postcss.config.js
├── tailwind.config.js
├── vite.config.js
├── public/
│   └── logo.png
├── supabase/
│   ├── schema.sql                  # v3 base
│   └── schema_v4.sql               # *** v4 additive migration ***
└── src/
    ├── main.jsx
    ├── App.jsx                     # routes + auth + ops
    ├── index.css
    ├── supabase.js                 # client setup
    ├── db.js                       # data layer (all entities)
    ├── store.js                    # blank-record factories
    ├── utils.js                    # GST math, formatting, FY logic
    ├── pdf.js                      # html → PDF
    ├── constants.js                # Indian states, GST slabs, units
    └── components/
        ├── ui.jsx
        ├── LoginPage.jsx
        ├── Sidebar.jsx
        ├── Dashboard.jsx
        ├── GSTDashboard.jsx        # *** new ***
        ├── Branches.jsx            # *** new ***
        ├── Products.jsx            # *** new ***
        ├── Customers.jsx           # adds GSTIN + per-customer branches
        ├── Invoices.jsx            # adds branch column, draft-only delete
        ├── InvoiceEditor.jsx       # all v4 fields
        ├── InvoiceView.jsx         # GST tax invoice + PDF + email
        ├── PurchaseOrders.jsx      # *** new ***
        ├── PurchaseOrderEditor.jsx # *** new ***
        ├── DeliveryChallans.jsx    # *** new ***
        ├── DeliveryChallanEditor.jsx # *** new ***
        └── Settings.jsx
```

---

## Database schema (v4)

### Tables (per-user, all RLS-protected)

| Table | Purpose |
|---|---|
| `companies` | Company info (legacy from v3, mostly used as fallback) |
| `settings` | Currency, default GST rate, fallback invoice prefix |
| `branches` | **Multiple branches/units of your company** — name, GSTIN, state, own invoice prefix + counter, signing authority |
| `products` | Catalog: code, name, description, HSN, default rate, default GST %, unit |
| `customers` | Customer master + GSTIN + primary address |
| `customer_branches` | **Multiple billing locations per customer** — name, GSTIN, state, address |
| `purchase_orders` | PO header — number, date, customer, customer branch, status, notes |
| `purchase_order_items` | PO line items — product, description, qty, rate, unit |
| `delivery_challans` | DC header — number, date, customer, customer branch, linked PO, vehicle, LR, mode |
| `delivery_challan_items` | DC line items — product, description, qty, unit |
| `invoices` | Invoice header — all v4 fields including branch, customer branch, GST type, place of supply, signing authority, T&C, vehicle, LR, expected delivery, links to PO/DC |
| `invoice_items` | Invoice lines — product link, HSN, unit, qty, rate, GST rate, persisted CGST/SGST/IGST amounts |

### Stored procedures

- `save_invoice(p_invoice jsonb, p_items jsonb)` — atomic upsert of invoice + items + per-branch counter increment

### Triggers

- `prevent_non_draft_invoice_delete` — blocks DELETE on invoices with status ≠ 'draft'
- `handle_new_user` (from v3) — auto-creates company + settings rows when a user signs up

---

## Deployment to Hostinger

Same as v3 — `npm run build`, upload contents of `dist/` to `public_html/`. Use the GitHub Actions workflow you already set up; just commit + push and the workflow rebuilds with the new bundle.

The v4 build is bigger (~290 KB gzipped, up from ~110 KB) due to jsPDF + html2canvas. If the size becomes a concern, we can lazy-load the PDF library so it's only fetched when the user clicks "Download PDF".

---

## Known limitations / next steps

- **PDF rendering** uses html2canvas (rasterizes to image) — text in the PDF is not selectable. For selectable-text PDFs we'd switch to jsPDF's HTML rendering or pdfmake.
- **Email** is mailto-only. Server-side sending (with PDF auto-attached) needs a backend — Supabase Edge Functions + Resend would be the natural choice.
- **HSN code validation** — free text. A lookup table can be added.
- **e-Invoice / IRN generation** — not implemented. India's e-invoicing portal requires API integration; doable but scope-heavy.
- **Multi-currency** — single currency per user.

---

## Migration notes

If you're upgrading from v3:

1. **Apply the v4 schema migration** (Part A above)
2. **Pull + redeploy the new code** (auto-deploys via your GitHub Actions workflow)
3. Existing invoices have `branch_id = NULL` — they continue to work but won't show a "From branch". To clean up: open each, pick a branch, save.
4. Existing invoices have `gst_type = 'intra'` by default — review your interstate invoices and toggle to IGST.
5. Existing invoice_items have `gst_rate = 0` — old invoices used a single `tax_rate` on the header; the v4 view falls back gracefully but for cleanest reporting, edit and re-save.

---

## License

Use freely.
