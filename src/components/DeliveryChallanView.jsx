import { useRef, useState } from 'react'
import { fmtDate, statusMeta } from '../utils'
import { StatusPill } from './ui'
import { downloadElementAsPdf } from '../pdf'

export default function DeliveryChallanView({ data, dcId, onNav }) {
  const dc = data.deliveryChallans.find((d) => d.id === dcId)
  const docRef = useRef(null)
  const [pdfBusy, setPdfBusy] = useState(false)

  if (!dc) {
    return (
      <div className="card p-10 text-center">
        <p className="text-ash">Delivery Challan not found.</p>
        <button onClick={() => onNav('delivery-challans')} className="btn-primary mt-4">Back to DCs</button>
      </div>
    )
  }

  const customer = data.customers.find((c) => c.id === dc.customerId)
  const customerBranch = data.customerBranches.find((b) => b.id === dc.customerBranchId)
  const linkedPO = data.purchaseOrders.find((p) => p.id === dc.purchaseOrderId)
  const branch = data.branches.find((b) => b.is_default) || data.branches[0]
  const { company } = data

  // Effective From details
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

  const downloadPdf = async () => {
    setPdfBusy(true)
    try {
      const fname = `${dc.number || 'DC'}_${(toName || 'Customer').replace(/[^A-Za-z0-9_-]+/g, '_')}.pdf`
      await downloadElementAsPdf(docRef.current, fname)
    } catch (e) {
      alert('Could not generate PDF: ' + e.message)
    } finally {
      setPdfBusy(false)
    }
  }

  const hasLogistics = dc.deliveryMode || dc.vehicleNumber || dc.lrNumber || dc.lrDate

  return (
    <div>
      {/* Toolbar */}
      <div className="no-print flex items-center justify-between gap-3 flex-wrap mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => onNav('delivery-challans')} className="btn-ghost">← Back</button>
          <StatusPill status={dc.status} statusMeta={statusMeta} />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => onNav('dc-edit', dc.id)} className="btn-outline">Edit</button>
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
              DELIVERY CHALLAN
            </div>
            <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '14px', marginTop: '4px', color: '#0B2845', fontWeight: 600 }}>
              {dc.number}
            </div>
            <div style={{ fontSize: '10px', color: '#7B8A9A', marginTop: '4px' }}>
              Date: {fmtDate(dc.dcDate)}
            </div>
            <div style={{ fontSize: '9.5px', color: '#7B8A9A', marginTop: '6px', fontStyle: 'italic' }}>
              Not a tax invoice
            </div>
          </div>
        </div>

        {/* To + meta */}
        <div style={{ display: 'flex', gap: '32px', marginTop: '20px' }}>
          <div style={{ flex: '1 1 50%' }}>
            <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.2em', color: '#7B8A9A', marginBottom: '6px' }}>
              Deliver to
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
            <MetaRow label="DC #" value={dc.number} />
            <MetaRow label="DC date" value={fmtDate(dc.dcDate)} />
            <MetaRow label="Status" value={dc.status?.toUpperCase() || '—'} />
            {linkedPO && <MetaRow label="Against PO" value={`${linkedPO.number} · ${fmtDate(linkedPO.poDate)}`} />}
          </div>
        </div>

        {/* Logistics block — prominently displayed for DCs */}
        {hasLogistics && (
          <div style={{
            marginTop: '20px',
            background: '#F5F8FB',
            border: '1px solid #E5EBF2',
            borderRadius: '8px',
            padding: '14px 16px',
          }}>
            <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.2em', color: '#7B8A9A', marginBottom: '8px' }}>
              Logistics
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px 24px', fontSize: '10.5px' }}>
              {dc.deliveryMode && <LogisticsItem label="Delivery mode" value={dc.deliveryMode} />}
              {dc.vehicleNumber && <LogisticsItem label="Vehicle number" value={dc.vehicleNumber} mono />}
              {dc.lrNumber && <LogisticsItem label="LR / Docket #" value={dc.lrNumber} mono />}
              {dc.lrDate && <LogisticsItem label="LR date" value={fmtDate(dc.lrDate)} />}
            </div>
          </div>
        )}

        {/* Items table */}
        <div style={{ marginTop: '24px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: '10.5px' }}>
            <colgroup>
              <col style={{ width: '6%' }} />
              <col style={{ width: '74%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '10%' }} />
            </colgroup>
            <thead>
              <tr style={{ borderBottom: '2px solid rgba(11,40,69,0.18)' }}>
                <Th>#</Th>
                <Th align="left">Description</Th>
                <Th align="right">Qty</Th>
                <Th align="left">Unit</Th>
              </tr>
            </thead>
            <tbody>
              {(dc.items || []).map((it, idx) => (
                <tr key={it.id} style={{ borderBottom: '1px solid #E5EBF2', verticalAlign: 'top' }}>
                  <Td color="#7B8A9A">{idx + 1}</Td>
                  <Td align="left" style={{ wordBreak: 'break-word' }}>
                    {it.description || <span style={{ fontStyle: 'italic', color: '#7B8A9A' }}>No description</span>}
                  </Td>
                  <Td align="right" bold>{Number(it.quantity) || 0}</Td>
                  <Td align="left">{it.unit || '—'}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Notes */}
        {dc.notes && (
          <div style={{
            marginTop: '24px',
            paddingTop: '16px',
            borderTop: '1px solid #E5EBF2',
            pageBreakInside: 'avoid',
            breakInside: 'avoid',
          }}>
            <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.2em', color: '#7B8A9A', marginBottom: '4px' }}>
              Notes
            </div>
            <p style={{ fontSize: '10px', color: '#3B4A5C', lineHeight: 1.55, whiteSpace: 'pre-line', margin: 0 }}>
              {dc.notes}
            </p>
          </div>
        )}

        {/* Acknowledgement + sign-off */}
        <div style={{
          marginTop: '40px',
          paddingTop: '16px',
          borderTop: '1px solid #E5EBF2',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          pageBreakInside: 'avoid',
          breakInside: 'avoid',
        }}>
          {/* Receiver acknowledgement */}
          <div style={{ flex: '0 0 45%' }}>
            <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.2em', color: '#7B8A9A' }}>
              Received by (with seal)
            </div>
            <div style={{
              marginTop: '50px',
              paddingTop: '4px',
              borderTop: '1px solid #C5D2E2',
              fontSize: '10px',
              color: '#7B8A9A',
            }}>
              Name &amp; signature
            </div>
          </div>

          {/* Sender sign-off */}
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

function LogisticsItem({ label, value, mono }) {
  return (
    <div>
      <div style={{ fontSize: '9px', color: '#7B8A9A', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '1px' }}>
        {label}
      </div>
      <div style={{
        fontFamily: mono ? '"JetBrains Mono", monospace' : 'inherit',
        fontWeight: 600,
        fontSize: mono ? '11px' : '11.5px',
        color: '#0B2845',
      }}>
        {value}
      </div>
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
