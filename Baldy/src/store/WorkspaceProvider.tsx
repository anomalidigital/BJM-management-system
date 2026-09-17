import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Workspace } from '../types'
import { WORKSPACES } from '../types'
import { workspaceStorage } from './persistence'
import { useAuth } from './AuthProvider'

/**
 * Satu tema = seluruh token warna yang berganti mengikuti workspace.
 * Disimpan sebagai data (bukan aturan CSS per workspace) supaya menambah
 * workspace baru cukup menambah satu baris di WORKSPACE_LIST.
 */
type Tema = Record<string, string>

const TEMA_BIRU: Tema = {
  '--color-brand-50': '#eff6ff', '--color-brand-100': '#cde2fb', '--color-brand-200': '#9ec5f4',
  '--color-brand-300': '#6da7ec', '--color-brand-400': '#3987e5', '--color-brand-500': '#2a78d6',
  '--color-brand-600': '#256abf', '--color-brand-700': '#1c5cab', '--color-brand-800': '#184f95',
  '--color-brand-900': '#0d366b',
  '--color-nav-900': '#0d1523', '--color-nav-800': '#131d2f', '--color-nav-700': '#1c2942',
  '--color-nav-ink': '#93a1b8', '--color-series-1': '#2a78d6',
}

const TEMA_UNGU: Tema = {
  '--color-brand-50': '#f3f0ff', '--color-brand-100': '#ded6fb', '--color-brand-200': '#c2b3f5',
  '--color-brand-300': '#a48eed', '--color-brand-400': '#8465e6', '--color-brand-500': '#7050d6',
  '--color-brand-600': '#6344bf', '--color-brand-700': '#563aab', '--color-brand-800': '#4a3196',
  '--color-brand-900': '#33206b',
  '--color-nav-900': '#16102a', '--color-nav-800': '#1d1636', '--color-nav-700': '#2a1f4c',
  '--color-nav-ink': '#a296c4', '--color-series-1': '#7050d6',
}

const TEMA_TOSCA: Tema = {
  '--color-brand-50': '#edfaf6', '--color-brand-100': '#c7efe3', '--color-brand-200': '#93ddc8',
  '--color-brand-300': '#5cc7ac', '--color-brand-400': '#2cae90', '--color-brand-500': '#179a7c',
  '--color-brand-600': '#12866b', '--color-brand-700': '#0e6f59', '--color-brand-800': '#0b5b49',
  '--color-brand-900': '#073f33',
  '--color-nav-900': '#0b1c1a', '--color-nav-800': '#102523', '--color-nav-700': '#183533',
  '--color-nav-ink': '#8ba8a2', '--color-series-1': '#179a7c',
}

const TEMA_AMBAR: Tema = {
  '--color-brand-50': '#fff6ec', '--color-brand-100': '#fbe2c5', '--color-brand-200': '#f5c68e',
  '--color-brand-300': '#eca858', '--color-brand-400': '#df8b29', '--color-brand-500': '#c77716',
  '--color-brand-600': '#ae6712', '--color-brand-700': '#93560f', '--color-brand-800': '#79460c',
  '--color-brand-900': '#533009',
  '--color-nav-900': '#1d1409', '--color-nav-800': '#271c0e', '--color-nav-700': '#392a15',
  '--color-nav-ink': '#b0a084', '--color-series-1': '#c77716',
}

/** Tema dibagikan berurutan; workspace ke-5 memakai tema pertama lagi. */
const TEMA_LIST = [TEMA_BIRU, TEMA_UNGU, TEMA_TOSCA, TEMA_AMBAR]

export interface WorkspaceMeta {
  id: Workspace
  label: string
  /** Inisial untuk avatar kecil. */
  initial: string
  tema: Tema
  /** Warna utama & warna muda, dipakai untuk avatar dan aksen. */
  color: string
  colorSoft: string
}

/** Daftar workspace. Menambah cabang = menambah satu baris di sini. */
const WORKSPACE_SEED: Array<Pick<WorkspaceMeta, 'id' | 'label' | 'initial'>> = [
  { id: 'jakarta', label: 'Jakarta', initial: 'JK' },
  { id: 'tangerang', label: 'Tangerang', initial: 'TG' },
]

export const WORKSPACE_LIST: WorkspaceMeta[] = WORKSPACE_SEED.map((w, i) => {
  const tema = TEMA_LIST[i % TEMA_LIST.length]
  return { ...w, tema, color: tema['--color-brand-500'], colorSoft: tema['--color-brand-300'] }
})

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
 * Menyimpan workspace aktif dan menerapkan tema warnanya ke <html>, sehingga
 * seluruh komponen ikut berganti tanpa class tambahan di tiap halaman.
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

  useEffect(() => {
    const root = document.documentElement
    const tema = workspaceMeta(workspace).tema
    for (const [token, nilai] of Object.entries(tema)) root.style.setProperty(token, nilai)
    root.dataset.workspace = workspace
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
