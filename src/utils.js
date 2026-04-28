export const fmtMoney = (n, currency = '₹') => {
  const num = Number(n) || 0
  return `${currency}${num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export const fmtDate = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export const calcInvoice = (invoice) => {
  const subtotal = (invoice.items || []).reduce(
    (s, it) => s + (Number(it.quantity) || 0) * (Number(it.rate) || 0),
    0,
  )
  const taxAmount = subtotal * ((Number(invoice.taxRate) || 0) / 100)
  const discount = Number(invoice.discount) || 0
  const total = Math.max(0, subtotal + taxAmount - discount)
  return { subtotal, taxAmount, discount, total }
}

export const statusMeta = (status) => {
  const map = {
    draft: { label: 'Draft', cls: 'bg-soft/60 text-ash' },
    sent: { label: 'Sent', cls: 'bg-brandBlue/10 text-brandBlue' },
    paid: { label: 'Paid', cls: 'bg-success/10 text-brandGreenDark' },
    overdue: { label: 'Overdue', cls: 'bg-danger/10 text-danger' },
  }
  return map[status] || map.draft
}
