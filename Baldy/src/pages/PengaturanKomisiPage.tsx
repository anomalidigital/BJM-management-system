import { useCallback, useMemo, useState } from 'react'
import { CircleDashed, Pencil, Plus, Target, Trash2, TrendingUp, Trophy } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { Tabs } from '../components/ui/Tabs'
import { Badge } from '../components/ui/Badge'
import { Button, IconButton } from '../components/ui/Button'
import { Modal, ConfirmDialog } from '../components/ui/Modal'
import { Field, Input, Select } from '../components/ui/Field'
import { CurrencyInput } from '../components/ui/CurrencyInput'
import { SearchInput, Toolbar } from '../components/ui/Toolbar'
import { EmptyState, NotFoundState } from '../components/ui/States'
import { useData } from '../store/DataProvider'
import { useAuth } from '../store/AuthProvider'
import { useToast } from '../store/ToastProvider'
import { useWorkspace } from '../store/WorkspaceProvider'
import { capaianKomisi, nilaiKomisi } from '../lib/calculations'
import { formatRupiah, monthLabel, todayISO } from '../lib/format'
import { clamp, matchesQuery } from '../lib/utils'
import type { CommissionScheme, CommissionUnit } from '../types'

type FormState = Omit<CommissionScheme, 'id' | 'created_at' | 'updated_at' | 'workspace'> & {
  base_commission_unit: CommissionUnit
  target_commission_unit: CommissionUnit
}

const BLANK: FormState = {
  name: '', target: 0, base_commission: 0, base_commission_unit: 'rp',
  target_commission: 0, target_commission_unit: 'rp',
  realization: 0, period: todayISO().slice(0, 7), notes: '',
}

/** Tampilan nilai komisi: "Rp 450.000" atau "0,5% · Rp 1.123.750". */
function labelKomisi(nominal: number, unit: CommissionUnit | undefined, hasil: number): string {
  if (unit !== 'persen') return formatRupiah(nominal)
  return `${String(nominal).replace('.', ',')}% · ${formatRupiah(hasil)}`
}

/**
 * Input nominal komisi dengan pemilih satuan.
 * Rp = angka pasti, % = bagian dari realisasi berjalan (lihat TBD-20).
 */
function KomisiInput({
  id, value, unit, onValue, onUnit, basis, invalid,
}: {
  id: string
  value: number
  unit: CommissionUnit
  onValue: (v: number) => void
  onUnit: (u: CommissionUnit) => void
  basis: number
  invalid?: boolean
}) {
  return (
    <div>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          {unit === 'rp' ? (
            <CurrencyInput id={id} value={value} invalid={invalid} onValueChange={onValue} />
          ) : (
            <div className="relative">
              <input
                id={id}
                type="number"
                min={0}
                max={100}
                step={0.05}
                value={value}
                onChange={(e) => onValue(clamp(Number(e.target.value) || 0, 0, 100))}
                className={`tnum h-9 w-full rounded-md border bg-surface pr-7 pl-2.5 text-right text-[13px] text-ink transition-colors focus:border-brand-400 focus:ring-2 focus:ring-brand-500/15 focus:outline-none ${invalid ? 'border-[color:var(--color-critical)]' : 'border-hairline'}`}
              />
              <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-[12px] font-semibold text-ink-3">%</span>
            </div>
          )}
        </div>
        {/* Lebar dikunci lewat pembungkus; Select sendiri selalu w-full. */}
        <div className="w-[82px] shrink-0">
          <Select value={unit} aria-label="Satuan komisi" onChange={(e) => onUnit(e.target.value as CommissionUnit)}>
            <option value="rp">Rp</option>
            <option value="persen">%</option>
          </Select>
        </div>
      </div>
      {unit === 'persen' && (
        <p className="mt-1 text-[12px] text-ink-3">
          ≈ <span className="tnum font-semibold text-ink-2">{formatRupiah(nilaiKomisi(value, 'persen', basis))}</span> dari realisasi {formatRupiah(basis)}
        </p>
      )}
    </div>
  )
}

/** Bar progres realisasi terhadap target. */
function ProgressBar({ persen, tercapai }: { persen: number; tercapai: boolean }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-sunken">
      <div
        className="h-full rounded-full transition-[width] duration-500 ease-out"
        style={{
          width: `${clamp(persen, 0, 100)}%`,
          background: tercapai
            ? 'linear-gradient(90deg, var(--color-good), #4cc94c)'
            : 'linear-gradient(90deg, var(--color-brand-500), var(--color-brand-300))',
        }}
      />
    </div>
  )
}

