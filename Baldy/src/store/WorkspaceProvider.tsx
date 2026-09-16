import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Workspace } from '../types'
import { WORKSPACES } from '../types'
import { workspaceStorage } from './persistence'
import { useAuth } from './AuthProvider'

export interface WorkspaceMeta {
  id: Workspace
  /** Nama yang tampil di tombol switch. */
  label: string
  /** Inisial untuk mode sidebar tertutup. */
  initial: string
  /** Warna identitas: Jakarta biru, Tangerang biru-ungu. */
  color: string
  colorSoft: string
}

export const WORKSPACE_LIST: WorkspaceMeta[] = [
  { id: 'jakarta', label: 'Jakarta', initial: 'JK', color: '#2a78d6', colorSoft: '#6da7ec' },
  { id: 'tangerang', label: 'Tangerang', initial: 'TG', color: '#7050d6', colorSoft: '#a38fec' },
]

export function workspaceMeta(id: Workspace): WorkspaceMeta {
  return WORKSPACE_LIST.find((w) => w.id === id) ?? WORKSPACE_LIST[0]
}

/** Workspace bawaan setiap kali login. */
export const DEFAULT_WORKSPACE: Workspace = 'jakarta'

interface WorkspaceContextValue {
  workspace: Workspace
  meta: WorkspaceMeta
  setWorkspace: (next: Workspace) => void
  /** true selama animasi pergantian warna berjalan. */
  switching: boolean
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

function isWorkspace(v: unknown): v is Workspace {
  return typeof v === 'string' && (WORKSPACES as readonly string[]).includes(v)
}

/**
 * Menyimpan workspace aktif dan menempelkannya ke <html data-workspace="...">,
 * sehingga seluruh token warna aplikasi ikut berganti (lihat index.css).
 * Harus berada di dalam <AuthProvider> karena login selalu kembali ke Jakarta.
 */
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [workspace, setWs] = useState<Workspace>(() => {
    const stored = workspaceStorage.read()
    return isWorkspace(stored) ? stored : DEFAULT_WORKSPACE
  })
  const [switching, setSwitching] = useState(false)
  const lastUser = useRef<string | null>(user?.username ?? null)

  // Setiap login baru selalu masuk ke workspace Jakarta.
  useEffect(() => {
    const now = user?.username ?? null
    if (now && now !== lastUser.current) {
      setWs(DEFAULT_WORKSPACE)
      workspaceStorage.write(DEFAULT_WORKSPACE)
    }
    lastUser.current = now
  }, [user])

  // Token warna dipilih lewat atribut di <html>, bukan class di tiap komponen.
  useEffect(() => {
    document.documentElement.dataset.workspace = workspace
  }, [workspace])

  const setWorkspace = useCallback((next: Workspace) => {
    setWs((prev) => {
      if (prev === next) return prev
      // Kelas sementara ini yang membuat perubahan warna ter-animasi halus.
      document.documentElement.classList.add('ws-switching')
      setSwitching(true)
      workspaceStorage.write(next)
      return next
    })
  }, [])

  useEffect(() => {
    if (!switching) return
    const t = window.setTimeout(() => {
      document.documentElement.classList.remove('ws-switching')
      setSwitching(false)
    }, 850)
    return () => window.clearTimeout(t)
  }, [switching])

  const value = useMemo<WorkspaceContextValue>(
    () => ({ workspace, meta: workspaceMeta(workspace), setWorkspace, switching }),
    [workspace, setWorkspace, switching],
  )

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error('useWorkspace harus dipakai di dalam <WorkspaceProvider>')
  return ctx
}
