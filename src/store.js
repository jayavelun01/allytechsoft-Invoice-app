import { todayISO, plusDaysISO } from './utils'

export const newId = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 7)

export const formatNumber = (prefix, n, width = 4) =>
  `${prefix}${String(n).padStart(width, '0')}`

/** Returns the default "from" branch + matching invoice number for a new invoice. */
export const pickDefaultBranch = (data) => {
  const branches = data.branches || []
  return branches.find((b) => b.is_default) || branches[0] || null
}

export const blankInvoice = (data) => {
  const branch = pickDefaultBranch(data)
  const customer = data.customers[0] || null
  const customerBranches = (data.customerBranches || []).filter(
    (cb) => cb.customer_id === customer?.id,
  )
  const customerBranch = customerBranches.find((b) => b.is_default) || customerBranches[0] || null

  // Auto detect intra vs inter based on state codes (user can override)
  const gstType =
    branch?.state_code &&
    customerBranch?.state_code &&
    branch.state_code === customerBranch.state_code
      ? 'intra'
      : 'inter'

  return {
    id: newId(),
    number: branch
      ? formatNumber(branch.invoice_prefix || 'INV-', branch.next_invoice_number || 1)
      : formatNumber(data.settings.invoicePrefix || 'INV-', data.settings.nextInvoiceNumber || 1),
    branchId: branch?.id || '',
    customerId: customer?.id || '',
    customerBranchId: customerBranch?.id || '',
    purchaseOrderId: '',
    deliveryChallanId: '',
    issueDate: todayISO(),
    dueDate: plusDaysISO(15),
    expectedDeliveryDate: '',
    items: [blankInvoiceItem(data.settings)],
    taxRate: data.settings.defaultTaxRate || 18,
    discount: 0,
    notes: '',
    status: 'draft',
    gstType,
    placeOfSupply: customerBranch?.state || '',
    signingAuthority: branch?.signing_authority || '',
    termsAndConditions: data.settings.defaultTerms || '',
    vehicleNumber: '',
    lrNumber: '',
    lrDate: '',
    deliveryMode: '',
    createdAt: new Date().toISOString(),
  }
}

export const blankInvoiceItem = (settings) => ({
  id: newId(),
  productId: '',
  description: '',
  hsnCode: '',
  unit: 'Nos',
  quantity: 1,
  rate: 0,
  gstRate: settings?.defaultTaxRate ?? 18,
})

export const blankPurchaseOrder = () => ({
  id: newId(),
  number: '',
  poDate: todayISO(),
  customerId: '',
  customerBranchId: '',
  items: [blankPOItem()],
  notes: '',
  status: 'open',
  createdAt: new Date().toISOString(),
})

export const blankPOItem = () => ({
  id: newId(),
  productId: '',
  description: '',
  unit: 'Nos',
  quantity: 1,
  rate: 0,
})

export const blankDeliveryChallan = () => ({
  id: newId(),
  number: '',
  dcDate: todayISO(),
  customerId: '',
  customerBranchId: '',
  purchaseOrderId: '',
  vehicleNumber: '',
  lrNumber: '',
  lrDate: '',
  deliveryMode: '',
  items: [blankDCItem()],
  notes: '',
  status: 'open',
  createdAt: new Date().toISOString(),
})

export const blankDCItem = () => ({
  id: newId(),
  productId: '',
  description: '',
  unit: 'Nos',
  quantity: 1,
})
