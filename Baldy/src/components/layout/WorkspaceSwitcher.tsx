import { Check } from 'lucide-react'
import { WORKSPACE_LIST, useWorkspace } from '../../store/WorkspaceProvider'
import { useToast } from '../../store/ToastProvider'
import { cn } from '../../lib/utils'
import type { Workspace } from '../../types'

/** Jarak antar tombol pada segmented control (gap-1 = 4px). */
const GAP = 4

/**
 * Pemilih workspace di kaki sidebar.
 * Indikator geser + pergantian token warna (biru -> biru-ungu) memberi
 * penanda visual bahwa seluruh data yang tampil ikut berganti.
 */
export function WorkspaceSwitcher({ collapsed }: { collapsed: boolean }) {
  const { workspace, meta, setWorkspace } = useWorkspace()
  const toast = useToast()
  const index = Math.max(0, WORKSPACE_LIST.findIndex((w) => w.id === workspace))

  function pindah(next: Workspace) {
    if (next === workspace) return
    setWorkspace(next)
    const nama = WORKSPACE_LIST.find((w) => w.id === next)?.label ?? next
    toast.info(`Workspace ${nama} aktif. Seluruh transaksi yang tampil mengikuti workspace ini.`)
  }

  // Sidebar tertutup: satu tombol bulat yang menggilir workspace.
  if (collapsed) {
    const next = WORKSPACE_LIST[(index + 1) % WORKSPACE_LIST.length]
    return (
      <button
        type="button"
        onClick={() => pindah(next.id)}
        title={`Workspace ${meta.label} — klik untuk pindah ke ${next.label}`}
        aria-label={`Workspace ${meta.label}. Klik untuk pindah ke ${next.label}.`}
        className="mx-auto grid h-9 w-9 place-items-center rounded-lg text-[11.5px] font-bold text-white transition-[transform,background,box-shadow] duration-[600ms] ease-[cubic-bezier(.22,1,.36,1)] hover:scale-105 active:scale-95"
        style={{
          background: `linear-gradient(135deg, ${meta.color}, ${meta.colorSoft})`,
          boxShadow: `0 4px 14px -5px ${meta.color}`,
        }}
      >
        {meta.initial}
      </button>
    )
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-2">
      <span className="mb-1.5 block px-0.5 text-[10px] font-semibold tracking-[.09em] text-nav-ink/55 uppercase">Workspace</span>

      <div role="group" aria-label="Pilih workspace" className="relative grid grid-cols-2 gap-1 rounded-lg bg-black/25 p-1">
        {/* Indikator geser — satu-satunya elemen yang berpindah posisi */}
        <span
          aria-hidden
          className="absolute inset-y-1 left-1 rounded-md transition-[transform,background,box-shadow] duration-[600ms] ease-[cubic-bezier(.22,1,.36,1)]"
          style={{
            width: `calc((100% - ${GAP * (WORKSPACE_LIST.length + 1)}px) / ${WORKSPACE_LIST.length})`,
            transform: `translateX(calc(${index} * (100% + ${GAP}px)))`,
            background: `linear-gradient(135deg, ${meta.color}, ${meta.colorSoft})`,
            boxShadow: `0 4px 14px -5px ${meta.color}`,
          }}
        />
        {WORKSPACE_LIST.map((w) => {
          const active = w.id === workspace
          return (
            <button
              key={w.id}
              type="button"
              aria-pressed={active}
              onClick={() => pindah(w.id)}
              className={cn(
                'relative z-10 inline-flex items-center justify-center gap-1 rounded-md py-1.5 text-[12px] font-semibold',
                'transition-[color,transform] duration-[600ms] ease-[cubic-bezier(.22,1,.36,1)] active:scale-[.97]',
                active ? 'text-white' : 'text-nav-ink hover:text-white',
              )}
            >
              <Check
                size={12}
                className={cn(
                  'shrink-0 transition-[opacity,transform,width] duration-[600ms] ease-[cubic-bezier(.22,1,.36,1)]',
                  active ? 'w-3 scale-100 opacity-100' : 'w-0 scale-50 opacity-0',
                )}
              />
              {w.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
