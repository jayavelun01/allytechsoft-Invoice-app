import { useState } from 'react'
import { PageHeader, Empty } from './ui'
import { fmtMoney, fmtDate, calcInvoice, statusMeta } from '../utils'

export default function ExpenseBills({ data, ops, onNav, onOpen }) {
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const bills = data.expenseBills || []

  const filtered = bills.filter((b) => {
    const text = [b.billNumber, b.vendorName, b.vendorGstin].filter(Boolean).join(' ').toLowerCase()
    const matchesQuery = !query || text.includes(query.toLowerCase())
    const matchesStatus = statusFilter === 'all' || b.status === statusFilter
    return matchesQuery && matchesStatus
  })

  const totalITC = bills
    .filter((b) => b.status !== 'cancelled')
    .reduce((sum, b) => sum + calcInvoice(b).totalTax, 0)

  const del = async (id) => {
    if (!confirm('Delete this expense bill? This cannot be undone.')) return
    try { await ops.deleteExpenseBill(id) } catch (e) { alert('Could not delete: ' + e.message) }
  }

  const quickStatus = async (e, id, status) => {
    e.stopPropagation()
    try { await ops.updateExpenseBillStatus(id, status) } catch (e) { alert('Could not update: ' + e.message) }
  }

  return (
    <div>
      <PageHeader
        title="Expense Bills"
        subtitle={`${bills.length} ${bills.length === 1 ? 'bill' : 'bills'} · ITC available: ${fmtMoney(totalITC, data.settings.currency)}`}
        actions={<>
          <input type="search" placeholder="Search…" value={query}
            onChange={(e) => setQuery(e.target.value)} className="input-base w-full sm:w-56" />
          <button onClick={() => onNav('eb-new')} className="btn-primary">+ New Expense Bill</button>
        </>}
      />

      <div className="flex items-center gap-1 p-1 bg-white border hairline rounded-lg w-fit mb-6">
        {[['all', 'All'], ['draft', 'Draft'], ['received', 'Received'], ['paid', 'Paid'], ['cancelled', 'Cancelled']].map(([id, label]) => (
          <button key={id} onClick={() => setStatusFilter(id)}
            className={`px-3 py-1.5 rounded-md text-sm transition-colors ${statusFilter === id ? 'bg-ink text-white' : 'text-ash hover:text-ink'}`}>
            {label}
          </button>
        ))}
      </div>

      {bills.length === 0 ? (
        <Empty
          title="No expense bills yet"
          hint="Record vendor bills and supplier invoices to track your Input Tax Credit (ITC) available for GST offset."
          action={<button onClick={() => onNav('eb-new')} className="btn-primary">Add first expense bill</button>}
        />
      ) : filtered.length === 0 ? (
        <div className="card p-10 text-center text-mute text-sm">No bills match your filters.</div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-mist/50">
                <tr className="text-left text-xs uppercase tracking-wider text-mute">
                  <th className="px-5 py-3 font-medium">Bill #</th>
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Vendor</th>
                  <th className="px-5 py-3 font-medium">Branch</th>
                  <th className="px-5 py-3 font-medium text-right">Amount</th>
                  <th className="px-5 py-3 font-medium text-right">ITC</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => {
                  const branch = data.branches.find((br) => br.id === b.branchId)
                  const totals = calcInvoice(b)
                  const sm = statusMeta(b.status)
                  return (
                    <tr
                      key={b.id}
                      className="border-t hairline hover:bg-mist/30 transition-colors cursor-pointer"
                      onClick={() => onOpen(b.id)}
                    >
                      <td className="px-5 py-3 font-mono font-semibold">{b.billNumber || '—'}</td>
                      <td className="px-5 py-3 text-ash">{fmtDate(b.billDate)}</td>
                      <td className="px-5 py-3">
                        <div className="font-medium">{b.vendorName || '—'}</div>
                        {b.vendorGstin && <div className="text-xs font-mono text-mute mt-0.5">{b.vendorGstin}</div>}
                      </td>
                      <td className="px-5 py-3 text-ash">{branch?.name || '—'}</td>
                      <td className="px-5 py-3 text-right tabular-nums font-semibold">
                        {fmtMoney(totals.total, data.settings.currency)}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums text-brandGreenDark font-medium">
                        {fmtMoney(totals.totalTax, data.settings.currency)}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`badge ${sm.cls}`}>{sm.label}</span>
                      </td>
                      <td className="px-5 py-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        {b.status === 'draft' && (
                          <button onClick={(e) => quickStatus(e, b.id, 'received')} className="text-brandBlue text-xs hover:underline mr-2">Mark received</button>
                        )}
                        {b.status === 'received' && (
                          <button onClick={(e) => quickStatus(e, b.id, 'paid')} className="text-brandBlue text-xs hover:underline mr-2">Mark paid</button>
                        )}
                        <button onClick={(e) => { e.stopPropagation(); onNav('eb-edit', b.id) }} className="text-brandBlue text-sm hover:underline mr-3">Edit</button>
                        <button onClick={(e) => { e.stopPropagation(); del(b.id) }} className="text-danger text-sm hover:underline">Delete</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
