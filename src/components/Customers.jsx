import { useState } from 'react'
import { fmtDate } from '../utils'
import { Modal, PageHeader, Empty } from './ui'
import { INDIAN_STATES } from '../constants'

export default function Customers({ data, ops }) {
  const [editing, setEditing] = useState(null)
  const [branchesFor, setBranchesFor] = useState(null) // a customer object
  const [query, setQuery] = useState('')
  const [saving, setSaving] = useState(false)

  const filtered = data.customers.filter((c) =>
    [c.name, c.email, c.phone, c.contactPerson, c.gstin]
      .filter(Boolean).join(' ').toLowerCase().includes(query.toLowerCase()),
  )

  const startNew = () => setEditing({
    id: null, name: '', contactPerson: '', email: '', phone: '',
    address: '', taxId: '', gstin: '',
  })

  const save = async () => {
    if (!editing.name.trim()) { alert('Customer name is required.'); return }
    setSaving(true)
    try { await ops.saveCustomer(editing); setEditing(null) }
    catch (e) { alert('Could not save: ' + e.message) }
    finally { setSaving(false) }
  }

  const remove = async (id) => {
    if (!confirm('Delete this customer? Their branches and links from invoices will also be removed.')) return
    try { await ops.deleteCustomer(id) } catch (e) { alert('Could not delete: ' + e.message) }
  }

  const branchCountFor = (cid) => data.customerBranches.filter((b) => b.customerId === cid).length

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle={`${data.customers.length} ${data.customers.length === 1 ? 'customer' : 'customers'}`}
        actions={<>
          <input type="search" placeholder="Search…" value={query} onChange={(e) => setQuery(e.target.value)} className="input-base w-full sm:w-64" />
          <button onClick={startNew} className="btn-primary">+ Add customer</button>
        </>}
      />

      {data.customers.length === 0 ? (
        <Empty
          title="No customers yet"
          hint="Add your first customer to start invoicing."
          action={<button onClick={startNew} className="btn-primary">Add customer</button>}
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-mist/50">
                <tr className="text-left text-xs uppercase tracking-wider text-mute">
                  <th className="px-6 py-3 font-medium">Customer</th>
                  <th className="px-6 py-3 font-medium">GSTIN</th>
                  <th className="px-6 py-3 font-medium">Contact</th>
                  <th className="px-6 py-3 font-medium">Branches</th>
                  <th className="px-6 py-3 font-medium">Added</th>
                  <th className="px-6 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-t hairline hover:bg-mist/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium">{c.name}</div>
                      {c.email && <div className="text-xs text-mute mt-0.5">{c.email}</div>}
                    </td>
                    <td className="px-6 py-4 font-mono text-[13px] text-ash">{c.gstin || '—'}</td>
                    <td className="px-6 py-4 text-ash">
                      <div>{c.contactPerson || '—'}</div>
                      {c.phone && <div className="text-xs">{c.phone}</div>}
                    </td>
                    <td className="px-6 py-4">
                      <button onClick={() => setBranchesFor(c)} className="text-brandBlue text-sm hover:underline">
                        {branchCountFor(c.id)} {branchCountFor(c.id) === 1 ? 'branch' : 'branches'} →
                      </button>
                    </td>
                    <td className="px-6 py-4 text-ash text-xs">{fmtDate(c.createdAt)}</td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <button onClick={() => setEditing({ ...c })} className="text-brandBlue text-sm hover:underline mr-3">Edit</button>
                      <button onClick={() => remove(c.id)} className="text-danger text-sm hover:underline">Delete</button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan="6" className="px-6 py-10 text-center text-mute text-sm">No customers match “{query}”.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Customer edit modal */}
      <Modal
        open={!!editing}
        onClose={() => !saving && setEditing(null)}
        title={editing?.id ? 'Edit customer' : 'New customer'}
        footer={<>
          <button className="btn-ghost" onClick={() => setEditing(null)} disabled={saving}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : editing?.id ? 'Save changes' : 'Add customer'}
          </button>
        </>}
      >
        {editing && (
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Customer / company name *">
                <input className="input-base" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} autoFocus />
              </Field>
              <Field label="GSTIN">
                <input className="input-base font-mono uppercase" value={editing.gstin}
                  onChange={(e) => setEditing({ ...editing, gstin: e.target.value.toUpperCase() })} placeholder="33AAAAA0000A1Z5" />
              </Field>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Contact person">
                <input className="input-base" value={editing.contactPerson}
                  onChange={(e) => setEditing({ ...editing, contactPerson: e.target.value })} />
              </Field>
              <Field label="PAN / other tax ID">
                <input className="input-base" value={editing.taxId}
                  onChange={(e) => setEditing({ ...editing, taxId: e.target.value })} />
              </Field>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Email"><input type="email" className="input-base" value={editing.email}
                onChange={(e) => setEditing({ ...editing, email: e.target.value })} /></Field>
              <Field label="Phone"><input className="input-base" value={editing.phone}
                onChange={(e) => setEditing({ ...editing, phone: e.target.value })} /></Field>
            </div>
            <Field label="Primary address (used if no branch is selected)">
              <textarea rows={2} className="input-base resize-none" value={editing.address}
                onChange={(e) => setEditing({ ...editing, address: e.target.value })} />
            </Field>
            <div className="text-xs text-mute pt-1">
              💡 After saving, click "branches" on the customer row to add multiple billing locations.
            </div>
          </div>
        )}
      </Modal>

      {/* Branches manager modal */}
      {branchesFor && (
        <BranchesManager
          customer={branchesFor}
          data={data}
          ops={ops}
          onClose={() => setBranchesFor(null)}
        />
      )}
    </div>
  )
}

