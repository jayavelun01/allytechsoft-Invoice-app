import { useState } from 'react'
import { PageHeader } from './ui'

export default function Settings({ data, ops }) {
  const [company, setCompany] = useState(data.company)
  const [settings, setSettings] = useState(data.settings)
  const [savedAt, setSavedAt] = useState(null)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      await ops.saveCompanyAndSettings(company, settings)
      setSavedAt(Date.now())
      setTimeout(() => setSavedAt(null), 2000)
    } catch (e) { alert('Could not save: ' + e.message) }
    finally { setSaving(false) }
  }

  const resetAll = async () => {
    if (!confirm('This will delete ALL your branches, products, customers, invoices, POs, and DCs. Continue?')) return
    try { await ops.resetAll() } catch (e) { alert('Could not reset: ' + e.message) }
  }

  const exportJson = async () => {
    setExporting(true)
    try {
      const json = await ops.exportJson()
      const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `allytechsoft-invoice-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) { alert('Could not export: ' + e.message) }
    finally { setExporting(false) }
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Company defaults, currency, and global preferences."
        actions={
          <>
            {savedAt && <span className="text-xs text-brandGreenDark">✓ Saved</span>}
            <button onClick={save} className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </>
        }
      />

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card p-5 md:p-6">
          <h2 className="font-display font-semibold text-lg tracking-tightest mb-2">Your company</h2>
          <p className="text-xs text-mute mb-4">
            These details appear at the top of invoices when no branch is selected. For most invoices, branch-level details (managed under <strong>Branches</strong>) take precedence.
          </p>
          <div className="space-y-4">
            <Field label="Company name">
              <input className="input-base" value={company.name}
                onChange={(e) => setCompany({ ...company, name: e.target.value })} />
            </Field>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Email">
                <input type="email" className="input-base" value={company.email}
                  onChange={(e) => setCompany({ ...company, email: e.target.value })} />
              </Field>
              <Field label="Phone">
                <input className="input-base" value={company.phone}
                  onChange={(e) => setCompany({ ...company, phone: e.target.value })} />
              </Field>
            </div>
            <Field label="Address">
              <textarea rows={3} className="input-base resize-none" value={company.address}
                onChange={(e) => setCompany({ ...company, address: e.target.value })} />
            </Field>
            <Field label="PAN / Tax ID">
              <input className="input-base" value={company.taxId}
                onChange={(e) => setCompany({ ...company, taxId: e.target.value })} />
            </Field>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card p-5 md:p-6">
            <h2 className="font-display font-semibold text-lg tracking-tightest mb-4">Defaults</h2>
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Currency symbol">
                  <input className="input-base" value={settings.currency}
                    onChange={(e) => setSettings({ ...settings, currency: e.target.value })} />
                </Field>
                <Field label="Default GST rate (%)">
                  <input type="number" step="0.01" className="input-base" value={settings.defaultTaxRate}
                    onChange={(e) => setSettings({ ...settings, defaultTaxRate: e.target.value })} />
                </Field>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Fallback invoice prefix">
                  <input className="input-base font-mono" value={settings.invoicePrefix}
                    onChange={(e) => setSettings({ ...settings, invoicePrefix: e.target.value })} />
                </Field>
                <Field label="Fallback next number">
                  <input type="number" className="input-base" value={settings.nextInvoiceNumber}
                    onChange={(e) => setSettings({ ...settings, nextInvoiceNumber: Number(e.target.value) || 1 })} />
                </Field>
              </div>
              <p className="text-xs text-mute">
                Each branch has its own prefix &amp; counter. The fallback is only used if no branch is set on an invoice.
              </p>
              <Field label="Default payment terms / T&C (printed on every invoice unless overridden)">
                <textarea rows={4} className="input-base resize-none" value={settings.paymentTerms}
                  onChange={(e) => setSettings({ ...settings, paymentTerms: e.target.value })} />
              </Field>
            </div>
          </div>

          <div className="card p-5 md:p-6">
            <h2 className="font-display font-semibold text-lg tracking-tightest mb-1">Backup &amp; data</h2>
            <p className="text-sm text-ash mb-4">
              Your data lives in your private Supabase database. Use these tools to download a JSON snapshot.
            </p>
            <div className="flex flex-wrap gap-2">
              <button onClick={exportJson} className="btn-outline" disabled={exporting}>
                {exporting ? 'Preparing…' : 'Export JSON backup'}
              </button>
              <button onClick={resetAll} className="btn-danger">Reset everything</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return <div><label className="label-base">{label}</label>{children}</div>
}
