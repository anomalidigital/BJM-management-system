import {
  FaBuilding, FaChartLine, FaFileInvoiceDollar, FaGaugeHigh, FaListCheck, FaMagnifyingGlass, FaPercent,
  FaReceipt, FaRoute, FaSackDollar, FaScrewdriverWrench, FaTruck, FaTruckFast, FaUsers, FaWallet,
} from '../ui/icons'
import type { IconComponent } from '../ui/icons'

export interface NavItem {
  label: string
  to: string
  icon: IconComponent
}

export interface NavGroup {
  /** Judul grup; kosong berarti item berdiri sendiri (Dashboard). */
  title?: string
  items: NavItem[]
}

/** Struktur navigasi utama aplikasi. */
export const NAV_GROUPS: NavGroup[] = [
  {
    items: [{ label: 'Dashboard', to: '/dashboard', icon: FaGaugeHigh }],
  },
  {
    title: 'Master',
    items: [
      { label: 'Data Karyawan', to: '/master/karyawan', icon: FaUsers },
      { label: 'Data Mobil', to: '/master/mobil', icon: FaTruck },
      { label: 'Data Route', to: '/master/route', icon: FaRoute },
      { label: 'Klien', to: '/master/klien', icon: FaBuilding },
      { label: 'Komisi', to: '/master/komisi', icon: FaPercent },
    ],
  },
  {
    title: 'Transaksi',
    items: [
      { label: 'Trip', to: '/transaksi/trip', icon: FaTruckFast },
      { label: 'Data Tagihan', to: '/transaksi/tagihan', icon: FaFileInvoiceDollar },
    ],
  },
  {
    title: 'Invoice',
    items: [
      { label: 'Komisi Bulan Berjalan', to: '/laporan/komisi', icon: FaSackDollar },
      { label: 'Netto Bulan Berjalan', to: '/laporan/netto', icon: FaChartLine },
      { label: 'Cek Ritan Bulan Ini', to: '/laporan/ritan', icon: FaListCheck },
      { label: 'Rekap Uang Jalan', to: '/laporan/uang-jalan', icon: FaWallet },
      { label: 'Rekap Biaya Operasional', to: '/laporan/biaya', icon: FaReceipt },
    ],
  },
  {
    title: 'Pencarian',
    items: [{ label: 'SI / Job Order', to: '/pencarian/sijo', icon: FaMagnifyingGlass }],
  },
  {
    title: 'Lainnya',
    items: [{ label: 'Tools', to: '/tools', icon: FaScrewdriverWrench }],
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
