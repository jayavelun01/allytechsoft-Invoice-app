import { useRef, useState, useMemo } from 'react'
import { fmtMoney, fmtDate, statusMeta } from '../utils'
import { StatusPill } from './ui'
import { downloadElementAsPdf } from '../pdf'

export default function PurchaseOrderView({ data, poId, onNav }) {
  const po = data.purchaseOrders.find((p) => p.id === poId)
  const docRef = useRef(null)
  const [pdfBusy, setPdfBusy] = useState(false)

  if (!po) {
    return (
      <div className="card p-10 text-center">
        <p className="text-ash">Purchase Order not found.</p>
        <button onClick={() => onNav('purchase-orders')} className="btn-primary mt-4">Back to POs</button>
      </div>
    )
  }

  const customer = data.customers.find((c) => c.id === po.customerId)
  const customerBranch = data.customerBranches.find((b) => b.id === po.customerBranchId)
  const branch = data.branches.find((b) => b.is_default) || data.branches[0]
  const { company, settings } = data

  // Effective From details (default branch overrides company)
  const fromName = branch?.name || company.name || 'Company'
  const fromAddress = branch?.address || company.address || ''
  const fromGstin = branch?.gstin || ''
  const fromState = branch?.state || ''
  const fromEmail = branch?.email || company.email || ''
  const fromPhone = branch?.phone || company.phone || ''

  // Effective To details
  const toName = customer?.name || ''
  const toAddress = customerBranch?.address || customer?.address || ''
  const toGstin = customerBranch?.gstin || customer?.gstin || ''
  const toState = customerBranch?.state || ''
  const toContact = customerBranch?.contactPerson || customer?.contactPerson || ''
  const toEmail = customerBranch?.email || customer?.email || ''
  const toPhone = customerBranch?.phone || customer?.phone || ''

  const total = useMemo(
    () => (po.items || []).reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.rate) || 0), 0),
    [po.items],
  )

  const downloadPdf = async () => {
    setPdfBusy(true)
    try {
      const fname = `${po.number || 'PO'}_${(toName || 'Customer').replace(/[^A-Za-z0-9_-]+/g, '_')}.pdf`
      await downloadElementAsPdf(docRef.current, fname)
    } catch (e) {
      alert('Could not generate PDF: ' + e.message)
    } finally {
      setPdfBusy(false)
    }
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="no-print flex items-center justify-between gap-3 flex-wrap mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => onNav('purchase-orders')} className="btn-ghost">← Back</button>
          <StatusPill status={po.status} statusMeta={statusMeta} />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => onNav('po-edit', po.id)} className="btn-outline">Edit</button>
          <button onClick={() => window.print()} className="btn-outline">Print</button>
          <button onClick={downloadPdf} disabled={pdfBusy} className="btn-outline">
            {pdfBusy ? 'Generating…' : '↓ PDF'}
          </button>
        </div>
      </div>

      {/* Document */}
      <div
        ref={docRef}
        className="invoice-doc bg-white mx-auto"
        style={{
          width: '840px',
          maxWidth: '100%',
          padding: '40px 44px',
          color: '#0B2845',
          fontFamily: '"Manrope", -apple-system, "Segoe UI", sans-serif',
          fontSize: '11px',
          lineHeight: 1.5,
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          borderRadius: '12px',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '24px', borderBottom: '2px solid rgba(11,40,69,0.18)', paddingBottom: '20px' }}>
          <div style={{ flex: '1 1 auto' }}>
            <div style={{ fontFamily: '"Syne", sans-serif', fontWeight: 700, fontSize: '22px', letterSpacing: '-0.02em', color: '#0B2845', marginBottom: '6px' }}>
              {fromName}
            </div>
            {fromAddress && (
              <div style={{ fontSize: '10.5px', color: '#3B4A5C', whiteSpace: 'pre-line', lineHeight: 1.45 }}>
                {fromAddress}
              </div>
            )}
            {fromState && <div style={{ fontSize: '10.5px', color: '#3B4A5C', marginTop: '2px' }}>{fromState}</div>}
            {(fromEmail || fromPhone) && (
              <div style={{ fontSize: '10.5px', color: '#3B4A5C', marginTop: '4px' }}>
                {fromEmail}{fromEmail && fromPhone ? ' · ' : ''}{fromPhone}
              </div>
            )}
            {fromGstin && (
              <div style={{ fontSize: '10.5px', marginTop: '6px' }}>
                <span style={{ fontFamily: '"JetBrains Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#7B8A9A', fontSize: '9.5px' }}>GSTIN: </span>
                <span style={{ fontFamily: '"JetBrains Mono", monospace', color: '#0B2845', fontWeight: 600 }}>{fromGstin}</span>
              </div>
            )}
          </div>

          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontFamily: '"Syne", sans-serif', fontWeight: 700, fontSize: '22px', letterSpacing: '-0.02em', color: '#1E5FA5' }}>
              PURCHASE ORDER
            </div>
            <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '14px', marginTop: '4px', color: '#0B2845', fontWeight: 600 }}>
              {po.number}
            </div>
            <div style={{ fontSize: '10px', color: '#7B8A9A', marginTop: '4px' }}>
              Date: {fmtDate(po.poDate)}
            </div>
          </div>
        </div>

        {/* To + meta */}
        <div style={{ display: 'flex', gap: '32px', marginTop: '20px' }}>
          <div style={{ flex: '1 1 50%' }}>
            <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.2em', color: '#7B8A9A', marginBottom: '6px' }}>
              Customer
            </div>
            <div style={{ fontFamily: '"Syne", sans-serif', fontWeight: 600, fontSize: '15px', letterSpacing: '-0.01em', color: '#0B2845' }}>
              {toName || '—'}
            </div>
            {customerBranch?.name && <div style={{ fontSize: '10.5px', color: '#3B4A5C', marginTop: '1px' }}>{customerBranch.name}</div>}
            {toContact && <div style={{ fontSize: '10.5px', color: '#3B4A5C', marginTop: '1px' }}>Attn: {toContact}</div>}
            {toAddress && <div style={{ fontSize: '10.5px', color: '#3B4A5C', marginTop: '4px', whiteSpace: 'pre-line', lineHeight: 1.45 }}>{toAddress}</div>}
            {toState && <div style={{ fontSize: '10.5px', color: '#3B4A5C' }}>{toState}</div>}
            {toEmail && <div style={{ fontSize: '10.5px', color: '#3B4A5C', marginTop: '3px' }}>{toEmail}</div>}
            {toPhone && <div style={{ fontSize: '10.5px', color: '#3B4A5C' }}>{toPhone}</div>}
            {toGstin && (
              <div style={{ fontSize: '10.5px', marginTop: '6px' }}>
                <span style={{ fontFamily: '"JetBrains Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#7B8A9A', fontSize: '9.5px' }}>GSTIN: </span>
                <span style={{ fontFamily: '"JetBrains Mono", monospace', color: '#0B2845', fontWeight: 600 }}>{toGstin}</span>
              </div>
            )}
          </div>

          <div style={{ flex: '1 1 50%', fontSize: '10.5px' }}>
            <MetaRow label="PO #" value={po.number} />
            <MetaRow label="PO date" value={fmtDate(po.poDate)} />
            <MetaRow label="Status" value={po.status?.toUpperCase() || '—'} />
            <MetaRow label="Items" value={String((po.items || []).length)} />
          </div>
        </div>

        {/* Items table */}
        <div style={{ marginTop: '24px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: '10.5px' }}>
            <colgroup>
              <col style={{ width: '5%' }} />
              <col style={{ width: '52%' }} />
              <col style={{ width: '11%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '12%' }} />
            </colgroup>
            <thead>
              <tr style={{ borderBottom: '2px solid rgba(11,40,69,0.18)' }}>
                <Th>#</Th>
                <Th align="left">Description</Th>
                <Th align="right">Qty</Th>
                <Th align="left">Unit</Th>
                <Th align="right">Rate</Th>
                <Th align="right">Amount</Th>
              </tr>
            </thead>
            <tbody>
              {(po.items || []).map((it, idx) => {
                const amt = (Number(it.quantity) || 0) * (Number(it.rate) || 0)
                return (
                  <tr key={it.id} style={{ borderBottom: '1px solid #E5EBF2', verticalAlign: 'top' }}>
                    <Td color="#7B8A9A">{idx + 1}</Td>
                    <Td align="left" style={{ wordBreak: 'break-word' }}>
                      {it.description || <span style={{ fontStyle: 'italic', color: '#7B8A9A' }}>No description</span>}
                    </Td>
                    <Td align="right">{Number(it.quantity) || 0}</Td>
                    <Td align="left">{it.unit || '—'}</Td>
                    <Td align="right">{fmtMoney(it.rate, settings.currency)}</Td>
                    <Td align="right" bold>{fmtMoney(amt, settings.currency)}</Td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div style={{ marginTop: '20px', display: 'flex', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
          <div style={{ flex: '1 1 auto', maxWidth: '300px', minWidth: '260px', marginLeft: 'auto' }}>
            <div style={{
              paddingTop: '8px',
              borderTop: '2px solid rgba(11,40,69,0.18)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
            }}>
              <span style={{ fontFamily: '"Syne", sans-serif', fontWeight: 600, fontSize: '13px' }}>Total</span>
              <span style={{
                fontFamily: '"Syne", sans-serif',
                fontWeight: 700,
                fontSize: '20px',
                letterSpacing: '-0.02em',
                color: '#1E5FA5',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {fmtMoney(total, settings.currency)}
              </span>
            </div>
            <div style={{ fontSize: '9.5px', color: '#7B8A9A', marginTop: '6px', textAlign: 'right', fontStyle: 'italic' }}>
              GST will be applicable on the resulting tax invoice.
            </div>
          </div>
        </div>

        {/* Notes */}
        {po.notes && (
          <div style={{
            marginTop: '28px',
            paddingTop: '16px',
            borderTop: '1px solid #E5EBF2',
            pageBreakInside: 'avoid',
            breakInside: 'avoid',
          }}>
            <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.2em', color: '#7B8A9A', marginBottom: '4px' }}>
              Notes
            </div>
            <p style={{ fontSize: '10px', color: '#3B4A5C', lineHeight: 1.55, whiteSpace: 'pre-line', margin: 0 }}>
              {po.notes}
            </p>
          </div>
        )}

        {/* Sign-off */}
        <div style={{
          marginTop: '32px',
          paddingTop: '16px',
          borderTop: '1px solid #E5EBF2',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          pageBreakInside: 'avoid',
          breakInside: 'avoid',
        }}>
          <div style={{ fontSize: '10px', color: '#7B8A9A' }}>
            This is a Purchase Order. Please confirm receipt.
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.2em', color: '#7B8A9A' }}>
              For {fromName}
            </div>
            <div style={{
              marginTop: '50px',
              paddingTop: '4px',
              borderTop: '1px solid #C5D2E2',
              minWidth: '160px',
              fontSize: '10.5px',
              color: '#0B2845',
            }}>
              {branch?.signingAuthority || 'Authorised Signatory'}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* helpers */

function MetaRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '2px 0' }}>
      <span style={{ color: '#7B8A9A', flexShrink: 0 }}>{label}</span>
      <span style={{ fontWeight: 500, color: '#0B2845', textAlign: 'right' }}>{value}</span>
    </div>
  )
}

function Th({ children, align = 'center' }) {
  return (
    <th style={{
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: '9px',
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      color: '#7B8A9A',
      fontWeight: 500,
      textAlign: align,
      padding: '8px 4px',
    }}>
      {children}
    </th>
  )
}

function Td({ children, align = 'center', bold, color, style }) {
  return (
    <td style={{
      padding: '8px 4px',
      textAlign: align,
      fontWeight: bold ? 600 : 400,
      color: color || 'inherit',
      fontVariantNumeric: 'tabular-nums',
      fontSize: '10.5px',
      ...style,
    }}>
      {children}
    </td>
  )
}
