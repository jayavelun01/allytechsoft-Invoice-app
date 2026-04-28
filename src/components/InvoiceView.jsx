import { useRef, useState } from 'react'
import { fmtMoney, fmtDate, calcInvoice, calcItemGst, statusMeta } from '../utils'
import { StatusPill } from './ui'
import { downloadElementAsPdf } from '../pdf'

export default function InvoiceView({ data, invoiceId, onNav }) {
  const inv = data.invoices.find((i) => i.id === invoiceId)
  const docRef = useRef(null)
  const [pdfBusy, setPdfBusy] = useState(false)

  if (!inv) {
    return (
      <div className="card p-10 text-center">
        <p className="text-ash">Invoice not found.</p>
        <button onClick={() => onNav('invoices')} className="btn-primary mt-4">Back to invoices</button>
      </div>
    )
  }

  const customer = data.customers.find((c) => c.id === inv.customerId)
  const customerBranch = data.customerBranches.find((b) => b.id === inv.customerBranchId)
  const branch = data.branches.find((b) => b.id === inv.branchId)
  const po = data.purchaseOrders.find((p) => p.id === inv.purchaseOrderId)
  const dc = data.deliveryChallans.find((d) => d.id === inv.deliveryChallanId)
  const { company, settings } = data
  const totals = calcInvoice(inv)

  // Effective From details (branch overrides company)
  const fromName = branch?.name || company.name
  const fromAddress = branch?.address || company.address
  const fromGstin = branch?.gstin || ''
  const fromState = branch?.state || ''
  const fromEmail = branch?.email || company.email
  const fromPhone = branch?.phone || company.phone

  // Effective To details (customer branch overrides primary)
  const toName = customer?.name || ''
  const toAddress = customerBranch?.address || customer?.address || ''
  const toGstin = customerBranch?.gstin || customer?.gstin || ''
  const toState = customerBranch?.state || ''
  const toContact = customerBranch?.contactPerson || customer?.contactPerson || ''
  const toEmail = customerBranch?.email || customer?.email || ''
  const toPhone = customerBranch?.phone || customer?.phone || ''

  const downloadPdf = async () => {
    setPdfBusy(true)
    try {
      const fname = `${inv.number || 'INVOICE'}_${(toName || 'Customer').replace(/[^A-Za-z0-9_-]+/g, '_')}.pdf`
      await downloadElementAsPdf(docRef.current, fname)
    } catch (e) {
      alert('Could not generate PDF: ' + e.message)
    } finally {
      setPdfBusy(false)
    }
  }

  const emailTo = () => {
    const subj = `Invoice ${inv.number} from ${fromName}`
    const body =
      `Dear ${toContact || toName || 'Sir/Madam'},\n\n` +
      `Please find attached our tax invoice ${inv.number} dated ${fmtDate(inv.issueDate)} for ${fmtMoney(totals.total, settings.currency)}.\n\n` +
      `Note: please use the "Download PDF" button to save the invoice, then attach it to this email.\n\n` +
      `Regards,\n${fromName}`
    const url = `mailto:${encodeURIComponent(toEmail || '')}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(body)}`
    window.open(url, '_blank')
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="no-print flex items-center justify-between gap-3 flex-wrap mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => onNav('invoices')} className="btn-ghost">← Back</button>
          <StatusPill status={inv.status} statusMeta={statusMeta} />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => onNav('invoice-edit', inv.id)} className="btn-outline">Edit</button>
          <button onClick={() => window.print()} className="btn-outline">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M4 6V2h8v4M4 12H2V7h12v5h-2M4 10h8v4H4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
            Print
          </button>
          <button onClick={downloadPdf} disabled={pdfBusy} className="btn-outline">
            {pdfBusy ? 'Generating…' : '↓ PDF'}
          </button>
          <button onClick={emailTo} className="btn-gradient">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M2 4h12v8H2zm0 0l6 5 6-5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
            Email
          </button>
        </div>
      </div>

      {/* Document */}
      <article ref={docRef} className="invoice-print card p-8 md:p-12 max-w-[860px] mx-auto bg-white">
        {/* Header */}
        <div className="flex items-start justify-between gap-6 flex-wrap pb-6 border-b-2 border-ink/20">
          <div className="flex items-start gap-3">
            <img src={company.logo || '/logo.png'} alt="" className="h-14 w-14 object-contain" crossOrigin="anonymous" />
            <div>
              <div className="font-display font-bold text-2xl tracking-tightest">{fromName}</div>
              <div className="text-xs text-ash mt-1.5 leading-relaxed whitespace-pre-line">
                {fromAddress}
                {fromState ? `\n${fromState}` : ''}
              </div>
              <div className="text-xs text-ash mt-1">
                {fromEmail}{fromPhone ? ` · ${fromPhone}` : ''}
              </div>
              {fromGstin && (
                <div className="text-xs mt-1">
                  <span className="font-mono uppercase tracking-wider text-mute">GSTIN: </span>
                  <span className="font-mono">{fromGstin}</span>
                </div>
              )}
            </div>
          </div>

          <div className="text-right">
            <div className="font-display font-bold text-3xl tracking-tightest text-brand-gradient">TAX INVOICE</div>
            <div className="font-mono text-base mt-1">{inv.number}</div>
            <div className="text-xs text-mute mt-1">
              Issued {fmtDate(inv.issueDate)} · Due {fmtDate(inv.dueDate)}
            </div>
          </div>
        </div>

        {/* Bill To + meta */}
        <div className="grid sm:grid-cols-2 gap-6 mt-6">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-mute font-mono mb-2">Bill to</div>
            <div className="font-display font-semibold text-lg tracking-tightest">{toName}</div>
            {customerBranch?.name && <div className="text-sm text-ash mt-0.5">{customerBranch.name}</div>}
            {toContact && <div className="text-sm text-ash mt-0.5">Attn: {toContact}</div>}
            {toAddress && <div className="text-sm text-ash mt-1 whitespace-pre-line leading-relaxed">{toAddress}</div>}
            {toState && <div className="text-sm text-ash mt-0.5">{toState}</div>}
            {toEmail && <div className="text-xs text-ash mt-1">{toEmail}</div>}
            {toPhone && <div className="text-xs text-ash">{toPhone}</div>}
            {toGstin && (
              <div className="text-xs mt-1.5">
                <span className="font-mono uppercase tracking-wider text-mute">GSTIN: </span>
                <span className="font-mono">{toGstin}</span>
              </div>
            )}
          </div>

          <div className="space-y-2 sm:text-right text-sm">
            {inv.placeOfSupply && (
              <Row label="Place of supply" value={inv.placeOfSupply} />
            )}
            <Row label="GST type" value={inv.gstType === 'inter' ? 'Inter-state (IGST)' : 'Intra-state (CGST + SGST)'} />
            {inv.expectedDeliveryDate && (
              <Row label="Expected delivery" value={fmtDate(inv.expectedDeliveryDate)} />
            )}
            {po && <Row label="PO #" value={`${po.number} (${fmtDate(po.poDate)})`} />}
            {dc && <Row label="DC #" value={`${dc.number} (${fmtDate(dc.dcDate)})`} />}
            {inv.deliveryMode && <Row label="Delivery mode" value={inv.deliveryMode} />}
            {inv.vehicleNumber && <Row label="Vehicle" value={inv.vehicleNumber} />}
            {inv.lrNumber && <Row label="LR #" value={`${inv.lrNumber}${inv.lrDate ? ' / ' + fmtDate(inv.lrDate) : ''}`} />}
          </div>
        </div>

        {/* Items table */}
        <div className="mt-8">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b-2 border-ink/20 text-left">
                <th className="py-2 px-1 font-mono uppercase tracking-wider text-mute">#</th>
                <th className="py-2 px-1 font-mono uppercase tracking-wider text-mute">Description</th>
                <th className="py-2 px-1 font-mono uppercase tracking-wider text-mute">HSN</th>
                <th className="py-2 px-1 font-mono uppercase tracking-wider text-mute text-right">Qty</th>
                <th className="py-2 px-1 font-mono uppercase tracking-wider text-mute">Unit</th>
                <th className="py-2 px-1 font-mono uppercase tracking-wider text-mute text-right">Rate</th>
                <th className="py-2 px-1 font-mono uppercase tracking-wider text-mute text-right">Taxable</th>
                <th className="py-2 px-1 font-mono uppercase tracking-wider text-mute text-right">GST%</th>
                {inv.gstType === 'intra' ? (
                  <>
                    <th className="py-2 px-1 font-mono uppercase tracking-wider text-mute text-right">CGST</th>
                    <th className="py-2 px-1 font-mono uppercase tracking-wider text-mute text-right">SGST</th>
                  </>
                ) : (
                  <th className="py-2 px-1 font-mono uppercase tracking-wider text-mute text-right">IGST</th>
                )}
                <th className="py-2 px-1 font-mono uppercase tracking-wider text-mute text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {inv.items.map((it, idx) => {
                const r = calcItemGst(it, inv.gstType)
                return (
                  <tr key={it.id} className="border-b hairline align-top">
                    <td className="py-2.5 px-1 text-ash">{idx + 1}</td>
                    <td className="py-2.5 px-1">
                      {it.description || <span className="text-mute italic">No description</span>}
                    </td>
                    <td className="py-2.5 px-1 font-mono text-[11px]">{it.hsnCode || '—'}</td>
                    <td className="py-2.5 px-1 text-right tabular-nums">{Number(it.quantity) || 0}</td>
                    <td className="py-2.5 px-1 text-ash">{it.unit || '—'}</td>
                    <td className="py-2.5 px-1 text-right tabular-nums">{fmtMoney(it.rate, settings.currency)}</td>
                    <td className="py-2.5 px-1 text-right tabular-nums">{fmtMoney(r.taxable, settings.currency)}</td>
                    <td className="py-2.5 px-1 text-right tabular-nums">{Number(it.gstRate) || 0}%</td>
                    {inv.gstType === 'intra' ? (
                      <>
                        <td className="py-2.5 px-1 text-right tabular-nums">{fmtMoney(r.cgst, settings.currency)}</td>
                        <td className="py-2.5 px-1 text-right tabular-nums">{fmtMoney(r.sgst, settings.currency)}</td>
                      </>
                    ) : (
                      <td className="py-2.5 px-1 text-right tabular-nums">{fmtMoney(r.igst, settings.currency)}</td>
                    )}
                    <td className="py-2.5 px-1 text-right tabular-nums font-medium">
                      {fmtMoney(r.taxable + r.totalTax, settings.currency)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Totals + GST summary */}
        <div className="mt-6 grid md:grid-cols-2 gap-6">
          {/* Per-rate breakdown */}
          {Object.keys(totals.byRate).length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-mute font-mono mb-2">GST summary</div>
              <table className="w-full text-xs border hairline rounded">
                <thead>
                  <tr className="bg-mist/50 text-left">
                    <th className="px-3 py-2 font-medium">Rate</th>
                    <th className="px-3 py-2 font-medium text-right">Taxable</th>
                    {inv.gstType === 'intra' ? (
                      <>
                        <th className="px-3 py-2 font-medium text-right">CGST</th>
                        <th className="px-3 py-2 font-medium text-right">SGST</th>
                      </>
                    ) : (
                      <th className="px-3 py-2 font-medium text-right">IGST</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(totals.byRate).map(([rate, b]) => (
                    <tr key={rate} className="border-t hairline">
                      <td className="px-3 py-1.5 font-mono">{rate}%</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{fmtMoney(b.taxable, settings.currency)}</td>
                      {inv.gstType === 'intra' ? (
                        <>
                          <td className="px-3 py-1.5 text-right tabular-nums">{fmtMoney(b.cgst, settings.currency)}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{fmtMoney(b.sgst, settings.currency)}</td>
                        </>
                      ) : (
                        <td className="px-3 py-1.5 text-right tabular-nums">{fmtMoney(b.igst, settings.currency)}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Grand totals */}
          <div className="md:flex md:justify-end">
            <div className="w-full md:w-72 space-y-1.5 text-sm">
              <Row label="Subtotal" value={fmtMoney(totals.subtotal, settings.currency)} />
              {inv.gstType === 'intra' ? (
                <>
                  <Row label="CGST" value={fmtMoney(totals.cgst, settings.currency)} />
                  <Row label="SGST" value={fmtMoney(totals.sgst, settings.currency)} />
                </>
              ) : (
                <Row label="IGST" value={fmtMoney(totals.igst, settings.currency)} />
              )}
              <Row label="Total GST" value={fmtMoney(totals.totalTax, settings.currency)} />
              {totals.discount > 0 && (
                <Row label="Discount" value={`− ${fmtMoney(totals.discount, settings.currency)}`} />
              )}
              <div className="pt-2 border-t-2 border-ink/20 flex items-center justify-between">
                <span className="font-display font-semibold text-base">Total</span>
                <span className="font-display font-bold text-2xl tracking-tightest text-brandBlue tabular-nums">
                  {fmtMoney(totals.total, settings.currency)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Notes / T&C */}
        {(inv.notes || inv.termsAndConditions || settings.paymentTerms) && (
          <div className="mt-10 pt-6 border-t hairline grid md:grid-cols-2 gap-6">
            {inv.notes && (
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-mute font-mono mb-1.5">Notes</div>
                <p className="text-xs text-ash leading-relaxed whitespace-pre-line">{inv.notes}</p>
              </div>
            )}
            {(inv.termsAndConditions || settings.paymentTerms) && (
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-mute font-mono mb-1.5">Terms &amp; Conditions</div>
                <p className="text-xs text-ash leading-relaxed whitespace-pre-line">
                  {inv.termsAndConditions || settings.paymentTerms}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Sign-off */}
        <div className="mt-12 pt-6 border-t hairline grid grid-cols-2 gap-6">
          <div className="text-xs text-mute">
            Thank you for your business.
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.2em] text-mute font-mono">For {fromName}</div>
            <div className="mt-12 pt-2 border-t hairline inline-block min-w-[180px]">
              <div className="text-xs">{inv.signingAuthority || 'Authorised Signatory'}</div>
            </div>
          </div>
        </div>
      </article>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-ash">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  )
}
