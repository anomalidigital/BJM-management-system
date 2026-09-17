import { useEffect, useRef, useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { WORKSPACE_LIST, useWorkspace } from '../../store/WorkspaceProvider'
import type { WorkspaceMeta } from '../../store/WorkspaceProvider'
import { useToast } from '../../store/ToastProvider'
import { cn } from '../../lib/utils'
import type { Workspace } from '../../types'

/** Avatar bulat berisi inisial workspace. */
function Avatar({ meta, size = 26 }: { meta: WorkspaceMeta; size?: number }) {
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-full font-bold text-white"
      style={{
        width: size,
        height: size,
        fontSize: size <= 26 ? 10 : 11.5,
        background: `linear-gradient(135deg, ${meta.color}, ${meta.colorSoft})`,
      }}
    >
      {meta.initial}
    </span>
  )
}

/**
 * Pemilih workspace di kaki sidebar: tombol menampilkan workspace yang sedang
 * dipakai, klik untuk memilih dari daftar. Bentuk daftar dipilih karena jumlah
 * workspace belum pasti - menambah cabang tidak mengubah tampilannya.
 */
export function WorkspaceSwitcher({
  collapsed,
  onOpenChange,
}: {
  collapsed: boolean
  /** Sidebar memakai ini untuk tetap melebar selama daftar terbuka. */
  onOpenChange?: (open: boolean) => void
}) {
  const { workspace, meta, setWorkspace } = useWorkspace()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => { onOpenChange?.(open) }, [open, onOpenChange])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function pilih(next: Workspace) {
    setOpen(false)
    if (next === workspace) return
    setWorkspace(next)
    const nama = WORKSPACE_LIST.find((w) => w.id === next)?.label ?? next
    toast.info(`Workspace ${nama} aktif. Transaksi yang tampil mengikuti workspace ini.`)
  }

  return (
    <div ref={ref} className="relative">
      {open && (
        <div
          role="menu"
          aria-label="Pilih workspace"
          className="animate-in-pop absolute bottom-0 left-full z-50 ml-3 w-[212px] overflow-hidden rounded-xl border border-white/12 bg-nav-800 shadow-pop"
        >
          <p className="px-3 pt-2.5 pb-1 text-[11px] font-semibold tracking-[.08em] text-nav-ink/60 uppercase">
            Workspace
          </p>
          <ul className="max-h-[248px] overflow-y-auto pb-1.5">
            {WORKSPACE_LIST.map((w) => {
              const active = w.id === workspace
              return (
                <li key={w.id}>
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={active}
                    onClick={() => pilih(w.id)}
                    className={cn(
                      'flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] transition-colors',
                      active ? 'font-semibold text-white' : 'text-nav-ink hover:bg-white/7 hover:text-white',
                    )}
                  >
                    <Avatar meta={w} />
                    <span className="min-w-0 flex-1 truncate">{w.label}</span>
                    {active && <Check size={15} className="shrink-0 text-white/80" />}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        title={`Workspace ${meta.label}`}
        className={cn(
          'flex w-full items-center rounded-lg transition-colors',
          collapsed ? 'justify-center py-1' : 'gap-2.5 px-2 py-2 hover:bg-white/7',
          open && !collapsed && 'bg-white/7',
        )}
      >
        <Avatar meta={meta} size={collapsed ? 32 : 26} />
        <span
          className={cn(
            'flex min-w-0 flex-1 items-center gap-2 transition-opacity duration-200',
            collapsed ? 'pointer-events-none absolute opacity-0' : 'opacity-100 delay-100',
          )}
        >
          <span className="min-w-0 flex-1 truncate text-left text-[13px] font-semibold whitespace-nowrap text-white">
            {meta.label}
          </span>
          <ChevronsUpDown size={14} className="shrink-0 text-nav-ink/70" />
        </span>
      </button>
    </div>
  )
}
