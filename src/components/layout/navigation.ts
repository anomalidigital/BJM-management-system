import {
  BadgeDollarSign, FileSpreadsheet, FileText, FolderKanban, LayoutDashboard, Receipt,
  Route as RouteIcon, Search, Settings2, TrendingUp, Truck, Users, Wallet,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface NavItem {
  label: string
  to: string
  icon: LucideIcon
  /** Nama window aplikasi lama, ditampilkan sebagai tooltip. */
  legacy?: string
}

export interface NavGroup {
  /** Judul grup; kosong berarti item berdiri sendiri (Dashboard). */
  title?: string
  items: NavItem[]
}

/** Struktur navigasi sesuai dokumen bagian 2 (istilah "Lap. Bulan Ini" dipertahankan). */
export const NAV_GROUPS: NavGroup[] = [
  {
    items: [{ label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard }],
  },
  {
    title: 'Master',
    items: [
      { label: 'Data Sopir', to: '/master/sopir', icon: Users, legacy: 'PENGISIAN DATA SOPIR' },
      { label: 'Data Mobil', to: '/master/mobil', icon: Truck },
      { label: 'Data Route', to: '/master/route', icon: RouteIcon, legacy: 'Pengisian Data Route' },
      { label: 'Data Project', to: '/master/project', icon: FolderKanban },
    ],
  },
  {
    title: 'Transaksi',
    items: [
      { label: 'Surat Jalan', to: '/transaksi/surat-jalan', icon: FileText, legacy: 'Cetak Surat Jalan' },
      { label: 'Data Komisi', to: '/transaksi/komisi', icon: Truck, legacy: 'Pengisian Data Surat Jalan' },
      { label: 'Data Tagihan', to: '/transaksi/tagihan', icon: Receipt, legacy: 'Pemrosesan file data SI / JO' },
    ],
  },
  {
    title: 'Lap. Bulan Ini',
    items: [
      { label: 'Komisi Bulan Berjalan', to: '/laporan/komisi', icon: BadgeDollarSign, legacy: 'Cetak Komisi Bulan Berjalan' },
      { label: 'Netto Bulan Berjalan', to: '/laporan/netto', icon: TrendingUp, legacy: 'Pendapatan Netto Bulan Berjalan' },
      { label: 'Cek Ritan Bulan Ini', to: '/laporan/ritan', icon: FileSpreadsheet, legacy: 'Driver Reports - Ritan Sopir' },
      { label: 'Rekap Uang Jalan', to: '/laporan/uang-jalan', icon: Wallet },
      { label: 'Rekap Biaya Operasional', to: '/laporan/biaya', icon: Receipt },
    ],
  },
  {
    title: 'Pencarian',
    items: [{ label: 'SI / Job Order', to: '/pencarian/sijo', icon: Search, legacy: 'Pencarian nomor SI - Job Order' }],
  },
  {
    title: 'Lainnya',
    items: [{ label: 'Tools', to: '/tools', icon: Settings2 }],
  },
]

/** Cari label halaman dari path, dipakai untuk judul di topbar. */
export function findNavLabel(pathname: string): string {
  for (const g of NAV_GROUPS) {
    for (const it of g.items) {
      if (pathname === it.to || pathname.startsWith(it.to + '/')) return it.label
    }
  }
  return 'SIKOTIS'
}
