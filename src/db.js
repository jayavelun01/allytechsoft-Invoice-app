// Data access layer — Supabase + Postgres edition.
// Exposes the same operation names the old sql.js layer used so
// components don't need to know we changed storage.

import { supabase, requireUserId } from './supabase'
import { newId } from './store'

/* ============================================================
 * Read
 * ============================================================ */

/** Fetch the current user's full data: company, settings, customers, invoices (with items). */
export async function loadAll() {
  const userId = await requireUserId()

  const [companyR, settingsR, customersR, invoicesR, itemsR] = await Promise.all([
    supabase.from('companies').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('settings').select('*').eq('user_id', userId).maybeSingle(),
    supabase
      .from('customers')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('invoices')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('invoice_items')
      .select('*')
      .eq('user_id', userId)
      .order('position', { ascending: true }),
  ])

  for (const r of [companyR, settingsR, customersR, invoicesR, itemsR]) {
    if (r.error) throw r.error
  }

  // Defensive: if the signup trigger didn't fire (very rare), bootstrap rows now.
  let company = companyR.data
  let settings = settingsR.data
  if (!company) company = await ensureCompany(userId)
  if (!settings) settings = await ensureSettings(userId)

  // Group items under their invoice
  const itemsByInvoice = {}
  for (const it of itemsR.data || []) {
    ;(itemsByInvoice[it.invoice_id] ||= []).push({
      id: it.id,
      description: it.description ?? '',
      quantity: Number(it.quantity) || 0,
      rate: Number(it.rate) || 0,
    })
  }

  return {
    company: {
      name: company.name ?? '',
      email: company.email ?? '',
      phone: company.phone ?? '',
      address: company.address ?? '',
      taxId: company.tax_id ?? '',
      logo: company.logo ?? '/logo.png',
    },
    settings: {
      currency: settings.currency ?? '₹',
      defaultTaxRate: Number(settings.default_tax_rate) || 0,
      nextInvoiceNumber: Number(settings.next_invoice_number) || 1,
      invoicePrefix: settings.invoice_prefix ?? 'INV-',
      paymentTerms: settings.payment_terms ?? '',
    },
    customers: (customersR.data || []).map(rowToCustomer),
    invoices: (invoicesR.data || []).map((inv) => ({
      ...rowToInvoice(inv),
      items: itemsByInvoice[inv.id] || [],
    })),
  }
}

/* ============================================================
 * Customers
 * ============================================================ */

export async function saveCustomer(c) {
  const userId = await requireUserId()
  const row = {
    id: c.id || newId(),
    user_id: userId,
    name: c.name,
    contact_person: c.contactPerson || '',
    email: c.email || '',
    phone: c.phone || '',
    address: c.address || '',
    tax_id: c.taxId || '',
  }
  // For brand-new rows we want to set created_at; for updates we don't touch it.
  if (!c.id) row.created_at = new Date().toISOString()

  const { error } = await supabase.from('customers').upsert(row)
  if (error) throw error
}

export async function deleteCustomer(id) {
  const userId = await requireUserId()
  const { error } = await supabase.from('customers').delete().eq('user_id', userId).eq('id', id)
  if (error) throw error
}

/* ============================================================
 * Invoices
 * ============================================================ */

/**
 * Saves an invoice with all its line items atomically (Postgres function).
 * Also bumps next_invoice_number for new invoices.
 */
export async function saveInvoice(invoice) {
  const { error } = await supabase.rpc('save_invoice', {
    p_invoice: invoice,
    p_items: invoice.items || [],
  })
  if (error) throw error
}

export async function deleteInvoice(id) {
  const userId = await requireUserId()
  // ON DELETE CASCADE on invoice_items handles the children
  const { error } = await supabase.from('invoices').delete().eq('user_id', userId).eq('id', id)
  if (error) throw error
}

export async function updateInvoiceStatus(id, status) {
  const userId = await requireUserId()
  const { error } = await supabase
    .from('invoices')
    .update({ status })
    .eq('user_id', userId)
    .eq('id', id)
  if (error) throw error
}

/* ============================================================
 * Company + settings
 * ============================================================ */

