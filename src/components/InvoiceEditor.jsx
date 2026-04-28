import { useState, useMemo, useEffect } from 'react'
import { newId, blankInvoice, blankInvoiceItem, formatNumber } from '../store'
import { fmtMoney, calcInvoice, calcItemGst } from '../utils'
import { PageHeader } from './ui'
import { GST_SLABS, UNITS, INDIAN_STATES } from '../constants'

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

  const branch = data.branches.find((b) => b.id === draft.branchId)
  const customer = data.customers.find((c) => c.id === draft.customerId)

  const customerBranches = useMemo(
    () => data.customerBranches.filter((b) => b.customerId === draft.customerId),
    [data.customerBranches, draft.customerId],
  )
  const customerBranch = data.customerBranches.find((b) => b.id === draft.customerBranchId)

  const customerPOs = useMemo(
    () => data.purchaseOrders.filter((po) => po.customerId === draft.customerId),
    [data.purchaseOrders, draft.customerId],
  )
  const customerDCs = useMemo(
    () => data.deliveryChallans.filter((dc) => dc.customerId === draft.customerId),
    [data.deliveryChallans, draft.customerId],
  )

  // Recompute place of supply + auto-detect GST type when state changes
  useEffect(() => {
    if (!branch || !customerBranch) return
    if (draft.gstType !== 'intra' && draft.gstType !== 'inter') return
    const detected = branch.stateCode && customerBranch.stateCode &&
                     branch.stateCode === customerBranch.stateCode ? 'intra' : 'inter'
    setDraft((d) => ({
      ...d,
      placeOfSupply: customerBranch.state || d.placeOfSupply,
      // Don't override if user has changed it manually—only if untouched
      ...(d._gstAutoSet ? { gstType: detected } : {}),
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branch?.id, customerBranch?.id])

  // Recompute invoice number when branch changes (only for new invoices)
  useEffect(() => {
    if (!isNew) return
    if (!branch) return
    setDraft((d) => ({
      ...d,
      number: formatNumber(branch.invoicePrefix || 'INV-', branch.next_invoice_number || branch.nextInvoiceNumber || 1),
      signingAuthority: d.signingAuthority || branch.signingAuthority || '',
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branch?.id])

  const totals = useMemo(() => calcInvoice(draft), [draft])
  const cur = data.settings.currency

  /* Item operations */
  const updateItem = (id, patch) =>
    setDraft((d) => ({ ...d, items: d.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) }))
  const addItem = () => setDraft((d) => ({ ...d, items: [...d.items, blankInvoiceItem(data.settings)] }))
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

  /** Pulls items from a PO into the invoice. */
  const importFromPO = (poId) => {
    if (!poId) { setDraft((d) => ({ ...d, purchaseOrderId: '' })); return }
    const po = data.purchaseOrders.find((p) => p.id === poId)
    if (!po) return
    if (!confirm('Replace current items with the PO items?')) return
    setDraft((d) => ({
      ...d,
      purchaseOrderId: poId,
      items: po.items.map((it) => {
        const product = data.products.find((p) => p.id === it.productId)
        return {
          id: newId(),
          productId: it.productId || '',
          description: it.description,
          hsnCode: product?.hsnCode || '',
          unit: it.unit || 'Nos',
          quantity: it.quantity,
          rate: it.rate,
          gstRate: product?.defaultGstRate ?? data.settings.defaultTaxRate ?? 18,
        }
      }),
    }))
  }

  const setStateBy = (val) => {
    setDraft((d) => ({ ...d, placeOfSupply: val }))
  }

  const save = async (alsoOpen = false) => {
    if (!draft.branchId) { alert('Please choose a "From" branch.'); return }
    if (!draft.customerId) { alert('Please choose a customer.'); return }
    if (!draft.items.some((i) => (i.description || '').trim())) {
      alert('Please add at least one line item.'); return
    }
    setSaving(true)
    try {
      // Compute GST splits per line at save-time so they're persisted
      const itemsWithGst = draft.items.map((it) => {
        const r = calcItemGst(it, draft.gstType)
        return {
          ...it,
          cgstAmount: r.cgst,
          sgstAmount: r.sgst,
          igstAmount: r.igst,
        }
      })
      await ops.saveInvoice({ ...draft, items: itemsWithGst })
      if (alsoOpen) onOpenInvoice(draft.id); else onNav('invoices')
    } catch (e) { alert('Could not save invoice: ' + e.message) }
    finally { setSaving(false) }
  }

  return (
    <div>
      <PageHeader
        title={isNew ? 'New invoice' : `Edit ${draft.number}`}
        subtitle={isNew ? 'Fill in the details and save when ready.' : null}
        actions={<>
          <button className="btn-ghost" onClick={() => onNav('invoices')} disabled={saving}>Cancel</button>
          <button className="btn-outline" onClick={() => save(false)} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          <button className="btn-gradient" onClick={() => save(true)} disabled={saving}>Save & open</button>
        </>}
      />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          {/* From + To */}
          <div className="card p-5 md:p-6">
            <h2 className="font-display font-semibold text-lg tracking-tightest mb-4">Parties</h2>
            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-mute font-mono mb-2">From</div>
                <Field label="Branch / unit *">
                  <select className="input-base" value={draft.branchId}
                    onChange={(e) => setDraft({ ...draft, branchId: e.target.value })}>
                    <option value="">— select branch —</option>
                    {data.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                  {data.branches.length === 0 && (
                    <button onClick={() => onNav('branches')} className="text-xs text-brandBlue mt-1 hover:underline">
                      + Add a branch first
                    </button>
                  )}
                </Field>
                {branch && (
                  <div className="mt-2 text-xs text-mute leading-relaxed">
                    {branch.gstin && <div className="font-mono">{branch.gstin}</div>}
                    {branch.state && <div>{branch.state}</div>}
                  </div>
                )}
              </div>

              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-mute font-mono mb-2">To</div>
                <Field label="Customer *">
                  <select className="input-base" value={draft.customerId}
                    onChange={(e) => setDraft({ ...draft, customerId: e.target.value, customerBranchId: '' })}>
                    <option value="">— select —</option>
                    {data.customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </Field>
                {customerBranches.length > 0 && (
                  <div className="mt-3">
                    <Field label="Customer branch">
                      <select className="input-base" value={draft.customerBranchId}
                        onChange={(e) => setDraft({ ...draft, customerBranchId: e.target.value })}>
                        <option value="">— primary address —</option>
                        {customerBranches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    </Field>
                  </div>
                )}
                {customer && (
                  <div className="mt-2 text-xs text-mute leading-relaxed">
                    {(customerBranch?.gstin || customer.gstin) && <div className="font-mono">{customerBranch?.gstin || customer.gstin}</div>}
                    {customerBranch?.state && <div>{customerBranch.state}</div>}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Invoice meta */}
          <div className="card p-5 md:p-6">
            <h2 className="font-display font-semibold text-lg tracking-tightest mb-4">Details</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Field label="Invoice number">
                <input className="input-base font-mono" value={draft.number}
                  onChange={(e) => setDraft({ ...draft, number: e.target.value })} />
              </Field>
              <Field label="Issue date">
                <input type="date" className="input-base" value={draft.issueDate || ''}
                  onChange={(e) => setDraft({ ...draft, issueDate: e.target.value })} />
              </Field>
              <Field label="Due date">
                <input type="date" className="input-base" value={draft.dueDate || ''}
                  onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })} />
              </Field>
              <Field label="Expected delivery date">
                <input type="date" className="input-base" value={draft.expectedDeliveryDate || ''}
                  onChange={(e) => setDraft({ ...draft, expectedDeliveryDate: e.target.value })} />
              </Field>
              <Field label="Status">
                <select className="input-base" value={draft.status}
                  onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
                  <option value="draft">Draft</option>
                  <option value="sent">Sent</option>
                  <option value="paid">Paid</option>
                  <option value="overdue">Overdue</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </Field>
              <Field label="Place of supply">
                <select className="input-base" value={draft.placeOfSupply}
                  onChange={(e) => setStateBy(e.target.value)}>
                  <option value="">— select —</option>
                  {INDIAN_STATES.map((s) => <option key={s.code} value={s.name}>{s.name}</option>)}
                </select>
              </Field>
            </div>

            {/* Optional links to PO / DC */}
            <div className="mt-4 grid sm:grid-cols-2 gap-4">
              <Field label="Linked PO (optional)">
                <select className="input-base" value={draft.purchaseOrderId}
                  onChange={(e) => importFromPO(e.target.value)} disabled={!customerPOs.length}>
                  <option value="">— none —</option>
                  {customerPOs.map((po) => <option key={po.id} value={po.id}>{po.number}</option>)}
                </select>
              </Field>
              <Field label="Linked DC (optional)">
                <select className="input-base" value={draft.deliveryChallanId}
                  onChange={(e) => setDraft({ ...draft, deliveryChallanId: e.target.value })}
                  disabled={!customerDCs.length}>
                  <option value="">— none —</option>
                  {customerDCs.map((dc) => <option key={dc.id} value={dc.id}>{dc.number}</option>)}
                </select>
              </Field>
            </div>

            {/* GST type toggle */}
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
              {branch && customerBranch && branch.stateCode && customerBranch.stateCode && (
                <div className="text-xs text-mute mt-2">
                  Detected: branch in {branch.state} → customer in {customerBranch.state} —
                  {branch.stateCode === customerBranch.stateCode ? ' intra-state' : ' inter-state'}
                </div>
              )}
            </div>
          </div>

          {/* Line items */}
          <div className="card p-5 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-lg tracking-tightest">Items</h2>
              <button onClick={addItem} className="btn-outline text-xs">+ Add line</button>
            </div>

            <div className="space-y-3">
              {draft.items.map((it, idx) => {
                const lineGst = calcItemGst(it, draft.gstType)
                return (
                  <div key={it.id} className="border hairline rounded-xl p-3 bg-mist/30">
                    {/* Top row: product + description */}
                    <div className="grid grid-cols-12 gap-3 items-start">
                      <div className="col-span-12 md:col-span-7">
                        <select className="input-base mb-2" value={it.productId}
                          onChange={(e) => pickProduct(it.id, e.target.value)}>
                          <option value="">— pick from catalog —</option>
                          {data.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        <input className="input-base" placeholder="Description" value={it.description}
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

                    {/* Bottom row: qty, unit, rate, gst, amount */}
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

          {/* Logistics + sign-off */}
          <div className="card p-5 md:p-6">
            <h2 className="font-display font-semibold text-lg tracking-tightest mb-4">Logistics &amp; sign-off</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Field label="Delivery mode">
                <input className="input-base" value={draft.deliveryMode}
                  onChange={(e) => setDraft({ ...draft, deliveryMode: e.target.value })}
                  placeholder="By road / Courier" />
              </Field>
              <Field label="Vehicle number">
                <input className="input-base font-mono uppercase" value={draft.vehicleNumber}
                  onChange={(e) => setDraft({ ...draft, vehicleNumber: e.target.value.toUpperCase() })}
                  placeholder="TN 09 AB 1234" />
              </Field>
              <Field label="LR number">
                <input className="input-base font-mono" value={draft.lrNumber}
                  onChange={(e) => setDraft({ ...draft, lrNumber: e.target.value })} />
              </Field>
              <Field label="LR date">
                <input type="date" className="input-base" value={draft.lrDate || ''}
                  onChange={(e) => setDraft({ ...draft, lrDate: e.target.value })} />
              </Field>
              <Field label="Signing authority">
                <input className="input-base" value={draft.signingAuthority}
                  onChange={(e) => setDraft({ ...draft, signingAuthority: e.target.value })}
                  placeholder="Authorised Signatory" />
              </Field>
            </div>
          </div>

          {/* Notes + T&C */}
          <div className="card p-5 md:p-6">
            <Field label="Notes">
              <textarea rows={3} className="input-base resize-none" value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                placeholder="Notes for the customer…" />
            </Field>
            <div className="mt-4">
              <Field label="Terms & Conditions">
                <textarea rows={4} className="input-base resize-none" value={draft.termsAndConditions}
                  onChange={(e) => setDraft({ ...draft, termsAndConditions: e.target.value })} />
              </Field>
            </div>
          </div>
        </div>

        {/* Sticky summary */}
        <div className="lg:col-span-1">
          <div className="card p-5 md:p-6 lg:sticky lg:top-6">
            <h2 className="font-display font-semibold text-lg tracking-tightest mb-4">Summary</h2>

            <div className="space-y-2.5 text-sm">
              <Row label="Subtotal" value={fmtMoney(totals.subtotal, cur)} />

              {/* GST breakdown */}
              {draft.gstType === 'intra' ? (
                <>
                  <Row label="CGST" value={fmtMoney(totals.cgst, cur)} />
                  <Row label="SGST" value={fmtMoney(totals.sgst, cur)} />
                </>
              ) : (
                <Row label="IGST" value={fmtMoney(totals.igst, cur)} />
              )}

              {/* Per-rate breakdown */}
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
