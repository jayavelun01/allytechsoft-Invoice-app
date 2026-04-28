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
    } catch (e) {
      alert('Could not save: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const resetAll = async () => {
    if (!confirm('This will delete ALL your customers, invoices, and reset settings. Continue?')) return
    try {
      await ops.resetAll()
      setCompany((c) => ({ ...c, ...data.company }))
      setSettings((s) => ({ ...s, ...data.settings }))
    } catch (e) {
      alert('Could not reset: ' + e.message)
    }
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
    } catch (e) {
      alert('Could not export: ' + e.message)
    } finally {
      setExporting(false)
    }
  }

  const importJson = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(reader.result)
        if (!confirm('Replace ALL of your current data with this backup? This cannot be undone.')) return
        await ops.importJson(parsed)
        alert('Backup restored.')
      } catch (err) {
        alert(err.message || 'That file does not look like a valid backup.')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Company details, currency, and invoice defaults."
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
        {/* Company */}
        <div className="card p-5 md:p-6">
          <h2 className="font-display font-semibold text-lg tracking-tightest mb-4">Your company</h2>
          <div className="space-y-4">
            <Field label="Company name">
              <input
                className="input-base"
                value={company.name}
                onChange={(e) => setCompany({ ...company, name: e.target.value })}
              />
            </Field>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Email">
                <input
                  type="email"
                  className="input-base"
                  value={company.email}
                  onChange={(e) => setCompany({ ...company, email: e.target.value })}
                />
              </Field>
              <Field label="Phone">
                <input
                  className="input-base"
                  value={company.phone}
                  onChange={(e) => setCompany({ ...company, phone: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Address">
              <textarea
                rows={3}
                className="input-base resize-none"
                value={company.address}
                onChange={(e) => setCompany({ ...company, address: e.target.value })}
              />
            </Field>
            <Field label="Tax ID / GSTIN (shows on invoice)">
              <input
                className="input-base"
                value={company.taxId}
                onChange={(e) => setCompany({ ...company, taxId: e.target.value })}
              />
            </Field>
          </div>
        </div>

        {/* Defaults + Data */}
        <div className="space-y-6">
          <div className="card p-5 md:p-6">
            <h2 className="font-display font-semibold text-lg tracking-tightest mb-4">Invoice defaults</h2>
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Currency symbol">
                  <input
                    className="input-base"
                    value={settings.currency}
                    onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                  />
                </Field>
                <Field label="Default tax rate (%)">
                  <input
                    type="number"
                    step="0.01"
                    className="input-base"
                    value={settings.defaultTaxRate}
                    onChange={(e) => setSettings({ ...settings, defaultTaxRate: e.target.value })}
                  />
                </Field>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Invoice number prefix">
                  <input
                    className="input-base font-mono"
                    value={settings.invoicePrefix}
                    onChange={(e) => setSettings({ ...settings, invoicePrefix: e.target.value })}
                  />
                </Field>
                <Field label="Next invoice number">
                  <input
                    type="number"
                    className="input-base"
                    value={settings.nextInvoiceNumber}
                    onChange={(e) =>
                      setSettings({ ...settings, nextInvoiceNumber: Number(e.target.value) || 1 })
                    }
                  />
                </Field>
              </div>
              <Field label="Default payment terms (printed on every invoice)">
                <textarea
                  rows={3}
                  className="input-base resize-none"
                  value={settings.paymentTerms}
                  onChange={(e) => setSettings({ ...settings, paymentTerms: e.target.value })}
                />
              </Field>
            </div>
          </div>

          <div className="card p-5 md:p-6">
            <h2 className="font-display font-semibold text-lg tracking-tightest mb-1">Backup &amp; data</h2>
            <p className="text-sm text-ash mb-4">
              Your data lives in your private Supabase database and syncs across every device you sign in on.
              Use these tools to download a JSON snapshot or restore from one.
            </p>

            <div className="flex flex-wrap gap-2">
              <button onClick={exportJson} className="btn-outline" disabled={exporting}>
                {exporting ? 'Preparing…' : 'Export JSON backup'}
              </button>
              <label className="btn-outline cursor-pointer">
                Restore from JSON
                <input type="file" accept="application/json" onChange={importJson} className="hidden" />
              </label>
              <button onClick={resetAll} className="btn-danger">
                Reset everything
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="label-base">{label}</label>
      {children}
    </div>
  )
}
