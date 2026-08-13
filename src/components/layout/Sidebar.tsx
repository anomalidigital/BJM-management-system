import { NavLink } from 'react-router-dom'
import { LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { NAV_GROUPS } from './navigation'
import { cn } from '../../lib/utils'

interface Props {
  collapsed: boolean
  onToggleCollapse: () => void
  onLogout: () => void
  /** Di layar sempit sidebar tampil sebagai overlay. */
  mobileOpen: boolean
  onCloseMobile: () => void
}

export function Sidebar({ collapsed, onToggleCollapse, onLogout, mobileOpen, onCloseMobile }: Props) {
  return (
    <>
      {mobileOpen && <div className="animate-in-fade fixed inset-0 z-40 bg-ink/40 lg:hidden" onClick={onCloseMobile} aria-hidden />}

      <aside
        className={cn(
          'no-print fixed inset-y-0 left-0 z-50 flex flex-col bg-nav-900 text-nav-ink transition-[width,transform] duration-200',
          collapsed ? 'w-[68px]' : 'w-[248px]',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        {/* Brand */}
        <div className={cn('flex h-14 shrink-0 items-center gap-2.5 border-b border-white/8', collapsed ? 'justify-center px-2' : 'px-4')}>
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-500 text-[15px] font-bold text-white">S</div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-[14px] leading-tight font-semibold text-white">SIKOTIS</p>
              <p className="truncate text-[10.5px] leading-tight text-nav-ink/80">PT Bimajaya Mustika</p>
            </div>
          )}
        </div>

        {/* Menu */}
        <nav className="flex-1 overflow-x-hidden overflow-y-auto py-3">
          {NAV_GROUPS.map((group, gi) => (
            <div key={group.title ?? `g${gi}`} className={cn(gi > 0 && 'mt-4')}>
              {group.title && !collapsed && (
                <p className="mb-1 px-4 text-[10.5px] font-semibold tracking-[.08em] text-nav-ink/55 uppercase">{group.title}</p>
              )}
              {group.title && collapsed && <div className="mx-4 mb-2 border-t border-white/8" />}
              <ul className="space-y-0.5 px-2">
                {group.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      onClick={onCloseMobile}
                      title={item.label}
                      className={({ isActive }) =>
                        cn(
                          'group flex items-center gap-2.5 rounded-md text-[13px] font-medium transition-colors',
                          collapsed ? 'justify-center px-2 py-2.5' : 'px-2.5 py-2',
                          isActive ? 'bg-brand-500 text-white' : 'text-nav-ink hover:bg-white/7 hover:text-white',
                        )
                      }
                    >
                      <item.icon size={17} className="shrink-0" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Logout ikut grup "Lainnya" sesuai struktur menu lama */}
          <ul className="mt-0.5 space-y-0.5 px-2">
            <li>
              <button
                type="button"
                onClick={onLogout}
                title="Logout"
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-md text-[13px] font-medium text-nav-ink transition-colors hover:bg-white/7 hover:text-white',
                  collapsed ? 'justify-center px-2 py-2.5' : 'px-2.5 py-2',
                )}
              >
                <LogOut size={17} className="shrink-0" />
                {!collapsed && <span>Logout</span>}
              </button>
            </li>
          </ul>
        </nav>

        <div className="shrink-0 border-t border-white/8 p-2">
          <button
            type="button"
            onClick={onToggleCollapse}
            className={cn(
              'hidden w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[12.5px] text-nav-ink transition-colors hover:bg-white/7 hover:text-white lg:flex',
              collapsed && 'justify-center px-2',
            )}
          >
            {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
            {!collapsed && <span>Sembunyikan menu</span>}
          </button>
          {!collapsed && <p className="px-2.5 pt-1 pb-0.5 text-[10.5px] text-nav-ink/45">Version 0.1</p>}
        </div>
      </aside>
    </>
  )
}
