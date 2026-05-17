/**
 * GST return JSON generators.
 * All functions accept the full `data` object (same shape as other components),
 * a branchId string, and a filing period in MMYYYY format (e.g. "042025").
 *
 * Output JSONs match the GSTN offline tool schema and can be uploaded directly
 * to the GST portal (gst.gov.in → Returns → Offline Tools).
 */

import { calcInvoice, calcItemGst } from './utils'
import { INDIAN_STATES } from './constants'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100

const fmtGSTDate = (iso) => {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}-${m}-${y}`
}

const STATE_CODE = INDIAN_STATES.reduce((acc, s) => {
  acc[s.name] = s.code
  return acc
}, {})
const getStateCode = (stateName) => STATE_CODE[stateName] || ''

// Maps app UNITS to GSTN UQC codes
const UQC_MAP = {
  Nos: 'NOS', Pcs: 'NOS', Kg: 'KGS', g: 'GMS',
  Ltr: 'LTR', mL: 'MLT', Hrs: 'OTH', Days: 'OTH',
  Mtr: 'MTR', Sqft: 'SQF', Box: 'BOX', Set: 'SET',
}
const toUQC = (unit) => UQC_MAP[unit] || 'OTH'

/** Convert <input type="month"> value (YYYY-MM) to GSTN filing period (MMYYYY). */
export const toFilingPeriod = (yyyymm) => {
  const [y, m] = yyyymm.split('-')
  return m + y
}

/** Build GSTN itms array from invoice line items (works for both intra & inter). */
function buildItms(inv) {
  const rateMap = {}
  for (const item of inv.items || []) {
    const rt = String(Number(item.gstRate) || 0)
    if (!rateMap[rt]) rateMap[rt] = { rt: Number(rt), txval: 0, iamt: 0, camt: 0, samt: 0 }
    const g = calcItemGst(item, inv.gstType)
    rateMap[rt].txval += g.taxable
    rateMap[rt].iamt += g.igst
    rateMap[rt].camt += g.cgst
    rateMap[rt].samt += g.sgst
  }
  return Object.values(rateMap).map((v, idx) => ({
    num: idx + 1,
    itm_det: { rt: v.rt, txval: r2(v.txval), iamt: r2(v.iamt), camt: r2(v.camt), samt: r2(v.samt), csamt: 0 },
  }))
}

/** B2CL itms — always inter-state, so only iamt (no camt/samt). */
function buildB2CLItms(inv) {
  const rateMap = {}
  for (const item of inv.items || []) {
    const rt = String(Number(item.gstRate) || 0)
    if (!rateMap[rt]) rateMap[rt] = { rt: Number(rt), txval: 0, iamt: 0 }
    const g = calcItemGst(item, 'inter')
    rateMap[rt].txval += g.taxable
    rateMap[rt].iamt += g.igst
  }
  return Object.values(rateMap).map((v, idx) => ({
    num: idx + 1,
    itm_det: { rt: v.rt, txval: r2(v.txval), iamt: r2(v.iamt), csamt: 0 },
  }))
}

/** Filter invoices by branch + filing month, excluding draft & cancelled. */
function filterEligible(data, branchId, period) {
  const mm = parseInt(period.slice(0, 2), 10)
  const yyyy = parseInt(period.slice(2), 10)
  return data.invoices.filter((inv) => {
    if (inv.branchId !== branchId) return false
    if (inv.status === 'draft' || inv.status === 'cancelled') return false
    if (!inv.issueDate) return false
    const d = new Date(inv.issueDate)
    return d.getMonth() + 1 === mm && d.getFullYear() === yyyy
  })
}

/** Resolve customer GSTIN for an invoice (branch GSTIN takes priority). */
function resolveCustomerGSTIN(inv, data) {
  const cb = data.customerBranches.find((b) => b.id === inv.customerBranchId)
  const cust = data.customers.find((c) => c.id === inv.customerId)
  return cb?.gstin || cust?.gstin || ''
}

/** Build HSN/SAC summary rows from a list of eligible invoices. */
function buildHSNData(invoices) {
  const hsnMap = {}
  for (const inv of invoices) {
    for (const item of inv.items || []) {
      if (!item.hsnCode) continue
      const key = `${item.hsnCode}||${item.unit}`
      if (!hsnMap[key]) {
        hsnMap[key] = { hsn_sc: item.hsnCode, uqc: toUQC(item.unit), qty: 0, txval: 0, iamt: 0, camt: 0, samt: 0 }
      }
      const g = calcItemGst(item, inv.gstType)
      hsnMap[key].qty += Number(item.quantity) || 0
      hsnMap[key].txval += g.taxable
      hsnMap[key].iamt += g.igst
      hsnMap[key].camt += g.cgst
      hsnMap[key].samt += g.sgst
    }
  }
  return Object.values(hsnMap).map((h, idx) => ({
    num: idx + 1,
    hsn_sc: h.hsn_sc,
    uqc: h.uqc,
    qty: r2(h.qty),
    val: r2(h.txval + h.iamt + h.camt + h.samt),
    txval: r2(h.txval),
    iamt: r2(h.iamt),
    camt: r2(h.camt),
    samt: r2(h.samt),
    csamt: 0,
  }))
}

// ─── Public generators ────────────────────────────────────────────────────────

/**
 * GSTR-1: Monthly/quarterly return of outward supplies.
 * Sections generated: B2B, B2CL, B2CS, CDNR (empty), HSN, doc_issue (empty).
 */
export function generateGSTR1(data, branchId, period) {
  const branch = data.branches.find((b) => b.id === branchId)
  if (!branch?.gstin) throw new Error('Selected branch must have a GSTIN to generate GSTR-1.')

  const eligible = filterEligible(data, branchId, period)

  // ── B2B (registered buyers with GSTIN) ──────────────────────────────────
  const b2bMap = {}
  for (const inv of eligible) {
    const gstin = resolveCustomerGSTIN(inv, data)
    if (!gstin) continue
    if (!b2bMap[gstin]) b2bMap[gstin] = []
    b2bMap[gstin].push(inv)
  }
  const b2b = Object.entries(b2bMap).map(([ctin, invs]) => ({
    ctin,
    inv: invs.map((inv) => ({
      inum: inv.number,
      idt: fmtGSTDate(inv.issueDate),
      val: r2(calcInvoice(inv).total),
      pos: getStateCode(inv.placeOfSupply),
      rchrg: 'N',
      inv_typ: 'R',
      itms: buildItms(inv),
    })),
  }))

  // ── B2CL (inter-state, unregistered, invoice value > ₹2.5L) ─────────────
  // ── B2CS (all other unregistered — aggregated by rate + state) ──────────
  const b2clMap = {}
  const b2csMap = {}

  for (const inv of eligible) {
    if (resolveCustomerGSTIN(inv, data)) continue // skip registered
    const t = calcInvoice(inv)
    const pos = getStateCode(inv.placeOfSupply)
    const isInter = inv.gstType === 'inter'

    if (isInter && t.total > 250000) {
      // B2CL: listed individually, grouped by state
      if (!b2clMap[pos]) b2clMap[pos] = []
      b2clMap[pos].push(inv)
    } else {
      // B2CS: aggregate by supply type + state + rate
      for (const item of inv.items || []) {
        const rt = String(Number(item.gstRate) || 0)
        const splyTp = isInter ? 'INTER' : 'INTRA'
        const key = `${splyTp}|${pos}|${rt}`
        if (!b2csMap[key]) {
          b2csMap[key] = { sply_tp: splyTp, pos, rt: Number(rt), txval: 0, iamt: 0, camt: 0, samt: 0 }
        }
        const g = calcItemGst(item, inv.gstType)
        b2csMap[key].txval += g.taxable
        b2csMap[key].iamt += g.igst
        b2csMap[key].camt += g.cgst
        b2csMap[key].samt += g.sgst
      }
    }
  }

  const b2cl = Object.entries(b2clMap).map(([pos, invs]) => ({
    pos,
    inv: invs.map((inv) => ({
      inum: inv.number,
      idt: fmtGSTDate(inv.issueDate),
      val: r2(calcInvoice(inv).total),
      itms: buildB2CLItms(inv),
    })),
  }))

  const b2cs = Object.values(b2csMap).map((e) => ({
    sply_tp: e.sply_tp,
    pos: e.pos,
    typ: 'OE',
    rt: e.rt,
    txval: r2(e.txval),
    iamt: r2(e.iamt),
    camt: r2(e.camt),
    samt: r2(e.samt),
    csamt: 0,
  }))

  return {
    version: 'GST3.0.4',
    hash: 'hash',
    gstin: branch.gstin,
    fp: period,
    b2b,
    b2cl,
    b2cs,
    cdnr: [],
    cdnur: [],
    exp: [],
    nil: { inv: [] },
    hsn: { data: buildHSNData(eligible) },
    doc_issue: { doc_det: [] },
  }
}

/**
 * GSTR-3B: Monthly summary return.
 * Section 3.1 (outward supplies) is filled from invoices.
 * ITC (section 4) and inward supplies are zeroed — purchase tracking not in app.
 */
export function generateGSTR3B(data, branchId, period) {
  const branch = data.branches.find((b) => b.id === branchId)
  if (!branch?.gstin) throw new Error('Selected branch must have a GSTIN to generate GSTR-3B.')

  const eligible = filterEligible(data, branchId, period)

  let txval = 0, iamt = 0, camt = 0, samt = 0
  const interUnregMap = {} // 3.2 — inter-state supplies to unregistered

  for (const inv of eligible) {
    const t = calcInvoice(inv)
    txval += t.subtotal
    iamt += t.igst
    camt += t.cgst
    samt += t.sgst

    const gstin = resolveCustomerGSTIN(inv, data)
    if (!gstin && inv.gstType === 'inter') {
      const pos = getStateCode(inv.placeOfSupply)
      if (pos) {
        if (!interUnregMap[pos]) interUnregMap[pos] = { pos, txval: 0, iamt: 0 }
        interUnregMap[pos].txval += t.subtotal
        interUnregMap[pos].iamt += t.igst
      }
    }
  }

  return {
    gstin: branch.gstin,
    ret_period: period,
    sup_details: {
      osup_det: { txval: r2(txval), iamt: r2(iamt), camt: r2(camt), samt: r2(samt), csamt: 0 },
      osup_zero: { txval: 0, iamt: 0, csamt: 0 },
      osup_nil_exmp: { txval: 0 },
      isup_rev: { txval: 0, iamt: 0, camt: 0, samt: 0, csamt: 0 },
      osup_nongst: { txval: 0 },
    },
    inter_sup: {
      unreg_details: Object.values(interUnregMap).map((e) => ({
        pos: e.pos,
        txval: r2(e.txval),
        iamt: r2(e.iamt),
      })),
      comp_details: [],
      uin_details: [],
    },
    itc_elg: {
      itc_avl: [
        { ty: 'IMPG', iamt: 0, camt: 0, samt: 0, csamt: 0 },
        { ty: 'IMPS', iamt: 0, camt: 0, samt: 0, csamt: 0 },
        { ty: 'ISRC', iamt: 0, camt: 0, samt: 0, csamt: 0 },
        { ty: 'ISD', iamt: 0, camt: 0, samt: 0, csamt: 0 },
        { ty: 'OTH', iamt: 0, camt: 0, samt: 0, csamt: 0 },
      ],
      itc_rev: [
        { ty: 'RUL', iamt: 0, camt: 0, samt: 0, csamt: 0 },
        { ty: 'OTH', iamt: 0, camt: 0, samt: 0, csamt: 0 },
      ],
      itc_net: { iamt: 0, camt: 0, samt: 0, csamt: 0 },
      itc_inelg: [
        { ty: 'RUL', iamt: 0, camt: 0, samt: 0, csamt: 0 },
        { ty: 'OTH', iamt: 0, camt: 0, samt: 0, csamt: 0 },
      ],
    },
    inward_sup: {
      isup_details: [
        { ty: 'GST', inter: 0, intra: 0 },
        { ty: 'NONGST', inter: 0, intra: 0 },
      ],
    },
    intr_ltfee: {
      intr_details: { iamt: 0, camt: 0, samt: 0, csamt: 0 },
    },
  }
}

/**
 * Standalone HSN/SAC summary JSON.
 * Can be used to fill Table 12 of GSTR-1 offline tool separately.
 */
export function generateHSNSummary(data, branchId, period) {
  const branch = data.branches.find((b) => b.id === branchId)
  if (!branch?.gstin) throw new Error('Selected branch must have a GSTIN.')
  const eligible = filterEligible(data, branchId, period)
  return {
    gstin: branch.gstin,
    fp: period,
    hsn: { data: buildHSNData(eligible) },
  }
}

/**
 * Display-oriented summary for GSTR-1 preview.
 * Returns plain JS objects suited for rendering tables — not the GSTN JSON format.
 */
export function summarizeGSTR1(data, branchId, period) {
  const branch = data.branches.find((b) => b.id === branchId)
  if (!branch?.gstin) throw new Error('Selected branch must have a GSTIN.')

  const eligible = filterEligible(data, branchId, period)
  const warnings = []

  const missingPos = eligible.filter((inv) => !inv.placeOfSupply).length
  if (missingPos > 0)
    warnings.push(`${missingPos} invoice(s) have no Place of Supply — state code will be blank in JSON.`)

  const missingHsn = eligible.filter((inv) => (inv.items || []).some((it) => !it.hsnCode)).length
  if (missingHsn > 0)
    warnings.push(`${missingHsn} invoice(s) have line items without HSN/SAC — those lines excluded from HSN table.`)

  // B2B
  const b2bMap = {}
  for (const inv of eligible) {
    const gstin = resolveCustomerGSTIN(inv, data)
    if (!gstin) continue
    const cust = data.customers.find((c) => c.id === inv.customerId)
    if (!b2bMap[gstin])
      b2bMap[gstin] = { gstin, custName: cust?.name || '—', count: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0, invoices: [] }
    const t = calcInvoice(inv)
    b2bMap[gstin].count++
    b2bMap[gstin].taxable += t.subtotal
    b2bMap[gstin].cgst += t.cgst
    b2bMap[gstin].sgst += t.sgst
    b2bMap[gstin].igst += t.igst
    b2bMap[gstin].total += t.total
    b2bMap[gstin].invoices.push({
      number: inv.number, date: inv.issueDate,
      taxable: r2(t.subtotal), cgst: r2(t.cgst), sgst: r2(t.sgst), igst: r2(t.igst), total: r2(t.total),
    })
  }
  const b2b = Object.values(b2bMap).map((e) => ({
    ...e, taxable: r2(e.taxable), cgst: r2(e.cgst), sgst: r2(e.sgst), igst: r2(e.igst), total: r2(e.total),
  }))

  // B2CL + B2CS
  const b2clMap = {}
  const b2csMap = {}
  for (const inv of eligible) {
    if (resolveCustomerGSTIN(inv, data)) continue
    const t = calcInvoice(inv)
    const pos = getStateCode(inv.placeOfSupply)
    const stateName = inv.placeOfSupply || pos || '—'
    const isInter = inv.gstType === 'inter'
    if (isInter && t.total > 250000) {
      if (!b2clMap[pos])
        b2clMap[pos] = { state: stateName, count: 0, taxable: 0, igst: 0, total: 0, invoices: [] }
      b2clMap[pos].count++
      b2clMap[pos].taxable += t.subtotal
      b2clMap[pos].igst += t.igst
      b2clMap[pos].total += t.total
      b2clMap[pos].invoices.push({
        number: inv.number, date: inv.issueDate,
        taxable: r2(t.subtotal), igst: r2(t.igst), total: r2(t.total),
      })
    } else {
      for (const item of inv.items || []) {
        const rt = Number(item.gstRate) || 0
        const splyTp = isInter ? 'INTER' : 'INTRA'
        const key = `${splyTp}|${pos}|${rt}`
        if (!b2csMap[key])
          b2csMap[key] = { splyTp, state: stateName, rate: rt, taxable: 0, cgst: 0, sgst: 0, igst: 0 }
        const g = calcItemGst(item, inv.gstType)
        b2csMap[key].taxable += g.taxable
        b2csMap[key].cgst += g.cgst
        b2csMap[key].sgst += g.sgst
        b2csMap[key].igst += g.igst
      }
    }
  }
  const b2cl = Object.values(b2clMap).map((e) => ({
    ...e, taxable: r2(e.taxable), igst: r2(e.igst), total: r2(e.total),
  }))
  const b2cs = Object.values(b2csMap).map((e) => ({
    ...e, taxable: r2(e.taxable), cgst: r2(e.cgst), sgst: r2(e.sgst), igst: r2(e.igst),
  }))

  // Grand totals + flat invoice list (used by header count drill-down)
  let totTaxable = 0, totCgst = 0, totSgst = 0, totIgst = 0, totTotal = 0
  const allInvoices = []
  for (const inv of eligible) {
    const t = calcInvoice(inv)
    totTaxable += t.subtotal; totCgst += t.cgst; totSgst += t.sgst
    totIgst += t.igst; totTotal += t.total
    const gstin = resolveCustomerGSTIN(inv, data)
    const cust = data.customers.find((c) => c.id === inv.customerId)
    allInvoices.push({
      number: inv.number, date: inv.issueDate,
      customer: cust?.name || '—', gstin,
      taxable: r2(t.subtotal), cgst: r2(t.cgst), sgst: r2(t.sgst), igst: r2(t.igst), total: r2(t.total),
    })
  }

  return {
    branchName: branch.name,
    gstin: branch.gstin,
    period,
    invoiceCount: eligible.length,
    warnings,
    b2b,
    b2cl,
    b2cs,
    hsn: buildHSNData(eligible),
    allInvoices,
    totals: {
      taxable: r2(totTaxable), cgst: r2(totCgst), sgst: r2(totSgst),
      igst: r2(totIgst), total: r2(totTotal),
    },
  }
}

/**
 * Display-oriented summary for GSTR-3B preview.
 */
export function summarizeGSTR3B(data, branchId, period) {
  const branch = data.branches.find((b) => b.id === branchId)
  if (!branch?.gstin) throw new Error('Selected branch must have a GSTIN.')

  const eligible = filterEligible(data, branchId, period)

  let txval = 0, iamt = 0, camt = 0, samt = 0
  const interUnregMap = {}
  const invoices = []

  for (const inv of eligible) {
    const t = calcInvoice(inv)
    txval += t.subtotal; iamt += t.igst; camt += t.cgst; samt += t.sgst

    const gstin = resolveCustomerGSTIN(inv, data)
    const cust = data.customers.find((c) => c.id === inv.customerId)
    invoices.push({
      number: inv.number,
      date: inv.issueDate,
      customer: cust?.name || '—',
      gstin,
      gstType: inv.gstType,
      taxable: r2(t.subtotal),
      cgst: r2(t.cgst),
      sgst: r2(t.sgst),
      igst: r2(t.igst),
      total: r2(t.total),
      status: inv.status,
    })

    if (!gstin && inv.gstType === 'inter') {
      const pos = getStateCode(inv.placeOfSupply)
      if (pos) {
        if (!interUnregMap[pos])
          interUnregMap[pos] = { state: inv.placeOfSupply || pos, txval: 0, iamt: 0 }
        interUnregMap[pos].txval += t.subtotal
        interUnregMap[pos].iamt += t.igst
      }
    }
  }

  return {
    branchName: branch.name,
    gstin: branch.gstin,
    period,
    section31: { txval: r2(txval), iamt: r2(iamt), camt: r2(camt), samt: r2(samt) },
    section32: Object.values(interUnregMap).map((e) => ({ ...e, txval: r2(e.txval), iamt: r2(e.iamt) })),
    invoices,
  }
}

/**
 * Standalone Credit/Debit Notes JSON (CDNR / CDNUR).
 * CDNR = notes issued to registered taxpayers (have GSTIN).
 * CDNUR = notes issued to unregistered buyers.
 */
export function generateCDNR(data, branchId, period) {
  const branch = data.branches.find((b) => b.id === branchId)
  if (!branch?.gstin) throw new Error('Selected branch must have a GSTIN.')

  const mm = parseInt(period.slice(0, 2), 10)
  const yyyy = parseInt(period.slice(2), 10)

  const eligible = (data.creditDebitNotes || []).filter((note) => {
    if (note.branchId !== branchId) return false
    if (note.status === 'draft' || note.status === 'cancelled') return false
    if (!note.noteDate) return false
    const d = new Date(note.noteDate)
    return d.getMonth() + 1 === mm && d.getFullYear() === yyyy
  })

  const resolveGSTIN = (note) => {
    const cb = (data.customerBranches || []).find((b) => b.id === note.customerBranchId)
    const cust = (data.customers || []).find((c) => c.id === note.customerId)
    return cb?.gstin || cust?.gstin || ''
  }

  // CDNR — registered (have GSTIN)
  const cdnrMap = {}
  // CDNUR — unregistered
  const cdnur = []

  for (const note of eligible) {
    const gstin = resolveGSTIN(note)
    const ntty = note.noteType === 'credit' ? 'C' : 'D'
    const totals = calcInvoice(note)
    const pos = getStateCode(note.placeOfSupply)
    const entry = {
      ntty,
      nt_num: note.number,
      nt_dt: fmtGSTDate(note.noteDate),
      val: r2(totals.total),
      pos,
      rchrg: 'N',
      inv_typ: 'R',
      itms: buildItms(note),
    }
    if (gstin) {
      if (!cdnrMap[gstin]) cdnrMap[gstin] = []
      cdnrMap[gstin].push(entry)
    } else {
      cdnur.push({ typ: totals.total > 250000 ? 'B2CL' : 'OE', ...entry })
    }
  }

  const cdnr = Object.entries(cdnrMap).map(([ctin, nt]) => ({ ctin, nt }))

  return {
    version: 'GST3.0.4',
    hash: 'hash',
    gstin: branch.gstin,
    fp: period,
    cdnr,
    cdnur,
  }
}
