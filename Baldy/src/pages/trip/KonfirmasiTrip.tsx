import { useEffect, useState } from 'react'
import { FaTriangleExclamation } from '../../components/ui/icons'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Checkbox, Textarea } from '../../components/ui/Field'
import { useData } from '../../store/DataProvider'
import type { IsiTrip } from '../../store/DataProvider'
import { useToast } from '../../store/ToastProvider'
import { formatRupiah } from '../../lib/format'
import { cn } from '../../lib/utils'
import type { CommissionTransaction } from '../../types'

type TripRingkas = Pick<CommissionTransaction, 'id' | 'transaction_no'>
type Cara = 'kembali' | 'kasbon'

/** Daftar catatan trip, untuk isi peringatan. */
function DaftarIsi({ isi, warna }: { isi: IsiTrip; warna: string }) {
  const baris: string[] = []
  if (isi.termin) {
    baris.push(`${isi.termin} termin uang jalan · ${formatRupiah(isi.uj)}` + (isi.kasbon ? ` (potong kasbon ${formatRupiah(isi.kasbon)})` : ''))
  }
  if (isi.biaya) baris.push(`${isi.biaya} biaya operasional · ${formatRupiah(isi.biayaTotal)}`)
  if (isi.internal) baris.push(`${isi.internal} biaya internal · ${formatRupiah(isi.internalTotal)}`)
  if (isi.lainnya) baris.push(`${isi.lainnya} catatan di tab Lainnya`)
  return (
    <ul className={cn('mt-2 list-disc space-y-1 pl-5 text-[12.5px]', warna)}>
      {baris.map((b) => <li key={b}>{b}</li>)}
    </ul>
  )
}

const adaIsi = (isi: IsiTrip) => isi.termin + isi.biaya + isi.internal + isi.lainnya > 0

/**
 * Konfirmasi Batalkan Trip. Trip ditandai Dibatalkan dan seluruh catatannya
 * tetap disimpan sebagai arsip, tetapi tidak dihitung di laporan. Uang jalan
 * yang sudah ditransfer ke sopir harus diselesaikan: dikembalikan tunai, atau
 * dijadikan kasbon sopir itu.
 */
