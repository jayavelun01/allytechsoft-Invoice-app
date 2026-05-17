import { useState, useMemo } from 'react'
import { blankExpenseBill, blankExpenseBillItem } from '../store'
import { fmtMoney, calcInvoice, calcItemGst, validateGSTIN } from '../utils'
import { PageHeader } from './ui'
import { GST_SLABS, UNITS, INDIAN_STATES } from '../constants'

export default function ExpenseBillEditor({ data, ops, editingId, onNav, onOpen }) {
  const isNew = !editingId

  const [draft, setDraft] = useState(() => {
    if (editingId) {
      const found = (data.expenseBills || []).find((b) => b.id === editingId)
      return found ? structuredClone(found) : blankExpenseBill()
    }
    return blankExpenseBill()
  })
  const [saving, setSaving] = useState(false)

  const branch = data.branches.find((b) => b.id === draft.branchId)
  const totals = useMemo(() => calcInvoice(draft), [draft])
  const cur = data.settings.currency

  const updateItem = (id, patch) =>
    setDraft((d) => ({ ...d, items: d.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) }))
  const addItem = () => setDraft((d) => ({ ...d, items: [...d.items, blankExpenseBillItem()] }))
  const removeItem = (id) =>
    setDraft((d) => ({ ...d, items: d.items.length > 1 ? d.items.filter((it) => it.id !== id) : d.items }))

  const pickProduct = (itemId, productId) => {
    const p = data.products.find((x) => x.id === productId)
    updateItem(itemId, p
      ? {
          productId,
          description: p.name + (p.description ? ` — ${p.description}` : ''),
          hsnCode: p.hsnCode,
          unit: p.unit,
          rate: p.defaultRate,
          gstRate: p.defaultGstRate,
        }
      : { productId: '' })
  }

  const save = async (alsoOpen = false) => {
    if (!draft.billNumber.trim()) { alert('Please enter a bill number.'); return }
    if (!draft.vendorName.trim()) { alert('Please enter the vendor name.'); return }
    if (draft.vendorGstin && !validateGSTIN(draft.vendorGstin)) {
      alert('Vendor GSTIN format is invalid. Please check and try again.'); return
    }
    if (!draft.items.some((i) => (i.description || '').trim())) {
      alert('Please add at least one line item.'); return
    }
    setSaving(true)
    try {
      const itemsWithGst = draft.items.map((it) => {
        const r = calcItemGst(it, draft.gstType)
        return { ...it, cgstAmount: r.cgst, sgstAmount: r.sgst, igstAmount: r.igst }
      })
      await ops.saveExpenseBill({ ...draft, items: itemsWithGst })
      if (alsoOpen) onOpen(draft.id); else onNav('expense-bills')
    } catch (e) { alert('Could not save: ' + e.message) }
    finally { setSaving(false) }
  }

  return (
    <div>
      <PageHeader
        title={isNew ? 'New Expense Bill' : `Edit ${draft.billNumber}`}
        subtitle={isNew ? 'Record a vendor / supplier bill to track your Input Tax Credit (ITC).' : null}
        actions={<>
          <button className="btn-ghost" onClick={() => onNav('expense-bills')} disabled={saving}>Cancel</button>
          <button className="btn-outline" onClick={() => save(false)} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          <button className="btn-gradient" onClick={() => save(true)} disabled={saving}>Save & open</button>
        </>}
      />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">

          {/* Vendor details */}
          <div className="card p-5 md:p-6">
            <h2 className="font-display font-semibold text-lg tracking-tightest mb-4">Vendor / Supplier</h2>

            {(data.vendors || []).length > 0 && (
              <div className="mb-4 pb-4 border-b hairline">
                <label className="label-base">Pick from vendor master</label>
                <select
                  className="input-base"
                  value={draft.vendorId || ''}
                  onChange={(e) => {
                    const v = (data.vendors || []).find((x) => x.id === e.target.value)
                    if (v) {
                      setDraft({ ...draft, vendorId: v.id, vendorName: v.name, vendorGstin: v.gstin, vendorAddress: v.address })
                    } else {
                      setDraft({ ...draft, vendorId: '' })
                    }
                  }}
                >
                  <option value="">— select a saved vendor —</option>
                  {(data.vendors || []).map((v) => (
                    <option key={v.id} value={v.id}>{v.name}{v.gstin ? ` · ${v.gstin}` : ''}</option>
                  ))}
                </select>
                <p className="text-xs text-mute mt-1">Selecting auto-fills the fields below. You can still edit them freely.</p>
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Vendor name *">
                <input className="input-base" value={draft.vendorName}
                  onChange={(e) => setDraft({ ...draft, vendorName: e.target.value })}
                  placeholder="Supplier company name" />
              </Field>
              <Field label="Vendor GSTIN">
                <input className="input-base font-mono uppercase" value={draft.vendorGstin}
                  onChange={(e) => setDraft({ ...draft, vendorGstin: e.target.value.toUpperCase() })}
                  placeholder="27AAPFU0939F1ZV" maxLength={15} />
                {draft.vendorGstin && !validateGSTIN(draft.vendorGstin) && (
                  <p className="text-xs text-danger mt-1">Invalid GSTIN format</p>
                )}
              </Field>
              <div className="sm:col-span-2">
                <Field label="Vendor address">
                  <textarea rows={2} className="input-base resize-none" value={draft.vendorAddress}
                    onChange={(e) => setDraft({ ...draft, vendorAddress: e.target.value })}
                    placeholder="Street, City, State, PIN" />
                </Field>
              </div>
            </div>
          </div>

          {/* Bill details */}
          <div className="card p-5 md:p-6">
            <h2 className="font-display font-semibold text-lg tracking-tightest mb-4">Bill Details</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Field label="Bill number *">
                <input className="input-base font-mono" value={draft.billNumber}
                  onChange={(e) => setDraft({ ...draft, billNumber: e.target.value })}
                  placeholder="Vendor's invoice number" />
              </Field>
              <Field label="Bill date">
                <input type="date" className="input-base" value={draft.billDate || ''}
                  onChange={(e) => setDraft({ ...draft, billDate: e.target.value })} />
              </Field>
              <Field label="Due date">
                <input type="date" className="input-base" value={draft.dueDate || ''}
                  onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })} />
              </Field>
              <Field label="Received by branch">
                <select className="input-base" value={draft.branchId}
                  onChange={(e) => setDraft({ ...draft, branchId: e.target.value })}>
                  <option value="">— select branch —</option>
                  {data.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </Field>
              <Field label="Status">
                <select className="input-base" value={draft.status}
                  onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
                  <option value="draft">Draft</option>
                  <option value="received">Received</option>
                  <option value="paid">Paid</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </Field>
              <Field label="Place of supply">
                <select className="input-base" value={draft.placeOfSupply}
                  onChange={(e) => setDraft({ ...draft, placeOfSupply: e.target.value })}>
                  <option value="">— select —</option>
                  {INDIAN_STATES.map((s) => <option key={s.code} value={s.name}>{s.name}</option>)}
                </select>
              </Field>
            </div>

            <div className="mt-4 pt-4 border-t hairline">
              <div className="text-[10px] uppercase tracking-[0.2em] text-mute font-mono mb-2">GST type</div>
              <div className="inline-flex rounded-lg border hairline p-1 bg-mist/40">
                <button type="button"
                  onClick={() => setDraft({ ...draft, gstType: 'intra' })}
                  className={`px-3 py-1.5 rounded-md text-sm transition-colors ${draft.gstType === 'intra' ? 'bg-ink text-white' : 'text-ash'}`}>
                  CGST + SGST (intra-state)
                </button>
                <button type="button"
                  onClick={() => setDraft({ ...draft, gstType: 'inter' })}
                  className={`px-3 py-1.5 rounded-md text-sm transition-colors ${draft.gstType === 'inter' ? 'bg-ink text-white' : 'text-ash'}`}>
                  IGST (inter-state)
                </button>
              </div>
              {branch && (
                <div className="text-xs text-mute mt-2">
                  Receiving branch: {branch.name}{branch.state ? ` · ${branch.state}` : ''}
                </div>
              )}
            </div>
          </div>

          {/* Line items */}
          <div className="card p-5 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-lg tracking-tightest">Items / Expenses</h2>
              <button onClick={addItem} className="btn-outline text-xs">+ Add line</button>
            </div>

            <div className="space-y-3">
              {draft.items.map((it, idx) => {
                const lineGst = calcItemGst(it, draft.gstType)
                return (
                  <div key={it.id} className="border hairline rounded-xl p-3 bg-mist/30">
                    <div className="grid grid-cols-12 gap-3 items-start">
                      <div className="col-span-12 md:col-span-7">
                        <select className="input-base mb-2" value={it.productId}
                          onChange={(e) => pickProduct(it.id, e.target.value)}>
                          <option value="">— pick from catalog —</option>
                          {data.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        <input className="input-base" placeholder="Description / expense head" value={it.description}
                          onChange={(e) => updateItem(it.id, { description: e.target.value })} />
                      </div>
                      <div className="col-span-6 md:col-span-2">
                        <label className="label-base">HSN/SAC</label>
                        <input className="input-base font-mono text-sm" value={it.hsnCode}
                          onChange={(e) => updateItem(it.id, { hsnCode: e.target.value })} />
                      </div>
                      <div className="col-span-6 md:col-span-3 flex md:justify-end items-start gap-2">
                        <span className="text-xs font-mono text-mute mt-2">#{idx + 1}</span>
                        {draft.items.length > 1 && (
                          <button onClick={() => removeItem(it.id)} className="text-mute hover:text-danger p-1 mt-1" aria-label="Remove">
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                              <path d="M3.5 3.5l7 7M10.5 3.5l-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-12 gap-3 mt-3">
                      <div className="col-span-3 md:col-span-2">
                        <label className="label-base">Qty</label>
                        <input type="number" step="0.01" className="input-base text-right" value={it.quantity}
                          onChange={(e) => updateItem(it.id, { quantity: e.target.value })} />
                      </div>
                      <div className="col-span-3 md:col-span-2">
                        <label className="label-base">Unit</label>
                        <select className="input-base" value={it.unit}
                          onChange={(e) => updateItem(it.id, { unit: e.target.value })}>
                          {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </div>
                      <div className="col-span-3 md:col-span-2">
                        <label className="label-base">Rate</label>
                        <input type="number" step="0.01" className="input-base text-right" value={it.rate}
                          onChange={(e) => updateItem(it.id, { rate: e.target.value })} />
                      </div>
                      <div className="col-span-3 md:col-span-2">
                        <label className="label-base">GST %</label>
                        <select className="input-base" value={it.gstRate}
                          onChange={(e) => updateItem(it.id, { gstRate: Number(e.target.value) })}>
                          {GST_SLABS.map((s) => <option key={s} value={s}>{s}%</option>)}
                        </select>
                      </div>
                      <div className="col-span-12 md:col-span-4 flex flex-col md:items-end justify-end">
                        <div className="text-[10px] uppercase tracking-wider text-mute font-mono">Line total</div>
                        <div className="font-display font-semibold text-lg tabular-nums">
                          {fmtMoney(lineGst.taxable + lineGst.totalTax, cur)}
                        </div>
                        <div className="text-xs text-mute tabular-nums mt-0.5">
                          taxable {fmtMoney(lineGst.taxable, cur)} + GST {fmtMoney(lineGst.totalTax, cur)}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Notes */}
          <div className="card p-5 md:p-6">
            <Field label="Notes">
              <textarea rows={3} className="input-base resize-none" value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                placeholder="Payment terms, expense category, remarks…" />
            </Field>
          </div>
        </div>

        {/* Sticky summary */}
        <div className="lg:col-span-1">
          <div className="card p-5 md:p-6 lg:sticky lg:top-6">
            <h2 className="font-display font-semibold text-lg tracking-tightest mb-4">Summary</h2>
            <div className="space-y-2.5 text-sm">
              <Row label="Subtotal" value={fmtMoney(totals.subtotal, cur)} />
              {draft.gstType === 'intra' ? (
                <>
                  <Row label="CGST" value={fmtMoney(totals.cgst, cur)} />
                  <Row label="SGST" value={fmtMoney(totals.sgst, cur)} />
                </>
              ) : (
                <Row label="IGST" value={fmtMoney(totals.igst, cur)} />
              )}
              {Object.keys(totals.byRate).length > 0 && (
                <div className="pt-2 border-t hairline space-y-1 text-xs">
                  <div className="text-mute font-mono uppercase tracking-wider mb-1">By rate</div>
                  {Object.entries(totals.byRate).map(([rate, b]) => (
                    <div key={rate} className="flex justify-between text-ash">
                      <span>{rate}% on {fmtMoney(b.taxable, cur)}</span>
                      <span className="tabular-nums">{fmtMoney(b.total, cur)}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between gap-3 pt-2 border-t hairline">
                <label className="text-ash flex items-center gap-2">
                  Discount <span className="text-mute">{cur}</span>
                </label>
                <input type="number" step="0.01" className="w-28 text-right input-base py-1 px-2 text-xs"
                  value={draft.discount} onChange={(e) => setDraft({ ...draft, discount: e.target.value })} />
              </div>
              <div className="border-t hairline pt-3 flex items-center justify-between">
                <span className="font-display font-semibold text-lg">Total</span>
                <span className="font-display font-bold text-2xl tracking-tightest text-brandBlue tabular-nums">
                  {fmtMoney(totals.total, cur)}
                </span>
              </div>
              <div className="pt-2 border-t hairline">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-ash">ITC available</span>
                  <span className="font-semibold tabular-nums text-brandGreenDark">{fmtMoney(totals.totalTax, cur)}</span>
                </div>
                <p className="text-[10px] text-mute mt-1">GST paid on this purchase, claimable as input tax credit.</p>
              </div>
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

function Field({ label, children }) {
  return <div><label className="label-base">{label}</label>{children}</div>
}
