import { useState, useMemo } from 'react'
import { newId, blankInvoice } from '../store'
import { fmtMoney, calcInvoice } from '../utils'
import { PageHeader } from './ui'

export default function InvoiceEditor({ data, ops, editingId, onNav, onOpenInvoice }) {
  const isNew = !editingId

  const [draft, setDraft] = useState(() => {
    if (editingId) {
      const found = data.invoices.find((i) => i.id === editingId)
      return found ? structuredClone(found) : blankInvoice(data)
    }
    return blankInvoice(data)
  })
  const [saving, setSaving] = useState(false)

  const totals = useMemo(() => calcInvoice(draft), [draft])
  const currency = data.settings.currency

  const updateItem = (id, patch) =>
    setDraft((d) => ({
      ...d,
      items: d.items.map((it) => (it.id === id ? { ...it, ...patch } : it)),
    }))

  const addItem = () =>
    setDraft((d) => ({
      ...d,
      items: [...d.items, { id: newId(), description: '', quantity: 1, rate: 0 }],
    }))

  const removeItem = (id) =>
    setDraft((d) => ({
      ...d,
      items: d.items.length > 1 ? d.items.filter((it) => it.id !== id) : d.items,
    }))

  const save = async (alsoOpen = false) => {
    if (!draft.customerId) {
      alert('Please choose a customer.')
      return
    }
    if (!draft.items.some((i) => i.description.trim())) {
      alert('Please add at least one line item.')
      return
    }
    setSaving(true)
    try {
      await ops.saveInvoice(draft)
      if (alsoOpen) onOpenInvoice(draft.id)
      else onNav('invoices')
    } catch (e) {
      alert('Could not save invoice: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader
        title={isNew ? 'New invoice' : `Edit ${draft.number}`}
        subtitle={isNew ? 'Fill in the details and save when ready.' : null}
        actions={
          <>
            <button className="btn-ghost" onClick={() => onNav('invoices')} disabled={saving}>
              Cancel
            </button>
            <button className="btn-outline" onClick={() => save(false)} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button className="btn-gradient" onClick={() => save(true)} disabled={saving}>
              Save & open
            </button>
          </>
        }
      />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          {/* Details */}
          <div className="card p-5 md:p-6">
            <h2 className="font-display font-semibold text-lg tracking-tightest mb-4">Details</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label-base">Customer</label>
                <select
                  className="input-base"
                  value={draft.customerId}
                  onChange={(e) => setDraft({ ...draft, customerId: e.target.value })}
                >
                  <option value="">— select —</option>
                  {data.customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => onNav('customers')}
                  className="text-xs text-brandBlue mt-1.5 hover:underline"
                >
                  + Manage customers
                </button>
              </div>
              <div>
                <label className="label-base">Invoice number</label>
                <input
                  className="input-base font-mono"
                  value={draft.number}
                  onChange={(e) => setDraft({ ...draft, number: e.target.value })}
                />
              </div>
              <div>
                <label className="label-base">Issue date</label>
                <input
                  type="date"
                  className="input-base"
                  value={draft.issueDate}
                  onChange={(e) => setDraft({ ...draft, issueDate: e.target.value })}
                />
              </div>
              <div>
                <label className="label-base">Due date</label>
                <input
                  type="date"
                  className="input-base"
                  value={draft.dueDate}
                  onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="card p-5 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-lg tracking-tightest">Items</h2>
              <button onClick={addItem} className="btn-outline text-xs">
                + Add line
              </button>
            </div>

            <div className="hidden sm:grid grid-cols-12 gap-3 px-2 pb-2 text-xs uppercase tracking-wider text-mute font-mono">
              <div className="col-span-6">Description</div>
              <div className="col-span-2 text-right">Qty</div>
              <div className="col-span-2 text-right">Rate</div>
              <div className="col-span-2 text-right">Amount</div>
            </div>

            <div className="space-y-2">
              {draft.items.map((it) => {
                const amount = (Number(it.quantity) || 0) * (Number(it.rate) || 0)
                return (
                  <div
                    key={it.id}
                    className="grid grid-cols-12 gap-3 items-start py-2 border-t hairline first:border-t-0"
                  >
                    <input
                      className="input-base col-span-12 sm:col-span-6"
                      placeholder="Item description"
                      value={it.description}
                      onChange={(e) => updateItem(it.id, { description: e.target.value })}
                    />
                    <input
                      type="number"
                      step="0.01"
                      className="input-base col-span-4 sm:col-span-2 text-right"
                      placeholder="Qty"
                      value={it.quantity}
                      onChange={(e) => updateItem(it.id, { quantity: e.target.value })}
                    />
                    <input
                      type="number"
                      step="0.01"
                      className="input-base col-span-4 sm:col-span-2 text-right"
                      placeholder="Rate"
                      value={it.rate}
                      onChange={(e) => updateItem(it.id, { rate: e.target.value })}
                    />
                    <div className="col-span-3 sm:col-span-2 flex items-center justify-end gap-2 pt-2 sm:pt-2.5">
                      <span className="text-sm font-medium tabular-nums">
                        {fmtMoney(amount, currency)}
                      </span>
                      {draft.items.length > 1 && (
                        <button
                          onClick={() => removeItem(it.id)}
                          className="text-mute hover:text-danger p-1 rounded"
                          aria-label="Remove line"
                        >
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M3.5 3.5l7 7M10.5 3.5l-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Notes */}
          <div className="card p-5 md:p-6">
            <h2 className="font-display font-semibold text-lg tracking-tightest mb-4">Notes</h2>
            <textarea
              rows={3}
              className="input-base resize-none"
              placeholder="Notes for the customer (payment terms, references, thank-you message)…"
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            />
          </div>
        </div>

        {/* Sidebar: totals */}
        <div className="lg:col-span-1">
          <div className="card p-5 md:p-6 lg:sticky lg:top-6">
            <h2 className="font-display font-semibold text-lg tracking-tightest mb-4">Summary</h2>

            <div className="space-y-3 text-sm">
              <Row label="Subtotal" value={fmtMoney(totals.subtotal, currency)} />

              <div className="flex items-center justify-between gap-3">
                <label className="text-ash flex items-center gap-2">
                  Tax
                  <input
                    type="number"
                    step="0.01"
                    className="w-16 text-right input-base py-1 px-2 text-xs"
                    value={draft.taxRate}
                    onChange={(e) => setDraft({ ...draft, taxRate: e.target.value })}
                  />
                  <span className="text-mute">%</span>
                </label>
                <span className="font-medium tabular-nums">{fmtMoney(totals.taxAmount, currency)}</span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <label className="text-ash flex items-center gap-2">
                  Discount
                  <span className="text-mute">{currency}</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="w-28 text-right input-base py-1 px-2 text-xs"
                  value={draft.discount}
                  onChange={(e) => setDraft({ ...draft, discount: e.target.value })}
                />
              </div>

              <div className="border-t hairline pt-3 flex items-center justify-between">
                <span className="font-display font-semibold text-lg">Total</span>
                <span className="font-display font-bold text-2xl tracking-tightest text-brandBlue tabular-nums">
                  {fmtMoney(totals.total, currency)}
                </span>
              </div>
            </div>

            <div className="mt-5 pt-5 border-t hairline">
              <label className="label-base">Status</label>
              <select
                className="input-base"
                value={draft.status}
                onChange={(e) => setDraft({ ...draft, status: e.target.value })}
              >
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ash">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  )
}
