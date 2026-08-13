import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { KeyRound, LogIn, ShieldCheck, TriangleAlert, User } from 'lucide-react'
import { useAuth } from '../store/AuthProvider'
import { Button } from '../components/ui/Button'
import { Field, Input, Label } from '../components/ui/Field'
import type { Role } from '../types'
import { cn } from '../lib/utils'

const ROLES: Array<{ id: Role; title: string; desc: string }> = [
  { id: 'admin', title: 'Admin', desc: 'Kelola master, transaksi, dan laporan' },
  { id: 'viewer', title: 'Viewer / Management', desc: 'Hanya melihat data dan export laporan' },
]

export function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('sikotis')
  const [role, setRole] = useState<Role>('admin')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (user) return <Navigate to="/dashboard" replace />

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await login(username, password, role)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login gagal.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid min-h-screen bg-page lg:grid-cols-[1.05fr_1fr]">
      {/* Panel brand */}
      <aside className="relative hidden flex-col justify-between bg-nav-900 p-10 text-white lg:flex">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-500 text-[17px] font-bold">S</div>
          <div>
            <p className="text-[15px] leading-tight font-semibold">SIKOTIS</p>
            <p className="text-[12px] leading-tight text-nav-ink">Sistem Komisi Otomatis</p>
          </div>
        </div>

        <div className="max-w-md">
          <h1 className="text-[30px] leading-[1.2] font-semibold tracking-tight">
            Transportation, Commission &amp; Billing Management System
          </h1>
          <p className="mt-4 text-[14px] leading-relaxed text-nav-ink">
            Kelola data sopir, route, surat jalan, komisi, dan tagihan PT Bimajaya Mustika dalam satu sistem web
            terpusat — lengkap dengan pencarian SI / Job Order, laporan bulan berjalan, dan export PDF.
          </p>
          <ul className="mt-7 space-y-2.5 text-[13px] text-nav-ink">
            {['Master data sopir & route', 'Surat Jalan + cetak dengan/tanpa logo', 'Pencarian SI / Job Order tanpa copy-paste', 'Laporan komisi, netto, dan ritan bulan ini'].map((f) => (
              <li key={f} className="flex items-center gap-2.5">
                <ShieldCheck size={15} className="shrink-0 text-brand-400" />
                {f}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-[11.5px] text-nav-ink/60">PT Bimajaya Mustika &middot; Version 0.1</p>
      </aside>

      {/* Form */}
      <main className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-[400px]">
          <div className="mb-7 lg:hidden">
            <div className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-brand-500 text-[18px] font-bold text-white">S</div>
            <p className="text-[17px] font-semibold text-ink">SIKOTIS</p>
            <p className="text-[12.5px] text-ink-3">PT Bimajaya Mustika</p>
          </div>

          <h2 className="text-[22px] leading-tight font-semibold tracking-tight text-ink">Masuk ke sistem</h2>
          <p className="mt-1.5 text-[13px] text-ink-3">Gunakan akun operasional Anda untuk melanjutkan.</p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <Field label="Username" required>
              {(id) => (
                <div className="relative">
                  <User size={15} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-3" />
                  <Input id={id} value={username} onChange={(e) => setUsername(e.target.value)} className="pl-8" autoComplete="username" />
                </div>
              )}
            </Field>

            <Field label="Password" required>
              {(id) => (
                <div className="relative">
                  <KeyRound size={15} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-3" />
                  <Input
                    id={id}
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-8"
                    autoComplete="current-password"
                  />
                </div>
              )}
            </Field>

            <div>
              <Label>Masuk sebagai</Label>
              <div className="grid grid-cols-2 gap-2">
                {ROLES.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      setRole(r.id)
                      setUsername(r.id === 'admin' ? 'admin' : 'viewer')
                    }}
                    className={cn(
                      'rounded-lg border p-2.5 text-left transition-colors',
                      role === r.id ? 'border-brand-400 bg-brand-50' : 'border-hairline bg-surface hover:border-brand-200 hover:bg-brand-50/40',
                    )}
                  >
                    <span className="block text-[13px] font-semibold text-ink">{r.title}</span>
                    <span className="mt-0.5 block text-[11.5px] leading-snug text-ink-3">{r.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-md border border-[#f3d5d5] bg-[#fdf2f2] px-3 py-2.5 text-[12.5px] font-medium text-[#b02c2c]"
              >
                <TriangleAlert size={15} className="mt-px shrink-0" />
                {error}
              </div>
            )}

            <Button type="submit" variant="primary" loading={loading} icon={<LogIn size={15} />} className="h-10 w-full">
              Masuk
            </Button>
          </form>

          <p className="mt-5 rounded-md border border-hairline bg-sunken px-3 py-2.5 text-[12px] leading-relaxed text-ink-3">
            <span className="font-semibold text-ink-2">Prototype:</span> autentikasi masih simulasi. Username apa pun
            diterima, password minimal 4 karakter. Pilih peran untuk mencoba pembatasan akses Admin vs Viewer.
          </p>
        </div>
      </main>
    </div>
  )
}
