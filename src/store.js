// Pure helpers for the invoice app. Persistence is handled by src/db.js.

const todayISO = () => new Date().toISOString().slice(0, 10)

const plusDaysISO = (n) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

export const newId = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 7)

export const formatInvoiceNumber = (settings, n) =>
  `${settings.invoicePrefix}${String(n).padStart(4, '0')}`

export const blankInvoice = (data) => ({
  id: newId(),
  number: formatInvoiceNumber(data.settings, data.settings.nextInvoiceNumber),
  customerId: data.customers[0]?.id || '',
  issueDate: todayISO(),
  dueDate: plusDaysISO(15),
  items: [{ id: newId(), description: '', quantity: 1, rate: 0 }],
  taxRate: data.settings.defaultTaxRate,
  discount: 0,
  notes: '',
  status: 'draft',
  createdAt: new Date().toISOString(),
})
