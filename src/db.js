// Data access layer — Supabase + Postgres.
// v4: branches, products, customer_branches, purchase orders, delivery challans.

import { supabase, requireUserId } from './supabase'
import { newId } from './store'

/* ============================================================
 * Read everything
 * ============================================================ */

export async function loadAll() {
  const userId = await requireUserId()

  const [
    companyR, settingsR, branchesR, productsR,
    customersR, customerBranchesR,
    invoicesR, itemsR,
    posR, poItemsR,
    dcsR, dcItemsR,
    cdnR, cdnItemsR,
    ebR, ebItemsR,
    vendorsR,
  ] = await Promise.all([
    supabase.from('companies').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('settings').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('branches').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
    supabase.from('products').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('customers').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('customer_branches').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
    supabase.from('invoices').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('invoice_items').select('*').eq('user_id', userId).order('position', { ascending: true }),
    supabase.from('purchase_orders').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('purchase_order_items').select('*').eq('user_id', userId).order('position', { ascending: true }),
    supabase.from('delivery_challans').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('delivery_challan_items').select('*').eq('user_id', userId).order('position', { ascending: true }),
    supabase.from('credit_debit_notes').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('credit_debit_note_items').select('*').eq('user_id', userId).order('position', { ascending: true }),
    supabase.from('expense_bills').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('expense_bill_items').select('*').eq('user_id', userId).order('position', { ascending: true }),
    supabase.from('vendors').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
  ])

  for (const r of [companyR, settingsR, branchesR, productsR, customersR, customerBranchesR, invoicesR, itemsR, posR, poItemsR, dcsR, dcItemsR, cdnR, cdnItemsR, ebR, ebItemsR, vendorsR]) {
    if (r.error) throw r.error
  }

  let company = companyR.data
  let settings = settingsR.data
  if (!company) company = await ensureCompany(userId)
  if (!settings) settings = await ensureSettings(userId)

  // Group line items
  const invoiceItemsByInv = groupBy(itemsR.data || [], 'invoice_id', mapInvoiceItem)
  const poItemsByPo       = groupBy(poItemsR.data || [], 'purchase_order_id', mapPOItem)
  const dcItemsByDc       = groupBy(dcItemsR.data || [], 'delivery_challan_id', mapDCItem)
  const cdnItemsByNote    = groupBy(cdnItemsR.data || [], 'credit_debit_note_id', mapCDNItem)
  const ebItemsByBill     = groupBy(ebItemsR.data || [], 'expense_bill_id', mapEBItem)

  return {
    company: mapCompany(company),
    settings: mapSettings(settings),
    branches: (branchesR.data || []).map(mapBranch),
    products: (productsR.data || []).map(mapProduct),
    customers: (customersR.data || []).map(mapCustomer),
    customerBranches: (customerBranchesR.data || []).map((b) => ({ ...mapCustomerBranch(b) })),
    invoices: (invoicesR.data || []).map((inv) => ({
      ...mapInvoice(inv),
      items: invoiceItemsByInv[inv.id] || [],
    })),
    purchaseOrders: (posR.data || []).map((po) => ({
      ...mapPurchaseOrder(po),
      items: poItemsByPo[po.id] || [],
    })),
    deliveryChallans: (dcsR.data || []).map((dc) => ({
      ...mapDeliveryChallan(dc),
      items: dcItemsByDc[dc.id] || [],
    })),
    creditDebitNotes: (cdnR.data || []).map((n) => ({
      ...mapCreditDebitNote(n),
      items: cdnItemsByNote[n.id] || [],
    })),
    expenseBills: (ebR.data || []).map((b) => ({
      ...mapExpenseBill(b),
      items: ebItemsByBill[b.id] || [],
    })),
    vendors: (vendorsR.data || []).map(mapVendor),
  }
}

/* ============================================================
 * Branches (FROM-company branches)
 * ============================================================ */

export async function saveBranch(b) {
  const userId = await requireUserId()
  const row = {
    id: b.id || newId(),
    user_id: userId,
    name: b.name,
    address: b.address || '',
    state: b.state || '',
    state_code: b.stateCode || '',
    gstin: b.gstin || '',
    email: b.email || '',
    phone: b.phone || '',
    signing_authority: b.signingAuthority || '',
    invoice_prefix: b.invoicePrefix || 'INV-',
    next_invoice_number: Number(b.nextInvoiceNumber) || 1,
    is_default: !!b.isDefault,
  }
  if (!b.id) row.created_at = new Date().toISOString()

  // If this row is being marked default, clear default on others
  if (row.is_default) {
    await supabase.from('branches').update({ is_default: false }).eq('user_id', userId)
  }

  const { error } = await supabase.from('branches').upsert(row)
  if (error) throw error
}

