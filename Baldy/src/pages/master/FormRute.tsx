import { useMemo, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Field, Input, Select } from '../../components/ui/Field'
import { CurrencyInput } from '../../components/ui/CurrencyInput'
import { SearchableSelect } from '../../components/ui/SearchableSelect'
import type { Option } from '../../components/ui/SearchableSelect'
import { useData } from '../../store/DataProvider'
import { useAuth } from '../../store/AuthProvider'
import { useToast } from '../../store/ToastProvider'
import { useWorkspace } from '../../store/WorkspaceProvider'
import { kodeRuteDari } from '../../lib/kode'
import { kodeAreaRute, normalKodeArea } from '../../lib/trip'
import { kunciNamaRute, pemakaianKodeArea, rapikanKodeArea } from '../../lib/kodeArea'
import { formatRupiah } from '../../lib/format'
import { ModalAlamat } from './FormAlamat'
import type { Route, RouteNominal } from '../../types'

type FormState = Omit<Route, 'id' | 'created_at' | 'updated_at'>

const BLANK: FormState = { route_code: '', route_name: '', project_id: '', feet: '1X40', ujroute: 0, toll: 0, commissioner: 0, price: 0, estimated_fields: [] }
/** Ukuran container rute Priok. */
export const FEET_OPTIONS = ['1X20', '1X40', '2X20', '1X20K', '1X40K']

interface Props {
  open: boolean
  onClose: () => void
  /** Rute yang diubah; kosong = tambah rute baru. */
  rute?: Route | null
  /** Isian awal rute baru, mis. area pick up = lokasi bongkar trip asal backload. */
  awal?: Partial<Pick<Route, 'kode_area_asal' | 'kode_area_tujuan'>>
  /** Pengganti keterangan di bawah judul modal. */
  keterangan?: string
  /** Pesan toast setelah tersimpan; bawaan "Data berhasil disimpan/diperbarui." */
  pesanSukses?: (rute: Route) => string
  /** Dipanggil setelah rute tersimpan, dengan rute hasil simpan (mis. untuk langsung dipilih di form trip). */
  onSaved?: (rute: Route) => void
  /** Rute yang ditambahkan ternyata sudah ada: pakai rute itu (form trip). Kosong = tombolnya tidak tampil. */
  onPakai?: (rute: Route) => void
}

/** Nama rute "ASAL - TUJUAN" dari dua kode area. */
const namaDariArea = (asal: string, tujuan: string) => (asal && tujuan ? `${asal} - ${tujuan}` : asal ? `${asal} - ` : '')

/**
 * Modal Tambah / Ubah Rute (revisi 13 Okt 2026), dipakai menu Rute dan form trip (tambah rute di
 * tempat). Urutannya: Area Pick Up & Area Destinasi (dari Master Alamat; belum ada = "Tambah
 * alamat" di baris pertama dropdown), lalu Nama Rute sebagai kesimpulan keduanya. No. Rute dibuat
 * otomatis dari nama dan tidak bisa diubah. Klien tidak lagi di rute: dipilih di form trip.
 */
export function ModalRute(props: Props) {
  // Isi form dibuat ulang tiap kali modal dibuka, jadi isian lama tidak terbawa.
  if (!props.open) return null
  return <IsiModalRute {...props} />
}

