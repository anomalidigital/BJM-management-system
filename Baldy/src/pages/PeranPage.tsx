import { PageHeader } from '../components/layout/PageHeader'
import { Card, CardHeader } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { AKUN, IZIN, useAuth } from '../store/AuthProvider'
import { ROLE_PENGGUNA } from '../types'
import type { Role } from '../types'

/** Kolom matriks: tiga peran dari meeting. Viewer tidak punya izin ubah apa pun. */
const PERAN_MATRIKS: Role[] = ['owner', 'manager', 'admin']

/**
 * Administrasi -> User & Roles (Pengaturan Peran).
 * Login masih simulasi, jadi daftar akun tetap; matriks izin yang sama dipakai
 * seluruh halaman lewat useAuth().bisa().
 */
export function PeranPage() {
  const { user } = useAuth()
  // "management" hanya nama lain akun viewer, jadi tidak ditampilkan dua kali.
  const akun = Object.entries(AKUN).filter(([username]) => username !== 'management')
  const saya = user?.username.toLowerCase()

  return (
    <>
      <PageHeader
        title="User & Roles"
        crumbs={[{ label: 'Administrasi' }, { label: 'User & Roles' }]}
        description="Akun yang bisa masuk dan izin tiap peran. Menambah atau mengubah pengguna nanti hanya untuk Owner."
      />

      <div className="grid items-start gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader title="Pengguna" subtitle="Peran melekat pada akun, bukan dipilih saat masuk." />
          <ul className="divide-y divide-grid">
            {akun.map(([username, a]) => (
              <li key={username} className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-ink">
                    {a.name}
                    {saya === username && <span className="ml-1.5 text-[11.5px] font-normal text-ink-3">(Anda)</span>}
                  </p>
                  <p className="text-[12px] text-ink-3">Username <span className="font-medium text-ink-2">{username}</span></p>
                </div>
                <div className="shrink-0 text-right">
                  <Badge tone={a.role === 'viewer' ? 'neutral' : 'brand'}>{ROLE_PENGGUNA[a.role].label}</Badge>
                  <p className="mt-1 text-[11.5px] text-ink-3">{ROLE_PENGGUNA[a.role].ringkas}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="border-t border-hairline px-4 py-2.5 text-[11.5px] text-ink-3">
            Selama login masih simulasi, username lain masuk sebagai Admin. Password bebas, minimal 4 karakter.
          </p>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader
            title="Izin per peran"
            subtitle={`Anda masuk sebagai ${user ? ROLE_PENGGUNA[user.role].label : '—'}. Viewer hanya melihat dan export.`}
          />
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-hairline text-ink-3">
                <th className="px-4 py-2 text-left font-medium">Aksi</th>
                {PERAN_MATRIKS.map((r) => <th key={r} className="w-24 px-2 py-2 text-center font-medium">{ROLE_PENGGUNA[r].label}</th>)}
              </tr>
            </thead>
            <tbody>
              {Object.entries(IZIN).map(([aksi, izin]) => (
                <tr key={aksi} className="border-b border-grid last:border-0">
                  <td className="px-4 py-2 text-ink-2">{izin.label}</td>
                  {PERAN_MATRIKS.map((r) => (
                    <td key={r} className="px-2 py-2 text-center">
                      {izin.peran.includes(r)
                        ? <span className="font-semibold text-[#0a7d0a]" aria-label="boleh">✓</span>
                        : <span className="text-ink-3" aria-label="tidak boleh">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  )
}
