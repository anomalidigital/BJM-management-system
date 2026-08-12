import { useEffect, useState } from 'react'
import { FileDown, Printer } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Radio } from '../ui/Field'
import { ReportPreview } from './ReportPreview'
import { PrintDocument } from './PrintDocument'
import { SuratJalanDocument } from './SuratJalanDocument'
import type { DeliveryNoteRow } from '../../types'

type Template = 'logo' | 'nologo'
type Output = 'print' | 'pdf'
type Stage = 'settings' | 'preview'

/**
 * Alur cetak Surat Jalan: Print Settings -> Preview -> Print / PDF.
 * Klik "Cetak" tidak pernah langsung memanggil printer (addendum bagian 21).
 */
export function SuratJalanPrintFlow({
  notes,
  open,
  onClose,
  onPrinted,
}: {
  notes: DeliveryNoteRow[]
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
                  <li key={n.id}>{n.sj_no}</li>
                ))}
              </ul>
            </div>
            <p className="text-[11.5px] leading-relaxed text-ink-3">
              Setiap Surat Jalan dicetak pada halaman A4 tersendiri.
            </p>
          </div>
        }
      >
        <PrintDocument>
          {notes.map((n, i) => (
            <SuratJalanDocument key={n.id} note={n} withLogo={template === 'logo'} breakAfter={i < notes.length - 1} />
          ))}
        </PrintDocument>
      </ReportPreview>
    )
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Cetak Surat Jalan"
      subtitle={`${notes.length} dokumen dipilih`}
      size="sm"
      footer={
        <>
          <Button onClick={onClose}>Batal</Button>
          <Button variant="primary" icon={output === 'pdf' ? <FileDown size={15} /> : <Printer size={15} />} onClick={() => setStage('preview')}>
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
            {notes.length} Surat Jalan akan dicetak berurutan, satu dokumen per halaman.
          </p>
        )}
      </div>
    </Modal>
  )
}
