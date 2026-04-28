import { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase'
import * as db from './db'
import Sidebar from './components/Sidebar'
import Dashboard from './components/Dashboard'
import GSTDashboard from './components/GSTDashboard'
import Customers from './components/Customers'
import Branches from './components/Branches'
import Products from './components/Products'
import Invoices from './components/Invoices'
import InvoiceEditor from './components/InvoiceEditor'
import InvoiceView from './components/InvoiceView'
import PurchaseOrders from './components/PurchaseOrders'
import PurchaseOrderEditor from './components/PurchaseOrderEditor'
import DeliveryChallans from './components/DeliveryChallans'
import DeliveryChallanEditor from './components/DeliveryChallanEditor'
import Settings from './components/Settings'
import LoginPage from './components/LoginPage'

export default function App() {
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  const [data, setData] = useState(null)
  const [loadError, setLoadError] = useState(null)

  const [view, setView] = useState('dashboard')
  const [selectedId, setSelectedId] = useState(null)
  const [mobileOpen, setMobileOpen] = useState(false)

  // Auth
  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
      setAuthLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, newSession) => {
      setSession(newSession)
      if (!newSession) {
        setData(null)
        setView('dashboard')
        setSelectedId(null)
      }
    })
    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  // Data
  useEffect(() => {
    if (!session) return
    setLoadError(null)
    db.loadAll()
      .then(setData)
      .catch((e) => {
        console.error(e)
        setLoadError(e.message || String(e))
      })
  }, [session])

  const refresh = useCallback(() => {
    db.loadAll().then(setData).catch((e) => setLoadError(e.message || String(e)))
  }, [])

  const navigate = (v, id = null) => {
    setView(v)
    setSelectedId(id)
    setMobileOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const openInvoice = (id) => navigate('invoice-view', id)
  const openPO = (id) => navigate('po-edit', id)
  const openDC = (id) => navigate('dc-edit', id)

  const ops = {
    // Branches
    saveBranch: async (b) => { await db.saveBranch(b); refresh() },
    deleteBranch: async (id) => { await db.deleteBranch(id); refresh() },
    // Products
    saveProduct: async (p) => { await db.saveProduct(p); refresh() },
    deleteProduct: async (id) => { await db.deleteProduct(id); refresh() },
    // Customers
    saveCustomer: async (c) => { await db.saveCustomer(c); refresh() },
    deleteCustomer: async (id) => { await db.deleteCustomer(id); refresh() },
    saveCustomerBranch: async (cb) => { await db.saveCustomerBranch(cb); refresh() },
    deleteCustomerBranch: async (id) => { await db.deleteCustomerBranch(id); refresh() },
    // Invoices
    saveInvoice: async (inv) => { await db.saveInvoice(inv); refresh() },
    deleteInvoice: async (id) => { await db.deleteInvoice(id); refresh() },
    updateInvoiceStatus: async (id, s) => { await db.updateInvoiceStatus(id, s); refresh() },
    // POs
    savePurchaseOrder: async (po) => { await db.savePurchaseOrder(po); refresh() },
    deletePurchaseOrder: async (id) => { await db.deletePurchaseOrder(id); refresh() },
    // DCs
    saveDeliveryChallan: async (dc) => { await db.saveDeliveryChallan(dc); refresh() },
    deleteDeliveryChallan: async (id) => { await db.deleteDeliveryChallan(id); refresh() },
    // Company
    saveCompanyAndSettings: async (company, settings) => {
      await db.saveCompany(company)
      await db.saveSettings(settings)
      refresh()
    },
    resetAll: async () => { await db.resetAll(); refresh() },
    exportJson: async () => await db.exportJson(),
    signOut: async () => { await supabase.auth.signOut() },
  }

  if (authLoading) return <LoadingScreen label="Checking your session…" />
  if (!session) return <LoginPage />

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="card p-8 max-w-md text-center">
          <div className="font-display font-bold text-2xl tracking-tightest text-danger mb-2">
            Couldn't load your data
          </div>
          <p className="text-sm text-ash mb-2">{loadError}</p>
          <p className="text-xs text-mute mb-4">
            This often means the v4 schema migration hasn't been applied yet.
            Run <code className="font-mono text-xs px-1.5 py-0.5 rounded bg-ice">supabase/schema_v4.sql</code> in your Supabase SQL editor.
          </p>
          <div className="flex gap-2 justify-center">
            <button onClick={refresh} className="btn-primary">Retry</button>
            <button onClick={ops.signOut} className="btn-outline">Sign out</button>
          </div>
        </div>
      </div>
    )
  }

  if (!data) return <LoadingScreen label="Loading your data…" />

  return (
    <div className="min-h-screen flex">
      <Sidebar
        view={view}
        onNav={navigate}
        company={data.company}
        userEmail={session.user?.email}
        onSignOut={ops.signOut}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <div className="md:hidden sticky top-0 z-20 bg-white/90 backdrop-blur border-b hairline px-4 py-3 flex items-center justify-between no-print">
          <button onClick={() => setMobileOpen(true)} aria-label="Open menu" className="p-2">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="" className="h-7 w-7 object-contain" />
            <span className="font-display font-bold tracking-tightest">AllyTechSoft</span>
          </div>
          <div className="w-9" />
        </div>

        <main className="flex-1 px-4 md:px-8 py-6 md:py-10 max-w-[1400px] w-full mx-auto">
          {view === 'dashboard' && <Dashboard data={data} onNav={navigate} onOpenInvoice={openInvoice} />}
          {view === 'gst' && <GSTDashboard data={data} />}

          {view === 'invoices' && <Invoices data={data} ops={ops} onNav={navigate} onOpenInvoice={openInvoice} />}
          {view === 'invoice-new' && (
            <InvoiceEditor data={data} ops={ops} editingId={null} onNav={navigate} onOpenInvoice={openInvoice} />
          )}
          {view === 'invoice-edit' && (
            <InvoiceEditor data={data} ops={ops} editingId={selectedId} onNav={navigate} onOpenInvoice={openInvoice} />
          )}
          {view === 'invoice-view' && <InvoiceView data={data} invoiceId={selectedId} onNav={navigate} />}

          {view === 'purchase-orders' && (
            <PurchaseOrders data={data} ops={ops} onNav={navigate} onOpen={openPO} />
          )}
          {view === 'po-new' && (
            <PurchaseOrderEditor data={data} ops={ops} editingId={null} onNav={navigate} />
          )}
          {view === 'po-edit' && (
            <PurchaseOrderEditor data={data} ops={ops} editingId={selectedId} onNav={navigate} />
          )}

          {view === 'delivery-challans' && (
            <DeliveryChallans data={data} ops={ops} onNav={navigate} onOpen={openDC} />
          )}
          {view === 'dc-new' && (
            <DeliveryChallanEditor data={data} ops={ops} editingId={null} onNav={navigate} />
          )}
          {view === 'dc-edit' && (
            <DeliveryChallanEditor data={data} ops={ops} editingId={selectedId} onNav={navigate} />
          )}

          {view === 'customers' && <Customers data={data} ops={ops} />}
          {view === 'products' && <Products data={data} ops={ops} />}
          {view === 'branches' && <Branches data={data} ops={ops} />}
          {view === 'settings' && <Settings data={data} ops={ops} />}
        </main>
      </div>
    </div>
  )
}

function LoadingScreen({ label = 'Loading…' }) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <img src="/logo.png" alt="AllyTechSoft" className="h-14 w-14 mx-auto object-contain animate-pulse" />
        <div className="mt-5 font-display font-bold text-xl tracking-tightest">AllyTechSoft Invoice</div>
        <div className="mt-2 text-xs font-mono uppercase tracking-[0.25em] text-mute">{label}</div>
      </div>
    </div>
  )
}
