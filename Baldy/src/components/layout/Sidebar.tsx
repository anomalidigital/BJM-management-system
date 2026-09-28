import { useLayoutEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { NAV_GROUPS } from './navigation'
import { KodeDepot } from './KodeDepot'
import { useWorkspace } from '../../store/WorkspaceProvider'
import { cn } from '../../lib/utils'

interface Props {
  /** Di layar sempit sidebar tampil sebagai overlay. */
  mobileOpen: boolean
  onCloseMobile: () => void
}

/**
 * Rel navigasi bergaya sisi kontainer di depo: pelat baja bergelombang dalam
 * warna workspace, kode kontainer berstensil di atas, dan marka kuning yang
 * meluncur ke menu yang sedang dibuka.
 *
 * Rel selebar 68px melebar sendiri saat kursor diarahkan ke sana. Ikon TIDAK
 * ikut bergerak: posisinya sama di kedua keadaan, yang berubah hanya teksnya
 * (memudar masuk / keluar). Teks tetap dirender lalu disembunyikan dengan
 * opacity - bukan dibongkar pasang - supaya tinggi tiap baris tidak berubah
 * dan marka tetap tepat di barisnya.
 */
export function Sidebar({ mobileOpen, onCloseMobile }: Props) {
  const [hover, setHover] = useState(false)
  /** Menyempit: rel ikon. Di layar sempit sidebar selalu tampil penuh. */
  const rapat = !hover && !mobileOpen
  const { meta } = useWorkspace()
  const { pathname } = useLocation()
  const navRef = useRef<HTMLElement>(null)
  const [marka, setMarka] = useState<{ top: number; height: number } | null>(null)

  // Marka mengikuti menu aktif. Diukur dari link yang ditandai aria-current,
  // jadi halaman turunan (mis. detail trip) tetap menandai menu induknya.
  useLayoutEffect(() => {
    const aktif = navRef.current?.querySelector<HTMLElement>('a[aria-current="page"]')
    setMarka(aktif ? { top: aktif.offsetTop, height: aktif.offsetHeight } : null)
  }, [pathname])

  const pudar = (tampil: boolean) => cn('transition-opacity duration-200', tampil ? 'opacity-100 delay-100' : 'pointer-events-none opacity-0')

  return (
    <>
      {mobileOpen && <div className="animate-in-fade fixed inset-0 z-40 bg-ink/40 lg:hidden" onClick={onCloseMobile} aria-hidden />}

      <aside
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        className={cn(
          'rail-steel no-print fixed inset-y-0 left-0 z-50 flex flex-col text-nav-ink',
          'transition-[width,transform,box-shadow] duration-300 ease-[cubic-bezier(.22,1,.36,1)]',
          rapat ? 'w-[68px]' : 'w-[248px]',
          !rapat && 'shadow-[14px_0_36px_-14px_rgba(0,0,0,.5)]',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        {/* Kode kontainer di sudut atas: kode pemilik, dan di bawahnya kode depo workspace. */}
        <div className="flex h-14 shrink-0 items-center gap-3.5 overflow-hidden border-b border-white/10 pl-[22px]">
          <div className="flex shrink-0 flex-col items-start gap-[3px]" title={`Workspace ${meta.label}`}>
            <span className="font-stencil text-[16.5px] leading-none font-extrabold tracking-[.05em] text-white">BJMU</span>
            <KodeDepot kode={meta.code} className="text-nav-ink" />
          </div>
          <div className={cn('min-w-0 font-rail', pudar(!rapat))}>
            <p className="truncate text-[16px] leading-tight font-semibold tracking-[.02em] whitespace-nowrap text-white">SIKOTIS</p>
            <p className="truncate text-[12px] leading-tight font-medium whitespace-nowrap text-nav-ink">PT Bimajaya Mustika, {meta.label}</p>
          </div>
        </div>

        <nav ref={navRef} aria-label="Menu utama" className="relative flex-1 overflow-x-hidden overflow-y-auto pt-2 pb-4">
          {/* Marka kuning: satu-satunya yang bergerak, dan hanya saat pindah halaman. */}
          {marka && (
            <span
              aria-hidden
              className="pointer-events-none absolute top-0 left-0 z-10 w-[3px] bg-signal transition-[transform,height] duration-300 ease-[cubic-bezier(.22,1,.36,1)] motion-reduce:transition-none"
              style={{ transform: `translateY(${marka.top}px)`, height: marka.height }}
            />
          )}

          {NAV_GROUPS.map((group, gi) => (
            <div key={group.title ?? `g${gi}`} className={cn(gi > 0 && 'mt-1.5')}>
              {group.title && (
                <div className="relative h-7">
                  {/* Rel menyempit: sambungan las pendek menandai batas grup. */}
                  <span aria-hidden className={cn('absolute top-1/2 left-[22px] h-px w-[18px] bg-white/20 transition-opacity duration-200', rapat ? 'opacity-100' : 'opacity-0')} />
                  <p className={cn('absolute inset-x-0 bottom-1 pl-[22px] font-rail text-[12.5px] font-semibold tracking-[.03em] whitespace-nowrap text-nav-ink/75', pudar(!rapat))}>
                    {group.title}
                  </p>
                </div>
              )}
              <ul>
                {group.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      onClick={onCloseMobile}
                      title={item.label}
                      className={({ isActive }) =>
                        cn(
                          'flex h-9 items-center gap-3 overflow-hidden pl-[22px] font-rail text-[14.5px] font-medium tracking-[.01em] transition-colors',
                          'focus-visible:rounded-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-signal',
                          // Menu aktif = pelat datar tanpa gelombang, seperti panel pintu kontainer.
                          isActive ? 'bg-nav-800 text-white' : 'hover:bg-white/[.04] hover:text-white',
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <item.icon size={18} className={cn('shrink-0', isActive && 'text-signal')} />
                          <span className={cn('truncate whitespace-nowrap', pudar(!rapat))}>{item.label}</span>
                        </>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-white/10 py-2.5 pl-[22px]">
          <p className="font-stencil text-[12px] leading-none font-bold tracking-[.1em] whitespace-nowrap text-nav-ink/70">
            v0.1
          </p>
        </div>
      </aside>
    </>
  )
}
