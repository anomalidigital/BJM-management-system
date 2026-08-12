import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Role, User } from '../types'
import { authStorage } from './persistence'

interface AuthContextValue {
  user: User | null
  login: (username: string, password: string, role: Role) => Promise<void>
  logout: () => void
  /** Admin boleh ubah/hapus; Viewer hanya melihat & export (dokumen bagian 21). */
  canEdit: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

/** Prototype: password apa pun diterima, minimal 4 karakter. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => authStorage.read<User>())

  const login = useCallback(async (username: string, password: string, role: Role) => {
    await new Promise((r) => setTimeout(r, 550))
    if (!username.trim()) throw new Error('Username wajib diisi.')
    if (password.trim().length < 4) throw new Error('Password minimal 4 karakter.')
    const next: User = {
      username: username.trim(),
      name: role === 'admin' ? 'Administrator' : 'Management Viewer',
      role,
    }
    authStorage.write(next)
    setUser(next)
  }, [])

  const logout = useCallback(() => {
    authStorage.clear()
    setUser(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ user, login, logout, canEdit: user?.role === 'admin' }),
    [user, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth harus dipakai di dalam <AuthProvider>')
  return ctx
}
