/** Peringatan "mirip kode lain" di bawah kolom kode area (form Alamat). */
import { FaTriangleExclamation } from '../../components/ui/icons'
import { teksPakai } from '../../lib/kodeArea'
import type { PakaiKode } from '../../lib/kodeArea'

/** Peringatan "mirip kode lain" di bawah kolom kode area, dengan tombol untuk memakai kode yang disarankan. */
export function PeringatanKodeMirip({ saran, onPakai }: { saran: { kode: string; pakai: PakaiKode }; onPakai: () => void }) {
  return (
    <span className="text-[#8a6100]">
      <FaTriangleExclamation size={11} className="mr-1 inline align-[-1px]" />
      Mirip <span className="font-semibold">{saran.kode}</span> yang sudah dipakai {teksPakai(saran.pakai)}. Salah ketik?{' '}
      <button type="button" onClick={onPakai} className="font-semibold underline underline-offset-2 hover:text-ink">Pakai {saran.kode}</button>
    </span>
  )
}
