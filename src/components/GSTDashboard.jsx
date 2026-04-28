import { useMemo, useState } from 'react'
import { fmtMoney, calcInvoice, fyOf } from '../utils'
import { PageHeader } from './ui'

const PERIODS = [
  { id: 'all', label: 'All time' },
  { id: 'thisFY', label: 'This FY' },
  { id: 'lastFY', label: 'Last FY' },
  { id: 'thisMonth', label: 'This month' },
  { id: 'lastMonth', label: 'Last month' },
]

function inPeriod(iso, period) {
  if (!iso) return false
  if (period === 'all') return true
  const d = new Date(iso)
  const now = new Date()

  if (period === 'thisMonth') {
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }
  if (period === 'lastMonth') {
    const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    return d.getMonth() === lm.getMonth() && d.getFullYear() === lm.getFullYear()
  }
  if (period === 'thisFY') {
    const fy = fyOf(now.toISOString())
    return d >= new Date(fy.start, 3, 1) && d < new Date(fy.end, 3, 1)
  }
  if (period === 'lastFY') {
    const fy = fyOf(now.toISOString())
    return d >= new Date(fy.start - 1, 3, 1) && d < new Date(fy.start, 3, 1)
  }
  return true
}

export default function GSTDashboard({ data }) {
  const [period, setPeriod] = useState('thisFY')

  const stats = useMemo(() => {
    // Only count non-cancelled, non-draft invoices for GST liability
    const eligible = data.invoices.filter(
      (i) => i.status !== 'draft' && i.status !== 'cancelled' && inPeriod(i.issueDate, period),
    )

    let taxable = 0
    let cgst = 0, sgst = 0, igst = 0
    let collected = 0   // GST on paid invoices
    let outstanding = 0 // GST on sent/overdue (not yet paid)

    const byRate = {} // { 18: {...}, 12: {...} }
    const byCustomer = {} // { custId: { name, taxable, gst, total } }
    const byMonth = {} // { 'YYYY-MM': { taxable, gst, total } }

    for (const inv of eligible) {
      const t = calcInvoice(inv)
      taxable += t.subtotal
      cgst += t.cgst; sgst += t.sgst; igst += t.igst

      if (inv.status === 'paid') collected += t.totalTax
      else outstanding += t.totalTax

      // by rate
      for (const [r, b] of Object.entries(t.byRate)) {
        if (!byRate[r]) byRate[r] = { taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 }
        byRate[r].taxable += b.taxable
        byRate[r].cgst += b.cgst
        byRate[r].sgst += b.sgst
        byRate[r].igst += b.igst
        byRate[r].total += b.total
      }

      // by customer
      const customer = data.customers.find((c) => c.id === inv.customerId)
      const ckey = inv.customerId || '__deleted__'
      if (!byCustomer[ckey]) {
        byCustomer[ckey] = {
          name: customer?.name || '— deleted —',
          gstin: customer?.gstin || '',
          taxable: 0, gst: 0, total: 0,
        }
      }
      byCustomer[ckey].taxable += t.subtotal
      byCustomer[ckey].gst += t.totalTax
      byCustomer[ckey].total += t.total

      // by month
      if (inv.issueDate) {
        const mkey = inv.issueDate.slice(0, 7)
        if (!byMonth[mkey]) byMonth[mkey] = { taxable: 0, gst: 0, total: 0 }
        byMonth[mkey].taxable += t.subtotal
        byMonth[mkey].gst += t.totalTax
        byMonth[mkey].total += t.total
      }
    }

    const totalGst = cgst + sgst + igst

    return {
      eligibleCount: eligible.length,
      taxable, cgst, sgst, igst, totalGst,
      collected, outstanding,
      byRate, byCustomer, byMonth,
    }
  }, [data, period])

  const cur = data.settings.currency

  const exportCsv = () => {
    const rows = [
      ['Invoice #','Date','Customer','GSTIN','Place of supply','GST type','Status','Taxable','CGST','SGST','IGST','Total GST','Total'],
    ]
    const eligible = data.invoices.filter(
      (i) => i.status !== 'draft' && i.status !== 'cancelled' && inPeriod(i.issueDate, period),
    )
    for (const inv of eligible) {
      const t = calcInvoice(inv)
      const cust = data.customers.find((c) => c.id === inv.customerId)
      const cb = data.customerBranches.find((b) => b.id === inv.customerBranchId)
      rows.push([
        inv.number, inv.issueDate, cust?.name || '',
        cb?.gstin || cust?.gstin || '', inv.placeOfSupply || '',
        inv.gstType || '', inv.status,
        t.subtotal.toFixed(2), t.cgst.toFixed(2), t.sgst.toFixed(2),
        t.igst.toFixed(2), t.totalTax.toFixed(2), t.total.toFixed(2),
      ])
    }
    const csv = rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `gst-${period}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <PageHeader
        title="GST Dashboard"
        subtitle="Collected GST, broken down by rate, customer, and month."
        actions={
          <button onClick={exportCsv} className="btn-outline">↓ Export CSV (GSTR-friendly)</button>
        }
      />

      {/* Period filter */}
      <div className="flex items-center gap-1 p-1 bg-white border hairline rounded-lg w-fit mb-6">
        {PERIODS.map((p) => (
          <button key={p.id} onClick={() => setPeriod(p.id)}
            className={`px-3 py-1.5 rounded-md text-sm transition-colors ${period === p.id ? 'bg-ink text-white' : 'text-ash hover:text-ink'}`}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total taxable" value={fmtMoney(stats.taxable, cur)} hint={`${stats.eligibleCount} invoices`} />
        <StatCard label="Total GST" value={fmtMoney(stats.totalGst, cur)} tone="blue" />
        <StatCard label="Collected (paid)" value={fmtMoney(stats.collected, cur)} tone="green" />
        <StatCard label="Outstanding" value={fmtMoney(stats.outstanding, cur)} tone="warn" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* CGST / SGST / IGST split */}
        <div className="card p-6">
          <h2 className="font-display font-semibold text-lg tracking-tightest mb-4">By tax type</h2>
          <div className="space-y-3">
            <Bar label="CGST" amount={stats.cgst} max={Math.max(stats.cgst, stats.sgst, stats.igst)} cur={cur} color="brandBlue" />
            <Bar label="SGST" amount={stats.sgst} max={Math.max(stats.cgst, stats.sgst, stats.igst)} cur={cur} color="brandTeal" />
            <Bar label="IGST" amount={stats.igst} max={Math.max(stats.cgst, stats.sgst, stats.igst)} cur={cur} color="brandGreen" />
          </div>
        </div>

        {/* By rate */}
        <div className="card p-6">
          <h2 className="font-display font-semibold text-lg tracking-tightest mb-4">By GST rate</h2>
          {Object.keys(stats.byRate).length === 0 ? (
            <div className="text-sm text-mute py-4">No GST data in this period.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-mute">
                  <th className="py-2 font-medium">Rate</th>
                  <th className="py-2 font-medium text-right">Taxable</th>
                  <th className="py-2 font-medium text-right">GST</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(stats.byRate)
                  .sort((a, b) => Number(a[0]) - Number(b[0]))
                  .map(([rate, b]) => (
                    <tr key={rate} className="border-t hairline">
                      <td className="py-2 font-mono">{rate}%</td>
                      <td className="py-2 text-right tabular-nums">{fmtMoney(b.taxable, cur)}</td>
                      <td className="py-2 text-right tabular-nums font-medium">{fmtMoney(b.total, cur)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>

        {/* By month */}
        <div className="card p-6 lg:col-span-2">
          <h2 className="font-display font-semibold text-lg tracking-tightest mb-4">By month</h2>
          {Object.keys(stats.byMonth).length === 0 ? (
            <div className="text-sm text-mute py-4">No invoices in this period.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-mute">
                  <th className="py-2 font-medium">Month</th>
                  <th className="py-2 font-medium text-right">Taxable</th>
                  <th className="py-2 font-medium text-right">GST</th>
                  <th className="py-2 font-medium text-right">Total billed</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(stats.byMonth)
                  .sort((a, b) => b[0].localeCompare(a[0]))
                  .map(([month, b]) => (
                    <tr key={month} className="border-t hairline">
                      <td className="py-2 font-mono">{formatMonth(month)}</td>
                      <td className="py-2 text-right tabular-nums">{fmtMoney(b.taxable, cur)}</td>
                      <td className="py-2 text-right tabular-nums">{fmtMoney(b.gst, cur)}</td>
                      <td className="py-2 text-right tabular-nums font-medium">{fmtMoney(b.total, cur)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Top customers */}
        <div className="card p-6 lg:col-span-2">
          <h2 className="font-display font-semibold text-lg tracking-tightest mb-4">Top customers by GST contribution</h2>
          {Object.keys(stats.byCustomer).length === 0 ? (
            <div className="text-sm text-mute py-4">No customer data in this period.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-mute">
                  <th className="py-2 font-medium">Customer</th>
                  <th className="py-2 font-medium">GSTIN</th>
                  <th className="py-2 font-medium text-right">Taxable</th>
                  <th className="py-2 font-medium text-right">GST</th>
                  <th className="py-2 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {Object.values(stats.byCustomer)
                  .sort((a, b) => b.gst - a.gst)
                  .slice(0, 10)
                  .map((c, i) => (
                    <tr key={i} className="border-t hairline">
                      <td className="py-2 font-medium">{c.name}</td>
                      <td className="py-2 font-mono text-[12px] text-ash">{c.gstin || '—'}</td>
                      <td className="py-2 text-right tabular-nums">{fmtMoney(c.taxable, cur)}</td>
                      <td className="py-2 text-right tabular-nums font-medium">{fmtMoney(c.gst, cur)}</td>
                      <td className="py-2 text-right tabular-nums">{fmtMoney(c.total, cur)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, hint, tone = 'ink' }) {
  const tones = {
    ink: 'text-ink',
    blue: 'text-brandBlue',
    green: 'text-brandGreenDark',
    warn: 'text-warn',
  }
  return (
    <div className="card p-5">
      <div className="text-xs uppercase tracking-[0.15em] text-mute font-mono">{label}</div>
      <div className={`mt-2 font-display font-bold text-2xl md:text-3xl tracking-tightest ${tones[tone]}`}>{value}</div>
      {hint && <div className="text-xs text-mute mt-1">{hint}</div>}
    </div>
  )
}

function Bar({ label, amount, max, cur, color }) {
  const pct = max > 0 ? (amount / max) * 100 : 0
  const colors = {
    brandBlue: 'bg-brandBlue',
    brandTeal: 'bg-brandTeal',
    brandGreen: 'bg-brandGreen',
  }
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="text-ash">{label}</span>
        <span className="font-medium tabular-nums">{fmtMoney(amount, cur)}</span>
      </div>
      <div className="h-2 bg-ice rounded-full overflow-hidden">
        <div className={`h-full ${colors[color]} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function formatMonth(yyyymm) {
  const [y, m] = yyyymm.split('-')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${months[Number(m) - 1]} ${y}`
}
