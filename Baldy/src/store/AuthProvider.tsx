import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Pengguna, Role, User } from '../types'
import { authStorage, usersStorage } from './persistence'
import { nowISO } from '../lib/utils'

/** Aksi yang dibatasi per peran. */
export type Aksi = 'trip' | 'nota' | 'master' | 'biaya' | 'override' | 'bukti' | 'batal' | 'tagihan' | 'komisi' | 'audit' | 'hapus' | 'pengguna'

/**
 * Matriks izin (Meeting 17 Sep 2026). Admin hanya input/ubah trip harian; Manager boleh
 * semua kecuali hapus trip permanen & pengaturan pengguna; Owner boleh semua.
 */
export const IZIN: Record<Aksi, { label: string; peran: Role[] }> = {
  trip: { label: 'Input / ubah trip harian (termasuk uang jalan)', peran: ['owner', 'manager', 'admin'] },
  // 12 Okt 2026: admin yang menerima kabar supir tiap hari boleh mencatat nota biaya operasional.
  nota: { label: 'Catat nota biaya operasional (tol, solar, SPSI, overnight, ...)', peran: ['owner', 'manager', 'admin'] },
  master: { label: 'Tambah rute & data master', peran: ['owner', 'manager'] },
  biaya: { label: 'Biaya internal, hapus nota, dan ubah status ditagihkan / dibayar oleh', peran: ['owner', 'manager'] },
  override: { label: 'Override biaya (harga di luar Harga Rute, uang jalan di atas patokan)', peran: ['owner', 'manager'] },
  bukti: { label: 'Upload bukti persetujuan', peran: ['owner', 'manager'] },
  batal: { label: 'Batalkan trip', peran: ['owner', 'manager'] },
  tagihan: { label: 'Buat PI & ubah tahap tagihan', peran: ['owner', 'manager'] },
  // Catatan Ibu Anne di Komisi: "super admin bisa edit, manager view only" (super admin = Owner).
  komisi: { label: 'Ubah aturan komisi', peran: ['owner'] },
  audit: { label: 'Lihat Audit Log', peran: ['owner', 'manager'] },
  hapus: { label: 'Hapus trip permanen', peran: ['owner'] },
  pengguna: { label: 'Pengaturan pengguna & peran', peran: ['owner'] },
}

interface AuthContextValue {
  user: User | null
  /** Daftar akun (Pengaturan -> Pengguna & Peran). */
  pengguna: Pengguna[]
  /** Tambah atau ubah akun; `usernameLama` dipakai bila username diganti. */
  simpanPengguna: (p: Pick<Pengguna, 'username' | 'name' | 'role' | 'aktif'>, usernameLama?: string) => void
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  /** Boleh melakukan aksi ini dengan peran sekarang? */
  bisa: (aksi: Aksi) => boolean
  /** Kelola data master, tagihan, kasbon, komisi (Owner & Manager). */
  canEdit: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

/**
 * Daftar akun. Peran melekat pada akun, bukan dipilih saat masuk.
 * Akun yang tidak terdaftar diperlakukan sebagai Admin selama autentikasi
 * masih disimulasikan.
 */
export const AKUN: Record<string, { name: string; role: Role }> = {
  owner: { name: 'Owner', role: 'owner' },
  manager: { name: 'Manager Operasional', role: 'manager' },
  admin: { name: 'Admin Harian', role: 'admin' },
  viewer: { name: 'Management Viewer', role: 'viewer' },
  management: { name: 'Management Viewer', role: 'viewer' },
}

/** Akun awal Pengguna & Peran, dari daftar AKUN. */
function penggunaAwal(): Pengguna[] {
  const waktu = nowISO()
  return Object.entries(AKUN).map(([username, a]) => ({ username, name: a.name, role: a.role, aktif: true, created_at: waktu, updated_at: waktu }))
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => authStorage.read<User>())
  const [pengguna, setPengguna] = useState<Pengguna[]>(() => usersStorage.read<Pengguna[]>() ?? penggunaAwal())
  useEffect(() => usersStorage.write(pengguna), [pengguna])

  const login = useCallback(async (username: string, password: string) => {
    await new Promise((r) => setTimeout(r, 550))
    const nama = username.trim()
    if (!nama) throw new Error('Username wajib diisi.')
    if (password.trim().length < 4) throw new Error('Password minimal 4 karakter.')
    const akun = pengguna.find((p) => p.username.toLowerCase() === nama.toLowerCase())
    if (akun && !akun.aktif) throw new Error('Akun ini dinonaktifkan. Hubungi Owner.')
    const next: User = {
      username: akun?.username ?? nama,
      name: akun?.name ?? nama,
      role: akun?.role ?? 'admin',
    }
    authStorage.write(next)
    setUser(next)
  }, [pengguna])

  const simpanPengguna = useCallback((p: Pick<Pengguna, 'username' | 'name' | 'role' | 'aktif'>, usernameLama?: string) => {
    const waktu = nowISO()
    const kunci = (usernameLama ?? p.username).toLowerCase()
    setPengguna((prev) => {
      const ada = prev.find((x) => x.username.toLowerCase() === kunci)
      return ada
        ? prev.map((x) => (x === ada ? { ...x, ...p, updated_at: waktu } : x))
        : [...prev, { ...p, created_at: waktu, updated_at: waktu }]
    })
    // Akun yang sedang masuk ikut diperbarui (nama / peran).
    setUser((u) => {
      if (!u || u.username.toLowerCase() !== kunci) return u
      const next: User = { username: p.username, name: p.name, role: p.role }
      authStorage.write(next)
      return next
    })
  }, [])

  const logout = useCallback(() => {
    authStorage.clear()
    setUser(null)
  }, [])

  const value = useMemo<AuthContextValue>(() => {
    const peran: Role | undefined = user?.role
    const bisa = (aksi: Aksi) => !!peran && IZIN[aksi].peran.includes(peran)
    return { user, pengguna, simpanPengguna, login, logout, bisa, canEdit: bisa('master') }
  }, [user, pengguna, simpanPengguna, login, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth harus dipakai di dalam <AuthProvider>')
  return ctx
}
