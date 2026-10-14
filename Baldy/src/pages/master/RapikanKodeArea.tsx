import { useMemo, useState } from 'react'
import { FaArrowRight, FaTriangleExclamation } from '../../components/ui/icons'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Radio } from '../../components/ui/Field'
import { useData } from '../../store/DataProvider'
import { useToast } from '../../store/ToastProvider'
import { formatRupiah } from '../../lib/format'
import { rencanaRapikanKode, teksPakai } from '../../lib/kodeArea'
import type { PakaiKode, UbahRute } from '../../lib/kodeArea'
import type { Route } from '../../types'

/**
 * Rapikan satu kelompok kode area yang mirip (kemungkinan salah ketik) sekaligus (Baldy 14 Okt 2026:
 * "masalah kode yang sama di rute"). Pilih penulisan yang benar, lihat rute & alamat yang berubah, lalu
 * simpan; tiap perubahan tercatat di Audit Log. Rute yang jadi kembar dengan rute lain (harganya bisa
 * berbeda) tidak diubah dan ditampilkan untuk dicek manual.
 */
export function ModalRapikanKode({ kelompok, pakai, onClose, onBuka }: {
  kelompok: string[]
  pakai: Map<string, PakaiKode>
  onClose: () => void
  /** Buka form Ubah Rute untuk rute yang perlu dicek manual. */
  onBuka: (rute: Route) => void
}) {
  const { db, update } = useData()
  const toast = useToast()
  const [benar, setBenar] = useState(kelompok[0])
  const rencana = useMemo(() => rencanaRapikanKode(kelompok, benar, db.routes, db.alamat ?? []), [kelompok, benar, db.routes, db.alamat])
  const tripPerRute = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of db.transactions) if (t.status !== 'batal') m.set(t.route_id, (m.get(t.route_id) ?? 0) + 1)
    return m
  }, [db.transactions])
  const jumlah = rencana.rute.length + rencana.alamat.length

  function simpan() {
    for (const u of rencana.rute) update('routes', u.rute.id, u.patch)
    for (const a of rencana.alamat) update('alamat', a.alamat.id, { kode_area: benar })
    const bagian = [rencana.rute.length ? `${rencana.rute.length} rute` : '', rencana.alamat.length ? `${rencana.alamat.length} alamat` : ''].filter(Boolean).join(' dan ')
    toast.success(`${bagian} dirapikan ke ${benar}.${rencana.kembar.length ? ` ${rencana.kembar.length} rute kembar perlu dicek manual.` : ''}`)
    onClose()
  }

  const ringkas = (r: Route) => `${tripPerRute.get(r.id) ?? 0} trip · UJ ${formatRupiah(r.ujroute)} · Harga ${formatRupiah(r.price)}`

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Rapikan kode area"
      subtitle={`Satukan penulisan ${kelompok.join(' / ')} yang mungkin salah ketik. No. Rute tidak berubah.`}
      footer={
        <>
          <Button onClick={onClose}>Batal</Button>
          <Button variant="primary" disabled={jumlah === 0} onClick={simpan}>
            {jumlah === 0 ? 'Tidak ada yang bisa dirapikan' : `Rapikan ke ${benar}`}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <fieldset>
          <legend className="form-label">Penulisan yang benar</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {kelompok.map((k) => (
              <Radio key={k} name="kode-benar" checked={benar === k} onChange={() => setBenar(k)}
                label={k} description={teksPakai(pakai.get(k) ?? { rute: 0, alamat: 0 }) || 'belum dipakai'} />
            ))}
          </div>
        </fieldset>

        <section aria-label="Yang akan diubah">
          <p className="form-label">Yang akan diubah</p>
          {jumlah === 0 ? (
            <p className="text-[12.5px] text-ink-3">Tidak ada rute atau alamat yang bisa diubah ke {benar}.</p>
          ) : (
            <ul className="space-y-1.5 text-[12.5px]">
              {rencana.rute.map((u) => (
                <li key={u.rute.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="tnum w-28 shrink-0 font-semibold text-ink">{u.rute.route_code}</span>
                  <span className="text-ink-3 line-through">{u.rute.route_name}</span>
                  <FaArrowRight size={10} className="text-ink-3" />
                  <span className="font-medium text-ink">{u.namaBaru}</span>
                  <span className="text-ink-3">· {tripPerRute.get(u.rute.id) ?? 0} trip</span>
                </li>
              ))}
              {rencana.alamat.map((a) => (
                <li key={a.alamat.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="w-28 shrink-0 font-semibold text-ink">Alamat</span>
                  <span className="text-ink">{a.alamat.nama}</span>
                  <span className="text-ink-3 line-through">{a.kodeLama}</span>
                  <FaArrowRight size={10} className="text-ink-3" />
                  <span className="font-medium text-ink">{benar}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="form-text">Trip lama ikut menampilkan nama rute yang baru; nilai uang jalan, biaya, dan PI-nya tidak berubah.</p>
        </section>

        {rencana.kembar.length > 0 && (
          <section aria-label="Rute kembar" className="rounded-lg border border-[#f6e2ac] bg-[#fff8e6] px-3.5 py-3 text-[12.5px] text-[#8a6100]">
            <p className="flex items-start gap-2 font-semibold">
              <FaTriangleExclamation size={14} className="mt-px shrink-0" />
              {rencana.kembar.length} rute tidak diubah: namanya akan sama dengan rute lain.
            </p>
            <p className="mt-1">Cek dulu mana yang benar (harganya bisa berbeda), lalu hapus salah satunya atau beri pembeda di Nama Rute.</p>
            <ul className="mt-2 space-y-2">
              {rencana.kembar.map((u: UbahRute) => (
                <li key={u.rute.id} className="rounded-md border border-[#f6e2ac] bg-surface px-3 py-2 text-ink">
                  <BarisKembar rute={u.rute} ket={ringkas(u.rute)} onBuka={() => onBuka(u.rute)} />
                  <p className="my-1 text-[11.5px] text-ink-3">akan sama dengan</p>
                  {u.kembarDengan && <BarisKembar rute={u.kembarDengan} ket={ringkas(u.kembarDengan)} onBuka={() => onBuka(u.kembarDengan!)} />}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </Modal>
  )
}

function BarisKembar({ rute, ket, onBuka }: { rute: Route; ket: string; onBuka: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
      <span className="tnum font-semibold">{rute.route_code}</span>
      <span className="font-medium">{rute.route_name}</span>
      <span className="text-[12px] text-ink-3">· {ket}</span>
      <button type="button" onClick={onBuka} className="ml-auto text-[12px] font-semibold text-brand-700 underline underline-offset-2 hover:text-brand-800">
        Ubah
      </button>
    </div>
  )
}
