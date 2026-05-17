import { useState } from 'react'
import { fmtDate, validateGSTIN } from '../utils'
import { Modal, PageHeader, Empty } from './ui'

export default function Vendors({ data, ops }) {
  const [editing, setEditing] = useState(null)
  const [query, setQuery] = useState('')
  const [saving, setSaving] = useState(false)

  const vendors = data.vendors || []

  const filtered = vendors.filter((v) =>
    [v.name, v.gstin, v.email, v.phone, v.contactPerson]
      .filter(Boolean).join(' ').toLowerCase().includes(query.toLowerCase()),
  )

  const startNew = () => setEditing({
    id: null, name: '', gstin: '', address: '',
    contactPerson: '', email: '', phone: '', notes: '',
  })

  const save = async () => {
    if (!editing.name.trim()) { alert('Vendor name is required.'); return }
    if (editing.gstin && !validateGSTIN(editing.gstin)) {
      alert('GSTIN format is invalid. Expected: 22AAAAA0000A1Z5'); return
    }
    setSaving(true)
    try { await ops.saveVendor(editing); setEditing(null) }
    catch (e) { alert('Could not save: ' + e.message) }
    finally { setSaving(false) }
  }

  const remove = async (id) => {
    if (!confirm('Delete this vendor? Expense bills linked to them will keep the vendor details.')) return
    try { await ops.deleteVendor(id) } catch (e) { alert('Could not delete: ' + e.message) }
  }

  return (
    <div>
      <PageHeader
        title="Vendors / Suppliers"
        subtitle={`${vendors.length} ${vendors.length === 1 ? 'vendor' : 'vendors'}`}
        actions={<>
          <input type="search" placeholder="Search…" value={query}
            onChange={(e) => setQuery(e.target.value)} className="input-base w-full sm:w-64" />
          <button onClick={startNew} className="btn-primary">+ Add vendor</button>
        </>}
      />

      {vendors.length === 0 ? (
        <Empty
          title="No vendors yet"
          hint="Add vendors and suppliers here to quickly fill expense bill details."
          action={<button onClick={startNew} className="btn-primary">Add vendor</button>}
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-mist/50">
                <tr className="text-left text-xs uppercase tracking-wider text-mute">
                  <th className="px-6 py-3 font-medium">Vendor / Supplier</th>
                  <th className="px-6 py-3 font-medium">GSTIN</th>
                  <th className="px-6 py-3 font-medium">Contact</th>
                  <th className="px-6 py-3 font-medium">Added</th>
                  <th className="px-6 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((v) => (
                  <tr key={v.id} className="border-t hairline hover:bg-mist/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium">{v.name}</div>
                      {v.address && <div className="text-xs text-mute mt-0.5 whitespace-pre-line line-clamp-1">{v.address}</div>}
                    </td>
                    <td className="px-6 py-4 font-mono text-[13px] text-ash">{v.gstin || '—'}</td>
                    <td className="px-6 py-4 text-ash">
                      <div>{v.contactPerson || '—'}</div>
                      {v.phone && <div className="text-xs">{v.phone}</div>}
                      {v.email && <div className="text-xs">{v.email}</div>}
                    </td>
                    <td className="px-6 py-4 text-ash text-xs">{fmtDate(v.createdAt)}</td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <button onClick={() => setEditing({ ...v })} className="text-brandBlue text-sm hover:underline mr-3">Edit</button>
                      <button onClick={() => remove(v.id)} className="text-danger text-sm hover:underline">Delete</button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan="5" className="px-6 py-10 text-center text-mute text-sm">
                      No vendors match "{query}".
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
        title={editing?.id ? 'Edit vendor' : 'New vendor'}
        footer={<>
          <button className="btn-ghost" onClick={() => setEditing(null)} disabled={saving}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : editing?.id ? 'Save changes' : 'Add vendor'}
          </button>
        </>}
      >
        {editing && (
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Vendor / company name *">
                <input className="input-base" value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  placeholder="Supplier Pvt. Ltd." autoFocus />
              </Field>
              <Field label="GSTIN">
                <input className="input-base font-mono uppercase" value={editing.gstin}
                  onChange={(e) => setEditing({ ...editing, gstin: e.target.value.toUpperCase() })}
                  placeholder="22AAAAA0000A1Z5" maxLength={15} />
                {editing.gstin && !validateGSTIN(editing.gstin) && (
                  <p className="text-xs text-danger mt-1">Invalid GSTIN — expected 15 chars, e.g. 22AAAAA0000A1Z5</p>
                )}
              </Field>
            </div>
            <Field label="Address">
              <textarea rows={2} className="input-base resize-none" value={editing.address}
                onChange={(e) => setEditing({ ...editing, address: e.target.value })}
                placeholder="Street, City, State, PIN" />
            </Field>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Contact person">
                <input className="input-base" value={editing.contactPerson}
                  onChange={(e) => setEditing({ ...editing, contactPerson: e.target.value })} />
              </Field>
              <Field label="Phone">
                <input className="input-base" value={editing.phone}
                  onChange={(e) => setEditing({ ...editing, phone: e.target.value })} />
              </Field>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Email">
                <input type="email" className="input-base" value={editing.email}
                  onChange={(e) => setEditing({ ...editing, email: e.target.value })} />
              </Field>
              <Field label="Notes">
                <input className="input-base" value={editing.notes}
                  onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                  placeholder="Payment terms, category…" />
              </Field>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function Field({ label, children }) {
  return <div><label className="label-base">{label}</label>{children}</div>
}
