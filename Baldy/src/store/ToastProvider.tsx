import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react'
import { uid } from '../lib/utils'

type ToastKind = 'success' | 'error' | 'info'

interface Toast {
  id: string
  kind: ToastKind
  message: string
}

interface ToastContextValue {
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const STYLES: Record<ToastKind, { icon: typeof Info; ring: string; tint: string }> = {
  success: { icon: CheckCircle2, ring: 'text-[color:var(--color-good)]', tint: 'bg-[#f0fbf0]' },
  error: { icon: TriangleAlert, ring: 'text-[color:var(--color-critical)]', tint: 'bg-[#fdf2f2]' },
  info: { icon: Info, ring: 'text-brand-600', tint: 'bg-brand-50' },
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (kind: ToastKind, message: string) => {
      const id = uid('toast')
      setToasts((prev) => [...prev, { id, kind, message }])
      window.setTimeout(() => dismiss(id), 3800)
    },
    [dismiss],
  )

  const value = useMemo<ToastContextValue>(
    () => ({
      success: (m: string) => push('success', m),
      error: (m: string) => push('error', m),
      info: (m: string) => push('info', m),
    }),
    [push],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="no-print pointer-events-none fixed right-5 bottom-5 z-[100] flex w-[min(94vw,380px)] flex-col gap-2">
        {toasts.map((t) => {
          const s = STYLES[t.kind]
          const Icon = s.icon
          return (
            <div
              key={t.id}
              role="status"
              className={`animate-in-toast pointer-events-auto flex items-start gap-3 rounded-lg border border-hairline ${s.tint} px-3.5 py-3 shadow-pop`}
            >
              <Icon size={17} className={`mt-px shrink-0 ${s.ring}`} />
              <p className="flex-1 text-[13px] leading-snug font-medium text-ink">{t.message}</p>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Tutup notifikasi"
                className="-mr-1 rounded p-0.5 text-ink-3 transition hover:bg-black/5 hover:text-ink"
              >
                <X size={15} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast harus dipakai di dalam <ToastProvider>')
  return ctx
}
