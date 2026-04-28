# AllyTechSoft Invoice

A multi-device invoice manager built with **React + Vite + Tailwind CSS**, backed by **Supabase** (PostgreSQL + Authentication).

Sign in on any device, see the same data. No backend code to maintain — Supabase handles the database, the API, and authentication. Your only job is to deploy the React frontend (e.g. to Hostinger).

---

## Features

- **Login / signup / password reset** — Supabase email auth
- **Multi-device sync** — same data on laptop, phone, tablet
- **Per-user data isolation** — Postgres Row Level Security ensures every user sees only their own customers and invoices
- **Dashboard** — totals (billed / paid / outstanding / overdue) and recent activity
- **Customers** — add, edit, delete, search
- **Sales invoices** — line items, automatic totals, tax, discount, status workflow
- **Print-ready invoice view** — clean A4 layout, one-click print or save as PDF
- **Settings** — company info, currency, default tax rate, invoice prefix
- **JSON backup / restore** — export and re-import everything as a JSON file
- **Atomic invoice saves** — Postgres function ensures invoice + items + counter increment happen as a single transaction (no race conditions across devices)

---

## Architecture

```
┌──────────────────────────────────────┐
│  React app (deployed once, e.g.      │
│  Hostinger static hosting)           │
│  - same UI on every device           │
│  - calls supabase-js client directly │
└──────────────────┬───────────────────┘
                   │ HTTPS
                   ▼
┌──────────────────────────────────────┐
│  Supabase (managed)                  │
│  ├─ PostgreSQL                       │
│  ├─ Auto-generated REST API          │
│  ├─ Authentication                   │
│  └─ Row Level Security policies      │
└──────────────────────────────────────┘
```

**One codebase, one deployment.** No Node server. No Docker. No backend repo.

---

## Part A — Set up Supabase (one-time, ~5 minutes)

### 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and sign up (free).
2. Click **New project**.
3. Pick an organisation, give the project a name (e.g. `allytechsoft-invoice`), set a strong database password (save it somewhere — you may need it later), choose the region closest to your users (for India: **Mumbai** or **Singapore**), pick the **Free** plan.
4. Click **Create new project**. Wait ~2 minutes while Supabase provisions everything.

### 2. Run the schema migration

1. In the Supabase dashboard, open **SQL Editor** (left sidebar).
2. Click **+ New query**.
3. Open `supabase/schema.sql` from this repo, copy the entire contents, paste into the SQL editor.
4. Click **Run** (or press `Ctrl/Cmd + Enter`).
5. You should see "Success. No rows returned" or similar. Verify by running:
   ```sql
   select count(*) from information_schema.tables
   where table_schema = 'public'
     and table_name in ('companies','settings','customers','invoices','invoice_items');
   ```
   It should return **5**.

This script creates the tables, indexes, Row Level Security policies, the auto-create-on-signup trigger, and the atomic `save_invoice` function.

### 3. Get your project credentials

1. In the Supabase dashboard, go to **Project Settings → API**.
2. Copy two values:
   - **Project URL** (looks like `https://abcdefgh.supabase.co`)
   - **anon public** key (a long JWT-style string)

Both of these are safe to expose in client-side code — they're protected by the RLS policies you just set up.

### 4. Configure email auth (optional but recommended)

1. Go to **Authentication → Sign In / Up Providers** (under "Configuration").
2. **Email** is enabled by default. Good.
3. Decide on email confirmation:
   - **Production** — leave "Confirm email" ON so users must click a link to verify
   - **Quick testing** — turn "Confirm email" OFF so signups log in immediately
4. (Optional) Customise the email templates under **Authentication → Email Templates** so the magic-link/confirmation emails carry your branding.

### 5. (Optional) Configure your site URL

For password reset and email-confirmation links to land on the right place after deployment:

1. Go to **Authentication → URL Configuration**.
2. Set **Site URL** to your deployed app URL (e.g. `https://invoices.yourdomain.com`).
3. Add the same URL to **Redirect URLs** (you can add `http://localhost:5174` here too for local development).

---

## Part B — Run locally

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy the example file and fill in your Supabase values:

```bash
cp .env.example .env.local
```

Then edit `.env.local`:

```
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc... (the anon public key)
```

`.env.local` is gitignored — never commit your keys.

### 3. Run the dev server

```bash
npm run dev
```

Open http://localhost:5174. You'll see the login page. Click **Create an account**, sign up with an email + password, and you're in.

### 4. Build for production

```bash
npm run build
```

The static site is output to `dist/`. You can preview it with `npm run preview`.

---

## Part C — Deploy to Hostinger

Hostinger's shared hosting / static hosting is a perfect fit for this app — it's just static files (HTML, CSS, JS).

### Build the site

On your local machine:

```bash
npm run build
```

This produces a `dist/` folder containing `index.html` plus an `assets/` subfolder with hashed JS/CSS bundles. **The Supabase URL and anon key are baked into the JS at build time**, so make sure your `.env.local` is filled in before you build.

### Upload to Hostinger

1. Log in to your Hostinger control panel and open **File Manager** (or use FTP with FileZilla).
2. Navigate to your domain's `public_html/` directory.
3. Delete any existing `index.html` placeholder.
4. Upload **the contents of `dist/`** (not the `dist` folder itself) — you should end up with `public_html/index.html` and `public_html/assets/...`.

### Make sure SPA routing works (only if needed)

