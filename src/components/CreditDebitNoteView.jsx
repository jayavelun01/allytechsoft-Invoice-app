import { useRef, useState } from 'react'
import { fmtMoney, fmtDate, calcInvoice, calcItemGst, statusMeta } from '../utils'
import { StatusPill } from './ui'
import { downloadElementAsPdf } from '../pdf'

export default function CreditDebitNoteView({ data, noteId, onNav }) {
  const note = (data.creditDebitNotes || []).find((n) => n.id === noteId)
  const docRef = useRef(null)
  const [pdfBusy, setPdfBusy] = useState(false)

  if (!note) {
    return (
      <div className="card p-10 text-center">
        <p className="text-ash">Note not found.</p>
        <button onClick={() => onNav('credit-debit-notes')} className="btn-primary mt-4">Back to notes</button>
      </div>
    )
  }

  const isCredit = note.noteType === 'credit'
  const noteLabel = isCredit ? 'CREDIT NOTE' : 'DEBIT NOTE'
  const titleColor = isCredit ? '#1A7F5A' : '#B45309'

  const customer = data.customers.find((c) => c.id === note.customerId)
  const customerBranch = data.customerBranches.find((b) => b.id === note.customerBranchId)
  const branch = data.branches.find((b) => b.id === note.branchId)
  const { company, settings } = data
  const totals = calcInvoice(note)

  const fromName = branch?.name || company.name || 'Company'
  const fromAddress = branch?.address || company.address || ''
  const fromGstin = branch?.gstin || ''
  const fromState = branch?.state || ''
  const fromEmail = branch?.email || company.email || ''
  const fromPhone = branch?.phone || company.phone || ''

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
      const fname = `${note.number || noteLabel}_${(toName || 'Customer').replace(/[^A-Za-z0-9_-]+/g, '_')}.pdf`
      await downloadElementAsPdf(docRef.current, fname)
    } catch (e) { alert('Could not generate PDF: ' + e.message) }
    finally { setPdfBusy(false) }
  }

  return (
    <div>
      <div className="no-print flex items-center justify-between gap-3 flex-wrap mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => onNav('credit-debit-notes')} className="btn-ghost">← Back</button>
          <StatusPill status={note.status} statusMeta={statusMeta} />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => onNav('cdn-edit', note.id)} className="btn-outline">Edit</button>
          <button onClick={() => window.print()} className="btn-outline">Print</button>
          <button onClick={downloadPdf} disabled={pdfBusy} className="btn-outline">
            {pdfBusy ? 'Generating…' : '↓ PDF'}
          </button>
        </div>
      </div>

      <div
        ref={docRef}
        className="invoice-doc bg-white mx-auto"
        style={{
          width: '840px', maxWidth: '100%', padding: '40px 44px', color: '#0B2845',
          fontFamily: '"Manrope", -apple-system, "Segoe UI", sans-serif',
          fontSize: '11px', lineHeight: 1.5,
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)', borderRadius: '12px',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '24px', borderBottom: '2px solid rgba(11,40,69,0.18)', paddingBottom: '20px' }}>
          <div style={{ flex: '1 1 auto' }}>
            <div style={{ fontFamily: '"Syne", sans-serif', fontWeight: 700, fontSize: '22px', letterSpacing: '-0.02em', color: '#0B2845', marginBottom: '6px' }}>{fromName}</div>
            {fromAddress && <div style={{ fontSize: '10.5px', color: '#3B4A5C', whiteSpace: 'pre-line', lineHeight: 1.45 }}>{fromAddress}</div>}
            {fromState && <div style={{ fontSize: '10.5px', color: '#3B4A5C', marginTop: '2px' }}>{fromState}</div>}
            {(fromEmail || fromPhone) && <div style={{ fontSize: '10.5px', color: '#3B4A5C', marginTop: '4px' }}>{fromEmail}{fromEmail && fromPhone ? ' · ' : ''}{fromPhone}</div>}
            {fromGstin && (
              <div style={{ fontSize: '10.5px', marginTop: '6px' }}>
                <span style={{ fontFamily: '"JetBrains Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#7B8A9A', fontSize: '9.5px' }}>GSTIN: </span>
                <span style={{ fontFamily: '"JetBrains Mono", monospace', color: '#0B2845', fontWeight: 600 }}>{fromGstin}</span>
              </div>
            )}
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontFamily: '"Syne", sans-serif', fontWeight: 700, fontSize: '24px', letterSpacing: '-0.02em', color: titleColor }}>{noteLabel}</div>
            <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '14px', marginTop: '4px', color: '#0B2845', fontWeight: 600 }}>{note.number}</div>
            <div style={{ fontSize: '10px', color: '#7B8A9A', marginTop: '4px' }}>Date: {fmtDate(note.noteDate)}</div>
            {note.originalInvoiceNumber && (
              <div style={{ fontSize: '10px', color: '#7B8A9A' }}>Against: {note.originalInvoiceNumber}</div>
            )}
          </div>
        </div>

        {/* Bill To + Meta */}
        <div style={{ display: 'flex', gap: '32px', marginTop: '20px' }}>
          <div style={{ flex: '1 1 50%' }}>
            <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.2em', color: '#7B8A9A', marginBottom: '6px' }}>To</div>
            <div style={{ fontFamily: '"Syne", sans-serif', fontWeight: 600, fontSize: '15px', letterSpacing: '-0.01em', color: '#0B2845' }}>{toName}</div>
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
            {note.reason && <MetaRow label="Reason" value={note.reason} />}
            <MetaRow label="Place of supply" value={note.placeOfSupply || '—'} />
            <MetaRow label="GST type" value={note.gstType === 'inter' ? 'Inter-state (IGST)' : 'Intra-state (CGST + SGST)'} />
          </div>
        </div>

        {/* Items table */}
        <div style={{ marginTop: '24px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: '10px' }}>
            <colgroup>
              <col style={{ width: '3%' }} />
              <col style={{ width: '32%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '6%' }} />
              <col style={{ width: '6%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '6%' }} />
              {note.gstType === 'intra' ? (
                <><col style={{ width: '8%' }} /><col style={{ width: '8%' }} /></>
              ) : (
                <col style={{ width: '8%' }} />
              )}
              <col style={{ width: '11%' }} />
            </colgroup>
            <thead>
              <tr style={{ borderBottom: '2px solid rgba(11,40,69,0.18)' }}>
                <Th>#</Th>
                <Th align="left">Description</Th>
                <Th>HSN</Th>
                <Th align="right">Qty</Th>
                <Th align="left">Unit</Th>
                <Th align="right">Rate</Th>
                <Th align="right">Taxable</Th>
                <Th align="right">GST%</Th>
                {note.gstType === 'intra' ? (
                  <><Th align="right">CGST</Th><Th align="right">SGST</Th></>
                ) : (
                  <Th align="right">IGST</Th>
                )}
                <Th align="right">Total</Th>
              </tr>
            </thead>
            <tbody>
              {note.items.map((it, idx) => {
                const r = calcItemGst(it, note.gstType)
                return (
                  <tr key={it.id} style={{ borderBottom: '1px solid #E5EBF2', verticalAlign: 'top' }}>
                    <Td color="#7B8A9A">{idx + 1}</Td>
                    <Td align="left" style={{ wordBreak: 'break-word' }}>
                      {it.description || <span style={{ fontStyle: 'italic', color: '#7B8A9A' }}>No description</span>}
                    </Td>
                    <Td mono>{it.hsnCode || '—'}</Td>
                    <Td align="right">{Number(it.quantity) || 0}</Td>
                    <Td align="left">{it.unit || '—'}</Td>
                    <Td align="right">{fmtMoney(it.rate, settings.currency)}</Td>
                    <Td align="right">{fmtMoney(r.taxable, settings.currency)}</Td>
                    <Td align="right">{Number(it.gstRate) || 0}%</Td>
                    {note.gstType === 'intra' ? (
                      <><Td align="right">{fmtMoney(r.cgst, settings.currency)}</Td><Td align="right">{fmtMoney(r.sgst, settings.currency)}</Td></>
                    ) : (
                      <Td align="right">{fmtMoney(r.igst, settings.currency)}</Td>
                    )}
                    <Td align="right" bold>{fmtMoney(r.taxable + r.totalTax, settings.currency)}</Td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Totals block */}
        <div style={{ marginTop: '20px', display: 'flex', gap: '20px', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
          {Object.keys(totals.byRate).length > 0 && (
            <div style={{ flex: '1 1 50%', maxWidth: '52%' }}>
              <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.2em', color: '#7B8A9A', marginBottom: '6px' }}>GST summary</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', border: '1px solid #E5EBF2', borderRadius: '4px' }}>
                <thead>
                  <tr style={{ background: '#F5F8FB' }}>
                    <Th align="left">Rate</Th>
                    <Th align="right">Taxable</Th>
                    {note.gstType === 'intra' ? (<><Th align="right">CGST</Th><Th align="right">SGST</Th></>) : (<Th align="right">IGST</Th>)}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(totals.byRate).map(([rate, b]) => (
                    <tr key={rate} style={{ borderTop: '1px solid #E5EBF2' }}>
                      <Td mono align="left">{rate}%</Td>
                      <Td align="right">{fmtMoney(b.taxable, settings.currency)}</Td>
                      {note.gstType === 'intra' ? (<><Td align="right">{fmtMoney(b.cgst, settings.currency)}</Td><Td align="right">{fmtMoney(b.sgst, settings.currency)}</Td></>) : (<Td align="right">{fmtMoney(b.igst, settings.currency)}</Td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div style={{ flex: '1 1 auto', marginLeft: 'auto', maxWidth: '300px', minWidth: '260px' }}>
            <TotalRow label="Subtotal" value={fmtMoney(totals.subtotal, settings.currency)} />
            {note.gstType === 'intra' ? (
              <><TotalRow label="CGST" value={fmtMoney(totals.cgst, settings.currency)} /><TotalRow label="SGST" value={fmtMoney(totals.sgst, settings.currency)} /></>
            ) : (
              <TotalRow label="IGST" value={fmtMoney(totals.igst, settings.currency)} />
            )}
            <TotalRow label="Total GST" value={fmtMoney(totals.totalTax, settings.currency)} />
            {totals.discount > 0 && <TotalRow label="Discount" value={`− ${fmtMoney(totals.discount, settings.currency)}`} />}
            <div style={{ marginTop: '6px', paddingTop: '8px', borderTop: '2px solid rgba(11,40,69,0.18)', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontFamily: '"Syne", sans-serif', fontWeight: 600, fontSize: '13px' }}>Total</span>
              <span style={{ fontFamily: '"Syne", sans-serif', fontWeight: 700, fontSize: '20px', letterSpacing: '-0.02em', color: titleColor, fontVariantNumeric: 'tabular-nums' }}>
                {fmtMoney(totals.total, settings.currency)}
              </span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {note.notes && (
          <div style={{ marginTop: '28px', paddingTop: '16px', borderTop: '1px solid #E5EBF2', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
            <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.2em', color: '#7B8A9A', marginBottom: '4px' }}>Notes</div>
            <p style={{ fontSize: '10px', color: '#3B4A5C', lineHeight: 1.55, whiteSpace: 'pre-line', margin: 0 }}>{note.notes}</p>
          </div>
        )}

        {/* Sign-off */}
        <div style={{ marginTop: '32px', paddingTop: '16px', borderTop: '1px solid #E5EBF2', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
          <div style={{ fontSize: '10px', color: '#7B8A9A' }}>
            This is a computer-generated {isCredit ? 'credit' : 'debit'} note.
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.2em', color: '#7B8A9A' }}>For {fromName}</div>
            <div style={{ marginTop: '50px', paddingTop: '4px', borderTop: '1px solid #C5D2E2', minWidth: '160px', fontSize: '10.5px', color: '#0B2845' }}>
              {note.signingAuthority || 'Authorised Signatory'}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function MetaRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '2px 0' }}>
      <span style={{ color: '#7B8A9A', flexShrink: 0 }}>{label}</span>
      <span style={{ fontWeight: 500, color: '#0B2845', textAlign: 'right' }}>{value}</span>
    </div>
  )
}

function TotalRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '2.5px 0', fontSize: '11px' }}>
      <span style={{ color: '#3B4A5C' }}>{label}</span>
      <span style={{ fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  )
}

function Th({ children, align = 'center' }) {
  return (
    <th style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#7B8A9A', fontWeight: 500, textAlign: align, padding: '8px 4px' }}>
      {children}
    </th>
  )
}

function Td({ children, align = 'center', mono, bold, color, style }) {
  return (
    <td style={{ padding: '8px 4px', textAlign: align, fontFamily: mono ? '"JetBrains Mono", monospace' : 'inherit', fontWeight: bold ? 600 : 400, color: color || 'inherit', fontVariantNumeric: 'tabular-nums', fontSize: mono ? '9.5px' : '10px', ...style }}>
      {children}
    </td>
  )
}
