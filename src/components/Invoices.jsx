import { useState } from 'react'
import { fmtMoney, fmtDate, calcInvoice, statusMeta } from '../utils'
import { PageHeader, Empty } from './ui'

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'draft', label: 'Drafts' },
  { id: 'sent', label: 'Sent' },
  { id: 'paid', label: 'Paid' },
  { id: 'overdue', label: 'Overdue' },
]

export default function Invoices({ data, ops, onNav, onOpenInvoice }) {
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const { invoices, customers, settings } = data

  const list = invoices
    .filter((inv) => (filter === 'all' ? true : inv.status === filter))
    .filter((inv) => {
      if (!query) return true
      const cust = customers.find((c) => c.id === inv.customerId)
      const hay = `${inv.number} ${cust?.name || ''}`.toLowerCase()
      return hay.includes(query.toLowerCase())
    })
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))

  const onChangeStatus = async (id, status) => {
    try {
      await ops.updateInvoiceStatus(id, status)
    } catch (e) {
      alert('Could not update status: ' + e.message)
    }
  }

  const remove = async (id) => {
    if (!confirm('Permanently delete this invoice?')) return
    try {
      await ops.deleteInvoice(id)
    } catch (e) {
      alert('Could not delete invoice: ' + e.message)
    }
  }

  return (
    <div>
      <PageHeader
        title="Invoices"
        subtitle={`${invoices.length} total`}
        actions={
          <button onClick={() => onNav('invoice-new')} className="btn-gradient">
            + New invoice
          </button>
        }
      />

      <div className="flex items-center gap-3 flex-wrap mb-5">
        <div className="flex items-center gap-1 p-1 bg-white border hairline rounded-lg">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                filter === f.id ? 'bg-ink text-white' : 'text-ash hover:text-ink'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <input
          type="search"
          placeholder="Search invoice # or customer…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="input-base flex-1 min-w-[200px] max-w-sm"
        />
      </div>

      {invoices.length === 0 ? (
        <Empty
          title="No invoices yet"
          hint="Create your first invoice to start billing customers."
          action={
            <button onClick={() => onNav('invoice-new')} className="btn-primary">
              Create invoice
            </button>
          }
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-mist/50">
                <tr className="text-left text-xs uppercase tracking-wider text-mute">
                  <th className="px-6 py-3 font-medium">Number</th>
                  <th className="px-6 py-3 font-medium">Customer</th>
                  <th className="px-6 py-3 font-medium">Issued</th>
                  <th className="px-6 py-3 font-medium">Due</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium text-right">Total</th>
                  <th className="px-6 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((inv) => {
                  const cust = customers.find((c) => c.id === inv.customerId)
                  const total = calcInvoice(inv).total
                  return (
                    <tr key={inv.id} className="border-t hairline hover:bg-mist/30 transition-colors">
                      <td
                        onClick={() => onOpenInvoice(inv.id)}
                        className="px-6 py-3.5 font-mono text-[13px] cursor-pointer text-brandBlue"
                      >
                        {inv.number}
                      </td>
                      <td className="px-6 py-3.5">{cust?.name || '— deleted —'}</td>
                      <td className="px-6 py-3.5 text-ash">{fmtDate(inv.issueDate)}</td>
                      <td className="px-6 py-3.5 text-ash">{fmtDate(inv.dueDate)}</td>
                      <td className="px-6 py-3.5">
                        <select
                          value={inv.status}
                          onChange={(e) => onChangeStatus(inv.id, e.target.value)}
                          className="text-xs border border-soft rounded-full px-2 py-1 bg-white focus:outline-none focus:border-brandBlue"
                        >
                          <option value="draft">Draft</option>
                          <option value="sent">Sent</option>
                          <option value="paid">Paid</option>
                          <option value="overdue">Overdue</option>
                        </select>
                      </td>
                      <td className="px-6 py-3.5 text-right font-medium">
                        {fmtMoney(total, settings.currency)}
                      </td>
                      <td className="px-6 py-3.5 text-right whitespace-nowrap">
                        <button
                          onClick={() => onOpenInvoice(inv.id)}
                          className="text-brandBlue text-sm hover:underline mr-3"
                        >
                          Open
                        </button>
                        <button
                          onClick={() => onNav('invoice-edit', inv.id)}
                          className="text-ash text-sm hover:underline mr-3"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => remove(inv.id)}
                          className="text-danger text-sm hover:underline"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {list.length === 0 && (
                  <tr>
                    <td colSpan="7" className="px-6 py-10 text-center text-mute text-sm">
                      No invoices match these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
