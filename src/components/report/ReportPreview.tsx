import type { ReactNode } from 'react'
import { FileDown, Printer, X } from 'lucide-react'
import { Button } from '../ui/Button'

/**
 * Kerangka layar "Preview Laporan": panel pengaturan di kiri (opsional),
 * lembar A4 di kanan, dan action bar berisi Cetak / Export PDF.
 *
 * Keduanya memakai pipeline print browser -- "Export PDF" = pilih
 * "Save as PDF" pada tujuan printer, sehingga hasilnya identik dengan preview.
 */
export function ReportPreview({
  onClose,
  onPrint,
  settings,
  children,
  closeLabel = 'Tutup Preview',
}: {
  onClose: () => void
  onPrint: () => void
  settings?: ReactNode
  children: ReactNode
  closeLabel?: string
}) {
  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-page">
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
        <div className="flex items-center gap-2">
          <Button onClick={onClose}>{closeLabel}</Button>
          <Button icon={<FileDown size={15} />} onClick={onPrint}>
            Export PDF
          </Button>
          <Button variant="primary" icon={<Printer size={15} />} onClick={onPrint}>
            Cetak
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {settings && (
          <aside className="no-print hidden w-64 shrink-0 overflow-y-auto border-r border-hairline bg-surface p-4 lg:block">
            {settings}
          </aside>
        )}
        <div className="min-w-0 flex-1 overflow-auto p-5 lg:p-8">
          <div className="space-y-6 print:space-y-0">{children}</div>
          <p className="no-print mx-auto mt-6 max-w-[210mm] text-center text-[11.5px] leading-relaxed text-ink-3">
            Untuk menyimpan sebagai PDF: klik <span className="font-medium text-ink-2">Export PDF</span>, lalu pilih tujuan{' '}
            <span className="font-medium text-ink-2">Save as PDF</span> pada dialog cetak browser.
          </p>
        </div>
      </div>
    </div>
  )
}
