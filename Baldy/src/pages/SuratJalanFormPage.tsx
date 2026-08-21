import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Plus, Printer, Save, Trash2, TriangleAlert } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { Card, CardHeader } from '../components/ui/Card'
import { Button, IconButton } from '../components/ui/Button'
import { Field, Input, DateInput, FieldError } from '../components/ui/Field'
import { SearchableSelect } from '../components/ui/SearchableSelect'
import { Badge } from '../components/ui/Badge'
import { useData } from '../store/DataProvider'
import { useAuth } from '../store/AuthProvider'
import { useToast } from '../store/ToastProvider'
import { todayISO } from '../lib/format'
import { cn } from '../lib/utils'
import type { DeliveryNote } from '../types'

type FormState = Omit<DeliveryNote, 'id' | 'created_at' | 'updated_at' | 'printed_at'>

const BLANK: FormState = {
  sj_no: '', sj_date: todayISO(), recipient_name: '', recipient_address_1: '', recipient_address_2: '',
  vehicle_id: '', party: '', job_order_id: '', goods_type: '', kosongan: '', location: '',
  ship: '', destination: '', containers: [''],
}

/** Bungkus satu section form supaya field tidak menumpuk tanpa grouping. */
function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader title={title} subtitle={description} />
      <div className="p-4">{children}</div>
    </Card>
  )
}

/** Tunggu data ter-hidrasi dulu: nomor otomatis dan pencarian record
 *  bergantung pada isi database. */
export function SuratJalanFormPage({ mode }: { mode: 'create' | 'edit' }) {
  const { loading } = useData()
  const { id } = useParams()

  if (loading) {
    return (
      <>
        <PageHeader
          title={mode === 'edit' ? 'Memuat Surat Jalan...' : 'Tambah Surat Jalan'}
          crumbs={[{ label: 'Transaksi' }, { label: 'Surat Jalan', to: '/transaksi/surat-jalan' }]}
        />
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="skeleton h-48 rounded-xl" />
          <div className="skeleton h-48 rounded-xl" />
        </div>
        <div className="skeleton mt-4 h-64 rounded-xl" />
      </>
    )
  }
  return <SuratJalanForm mode={mode} key={id ?? 'baru'} />
}

