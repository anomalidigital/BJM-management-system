import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Field, Input, Select } from '../../components/ui/Field'
import { CurrencyInput } from '../../components/ui/CurrencyInput'
import { KodeInput } from '../../components/ui/KodeInput'
import { useData } from '../../store/DataProvider'
import { useToast } from '../../store/ToastProvider'
import { useWorkspace } from '../../store/WorkspaceProvider'
import { buatKodeUnik } from '../../lib/kode'
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
  /** Isian awal rute baru, mis. nama "DURI - " dan klien dari form trip backload. */
  awal?: Partial<Pick<FormState, 'route_name' | 'project_id'>>
  /** Pengganti keterangan di bawah judul modal. */
  keterangan?: string
  /** Pesan toast setelah tersimpan; bawaan "Data berhasil disimpan/diperbarui." */
  pesanSukses?: (rute: Route) => string
  /** Dipanggil setelah rute tersimpan, dengan rute hasil simpan (mis. untuk langsung dipilih di form trip). */
  onSaved?: (rute: Route) => void
}

/**
 * Modal Tambah / Ubah Rute, dipakai menu Rute dan form trip (tambah rute di tempat).
 * No. Route dibuat otomatis dan bisa di-Generate ulang, Klien wajib untuk rute baru,
 * Feet hanya untuk rute container Priok, dan nama ditulis "ASAL - TUJUAN".
 */
export function ModalRute(props: Props) {
  // Isi form dibuat ulang tiap kali modal dibuka, jadi isian lama tidak terbawa.
  if (!props.open) return null
  return <IsiModalRute {...props} />
}