function IsiModalRute({ onClose, rute: editing = null, awal, keterangan, pesanSukses, onSaved, onPakai }: Props) {
  const { db, create, update } = useData()
  const { bisa } = useAuth()
  const toast = useToast()
  /** Feet = ukuran container, hanya untuk rute container Priok. Rute Karawang (alat berat) tidak memakainya. */
  const pakaiFeet = useWorkspace().workspace === 'priok'

  const areaAwal = editing ? kodeAreaRute(editing) : { asal: rapikanKodeArea(awal?.kode_area_asal ?? '').trim(), tujuan: rapikanKodeArea(awal?.kode_area_tujuan ?? '').trim() }
  const [areaAsal, setAreaAsal] = useState(areaAwal.asal)
  const [areaTujuan, setAreaTujuan] = useState(areaAwal.tujuan)
  const [form, setForm] = useState<FormState>(() => editing
    ? {
      route_code: editing.route_code, route_name: editing.route_name, project_id: editing.project_id ?? '', feet: editing.feet,
      ujroute: editing.ujroute, toll: editing.toll ?? 0, commissioner: editing.commissioner, price: editing.price, estimated_fields: editing.estimated_fields ?? [],
    }
    : { ...BLANK, feet: pakaiFeet ? BLANK.feet : '', route_name: namaDariArea(areaAwal.asal, areaAwal.tujuan) })
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  /** Form Tambah Alamat dari dropdown area, dengan ketikan pencarian sebagai nama lokasi. */
  const [tambahAlamat, setTambahAlamat] = useState<{ sisi: 'asal' | 'tujuan'; nama: string } | null>(null)

  /** Pilihan area: kode area di Master Alamat dan rute lain, dengan nama lokasinya. */
  const opsiArea = useMemo<Option[]>(() => {
    const pakai = pemakaianKodeArea(db.routes, db.alamat ?? [], editing?.id)
    const lokasi = new Map<string, string[]>()
    for (const a of db.alamat ?? []) {
      if (a.status !== 'aktif' || !a.kode_area) continue
      const k = a.kode_area.trim().toUpperCase()
      lokasi.set(k, [...(lokasi.get(k) ?? []), `${a.nama}${a.kota ? ` (${a.kota.split(',')[0]})` : ''}`])
    }
    // Area yang punya alamat di atas: itu yang tersambung ke Master Alamat.
    return [...pakai.entries()]
      .sort((a, b) => Number(lokasi.has(b[0])) - Number(lokasi.has(a[0])) || a[0].localeCompare(b[0], 'id'))
      .map(([kode, p]) => ({
        value: kode,
        label: kode,
        meta: [lokasi.get(kode)?.slice(0, 2).join(', ') ?? 'belum ada alamat', p.rute ? `${p.rute} rute` : ''].filter(Boolean).join(' · '),
        keywords: lokasi.get(kode)?.join(' ') ?? '',
      }))
  }, [db.routes, db.alamat, editing?.id])

  const hargaWajib = !editing || editing.price > 0
  // Rute dari data asli belum punya ukuran container; wajib dipilih hanya untuk rute baru.
  const feetWajib = pakaiFeet && (!editing || !!editing.feet)
  /** No. Rute: rute lama tetap; rute baru dibuat dari nama (pembedanya ikut bila mirip rute lain), tidak bisa diketik. */
  const kodeRute = editing ? editing.route_code : kodeRuteDari(form.route_name.trim(), db.routes)
  /**
   * Rute lain dengan nama yang sama, termasuk yang beda spasi / tanda baca ("CIB-DURI", "REBON JARO" = "REBONJARO"):
   * ditampilkan sejak area dipilih supaya rute kembar tidak dibuat lagi (Baldy 14 Okt 2026).
   */
  const kembar = useMemo(() => {
    const k = kunciNamaRute(form.route_name)
    if (k.length < 4 || /-\s*$/.test(form.route_name.trim())) return undefined
    return db.routes.find((r) => r.id !== editing?.id && kunciNamaRute(r.route_name) === k)
  }, [form.route_name, db.routes, editing?.id])

  /** Nominal perkiraan yang belum diubah di form ini. */
  const masihKira = (k: RouteNominal) => !!editing?.estimated_fields?.includes(k) && form[k] === (editing[k] ?? 0)

  /** Ganti area: nama rute ikut berubah selama belum ditulis sendiri (masih sama dengan turunan area lama). */
  function pilihArea(sisi: 'asal' | 'tujuan', v: string | null) {
    const kode = v ?? ''
    const asalBaru = sisi === 'asal' ? kode : areaAsal
    const tujuanBaru = sisi === 'tujuan' ? kode : areaTujuan
    const namaLama = namaDariArea(areaAsal, areaTujuan)
    const nama = form.route_name.trim()
    if (!nama || nama === namaLama.trim() || nama === `${areaAsal} -`) setForm((f) => ({ ...f, route_name: namaDariArea(asalBaru, tujuanBaru) }))
    if (sisi === 'asal') setAreaAsal(kode)
    else setAreaTujuan(kode)
    setErrors((e) => ({ ...e, route_name: undefined, [sisi === 'asal' ? 'kode_area_asal' : 'kode_area_tujuan']: undefined }))
  }

  function validate(): boolean {
    const e: Partial<Record<keyof FormState, string>> = {}
    const wajibArea = !editing
    if (wajibArea && !areaAsal) e.kode_area_asal = 'Area Pick Up wajib dipilih.'
    if (wajibArea && !areaTujuan) e.kode_area_tujuan = 'Area Destinasi wajib dipilih.'
    const nama = form.route_name.trim()
    if (!nama || /-\s*$/.test(nama)) e.route_name = 'Nama Rute wajib lengkap: ASAL - TUJUAN.'
    else if (kembar) e.route_name = `Sudah ada rute ${kembar.route_name} (No. Rute ${kembar.route_code}).`
    if (feetWajib && !form.feet) e.feet = 'Feet wajib dipilih.'
    // Rute dari data asli belum punya harga; jangan paksa diisi saat hanya mengubah UJ / tol.
    if (hargaWajib && form.price <= 0) e.price = 'Harga harus lebih dari 0.'
    if (form.ujroute < 0) e.ujroute = 'Uang Jalan Rute tidak boleh negatif.'
    if (form.toll < 0) e.toll = 'Uang Tol tidak boleh negatif.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function onSubmit() {
    if (!validate()) return
    const nama = form.route_name.trim().toUpperCase().replace(/\s+/g, ' ')
    // Kode area disimpan bila berbeda dari turunan nama; sama / kosong = ikut nama (tidak tersimpan).
    const dariNama = kodeAreaRute({ route_name: nama })
    const kodeSimpan = (pilih: string, turunan: string) => (pilih && normalKodeArea(pilih) !== normalKodeArea(turunan) ? pilih : undefined)
    const payload = {
      ...form,
      // Klien tidak lagi dipilih di rute (dipilih di trip); nilai lama rute dibiarkan.
      route_code: kodeRute,
      route_name: nama,
      kode_area_asal: kodeSimpan(areaAsal, dariNama.asal),
      kode_area_tujuan: kodeSimpan(areaTujuan, dariNama.tujuan),
      // Nominal perkiraan yang diubah admin sudah bukan perkiraan lagi.
      estimated_fields: (editing?.estimated_fields ?? []).filter((k) => form[k] === (editing![k] ?? 0)),
    }
    let tersimpan: Route
    if (editing) {
      update('routes', editing.id, payload)
      tersimpan = { ...editing, ...payload }
    } else {
      tersimpan = create('routes', payload)
    }
    toast.success(pesanSukses?.(tersimpan) ?? (editing ? 'Data berhasil diperbarui.' : `Rute ${tersimpan.route_name} tersimpan dengan No. Rute ${tersimpan.route_code}.`))
    onSaved?.(tersimpan)
    onClose()
  }

  const tambahan = (sisi: 'asal' | 'tujuan') => ({
    label: (q: string) => (q.trim() ? `Tambah alamat “${q.trim()}”` : 'Tambah alamat baru'),
    onClick: (q: string) => setTambahAlamat({ sisi, nama: q.trim() }),
    disabled: !bisa('master'),
    hint: bisa('master') ? 'Alamat belum terdaftar? Tambahkan, kode areanya dibuat otomatis.' : 'Perlu izin ubah data master.',
  })

  return (
    <>
      <Modal
        open
        onClose={onClose}
        size="lg"
        title={editing ? 'Ubah Rute' : 'Tambah Rute'}
        subtitle={keterangan ?? (editing
          ? `No. Rute ${editing.route_code}${editing.route_code_lama ? ` (dulu ${editing.route_code_lama})` : ''}`
          : 'Tanda * wajib diisi. Pilih area pick up dan destinasi dulu.')}
        footer={
          <>
            <Button onClick={onClose}>Batal</Button>
            <Button variant="primary" onClick={onSubmit}>{editing ? 'Simpan Perubahan' : 'Simpan'}</Button>
          </>
        }
      >
        <div className="grid gap-x-4 gap-y-3 sm:grid-cols-6">
          <Field label="Area Pick Up" required={!editing} error={errors.kode_area_asal} className="sm:col-span-3"
            hint={errors.kode_area_asal ? undefined : 'Lokasi muat. Cari dulu; belum ada? Tambah alamat.'}>
            {(id) => (
              <SearchableSelect id={id} options={opsiArea} value={areaAsal || null} invalid={!!errors.kode_area_asal}
                placeholder="Pilih area pick up..." searchPlaceholder="Cari kode area, nama lokasi, atau kota..."
                onChange={(v) => pilihArea('asal', v)} tambahan={tambahan('asal')} />
            )}
          </Field>
          <Field label="Area Destinasi" required={!editing} error={errors.kode_area_tujuan} className="sm:col-span-3"
            hint={errors.kode_area_tujuan ? undefined : 'Lokasi bongkar.'}>
            {(id) => (
              <SearchableSelect id={id} options={opsiArea} value={areaTujuan || null} invalid={!!errors.kode_area_tujuan}
                placeholder="Pilih area destinasi..." searchPlaceholder="Cari kode area, nama lokasi, atau kota..."
                onChange={(v) => pilihArea('tujuan', v)} tambahan={tambahan('tujuan')} />
            )}
          </Field>
          <Field label="Nama Rute" required error={errors.route_name} className="sm:col-span-4"
            hint={errors.route_name ? undefined : kembar
              ? (
                <span className="text-[#8a6100]">
                  Sudah ada: <span className="font-semibold">{kembar.route_code}</span> {kembar.route_name} (UJ {formatRupiah(kembar.ujroute)}, Harga {formatRupiah(kembar.price)}).{' '}
                  {onPakai
                    ? <button type="button" className="font-semibold underline underline-offset-2 hover:text-ink" onClick={() => { onPakai(kembar); onClose() }}>Pakai rute ini</button>
                    : 'Tambahkan pembeda, mis. nomor site (CIB - RAWA 52) atau BCKLD.'}
                </span>
              )
              : 'Kesimpulan dari area pick up dan destinasi. Boleh ditambah nomor site atau BCKLD, mis. CIB - RAWA 52.'}>
            {(id) => (
              <Input id={id} value={form.route_name} invalid={!!errors.route_name} placeholder="Terisi dari area" className="uppercase"
                onChange={(e) => { setForm({ ...form, route_name: e.target.value }); setErrors((x) => ({ ...x, route_name: undefined })) }} />
            )}
          </Field>
          <Field label="No. Rute" className="sm:col-span-2"
            hint={editing ? `Tetap, tidak bisa diubah.${editing.route_code_lama ? ` Dulu ${editing.route_code_lama}.` : ''}` : 'Otomatis dari nama; pembeda (nomor site, BCKLD) ikut bila mirip rute lain.'}>
            {(id) => <Input id={id} value={kodeRute === 'RUTE' && !form.route_name.trim() ? '' : kodeRute} readOnly placeholder="Otomatis" className="tnum font-semibold" />}
          </Field>
          {pakaiFeet && (
            <Field label="Feet" required={feetWajib} error={errors.feet} className="sm:col-span-2"
              hint={!form.feet && !errors.feet ? 'Data asli belum mencatat ukuran container rute ini.' : undefined}>
              {(id) => (
                <Select id={id} value={form.feet} invalid={!!errors.feet} onChange={(e) => setForm({ ...form, feet: e.target.value })}>
                  {!feetWajib && <option value="">— belum diisi —</option>}
                  {FEET_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
                </Select>
              )}
            </Field>
          )}
          <Field label="Uang Jalan Rute" required error={errors.ujroute} className="sm:col-span-2"
            hint={errors.ujroute ? undefined : masihKira('ujroute') ? 'Masih perkiraan.' : 'Patokan uang jalan.'}>
            {(id) => <CurrencyInput id={id} value={form.ujroute} invalid={!!errors.ujroute} onValueChange={(v) => setForm({ ...form, ujroute: v })} />}
          </Field>
          <Field label="Uang Tol" error={errors.toll} className="sm:col-span-2"
            hint={errors.toll ? undefined : masihKira('toll') ? 'Masih perkiraan.' : 'Patokan tol.'}>
            {(id) => <CurrencyInput id={id} value={form.toll} invalid={!!errors.toll} onValueChange={(v) => setForm({ ...form, toll: v })} />}
          </Field>
          <Field label="Harga" required={hargaWajib} error={errors.price} className="sm:col-span-2"
            hint={errors.price ? undefined : masihKira('price') ? 'Masih perkiraan.' : editing ? 'Harga baru berlaku untuk trip berikutnya; trip yang sudah ada tetap.' : 'Harga ke klien per trip.'}>
            {(id) => <CurrencyInput id={id} value={form.price} invalid={!!errors.price} onValueChange={(v) => setForm({ ...form, price: v })} />}
          </Field>
        </div>
      </Modal>

      <ModalAlamat
        open={!!tambahAlamat}
        onClose={() => setTambahAlamat(null)}
        awal={{ nama: tambahAlamat?.nama ?? '' }}
        keterangan={`Area alamat baru langsung dipilih sebagai Area ${tambahAlamat?.sisi === 'tujuan' ? 'Destinasi' : 'Pick Up'}.`}
        pesanSukses={(a) => `${a.nama} tersimpan di Master Alamat (area ${a.kode_area}).`}
        onSaved={(a) => { if (tambahAlamat) pilihArea(tambahAlamat.sisi, a.kode_area.trim().toUpperCase()) }}
      />
    </>
  )
}
