import { useState } from 'react'
import { Modal, PageHeader, Empty } from './ui'
import { GST_SLABS, UNITS } from '../constants'
import { fmtMoney } from '../utils'

export default function Products({ data, ops }) {
  const [editing, setEditing] = useState(null)
  const [query, setQuery] = useState('')
  const [saving, setSaving] = useState(false)

  const filtered = data.products.filter((p) =>
    [p.productCode, p.name, p.description, p.hsnCode].filter(Boolean).join(' ').toLowerCase().includes(query.toLowerCase()),
  )

  const startNew = () => setEditing({
    id: null, productCode: '', name: '', description: '', hsnCode: '',
    defaultRate: 0, defaultGstRate: data.settings.defaultTaxRate || 18, unit: 'Nos',
  })

  const save = async () => {
    if (!editing.name.trim()) { alert('Product name is required.'); return }
    setSaving(true)
    try { await ops.saveProduct(editing); setEditing(null) }
    catch (e) { alert('Could not save: ' + e.message) }
    finally { setSaving(false) }
  }

  const remove = async (id) => {
    if (!confirm('Delete this product? Existing invoices keep their data.')) return
    try { await ops.deleteProduct(id) } catch (e) { alert('Could not delete: ' + e.message) }
  }

  return (
    <div>
      <PageHeader
        title="Products"
        subtitle={`${data.products.length} ${data.products.length === 1 ? 'product' : 'products'}`}
        actions={<>
          <input type="search" placeholder="Search…" value={query} onChange={(e) => setQuery(e.target.value)} className="input-base w-full sm:w-64" />
          <button onClick={startNew} className="btn-primary">+ Add product</button>
        </>}
      />

      {data.products.length === 0 ? (
        <Empty
          title="No products yet"
          hint="Add products to your catalog to quickly add them to invoices, POs, and DCs."
          action={<button onClick={startNew} className="btn-primary">Add your first product</button>}
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-mist/50">
                <tr className="text-left text-xs uppercase tracking-wider text-mute">
                  <th className="px-6 py-3 font-medium">Code</th>
                  <th className="px-6 py-3 font-medium">Name</th>
                  <th className="px-6 py-3 font-medium">HSN</th>
                  <th className="px-6 py-3 font-medium">Unit</th>
                  <th className="px-6 py-3 font-medium text-right">Rate</th>
                  <th className="px-6 py-3 font-medium text-right">GST</th>
                  <th className="px-6 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-t hairline hover:bg-mist/30 transition-colors">
                    <td className="px-6 py-3 font-mono text-[13px] text-ash">{p.productCode || '—'}</td>
                    <td className="px-6 py-3">
                      <div className="font-medium">{p.name}</div>
                      {p.description && <div className="text-xs text-mute mt-0.5 line-clamp-1">{p.description}</div>}
                    </td>
                    <td className="px-6 py-3 font-mono text-[13px] text-ash">{p.hsnCode || '—'}</td>
                    <td className="px-6 py-3 text-ash">{p.unit}</td>
                    <td className="px-6 py-3 text-right tabular-nums">{fmtMoney(p.defaultRate, data.settings.currency)}</td>
                    <td className="px-6 py-3 text-right tabular-nums">{p.defaultGstRate}%</td>
                    <td className="px-6 py-3 text-right whitespace-nowrap">
                      <button onClick={() => setEditing({ ...p })} className="text-brandBlue text-sm hover:underline mr-3">Edit</button>
                      <button onClick={() => remove(p.id)} className="text-danger text-sm hover:underline">Delete</button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan="7" className="px-6 py-10 text-center text-mute text-sm">No products match “{query}”.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        open={!!editing}
        onClose={() => !saving && setEditing(null)}
        title={editing?.id ? 'Edit product' : 'New product'}
        footer={<>
          <button className="btn-ghost" onClick={() => setEditing(null)} disabled={saving}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : editing?.id ? 'Save changes' : 'Add product'}
          </button>
        </>}
      >
        {editing && (
          <div className="space-y-4">
            <div className="grid sm:grid-cols-3 gap-4">
              <Field label="Product code">
                <input className="input-base font-mono" value={editing.productCode}
                  onChange={(e) => setEditing({ ...editing, productCode: e.target.value })} placeholder="PRD-001" />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Product name *">
                  <input className="input-base" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} autoFocus />
                </Field>
              </div>
            </div>

            <Field label="Description">
              <textarea rows={3} className="input-base resize-none" value={editing.description}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
            </Field>

            <div className="grid sm:grid-cols-3 gap-4">
              <Field label="HSN / SAC">
                <input className="input-base font-mono" value={editing.hsnCode}
                  onChange={(e) => setEditing({ ...editing, hsnCode: e.target.value })} placeholder="998314" />
              </Field>
              <Field label="Unit">
                <select className="input-base" value={editing.unit}
                  onChange={(e) => setEditing({ ...editing, unit: e.target.value })}>
                  {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </Field>
              <Field label="Default GST %">
                <select className="input-base" value={editing.defaultGstRate}
                  onChange={(e) => setEditing({ ...editing, defaultGstRate: Number(e.target.value) })}>
                  {GST_SLABS.map((s) => <option key={s} value={s}>{s}%</option>)}
                </select>
              </Field>
            </div>

            <Field label={`Default rate (${data.settings.currency})`}>
              <input type="number" step="0.01" className="input-base" value={editing.defaultRate}
                onChange={(e) => setEditing({ ...editing, defaultRate: e.target.value })} />
            </Field>
          </div>
        )}
      </Modal>
    </div>
  )
}

function Field({ label, children }) {
  return <div><label className="label-base">{label}</label>{children}</div>
}