export async function saveCompany(company) {
  const userId = await requireUserId()
  const { error } = await supabase
    .from('companies')
    .update({
      name: company.name || '',
      email: company.email || '',
      phone: company.phone || '',
      address: company.address || '',
      tax_id: company.taxId || '',
      logo: company.logo || '/logo.png',
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
  if (error) throw error
}

export async function saveSettings(settings) {
  const userId = await requireUserId()
  const { error } = await supabase
    .from('settings')
    .update({
      currency: settings.currency,
      default_tax_rate: Number(settings.defaultTaxRate) || 0,
      next_invoice_number: Number(settings.nextInvoiceNumber) || 1,
      invoice_prefix: settings.invoicePrefix,
      payment_terms: settings.paymentTerms,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
  if (error) throw error
}

/* ============================================================
 * Reset / backup
 * ============================================================ */

/** Wipes all of the current user's customers + invoices and resets company/settings to defaults. */
export async function resetAll() {
  const userId = await requireUserId()

  const r1 = await supabase.from('invoices').delete().eq('user_id', userId)
  if (r1.error) throw r1.error
  const r2 = await supabase.from('customers').delete().eq('user_id', userId)
  if (r2.error) throw r2.error

  const r3 = await supabase
    .from('companies')
    .update({
      name: '',
      email: '',
      phone: '',
      address: '',
      tax_id: '',
      logo: '/logo.png',
    })
    .eq('user_id', userId)
  if (r3.error) throw r3.error

  const r4 = await supabase
    .from('settings')
    .update({
      currency: '₹',
      default_tax_rate: 18,
      next_invoice_number: 1,
      invoice_prefix: 'INV-',
      payment_terms:
        'Payment due within 15 days of invoice date. Bank transfer details available on request.',
    })
    .eq('user_id', userId)
  if (r4.error) throw r4.error
}

export async function exportJson() {
  return await loadAll()
}

/** Imports a JSON backup, replacing all current data for this user. */
export async function importJson(data) {
  if (!data || !data.customers || !data.invoices) {
    throw new Error('Invalid backup file')
  }
  const userId = await requireUserId()

  // Wipe first
  await supabase.from('invoices').delete().eq('user_id', userId)
  await supabase.from('customers').delete().eq('user_id', userId)

  if (data.company) {
    await supabase
      .from('companies')
      .update({
        name: data.company.name || '',
        email: data.company.email || '',
        phone: data.company.phone || '',
        address: data.company.address || '',
        tax_id: data.company.taxId || '',
        logo: data.company.logo || '/logo.png',
      })
      .eq('user_id', userId)
  }
  if (data.settings) {
    await supabase
      .from('settings')
      .update({
        currency: data.settings.currency,
        default_tax_rate: Number(data.settings.defaultTaxRate) || 0,
        next_invoice_number: Number(data.settings.nextInvoiceNumber) || 1,
        invoice_prefix: data.settings.invoicePrefix,
        payment_terms: data.settings.paymentTerms,
      })
      .eq('user_id', userId)
  }

  // Customers (chunked insert in case of large backups)
  if (data.customers.length) {
    const rows = data.customers.map((c) => ({
      id: c.id || newId(),
      user_id: userId,
      name: c.name,
      contact_person: c.contactPerson || '',
      email: c.email || '',
      phone: c.phone || '',
      address: c.address || '',
      tax_id: c.taxId || '',
      created_at: c.createdAt || new Date().toISOString(),
    }))
    const r = await supabase.from('customers').insert(rows)
    if (r.error) throw r.error
  }

  // Invoices then items
  for (const inv of data.invoices) {
    // Re-use the atomic RPC to keep counter logic and item insertion consistent
    await saveInvoice({
      id: inv.id || newId(),
      number: inv.number,
      customerId: inv.customerId || '',
      issueDate: inv.issueDate,
      dueDate: inv.dueDate,
      taxRate: inv.taxRate,
      discount: inv.discount,
      notes: inv.notes,
      status: inv.status || 'draft',
      createdAt: inv.createdAt || new Date().toISOString(),
      items: (inv.items || []).map((it) => ({
        id: it.id || newId(),
        description: it.description || '',
        quantity: it.quantity,
        rate: it.rate,
      })),
    })
  }
}

/* ============================================================
 * Helpers
 * ============================================================ */

async function ensureCompany(userId) {
  const { data, error } = await supabase
    .from('companies')
    .insert({ user_id: userId })
    .select()
    .single()
  if (error) throw error
  return data
}

async function ensureSettings(userId) {
  const { data, error } = await supabase
    .from('settings')
    .insert({ user_id: userId })
    .select()
    .single()
  if (error) throw error
  return data
}

function rowToCustomer(c) {
  return {
    id: c.id,
    name: c.name,
    contactPerson: c.contact_person ?? '',
    email: c.email ?? '',
    phone: c.phone ?? '',
    address: c.address ?? '',
    taxId: c.tax_id ?? '',
    createdAt: c.created_at,
  }
}

function rowToInvoice(i) {
  return {
    id: i.id,
    number: i.number,
    customerId: i.customer_id ?? '',
    issueDate: i.issue_date,
    dueDate: i.due_date,
    taxRate: Number(i.tax_rate) || 0,
    discount: Number(i.discount) || 0,
    notes: i.notes ?? '',
    status: i.status ?? 'draft',
    createdAt: i.created_at,
  }
}