export function KonfirmasiBatalTrip({ trip, onClose, onDone }: {
  trip: TripRingkas | null
  onClose: () => void
  onDone?: () => void
}) {
  const { dbAll, isiTrip, batalkanTrip } = useData()
  const toast = useToast()
  const [isi, setIsi] = useState<IsiTrip | null>(null)
  const [alasan, setAlasan] = useState('')
  const [cara, setCara] = useState<Record<string, Cara>>({})
  const [paham, setPaham] = useState(false)

  useEffect(() => {
    setAlasan(''); setCara({}); setPaham(false)
    setIsi(trip ? isiTrip(trip.id) : null)
  }, [trip, isiTrip])

  if (!trip || !isi) return null
  const berjalan = adaIsi(isi)
  const perluSelesai = isi.rincianTermin.filter((t) => t.tf > 0)
  const namaSopir = (id: string) => dbAll.drivers.find((d) => d.id === id)?.driver_name ?? ''
  const caraTermin = (id: string, adaSopir: boolean): Cara => (adaSopir ? cara[id] ?? 'kasbon' : 'kembali')
  const jadiKasbon = perluSelesai.reduce((a, t) => (caraTermin(t.id, !!t.driver_id) === 'kasbon' ? a + t.tf : a), 0)

  function konfirmasi() {
    if (!trip) return
    const penyelesaian: Record<string, Cara> = {}
    for (const t of perluSelesai) penyelesaian[t.id] = caraTermin(t.id, !!t.driver_id)
    batalkanTrip(trip.id, { alasan, penyelesaian })
    const bagian = [
      isi?.kasbonKembali ? `potongan kasbon ${formatRupiah(isi.kasbonKembali)} dikembalikan` : '',
      jadiKasbon ? `UJ ${formatRupiah(jadiKasbon)} jadi kasbon sopir` : '',
    ].filter(Boolean)
    toast.success(`Trip ${trip.transaction_no} dibatalkan${bagian.length ? `; ${bagian.join(', ')}` : ''}.`)
    onClose()
    onDone?.()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Batalkan Trip ${trip.transaction_no}?`}
      size="md"
      footer={
        <>
          <Button onClick={onClose}>Kembali</Button>
          <Button variant="danger" disabled={perluSelesai.length > 0 && !paham} onClick={konfirmasi}>Batalkan Trip</Button>
        </>
      }
    >
      <p className="text-[13px] leading-relaxed text-ink-2">
        Trip akan ditandai <span className="font-semibold text-ink">Dibatalkan</span> dan tidak bisa diubah lagi. Seluruh
        catatannya tetap disimpan sebagai arsip, tetapi tidak dihitung di laporan.
      </p>

      {berjalan ? (
        <div className="mt-3 rounded-lg border border-[#f3d5d5] bg-[#fdf2f2] px-3.5 py-3">
          <p className="flex items-center gap-2 text-[13px] font-semibold text-[#b02c2c]">
            <FaTriangleExclamation size={15} className="shrink-0" />
            Trip ini sudah berjalan
          </p>
          <p className="mt-1 text-[12.5px] text-[#8a2424]">Catatan berikut menjadi arsip dan keluar dari laporan:</p>
          <DaftarIsi isi={isi} warna="text-[#8a2424]" />
          {isi.kasbonKembali > 0 && (
            <p className="mt-2 text-[12px] text-[#8a2424]">
              Potongan kasbon {formatRupiah(isi.kasbonKembali)} dikembalikan ke kasbon sopirnya, tercatat sebagai &ldquo;Pembatalan Trip&rdquo;.
            </p>
          )}
        </div>
      ) : (
        <p className="mt-2 text-[12.5px] text-ink-3">Trip ini belum punya uang jalan, biaya, maupun catatan lain.</p>
      )}

      {perluSelesai.length > 0 && (
        <div className="mt-3 rounded-lg border border-hairline">
          <p className="border-b border-hairline bg-sunken px-3.5 py-2 text-[12px] font-semibold text-ink-2">
            Uang jalan yang sudah diterima sopir
          </p>
          <ul className="divide-y divide-grid">
            {perluSelesai.map((t) => {
              const nama = namaSopir(t.driver_id)
              const pilihan = caraTermin(t.id, !!t.driver_id)
              return (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5">
                  <span className="text-[12.5px] text-ink-2">
                    Termin {t.sequence} · {nama || 'tanpa sopir'} · TF <span className="tnum font-semibold text-ink">{formatRupiah(t.tf)}</span>
                  </span>
                  {t.driver_id ? (
                    <span className="inline-flex overflow-hidden rounded-md border border-hairline text-[12px] font-medium">
                      {(['kembali', 'kasbon'] as const).map((c) => (
                        <button
                          key={c}
                          type="button"
                          aria-pressed={pilihan === c}
                          onClick={() => setCara((v) => ({ ...v, [t.id]: c }))}
                          className={cn('px-2.5 py-1 transition-colors', pilihan === c ? 'bg-brand-500 text-white' : 'bg-surface text-ink-2 hover:bg-sunken')}
                        >
                          {c === 'kembali' ? 'Dikembalikan tunai' : `Jadi kasbon ${nama}`}
                        </button>
                      ))}
                    </span>
                  ) : (
                    <span className="text-[12px] text-ink-3">Dicatat dikembalikan tunai</span>
                  )}
                </li>
              )
            })}
          </ul>
          <div className="border-t border-hairline px-3.5 py-2.5">
            <Checkbox
              checked={paham}
              onChange={(e) => setPaham(e.target.checked)}
              label="Penyelesaian uang di atas sudah benar."
            />
          </div>
        </div>
      )}

      <div className="mt-3">
        <label className="mb-1.5 block text-[12px] font-semibold tracking-wide text-ink-2" htmlFor="alasan-batal">Alasan pembatalan</label>
        <Textarea id="alasan-batal" rows={2} value={alasan} placeholder="mis. order dibatalkan customer" onChange={(e) => setAlasan(e.target.value)} />
      </div>
    </Modal>
  )
}

/** Konfirmasi Hapus Trip: trip dan seluruh catatannya hilang, seolah tidak pernah ada. */
export function KonfirmasiHapusTrip({ trip, onClose, onDeleted }: {
  trip: TripRingkas | null
  onClose: () => void
  onDeleted?: (id: string) => void
}) {
  const { isiTrip, hapusTrip } = useData()
  const toast = useToast()
  const [isi, setIsi] = useState<IsiTrip | null>(null)

  useEffect(() => {
    setIsi(trip ? isiTrip(trip.id) : null)
  }, [trip, isiTrip])

  if (!trip || !isi) return null

  function konfirmasi() {
    if (!trip) return
    hapusTrip(trip.id)
    toast.success(`Trip ${trip.transaction_no} dihapus.`)
    onClose()
    onDeleted?.(trip.id)
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Hapus Trip ${trip.transaction_no}?`}
      size="sm"
      footer={
        <>
          <Button onClick={onClose}>Batal</Button>
          <Button variant="danger" onClick={konfirmasi}>Hapus Permanen</Button>
        </>
      }
    >
      <p className="text-[13px] leading-relaxed text-ink-2">
        Trip dihapus permanen, termasuk mutasi kasbon yang tertaut ke trip ini. Bila trip hanya batal jalan,
        gunakan <span className="font-semibold text-ink">Batalkan Trip</span> supaya arsipnya tetap ada.
      </p>
      {adaIsi(isi) && (
        <div className="mt-3 rounded-lg border border-[#f3d5d5] bg-[#fdf2f2] px-3.5 py-3">
          <p className="text-[12.5px] font-semibold text-[#b02c2c]">Ikut terhapus:</p>
          <DaftarIsi isi={isi} warna="text-[#8a2424]" />
        </div>
      )}
    </Modal>
  )
}
