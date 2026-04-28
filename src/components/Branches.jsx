import { useState } from 'react'
import { Modal, PageHeader, Empty } from './ui'
import { INDIAN_STATES } from '../constants'

export default function Branches({ data, ops }) {
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)

  const startNew = () => setEditing({
    id: null, name: '', address: '', state: '', stateCode: '',
    gstin: '', email: '', phone: '', signingAuthority: '',
    invoicePrefix: 'INV-', nextInvoiceNumber: 1,
    isDefault: data.branches.length === 0,
  })

  const save = async () => {
    if (!editing.name.trim()) { alert('Branch name is required.'); return }
    setSaving(true)
    try {
      await ops.saveBranch(editing)
      setEditing(null)
    } catch (e) { alert('Could not save: ' + e.message) }
    finally { setSaving(false) }
  }

  const remove = async (id) => {
    if (!confirm('Delete this branch? Invoices issued from it will keep their data but lose the link.')) return
    try { await ops.deleteBranch(id) }
    catch (e) { alert('Could not delete: ' + e.message) }
  }

  const setStateByName = (name) => {
    const found = INDIAN_STATES.find((s) => s.name === name)
    setEditing({ ...editing, state: name, stateCode: found?.code || '' })
  }

  return (
    <div>
      <PageHeader
        title="Branches"
        subtitle={`${data.branches.length} ${data.branches.length === 1 ? 'branch' : 'branches'} · invoices show "From" your default branch`}
        actions={<button onClick={startNew} className="btn-primary">+ Add branch</button>}
      />

      {data.branches.length === 0 ? (
        <Empty
          title="No branches yet"
          hint="Add at least one branch to issue invoices. Each branch has its own GSTIN and invoice number sequence."
          action={<button onClick={startNew} className="btn-primary">Add your first branch</button>}
        />
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.branches.map((b) => (
            <div key={b.id} className="card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-display font-semibold text-lg tracking-tightest">{b.name}</h3>
                    {b.isDefault && (
                      <span className="text-[10px] uppercase tracking-wider text-brandGreenDark bg-success/10 px-2 py-0.5 rounded-full font-medium">
                        Default
                      </span>
                    )}
                  </div>
                  {b.gstin && <div className="font-mono text-xs text-mute mt-1">{b.gstin}</div>}
                </div>
              </div>

              <div className="mt-3 space-y-1.5 text-sm text-ash">
                {b.address && <div className="whitespace-pre-line">{b.address}</div>}
                {b.state && <div className="text-xs">{b.state} ({b.stateCode})</div>}
                {b.email && <div className="text-xs">{b.email}</div>}
                {b.phone && <div className="text-xs">{b.phone}</div>}
              </div>

              <div className="mt-4 pt-3 border-t hairline flex items-center justify-between text-xs text-mute">
                <span>Next # <span className="font-mono">{b.invoicePrefix}{String(b.nextInvoiceNumber).padStart(4, '0')}</span></span>
                <div className="flex gap-3">
                  <button onClick={() => setEditing({ ...b })} className="text-brandBlue hover:underline">Edit</button>
                  <button onClick={() => remove(b.id)} className="text-danger hover:underline">Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={!!editing}
        onClose={() => !saving && setEditing(null)}
        title={editing?.id ? 'Edit branch' : 'New branch'}
        wide
        footer={<>
          <button className="btn-ghost" onClick={() => setEditing(null)} disabled={saving}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : editing?.id ? 'Save changes' : 'Add branch'}
          </button>
        </>}
      >
        {editing && (
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Branch / unit name *">
                <input className="input-base" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} autoFocus />
              </Field>
              <Field label="GSTIN">
                <input className="input-base font-mono uppercase" value={editing.gstin}
                  onChange={(e) => setEditing({ ...editing, gstin: e.target.value.toUpperCase() })} placeholder="33AAAAA0000A1Z5" />
              </Field>
            </div>

            <Field label="Address">
              <textarea rows={2} className="input-base resize-none" value={editing.address}
                onChange={(e) => setEditing({ ...editing, address: e.target.value })} />
            </Field>

            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="State">
                <select className="input-base" value={editing.state} onChange={(e) => setStateByName(e.target.value)}>
                  <option value="">— select state —</option>
                  {INDIAN_STATES.map((s) => <option key={s.code} value={s.name}>{s.name} ({s.code})</option>)}
                </select>
              </Field>
              <Field label="Signing authority">
                <input className="input-base" value={editing.signingAuthority}
                  onChange={(e) => setEditing({ ...editing, signingAuthority: e.target.value })}
                  placeholder="e.g. Authorised Signatory" />
              </Field>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Email"><input type="email" className="input-base" value={editing.email}
                onChange={(e) => setEditing({ ...editing, email: e.target.value })} /></Field>
              <Field label="Phone"><input className="input-base" value={editing.phone}
                onChange={(e) => setEditing({ ...editing, phone: e.target.value })} /></Field>
            </div>

            <div className="border-t hairline pt-4">
              <div className="text-xs font-mono uppercase tracking-wider text-mute mb-3">Invoice numbering</div>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Invoice prefix">
                  <input className="input-base font-mono" value={editing.invoicePrefix}
                    onChange={(e) => setEditing({ ...editing, invoicePrefix: e.target.value })} />
                </Field>
                <Field label="Next invoice number">
                  <input type="number" className="input-base" value={editing.nextInvoiceNumber}
                    onChange={(e) => setEditing({ ...editing, nextInvoiceNumber: Number(e.target.value) || 1 })} />
                </Field>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-ash">
              <input type="checkbox" checked={editing.isDefault}
                onChange={(e) => setEditing({ ...editing, isDefault: e.target.checked })} />
              Use this branch by default for new invoices
            </label>
          </div>
        )}
      </Modal>
    </div>
  )
}

function Field({ label, children }) {
  return <div><label className="label-base">{label}</label>{children}</div>
}
