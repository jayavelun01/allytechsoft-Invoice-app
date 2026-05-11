import { Fragment, useMemo, useState } from 'react'
import { fmtMoney, fmtDate, calcInvoice, fyOf } from '../utils'
import { PageHeader, Modal } from './ui'
import {
  generateGSTR1,
  generateGSTR3B,
  generateHSNSummary,
  generateCDNR,
  toFilingPeriod,
  summarizeGSTR1,
  summarizeGSTR3B,
} from '../gstReturns'

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

  // ── GST Returns download state ──────────────────────────────────────────
  const gstinBranches = (data.branches || []).filter((b) => b.gstin)
  const [returnBranchId, setReturnBranchId] = useState(
    () => gstinBranches[0]?.id || '',
  )
  const [returnMonth, setReturnMonth] = useState(() => {
    const now = new Date()
    // Default to previous month (most recent complete period)
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`
  })

  const downloadJSON = (obj, filename) => {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const makeDownloadHandler = (generatorFn, label) => () => {
    try {
      const period = toFilingPeriod(returnMonth)
      const json = generatorFn(data, returnBranchId, period)
      const branch = gstinBranches.find((b) => b.id === returnBranchId)
      const [yyyy, mm] = returnMonth.split('-')
      downloadJSON(json, `${label}-${mm}-${yyyy}-${branch?.gstin || ''}.json`)
    } catch (e) {
      alert(e.message)
    }
  }

  const canDownload = returnBranchId && returnMonth

  // preview = null | { type: 'gstr1'|'gstr3b', summary: {...} }
  const [preview, setPreview] = useState(null)

  const openPreview = (type) => {
    try {
      const fp = toFilingPeriod(returnMonth)
      const summary = type === 'gstr1'
        ? summarizeGSTR1(data, returnBranchId, fp)
        : summarizeGSTR3B(data, returnBranchId, fp)
      setPreview({ type, summary })
    } catch (e) { alert(e.message) }
  }

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

      {/* ── GST Returns Download ── */}
      <div className="card p-5 md:p-6 mb-6">
        <h2 className="font-display font-semibold text-lg tracking-tightest mb-4">Download GST Returns</h2>

        {gstinBranches.length === 0 ? (
          <p className="text-sm text-warn">
            No branch with a GSTIN found. Add a GSTIN to at least one branch to enable return downloads.
          </p>
        ) : (
          <>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
              <div>
                <label className="label-base">Branch (GSTIN)</label>
                <select className="input-base" value={returnBranchId}
                  onChange={(e) => setReturnBranchId(e.target.value)}>
                  {gstinBranches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name} — {b.gstin}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label-base">Return period (month)</label>
                <input type="month" className="input-base" value={returnMonth}
                  onChange={(e) => setReturnMonth(e.target.value)} />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <ReturnBtn
                label="GSTR-1"
                hint="Outward supplies — B2B, B2CL, B2CS, HSN"
                disabled={!canDownload}
                onPreview={() => openPreview('gstr1')}
                onClick={makeDownloadHandler(generateGSTR1, 'GSTR1')}
              />
              <ReturnBtn
                label="GSTR-3B"
                hint="Monthly summary — tax payable"
                disabled={!canDownload}
                onPreview={() => openPreview('gstr3b')}
                onClick={makeDownloadHandler(generateGSTR3B, 'GSTR3B')}
              />
              <ReturnBtn
                label="HSN Summary"
                hint="Table 12 — HSN/SAC wise outward supplies"
                disabled={!canDownload}
                onClick={makeDownloadHandler(generateHSNSummary, 'HSN-Summary')}
              />
              <ReturnBtn
                label="Credit Notes (CDNR)"
                hint="CDNR / CDNUR — currently empty (no credit notes tracked)"
                disabled={!canDownload}
                onClick={makeDownloadHandler(generateCDNR, 'CDNR')}
              />
            </div>

            <p className="text-xs text-mute mt-4">
              JSON files match the GSTN offline tool schema and can be uploaded at{' '}
              <span className="font-mono">gst.gov.in → Returns → Offline Tools</span>.
              ITC fields in GSTR-3B are set to zero — purchase tracking is not available in this app.
              Credit note (CDNR) support will be added in a future update.
            </p>
          </>
        )}
      </div>

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

      {/* ── GST Return Preview Modal ── */}
      {preview && (
        <Modal
          open
          onClose={() => setPreview(null)}
          title={
            preview.type === 'gstr1'
              ? `GSTR-1 Summary — ${fmtPeriod(preview.summary.period)}`
              : `GSTR-3B Summary — ${fmtPeriod(preview.summary.period)}`
          }
          wide
          footer={
            <>
              <button className="btn-ghost" onClick={() => setPreview(null)}>Close</button>
              <button
                className="btn-primary"
                onClick={() => {
                  makeDownloadHandler(
                    preview.type === 'gstr1' ? generateGSTR1 : generateGSTR3B,
                    preview.type === 'gstr1' ? 'GSTR1' : 'GSTR3B',
                  )()
                  setPreview(null)
                }}
              >
                ↓ Download {preview.type === 'gstr1' ? 'GSTR-1' : 'GSTR-3B'} JSON
              </button>
            </>
          }
        >
          {preview.type === 'gstr1' ? (
            <GSTR1PreviewContent summary={preview.summary} cur={cur} />
          ) : (
            <GSTR3BPreviewContent summary={preview.summary} cur={cur} />
          )}
        </Modal>
      )}
    </div>
  )
}

function ReturnBtn({ label, hint, onClick, onPreview, disabled }) {
  return (
    <div className={`flex border hairline rounded-lg overflow-hidden bg-white ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
      <div className="flex flex-col px-4 py-2.5 text-left">
        <span className="font-medium text-sm">{label}</span>
        <span className="text-[11px] text-mute">{hint}</span>
      </div>
      {onPreview && (
        <button
          onClick={onPreview}
          className="px-3 py-2.5 text-xs border-l hairline hover:bg-mist transition-colors text-ash hover:text-ink whitespace-nowrap"
        >
          Preview
        </button>
      )}
      <button
        onClick={onClick}
        className="px-3 py-2.5 text-xs border-l hairline hover:bg-mist transition-colors text-brandBlue font-medium whitespace-nowrap"
      >
        ↓ JSON
      </button>
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

/** Convert MMYYYY filing period to readable label, e.g. "042025" → "Apr 2025". */
function fmtPeriod(mmyyyy) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${months[parseInt(mmyyyy.slice(0, 2)) - 1]} ${mmyyyy.slice(2)}`
}

// ─── Preview sub-components ────────────────────────────────────────────────────

function PreviewSection({ title, count, children }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-display font-semibold text-sm tracking-tightest">{title}</h3>
        {count != null && <span className="text-xs text-mute">{count} row{count !== 1 ? 's' : ''}</span>}
      </div>
      {children}
    </div>
  )
}

function InfoCell({ label, value, mono, bold, clickable, active, onClick }) {
  return (
    <div
      className={`bg-mist/50 border hairline rounded-lg px-3 py-2 min-w-0 transition-colors
        ${clickable ? 'cursor-pointer hover:bg-mist select-none' : ''}
        ${active ? 'ring-2 ring-brandBlue/30' : ''}`}
      onClick={clickable ? onClick : undefined}
    >
      <div className="text-[10px] uppercase tracking-[0.15em] text-mute font-mono truncate">{label}</div>
      <div className={`mt-0.5 text-sm truncate ${mono ? 'font-mono' : ''} ${bold ? 'font-bold' : 'font-medium'} ${clickable ? 'text-brandBlue' : ''}`}>
        {value}{clickable && <span className="ml-1 text-[10px]">{active ? '▲' : '▼'}</span>}
      </div>
    </div>
  )
}

/** Clickable invoice count — shows count as a link, expands/collapses on click. */
function CountBtn({ count, expanded, onClick }) {
  if (count <= 1) return <span className="tabular-nums">{count}</span>
  return (
    <button
      onClick={onClick}
      className="tabular-nums text-brandBlue underline hover:no-underline cursor-pointer"
    >
      {count} {expanded ? '▲' : '▼'}
    </button>
  )
}

function THead({ cols }) {
  return (
    <thead>
      <tr className="text-left text-[11px] uppercase tracking-wider text-mute">
        {cols.map((c, i) => (
          <th key={i} className={`py-2 font-medium ${c.right ? 'text-right' : ''}`}>{c.label}</th>
        ))}
      </tr>
    </thead>
  )
}

// ─── GSTR-1 Preview ───────────────────────────────────────────────────────────

function GSTR1PreviewContent({ summary, cur }) {
  const { branchName, gstin, period, invoiceCount, warnings, b2b, b2cl, b2cs, hsn, allInvoices, totals } = summary

  const [expandedB2B, setExpandedB2B] = useState(new Set())
  const [expandedB2CL, setExpandedB2CL] = useState(new Set())
  const [showAllInvoices, setShowAllInvoices] = useState(false)

  const toggleB2B = (key) => setExpandedB2B((prev) => { const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s })
  const toggleB2CL = (key) => setExpandedB2CL((prev) => { const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s })

  return (
    <div className="space-y-6 text-sm">
      {/* Header */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <InfoCell label="Branch" value={branchName} />
        <InfoCell label="GSTIN" value={gstin} mono />
        <InfoCell label="Period" value={fmtPeriod(period)} />
        <InfoCell
          label="Invoices (click to view)"
          value={invoiceCount}
          bold
          clickable={invoiceCount > 0}
          active={showAllInvoices}
          onClick={() => setShowAllInvoices((v) => !v)}
        />
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="rounded-lg border border-warn/30 bg-warn/5 p-3 space-y-1">
          {warnings.map((w, i) => <p key={i} className="text-xs text-warn">⚠ {w}</p>)}
        </div>
      )}

      {/* All invoices drill-down (header count click) */}
      {showAllInvoices && (
        <PreviewSection title="All invoices in this period" count={allInvoices.length}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[580px]">
              <THead cols={[
                { label: 'Invoice #' }, { label: 'Date' }, { label: 'Customer' }, { label: 'GSTIN' },
                { label: 'Taxable', right: true }, { label: 'CGST', right: true },
                { label: 'SGST', right: true }, { label: 'IGST', right: true }, { label: 'Total', right: true },
              ]} />
              <tbody>
                {allInvoices.map((inv, i) => (
                  <tr key={i} className="border-t hairline">
                    <td className="py-1.5 font-mono">{inv.number}</td>
                    <td className="py-1.5 whitespace-nowrap text-ash">{fmtDate(inv.date)}</td>
                    <td className="py-1.5 font-medium">{inv.customer}</td>
                    <td className="py-1.5 font-mono text-[11px] text-ash">{inv.gstin || '—'}</td>
                    <td className="py-1.5 text-right tabular-nums">{fmtMoney(inv.taxable, cur)}</td>
                    <td className="py-1.5 text-right tabular-nums">{fmtMoney(inv.cgst, cur)}</td>
                    <td className="py-1.5 text-right tabular-nums">{fmtMoney(inv.sgst, cur)}</td>
                    <td className="py-1.5 text-right tabular-nums">{fmtMoney(inv.igst, cur)}</td>
                    <td className="py-1.5 text-right tabular-nums font-semibold">{fmtMoney(inv.total, cur)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PreviewSection>
      )}

      {/* Grand totals */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-ice rounded-xl p-4">
        <InfoCell label="Taxable" value={fmtMoney(totals.taxable, cur)} />
        <InfoCell label="CGST" value={fmtMoney(totals.cgst, cur)} />
        <InfoCell label="SGST" value={fmtMoney(totals.sgst, cur)} />
        <InfoCell label="IGST" value={fmtMoney(totals.igst, cur)} />
        <InfoCell label="Grand total" value={fmtMoney(totals.total, cur)} bold />
      </div>

      {/* B2B */}
      <PreviewSection title="B2B — Registered buyers" count={b2b.length}>
        {b2b.length === 0 ? (
          <p className="text-xs text-mute py-2">No B2B invoices in this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[560px]">
              <THead cols={[
                { label: 'Customer' }, { label: 'GSTIN' },
                { label: 'Inv.', right: true }, { label: 'Taxable', right: true },
                { label: 'CGST', right: true }, { label: 'SGST', right: true },
                { label: 'IGST', right: true }, { label: 'Total', right: true },
              ]} />
              <tbody>
                {b2b.map((row) => (
                  <Fragment key={row.gstin}>
                    <tr className="border-t hairline">
                      <td className="py-1.5 font-medium">{row.custName}</td>
                      <td className="py-1.5 font-mono text-[11px] text-ash">{row.gstin}</td>
                      <td className="py-1.5 text-right tabular-nums">
                        <CountBtn count={row.count} expanded={expandedB2B.has(row.gstin)} onClick={() => toggleB2B(row.gstin)} />
                      </td>
                      <td className="py-1.5 text-right tabular-nums">{fmtMoney(row.taxable, cur)}</td>
                      <td className="py-1.5 text-right tabular-nums">{fmtMoney(row.cgst, cur)}</td>
                      <td className="py-1.5 text-right tabular-nums">{fmtMoney(row.sgst, cur)}</td>
                      <td className="py-1.5 text-right tabular-nums">{fmtMoney(row.igst, cur)}</td>
                      <td className="py-1.5 text-right tabular-nums font-semibold">{fmtMoney(row.total, cur)}</td>
                    </tr>
                    {expandedB2B.has(row.gstin) && (
                      <tr className="bg-mist/40">
                        <td colSpan={8} className="px-4 pt-1 pb-3">
                          <table className="w-full text-xs">
                            <THead cols={[
                              { label: 'Invoice #' }, { label: 'Date' },
                              { label: 'Taxable', right: true }, { label: 'CGST', right: true },
                              { label: 'SGST', right: true }, { label: 'IGST', right: true }, { label: 'Total', right: true },
                            ]} />
                            <tbody>
                              {row.invoices.map((inv, j) => (
                                <tr key={j} className="border-t hairline">
                                  <td className="py-1 font-mono">{inv.number}</td>
                                  <td className="py-1 whitespace-nowrap text-ash">{fmtDate(inv.date)}</td>
                                  <td className="py-1 text-right tabular-nums">{fmtMoney(inv.taxable, cur)}</td>
                                  <td className="py-1 text-right tabular-nums">{fmtMoney(inv.cgst, cur)}</td>
                                  <td className="py-1 text-right tabular-nums">{fmtMoney(inv.sgst, cur)}</td>
                                  <td className="py-1 text-right tabular-nums">{fmtMoney(inv.igst, cur)}</td>
                                  <td className="py-1 text-right tabular-nums font-medium">{fmtMoney(inv.total, cur)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PreviewSection>

      {/* B2CL */}
      {b2cl.length > 0 && (
        <PreviewSection title="B2CL — Inter-state unregistered > ₹2.5L" count={b2cl.length}>
          <table className="w-full text-xs">
            <THead cols={[
              { label: 'State' }, { label: 'Invoices', right: true },
              { label: 'Taxable', right: true }, { label: 'IGST', right: true }, { label: 'Total', right: true },
            ]} />
            <tbody>
              {b2cl.map((row, i) => {
                const key = `${row.state}-${i}`
                return (
                  <Fragment key={key}>
                    <tr className="border-t hairline">
                      <td className="py-1.5">{row.state}</td>
                      <td className="py-1.5 text-right tabular-nums">
                        <CountBtn count={row.count} expanded={expandedB2CL.has(key)} onClick={() => toggleB2CL(key)} />
                      </td>
                      <td className="py-1.5 text-right tabular-nums">{fmtMoney(row.taxable, cur)}</td>
                      <td className="py-1.5 text-right tabular-nums">{fmtMoney(row.igst, cur)}</td>
                      <td className="py-1.5 text-right tabular-nums font-semibold">{fmtMoney(row.total, cur)}</td>
                    </tr>
                    {expandedB2CL.has(key) && (
                      <tr className="bg-mist/40">
                        <td colSpan={5} className="px-4 pt-1 pb-3">
                          <table className="w-full text-xs">
                            <THead cols={[
                              { label: 'Invoice #' }, { label: 'Date' },
                              { label: 'Taxable', right: true }, { label: 'IGST', right: true }, { label: 'Total', right: true },
                            ]} />
                            <tbody>
                              {row.invoices.map((inv, j) => (
                                <tr key={j} className="border-t hairline">
                                  <td className="py-1 font-mono">{inv.number}</td>
                                  <td className="py-1 whitespace-nowrap text-ash">{fmtDate(inv.date)}</td>
                                  <td className="py-1 text-right tabular-nums">{fmtMoney(inv.taxable, cur)}</td>
                                  <td className="py-1 text-right tabular-nums">{fmtMoney(inv.igst, cur)}</td>
                                  <td className="py-1 text-right tabular-nums font-medium">{fmtMoney(inv.total, cur)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </PreviewSection>
      )}

      {/* B2CS */}
      <PreviewSection title="B2CS — Unregistered (aggregate)" count={b2cs.length}>
        {b2cs.length === 0 ? (
          <p className="text-xs text-mute py-2">No B2CS entries in this period.</p>
        ) : (
          <table className="w-full text-xs">
            <THead cols={[
              { label: 'Type' }, { label: 'State' }, { label: 'Rate', right: true },
              { label: 'Taxable', right: true }, { label: 'CGST', right: true },
              { label: 'SGST', right: true }, { label: 'IGST', right: true },
            ]} />
            <tbody>
              {b2cs.map((row, i) => (
                <tr key={i} className="border-t hairline">
                  <td className="py-1.5">{row.splyTp}</td>
                  <td className="py-1.5">{row.state}</td>
                  <td className="py-1.5 text-right tabular-nums">{row.rate}%</td>
                  <td className="py-1.5 text-right tabular-nums">{fmtMoney(row.taxable, cur)}</td>
                  <td className="py-1.5 text-right tabular-nums">{fmtMoney(row.cgst, cur)}</td>
                  <td className="py-1.5 text-right tabular-nums">{fmtMoney(row.sgst, cur)}</td>
                  <td className="py-1.5 text-right tabular-nums">{fmtMoney(row.igst, cur)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </PreviewSection>

      {/* HSN */}
      <PreviewSection title="HSN/SAC Summary" count={hsn.length}>
        {hsn.length === 0 ? (
          <p className="text-xs text-mute py-2">No items with HSN/SAC codes in this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[480px]">
              <THead cols={[
                { label: 'HSN/SAC' }, { label: 'UQC' }, { label: 'Qty', right: true },
                { label: 'Taxable', right: true }, { label: 'CGST', right: true },
                { label: 'SGST', right: true }, { label: 'IGST', right: true },
              ]} />
              <tbody>
                {hsn.map((row, i) => (
                  <tr key={i} className="border-t hairline">
                    <td className="py-1.5 font-mono">{row.hsn_sc}</td>
                    <td className="py-1.5 text-ash">{row.uqc}</td>
                    <td className="py-1.5 text-right tabular-nums">{row.qty}</td>
                    <td className="py-1.5 text-right tabular-nums">{fmtMoney(row.txval, cur)}</td>
                    <td className="py-1.5 text-right tabular-nums">{fmtMoney(row.camt, cur)}</td>
                    <td className="py-1.5 text-right tabular-nums">{fmtMoney(row.samt, cur)}</td>
                    <td className="py-1.5 text-right tabular-nums">{fmtMoney(row.iamt, cur)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PreviewSection>
    </div>
  )
}

// ─── GSTR-3B Preview ──────────────────────────────────────────────────────────

function GSTR3BPreviewContent({ summary, cur }) {
  const { branchName, gstin, period, section31, section32, invoices } = summary
  const [showInvoices, setShowInvoices] = useState(false)

  return (
    <div className="space-y-6 text-sm">
      {/* Header */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <InfoCell label="Branch" value={branchName} />
        <InfoCell label="GSTIN" value={gstin} mono />
        <InfoCell label="Period" value={fmtPeriod(period)} />
        <InfoCell
          label="Invoices (click to view)"
          value={invoices.length}
          bold
          clickable={invoices.length > 0}
          active={showInvoices}
          onClick={() => setShowInvoices((v) => !v)}
        />
      </div>

      {/* Section 3.1 */}
      <PreviewSection title="Section 3.1 — Outward taxable supplies">
        <table className="w-full text-xs">
          <THead cols={[
            { label: 'Description' },
            { label: 'Taxable value', right: true },
            { label: 'IGST', right: true }, { label: 'CGST', right: true }, { label: 'SGST', right: true },
          ]} />
          <tbody>
            <tr className="border-t hairline">
              <td className="py-2 max-w-[200px]">Outward taxable supplies (other than zero-rated, nil, exempt)</td>
              <td className="py-2 text-right tabular-nums font-semibold">{fmtMoney(section31.txval, cur)}</td>
              <td className="py-2 text-right tabular-nums">{fmtMoney(section31.iamt, cur)}</td>
              <td className="py-2 text-right tabular-nums">{fmtMoney(section31.camt, cur)}</td>
              <td className="py-2 text-right tabular-nums">{fmtMoney(section31.samt, cur)}</td>
            </tr>
            {[
              ['Zero-rated supplies (exports / SEZ)', '0.00', '0.00', '—', '—'],
              ['Nil-rated / Exempt', '0.00', '—', '—', '—'],
              ['Inward supplies liable to reverse charge', '0.00', '0.00', '0.00', '0.00'],
              ['Non-GST outward supplies', '0.00', '—', '—', '—'],
            ].map(([desc, txval, igst, cgst, sgst]) => (
              <tr key={desc} className="border-t hairline text-mute">
                <td className="py-1.5">{desc}</td>
                <td className="py-1.5 text-right tabular-nums">{txval}</td>
                <td className="py-1.5 text-right tabular-nums">{igst}</td>
                <td className="py-1.5 text-right tabular-nums">{cgst}</td>
                <td className="py-1.5 text-right tabular-nums">{sgst}</td>
              </tr>
            ))}
            <tr className="border-t hairline bg-ice font-semibold">
              <td className="py-2">Total GST liability</td>
              <td className="py-2 text-right tabular-nums">{fmtMoney(section31.txval, cur)}</td>
              <td className="py-2 text-right tabular-nums">{fmtMoney(section31.iamt, cur)}</td>
              <td className="py-2 text-right tabular-nums">{fmtMoney(section31.camt, cur)}</td>
              <td className="py-2 text-right tabular-nums">{fmtMoney(section31.samt, cur)}</td>
            </tr>
          </tbody>
        </table>
      </PreviewSection>

      {/* Section 3.2 */}
      {section32.length > 0 && (
        <PreviewSection title="Section 3.2 — Inter-state supplies to unregistered" count={section32.length}>
          <table className="w-full text-xs">
            <THead cols={[
              { label: 'State' }, { label: 'Taxable', right: true }, { label: 'IGST', right: true },
            ]} />
            <tbody>
              {section32.map((row, i) => (
                <tr key={i} className="border-t hairline">
                  <td className="py-1.5">{row.state}</td>
                  <td className="py-1.5 text-right tabular-nums">{fmtMoney(row.txval, cur)}</td>
                  <td className="py-1.5 text-right tabular-nums">{fmtMoney(row.iamt, cur)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </PreviewSection>
      )}

      {/* Invoice list — toggled by header count click */}
      {showInvoices && (
        <PreviewSection title="Invoices included in this return" count={invoices.length}>
          {invoices.length === 0 ? (
            <p className="text-xs text-mute py-2">No eligible invoices found for this branch and period.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[640px]">
                <THead cols={[
                  { label: 'Invoice #' }, { label: 'Date' }, { label: 'Customer' },
                  { label: 'GSTIN' }, { label: 'Type' },
                  { label: 'Taxable', right: true }, { label: 'CGST', right: true },
                  { label: 'SGST', right: true }, { label: 'IGST', right: true },
                  { label: 'Total', right: true },
                ]} />
                <tbody>
                  {invoices.map((inv, i) => (
                    <tr key={i} className="border-t hairline">
                      <td className="py-1.5 font-mono">{inv.number}</td>
                      <td className="py-1.5 text-ash whitespace-nowrap">{fmtDate(inv.date)}</td>
                      <td className="py-1.5 font-medium">{inv.customer}</td>
                      <td className="py-1.5 font-mono text-[11px] text-ash">{inv.gstin || '—'}</td>
                      <td className="py-1.5 text-ash">{inv.gstType === 'intra' ? 'Intra' : 'Inter'}</td>
                      <td className="py-1.5 text-right tabular-nums">{fmtMoney(inv.taxable, cur)}</td>
                      <td className="py-1.5 text-right tabular-nums">{fmtMoney(inv.cgst, cur)}</td>
                      <td className="py-1.5 text-right tabular-nums">{fmtMoney(inv.sgst, cur)}</td>
                      <td className="py-1.5 text-right tabular-nums">{fmtMoney(inv.igst, cur)}</td>
                      <td className="py-1.5 text-right tabular-nums font-semibold">{fmtMoney(inv.total, cur)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </PreviewSection>
      )}
    </div>
  )
}
