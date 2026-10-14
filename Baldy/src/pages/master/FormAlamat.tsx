import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Badge } from '../../components/ui/Badge'
import { Field, Input, Select } from '../../components/ui/Field'
import { FaTriangleExclamation } from '../../components/ui/icons'
import { useData } from '../../store/DataProvider'
import { useToast } from '../../store/ToastProvider'
import type { Alamat } from '../../types'
import {
  alamatMirip, bacaBukanSalahKetik, kodeAreaDariLokasi, pemakaianKodeArea, rapikanKodeArea, saranKodeArea,
} from '../../lib/kodeArea'
import { PeringatanKodeMirip } from './KodeAreaInput'

type FormState = Omit<Alamat, 'id' | 'created_at' | 'updated_at'>

const BLANK: FormState = {
  kode_area: '', nama: '', alamat: '', kota: '', nama_kontak: '', telepon: '', project_id: '', jenis: 'keduanya',
  lat_long: '', id_lokasi_klien: '', catatan: '', status: 'aktif',
}

interface Props {
  open: boolean
  onClose: () => void
  /** Alamat yang diubah / dilihat; kosong = tambah alamat baru. */
  alamat?: Alamat | null
  /** Isian awal alamat baru, mis. nama dari kotak cari dropdown, kode area dari rute di form trip. */
  awal?: Partial<Pick<FormState, 'kode_area' | 'nama' | 'alamat' | 'kota' | 'nama_kontak' | 'telepon' | 'project_id' | 'jenis'>>
  /** Hanya lihat (peran tanpa izin ubah data master): rincian alamat tanpa tombol simpan. */
  bacaSaja?: boolean
  /** Pengganti keterangan di bawah judul modal. */
  keterangan?: string
  /** Pesan toast setelah tersimpan; bawaan "Data berhasil disimpan/diperbarui." */
  pesanSukses?: (alamat: Alamat) => string
  /**
   * Dipanggil setelah alamat tersimpan, mis. untuk langsung dipilih di form trip / rute. Juga
   * dipanggil dengan alamat lama bila pengguna memilih "Pakai yang ini" pada alamat kembar.
   */
  onSaved?: (alamat: Alamat) => void
}

/**
 * Modal Tambah / Ubah Alamat (Master Data -> Alamat), ringkas tanpa gulir (revisi 13 Okt 2026):
 * nama lokasi, kota, alamat, kontak, catatan. Koordinat dan ID lokasi klien tidak diisi lagi
 * (nilai lama tetap tersimpan). Kode area dibuat otomatis dari kota, boleh diganti. Saat nama
 * diketik, alamat yang mungkin sama ditampilkan supaya lokasi yang sudah ada tidak dobel.
 * Dipakai juga dari dropdown alamat di form trip dan form rute ("Tambah alamat").
 */
export function ModalAlamat(props: Props) {
  // Isi form dibuat ulang tiap kali modal dibuka, jadi isian lama tidak terbawa.
  if (!props.open) return null
  // Hanya lihat tanpa alamat = tidak ada yang ditampilkan (peran tanpa izin tidak bisa menambah).
  if (props.bacaSaja) return props.alamat ? <RincianAlamat alamat={props.alamat} onClose={props.onClose} /> : null
  return <IsiModalAlamat {...props} />
}

