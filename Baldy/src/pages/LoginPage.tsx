import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, KeyRound, LogIn, ShieldCheck, TriangleAlert, User } from 'lucide-react'
import { useAuth } from '../store/AuthProvider'
import { Button } from '../components/ui/Button'
import { Field, Input } from '../components/ui/Field'

export function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('sikotis')
  const [lihatPassword, setLihatPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (user) return <Navigate to="/dashboard" replace />

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await login(username, password)
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
                    type={lihatPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-9 pl-8"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setLihatPassword((v) => !v)}
                    aria-label={lihatPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                    title={lihatPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                    className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded p-1.5 text-ink-3 transition hover:bg-sunken hover:text-ink"
                  >
                    {lihatPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              )}
            </Field>


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

        </div>
      </main>
    </div>
  )
}