export async function deleteBranch(id) {
  const userId = await requireUserId()
  const { error } = await supabase.from('branches').delete().eq('user_id', userId).eq('id', id)
  if (error) throw error
}

/* ============================================================
 * Products
 * ============================================================ */

export async function saveProduct(p) {
  const userId = await requireUserId()
  const row = {
    id: p.id || newId(),
    user_id: userId,
    product_code: p.productCode || '',
    name: p.name,
    description: p.description || '',
    hsn_code: p.hsnCode || '',
    default_rate: Number(p.defaultRate) || 0,
    default_gst_rate: Number(p.defaultGstRate) || 18,
    unit: p.unit || 'Nos',
  }
  if (!p.id) row.created_at = new Date().toISOString()
  const { error } = await supabase.from('products').upsert(row)
  if (error) throw error
}

export async function deleteProduct(id) {
  const userId = await requireUserId()
  const { error } = await supabase.from('products').delete().eq('user_id', userId).eq('id', id)
  if (error) throw error
}

/* ============================================================
 * Customers + customer branches
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
    gstin: c.gstin || '',
  }
  if (!c.id) row.created_at = new Date().toISOString()
  const { error } = await supabase.from('customers').upsert(row)
  if (error) throw error
}

export async function deleteCustomer(id) {
  const userId = await requireUserId()
  const { error } = await supabase.from('customers').delete().eq('user_id', userId).eq('id', id)
  if (error) throw error
}

export async function saveCustomerBranch(cb) {
  const userId = await requireUserId()
  const row = {
    id: cb.id || newId(),
    customer_id: cb.customerId,
    user_id: userId,
    name: cb.name,
    address: cb.address || '',
    state: cb.state || '',
    state_code: cb.stateCode || '',
    gstin: cb.gstin || '',
    contact_person: cb.contactPerson || '',
    email: cb.email || '',
    phone: cb.phone || '',
    is_default: !!cb.isDefault,
  }
  if (!cb.id) row.created_at = new Date().toISOString()

  if (row.is_default) {
    await supabase
      .from('customer_branches')
      .update({ is_default: false })
      .eq('user_id', userId)
      .eq('customer_id', cb.customerId)
  }

  const { error } = await supabase.from('customer_branches').upsert(row)
  if (error) throw error
}

export async function deleteCustomerBranch(id) {
  const userId = await requireUserId()
  const { error } = await supabase.from('customer_branches').delete().eq('user_id', userId).eq('id', id)
  if (error) throw error
}

/* ============================================================
 * Invoices (atomic via RPC)
 * ============================================================ */

export async function saveInvoice(invoice) {
  const { error } = await supabase.rpc('save_invoice', {
    p_invoice: invoice,
    p_items: invoice.items || [],
  })
  if (error) throw error
}