function IsiModalAlamat({ onClose, alamat: editing = null, awal, keterangan, pesanSukses, onSaved }: Props) {
  const { db, create, update } = useData()
  const toast = useToast()

  const [form, setForm] = useState<FormState>(() => editing
    ? {
      kode_area: editing.kode_area ?? '', nama: editing.nama ?? '', alamat: editing.alamat ?? '', kota: editing.kota ?? '',
      nama_kontak: editing.nama_kontak ?? '', telepon: editing.telepon ?? '', project_id: editing.project_id ?? '',
      jenis: editing.jenis ?? 'keduanya', lat_long: editing.lat_long ?? '', id_lokasi_klien: editing.id_lokasi_klien ?? '',
      catatan: editing.catatan ?? '', status: editing.status ?? 'aktif',
    }
    : {
      // Isian awal yang kosong (undefined) tidak menimpa nilai bawaan.
      ...BLANK, ...(Object.fromEntries(Object.entries(awal ?? {}).filter(([, v]) => v !== undefined)) as Partial<FormState>),
      kode_area: rapikanKodeArea(awal?.kode_area ?? '').trim(),
    })
  /** Kode area mengikuti kota sampai diketik sendiri; alamat lama / kode dari form asal dianggap sudah dipilih. */
  const [kodeSendiri, setKodeSendiri] = useState(() => !!editing || !!awal?.kode_area?.trim())
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})

  const alamatLain = useMemo(() => (db.alamat ?? []).filter((a) => a.id !== editing?.id), [db.alamat, editing?.id])
  const pakai = useMemo(() => pemakaianKodeArea(db.routes, alamatLain), [db.routes, alamatLain])
  const [tanda] = useState(bacaBukanSalahKetik)
  const kodeOtomatis = kodeAreaDariLokasi(form.kota, form.nama)
  const kode = (kodeSendiri ? form.kode_area : kodeOtomatis).trim()
  const saran = saranKodeArea(kode, pakai, tanda)
  const jumlahRute = pakai.get(kode)?.rute ?? 0
  const kembar = editing ? [] : alamatMirip(form.nama, alamatLain)

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }))
    setErrors((e) => ({ ...e, [k]: undefined, ...(k === 'kota' || k === 'nama' ? { kode_area: undefined } : {}) }))
  }

  function validate(): boolean {
    const e: Partial<Record<keyof FormState, string>> = {}
    if (!form.nama.trim()) e.nama = 'Nama lokasi wajib diisi.'
    if (!form.kota.trim()) e.kota = 'Kota wajib diisi; kode area dibuat dari kota.'
    if (!kode) e.kode_area = 'Kode area wajib diisi, mis. CIB atau DURI.'
    const dobel = alamatLain.find((a) => (a.kode_area ?? '').trim().toUpperCase() === kode
      && (a.nama ?? '').trim().toLowerCase() === form.nama.trim().toLowerCase())
    if (!e.kode_area && !e.nama && dobel) {
      e.nama = dobel.status === 'nonaktif'
        ? `Alamat ${dobel.nama} di kode area ${dobel.kode_area} sudah ada tapi nonaktif. Aktifkan yang lama saja.`
        : `Alamat ${dobel.nama} di kode area ${dobel.kode_area} sudah ada.`
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function onSubmit() {
    if (!validate()) return
    const payload: FormState = {
      ...form,
      kode_area: kode,
      nama: form.nama.trim(),
      alamat: form.alamat.trim(),
      kota: form.kota.trim(),
      nama_kontak: form.nama_kontak.trim(),
      telepon: form.telepon.trim(),
      catatan: form.catatan.trim(),
    }
    let tersimpan: Alamat
    if (editing) {
      update('alamat', editing.id, payload)
      tersimpan = { ...editing, ...payload }
    } else {
      tersimpan = create('alamat', payload)
    }
    toast.success(pesanSukses?.(tersimpan) ?? (editing ? 'Data berhasil diperbarui.' : 'Data berhasil disimpan.'))
    onSaved?.(tersimpan)
    onClose()
  }

  /** Alamat kembar dipilih: tidak menambah data baru. */
  function pakaiYangAda(a: Alamat) {
    toast.info(`${a.nama} sudah ada di Master Alamat, dipakai yang sudah ada.`)
    onSaved?.(a)
    onClose()
  }

  const petunjukKode: ReactNode = errors.kode_area ? undefined
    : saran ? <PeringatanKodeMirip saran={saran} onPakai={() => { setKodeSendiri(true); set('kode_area', saran.kode) }} />
    : !kode ? 'Terisi otomatis dari kota.'
    : !kodeSendiri ? `Otomatis dari ${form.kota.trim() ? 'kota' : 'nama lokasi'}${jumlahRute ? `; dipakai ${jumlahRute} rute` : ''}. Boleh diganti.`
    : jumlahRute > 0 ? `Dipakai ${jumlahRute} rute.` : 'Kode area baru.'

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={editing ? 'Ubah Alamat' : 'Tambah Alamat'}
      subtitle={keterangan ?? (editing ? `${editing.kode_area} · ${editing.nama}` : 'Tanda * wajib diisi. Cari dulu di daftar; tambah bila belum ada.')}
      footer={
        <>
          <Button onClick={onClose}>Batal</Button>
          <Button variant="primary" onClick={onSubmit}>{editing ? 'Simpan Perubahan' : 'Simpan'}</Button>
        </>
      }
    >
      <div className="grid gap-x-4 gap-y-3 sm:grid-cols-6">
        <Field label="Nama Lokasi" required error={errors.nama} className="sm:col-span-4"
          hint={errors.nama ? undefined : 'Nama perusahaan atau tempat, mis. PT Pindodeli Pulp & Paper Mills.'}>
          {(id) => <Input id={id} value={form.nama} invalid={!!errors.nama} placeholder="PT Pindodeli Pulp & Paper Mills" autoFocus
            onChange={(e) => set('nama', e.target.value)} />}
        </Field>
        <Field label="Kota" required error={errors.kota} className="sm:col-span-2">
          {(id) => <Input id={id} value={form.kota} invalid={!!errors.kota} placeholder="Karawang" onChange={(e) => set('kota', e.target.value)} />}
        </Field>

        {kembar.length > 0 && (
          <div className="rounded-lg border border-[#f6e2ac] bg-[#fff8e6] px-3 py-2 text-[12.5px] text-[#8a6100] sm:col-span-6">
            <p className="flex items-center gap-1.5 font-semibold">
              <FaTriangleExclamation size={12} /> Mungkin sudah ada:
            </p>
            <ul className="mt-1 space-y-1">
              {kembar.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0">
                    <span className="font-semibold text-ink">{a.nama}</span>
                    <span className="text-ink-3"> · {[a.kode_area, a.kota].filter(Boolean).join(' · ')}</span>
                  </span>
                  {onSaved && (
                    <button type="button" onClick={() => pakaiYangAda(a)} className="font-semibold text-brand-700 underline underline-offset-2 hover:text-brand-800">
                      Pakai yang ini
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <Field label="Alamat" className="sm:col-span-4">
          {(id) => <Input id={id} value={form.alamat} placeholder="Jl. Raya Tanjung Pura, Karawang Barat" onChange={(e) => set('alamat', e.target.value)} />}
        </Field>
        <Field label="Kode Area" required error={errors.kode_area} hint={petunjukKode} className="sm:col-span-2">
          {(id) => (
            <Input id={id} value={kodeSendiri ? form.kode_area : kodeOtomatis} invalid={!!errors.kode_area} placeholder="Otomatis"
              autoComplete="off" spellCheck={false} className="tnum font-medium tracking-wide"
              onChange={(e) => { setKodeSendiri(true); set('kode_area', rapikanKodeArea(e.target.value)) }} />
          )}
        </Field>
        <Field label="Nama Kontak" className="sm:col-span-2">
          {(id) => <Input id={id} value={form.nama_kontak} placeholder="Nama PIC di lokasi" onChange={(e) => set('nama_kontak', e.target.value)} />}
        </Field>
        <Field label="Telepon" className="sm:col-span-2">
          {(id) => <Input id={id} type="tel" inputMode="tel" value={form.telepon} placeholder="0812 3456 7890" onChange={(e) => set('telepon', e.target.value)} />}
        </Field>
        {editing ? (
          <Field label="Status" className="sm:col-span-2" hint="Nonaktif = tidak ditawarkan untuk trip baru.">
            {(id) => (
              <Select id={id} value={form.status} onChange={(e) => set('status', e.target.value as Alamat['status'])}>
                <option value="aktif">Aktif</option>
                <option value="nonaktif">Nonaktif</option>
              </Select>
            )}
          </Field>
        ) : <div className="hidden sm:col-span-2 sm:block" />}
        <Field label="Catatan" className="sm:col-span-6">
          {(id) => <Input id={id} value={form.catatan} placeholder="mis. jam bongkar, akses jalan, gerbang masuk" onChange={(e) => set('catatan', e.target.value)} />}
        </Field>
      </div>
    </Modal>
  )
}

/** Rincian satu alamat untuk peran yang hanya boleh melihat. */
function RincianAlamat({ alamat: a, onClose }: { alamat: Alamat; onClose: () => void }) {
  const isi: Array<[string, ReactNode, boolean?]> = [
    ['Nama Lokasi', a.nama || '—', true],
    ['Kota', a.kota || '—'],
    ['Kode Area', <span className="tnum font-semibold">{a.kode_area || '—'}</span>],
    ['Alamat', a.alamat || '—', true],
    ['Nama Kontak', a.nama_kontak || '—'],
    ['Telepon', a.telepon || '—'],
    ['Catatan', a.catatan || '—', true],
    ['Status', a.status === 'aktif' ? <Badge tone="good">Aktif</Badge> : <Badge tone="neutral">Nonaktif</Badge>],
  ]
  return (
    <Modal open onClose={onClose} size="lg" title="Rincian Alamat" subtitle="Hanya Manager dan Owner yang dapat mengubah data alamat." footer={<Button onClick={onClose}>Tutup</Button>}>
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {isi.map(([label, nilai, lebar]) => (
          <div key={label} className={lebar ? 'min-w-0 sm:col-span-2' : 'min-w-0'}>
            <dt className="text-[11.5px] font-semibold tracking-wide text-ink-3 uppercase">{label}</dt>
            <dd className="mt-0.5 text-[13px] break-words whitespace-pre-line text-ink">{nilai}</dd>
          </div>
        ))}
      </dl>
    </Modal>
  )
}
