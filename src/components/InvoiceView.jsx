import { fmtMoney, fmtDate, calcInvoice, statusMeta } from '../utils'
import { StatusPill } from './ui'

export default function InvoiceView({ data, invoiceId, onNav }) {
  const inv = data.invoices.find((i) => i.id === invoiceId)

  if (!inv) {
    return (
      <div className="card p-10 text-center">
        <p className="text-ash">Invoice not found.</p>
        <button onClick={() => onNav('invoices')} className="btn-primary mt-4">
          Back to invoices
        </button>
      </div>
    )
  }

  const customer = data.customers.find((c) => c.id === inv.customerId)
  const { company, settings } = data
  const totals = calcInvoice(inv)

  return (
    <div>
      {/* Toolbar (hidden in print) */}
      <div className="no-print flex items-center justify-between gap-3 flex-wrap mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => onNav('invoices')} className="btn-ghost">
            ← Back
          </button>
          <StatusPill status={inv.status} statusMeta={statusMeta} />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => onNav('invoice-edit', inv.id)} className="btn-outline">
            Edit
          </button>
          <button onClick={() => window.print()} className="btn-gradient">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 6V2h8v4M4 12H2V7h12v5h-2M4 10h8v4H4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
            Print / save PDF
          </button>
        </div>
      </div>

      {/* Document */}
      <article className="invoice-print card p-8 md:p-12 max-w-[860px] mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="flex items-start gap-3">
            <img src={company.logo || '/logo.png'} alt="" className="h-12 w-12 object-contain" />
            <div>
              <div className="font-display font-bold text-xl tracking-tightest">{company.name}</div>
              <div className="text-xs text-mute mt-1 leading-relaxed whitespace-pre-line">
                {[company.address, company.email, company.phone, company.taxId && `Tax ID: ${company.taxId}`]
                  .filter(Boolean)
                  .join('\n')}
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="font-display font-bold text-3xl tracking-tightest text-brand-gradient">
              INVOICE
            </div>
            <div className="font-mono text-sm mt-1">{inv.number}</div>
          </div>
        </div>

        <div className="my-8 h-px bg-soft" />

        {/* Bill to + meta */}
        <div className="grid sm:grid-cols-2 gap-6">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-mute font-mono mb-2">Bill to</div>
            {customer ? (
              <div>
                <div className="font-display font-semibold text-lg tracking-tightest">{customer.name}</div>
                {customer.contactPerson && (
                  <div className="text-sm text-ash mt-0.5">Attn: {customer.contactPerson}</div>
                )}
                {customer.address && (
                  <div className="text-sm text-ash mt-1 whitespace-pre-line leading-relaxed">
                    {customer.address}
                  </div>
                )}
                {customer.email && <div className="text-sm text-ash mt-1">{customer.email}</div>}
                {customer.phone && <div className="text-sm text-ash">{customer.phone}</div>}
                {customer.taxId && (
                  <div className="text-xs text-mute mt-1">Tax ID: {customer.taxId}</div>
                )}
              </div>
            ) : (
              <div className="text-ash">— customer removed —</div>
            )}
          </div>

          <div className="sm:text-right">
            <div className="grid grid-cols-2 sm:grid-cols-1 gap-3 text-sm">
              <MetaRow label="Issue date" value={fmtDate(inv.issueDate)} />
              <MetaRow label="Due date" value={fmtDate(inv.dueDate)} />
              <MetaRow label="Status" value={statusMeta(inv.status).label} />
            </div>
          </div>
        </div>

        {/* Items table */}
        <div className="mt-10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-ink/20 text-left">
                <th className="py-2.5 pr-2 text-xs uppercase tracking-wider font-mono text-mute">Description</th>
                <th className="py-2.5 px-2 text-xs uppercase tracking-wider font-mono text-mute text-right w-20">Qty</th>
                <th className="py-2.5 px-2 text-xs uppercase tracking-wider font-mono text-mute text-right w-28">Rate</th>
                <th className="py-2.5 pl-2 text-xs uppercase tracking-wider font-mono text-mute text-right w-32">Amount</th>
              </tr>
            </thead>
            <tbody>
              {inv.items.map((it) => {
                const amt = (Number(it.quantity) || 0) * (Number(it.rate) || 0)
                return (
                  <tr key={it.id} className="border-b hairline">
                    <td className="py-3 pr-2">{it.description || <span className="text-mute italic">No description</span>}</td>
                    <td className="py-3 px-2 text-right tabular-nums">{Number(it.quantity) || 0}</td>
                    <td className="py-3 px-2 text-right tabular-nums">
                      {fmtMoney(it.rate, settings.currency)}
                    </td>
                    <td className="py-3 pl-2 text-right tabular-nums font-medium">
                      {fmtMoney(amt, settings.currency)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="mt-6 flex justify-end">
          <div className="w-full sm:w-72 space-y-2 text-sm">
            <SummaryRow label="Subtotal" value={fmtMoney(totals.subtotal, settings.currency)} />
            <SummaryRow
              label={`Tax (${inv.taxRate || 0}%)`}
              value={fmtMoney(totals.taxAmount, settings.currency)}
            />
            {totals.discount > 0 && (
              <SummaryRow
                label="Discount"
                value={`− ${fmtMoney(totals.discount, settings.currency)}`}
              />
            )}
            <div className="pt-3 border-t-2 border-ink/20 flex items-center justify-between">
              <span className="font-display font-semibold text-base">Total</span>
              <span className="font-display font-bold text-2xl tracking-tightest text-brandBlue tabular-nums">
                {fmtMoney(totals.total, settings.currency)}
              </span>
            </div>
          </div>
        </div>

        {/* Notes / terms */}
        {(inv.notes || settings.paymentTerms) && (
          <div className="mt-12 pt-6 border-t hairline">
            {inv.notes && (
              <div className="mb-4">
                <div className="text-[10px] uppercase tracking-[0.2em] text-mute font-mono mb-1.5">Notes</div>
                <p className="text-sm text-ash leading-relaxed whitespace-pre-line">{inv.notes}</p>
              </div>
            )}
            {settings.paymentTerms && (
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-mute font-mono mb-1.5">Payment terms</div>
                <p className="text-sm text-ash leading-relaxed">{settings.paymentTerms}</p>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 pt-6 border-t hairline text-center">
          <p className="text-xs text-mute">Thank you for your business.</p>
        </div>
      </article>
    </div>
  )
}

function MetaRow({ label, value }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.2em] text-mute font-mono">{label}</div>
      <div className="font-medium mt-0.5">{value}</div>
    </div>
  )
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ash">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}