function BranchesManager({ customer, data, ops, onClose }) {
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const branches = data.customerBranches.filter((b) => b.customerId === customer.id)

  const startNew = () => setEditing({
    id: null, customerId: customer.id, name: '', address: '',
    state: '', stateCode: '', gstin: customer.gstin || '',
    contactPerson: '', email: '', phone: '',
    isDefault: branches.length === 0,
  })

  const save = async () => {
    if (!editing.name.trim()) { alert('Branch name is required.'); return }
    setSaving(true)
    try { await ops.saveCustomerBranch(editing); setEditing(null) }
    catch (e) { alert('Could not save: ' + e.message) }
    finally { setSaving(false) }
  }

  const remove = async (id) => {
    if (!confirm('Delete this branch?')) return
    try { await ops.deleteCustomerBranch(id) } catch (e) { alert('Could not delete: ' + e.message) }
  }

  const setStateByName = (name) => {
    const found = INDIAN_STATES.find((s) => s.name === name)
    setEditing({ ...editing, state: name, stateCode: found?.code || '' })
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`${customer.name} — branches`}
      wide
      footer={
        <button onClick={onClose} className="btn-primary">Done</button>
      }
    >
      <div className="space-y-4">
        {branches.length === 0 ? (
          <div className="text-center py-6 text-sm text-mute">
            No branches yet for this customer.
          </div>
        ) : (
          <div className="space-y-2">
            {branches.map((b) => (
              <div key={b.id} className="border hairline rounded-lg p-3 flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <div className="font-medium">{b.name}</div>
                    {b.isDefault && (
                      <span className="text-[10px] uppercase tracking-wider text-brandGreenDark bg-success/10 px-2 py-0.5 rounded-full">
                        Default
                      </span>
                    )}
                  </div>
                  {b.gstin && <div className="font-mono text-xs text-mute mt-0.5">{b.gstin}</div>}
                  {b.state && <div className="text-xs text-ash mt-0.5">{b.state}</div>}
                  {b.address && <div className="text-xs text-ash mt-0.5 whitespace-pre-line">{b.address}</div>}
                </div>
                <div className="flex gap-2 text-sm">
                  <button onClick={() => setEditing({ ...b })} className="text-brandBlue hover:underline">Edit</button>
                  <button onClick={() => remove(b.id)} className="text-danger hover:underline">Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {!editing && (
          <button onClick={startNew} className="btn-outline w-full">+ Add branch</button>
        )}

        {editing && (
          <div className="border-t hairline pt-4 space-y-3">
            <div className="text-xs font-mono uppercase tracking-wider text-mute">
              {editing.id ? 'Edit branch' : 'New branch'}
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Branch name *">
                <input className="input-base" value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  placeholder="e.g. Chennai HQ" autoFocus />
              </Field>
              <Field label="GSTIN">
                <input className="input-base font-mono uppercase" value={editing.gstin}
                  onChange={(e) => setEditing({ ...editing, gstin: e.target.value.toUpperCase() })} />
              </Field>
            </div>
            <Field label="Address">
              <textarea rows={2} className="input-base resize-none" value={editing.address}
                onChange={(e) => setEditing({ ...editing, address: e.target.value })} />
            </Field>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="State">
                <select className="input-base" value={editing.state} onChange={(e) => setStateByName(e.target.value)}>
                  <option value="">— select —</option>
                  {INDIAN_STATES.map((s) => <option key={s.code} value={s.name}>{s.name} ({s.code})</option>)}
                </select>
              </Field>
              <Field label="Contact person">
                <input className="input-base" value={editing.contactPerson}
                  onChange={(e) => setEditing({ ...editing, contactPerson: e.target.value })} />
              </Field>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Email">
                <input type="email" className="input-base" value={editing.email}
                  onChange={(e) => setEditing({ ...editing, email: e.target.value })} />
              </Field>
              <Field label="Phone">
                <input className="input-base" value={editing.phone}
                  onChange={(e) => setEditing({ ...editing, phone: e.target.value })} />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm text-ash">
              <input type="checkbox" checked={editing.isDefault}
                onChange={(e) => setEditing({ ...editing, isDefault: e.target.checked })} />
              Use as default for invoices to this customer
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <button className="btn-ghost" onClick={() => setEditing(null)} disabled={saving}>Cancel</button>
              <button className="btn-primary" onClick={save} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

function Field({ label, children }) {
  return <div><label className="label-base">{label}</label>{children}</div>
}
