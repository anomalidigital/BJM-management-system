import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarRange, ChevronDown, LogOut, Menu, Search } from 'lucide-react'
import { useAuth } from '../../store/AuthProvider'
import { Badge } from '../ui/Badge'
import { initials, monthLabel, todayISO } from '../../lib/format'
import { cn } from '../../lib/utils'

export function Topbar({ onOpenMobileNav, onLogout }: { onOpenMobileNav: () => void; onLogout: () => void }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [quick, setQuick] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [menuOpen])

  function submitQuick(e: React.FormEvent) {
    e.preventDefault()
    const q = quick.trim()
    if (!q) return
    navigate(`/pencarian/sijo?sijo=${encodeURIComponent(q)}`)
    setQuick('')
  }

  return (
    <header className="no-print sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-hairline bg-surface/95 px-4 backdrop-blur lg:px-6">
      <button
        type="button"
        onClick={onOpenMobileNav}
        aria-label="Buka menu"
        className="rounded-md p-1.5 text-ink-2 transition hover:bg-sunken lg:hidden"
      >
        <Menu size={19} />
      </button>

      {/* Lompat langsung ke pencarian SI/JO tanpa copy-paste antar halaman */}
      <form onSubmit={submitQuick} className="relative hidden w-72 sm:block">
        <Search size={15} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-3" />
        <input
          value={quick}
          onChange={(e) => setQuick(e.target.value)}
          placeholder="Lompat ke No. SI / Job Order..."
          aria-label="Cari nomor SI atau Job Order"
          className="h-9 w-full rounded-md border border-hairline bg-sunken pr-3 pl-8 text-[13px] text-ink transition-colors placeholder:text-ink-3/80 focus:border-brand-400 focus:bg-surface focus:ring-2 focus:ring-brand-500/15 focus:outline-none"
        />
      </form>

      <div className="ml-auto flex items-center gap-3">
        <span className="hidden items-center gap-1.5 rounded-md border border-hairline bg-sunken px-2.5 py-1.5 text-[12px] font-medium text-ink-2 md:inline-flex">
          <CalendarRange size={14} className="text-ink-3" />
          Periode: {monthLabel(todayISO())}
        </span>

        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className={cn(
              'flex items-center gap-2 rounded-md border border-transparent py-1 pr-1.5 pl-1 transition-colors hover:bg-sunken',
              menuOpen && 'border-hairline bg-sunken',
            )}
          >
            <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-500 text-[11px] font-bold text-white">
              {initials(user?.name ?? 'SI')}
            </span>
            <span className="hidden text-left sm:block">
              <span className="block text-[12.5px] leading-tight font-semibold text-ink">{user?.name}</span>
              <span className="block text-[11px] leading-tight text-ink-3">{user?.username}</span>
            </span>
            <ChevronDown size={14} className="text-ink-3" />
          </button>

          {menuOpen && (
            <div className="animate-in-pop absolute right-0 z-50 mt-1.5 w-60 overflow-hidden rounded-lg border border-hairline bg-surface shadow-pop">
              <div className="border-b border-hairline px-3.5 py-3">
                <p className="text-[13px] font-semibold text-ink">{user?.name}</p>
                <div className="mt-1.5">
                  <Badge tone={user?.role === 'admin' ? 'brand' : 'neutral'}>
                    {user?.role === 'admin' ? 'Admin — akses penuh' : 'Viewer — hanya lihat & export'}
                  </Badge>
                </div>
              </div>
              <button
                type="button"
                onClick={onLogout}
                className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-[13px] font-medium text-ink-2 transition hover:bg-sunken hover:text-ink"
              >
                <LogOut size={15} />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
