import { useCallback, useMemo, useState } from 'react'
import { FaPen, FaPlus, FaTrashCan, FaXmark } from '../components/ui/icons'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { DataTable } from '../components/ui/DataTable'
import type { Column } from '../components/ui/DataTable'
import { Button, IconButton } from '../components/ui/Button'
import { Modal, ConfirmDialog } from '../components/ui/Modal'
import { Checkbox, Field, Input, Select, Textarea } from '../components/ui/Field'
import { CurrencyInput } from '../components/ui/CurrencyInput'
import { Badge } from '../components/ui/Badge'
import { FilterField, Toolbar } from '../components/ui/Toolbar'
import { EmptyState, NotFoundState } from '../components/ui/States'
import { useData } from '../store/DataProvider'
import { useAuth } from '../store/AuthProvider'
import { useToast } from '../store/ToastProvider'
import { currencyInputValue, formatRupiah, parseCurrencyInput } from '../lib/format'
import { terapkan, tulisRentang } from '../lib/komisi'
import { cn } from '../lib/utils'
import { DASAR_KOMISI, DASAR_KOMISI_LABEL, EMPLOYEE_ROLES, ROLE_LABEL, SERVICE_LABEL, SERVICE_TYPES, VEHICLE_CONFIGS } from '../types'
import type { CommissionScheme, CommissionTier, CommissionUnit, DasarKomisi, EmployeeRole, ServiceType } from '../types'

type FormState = Omit<CommissionScheme, 'id' | 'created_at' | 'updated_at' | 'workspace'>

const TINGKAT_KOSONG: CommissionTier = { target_awal: 0, target_akhir: 0, commission: 0, commission_unit: 'rp' }
const BLANK: FormState = {
  name: '', role: 'sopir', service_type: 'callout', configurations: [], basis: 'nilai', base_deduction_pct: 0,
  is_active: true, tiers: [TINGKAT_KOSONG], notes: '',
}

const LAYANAN_LABEL: Record<ServiceType | 'semua', string> = { ...SERVICE_LABEL, semua: 'Semua layanan' }

/** Penjelasan dasar hitung, ditampilkan di bawah pilihan. */
const PENJELASAN_DASAR: Record<DasarKomisi, string> = {
  nilai: 'Harga yang diisi di trip; bila kosong memakai Harga route.',
  uj: 'UJROUTE route; bila kosong memakai total UJ yang dibayar.',
  kontrak: 'Nilai kontrak Dedicated, dihitung per kontrak (bukan per trip).',
}

/** 10.5 -> "10,5" mengikuti penulisan angka Indonesia. */
const tulisAngka = (v: number) => String(v).replace('.', ',')

/** Nilai komisi apa adanya: "Rp 25.000" atau "10%". */
const tulisKomisi = (nilai: number, unit: CommissionUnit) =>
  unit === 'persen' ? `${tulisAngka(nilai)}%` : formatRupiah(nilai)


/**
 * Isian komisi dengan pemilih satuan menempel di kiri kolom angka:
 * Rp untuk nominal tetap, % untuk bagian dari target.
 */
function NilaiKomisi({
  id, value, unit, target, onValue, onUnit, invalid,
}: {
  id: string
  value: number
  unit: CommissionUnit
  /** Dipakai sebagai dasar konversi Rp <-> persen. */
  target: number
  onValue: (v: number) => void
  onUnit: (u: CommissionUnit) => void
  invalid?: boolean
}) {
  const persen = unit === 'persen'

  function ubah(raw: string) {
    if (!persen) { onValue(parseCurrencyInput(raw)); return }
    const angka = Number(raw.replace(',', '.').replace(/[^\d.]/g, ''))
    onValue(Number.isFinite(angka) ? Math.min(angka, 100) : 0)
  }

  const setara = persen ? Math.round((value / 100) * target) : 0

  /**
   * Ganti satuan ikut mengonversi angkanya lewat target, jadi nilai yang sudah
   * diisi tidak hilang. Dasar konversinya target awal tingkat ini (TBD-16).
   */
  function gantiSatuan(next: CommissionUnit) {
    if (next === unit) return
    onUnit(next)
    if (!target || !value) { onValue(0); return }
    onValue(next === 'persen'
      ? Math.min(Math.round((value / target) * 10000) / 100, 100)
      : Math.round((value / 100) * target))
  }

  return (
    <>
      <div
        className={cn(
          'flex h-9 w-full items-center overflow-hidden rounded-md border bg-surface transition-colors',
          'focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-500/15',
          invalid ? 'border-[color:var(--color-critical)]' : 'border-hairline',
        )}
      >
        <select
          value={unit}
          aria-label="Satuan komisi"
          onChange={(e) => gantiSatuan(e.target.value as CommissionUnit)}
          className="h-full cursor-pointer border-r border-hairline bg-sunken pr-6 pl-2.5 text-[12px] font-semibold text-ink-2 outline-none"
        >
          <option value="rp">Rp</option>
          <option value="persen">%</option>
        </select>
        <input
          id={id}
          inputMode="decimal"
          value={persen ? tulisAngka(value) : currencyInputValue(value)}
          onChange={(e) => ubah(e.target.value)}
          className="tnum h-full min-w-0 flex-1 bg-transparent px-2.5 text-right text-[13px] text-ink outline-none"
        />
      </div>
      {persen && (
        <p className="mt-1 text-[12px] text-ink-3">
          {target > 0
            ? <>Setara <span className="tnum font-semibold text-ink-2">{formatRupiah(setara)}</span> dari target awal {formatRupiah(target)}</>
            : 'Isi target awal dulu supaya nilai persennya bisa dihitung.'}
        </p>
      )}
    </>
  )
}

