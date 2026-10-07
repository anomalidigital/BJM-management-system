import { useEffect, useState } from 'react'
import { FaFileArrowDown, FaPrint } from '../ui/icons'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Radio } from '../ui/Field'
import { ReportPreview } from './ReportPreview'
import { PrintDocument } from './PrintDocument'
import { SuratJalanDocument } from './SuratJalanDocument'
import { BeritaAcaraDocument } from './BeritaAcaraDocument'
import type { TransactionRow } from '../../types'

type Template = 'logo' | 'nologo'
type Output = 'print' | 'pdf'
type Stage = 'settings' | 'preview'

/**
 * Alur cetak Surat Jalan: Print Settings -> Preview -> Print / PDF.
 * Klik "Cetak" tidak pernah langsung memanggil printer (addendum bagian 21).
 * Trip Karawang dicetak sebagai Berita Acara Serah Terima Barang (format Meeting 2),
 * trip Priok sebagai Surat Jalan.
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
  const [stage, setStage] = useState<Stage>('settings')
  const [template, setTemplate] = useState<Template>('logo')
  const [output, setOutput] = useState<Output>('print')

  useEffect(() => {
    if (open) setStage('settings')
  }, [open])

  if (!open || notes.length === 0) return null
  /** Seluruh dokumen dari Karawang: istilahnya Berita Acara. */
  const ba = notes.every((n) => n.workspace === 'karawang')
  const nama = ba ? 'Berita Acara' : 'Surat Jalan'

  function doPrint() {
    onPrinted?.(notes.map((n) => n.id))
    window.print()
  }

  if (stage === 'preview') {
    return (
      <ReportPreview
        onClose={onClose}
        onPrint={doPrint}
        closeLabel="Kembali"
        orientasiTetap="potret"
        settings={
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-[12px] font-semibold tracking-wide text-ink-2">Template</p>
              <div className="space-y-2">
                <Radio
                  name="tpl-preview"
                  label="Dengan Logo"
                  checked={template === 'logo'}
                  onChange={() => setTemplate('logo')}
                />
                <Radio
                  name="tpl-preview"
                  label="Tanpa Logo"
                  checked={template === 'nologo'}
                  onChange={() => setTemplate('nologo')}
                />
              </div>
            </div>
            <div className="rounded-lg border border-hairline bg-sunken p-3">
              <p className="text-[12px] font-semibold text-ink-2">{notes.length} dokumen</p>
              <ul className="tnum mt-1.5 max-h-56 space-y-0.5 overflow-y-auto text-[11.5px] text-ink-3">
                {notes.map((n) => (
                  <li key={n.id}>{n.workspace === 'karawang' ? [n.transaction_no, n.plate_number].filter(Boolean).join(' · ') : n.sj_no || n.transaction_no}</li>
                ))}
              </ul>
            </div>
            <p className="text-[11.5px] leading-relaxed text-ink-3">
              Setiap {nama} dicetak pada halaman A4 tersendiri.{ba && ' Isian yang belum ada di sistem dicetak titik-titik untuk diisi tangan.'}
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

  return (
    <Modal
      open
      onClose={onClose}
      title={`Cetak ${nama}`}
      subtitle={`${notes.length} dokumen dipilih`}
      size="sm"
      footer={
        <>
          <Button onClick={onClose}>Batal</Button>
          <Button variant="primary" icon={output === 'pdf' ? <FaFileArrowDown size={15} /> : <FaPrint size={15} />} onClick={() => setStage('preview')}>
            Preview
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <p className="mb-2 text-[12px] font-semibold tracking-wide text-ink-2">Template</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Radio
              name="tpl"
              label="Dengan Logo"
              description="Kop surat lengkap dengan logo perusahaan."
              checked={template === 'logo'}
              onChange={() => setTemplate('logo')}
            />
            <Radio
              name="tpl"
              label="Tanpa Logo"
              description="Kop teks saja, untuk kertas berkop."
              checked={template === 'nologo'}
              onChange={() => setTemplate('nologo')}
            />
          </div>
        </div>

        <div>
          <p className="mb-2 text-[12px] font-semibold tracking-wide text-ink-2">Output</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Radio
              name="out"
              label="Print"
              description="Kirim langsung ke printer."
              checked={output === 'print'}
              onChange={() => setOutput('print')}
            />
            <Radio
              name="out"
              label="PDF"
              description="Simpan lewat Save as PDF."
              checked={output === 'pdf'}
              onChange={() => setOutput('pdf')}
            />
          </div>
        </div>

        {notes.length > 1 && (
          <p className="rounded-md border border-hairline bg-sunken px-3 py-2.5 text-[12px] leading-relaxed text-ink-3">
            {notes.length} {nama} akan dicetak berurutan, satu dokumen per halaman{ba ? ', satu untuk tiap mobil' : ''}.
          </p>
        )}
      </div>
    </Modal>
  )
}
