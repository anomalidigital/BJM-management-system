import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Role, User } from '../types'
import { authStorage } from './persistence'

/** Aksi yang dibatasi per peran. */
export type Aksi = 'trip' | 'master' | 'biaya' | 'override' | 'bukti' | 'batal' | 'tagihan' | 'hapus' | 'pengguna'

/**
 * Matriks izin (Meeting 17 Sep 2026). Admin hanya input/ubah trip harian; Manager boleh
 * semua kecuali hapus trip permanen & pengaturan pengguna; Owner boleh semua.
 */
export const IZIN: Record<Aksi, { label: string; peran: Role[] }> = {
  trip: { label: 'Input / ubah trip harian (termasuk uang jalan)', peran: ['owner', 'manager', 'admin'] },
  master: { label: 'Tambah rute & data master', peran: ['owner', 'manager'] },
  biaya: { label: 'Tambah biaya tambahan (biaya operasional & internal)', peran: ['owner', 'manager'] },
  override: { label: 'Override biaya (harga di luar Harga route, uang jalan di atas patokan)', peran: ['owner', 'manager'] },
  bukti: { label: 'Upload bukti persetujuan', peran: ['owner', 'manager'] },
  batal: { label: 'Batalkan trip', peran: ['owner', 'manager'] },
  tagihan: { label: 'Buat PI & ubah tahap tagihan', peran: ['owner', 'manager'] },
  hapus: { label: 'Hapus trip permanen', peran: ['owner'] },
  pengguna: { label: 'Pengaturan pengguna & peran', peran: ['owner'] },
}

interface AuthContextValue {
  user: User | null
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => authStorage.read<User>())

  const login = useCallback(async (username: string, password: string) => {
    await new Promise((r) => setTimeout(r, 550))
    const nama = username.trim()
    if (!nama) throw new Error('Username wajib diisi.')
    if (password.trim().length < 4) throw new Error('Password minimal 4 karakter.')
    const akun = AKUN[nama.toLowerCase()]
    const next: User = {
      username: nama,
      name: akun?.name ?? nama,
      role: akun?.role ?? 'admin',
    }
    authStorage.write(next)
    setUser(next)
  }, [])

  const logout = useCallback(() => {
    authStorage.clear()
    setUser(null)
  }, [])

  const value = useMemo<AuthContextValue>(() => {
    const peran: Role | undefined = user?.role
    const bisa = (aksi: Aksi) => !!peran && IZIN[aksi].peran.includes(peran)
    return { user, login, logout, bisa, canEdit: bisa('master') }
  }, [user, login, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth harus dipakai di dalam <AuthProvider>')
  return ctx
}
