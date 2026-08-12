import { useState } from 'react'
import { Navigate, Outlet, useNavigate } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { ConfirmDialog } from '../ui/Modal'
import { useAuth } from '../../store/AuthProvider'
import { cn } from '../../lib/utils'

/** Kerangka aplikasi: sidebar + topbar + area konten. */
export function AppShell() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)

  if (!user) return <Navigate to="/login" replace />

  function doLogout() {
    setConfirmLogout(false)
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-page">
      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((c) => !c)}
        onLogout={() => setConfirmLogout(true)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className={cn('flex min-h-screen flex-col transition-[padding] duration-200', collapsed ? 'lg:pl-[68px]' : 'lg:pl-[248px]')}>
        <Topbar onOpenMobileNav={() => setMobileOpen(true)} onLogout={() => setConfirmLogout(true)} />
        <main className="flex-1 px-4 py-5 lg:px-6 lg:py-6">
          <Outlet />
        </main>
      </div>

      <ConfirmDialog
        open={confirmLogout}
        title="Keluar dari SIKOTIS?"
        message="Anda akan kembali ke halaman login. Data dummy yang tersimpan tidak akan terhapus."
        confirmLabel="Logout"
        tone="primary"
        onCancel={() => setConfirmLogout(false)}
        onConfirm={doLogout}
      />
    </div>
  )
}
