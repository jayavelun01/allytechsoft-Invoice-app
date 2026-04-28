import { useState, useMemo } from 'react'
import { newId, blankDeliveryChallan, blankDCItem } from '../store'
import { PageHeader } from './ui'
import { UNITS } from '../constants'

export default function DeliveryChallanEditor({ data, ops, editingId, onNav }) {
  const isNew = !editingId
  const [draft, setDraft] = useState(() => {
    if (editingId) {
      const found = data.deliveryChallans.find((p) => p.id === editingId)
      return found ? structuredClone(found) : blankDeliveryChallan()
    }
    const d = blankDeliveryChallan()
    d.customerId = data.customers[0]?.id || ''
    return d
  })
  const [saving, setSaving] = useState(false)

  const customerBranches = useMemo(
    () => data.customerBranches.filter((b) => b.customerId === draft.customerId),
    [data.customerBranches, draft.customerId],
  )
  const customerPOs = useMemo(
    () => data.purchaseOrders.filter((po) => po.customerId === draft.customerId),
    [data.purchaseOrders, draft.customerId],
  )

  const updateItem = (id, patch) =>
    setDraft((d) => ({ ...d, items: d.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) }))
  const addItem = () => setDraft((d) => ({ ...d, items: [...d.items, blankDCItem()] }))
  const removeItem = (id) =>
    setDraft((d) => ({ ...d, items: d.items.length > 1 ? d.items.filter((it) => it.id !== id) : d.items }))

  const pickProduct = (itemId, productId) => {
    const p = data.products.find((x) => x.id === productId)
    updateItem(itemId, p
      ? { productId, description: p.name + (p.description ? ` — ${p.description}` : ''), unit: p.unit }
      : { productId: '' })
  }

  /** Pull items from a linked PO into this DC. */
  const importFromPO = (poId) => {
    if (!poId) return
    const po = data.purchaseOrders.find((p) => p.id === poId)
    if (!po) return
    if (!confirm('Replace current items with items from this PO?')) return
    setDraft((d) => ({
      ...d,
      purchaseOrderId: poId,
      items: po.items.map((it) => ({
        id: newId(), productId: it.productId, description: it.description,
        unit: it.unit || 'Nos', quantity: it.quantity,
      })),
    }))
  }

  const save = async () => {
    if (!draft.number.trim()) { alert('DC number is required.'); return }
    if (!draft.customerId) { alert('Please choose a customer.'); return }
    setSaving(true)
    try { await ops.saveDeliveryChallan(draft); onNav('delivery-challans') }
    catch (e) { alert('Could not save: ' + e.message) }
    finally { setSaving(false) }
  }

  return (
    <div>
      <PageHeader
        title={isNew ? 'New Delivery Challan' : `Edit ${draft.number}`}
        actions={<>
          <button className="btn-ghost" onClick={() => onNav('delivery-challans')} disabled={saving}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        </>}
      />

      <div className="space-y-5 max-w-5xl">
        <div className="card p-5 md:p-6">
          <h2 className="font-display font-semibold text-lg tracking-tightest mb-4">Details</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Field label="DC number *">
              <input className="input-base font-mono" value={draft.number}
                onChange={(e) => setDraft({ ...draft, number: e.target.value })} placeholder="DC-2026-001" />
            </Field>
            <Field label="DC date">
              <input type="date" className="input-base" value={draft.dcDate || ''}
                onChange={(e) => setDraft({ ...draft, dcDate: e.target.value })} />
            </Field>
            <Field label="Status">
              <select className="input-base" value={draft.status}
                onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
                <option value="open">Open</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </Field>

            <Field label="Customer *">
              <select className="input-base" value={draft.customerId}
                onChange={(e) => setDraft({ ...draft, customerId: e.target.value, customerBranchId: '', purchaseOrderId: '' })}>
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
            <Field label="Linked PO">
              <select className="input-base" value={draft.purchaseOrderId}
                onChange={(e) => importFromPO(e.target.value)}
                disabled={!customerPOs.length}>
                <option value="">— optional —</option>
                {customerPOs.map((po) => <option key={po.id} value={po.id}>{po.number}</option>)}
              </select>
            </Field>

            <Field label="Delivery mode">
              <input className="input-base" value={draft.deliveryMode}
                onChange={(e) => setDraft({ ...draft, deliveryMode: e.target.value })}
                placeholder="By road / Courier / Self-pickup" />
            </Field>
            <Field label="Vehicle number">
              <input className="input-base font-mono uppercase" value={draft.vehicleNumber}
                onChange={(e) => setDraft({ ...draft, vehicleNumber: e.target.value.toUpperCase() })}
                placeholder="TN 09 AB 1234" />
            </Field>
            <Field label="LR / Docket number">
              <input className="input-base font-mono" value={draft.lrNumber}
                onChange={(e) => setDraft({ ...draft, lrNumber: e.target.value })} />
            </Field>
            <Field label="LR date">
              <input type="date" className="input-base" value={draft.lrDate || ''}
                onChange={(e) => setDraft({ ...draft, lrDate: e.target.value })} />
            </Field>
          </div>
        </div>

        <div className="card p-5 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-lg tracking-tightest">Items dispatched</h2>
            <button onClick={addItem} className="btn-outline text-xs">+ Add line</button>
          </div>

          <div className="hidden sm:grid grid-cols-12 gap-3 px-2 pb-2 text-xs uppercase tracking-wider text-mute font-mono">
            <div className="col-span-7">Description</div>
            <div className="col-span-3 text-right">Qty</div>
            <div className="col-span-2">Unit</div>
          </div>

          <div className="space-y-2">
            {draft.items.map((it) => (
              <div key={it.id} className="grid grid-cols-12 gap-3 items-start py-2 border-t hairline first:border-t-0">
                <div className="col-span-12 sm:col-span-7">
                  <select className="input-base mb-1.5" value={it.productId}
                    onChange={(e) => pickProduct(it.id, e.target.value)}>
                    <option value="">— pick from catalog —</option>
                    {data.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <input className="input-base" placeholder="Description" value={it.description}
                    onChange={(e) => updateItem(it.id, { description: e.target.value })} />
                </div>
                <input type="number" step="0.01" className="input-base col-span-6 sm:col-span-3 text-right"
                  placeholder="Qty" value={it.quantity}
                  onChange={(e) => updateItem(it.id, { quantity: e.target.value })} />
                <div className="col-span-6 sm:col-span-2 flex items-center gap-2">
                  <select className="input-base flex-1" value={it.unit}
                    onChange={(e) => updateItem(it.id, { unit: e.target.value })}>
                    {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                  {draft.items.length > 1 && (
                    <button onClick={() => removeItem(it.id)} className="text-mute hover:text-danger px-1">×</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5 md:p-6">
          <h2 className="font-display font-semibold text-lg tracking-tightest mb-3">Notes</h2>
          <textarea rows={3} className="input-base resize-none" value={draft.notes}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return <div><label className="label-base">{label}</label>{children}</div>
}