function IsiModalRute({ onClose, rute: editing = null, awal, keterangan, pesanSukses, onSaved }: Props) {
  const { db, create, update } = useData()
  const toast = useToast()
  /** Feet = ukuran container, hanya untuk rute container Priok. Rute Karawang (alat berat) tidak memakainya. */
  const pakaiFeet = useWorkspace().workspace === 'priok'

  const [form, setForm] = useState<FormState>(() => editing
    ? {
      route_code: editing.route_code, route_name: editing.route_name, project_id: editing.project_id ?? '', feet: editing.feet,
      ujroute: editing.ujroute, toll: editing.toll ?? 0, commissioner: editing.commissioner, price: editing.price, estimated_fields: editing.estimated_fields ?? [],
    }
    : {
      ...BLANK, feet: pakaiFeet ? BLANK.feet : '', route_code: buatKodeUnik(db.routes.map((r) => r.route_code)),
      route_name: awal?.route_name ?? '', project_id: awal?.project_id ?? '',
    })
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})

  /** Tombol Generate: kode unik (timestamp + 7 huruf acak) yang belum dipakai route lain. */
  function generateKode() {
    const terpakai = db.routes.filter((r) => r.id !== editing?.id).map((r) => r.route_code)
    setForm((f) => ({ ...f, route_code: buatKodeUnik(terpakai) }))
    setErrors((e) => ({ ...e, route_code: undefined }))
  }

  const hargaWajib = !editing || editing.price > 0
  // Route dari data asli belum punya ukuran container; wajib dipilih hanya untuk route baru.
  const feetWajib = pakaiFeet && (!editing || !!editing.feet)
  // Klien trip diambil dari rutenya, jadi rute baru wajib punya klien. Rute lama yang
  // belum punya klien tetap bisa disimpan saat hanya mengubah nominal.
  const klienWajib = !editing || !!editing.project_id

  /** Nominal perkiraan yang belum diubah di form ini. */
  const masihKira = (k: RouteNominal) => !!editing?.estimated_fields?.includes(k) && form[k] === (editing[k] ?? 0)

  function validate(): boolean {
    const e: Partial<Record<keyof FormState, string>> = {}
    const code = form.route_code.trim()
    if (!code) e.route_code = 'No. Route wajib diisi. Klik Generate untuk membuatnya otomatis.'
    else if (db.routes.some((r) => r.route_code.toLowerCase() === code.toLowerCase() && r.id !== editing?.id))
      e.route_code = 'No. Route sudah dipakai. Gunakan kode lain.'
    if (!form.route_name.trim()) e.route_name = 'Nama Route wajib diisi.'
    if (klienWajib && !form.project_id) e.project_id = 'Klien wajib dipilih: trip yang memakai rute ini otomatis milik klien ini.'
    if (feetWajib && !form.feet) e.feet = 'Feet wajib dipilih.'
    // Route dari data asli belum punya harga; jangan paksa diisi saat hanya mengubah UJ / tol.
    if (hargaWajib && form.price <= 0) e.price = 'Harga harus lebih dari 0.'
    if (form.ujroute < 0) e.ujroute = 'UJROUTE tidak boleh negatif.'
    if (form.toll < 0) e.toll = 'Uang Tol tidak boleh negatif.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function onSubmit() {
    if (!validate()) return
    const payload = {
      ...form,
      route_code: form.route_code.trim().toUpperCase(),
      route_name: form.route_name.trim(),
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
    toast.success(pesanSukses?.(tersimpan) ?? (editing ? 'Data berhasil diperbarui.' : 'Data berhasil disimpan.'))
    onSaved?.(tersimpan)
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? 'Ubah Rute' : 'Tambah Rute'}
      subtitle={keterangan ?? (editing ? `No. Route ${editing.route_code}` : 'Tanda * wajib diisi. Nominal otomatis diformat Rupiah.')}
      footer={
        <>
          <Button onClick={onClose}>Batal</Button>
          <Button variant="primary" onClick={onSubmit}>{editing ? 'Simpan Perubahan' : 'Simpan'}</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="No. Route"
          required
          error={errors.route_code}
          className="sm:col-span-2"
          hint={errors.route_code ? undefined : 'Terisi otomatis dan dijamin unik. Klik Generate untuk kode baru, atau ketik sendiri.'}
        >
          {(id) => (
            <KodeInput id={id} value={form.route_code} invalid={!!errors.route_code} uppercase
              placeholder="Klik Generate atau ketik manual" generateTitle="Buat No. Route unik otomatis"
              onChange={(v) => setForm({ ...form, route_code: v })} onGenerate={generateKode} />
          )}
        </Field>
        <Field label="Klien" required={klienWajib} error={errors.project_id}
          hint={errors.project_id ? undefined : 'Trip yang memakai rute ini otomatis tercatat ke klien ini, jadi klien tidak dipilih lagi di form trip.'}>
          {(id) => (
            <Select id={id} value={form.project_id} invalid={!!errors.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })}>
              <option value="">{klienWajib ? '— pilih klien —' : '— belum ditentukan —'}</option>
              {db.projects.map((p) => <option key={p.id} value={p.id}>{p.project_code} — {p.project_name}</option>)}
            </Select>
          )}
        </Field>
        {pakaiFeet && (
        <Field label="Feet" required={feetWajib} error={errors.feet} hint={!form.feet && !errors.feet ? 'Data asli belum mencatat ukuran container route ini.' : undefined}>
          {(id) => (
            <Select id={id} value={form.feet} invalid={!!errors.feet} onChange={(e) => setForm({ ...form, feet: e.target.value })}>
              {!feetWajib && <option value="">— belum diisi —</option>}
              {FEET_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
            </Select>
          )}
        </Field>
        )}
        <Field label="Nama Route" required error={errors.route_name} className="sm:col-span-2"
          hint={errors.route_name ? undefined : 'Tulis ASAL - TUJUAN, mis. CIB - DURI: dipakai sebagai lokasi muat & bongkar di Berita Acara. Rute backload, mis. DURI - CIB BCKLD.'}>
          {(id) => <Input id={id} value={form.route_name} invalid={!!errors.route_name} placeholder="CIB - DURI" onChange={(e) => setForm({ ...form, route_name: e.target.value })} />}
        </Field>
        <Field label="UJROUTE" required error={errors.ujroute} hint={errors.ujroute ? undefined : masihKira('ujroute') ? 'Masih perkiraan. Ganti dengan nilai sebenarnya bila sudah tahu.' : 'Patokan uang jalan. Termin dicatat di trip saat dibayar.'}>
          {(id) => <CurrencyInput id={id} value={form.ujroute} invalid={!!errors.ujroute} onValueChange={(v) => setForm({ ...form, ujroute: v })} />}
        </Field>
        <Field label="Uang Tol" error={errors.toll} hint={errors.toll ? undefined : masihKira('toll') ? 'Masih perkiraan. Ganti dengan nilai sebenarnya bila sudah tahu.' : 'Patokan tol. Yang dibayar dicatat di biaya operasional trip.'}>
          {(id) => <CurrencyInput id={id} value={form.toll} invalid={!!errors.toll} onValueChange={(v) => setForm({ ...form, toll: v })} />}
        </Field>
        <Field label="Harga" required={hargaWajib} error={errors.price} hint={errors.price ? undefined : masihKira('price') ? 'Masih perkiraan. Ganti dengan nilai sebenarnya bila sudah tahu.' : 'Komisi sopir kini diatur di Komisi → tab Aturan.'}>
          {(id) => <CurrencyInput id={id} value={form.price} invalid={!!errors.price} onValueChange={(v) => setForm({ ...form, price: v })} />}
        </Field>
      </div>
    </Modal>
  )
}
