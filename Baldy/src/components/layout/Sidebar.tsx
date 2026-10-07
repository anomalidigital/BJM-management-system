import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { navUntuk } from './navigation'
import { useWorkspace } from '../../store/WorkspaceProvider'
import { cn } from '../../lib/utils'

interface Props {
  /** Di layar sempit sidebar tampil sebagai overlay. */
  mobileOpen: boolean
  onCloseMobile: () => void
}

/**
 * Menu utama berlatar polos (pilihan atasan, 6 Okt 2026): rel ikon selebar 68px
 * yang melebar sendiri saat kursor diarahkan ke sana, lalu menyempit lagi begitu
 * kursor keluar.
 *
 * Ikon TIDAK ikut bergerak: posisinya sama persis di kedua keadaan, yang
 * berubah hanya teksnya (memudar masuk / keluar). Teks tetap dirender lalu
 * disembunyikan dengan opacity - bukan dibongkar pasang - supaya tinggi tiap
 * baris tidak ikut berubah.
 */
export function Sidebar({ mobileOpen, onCloseMobile }: Props) {
  const [hover, setHover] = useState(false)
  /** Menyempit: rel ikon. Di layar sempit sidebar selalu tampil penuh. */
  const rapat = !hover && !mobileOpen
  const { workspace } = useWorkspace()
  const pudar = cn('transition-opacity duration-200', rapat ? 'pointer-events-none opacity-0' : 'opacity-100 delay-100')

  return (
    <>
      {mobileOpen && <div className="animate-in-fade fixed inset-0 z-40 bg-ink/40 lg:hidden" onClick={onCloseMobile} aria-hidden />}

      <aside
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        className={cn(
          'no-print fixed inset-y-0 left-0 z-50 flex flex-col bg-nav-900 text-nav-ink',
          'transition-[width,transform,box-shadow] duration-300 ease-[cubic-bezier(.22,1,.36,1)]',
          rapat ? 'w-[68px]' : 'w-[248px]',
          !rapat && 'shadow-[12px_0_32px_-12px_rgba(0,0,0,.45)]',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        {/* Logo tetap di 18px dari kiri, sejajar dengan ikon menu */}
        <div className="flex h-14 shrink-0 items-center gap-2.5 overflow-hidden border-b border-white/8 pl-[18px]">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-500 text-[15px] font-bold text-white">S</div>
          <div className={cn('min-w-0', pudar)}>
            <p className="truncate text-[14px] leading-tight font-semibold whitespace-nowrap text-white">SIKOTIS</p>
            <p className="truncate text-[10.5px] leading-tight whitespace-nowrap text-nav-ink/80">PT Bimajaya Mustika</p>
          </div>
        </div>

        <nav aria-label="Menu utama" className="flex-1 overflow-x-hidden overflow-y-auto py-3">
          {navUntuk(workspace).map((group, gi) => (
            <div
              key={group.title ?? `g${gi}`}
              // Menu tanpa judul grup (Trip / Job Order) dipisah garis tipis dari Dashboard.
              className={cn(gi > 0 && (group.title ? 'mt-4' : 'mx-3 mt-2 border-t border-white/8 pt-2'))}
            >
              {group.title && (
                <p className={cn('mb-1 pl-[18px] text-[10.5px] font-semibold tracking-[.08em] whitespace-nowrap text-nav-ink/55 uppercase', pudar)}>
                  {group.title}
                </p>
              )}
              <ul className={cn('space-y-0.5', group.title || gi === 0 ? 'px-2' : '-mx-1')}>
                {group.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      onClick={onCloseMobile}
                      title={item.label}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-2.5 overflow-hidden rounded-md py-2 pl-[18px] text-[13px] font-medium transition-colors',
                          isActive ? 'bg-brand-500 text-white' : 'text-nav-ink hover:bg-white/7 hover:text-white',
                        )
                      }
                    >
                      <item.icon size={17} className="shrink-0" />
                      <span className={cn('truncate whitespace-nowrap', pudar)}>{item.label}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-white/8 px-3 py-2">
          <p className={cn('text-[10.5px] whitespace-nowrap text-nav-ink/45', pudar)}>Version 0.1</p>
        </div>
      </aside>
    </>
  )
}
