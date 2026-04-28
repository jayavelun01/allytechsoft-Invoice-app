import { useEffect } from 'react'

export function Modal({ open, onClose, title, children, footer, wide = false }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 no-print">
      <div
        className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={`relative card w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} max-h-[90vh] flex flex-col`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b hairline">
          <h3 className="font-display font-semibold text-xl tracking-tightest">{title}</h3>
          <button
            onClick={onClose}
            className="text-mute hover:text-ink p-1 rounded-md hover:bg-ice"
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M4.5 4.5L13.5 13.5M13.5 4.5L4.5 13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-5 overflow-y-auto">{children}</div>
        {footer && (
          <div className="px-6 py-4 border-t hairline bg-mist/50 rounded-b-2xl flex justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

export function Empty({ title, hint, action }) {
  return (
    <div className="card p-12 text-center">
      <div className="mx-auto w-14 h-14 rounded-full bg-ice flex items-center justify-center text-brandBlue mb-4">
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <path d="M4 6h14M4 11h14M4 16h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
      <h3 className="font-display font-semibold text-xl tracking-tightest">{title}</h3>
      {hint && <p className="mt-2 text-sm text-ash max-w-md mx-auto">{hint}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
      <div>
        <h1 className="font-display font-bold text-3xl md:text-4xl tracking-tightest">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-ash">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  )
}

export function StatusPill({ status, statusMeta }) {
  const m = statusMeta(status)
  return (
    <span className={`badge ${m.cls}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      {m.label}
    </span>
  )
}
