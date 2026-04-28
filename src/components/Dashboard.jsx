import { fmtMoney, fmtDate, calcInvoice, statusMeta } from '../utils'
import { PageHeader, StatusPill, Empty } from './ui'

export default function Dashboard({ data, onNav, onOpenInvoice }) {
  const { invoices, customers, products, branches, settings } = data
  const currency = settings.currency

  const totals = invoices.reduce(
    (acc, inv) => {
      const t = calcInvoice(inv).total
      acc.all += t
      if (inv.status === 'paid') acc.paid += t
      else if (inv.status === 'sent') acc.sent += t
      else if (inv.status === 'overdue') acc.overdue += t
      return acc
    },
    { all: 0, paid: 0, sent: 0, overdue: 0 },
  )

  const recent = [...invoices]
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    .slice(0, 5)

  const stats = [
    { label: 'Total billed', value: fmtMoney(totals.all, currency), tone: 'ink' },
    { label: 'Paid', value: fmtMoney(totals.paid, currency), tone: 'green' },
    { label: 'Outstanding', value: fmtMoney(totals.sent, currency), tone: 'blue' },
    { label: 'Overdue', value: fmtMoney(totals.overdue, currency), tone: 'red' },
  ]

  const toneToCls = {
    ink: 'text-ink',
    green: 'text-brandGreenDark',
    blue: 'text-brandBlue',
    red: 'text-danger',
  }

  // Setup checklist for new users
  const setupItems = [
    { done: branches.length > 0, label: 'Add at least one branch', action: () => onNav('branches') },
    { done: products.length > 0, label: 'Add products to catalog', action: () => onNav('products') },
    { done: customers.length > 0, label: 'Add a customer', action: () => onNav('customers') },
    { done: invoices.length > 0, label: 'Issue your first invoice', action: () => onNav('invoice-new') },
  ]
  const setupComplete = setupItems.every((i) => i.done)

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={`${invoices.length} invoices · ${customers.length} customers · ${products.length} products`}
        actions={
          <button onClick={() => onNav('invoice-new')} className="btn-gradient" disabled={branches.length === 0 || customers.length === 0}>
            + New invoice
          </button>
        }
      />

      {/* Setup checklist */}
      {!setupComplete && (
        <div className="card p-5 mb-6 bg-gradient-to-br from-brandBlue/5 via-transparent to-brandGreen/5">
          <h2 className="font-display font-semibold text-lg tracking-tightest mb-3">
            Get started
          </h2>
          <ul className="space-y-2">
            {setupItems.map((it, i) => (
              <li key={i} className="flex items-center gap-3">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${it.done ? 'bg-brandGreen text-white' : 'border border-soft text-mute'}`}>
                  {it.done ? '✓' : i + 1}
                </span>
                <button onClick={it.action} disabled={it.done} className={`text-sm ${it.done ? 'text-mute line-through' : 'text-ink hover:text-brandBlue'}`}>
                  {it.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((s) => (
          <div key={s.label} className="card p-5">
            <div className="text-xs uppercase tracking-[0.15em] text-mute font-mono">{s.label}</div>
            <div className={`mt-2 font-display font-bold text-2xl md:text-3xl tracking-tightest ${toneToCls[s.tone]}`}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* Quick links to documents */}
      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <QuickCard label="Purchase Orders" count={data.purchaseOrders.length} onClick={() => onNav('purchase-orders')} />
        <QuickCard label="Delivery Challans" count={data.deliveryChallans.length} onClick={() => onNav('delivery-challans')} />
        <QuickCard label="GST collected" hint="View detailed dashboard →" onClick={() => onNav('gst')} />
      </div>

      {/* Recent invoices */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b hairline flex items-center justify-between">
          <h2 className="font-display font-semibold text-lg tracking-tightest">Recent invoices</h2>
          <button onClick={() => onNav('invoices')} className="text-sm text-brandBlue hover:underline">View all →</button>
        </div>

        {recent.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm text-ash mb-4">No invoices yet.</p>
            {branches.length === 0 || customers.length === 0 ? (
              <p className="text-xs text-mute">Add at least one branch and one customer first.</p>
            ) : (
              <button onClick={() => onNav('invoice-new')} className="btn-primary">Create your first invoice</button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-mist/50">
                <tr className="text-left text-xs uppercase tracking-wider text-mute">
                  <th className="px-6 py-3 font-medium">Number</th>
                  <th className="px-6 py-3 font-medium">Customer</th>
                  <th className="px-6 py-3 font-medium">Issued</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((inv) => {
                  const cust = customers.find((c) => c.id === inv.customerId)
                  const t = calcInvoice(inv).total
                  return (
                    <tr key={inv.id} onClick={() => onOpenInvoice(inv.id)}
                        className="border-t hairline hover:bg-mist/40 cursor-pointer transition-colors">
                      <td className="px-6 py-3.5 font-mono text-[13px]">{inv.number}</td>
                      <td className="px-6 py-3.5">{cust?.name || '—'}</td>
                      <td className="px-6 py-3.5 text-ash">{fmtDate(inv.issueDate)}</td>
                      <td className="px-6 py-3.5"><StatusPill status={inv.status} statusMeta={statusMeta} /></td>
                      <td className="px-6 py-3.5 text-right font-medium">{fmtMoney(t, currency)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function QuickCard({ label, count, hint, onClick }) {
  return (
    <button onClick={onClick} className="card p-5 text-left hover:bg-ice/40 transition-colors">
      <div className="text-xs uppercase tracking-[0.15em] text-mute font-mono">{label}</div>
      {count !== undefined ? (
        <div className="mt-2 font-display font-bold text-2xl tracking-tightest text-ink">{count}</div>
      ) : (
        <div className="mt-2 text-sm text-brandBlue">{hint}</div>
      )}
    </button>
  )
}
