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

/**
 * Calculates a single invoice line's GST split.
 * gstType: 'intra' (CGST+SGST split half/half) or 'inter' (IGST only)
 */
export const calcItemGst = (item, gstType) => {
  const qty = Number(item.quantity) || 0
  const rate = Number(item.rate) || 0
  const gstRate = Number(item.gstRate) || 0
  const taxable = qty * rate
  const totalTax = (taxable * gstRate) / 100

  if (gstType === 'inter') {
    return { taxable, cgst: 0, sgst: 0, igst: totalTax, totalTax }
  }
  return { taxable, cgst: totalTax / 2, sgst: totalTax / 2, igst: 0, totalTax }
}

/**
 * Calculates an invoice's totals: subtotal, CGST, SGST, IGST, total tax,
 * discount, grand total, plus a per-rate breakdown for the GST summary on the bill.
 */
export const calcInvoice = (invoice) => {
  const items = invoice.items || []
  const gstType = invoice.gstType || 'intra'
  let subtotal = 0
  let cgst = 0
  let sgst = 0
  let igst = 0
  const byRate = {} // { 18: { taxable, cgst, sgst, igst, total }, 12: {...} }

  for (const it of items) {
    const r = calcItemGst(it, gstType)
    subtotal += r.taxable
    cgst += r.cgst
    sgst += r.sgst
    igst += r.igst

    const rateKey = String(Number(it.gstRate) || 0)
    if (!byRate[rateKey]) {
      byRate[rateKey] = { taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 }
    }
    byRate[rateKey].taxable += r.taxable
    byRate[rateKey].cgst += r.cgst
    byRate[rateKey].sgst += r.sgst
    byRate[rateKey].igst += r.igst
    byRate[rateKey].total += r.totalTax
  }

  const discount = Number(invoice.discount) || 0
  const totalTax = cgst + sgst + igst
  const total = Math.max(0, subtotal + totalTax - discount)

  return {
    subtotal,
    cgst,
    sgst,
    igst,
    totalTax,
    discount,
    total,
    byRate,        // { '18': {...}, '12': {...} }
    gstType,
  }
}

export const statusMeta = (status) => {
  const map = {
    draft:     { label: 'Draft',     cls: 'bg-soft/60 text-ash' },
    sent:      { label: 'Sent',      cls: 'bg-brandBlue/10 text-brandBlue' },
    paid:      { label: 'Paid',      cls: 'bg-success/10 text-brandGreenDark' },
    overdue:   { label: 'Overdue',   cls: 'bg-danger/10 text-danger' },
    cancelled: { label: 'Cancelled', cls: 'bg-mute/10 text-mute' },
    open:      { label: 'Open',      cls: 'bg-brandBlue/10 text-brandBlue' },
    closed:    { label: 'Closed',    cls: 'bg-success/10 text-brandGreenDark' },
    delivered: { label: 'Delivered', cls: 'bg-success/10 text-brandGreenDark' },
  }
  return map[status] || map.draft
}

/** YYYY-MM-DD for today, in local time. */
export const todayISO = () => {
  const d = new Date()
  const off = d.getTimezoneOffset() * 60000
  return new Date(d - off).toISOString().slice(0, 10)
}

/** YYYY-MM-DD n days from today. */
export const plusDaysISO = (n) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  const off = d.getTimezoneOffset() * 60000
  return new Date(d - off).toISOString().slice(0, 10)
}

/** Identify Indian financial year for a date (Apr 1 - Mar 31). */
export const fyOf = (iso) => {
  if (!iso) return null
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = d.getMonth() // 0-based
  const start = m >= 3 ? y : y - 1
  return { start, end: start + 1, label: `${start}-${String(start + 1).slice(-2)}` }
}
