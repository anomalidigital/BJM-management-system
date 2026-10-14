import { useState } from 'react'
import { Radio } from '../ui/Field'
import { ReportPreview } from './ReportPreview'
import { PrintDocument } from './PrintDocument'
import { SuratJalanDocument } from './SuratJalanDocument'
import { BeritaAcaraDocument } from './BeritaAcaraDocument'
import type { TransactionRow } from '../../types'

type Template = 'logo' | 'nologo'

/**
 * Alur cetak Surat Jalan: klik "Cetak" langsung membuka preview, pilihan template
 * ada di panel kiri preview; printer baru dipanggil dari tombol Cetak / PDF di sana
 * (addendum bagian 21: klik "Cetak" tidak pernah langsung memanggil printer).
 * Trip Karawang dicetak sebagai Berita Acara Serah Terima Barang (format Meeting 2),
 * satu lembar A4 per trip; trip Priok sebagai Surat Jalan.
 */
export function SuratJalanPrintFlow({
  notes,
  open,
  onClose,
  onPrinted,
}: {
  notes: TransactionRow[]
  open: boolean
  onClose: () => void
  onPrinted?: (ids: string[]) => void
}) {
  const [template, setTemplate] = useState<Template>('logo')

  if (!open || notes.length === 0) return null
  /** Seluruh dokumen dari Karawang: istilahnya Berita Acara. */
  const ba = notes.every((n) => n.workspace === 'karawang')
  const nama = ba ? 'Berita Acara' : 'Surat Jalan'

  function doPrint() {
    onPrinted?.(notes.map((n) => n.id))
    window.print()
  }

  return (
    <ReportPreview
      onClose={onClose}
      onPrint={doPrint}
      orientasiTetap="potret"
      settings={
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-[12px] font-semibold tracking-wide text-ink-2">Template</p>
            <div className="space-y-2">
              <Radio
                name="tpl-preview"
                label="Dengan Logo"
                description="Kop surat lengkap dengan logo perusahaan."
                checked={template === 'logo'}
                onChange={() => setTemplate('logo')}
              />
              <Radio
                name="tpl-preview"
                label="Tanpa Logo"
                description="Kop teks saja, untuk kertas berkop."
                checked={template === 'nologo'}
                onChange={() => setTemplate('nologo')}
              />
            </div>
          </div>
          <div className="rounded-lg border border-hairline bg-sunken p-3">
            <p className="text-[12px] font-semibold text-ink-2">{notes.length} dokumen</p>
            <ul className="tnum mt-1.5 max-h-56 space-y-0.5 overflow-y-auto text-[11.5px] text-ink-3">
              {notes.map((n) => (
                // Karawang: ID Trip (Kode Trip) dan plat.
                <li key={n.id} className="break-all">{n.workspace === 'karawang' ? [n.id_tampil, n.plate_number].filter(Boolean).join(' · ') : n.sj_no || n.transaction_no}</li>
              ))}
            </ul>
          </div>
          <p className="text-[11.5px] leading-relaxed text-ink-3">
            {notes.length > 1
              ? `${notes.length} ${nama} dicetak berurutan, satu dokumen per halaman A4${ba ? ', satu untuk tiap mobil' : ''}.`
              : `${nama} dicetak pada satu halaman A4.`}
            {ba && ' Isian yang belum ada di sistem dicetak titik-titik untuk diisi tangan.'}
          </p>
        </div>
      }
    >
      <PrintDocument>
        {notes.map((n) => (n.workspace === 'karawang'
          ? <BeritaAcaraDocument key={n.id} note={n} withLogo={template === 'logo'} />
          : <SuratJalanDocument key={n.id} note={n} withLogo={template === 'logo'} />
        ))}
      </PrintDocument>
    </ReportPreview>
  )
}
