import { useState } from 'react'
import { fmtDate } from '../utils'
import { Modal, PageHeader, Empty } from './ui'

export default function Customers({ data, ops }) {
  const [editing, setEditing] = useState(null)
  const [query, setQuery] = useState('')
  const [saving, setSaving] = useState(false)

  const filtered = data.customers.filter((c) =>
    [c.name, c.email, c.phone, c.contactPerson]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(query.toLowerCase()),
  )

  const startNew = () =>
    setEditing({
      id: null,
      name: '',
      contactPerson: '',
      email: '',
      phone: '',
      address: '',
      taxId: '',
    })

  const save = async () => {
    if (!editing.name.trim()) {
      alert('Customer name is required.')
      return
    }
    setSaving(true)
    try {
      await ops.saveCustomer(editing)
      setEditing(null)
    } catch (e) {
      alert('Could not save customer: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id) => {
    if (!confirm('Delete this customer? Their invoices will remain but lose the link.')) return
    try {
      await ops.deleteCustomer(id)
    } catch (e) {
      alert('Could not delete customer: ' + e.message)
    }
  }

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle={`${data.customers.length} on file`}
        actions={
          <>
            <input
              type="search"
              placeholder="Search…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="input-base w-full sm:w-64"
            />
            <button onClick={startNew} className="btn-primary">
              + Add customer
            </button>
          </>
        }
      />

      {data.customers.length === 0 ? (
        <Empty
          title="No customers yet"
          hint="Add your first customer to start invoicing."
          action={
            <button onClick={startNew} className="btn-primary">
              Add customer
            </button>
          }
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-mist/50">
                <tr className="text-left text-xs uppercase tracking-wider text-mute">
                  <th className="px-6 py-3 font-medium">Customer</th>
                  <th className="px-6 py-3 font-medium">Contact</th>
                  <th className="px-6 py-3 font-medium">Phone</th>
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
                    <td className="px-6 py-4 text-ash">{c.contactPerson || '—'}</td>
                    <td className="px-6 py-4 text-ash">{c.phone || '—'}</td>
                    <td className="px-6 py-4 text-ash">{fmtDate(c.createdAt)}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setEditing({ ...c })}
                        className="text-brandBlue text-sm hover:underline mr-4"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => remove(c.id)}
                        className="text-danger text-sm hover:underline"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan="5" className="px-6 py-10 text-center text-mute text-sm">
                      No customers match “{query}”.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        open={!!editing}
        onClose={() => !saving && setEditing(null)}
        title={editing?.id ? 'Edit customer' : 'New customer'}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setEditing(null)} disabled={saving}>
              Cancel
            </button>
            <button className="btn-primary" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : editing?.id ? 'Save changes' : 'Add customer'}
            </button>
          </>
        }
      >
        {editing && (
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Customer / company name *">
                <input
                  className="input-base"
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  autoFocus
                />
              </Field>
              <Field label="Contact person">
                <input
                  className="input-base"
                  value={editing.contactPerson}
                  onChange={(e) => setEditing({ ...editing, contactPerson: e.target.value })}
                />
              </Field>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Email">
                <input
                  type="email"
                  className="input-base"
                  value={editing.email}
                  onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                />
              </Field>
              <Field label="Phone">
                <input
                  className="input-base"
                  value={editing.phone}
                  onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Address">
              <textarea
                rows={3}
                className="input-base resize-none"
                value={editing.address}
                onChange={(e) => setEditing({ ...editing, address: e.target.value })}
                placeholder="Street, City, State, Postcode, Country"
              />
            </Field>
            <Field label="Tax ID / GSTIN (optional)">
              <input
                className="input-base"
                value={editing.taxId}
                onChange={(e) => setEditing({ ...editing, taxId: e.target.value })}
              />
            </Field>
          </div>
        )}
      </Modal>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="label-base">{label}</label>
      {children}
    </div>
  )
}