This app uses internal view state (no URL routing), so you don't strictly need this. But if you ever add React Router, create a `.htaccess` in `public_html/`:

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

### Update Supabase Site URL

After deployment, update the **Site URL** and **Redirect URLs** in Supabase (Part A, step 5) to your Hostinger domain.

### Future deploys

Whenever you change code:

```bash
git pull
npm run build
# upload contents of dist/ to public_html/, overwriting
```

---

## Project structure

```
allytechsoft-invoice-app/
├── .env.example              # template — copy to .env.local
├── .gitignore
├── README.md
├── index.html
├── package.json              # uses @supabase/supabase-js
├── postcss.config.js
├── tailwind.config.js
├── vite.config.js
├── public/
│   └── logo.png
├── supabase/
│   └── schema.sql            # *** run this in Supabase SQL Editor ***
└── src/
    ├── main.jsx
    ├── App.jsx               # auth-aware shell
    ├── index.css             # Tailwind + components + PRINT styles
    ├── supabase.js           # Supabase client + auth helpers
    ├── db.js                 # *** Supabase data layer ***
    ├── store.js              # pure helpers (newId, blankInvoice…)
    ├── utils.js
    └── components/
        ├── ui.jsx
        ├── LoginPage.jsx     # *** sign in / sign up / forgot password ***
        ├── Sidebar.jsx       # nav + sign-out + user email
        ├── Dashboard.jsx
        ├── Customers.jsx
        ├── Invoices.jsx
        ├── InvoiceEditor.jsx
        ├── InvoiceView.jsx
        └── Settings.jsx
```

---

## Database schema (in plain English)

Five tables, all owned per user via a `user_id` column referencing `auth.users(id)`:

| Table            | Purpose                                                              |
| ---------------- | -------------------------------------------------------------------- |
| `companies`      | One row per user — your business info that appears on every invoice  |
| `settings`       | One row per user — currency, tax %, invoice prefix, payment terms    |
| `customers`      | Many per user — your customer directory                              |
| `invoices`       | Many per user — issued invoices                                      |
| `invoice_items`  | Many per invoice — line items (cascade-deleted with the invoice)     |

**Row Level Security** policies on every table ensure:

- A logged-in user can only `SELECT`, `INSERT`, `UPDATE`, `DELETE` rows where `user_id = auth.uid()`.
- Without authentication, no rows are visible.
- This is enforced by Postgres itself, not by the JavaScript client — meaning even if someone tried to abuse the API directly with their own anon key, they couldn't see anyone else's data.

---

## Common tasks

### Look at your data

In the Supabase dashboard → **Table Editor** → pick a table. You'll see all rows across all users (you're an admin). To filter to one user, look for their row in `auth.users` first to get the UUID.

You can also run any SQL: **SQL Editor → New query**.

### Add a new field

Example: add a "website" field to companies.

1. Run in SQL Editor: `alter table public.companies add column website text default '';`
2. Update `src/db.js` to map `website` ↔ `company.website` in `loadAll()`, `saveCompany()`.
3. Update the Settings UI to expose the field.

### Reset a single user's data

In SQL Editor:

```sql
delete from public.invoices where user_id = 'THE-USER-UUID';
delete from public.customers where user_id = 'THE-USER-UUID';
```

(`invoice_items` cascade-delete with their invoice.)

### Disable a user

In **Authentication → Users**, select a user and click **Ban** or **Delete**.

---

## Migration notes

If you previously ran the **sql.js / IndexedDB** version of this app:

- That data lives in your browser only — it does not move automatically to Supabase.
- To migrate: open the old version, go to **Settings → Export JSON backup**, then sign in to the new version and use **Settings → Restore from JSON**.

---

## Troubleshooting

| Symptom                                                 | Likely cause / fix                                                                                                                |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Login page shows "Missing Supabase env variables"       | `.env.local` is missing or has the wrong keys. Copy from `.env.example` and fill in.                                              |
| Sign-up succeeds but "Couldn't load your data" appears  | The schema migration didn't run. Re-run `supabase/schema.sql` in the Supabase SQL Editor.                                          |
| Sign-up succeeds but no confirmation email arrives      | Check spam, or turn off "Confirm email" in Supabase **Authentication → Sign In / Up Providers** for testing.                       |
| Password reset link redirects to localhost on prod      | Add your prod URL to **Authentication → URL Configuration → Redirect URLs**, and set **Site URL** to it.                          |
| `permission denied for table customers`                 | RLS policies didn't apply. Re-run the policy section of `supabase/schema.sql`.                                                    |
| Two browsers create invoices with the same number       | Shouldn't happen with the atomic `save_invoice` RPC. If it does, ensure the RPC was created (re-run `schema.sql`).                |

---

## Push to GitHub

```bash
git add .
git commit -m "Switch storage to Supabase (Postgres + Auth) for multi-device sync"
git push
```

Make sure `.env.local` is **not** committed (the included `.gitignore` already excludes it).

---

## Cost

- **Hostinger**: whatever you already pay for static hosting.
- **Supabase Free tier**: $0/month — 500 MB database, 50,000 monthly active users, 1 GB storage. More than enough for an invoicing tool.
- **Supabase Pro**: $25/month if you ever outgrow free (8 GB DB, daily backups, 100,000 MAUs).

---

## License

Use freely for AllyTechSoft Solutions or any internal/commercial tool.