function SuratJalanForm({ mode }: { mode: 'create' | 'edit' }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const { db, create, update } = useData()
  const { canEdit } = useAuth()
  const toast = useToast()

  const existing = mode === 'edit' ? db.deliveryNotes.find((n) => n.id === id) : undefined

  /** Penomoran berurutan mulai SJ-000001. */
  const nextNo = useMemo(() => {
    const max = db.deliveryNotes.reduce((acc, n) => {
      const num = Number(n.sj_no.replace(/\D/g, ''))
      return Number.isFinite(num) ? Math.max(acc, num) : acc
    }, 0)
    return `SJ-${String(max + 1).padStart(6, '0')}`
  }, [db.deliveryNotes])

  const [form, setForm] = useState<FormState>(() =>
    existing
      ? { ...existing, containers: existing.containers.length ? [...existing.containers] : [''] }
      : { ...BLANK, sj_no: nextNo },
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [containerErrors, setContainerErrors] = useState<Record<number, string>>({})

  const joOptions = useMemo(
    () => db.jobOrders.map((j) => ({ value: j.id, label: j.sijo, meta: `${j.customer_name} · ${j.party}`, keywords: `${j.customer_code} ${j.goods} ${j.ship}` })),
    [db.jobOrders],
  )
  const vehicleOptions = useMemo(
    () => db.vehicles.map((v) => ({ value: v.id, label: v.plate_number, meta: v.vehicle_type })),
    [db.vehicles],
  )

  if (mode === 'edit' && !existing) {
    return (
      <>
        <PageHeader title="Surat Jalan tidak ditemukan" crumbs={[{ label: 'Transaksi' }, { label: 'Surat Jalan', to: '/transaksi/surat-jalan' }]} />
        <Card>
          <div className="px-6 py-14 text-center">
            <p className="text-[14px] font-semibold text-ink">Data tidak ditemukan.</p>
            <p className="mt-1 text-[13px] text-ink-3">Surat Jalan mungkin sudah dihapus.</p>
            <Button className="mt-4" onClick={() => navigate('/transaksi/surat-jalan')}>Kembali ke daftar</Button>
          </div>
        </Card>
      </>
    )
  }

  /** Isi otomatis dari SI/JO yang dipilih — hanya field yang datanya memang ada. */
  function applyJobOrder(joId: string | null) {
    if (!joId) {
      setForm((f) => ({ ...f, job_order_id: '' }))
      return
    }
    const jo = db.jobOrders.find((j) => j.id === joId)
    if (!jo) return
    const [line1, ...rest] = jo.customer_address.split(',')
    setForm((f) => ({
      ...f,
      job_order_id: joId,
      recipient_name: jo.customer_name,
      recipient_address_1: line1.trim(),
      recipient_address_2: rest.join(',').trim(),
      party: jo.party,
      ship: jo.ship,
      goods_type: f.goods_type || jo.goods,
    }))
    toast.info(`Data customer diambil dari SI/JO ${jo.sijo}.`)
  }

  /* ── Container: list dinamis ──────────────────────────────── */
  function setContainer(index: number, value: string) {
    setForm((f) => {
      const next = [...f.containers]
      next[index] = value.toUpperCase().replace(/\s+/g, '')
      return { ...f, containers: next }
    })
  }

  function addContainer() {
    setForm((f) => ({ ...f, containers: [...f.containers, ''] }))
  }

  function removeContainer(index: number) {
    setForm((f) => {
      const next = f.containers.filter((_, i) => i !== index)
      return { ...f, containers: next.length ? next : [''] }
    })
    setContainerErrors({})
  }

  /** Paste banyak nomor sekaligus (dipisah baris/koma/spasi). */
  function onPasteContainer(index: number, e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData('text')
    const parts = text.split(/[\s,;\n\r\t]+/).map((s) => s.trim().toUpperCase()).filter(Boolean)
    if (parts.length <= 1) return
    e.preventDefault()
    setForm((f) => {
      const next = [...f.containers]
      next.splice(index, 1, ...parts)
      return { ...f, containers: next.filter((c, i) => c !== '' || i === next.length - 1) }
    })
    toast.info(`${parts.length} nomor container ditambahkan.`)
  }

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!form.sj_no.trim()) e.sj_no = 'Nomor Surat Jalan wajib diisi.'
    else if (db.deliveryNotes.some((n) => n.sj_no.toLowerCase() === form.sj_no.trim().toLowerCase() && n.id !== existing?.id))
      e.sj_no = 'Nomor Surat Jalan sudah dipakai.'
    if (!form.sj_date) e.sj_date = 'Tanggal wajib diisi.'
    if (!form.recipient_name.trim()) e.recipient_name = 'Kepada Yth wajib diisi.'
    if (!form.vehicle_id) e.vehicle_id = 'No. Polisi wajib dipilih.'
    if (!form.destination.trim()) e.destination = 'Tujuan wajib diisi.'

    // Validasi container: tidak kosong, tidak duplikat dalam satu Surat Jalan.
    const ce: Record<number, string> = {}
    const seen = new Map<string, number>()
    const filled = form.containers.map((c) => c.trim().toUpperCase())
    if (filled.every((c) => !c)) e.containers = 'Minimal satu nomor container harus diisi.'
    filled.forEach((c, i) => {
      if (!c) {
        if (filled.filter(Boolean).length > 0 && form.containers.length > 1) ce[i] = 'Nomor container tidak boleh kosong.'
        return
      }
      if (seen.has(c)) ce[i] = 'Nomor container sudah digunakan.'
      else seen.set(c, i)
    })
    setErrors(e)
    setContainerErrors(ce)
    return Object.keys(e).length === 0 && Object.keys(ce).length === 0
  }

  function save(thenPrint: boolean) {
    if (!validate()) {
      toast.error('Periksa kembali isian yang ditandai merah.')
      return
    }
    const payload = {
      ...form,
      sj_no: form.sj_no.trim(),
      recipient_name: form.recipient_name.trim(),
      destination: form.destination.trim(),
      containers: form.containers.map((c) => c.trim().toUpperCase()).filter(Boolean),
    }
    if (existing) {
      update('deliveryNotes', existing.id, payload)
      toast.success('Surat Jalan berhasil diperbarui.')
      navigate(`/transaksi/surat-jalan/${existing.id}${thenPrint ? '?print=1' : ''}`)
    } else {
      const created = create('deliveryNotes', { ...payload, printed_at: null })
      toast.success('Surat Jalan berhasil disimpan.')
      navigate(`/transaksi/surat-jalan/${created.id}${thenPrint ? '?print=1' : ''}`)
    }
  }

  const containerCount = form.containers.filter((c) => c.trim()).length
  const selectedJo = db.jobOrders.find((j) => j.id === form.job_order_id)

  return (
    <div className="pb-20">
      <PageHeader
        title={mode === 'edit' ? `Ubah ${existing?.sj_no}` : 'Tambah Surat Jalan'}
        crumbs={[
          { label: 'Transaksi' },
          { label: 'Surat Jalan', to: '/transaksi/surat-jalan' },
          { label: mode === 'edit' ? 'Ubah' : 'Tambah' },
        ]}
        description="Isi seluruh informasi dalam satu halaman, lalu simpan atau langsung cetak."
      />

      {!canEdit && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-[#f6e2ac] bg-[#fff8e6] px-3.5 py-2.5 text-[12.5px] text-[#8a6100]">
          <TriangleAlert size={15} className="mt-px shrink-0" />
          Peran Viewer tidak dapat menyimpan perubahan. Form ini hanya untuk melihat struktur data.
        </div>
      )}


      <div className="mb-4">
        <Card>
          <CardHeader
            title="Container"
            subtitle="Tambahkan nomor container satu per satu, atau paste beberapa nomor sekaligus."
            actions={<Badge tone={containerCount > 0 ? 'brand' : 'neutral'}>{containerCount} container</Badge>}
          />
          <div className="p-4">
            <div className="space-y-2">
              {form.containers.map((c, i) => (
                <div key={i}>
                  <div className="flex items-center gap-2">
                    <span className="tnum w-6 shrink-0 text-[12.5px] font-semibold text-ink-3">{i + 1}.</span>
                    <Input
                      value={c}
                      invalid={!!containerErrors[i]}
                      placeholder="TGHU1234567"
                      className="max-w-md font-medium tracking-wide"
                      onChange={(e) => setContainer(i, e.target.value)}
                      onPaste={(e) => onPasteContainer(i, e)}
                      aria-label={`Nomor container ${i + 1}`}
                    />
                    <IconButton
                      label="Hapus container"
                      tone="danger"
                      icon={<Trash2 size={14} />}
                      disabled={form.containers.length === 1 && !c}
                      onClick={() => removeContainer(i)}
                    />
                  </div>
                  {containerErrors[i] && <p className="mt-1 pl-8 text-[12px] font-medium text-[color:var(--color-critical)]">{containerErrors[i]}</p>}
                </div>
              ))}
            </div>
            {errors.containers && <div className="mt-2"><FieldError>{errors.containers}</FieldError></div>}
            <Button className="mt-3" size="sm" icon={<Plus size={14} />} onClick={addContainer}>Tambah Container</Button>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Section title="Informasi Dokumen">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tanggal" required error={errors.sj_date}>
              {(fid) => <DateInput id={fid} value={form.sj_date} invalid={!!errors.sj_date} onChange={(e) => setForm({ ...form, sj_date: e.target.value })} />}
            </Field>
            <Field label="Nomor Surat Jalan" required error={errors.sj_no} hint={errors.sj_no ? undefined : 'Nomor urut otomatis.'}>
              {(fid) => <Input id={fid} value={form.sj_no} invalid={!!errors.sj_no} onChange={(e) => setForm({ ...form, sj_no: e.target.value })} />}
            </Field>
          </div>
        </Section>

        <Section title="Penerima">
          <div className="space-y-4">
            <Field label="Kepada Yth" required error={errors.recipient_name}>
              {(fid) => (
                <Input id={fid} value={form.recipient_name} invalid={!!errors.recipient_name}
                  placeholder="PT PINDODELI PULP &amp; PAPER MILLS"
                  onChange={(e) => setForm({ ...form, recipient_name: e.target.value })} />
              )}
            </Field>
            <Field label="di" hint="Dua baris alamat penerima.">
              {(fid) => (
                <div className="space-y-2">
                  <Input id={fid} value={form.recipient_address_1} placeholder="Kawasan Industri Pindodeli"
                    onChange={(e) => setForm({ ...form, recipient_address_1: e.target.value })} />
                  <Input value={form.recipient_address_2} placeholder="Karawang"
                    onChange={(e) => setForm({ ...form, recipient_address_2: e.target.value })} />
                </div>
              )}
            </Field>
          </div>
        </Section>
      </div>

      <div className="mt-4">
        <Section title="Informasi Pengiriman" description="Pilih SI/BL untuk mengisi otomatis Customer, Party, dan Kapal dari data SI / Job Order.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="No. Polisi" required error={errors.vehicle_id}>
              {(fid) => (
                <SearchableSelect id={fid} options={vehicleOptions} value={form.vehicle_id || null} invalid={!!errors.vehicle_id}
                  placeholder="Pilih nomor polisi..." onChange={(v) => setForm({ ...form, vehicle_id: v ?? '' })} />
              )}
            </Field>
            <Field label="Party">
              {(fid) => <Input id={fid} value={form.party} placeholder="40 X 40" onChange={(e) => setForm({ ...form, party: e.target.value })} />}
            </Field>
            <Field label="SI / BL" hint={selectedJo ? `Customer: ${selectedJo.customer_name}` : 'Cari nomor SI / Job Order.'}>
              {(fid) => (
                <SearchableSelect id={fid} options={joOptions} value={form.job_order_id || null}
                  placeholder="Cari SI / Job Order..." onChange={applyJobOrder} />
              )}
            </Field>
            <Field label="Jenis Brg">
              {(fid) => <Input id={fid} value={form.goods_type} placeholder="Container" onChange={(e) => setForm({ ...form, goods_type: e.target.value })} />}
            </Field>
            <Field label="Kosongan">
              {(fid) => <Input id={fid} value={form.kosongan} placeholder="DEPO MUSTIKA CAKUNG" onChange={(e) => setForm({ ...form, kosongan: e.target.value })} />}
            </Field>
            <Field label="Lokasi">
              {(fid) => <Input id={fid} value={form.location} placeholder="JICT 1" onChange={(e) => setForm({ ...form, location: e.target.value })} />}
            </Field>
            <Field label="Kapal">
              {(fid) => <Input id={fid} value={form.ship} placeholder="MV. ORIENTAL DIAMOND" onChange={(e) => setForm({ ...form, ship: e.target.value })} />}
            </Field>
            <Field label="Tujuan" required error={errors.destination}>
              {(fid) => (
                <Input id={fid} value={form.destination} invalid={!!errors.destination} placeholder="PRIOK-SERANG 40'(K)"
                  onChange={(e) => setForm({ ...form, destination: e.target.value })} />
              )}
            </Field>
          </div>
        </Section>
      </div>


      {/* Sticky action bar */}
      <div className={cn('no-print fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-surface/95 backdrop-blur', 'px-4 py-3 lg:px-6')}>
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3">
          <p className="hidden text-[12.5px] text-ink-3 sm:block">
            {containerCount} container &middot; {form.sj_no || 'nomor belum diisi'}
          </p>
          <div className="ml-auto flex items-center gap-2">
            <Button onClick={() => navigate('/transaksi/surat-jalan')}>Batal</Button>
            <Button icon={<Printer size={15} />} disabled={!canEdit} onClick={() => save(true)}>Simpan &amp; Cetak</Button>
            <Button variant="primary" icon={<Save size={15} />} disabled={!canEdit} onClick={() => save(false)}>Simpan</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
