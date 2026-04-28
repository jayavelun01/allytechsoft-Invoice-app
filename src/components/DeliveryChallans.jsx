import { useState } from 'react'
import { fmtDate, statusMeta } from '../utils'
import { PageHeader, Empty, StatusPill } from './ui'

export default function DeliveryChallans({ data, ops, onNav, onOpen }) {
  const [query, setQuery] = useState('')

  const list = data.deliveryChallans
    .filter((dc) => {
      if (!query) return true
      const cust = data.customers.find((c) => c.id === dc.customerId)
      return `${dc.number} ${cust?.name || ''} ${dc.vehicleNumber || ''}`.toLowerCase().includes(query.toLowerCase())
    })
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))

  const remove = async (id) => {
    if (!confirm('Delete this DC?')) return
    try { await ops.deleteDeliveryChallan(id) } catch (e) { alert('Could not delete: ' + e.message) }
  }

  return (
    <div>
      <PageHeader
        title="Delivery Challans"
        subtitle={`${data.deliveryChallans.length} on file`}
        actions={<>
          <input type="search" placeholder="Search…" value={query} onChange={(e) => setQuery(e.target.value)} className="input-base w-full sm:w-64" />
          <button onClick={() => onNav('dc-new')} className="btn-gradient">+ New DC</button>
        </>}
      />

      {data.deliveryChallans.length === 0 ? (
        <Empty title="No delivery challans yet"
          hint="Track shipments with vehicle and LR details before invoicing."
          action={<button onClick={() => onNav('dc-new')} className="btn-primary">Create DC</button>} />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-mist/50">
                <tr className="text-left text-xs uppercase tracking-wider text-mute">
                  <th className="px-6 py-3 font-medium">DC #</th>
                  <th className="px-6 py-3 font-medium">DC Date</th>
                  <th className="px-6 py-3 font-medium">Customer</th>
                  <th className="px-6 py-3 font-medium">Vehicle</th>
                  <th className="px-6 py-3 font-medium">LR #</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((dc) => {
                  const cust = data.customers.find((c) => c.id === dc.customerId)
                  return (
                    <tr key={dc.id} className="border-t hairline hover:bg-mist/30 transition-colors">
                      <td onClick={() => onOpen(dc.id)} className="px-6 py-3.5 font-mono text-[13px] text-brandBlue cursor-pointer">{dc.number}</td>
                      <td className="px-6 py-3.5 text-ash">{fmtDate(dc.dcDate)}</td>
                      <td className="px-6 py-3.5">{cust?.name || '— deleted —'}</td>
                      <td className="px-6 py-3.5 font-mono text-[13px]">{dc.vehicleNumber || '—'}</td>
                      <td className="px-6 py-3.5 font-mono text-[13px]">{dc.lrNumber || '—'}</td>
                      <td className="px-6 py-3.5"><StatusPill status={dc.status} statusMeta={statusMeta} /></td>
                      <td className="px-6 py-3.5 text-right whitespace-nowrap">
                        <button onClick={() => onNav('dc-edit', dc.id)} className="text-brandBlue text-sm hover:underline mr-3">Edit</button>
                        <button onClick={() => remove(dc.id)} className="text-danger text-sm hover:underline">Delete</button>
                      </td>
                    </tr>
                  )
                })}
                {list.length === 0 && <tr><td colSpan="7" className="px-6 py-10 text-center text-mute text-sm">No DCs match.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
