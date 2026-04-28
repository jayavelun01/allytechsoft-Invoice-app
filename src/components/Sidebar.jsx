const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: 'home' },
  { id: 'invoices', label: 'Invoices', icon: 'doc' },
  { id: 'customers', label: 'Customers', icon: 'users' },
  { id: 'settings', label: 'Settings', icon: 'gear' },
]

const Icon = ({ name, className = 'w-[18px] h-[18px]' }) => {
  const paths = {
    home: <path d="M3 10l7-6 7 6v8a1 1 0 0 1-1 1h-3v-6h-6v6H4a1 1 0 0 1-1-1v-8z" />,
    doc: <path d="M5 3h7l4 4v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm7 0v4h4M7 11h6M7 14h6M7 17h4" />,
    users: <path d="M7 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 2c-2.8 0-5 1.7-5 4v2h10v-2c0-2.3-2.2-4-5-4zm9-2a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zm0 2c-1 0-2 .25-2.7.7.4.5.7 1 .7 1.6V18h6v-2c0-2-1.8-3.5-4-3.5z" />,
    gear: <path d="M10 6.5A3.5 3.5 0 1 0 10 13.5 3.5 3.5 0 0 0 10 6.5zm7-1l-1.5-1-.5-2-2 .5-1.5-1.5L10 2 8.5 1.5 7 3 5 2.5l-.5 2L3 5.5l.5 2-1 1.5L3 11l-.5 2 1 1.5-.5 2L5 17.5 7 17l1.5 1.5L10 18l1.5.5 1.5-1.5 2-.5.5-2 1.5-1L16 11l1-1.5-.5-2L17 5.5z" />,
    out: <path d="M13 4l-1 1v3h-2V5h-7v10h7v-3h2v3l1 1H4l-1-1V4l1-1zm5 6l-3-3v2h-5v2h5v2l3-3z" />,
  }
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {paths[name]}
    </svg>
  )
}

export default function Sidebar({ view, onNav, company, userEmail, onSignOut, mobileOpen, onCloseMobile }) {
  const signOut = async () => {
    if (!confirm('Sign out?')) return
    await onSignOut?.()
  }

  return (
    <>
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-ink/30 z-30 no-print"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`no-print fixed md:sticky top-0 left-0 h-screen w-64 bg-white border-r hairline z-40
                    transform transition-transform duration-300
                    ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
      >
        <div className="h-full flex flex-col">
          {/* Brand */}
          <div className="px-5 py-5 border-b hairline">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="" className="h-9 w-9 object-contain" />
              <div className="flex flex-col leading-none">
                <span className="font-display font-bold text-base tracking-tightest">
                  AllyTechSoft
                </span>
                <span className="font-mono text-[9px] tracking-[0.25em] uppercase text-mute mt-0.5">
                  Invoice
                </span>
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-3 py-4">
            <ul className="space-y-1">
              {navItems.map((item) => {
                const active = view === item.id || (item.id === 'invoices' && view.startsWith('invoice'))
                return (
                  <li key={item.id}>
                    <button
                      onClick={() => {
                        onNav(item.id)
                        onCloseMobile?.()
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                                  ${active
                                    ? 'bg-brandBlue/10 text-brandBlue'
                                    : 'text-ash hover:bg-ice hover:text-ink'
                                  }`}
                    >
                      <Icon name={item.icon} />
                      {item.label}
                    </button>
                  </li>
                )
              })}
            </ul>
          </nav>

          {/* Account block */}
          <div className="px-3 py-4 border-t hairline">
            <div className="px-2 mb-2">
              <div className="text-[10px] uppercase tracking-[0.2em] text-mute font-mono">
                Signed in as
              </div>
              <div className="text-sm font-medium text-ink truncate" title={userEmail}>
                {userEmail || '—'}
              </div>
              {company?.name && (
                <div className="text-xs text-mute truncate mt-0.5">{company.name}</div>
              )}
            </div>
            <button
              onClick={signOut}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-ash hover:bg-ice hover:text-ink transition-colors"
            >
              <Icon name="out" />
              Sign out
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
