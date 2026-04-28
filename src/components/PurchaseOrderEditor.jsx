import { useState, useMemo } from 'react'
import { newId, blankPurchaseOrder, blankPOItem } from '../store'
import { fmtMoney } from '../utils'
import { PageHeader } from './ui'
import { UNITS } from '../constants'

export default function PurchaseOrderEditor({ data, ops, editingId, onNav }) {
  const isNew = !editingId
  const [draft, setDraft] = useState(() => {
    if (editingId) {
      const found = data.purchaseOrders.find((p) => p.id === editingId)
      return found ? structuredClone(found) : blankPurchaseOrder()
    }
    const d = blankPurchaseOrder()
    d.customerId = data.customers[0]?.id || ''
    return d
  })
  const [saving, setSaving] = useState(false)

  const customerBranches = useMemo(
    () => data.customerBranches.filter((b) => b.customerId === draft.customerId),
    [data.customerBranches, draft.customerId],
  )

  const total = useMemo(
    () => (draft.items || []).reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.rate) || 0), 0),
    [draft.items],
  )

  const updateItem = (id, patch) =>
    setDraft((d) => ({ ...d, items: d.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) }))

  const addItem = () => setDraft((d) => ({ ...d, items: [...d.items, blankPOItem()] }))
  const removeItem = (id) =>
    setDraft((d) => ({ ...d, items: d.items.length > 1 ? d.items.filter((it) => it.id !== id) : d.items }))

  const pickProduct = (itemId, productId) => {
    const p = data.products.find((x) => x.id === productId)
    updateItem(itemId, p
      ? { productId, description: p.name + (p.description ? ` — ${p.description}` : ''), unit: p.unit, rate: p.defaultRate }
      : { productId: '' })
  }

  const save = async () => {
    if (!draft.number.trim()) { alert('PO number is required.'); return }
    if (!draft.customerId) { alert('Please choose a customer.'); return }
    setSaving(true)
    try { await ops.savePurchaseOrder(draft); onNav('purchase-orders') }
    catch (e) { alert('Could not save: ' + e.message) }
    finally { setSaving(false) }
  }

  return (
    <div>
      <PageHeader
        title={isNew ? 'New Purchase Order' : `Edit ${draft.number}`}
        actions={<>
          <button className="btn-ghost" onClick={() => onNav('purchase-orders')} disabled={saving}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        </>}
      />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <div className="card p-5 md:p-6">
            <h2 className="font-display font-semibold text-lg tracking-tightest mb-4">Details</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="PO number *">
                <input className="input-base font-mono" value={draft.number}
                  onChange={(e) => setDraft({ ...draft, number: e.target.value })} placeholder="PO-2026-001" />
              </Field>
              <Field label="PO date">
                <input type="date" className="input-base" value={draft.poDate || ''}
                  onChange={(e) => setDraft({ ...draft, poDate: e.target.value })} />
              </Field>
              <Field label="Customer *">
                <select className="input-base" value={draft.customerId}
                  onChange={(e) => setDraft({ ...draft, customerId: e.target.value, customerBranchId: '' })}>
                  <option value="">— select —</option>
                  {data.customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Customer branch">
                <select className="input-base" value={draft.customerBranchId}
                  onChange={(e) => setDraft({ ...draft, customerBranchId: e.target.value })}
                  disabled={!customerBranches.length}>
                  <option value="">— optional —</option>
                  {customerBranches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </Field>
              <Field label="Status">
                <select className="input-base" value={draft.status}
                  onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
                  <option value="open">Open</option>
                  <option value="closed">Closed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </Field>
            </div>
          </div>

          <div className="card p-5 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-lg tracking-tightest">Items</h2>
              <button onClick={addItem} className="btn-outline text-xs">+ Add line</button>
            </div>

            <div className="hidden sm:grid grid-cols-12 gap-3 px-2 pb-2 text-xs uppercase tracking-wider text-mute font-mono">
              <div className="col-span-5">Description</div>
              <div className="col-span-2 text-right">Qty</div>
              <div className="col-span-1">Unit</div>
              <div className="col-span-2 text-right">Rate</div>
              <div className="col-span-2 text-right">Amount</div>
            </div>

            <div className="space-y-2">
              {draft.items.map((it) => {
                const amt = (Number(it.quantity) || 0) * (Number(it.rate) || 0)
                return (
                  <div key={it.id} className="grid grid-cols-12 gap-3 items-start py-2 border-t hairline first:border-t-0">
                    <div className="col-span-12 sm:col-span-5">
                      <select className="input-base mb-1.5" value={it.productId}
                        onChange={(e) => pickProduct(it.id, e.target.value)}>
                        <option value="">— pick from catalog —</option>
                        {data.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      <input className="input-base" placeholder="Description" value={it.description}
                        onChange={(e) => updateItem(it.id, { description: e.target.value })} />
                    </div>
                    <input type="number" step="0.01" className="input-base col-span-3 sm:col-span-2 text-right" placeholder="Qty"
                      value={it.quantity} onChange={(e) => updateItem(it.id, { quantity: e.target.value })} />
                    <select className="input-base col-span-3 sm:col-span-1" value={it.unit}
                      onChange={(e) => updateItem(it.id, { unit: e.target.value })}>
                      {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                    <input type="number" step="0.01" className="input-base col-span-3 sm:col-span-2 text-right" placeholder="Rate"
                      value={it.rate} onChange={(e) => updateItem(it.id, { rate: e.target.value })} />
                    <div className="col-span-3 sm:col-span-2 flex items-center justify-end gap-2 pt-2">
                      <span className="text-sm font-medium tabular-nums">{fmtMoney(amt, data.settings.currency)}</span>
                      {draft.items.length > 1 && (
                        <button onClick={() => removeItem(it.id)} className="text-mute hover:text-danger p-1">×</button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="card p-5 md:p-6">
            <h2 className="font-display font-semibold text-lg tracking-tightest mb-3">Notes</h2>
            <textarea rows={3} className="input-base resize-none" value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              placeholder="Internal notes for this PO…" />
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="card p-5 md:p-6 lg:sticky lg:top-6">
            <h2 className="font-display font-semibold text-lg tracking-tightest mb-4">Summary</h2>
            <div className="flex items-center justify-between text-sm">
              <span className="text-ash">Total value</span>
              <span className="font-display font-bold text-2xl tracking-tightest text-brandBlue tabular-nums">
                {fmtMoney(total, data.settings.currency)}
              </span>
            </div>
            <p className="mt-4 text-xs text-mute">
              POs do not include GST. GST is calculated on the resulting invoice when you bill against this PO.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return <div><label className="label-base">{label}</label>{children}</div>
}
