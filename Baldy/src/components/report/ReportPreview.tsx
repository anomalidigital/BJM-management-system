import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { FileDown, Printer, X } from 'lucide-react'
import { Button } from '../ui/Button'
import { cn } from '../../lib/utils'

export type Orientasi = 'potret' | 'lanskap'

/** Jumlah baris tabel yang muat dalam satu lembar, menurut orientasi kertas. */
export function barisPerLembar(orientasi: Orientasi, potret = 24): number {
  return orientasi === 'lanskap' ? Math.max(8, Math.round(potret * 0.55)) : potret
}

/**
 * Menyuntikkan aturan @page sesuai orientasi yang dipilih. Ukuran halaman
 * tidak bisa diatur lewat style biasa, jadi aturannya ditulis ke <head>
 * dan dibersihkan kembali saat preview ditutup.
 */
function useUkuranHalaman(orientasi: Orientasi) {
  useEffect(() => {
    const el = document.createElement('style')
    el.dataset.cetak = 'ukuran-halaman'
    el.textContent =
      orientasi === 'lanskap'
        ? '@page { size: A4 landscape; margin: 10mm 12mm 12mm 12mm; }'
        : '@page { size: A4 portrait; margin: 12mm 10mm 14mm 10mm; }'
    document.head.appendChild(el)
    return () => {
      el.remove()
    }
  }, [orientasi])
}

/**
 * Kerangka layar Preview Laporan: pengaturan di kiri (opsional), lembar A4 di
 * kanan, dan action bar berisi Print / Export PDF.
 *
 * Keduanya memakai pipeline cetak browser — "Export PDF" berarti memilih
 * "Save as PDF" pada tujuan printer, sehingga hasilnya sama dengan preview.
 */
export function ReportPreview({
  onClose,
  onPrint,
  settings,
  children,
  closeLabel = 'Tutup Preview',
  orientasiAwal = 'potret',
  orientasiTetap,
}: {
  onClose: () => void
  onPrint: () => void
  settings?: ReactNode
  /** Boleh berupa fungsi agar isi laporan menyesuaikan orientasi kertas. */
  children: ReactNode | ((orientasi: Orientasi) => ReactNode)
  closeLabel?: string
  orientasiAwal?: Orientasi
  /** Kunci orientasi dan sembunyikan pilihannya — untuk dokumen resmi
   *  yang tata letaknya memang hanya benar pada satu orientasi. */
  orientasiTetap?: Orientasi
}) {
  const [dipilih, setDipilih] = useState<Orientasi>(orientasiAwal)
  const orientasi = orientasiTetap ?? dipilih
  useUkuranHalaman(orientasi)

  return (
    <div className="print-shell fixed inset-0 z-[80] flex flex-col bg-page">
      <header className="no-print flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-hairline bg-surface px-4 py-2.5 lg:px-6">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup preview"
            className="rounded-md p-1.5 text-ink-3 transition hover:bg-sunken hover:text-ink"
          >
            <X size={18} />
          </button>
          <div>
            <p className="text-[14px] leading-tight font-semibold text-ink">Preview Laporan</p>
            <p className="text-[11.5px] leading-tight text-ink-3">Tampilan di bawah sama persis dengan hasil cetak / PDF.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Pilihan orientasi kertas */}
          {!orientasiTetap && (
          <div className="flex items-center rounded-md border border-hairline bg-surface p-0.5">
            {(['potret', 'lanskap'] as const).map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => setDipilih(o)}
                className={cn(
                  'rounded px-2.5 py-1 text-[12.5px] font-medium capitalize transition-colors',
                  orientasi === o ? 'bg-brand-500 text-white' : 'text-ink-2 hover:bg-sunken',
                )}
              >
                {o}
              </button>
            ))}
          </div>
          )}
          <Button onClick={onClose}>{closeLabel}</Button>
          <Button icon={<FileDown size={15} />} onClick={onPrint}>
            Export PDF
          </Button>
          <Button variant="primary" icon={<Printer size={15} />} onClick={onPrint}>
            Print
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {settings && (
          <aside className="no-print hidden w-64 shrink-0 overflow-y-auto border-r border-hairline bg-surface p-4 lg:block">
            {settings}
          </aside>
        )}
        <div className="print-scroll min-w-0 flex-1 overflow-auto p-5 lg:p-8" data-orientasi={orientasi}>
          <div className="space-y-6 print:space-y-0">
            {typeof children === 'function' ? children(orientasi) : children}
          </div>
          <p className="no-print mx-auto mt-6 max-w-[210mm] text-center text-[11.5px] leading-relaxed text-ink-3">
            Untuk menyimpan sebagai PDF: klik <span className="font-medium text-ink-2">Export PDF</span>, lalu pilih tujuan{' '}
            <span className="font-medium text-ink-2">Save as PDF</span> pada dialog cetak browser.
          </p>
        </div>
      </div>
    </div>
  )
}