/**
 * Master -> Komisi.
 * Satu kartu = satu pengaturan komisi: selama realisasi belum menyentuh target,
 * yang berlaku komisi dasar; begitu target tercapai, naik ke komisi target.
 */
export function PengaturanKomisiPage() {
  const { db, loading, create, update, remove } = useData()
  const { canEdit } = useAuth()
  const { meta } = useWorkspace()
  const toast = useToast()

  const [tab, setTab] = useState('semua')
  const [query, setQuery] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<CommissionScheme | null>(null)
  const [form, setForm] = useState<FormState>(BLANK)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [deleting, setDeleting] = useState<CommissionScheme | null>(null)

  const rows = useMemo(
    () => db.commissionSchemes.map((s) => ({ ...s, capaian: capaianKomisi(s) })),
    [db.commissionSchemes],
  )
  const tercapai = rows.filter((s) => s.capaian.tercapai)
  const progres = rows.filter((s) => !s.capaian.tercapai)

  const terlihat = useMemo(() => {
    const dasar = tab === 'tercapai' ? tercapai : tab === 'progres' ? progres : rows
    return dasar.filter((s) => matchesQuery(query, s.name, s.notes))
  }, [tab, rows, tercapai, progres, query])

  const openCreate = useCallback(() => {
    setEditing(null); setForm(BLANK); setErrors({}); setFormOpen(true)
  }, [])

  function openEdit(s: CommissionScheme) {
    setEditing(s)
    setForm({
      name: s.name, target: s.target,
      base_commission: s.base_commission, base_commission_unit: s.base_commission_unit ?? 'rp',
      target_commission: s.target_commission, target_commission_unit: s.target_commission_unit ?? 'rp',
      realization: s.realization, period: s.period, notes: s.notes,
    })
    setErrors({}); setFormOpen(true)
  }

  function validate(): boolean {
    const e: Partial<Record<keyof FormState, string>> = {}
    if (!form.name.trim()) e.name = 'Nama wajib diisi.'
    if (form.target <= 0) e.target = 'Target harus lebih dari 0.'
    if (form.base_commission < 0) e.base_commission = 'Komisi dasar tidak boleh negatif.'
    if (form.base_commission_unit === 'persen' && form.base_commission > 100)
      e.base_commission = 'Persen komisi dasar maksimal 100.'
    if (form.target_commission_unit === 'persen' && form.target_commission > 100)
      e.target_commission = 'Persen komisi target maksimal 100.'
    // Dibandingkan setelah dikonversi ke Rupiah, supaya Rp dan % bisa dicampur.
    else if (pratinjau.komisiTarget < pratinjau.komisiDasar)
      e.target_commission = 'Komisi target tidak boleh lebih kecil dari komisi dasar.'
    if (form.realization < 0) e.realization = 'Realisasi tidak boleh negatif.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function onSubmit() {
    if (!validate()) { toast.error('Periksa kembali isian yang ditandai merah.'); return }
    const payload = { ...form, name: form.name.trim() }
    if (editing) { update('commissionSchemes', editing.id, payload); toast.success('Pengaturan komisi berhasil diperbarui.') }
    else { create('commissionSchemes', payload); toast.success('Pengaturan komisi berhasil disimpan.') }
    setFormOpen(false)
  }

  function onDelete() {
    if (!deleting) return
    remove('commissionSchemes', deleting.id)
    toast.success('Pengaturan komisi berhasil dihapus.')
    setDeleting(null)
  }

  const pratinjau = capaianKomisi(form)

  const ringkas = [
    { label: 'Total pengaturan', value: String(rows.length), hint: `Workspace ${meta.label}`, icon: <Target size={15} /> },
    { label: 'Target tercapai', value: String(tercapai.length), hint: 'memakai komisi target', icon: <Trophy size={15} /> },
    { label: 'Masih progres', value: String(progres.length), hint: 'memakai komisi dasar', icon: <CircleDashed size={15} /> },
    {
      label: 'Komisi berlaku',
      value: formatRupiah(rows.reduce((a, s) => a + s.capaian.komisiBerlaku, 0)),
      hint: 'jumlah seluruh pengaturan',
      icon: <TrendingUp size={15} />,
    },
  ]

  return (
    <>
      <PageHeader
        title="Komisi"
        crumbs={[{ label: 'Master' }, { label: 'Komisi' }]}
        description="Atur target beserta komisi dasar dan komisi yang berlaku bila target tercapai."
        actions={
          <Button variant="primary" icon={<Plus size={15} />} disabled={!canEdit} onClick={openCreate}>
            Tambah Komisi
          </Button>
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {ringkas.map((r) => (
          <div key={r.label} className="shadow-card rounded-xl border border-hairline bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="text-[12.5px] font-medium text-ink-3">{r.label}</p>
              <span className="shrink-0 rounded-md bg-brand-50 p-1.5 text-brand-600">{r.icon}</span>
            </div>
            <p className="tnum mt-2 text-[22px] leading-none font-semibold tracking-tight text-ink">{r.value}</p>
            <p className="mt-2.5 text-[12px] text-ink-3">{r.hint}</p>
          </div>
        ))}
      </div>

      <Card>
        <Tabs
          className="px-2"
          value={tab}
          onChange={setTab}
          items={[
            { id: 'semua', label: 'Semua', badge: rows.length },
            { id: 'tercapai', label: 'Tercapai', badge: tercapai.length },
            { id: 'progres', label: 'Masih Progres', badge: progres.length },
          ]}
        />

        <Toolbar
          left={<SearchInput value={query} onChange={setQuery} placeholder="Cari nama pengaturan..." />}
          right={<span className="text-[12.5px] text-ink-3">{terlihat.length} pengaturan ditampilkan</span>}
        />

        {loading ? (
          <div className="grid gap-4 p-4 lg:grid-cols-2">
            {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-44 rounded-xl" />)}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            entity="pengaturan komisi"
            action={canEdit && <Button variant="primary" icon={<Plus size={15} />} onClick={openCreate}>Tambah Komisi</Button>}
          />
        ) : terlihat.length === 0 ? (
          <NotFoundState onReset={() => { setQuery(''); setTab('semua') }} />
        ) : (
          <div className="grid gap-4 p-4 lg:grid-cols-2">
            {terlihat.map((s) => {
              const { persen, tercapai: sudah, komisiBerlaku, sisa } = s.capaian
              return (
                <article key={s.id} className="rounded-xl border border-hairline p-4 transition-shadow hover:shadow-card">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-[14px] font-semibold text-ink">{s.name}</h3>
                      <p className="mt-0.5 text-[12px] text-ink-3">Periode {monthLabel(`${s.period}-01`)}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Badge tone={sudah ? 'good' : 'brand'} icon={sudah ? <Trophy size={12} /> : <CircleDashed size={12} />}>
                        {sudah ? 'Tercapai' : 'Masih Progres'}
                      </Badge>
                      <IconButton label="Ubah" icon={<Pencil size={14} />} disabled={!canEdit} onClick={() => openEdit(s)} />
                      <IconButton label="Hapus" tone="danger" icon={<Trash2 size={14} />} disabled={!canEdit} onClick={() => setDeleting(s)} />
                    </div>
                  </div>

                  <div className="mt-3.5">
                    <div className="mb-1.5 flex items-end justify-between gap-3">
                      <span className="tnum text-[13px] font-semibold text-ink">{formatRupiah(s.realization)}</span>
                      <span className="tnum text-[12px] text-ink-3">dari {formatRupiah(s.target)}</span>
                    </div>
                    <ProgressBar persen={persen} tercapai={sudah} />
                    <p className="mt-1.5 text-[12px] text-ink-3">
                      <span className="tnum font-semibold text-ink-2">{persen.toFixed(1).replace('.', ',')}%</span>
                      {sudah ? ' — target terlampaui.' : ` — kurang ${formatRupiah(sisa)} lagi.`}
                    </p>
                  </div>

                  <dl className="mt-3.5 grid grid-cols-3 gap-3 border-t border-grid pt-3">
                    <div>
                      <dt className="text-[11px] font-semibold tracking-wide text-ink-3 uppercase">Komisi Dasar</dt>
                      <dd className={`tnum mt-0.5 text-[13px] font-medium ${sudah ? 'text-ink-3' : 'text-ink'}`}>
                        {labelKomisi(s.base_commission, s.base_commission_unit, s.capaian.komisiDasar)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-semibold tracking-wide text-ink-3 uppercase">Komisi Target</dt>
                      <dd className={`tnum mt-0.5 text-[13px] font-medium ${sudah ? 'text-ink' : 'text-ink-3'}`}>
                        {labelKomisi(s.target_commission, s.target_commission_unit, s.capaian.komisiTarget)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-semibold tracking-wide text-ink-3 uppercase">Berlaku</dt>
                      <dd className="tnum mt-0.5 text-[13px] font-semibold text-brand-700">{formatRupiah(komisiBerlaku)}</dd>
                    </div>
                  </dl>
                  {s.notes && <p className="mt-3 text-[12px] text-ink-3">{s.notes}</p>}
                </article>
              )
            })}
          </div>
        )}
      </Card>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Ubah Pengaturan Komisi' : 'Pengaturan Komisi'}
        subtitle="Komisi dasar dipakai selama target belum tercapai; setelah tercapai memakai komisi target."
        footer={
          <>
            <Button onClick={() => setFormOpen(false)}>Batal</Button>
            <Button variant="primary" onClick={onSubmit}>{editing ? 'Simpan Perubahan' : 'Save'}</Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Target" required error={errors.target} className="sm:col-span-2">
            {(id) => <CurrencyInput id={id} value={form.target} invalid={!!errors.target} onValueChange={(v) => setForm({ ...form, target: v })} />}
          </Field>
          <Field label="Komisi Dasar" required error={errors.base_commission} className="sm:col-span-2">
            {(id) => (
              <KomisiInput
                id={id}
                value={form.base_commission}
                unit={form.base_commission_unit}
                basis={form.realization}
                invalid={!!errors.base_commission}
                onValue={(v) => setForm({ ...form, base_commission: v })}
                onUnit={(u) => setForm({ ...form, base_commission_unit: u, base_commission: 0 })}
              />
            )}
          </Field>
          <Field label="Komisi Apabila Target Tercapai" required error={errors.target_commission} className="sm:col-span-2">
            {(id) => (
              <KomisiInput
                id={id}
                value={form.target_commission}
                unit={form.target_commission_unit}
                basis={form.realization}
                invalid={!!errors.target_commission}
                onValue={(v) => setForm({ ...form, target_commission: v })}
                onUnit={(u) => setForm({ ...form, target_commission_unit: u, target_commission: 0 })}
              />
            )}
          </Field>
          <Field label="Nama" required error={errors.name} className="sm:col-span-2">
            {(id) => <Input id={id} value={form.name} invalid={!!errors.name} placeholder="Komisi Sopir Reguler" onChange={(e) => setForm({ ...form, name: e.target.value })} />}
          </Field>

          <Field label="Realisasi Berjalan" error={errors.realization} hint={errors.realization ? undefined : 'Sementara diisi manual — sumber otomatisnya masih TBD-16.'}>
            {(id) => <CurrencyInput id={id} value={form.realization} invalid={!!errors.realization} onValueChange={(v) => setForm({ ...form, realization: v })} />}
          </Field>
          <Field label="Periode">
            {(id) => <Input id={id} type="month" value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} />}
          </Field>
          <Field label="Catatan" className="sm:col-span-2">
            {(id) => <Input id={id} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />}
          </Field>

          {/* Pratinjau supaya hasil aturannya terlihat sebelum disimpan */}
          <div className="rounded-lg border border-brand-100 bg-brand-50 px-3.5 py-3 sm:col-span-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[12.5px] font-medium text-brand-800">
                {pratinjau.tercapai ? 'Target tercapai — komisi target berlaku' : 'Masih progres — komisi dasar berlaku'}
              </span>
              <span className="tnum text-[16px] font-semibold text-brand-800">{formatRupiah(pratinjau.komisiBerlaku)}</span>
            </div>
            <div className="mt-2"><ProgressBar persen={pratinjau.persen} tercapai={pratinjau.tercapai} /></div>
            <p className="mt-1.5 text-[11.5px] text-brand-700">
              Realisasi {formatRupiah(form.realization)} dari target {formatRupiah(form.target)}
              {pratinjau.tercapai ? '.' : ` — kurang ${formatRupiah(pratinjau.sisa)}.`}
            </p>
          </div>
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