/**
 * Aturan komisi: tab Aturan di halaman Laporan -> Komisi (dulu menu Master Data ->
 * Aturan Komisi). Satu pengaturan = satu peran (sopir / manager) dengan beberapa
 * tingkat target. Di sini hanya mengatur nilai; pencapaiannya dilaporkan di tab Laporan.
 *
 * `tertanam`: dirender sebagai tab di halaman Komisi, tanpa kepala halaman sendiri.
 */
export function KomisiPage({ tertanam = false }: { tertanam?: boolean } = {}) {
  const { db, loading, error, reload, create, update, remove } = useData()
  const { canEdit } = useAuth()
  const toast = useToast()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<CommissionScheme | null>(null)
  const [form, setForm] = useState<FormState>(BLANK)
  const [galat, setGalat] = useState<{ umum?: string; name?: string; tingkat?: Record<number, string> }>({})
  const [deleting, setDeleting] = useState<CommissionScheme | null>(null)
  const [peran, setPeran] = useState('')
  const [coba, setCoba] = useState(15_000_000)

  const rows = useMemo(
    () => db.commissionSchemes.filter((s) => !peran || (s.role ?? 'sopir') === peran),
    [db.commissionSchemes, peran],
  )

  function openCreate() {
    setEditing(null); setForm({ ...BLANK, tiers: [{ ...TINGKAT_KOSONG }] }); setGalat({}); setFormOpen(true)
  }

  function openEdit(s: CommissionScheme) {
    setEditing(s)
    setForm({
      name: s.name, role: s.role ?? 'sopir', notes: s.notes ?? '',
      service_type: s.service_type ?? 'callout', configurations: [...(s.configurations ?? [])],
      basis: s.basis ?? 'nilai', base_deduction_pct: s.base_deduction_pct ?? 0, is_active: s.is_active !== false,
      tiers: s.tiers?.length ? s.tiers.map((t) => ({ ...t })) : [{ ...TINGKAT_KOSONG }],
    })
    setGalat({}); setFormOpen(true)
  }

  /** Ubah satu tingkat tanpa menimpa isian tingkat lain. */
  const ubahTingkat = useCallback((i: number, patch: Partial<CommissionTier>) => {
    setForm((f) => ({ ...f, tiers: f.tiers.map((t, j) => (j === i ? { ...t, ...patch } : t)) }))
  }, [])

  /** Tingkat baru melanjutkan dari target akhir tingkat terakhir. */
  function tambahTingkat() {
    setForm((f) => {
      const akhir = f.tiers[f.tiers.length - 1]
      const mulai = akhir?.target_akhir || akhir?.target_awal || 0
      return { ...f, tiers: [...f.tiers, { ...TINGKAT_KOSONG, target_awal: mulai, commission_unit: akhir?.commission_unit ?? 'rp' }] }
    })
  }

  function hapusTingkat(i: number) {
    setForm((f) => ({ ...f, tiers: f.tiers.filter((_, j) => j !== i) }))
  }

  function toggleKendaraan(k: string) {
    setForm((f) => ({
      ...f,
      configurations: f.configurations.includes(k) ? f.configurations.filter((x) => x !== k) : [...f.configurations, k],
    }))
  }

  /** Simulasi di form: nilai contoh -> tingkat dan komisinya. */
  const hasilCoba = terapkan({ ...form, id: '', created_at: '', updated_at: '' }, coba)

  function onSubmit() {
    const tingkat: Record<number, string> = {}
    if (!form.name.trim()) setGalat((g) => ({ ...g, name: 'Nama wajib diisi.' }))
    form.tiers.forEach((t, i) => {
      if (t.target_akhir > 0 && t.target_akhir <= t.target_awal) tingkat[i] = 'Target akhir harus lebih besar dari target awal.'
      else if (t.commission <= 0) tingkat[i] = 'Komisi harus lebih dari 0.'
    })
    // Tingkat tidak boleh saling tumpang tindih.
    const urut = form.tiers.map((t, i) => ({ ...t, i })).sort((a, b) => a.target_awal - b.target_awal)
    for (let k = 1; k < urut.length; k++) {
      const sebelum = urut[k - 1]
      if (sebelum.target_akhir === 0 || urut[k].target_awal < sebelum.target_akhir) {
        tingkat[urut[k].i] ??= `Rentang bertumpuk dengan tingkat ${sebelum.i + 1}.`
      }
    }
    const e = { name: form.name.trim() ? undefined : 'Nama wajib diisi.', tingkat }
    setGalat(e)
    if (e.name || Object.keys(tingkat).length > 0) { toast.error('Periksa kembali isian yang ditandai merah.'); return }

    const payload = { ...form, name: form.name.trim(), notes: form.notes.trim(), tiers: urut.map(({ i: _i, ...t }) => t) }
    if (editing) { update('commissionSchemes', editing.id, payload); toast.success('Komisi berhasil diperbarui.') }
    else { create('commissionSchemes', payload); toast.success('Komisi berhasil disimpan.') }
    setFormOpen(false)
  }

  function onDelete() {
    if (!deleting) return
    remove('commissionSchemes', deleting.id)
    toast.success('Komisi berhasil dihapus.')
    setDeleting(null)
  }

  const columns: Column<CommissionScheme>[] = [
    {
      key: 'name', header: 'Nama',
      render: (s) => (
        <div className="leading-tight">
          <span className="font-medium text-ink">{s.name}</span>
          <span className="mt-1 block text-[12px] text-ink-3">
            {DASAR_KOMISI_LABEL[s.basis ?? 'nilai']}
            {s.base_deduction_pct ? ` · potong ${String(s.base_deduction_pct).replace('.', ',')}%` : ''}
          </span>
        </div>
      ),
    },
    {
      key: 'role', header: 'Untuk', width: '110px',
      render: (s) => <Badge tone={s.role === 'manager' ? 'brand' : 'neutral'}>{ROLE_LABEL[s.role ?? 'sopir']}</Badge>,
    },
    {
      key: 'configurations', header: 'Berlaku', width: '190px',
      render: (s) => (
        <div className="leading-tight">
          <span className="text-[12.5px] text-ink-2">{LAYANAN_LABEL[s.service_type ?? 'callout']}</span>
          <span className="mt-1 block text-[12px] text-ink-3">
            {(s.configurations ?? []).length ? (s.configurations ?? []).join(', ') : 'Semua kendaraan'}
          </span>
        </div>
      ),
    },
    {
      key: 'tiers', header: 'Target', width: '280px',
      render: (s) => (
        <ul className="tnum space-y-1 text-[12.5px]">
          {(s.tiers ?? []).map((t, i) => <li key={i} className="text-ink-2">{tulisRentang(t)}</li>)}
        </ul>
      ),
    },
    {
      key: 'commission', header: 'Komisi', align: 'right', width: '160px',
      render: (s) => (
        <ul className="tnum space-y-1 text-[12.5px]">
          {(s.tiers ?? []).map((t, i) => <li key={i} className="font-semibold text-ink">{tulisKomisi(t.commission, t.commission_unit)}</li>)}
        </ul>
      ),
    },
    {
      key: 'is_active', header: 'Status', width: '100px',
      render: (s) => (s.is_active !== false ? <Badge tone="good">Aktif</Badge> : <Badge tone="neutral">Nonaktif</Badge>),
    },
    {
      key: 'action', header: 'Action', align: 'right', width: '92px',
      render: (s) => (
        <div className="flex justify-end gap-1">
          <IconButton label="Ubah" icon={<FaPen size={14} />} disabled={!canEdit} onClick={() => openEdit(s)} />
          <IconButton label="Hapus" tone="danger" icon={<FaTrashCan size={14} />} disabled={!canEdit} onClick={() => setDeleting(s)} />
        </div>
      ),
    },
  ]

  return (
    <>
      {!tertanam && (
        <PageHeader title="Aturan Komisi" crumbs={[{ label: 'Laporan' }, { label: 'Komisi', to: '/laporan/komisi' }, { label: 'Aturan' }]} />
      )}

      <p className="mb-3 max-w-3xl px-1 text-[13px] leading-relaxed text-ink-2">
        Aturan komisi menentukan besar komisi sopir dan manager. Komisi setiap trip dihitung otomatis: sistem memakai
        aturan aktif yang cocok dengan peran, layanan, dan jenis kendaraan trip itu, lalu memilih tingkat sesuai nilai
        dasarnya (biasanya harga trip). Hasilnya langsung tampil di detail trip dan laporan komisi.
      </p>

      <Card>
        <Toolbar
          left={
            <>
              <FilterField label="Untuk">
                <Select value={peran} onChange={(e) => setPeran(e.target.value)} className="h-9 w-36">
                  <option value="">Semua</option>
                  {EMPLOYEE_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                </Select>
              </FilterField>
              {peran && <Button size="sm" variant="ghost" icon={<FaXmark size={14} />} onClick={() => setPeran('')}>Reset</Button>}
            </>
          }
          right={
            <>
              <span className="text-[12.5px] text-ink-3">{db.commissionSchemes.length} pengaturan komisi</span>
              <Button variant="primary" icon={<FaPlus size={15} />} disabled={!canEdit} onClick={openCreate}>
                Tambah Komisi
              </Button>
            </>
          }
        />
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(s) => s.id}
          loading={loading}
          error={error}
          onRetry={reload}
          isFiltered={!!peran}
          skeletonCols={7}
          empty={<EmptyState entity="aturan komisi" />}
          notFound={<NotFoundState onReset={() => setPeran('')} />}
        />
      </Card>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Ubah Komisi' : 'Pengaturan Komisi'}
        subtitle="Komisi tiap trip dihitung otomatis dari aturan yang paling cocok dengan peran, layanan, dan kendaraannya."
        size="lg"
        footer={
          <>
            <Button onClick={() => setFormOpen(false)}>Batal</Button>
            <Button variant="primary" onClick={onSubmit}>Save</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
            <Field label="Untuk" required hint="Peran karyawan penerima komisi ini.">
              {(id) => (
                <Select id={id} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as EmployeeRole })}>
                  {EMPLOYEE_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                </Select>
              )}
            </Field>
            <Field label="Nama" required error={galat.name}>
              {(id) => (
                <Input id={id} value={form.name} invalid={!!galat.name} placeholder="Komisi Sopir"
                  onChange={(e) => setForm({ ...form, name: e.target.value })} />
              )}
            </Field>
          </div>

          <div className="grid gap-4 rounded-lg border border-hairline bg-sunken p-3.5 sm:grid-cols-2">
            <Field label="Layanan" hint="Aturan hanya dipakai trip dengan layanan ini.">
              {(id) => (
                <Select id={id} value={form.service_type} onChange={(e) => setForm({ ...form, service_type: e.target.value as FormState['service_type'] })}>
                  {[...SERVICE_TYPES, 'semua' as const].map((l) => <option key={l} value={l}>{LAYANAN_LABEL[l]}</option>)}
                </Select>
              )}
            </Field>
            <Field label="Dasar hitung" hint={PENJELASAN_DASAR[form.basis]}>
              {(id) => (
                <Select id={id} value={form.basis} onChange={(e) => setForm({ ...form, basis: e.target.value as DasarKomisi })}>
                  {DASAR_KOMISI.map((d) => <option key={d} value={d}>{DASAR_KOMISI_LABEL[d]}</option>)}
                </Select>
              )}
            </Field>
            <div className="sm:col-span-2">
              <p className="mb-1.5 text-[12px] font-semibold tracking-wide text-ink-2">Jenis kendaraan</p>
              <div className="flex flex-wrap gap-1.5">
                {VEHICLE_CONFIGS.map((k) => {
                  const aktif = form.configurations.includes(k)
                  return (
                    <button
                      key={k}
                      type="button"
                      aria-pressed={aktif}
                      onClick={() => toggleKendaraan(k)}
                      className={cn(
                        'rounded-md border px-2.5 py-1 text-[12px] font-semibold transition-colors',
                        aktif ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-hairline bg-surface text-ink-3 hover:text-ink',
                      )}
                    >
                      {k}
                    </button>
                  )
                })}
              </div>
              <p className="mt-1 text-[12px] text-ink-3">
                {form.configurations.length ? `Berlaku untuk ${form.configurations.join(', ')}.` : 'Tidak ada yang dipilih = berlaku untuk semua kendaraan.'}
              </p>
            </div>
            <Field label="Potongan dasar (%)" hint="Dasar dikurangi dulu sebelum dicari tingkatnya, mis. 5 untuk (nilai − 5%).">
              {(id) => (
                <Input id={id} inputMode="decimal" className="tnum text-right"
                  value={String(form.base_deduction_pct).replace('.', ',')}
                  onChange={(e) => {
                    const v = Number(e.target.value.replace(',', '.').replace(/[^\d.]/g, ''))
                    setForm({ ...form, base_deduction_pct: Number.isFinite(v) ? Math.min(v, 100) : 0 })
                  }} />
              )}
            </Field>
          </div>

          {form.tiers.map((t, i) => (
            <section key={i} className="rounded-lg border border-hairline">
              <header className="flex items-center justify-between border-b border-hairline bg-sunken px-3.5 py-2">
                <p className="text-[12.5px] font-semibold text-ink-2">Tingkat {i + 1}</p>
                {form.tiers.length > 1 && (
                  <button type="button" onClick={() => hapusTingkat(i)}
                    className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[12px] font-medium text-ink-3 transition hover:bg-[#fdf2f2] hover:text-[color:var(--color-critical)]">
                    <FaXmark size={13} /> Hapus tingkat
                  </button>
                )}
              </header>
              <div className="grid gap-4 p-3.5 sm:grid-cols-2">
                <Field label="Target Awal" required>
                  {(id) => <CurrencyInput id={id} value={t.target_awal} onValueChange={(v) => ubahTingkat(i, { target_awal: v })} />}
                </Field>
                <Field label="Target Akhir" hint="Kosongkan (0) bila tanpa batas atas.">
                  {(id) => <CurrencyInput id={id} value={t.target_akhir} onValueChange={(v) => ubahTingkat(i, { target_akhir: v })} />}
                </Field>
                <Field label="Komisi" required className="sm:col-span-2">
                  {(id) => (
                    <NilaiKomisi
                      id={id}
                      value={t.commission}
                      unit={t.commission_unit}
                      target={t.target_awal || t.target_akhir}
                      invalid={!!galat.tingkat?.[i]}
                      onValue={(v) => ubahTingkat(i, { commission: v })}
                      onUnit={(u) => ubahTingkat(i, { commission_unit: u })}
                    />
                  )}
                </Field>
                {galat.tingkat?.[i] && (
                  <p className="text-[12px] font-medium text-[color:var(--color-critical)] sm:col-span-2">{galat.tingkat[i]}</p>
                )}
              </div>
            </section>
          ))}

          <Button icon={<FaPlus size={15} />} onClick={tambahTingkat} className="w-full justify-center border-dashed">
            Tambah tingkat
          </Button>

          <div className="rounded-lg border border-brand-100 bg-brand-50/60 px-3.5 py-3">
            <p className="text-[12px] font-semibold tracking-wide text-brand-800">Coba hitung</p>
            <div className="mt-2 grid items-center gap-3 sm:grid-cols-[220px_1fr]">
              <CurrencyInput value={coba} onValueChange={setCoba} aria-label="Harga contoh" />
              <p className="text-[12.5px] text-brand-800">
                {hasilCoba.tingkat
                  ? <>Masuk tingkat <span className="tnum font-semibold">{tulisRentang(hasilCoba.tingkat)}</span> → komisi <span className="tnum font-semibold">{formatRupiah(hasilCoba.nilai)}</span></>
                  : 'Tidak masuk tingkat mana pun, jadi tidak dapat komisi.'}
                {form.base_deduction_pct > 0 && hasilCoba.dasar > 0 && <> (dasar setelah potongan {formatRupiah(hasilCoba.dasar)})</>}
              </p>
            </div>
          </div>

          <Checkbox
            checked={form.is_active}
            onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            label="Aktif — dipakai untuk menghitung komisi trip"
          />

          <Field label="Catatan">
            {(id) => (
              <Textarea id={id} rows={3} value={form.notes} className="resize-y"
                placeholder="Keterangan tambahan, mis. syarat komisi atau masa berlaku."
                onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            )}
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        message={
          <>
            Data yang sudah dihapus mungkin tidak dapat dikembalikan.
            <br />
            <span className="mt-2 block font-medium text-ink">{deleting?.name}</span>
          </>
        }
        onCancel={() => setDeleting(null)}
        onConfirm={onDelete}
      />
    </>
  )
}
