import { useState } from 'react'
import { fmtMoney, fmtDate, statusMeta } from '../utils'
import { PageHeader, Empty, StatusPill } from './ui'

export default function PurchaseOrders({ data, ops, onNav, onOpen }) {
  const [query, setQuery] = useState('')

  const list = data.purchaseOrders
    .filter((po) => {
      if (!query) return true
      const cust = data.customers.find((c) => c.id === po.customerId)
      return `${po.number} ${cust?.name || ''}`.toLowerCase().includes(query.toLowerCase())
    })
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))

  const totalOf = (po) =>
    (po.items || []).reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.rate) || 0), 0)

  const remove = async (id) => {
    if (!confirm('Delete this PO? Linked invoices keep their data.')) return
    try { await ops.deletePurchaseOrder(id) } catch (e) { alert('Could not delete: ' + e.message) }
  }

  return (
    <div>
      <PageHeader
        title="Purchase Orders"
        subtitle={`${data.purchaseOrders.length} on file`}
        actions={<>
          <input type="search" placeholder="Search…" value={query} onChange={(e) => setQuery(e.target.value)} className="input-base w-full sm:w-64" />
          <button onClick={() => onNav('po-new')} className="btn-gradient">+ New PO</button>
        </>}
      />

      {data.purchaseOrders.length === 0 ? (
        <Empty
          title="No purchase orders yet"
          hint="Add a PO to track customer orders before raising an invoice."
          action={<button onClick={() => onNav('po-new')} className="btn-primary">Create PO</button>}
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-mist/50">
                <tr className="text-left text-xs uppercase tracking-wider text-mute">
                  <th className="px-6 py-3 font-medium">PO #</th>
                  <th className="px-6 py-3 font-medium">Date</th>
                  <th className="px-6 py-3 font-medium">Customer</th>
                  <th className="px-6 py-3 font-medium">Items</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium text-right">Value</th>
                  <th className="px-6 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((po) => {
                  const cust = data.customers.find((c) => c.id === po.customerId)
                  return (
                    <tr key={po.id} className="border-t hairline hover:bg-mist/30 transition-colors">
                      <td onClick={() => onOpen(po.id)} className="px-6 py-3.5 font-mono text-[13px] text-brandBlue cursor-pointer">{po.number}</td>
                      <td className="px-6 py-3.5 text-ash">{fmtDate(po.poDate)}</td>
                      <td className="px-6 py-3.5">{cust?.name || '— deleted —'}</td>
                      <td className="px-6 py-3.5 text-ash">{(po.items || []).length}</td>
                      <td className="px-6 py-3.5"><StatusPill status={po.status} statusMeta={statusMeta} /></td>
                      <td className="px-6 py-3.5 text-right font-medium">{fmtMoney(totalOf(po), data.settings.currency)}</td>
                      <td className="px-6 py-3.5 text-right whitespace-nowrap">
                        <button onClick={() => onNav('po-edit', po.id)} className="text-brandBlue text-sm hover:underline mr-3">Edit</button>
                        <button onClick={() => remove(po.id)} className="text-danger text-sm hover:underline">Delete</button>
                      </td>
                    </tr>
                  )
                })}
                {list.length === 0 && <tr><td colSpan="7" className="px-6 py-10 text-center text-mute text-sm">No POs match.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
