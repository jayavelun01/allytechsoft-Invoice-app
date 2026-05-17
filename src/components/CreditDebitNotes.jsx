import { useState } from 'react'
import { PageHeader, Empty } from './ui'
import { fmtMoney, fmtDate, calcInvoice, statusMeta } from '../utils'

export default function CreditDebitNotes({ data, ops, onNav, onOpen }) {
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')

  const filtered = (data.creditDebitNotes || []).filter((n) => {
    const customer = data.customers.find((c) => c.id === n.customerId)
    const origInv = data.invoices.find((i) => i.id === n.originalInvoiceId)
    const text = [n.number, n.originalInvoiceNumber, origInv?.number, customer?.name]
      .filter(Boolean).join(' ').toLowerCase()
    const matchesQuery = !query || text.includes(query.toLowerCase())
    const matchesType = typeFilter === 'all' || n.noteType === typeFilter
    return matchesQuery && matchesType
  })

  const del = async (id) => {
    if (!confirm('Delete this note? This cannot be undone.')) return
    try { await ops.deleteCreditDebitNote(id) } catch (e) { alert('Could not delete: ' + e.message) }
  }

  return (
    <div>
      <PageHeader
        title="Credit & Debit Notes"
        subtitle={`${(data.creditDebitNotes || []).length} ${(data.creditDebitNotes || []).length === 1 ? 'note' : 'notes'}`}
        actions={<>
          <input type="search" placeholder="Search…" value={query}
            onChange={(e) => setQuery(e.target.value)} className="input-base w-full sm:w-56" />
          <button onClick={() => onNav('cdn-new-credit')} className="btn-outline">+ Credit Note</button>
          <button onClick={() => onNav('cdn-new-debit')} className="btn-primary">+ Debit Note</button>
        </>}
      />

      <div className="flex items-center gap-1 p-1 bg-white border hairline rounded-lg w-fit mb-6">
        {[['all', 'All'], ['credit', 'Credit Notes'], ['debit', 'Debit Notes']].map(([id, label]) => (
          <button key={id} onClick={() => setTypeFilter(id)}
            className={`px-3 py-1.5 rounded-md text-sm transition-colors ${typeFilter === id ? 'bg-ink text-white' : 'text-ash hover:text-ink'}`}>
            {label}
          </button>
        ))}
      </div>

      {(data.creditDebitNotes || []).length === 0 ? (
        <Empty
          title="No credit or debit notes yet"
          hint="Issue credit notes for returns or overcharging corrections. Issue debit notes for undercharging or additional charges."
          action={<button onClick={() => onNav('cdn-new-credit')} className="btn-primary">Create first note</button>}
        />
      ) : filtered.length === 0 ? (
        <div className="card p-10 text-center text-mute text-sm">No notes match your filters.</div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-mist/50">
                <tr className="text-left text-xs uppercase tracking-wider text-mute">
                  <th className="px-5 py-3 font-medium">Type</th>
                  <th className="px-5 py-3 font-medium">Number</th>
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Customer</th>
                  <th className="px-5 py-3 font-medium">Orig. Invoice</th>
                  <th className="px-5 py-3 font-medium text-right">Amount</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((n) => {
                  const customer = data.customers.find((c) => c.id === n.customerId)
                  const origInv = data.invoices.find((i) => i.id === n.originalInvoiceId)
                  const origRef = n.originalInvoiceNumber || origInv?.number || '—'
                  const totals = calcInvoice(n)
                  const sm = statusMeta(n.status)
                  return (
                    <tr
                      key={n.id}
                      className="border-t hairline hover:bg-mist/30 transition-colors cursor-pointer"
                      onClick={() => onOpen(n.id)}
                    >
                      <td className="px-5 py-3">
                        <span className={`badge text-xs ${n.noteType === 'credit' ? 'bg-success/10 text-brandGreenDark' : 'bg-warn/10 text-warn'}`}>
                          {n.noteType === 'credit' ? 'Credit' : 'Debit'}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-mono font-semibold">{n.number || '—'}</td>
                      <td className="px-5 py-3 text-ash">{fmtDate(n.noteDate)}</td>
                      <td className="px-5 py-3 font-medium">{customer?.name || '—'}</td>
                      <td className="px-5 py-3 font-mono text-ash text-xs">{origRef}</td>
                      <td className="px-5 py-3 text-right tabular-nums font-semibold">
                        {fmtMoney(totals.total, data.settings.currency)}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`badge ${sm.cls}`}>{sm.label}</span>
                      </td>
                      <td className="px-5 py-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => onNav('cdn-edit', n.id)} className="text-brandBlue text-sm hover:underline mr-3">Edit</button>
                        <button onClick={() => del(n.id)} className="text-danger text-sm hover:underline">Delete</button>
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
