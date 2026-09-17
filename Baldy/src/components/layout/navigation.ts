import {
  BadgeDollarSign, FileSpreadsheet, FileText, FolderKanban, LayoutDashboard, Percent, Receipt,
  Route as RouteIcon, Search, Settings2, TrendingUp, Truck, Users, Wallet,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface NavItem {
  label: string
  to: string
  icon: LucideIcon
}

export interface NavGroup {
  /** Judul grup; kosong berarti item berdiri sendiri (Dashboard). */
  title?: string
  items: NavItem[]
}

/** Struktur navigasi utama aplikasi. */
export const NAV_GROUPS: NavGroup[] = [
  {
    items: [{ label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard }],
  },
  {
    title: 'Master',
    items: [
      { label: 'Data Sopir', to: '/master/sopir', icon: Users },
      { label: 'Data Mobil', to: '/master/mobil', icon: Truck },
      { label: 'Data Route', to: '/master/route', icon: RouteIcon },
      { label: 'Data Project', to: '/master/project', icon: FolderKanban },
      { label: 'Komisi', to: '/master/komisi', icon: Percent },
    ],
  },
  {
    title: 'Transaksi',
    items: [
      { label: 'Surat Jalan', to: '/transaksi/surat-jalan', icon: FileText },
      { label: 'Data Pengeluaran', to: '/transaksi/komisi', icon: Truck },
      { label: 'Data Tagihan', to: '/transaksi/tagihan', icon: Receipt },
    ],
  },
  {
    title: 'Lap. Bulan Ini',
    items: [
      { label: 'Komisi Bulan Berjalan', to: '/laporan/komisi', icon: BadgeDollarSign },
      { label: 'Netto Bulan Berjalan', to: '/laporan/netto', icon: TrendingUp },
      { label: 'Cek Ritan Bulan Ini', to: '/laporan/ritan', icon: FileSpreadsheet },
      { label: 'Rekap Uang Jalan', to: '/laporan/uang-jalan', icon: Wallet },
      { label: 'Rekap Biaya Operasional', to: '/laporan/biaya', icon: Receipt },
    ],
  },
  {
    title: 'Pencarian',
    items: [{ label: 'SI / Job Order', to: '/pencarian/sijo', icon: Search }],
  },
  {
    title: 'Lainnya',
    items: [{ label: 'Tools', to: '/tools', icon: Settings2 }],
  },
]

/**
 * Cari tujuan untuk satu label breadcrumb.
 * Judul grup (mis. "Master") diarahkan ke halaman pertama grup itu, label menu
 * diarahkan ke halamannya sendiri. Dipakai PageHeader supaya seluruh breadcrumb
 * bisa diklik tanpa tiap halaman perlu menuliskan path-nya satu per satu.
 */
export function findNavHref(label: string): string | undefined {
  const cari = label.trim().toLowerCase()
  for (const g of NAV_GROUPS) {
    if (g.title && g.title.toLowerCase() === cari) return g.items[0]?.to
    for (const it of g.items) if (it.label.toLowerCase() === cari) return it.to
  }
  return undefined
}