export async function deleteInvoice(id) {
  const userId = await requireUserId()
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
 * Purchase Orders
 * ============================================================ */

export async function savePurchaseOrder(po) {
  const userId = await requireUserId()
  const isUpdate = !!po.id && (await rowExists('purchase_orders', po.id, userId))
  const id = po.id || newId()

  const row = {
    id,
    user_id: userId,
    number: po.number,
    po_date: po.poDate || null,
    customer_id: po.customerId || null,
    customer_branch_id: po.customerBranchId || null,
    notes: po.notes || '',
    status: po.status || 'open',
    created_at: po.createdAt || new Date().toISOString(),
  }

  const r1 = await supabase.from('purchase_orders').upsert(row)
  if (r1.error) throw r1.error

  if (isUpdate) {
    const r2 = await supabase
      .from('purchase_order_items')
      .delete()
      .eq('user_id', userId)
      .eq('purchase_order_id', id)
    if (r2.error) throw r2.error
  }

  if (po.items?.length) {
    const itemRows = po.items.map((it, i) => ({
      id: it.id || newId(),
      purchase_order_id: id,
      user_id: userId,
      product_id: it.productId || null,
      description: it.description || '',
      quantity: Number(it.quantity) || 0,
      rate: Number(it.rate) || 0,
      unit: it.unit || 'Nos',
      position: i,
    }))
    const r3 = await supabase.from('purchase_order_items').insert(itemRows)
    if (r3.error) throw r3.error
  }

  return id
}

export async function deletePurchaseOrder(id) {
  const userId = await requireUserId()
  const { error } = await supabase.from('purchase_orders').delete().eq('user_id', userId).eq('id', id)
  if (error) throw error
}

/* ============================================================
 * Delivery Challans
 * ============================================================ */

export async function saveDeliveryChallan(dc) {
  const userId = await requireUserId()
  const isUpdate = !!dc.id && (await rowExists('delivery_challans', dc.id, userId))
  const id = dc.id || newId()

  const row = {
    id,
    user_id: userId,
    number: dc.number,
    dc_date: dc.dcDate || null,
    customer_id: dc.customerId || null,
    customer_branch_id: dc.customerBranchId || null,
    purchase_order_id: dc.purchaseOrderId || null,
    vehicle_number: dc.vehicleNumber || '',
    lr_number: dc.lrNumber || '',
    lr_date: dc.lrDate || null,
    delivery_mode: dc.deliveryMode || '',
    notes: dc.notes || '',
    status: dc.status || 'open',
    created_at: dc.createdAt || new Date().toISOString(),
  }

  const r1 = await supabase.from('delivery_challans').upsert(row)
  if (r1.error) throw r1.error

  if (isUpdate) {
    const r2 = await supabase
      .from('delivery_challan_items')
      .delete()
      .eq('user_id', userId)
      .eq('delivery_challan_id', id)
    if (r2.error) throw r2.error
  }

  if (dc.items?.length) {
    const rows = dc.items.map((it, i) => ({
      id: it.id || newId(),
      delivery_challan_id: id,
      user_id: userId,
      product_id: it.productId || null,
      description: it.description || '',
      quantity: Number(it.quantity) || 0,
      unit: it.unit || 'Nos',
      position: i,
    }))
    const r3 = await supabase.from('delivery_challan_items').insert(rows)
    if (r3.error) throw r3.error
  }

  return id
}

export async function deleteDeliveryChallan(id) {
  const userId = await requireUserId()
  const { error } = await supabase.from('delivery_challans').delete().eq('user_id', userId).eq('id', id)
  if (error) throw error
}

/* ============================================================
 * Credit / Debit Notes
 * ============================================================ */

export async function saveCreditDebitNote(note) {
  const userId = await requireUserId()
  const isUpdate = !!note.id && (await rowExists('credit_debit_notes', note.id, userId))
  const id = note.id || newId()

  const row = {
    id,
    user_id: userId,
    note_type: note.noteType || 'credit',
    number: note.number || '',
    note_date: note.noteDate || null,
    original_invoice_id: note.originalInvoiceId || null,
    original_invoice_number: note.originalInvoiceNumber || '',
    customer_id: note.customerId || null,
    customer_branch_id: note.customerBranchId || null,
    branch_id: note.branchId || null,
    reason: note.reason || '',
    gst_type: note.gstType || 'intra',
    place_of_supply: note.placeOfSupply || '',
    discount: Number(note.discount) || 0,
    notes: note.notes || '',
    status: note.status || 'draft',
    signing_authority: note.signingAuthority || '',
    created_at: note.createdAt || new Date().toISOString(),
  }

  const r1 = await supabase.from('credit_debit_notes').upsert(row)
  if (r1.error) throw r1.error

  if (isUpdate) {
    const r2 = await supabase
      .from('credit_debit_note_items')
      .delete()
      .eq('user_id', userId)
      .eq('credit_debit_note_id', id)
    if (r2.error) throw r2.error
  }

  if (note.items?.length) {
    const itemRows = note.items.map((it, i) => ({
      id: it.id || newId(),
      credit_debit_note_id: id,
      user_id: userId,
      product_id: it.productId || null,
      description: it.description || '',
      hsn_code: it.hsnCode || '',
      unit: it.unit || 'Nos',
      quantity: Number(it.quantity) || 0,
      rate: Number(it.rate) || 0,
      gst_rate: Number(it.gstRate) || 0,
      cgst_amount: Number(it.cgstAmount) || 0,
      sgst_amount: Number(it.sgstAmount) || 0,
      igst_amount: Number(it.igstAmount) || 0,
      position: i,
    }))
    const r3 = await supabase.from('credit_debit_note_items').insert(itemRows)
    if (r3.error) throw r3.error
  }

  return id
}

export async function deleteCreditDebitNote(id) {
  const userId = await requireUserId()
  const { error } = await supabase.from('credit_debit_notes').delete().eq('user_id', userId).eq('id', id)
  if (error) throw error
}

/* ============================================================
 * Expense Bills
 * ============================================================ */

export async function saveExpenseBill(bill) {
  const userId = await requireUserId()
  const isUpdate = !!bill.id && (await rowExists('expense_bills', bill.id, userId))
  const id = bill.id || newId()

  const row = {
    id,
    user_id: userId,
    bill_number: bill.billNumber || '',
    bill_date: bill.billDate || null,
    due_date: bill.dueDate || null,
    vendor_id: bill.vendorId || null,
    vendor_name: bill.vendorName || '',
    vendor_gstin: bill.vendorGstin || '',
    vendor_address: bill.vendorAddress || '',
    branch_id: bill.branchId || null,
    gst_type: bill.gstType || 'intra',
    place_of_supply: bill.placeOfSupply || '',
    discount: Number(bill.discount) || 0,
    notes: bill.notes || '',
    status: bill.status || 'draft',
    created_at: bill.createdAt || new Date().toISOString(),
  }

  const r1 = await supabase.from('expense_bills').upsert(row)
  if (r1.error) throw r1.error

  if (isUpdate) {
    const r2 = await supabase
      .from('expense_bill_items')
      .delete()
      .eq('user_id', userId)
      .eq('expense_bill_id', id)
    if (r2.error) throw r2.error
  }

  if (bill.items?.length) {
    const itemRows = bill.items.map((it, i) => ({
      id: it.id || newId(),
      expense_bill_id: id,
      user_id: userId,
      product_id: it.productId || null,
      description: it.description || '',
      hsn_code: it.hsnCode || '',
      unit: it.unit || 'Nos',
      quantity: Number(it.quantity) || 0,
      rate: Number(it.rate) || 0,
      gst_rate: Number(it.gstRate) || 0,
      cgst_amount: Number(it.cgstAmount) || 0,
      sgst_amount: Number(it.sgstAmount) || 0,
      igst_amount: Number(it.igstAmount) || 0,
      position: i,
    }))
    const r3 = await supabase.from('expense_bill_items').insert(itemRows)
    if (r3.error) throw r3.error
  }

  return id
}

export async function deleteExpenseBill(id) {
  const userId = await requireUserId()
  const { error } = await supabase.from('expense_bills').delete().eq('user_id', userId).eq('id', id)
  if (error) throw error
}

export async function updateExpenseBillStatus(id, status) {
  const userId = await requireUserId()
  const { error } = await supabase
    .from('expense_bills')
    .update({ status })
    .eq('user_id', userId)
    .eq('id', id)
  if (error) throw error
}

/* ============================================================
 * Vendors
 * ============================================================ */

export async function saveVendor(v) {
  const userId = await requireUserId()
  const row = {
    id: v.id || newId(),
    user_id: userId,
    name: v.name || '',
    gstin: v.gstin || '',
    address: v.address || '',
    contact_person: v.contactPerson || '',
    email: v.email || '',
    phone: v.phone || '',
    notes: v.notes || '',
  }
  if (!v.id) row.created_at = new Date().toISOString()
  const { error } = await supabase.from('vendors').upsert(row)
  if (error) throw error
}

export async function deleteVendor(id) {
  const userId = await requireUserId()
  const { error } = await supabase.from('vendors').delete().eq('user_id', userId).eq('id', id)
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
 * Backup / restore / reset
 * ============================================================ */

export async function exportJson() {
  return await loadAll()
}

export async function resetAll() {
  const userId = await requireUserId()
  // Order matters for FKs
  await supabase.from('invoices').delete().eq('user_id', userId)
  await supabase.from('delivery_challans').delete().eq('user_id', userId)
  await supabase.from('purchase_orders').delete().eq('user_id', userId)
  await supabase.from('customer_branches').delete().eq('user_id', userId)
  await supabase.from('customers').delete().eq('user_id', userId)
  await supabase.from('products').delete().eq('user_id', userId)
  await supabase.from('branches').delete().eq('user_id', userId)
}

/* ============================================================
 * Internal helpers
 * ============================================================ */

async function rowExists(table, id, userId) {
  const { data } = await supabase
    .from(table)
    .select('id')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()
  return !!data
}

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

function groupBy(rows, key, mapper) {
  const out = {}
  for (const r of rows) {
    const k = r[key]
    if (!k) continue
    ;(out[k] ||= []).push(mapper(r))
  }
  return out
}

/* ---------- Row → app object mappers ---------- */

function mapCompany(c) {
  return {
    name: c.name ?? '',
    email: c.email ?? '',
    phone: c.phone ?? '',
    address: c.address ?? '',
    taxId: c.tax_id ?? '',
    logo: c.logo ?? '/logo.png',
  }
}

function mapSettings(s) {
  return {
    currency: s.currency ?? '₹',
    defaultTaxRate: Number(s.default_tax_rate) || 18,
    nextInvoiceNumber: Number(s.next_invoice_number) || 1,
    invoicePrefix: s.invoice_prefix ?? 'INV-',
    paymentTerms: s.payment_terms ?? '',
  }
}

function mapBranch(b) {
  return {
    id: b.id,
    name: b.name,
    address: b.address ?? '',
    state: b.state ?? '',
    stateCode: b.state_code ?? '',
    gstin: b.gstin ?? '',
    email: b.email ?? '',
    phone: b.phone ?? '',
    signingAuthority: b.signing_authority ?? '',
    invoicePrefix: b.invoice_prefix ?? 'INV-',
    nextInvoiceNumber: Number(b.next_invoice_number) || 1,
    isDefault: !!b.is_default,
    is_default: !!b.is_default,
    createdAt: b.created_at,
  }
}

function mapProduct(p) {
  return {
    id: p.id,
    productCode: p.product_code ?? '',
    name: p.name,
    description: p.description ?? '',
    hsnCode: p.hsn_code ?? '',
    defaultRate: Number(p.default_rate) || 0,
    defaultGstRate: Number(p.default_gst_rate) || 18,
    unit: p.unit ?? 'Nos',
    createdAt: p.created_at,
  }
}

function mapCustomer(c) {
  return {
    id: c.id,
    name: c.name,
    contactPerson: c.contact_person ?? '',
    email: c.email ?? '',
    phone: c.phone ?? '',
    address: c.address ?? '',
    taxId: c.tax_id ?? '',
    gstin: c.gstin ?? '',
    createdAt: c.created_at,
  }
}

function mapCustomerBranch(b) {
  return {
    id: b.id,
    customerId: b.customer_id,
    customer_id: b.customer_id, // both casings exposed for ease of filtering
    name: b.name,
    address: b.address ?? '',
    state: b.state ?? '',
    stateCode: b.state_code ?? '',
    gstin: b.gstin ?? '',
    contactPerson: b.contact_person ?? '',
    email: b.email ?? '',
    phone: b.phone ?? '',
    isDefault: !!b.is_default,
    createdAt: b.created_at,
  }
}

function mapInvoice(i) {
  return {
    id: i.id,
    number: i.number,
    customerId: i.customer_id ?? '',
    customerBranchId: i.customer_branch_id ?? '',
    branchId: i.branch_id ?? '',
    purchaseOrderId: i.purchase_order_id ?? '',
    deliveryChallanId: i.delivery_challan_id ?? '',
    issueDate: i.issue_date,
    dueDate: i.due_date,
    expectedDeliveryDate: i.expected_delivery_date,
    taxRate: Number(i.tax_rate) || 0,
    discount: Number(i.discount) || 0,
    notes: i.notes ?? '',
    status: i.status ?? 'draft',
    gstType: i.gst_type ?? 'intra',
    placeOfSupply: i.place_of_supply ?? '',
    signingAuthority: i.signing_authority ?? '',
    termsAndConditions: i.terms_and_conditions ?? '',
    vehicleNumber: i.vehicle_number ?? '',
    lrNumber: i.lr_number ?? '',
    lrDate: i.lr_date,
    deliveryMode: i.delivery_mode ?? '',
    createdAt: i.created_at,
  }
}

function mapInvoiceItem(it) {
  return {
    id: it.id,
    productId: it.product_id ?? '',
    description: it.description ?? '',
    hsnCode: it.hsn_code ?? '',
    unit: it.unit ?? 'Nos',
    quantity: Number(it.quantity) || 0,
    rate: Number(it.rate) || 0,
    gstRate: Number(it.gst_rate) || 0,
  }
}

function mapPurchaseOrder(po) {
  return {
    id: po.id,
    number: po.number,
    poDate: po.po_date,
    customerId: po.customer_id ?? '',
    customerBranchId: po.customer_branch_id ?? '',
    notes: po.notes ?? '',
    status: po.status ?? 'open',
    createdAt: po.created_at,
  }
}

function mapPOItem(it) {
  return {
    id: it.id,
    productId: it.product_id ?? '',
    description: it.description ?? '',
    quantity: Number(it.quantity) || 0,
    rate: Number(it.rate) || 0,
    unit: it.unit ?? 'Nos',
  }
}

function mapDeliveryChallan(dc) {
  return {
    id: dc.id,
    number: dc.number,
    dcDate: dc.dc_date,
    customerId: dc.customer_id ?? '',
    customerBranchId: dc.customer_branch_id ?? '',
    purchaseOrderId: dc.purchase_order_id ?? '',
    vehicleNumber: dc.vehicle_number ?? '',
    lrNumber: dc.lr_number ?? '',
    lrDate: dc.lr_date,
    deliveryMode: dc.delivery_mode ?? '',
    notes: dc.notes ?? '',
    status: dc.status ?? 'open',
    createdAt: dc.created_at,
  }
}

function mapDCItem(it) {
  return {
    id: it.id,
    productId: it.product_id ?? '',
    description: it.description ?? '',
    quantity: Number(it.quantity) || 0,
    unit: it.unit ?? 'Nos',
  }
}

function mapCreditDebitNote(n) {
  return {
    id: n.id,
    noteType: n.note_type ?? 'credit',
    number: n.number ?? '',
    noteDate: n.note_date,
    originalInvoiceId: n.original_invoice_id ?? '',
    originalInvoiceNumber: n.original_invoice_number ?? '',
    customerId: n.customer_id ?? '',
    customerBranchId: n.customer_branch_id ?? '',
    branchId: n.branch_id ?? '',
    reason: n.reason ?? '',
    gstType: n.gst_type ?? 'intra',
    placeOfSupply: n.place_of_supply ?? '',
    discount: Number(n.discount) || 0,
    notes: n.notes ?? '',
    status: n.status ?? 'draft',
    signingAuthority: n.signing_authority ?? '',
    createdAt: n.created_at,
  }
}

function mapCDNItem(it) {
  return {
    id: it.id,
    productId: it.product_id ?? '',
    description: it.description ?? '',
    hsnCode: it.hsn_code ?? '',
    unit: it.unit ?? 'Nos',
    quantity: Number(it.quantity) || 0,
    rate: Number(it.rate) || 0,
    gstRate: Number(it.gst_rate) || 0,
  }
}

function mapVendor(v) {
  return {
    id: v.id,
    name: v.name ?? '',
    gstin: v.gstin ?? '',
    address: v.address ?? '',
    contactPerson: v.contact_person ?? '',
    email: v.email ?? '',
    phone: v.phone ?? '',
    notes: v.notes ?? '',
    createdAt: v.created_at,
  }
}

function mapExpenseBill(b) {
  return {
    id: b.id,
    billNumber: b.bill_number ?? '',
    billDate: b.bill_date,
    dueDate: b.due_date,
    vendorId: b.vendor_id ?? '',
    vendorName: b.vendor_name ?? '',
    vendorGstin: b.vendor_gstin ?? '',
    vendorAddress: b.vendor_address ?? '',
    branchId: b.branch_id ?? '',
    gstType: b.gst_type ?? 'intra',
    placeOfSupply: b.place_of_supply ?? '',
    discount: Number(b.discount) || 0,
    notes: b.notes ?? '',
    status: b.status ?? 'draft',
    createdAt: b.created_at,
  }
}

function mapEBItem(it) {
  return {
    id: it.id,
    productId: it.product_id ?? '',
    description: it.description ?? '',
    hsnCode: it.hsn_code ?? '',
    unit: it.unit ?? 'Nos',
    quantity: Number(it.quantity) || 0,
    rate: Number(it.rate) || 0,
    gstRate: Number(it.gst_rate) || 0,
  }
}
