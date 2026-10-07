import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { FaArrowLeft, FaPen, FaPlus, FaTrashCan } from '../components/ui/icons'
import { PageHeader } from '../components/layout/PageHeader'
import { Card, CardHeader } from '../components/ui/Card'
import { DataTable } from '../components/ui/DataTable'
import type { Column } from '../components/ui/DataTable'
import { Button, IconButton } from '../components/ui/Button'
import { Modal, ConfirmDialog } from '../components/ui/Modal'
import { Field, DateInput, Select, Textarea } from '../components/ui/Field'
import { CurrencyInput } from '../components/ui/CurrencyInput'
import { Badge } from '../components/ui/Badge'
import { LampiranInput, LampiranThumbs } from '../components/ui/Lampiran'
import { useData } from '../store/DataProvider'
import { useAuth } from '../store/AuthProvider'
import { useToast } from '../store/ToastProvider'
import { useWorkspace } from '../store/WorkspaceProvider'
import { formatDate, formatRupiah, todayISO } from '../lib/format'
import { hitungKomisiKontrak } from '../lib/komisi'
import { nomorKontrakBerikut } from '../lib/kode'
import { KodeInput } from '../components/ui/KodeInput'
import { CLIENT_TYPE_LABEL, SERVICE_LABEL } from '../types'
import type { Contract } from '../types'
import { STATUS_LABEL, STATUS_TONE } from './trip/status'

type FormKontrak = Pick<Contract, 'contract_no' | 'value' | 'start_date' | 'end_date' | 'status' | 'notes' | 'attachments'>

const KONTRAK_KOSONG: FormKontrak = { contract_no: '', value: 0, start_date: '', end_date: '', status: 'aktif', notes: '', attachments: [] }

type BarisKontrak = Contract & { trip: number; terpakai: number; sisa: number; komisi: number }

/**
 * Master -> Klien -> satu klien. Klien kontrak: kontrak Dedicated dan sisanya
 * (nilai kontrak dikurangi uang jalan & biaya trip kontrak itu). Klien tetap:
 * ringkasan trip dan pendapatannya.
 */
export function KlienDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { db, dbAll, transactionRows, loading, create, update, remove } = useData()
  const { canEdit } = useAuth()
  const { meta } = useWorkspace()
  const toast = useToast()

  const [editing, setEditing] = useState<Contract | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<FormKontrak>(KONTRAK_KOSONG)
  const [errors, setErrors] = useState<Partial<Record<keyof FormKontrak, string>>>({})
  const [deleting, setDeleting] = useState<BarisKontrak | null>(null)

  const klien = db.projects.find((p) => p.id === id)

  const kontrak = useMemo<BarisKontrak[]>(() => db.contracts
    .filter((c) => c.project_id === id)
    .map((c) => {
      // Trip batal tidak dihitung: catatannya arsip.
      const trip = transactionRows.filter((t) => t.contract_id === c.id && t.status !== 'batal')
      const terpakai = trip.reduce((a, t) => a + t.uj_total + t.expense_total + t.internal_total, 0)
      return {
        ...c,
        trip: trip.length,
        terpakai,
        sisa: c.value - terpakai,
        komisi: hitungKomisiKontrak(db.commissionSchemes, c.value)?.nilai ?? 0,
      }
    })
    .sort((a, b) => b.start_date.localeCompare(a.start_date) || b.contract_no.localeCompare(a.contract_no)),
  [db.contracts, db.commissionSchemes, transactionRows, id])

  const tripKlien = useMemo(
    () => transactionRows.filter((t) => t.project_id === id).sort((a, b) => b.transaction_date.localeCompare(a.transaction_date)),
    [transactionRows, id],
  )

  if (loading) {
    return (
      <>
        <PageHeader title="Memuat klien..." crumbs={[{ label: 'Master Data' }, { label: 'Klien / Pelanggan', to: '/master/klien' }]} />
        <div className="skeleton h-64 rounded-xl" />
      </>
    )
  }

  if (!klien) {
    return (
      <>
        <PageHeader title="Klien tidak ditemukan" crumbs={[{ label: 'Master Data' }, { label: 'Klien / Pelanggan', to: '/master/klien' }]} />
        <Card>
          <div className="px-6 py-14 text-center">
            <p className="text-[14px] font-semibold text-ink">Data tidak ditemukan.</p>
            <p className="mt-1 text-[13px] text-ink-3">Klien mungkin sudah dihapus.</p>
            <Button className="mt-4" onClick={() => navigate('/master/klien')}>Kembali ke daftar</Button>
          </div>
        </Card>
      </>
    )
  }

  const aktif = kontrak.filter((c) => c.status === 'aktif')
  const tripDihitung = tripKlien.filter((t) => t.status !== 'batal')
  const klienKontrak = klien.client_type === 'kontrak'

  function openCreate() {
    setEditing(null)
    setForm({
      ...KONTRAK_KOSONG,
      contract_no: nomorKontrakBerikut(dbAll.contracts.map((c) => c.contract_no), todayISO().slice(0, 4)),
      start_date: todayISO(),
    })
    setErrors({}); setFormOpen(true)
  }

  function openEdit(c: Contract) {
    setEditing(c)
    setForm({
      contract_no: c.contract_no, value: c.value, start_date: c.start_date, end_date: c.end_date,
      status: c.status, notes: c.notes, attachments: c.attachments ?? [],
    })
    setErrors({}); setFormOpen(true)
  }

  function validate(): boolean {
    const e: Partial<Record<keyof FormKontrak, string>> = {}
    const no = form.contract_no.trim()
    if (!no) e.contract_no = 'Nomor kontrak wajib diisi.'
    else if (dbAll.contracts.some((c) => c.contract_no.toLowerCase() === no.toLowerCase() && c.id !== editing?.id))
      e.contract_no = 'Nomor kontrak sudah dipakai.'
    if (form.value <= 0) e.value = 'Nilai kontrak harus lebih dari 0.'
    if (form.start_date && form.end_date && form.end_date < form.start_date) e.end_date = 'Tanggal selesai sebelum tanggal mulai.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function onSubmit() {
    if (!validate()) return
    const payload = { ...form, project_id: klien!.id, contract_no: form.contract_no.trim().toUpperCase(), notes: form.notes.trim() }
    if (editing) { update('contracts', editing.id, payload); toast.success('Kontrak berhasil diperbarui.') }
    else { create('contracts', payload); toast.success('Kontrak berhasil disimpan.') }
    setFormOpen(false)
  }

  function onDelete() {
    if (!deleting) return
    remove('contracts', deleting.id)
    toast.success('Kontrak berhasil dihapus.')
    setDeleting(null)
  }

  /** Trip mana pun (termasuk batal) yang masih menunjuk kontrak ini. */
  const jumlahDipakai = deleting ? db.transactions.filter((t) => t.contract_id === deleting.id).length : 0

  const columns: Column<BarisKontrak>[] = [
    {
      key: 'contract_no', header: 'No. Kontrak', width: '170px',
      render: (c) => (
        <div className="leading-tight">
          <span className="tnum font-semibold text-ink">{c.contract_no}</span>
          {c.notes && <span className="mt-0.5 block truncate text-[12px] text-ink-3" title={c.notes}>{c.notes}</span>}
        </div>
      ),
    },
    {
      key: 'start_date', header: 'Periode', width: '190px',
      render: (c) => <span className="tnum text-ink-2">{c.start_date ? formatDate(c.start_date) : '—'} – {c.end_date ? formatDate(c.end_date) : '—'}</span>,
    },
    { key: 'value', header: 'Nilai Kontrak', align: 'right', width: '140px', render: (c) => <span className="tnum font-medium">{formatRupiah(c.value)}</span> },
    {
      key: 'terpakai', header: 'Terpakai', align: 'right', width: '140px',
      render: (c) => (
        <div className="leading-tight">
          <span className="tnum text-ink-2">{formatRupiah(c.terpakai)}</span>
          <span className="mt-0.5 block text-[11.5px] text-ink-3">{c.trip} trip</span>
        </div>
      ),
    },
    {
      key: 'sisa', header: 'Sisa (balance)', align: 'right', width: '140px',
      render: (c) => <span className={c.sisa < 0 ? 'tnum font-semibold text-[color:var(--color-critical)]' : 'tnum font-semibold text-ink'}>{formatRupiah(c.sisa)}</span>,
    },
    {
      key: 'komisi', header: 'Komisi (perkiraan)', align: 'right', width: '150px',
      render: (c) => (c.komisi ? <span className="tnum text-ink-2">{formatRupiah(c.komisi)}</span> : <span className="text-ink-3">—</span>),
    },
    { key: 'attachments', header: 'Dokumen', width: '96px', render: (c) => <LampiranThumbs ids={c.attachments ?? []} ukuran={28} /> },
    {
      key: 'status', header: 'Status', width: '100px',
      render: (c) => (c.status === 'aktif' ? <Badge tone="good">Aktif</Badge> : <Badge tone="neutral">Selesai</Badge>),
    },
    {
      key: 'action', header: 'Action', align: 'right', width: '92px',
      render: (c) => (
        <div className="flex justify-end gap-1">
          <IconButton label="Ubah" icon={<FaPen size={14} />} disabled={!canEdit} onClick={() => openEdit(c)} />
          <IconButton label="Hapus" tone="danger" icon={<FaTrashCan size={14} />} disabled={!canEdit} onClick={() => setDeleting(c)} />
        </div>
      ),
    },
  ]

  const ringkasan: Array<[string, string, string]> = klienKontrak ? [
    ['Kontrak Aktif', String(aktif.length), `dari ${kontrak.length} kontrak di ${meta.label}`],
    ['Nilai Kontrak Aktif', formatRupiah(aktif.reduce((a, c) => a + c.value, 0)), 'total nilai kontrak berjalan'],
    ['Sisa Kontrak Aktif', formatRupiah(aktif.reduce((a, c) => a + c.sisa, 0)), 'nilai dikurangi biaya trip kontrak'],
    ['Jumlah Trip', String(tripDihitung.length), `total UJ ${formatRupiah(tripDihitung.reduce((a, t) => a + t.uj_total, 0))}`],
  ] : [
    ['Jumlah Trip', String(tripDihitung.length), `di ${meta.label}, tanpa trip batal`],
    ['Pendapatan', formatRupiah(tripDihitung.reduce((a, t) => a + t.harga, 0)), 'jumlah harga trip'],
    ['Total Uang Jalan', formatRupiah(tripDihitung.reduce((a, t) => a + t.uj_total, 0)), 'termin yang sudah dibayar'],
    ['Trip Terakhir', tripDihitung[0] ? formatDate(tripDihitung[0].transaction_date) : '—', tripDihitung[0]?.transaction_no ?? 'belum ada trip'],
  ]

  return (
    <>
      <PageHeader
        title={klien.project_name}
        description={[
          klien.project_code,
          CLIENT_TYPE_LABEL[klien.client_type ?? 'tetap'],
          klien.requires_document ? 'Pakai TR / No PI' : 'Tanpa dokumen',
          klien.status === 'aktif' ? 'Aktif' : 'Nonaktif',
          klien.description,
        ].filter(Boolean).join(' · ')}
        crumbs={[{ label: 'Master Data' }, { label: 'Klien / Pelanggan', to: '/master/klien' }, { label: klien.project_code }]}
        actions={
          <>
            <Button icon={<FaArrowLeft size={15} />} onClick={() => navigate('/master/klien')}>Kembali</Button>
            {klienKontrak && <Button variant="primary" icon={<FaPlus size={15} />} disabled={!canEdit} onClick={openCreate}>Tambah Kontrak</Button>}
          </>
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {ringkasan.map(([label, nilai, ket]) => (
          <div key={label} className="shadow-card rounded-xl border border-hairline bg-surface p-4">
            <p className="text-[12.5px] font-medium text-ink-3">{label}</p>
            <p className="tnum mt-1.5 text-[19px] leading-none font-semibold tracking-tight text-ink">{nilai}</p>
            <p className="mt-2 text-[11.5px] text-ink-3">{ket}</p>
          </div>
        ))}
      </div>

      {klienKontrak ? (
      <Card className="mb-4">
        <CardHeader
          title="Kontrak Dedicated"
          subtitle={`Kontrak klien ini di workspace ${meta.label}. Trip Dedicated memilih salah satunya.`}
        />
        <DataTable
          columns={columns}
          rows={kontrak}
          rowKey={(c) => c.id}
          empty={(
            <div className="px-6 py-10 text-center">
              <p className="text-[13.5px] font-semibold text-ink">Belum ada kontrak.</p>
              <p className="mt-1 text-[12.5px] text-ink-3">Tambahkan lewat Tambah Kontrak di kanan atas bila klien ini memakai layanan Dedicated.</p>
            </div>
          )}
        />
      </Card>
      ) : (
        <Card className="mb-4 px-4 py-3.5">
          <p className="text-[13px] font-semibold text-ink">Klien tetap, tanpa kontrak</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-ink-3">
            Trip klien ini order per perjalanan (layanan Callout). Bila perusahaan ini memakai jasa lewat kontrak,
            ubah jenisnya menjadi Klien kontrak di <Link to="/master/klien" className="text-brand-700 hover:underline">daftar Klien</Link>.
          </p>
        </Card>
      )}

      <Card>
        <CardHeader title="Trip terakhir" subtitle={`${tripKlien.length} trip tercatat untuk klien ini`} />
        {tripKlien.length === 0 ? (
          <p className="px-4 py-10 text-center text-[13px] text-ink-3">Belum ada trip untuk klien ini.</p>
        ) : (
          <ul className="divide-y divide-grid">
            {tripKlien.slice(0, 8).map((t) => (
              <li key={t.id}>
                <Link to={`/transaksi/trip/${t.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-sunken">
                  <span className="min-w-0">
                    <span className="tnum block text-[13px] font-semibold text-brand-700">{t.transaction_no}</span>
                    <span className="block truncate text-[12px] text-ink-3">
                      {formatDate(t.transaction_date)} · {t.route_name || t.destination_detail || '—'} · {SERVICE_LABEL[t.service_type ?? 'callout']}
                      {t.contract_no && ` ${t.contract_no}`}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className="tnum text-[13px] text-ink-2">{formatRupiah(t.uj_total)}</span>
                    <Badge tone={STATUS_TONE[t.status]}>{STATUS_LABEL[t.status]}</Badge>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Ubah Kontrak' : 'Tambah Kontrak'}
        subtitle={`Klien ${klien.project_name}. Dipakai trip berlayanan Dedicated.`}
        footer={
          <>
            <Button onClick={() => setFormOpen(false)}>Batal</Button>
            <Button variant="primary" onClick={onSubmit}>{editing ? 'Simpan Perubahan' : 'Simpan'}</Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="No. Kontrak" required error={errors.contract_no} hint={errors.contract_no ? undefined : 'Nomor urut otomatis per tahun, boleh diganti.'}>
            {(fid) => (
              <KodeInput id={fid} value={form.contract_no} invalid={!!errors.contract_no} uppercase
                generateTitle="Buat nomor kontrak berikutnya"
                onChange={(v) => setForm({ ...form, contract_no: v })}
                onGenerate={() => setForm((f) => ({
                  ...f,
                  contract_no: nomorKontrakBerikut(
                    dbAll.contracts.filter((c) => c.id !== editing?.id).map((c) => c.contract_no),
                    (f.start_date || todayISO()).slice(0, 4),
                  ),
                }))} />
            )}
          </Field>
          <Field label="Status">
            {(fid) => (
              <Select id={fid} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Contract['status'] })}>
                <option value="aktif">Aktif</option>
                <option value="selesai">Selesai</option>
              </Select>
            )}
          </Field>
          <Field label="Nilai Kontrak" required error={errors.value} className="sm:col-span-2">
            {(fid) => <CurrencyInput id={fid} value={form.value} invalid={!!errors.value} onValueChange={(v) => setForm({ ...form, value: v })} />}
          </Field>
          <Field label="Mulai">
            {(fid) => <DateInput id={fid} value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />}
          </Field>
          <Field label="Selesai" error={errors.end_date}>
            {(fid) => <DateInput id={fid} value={form.end_date} invalid={!!errors.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />}
          </Field>
          <Field label="Catatan" className="sm:col-span-2">
            {(fid) => <Textarea id={fid} rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />}
          </Field>
          <Field label="Dokumen kontrak" className="sm:col-span-2">
            {(fid) => <LampiranInput id={fid} label="Tambah dokumen" value={form.attachments} onChange={(v) => setForm((f) => ({ ...f, attachments: v }))} />}
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title={jumlahDipakai ? 'Kontrak masih dipakai' : 'Hapus kontrak?'}
        confirmLabel={jumlahDipakai ? 'Mengerti' : 'Hapus'}
        tone={jumlahDipakai ? 'primary' : 'danger'}
        message={jumlahDipakai
          ? `${deleting?.contract_no} masih dipakai ${jumlahDipakai} trip. Ubah statusnya menjadi Selesai bila kontrak sudah berakhir.`
          : `${deleting?.contract_no} milik ${klien.project_name} akan dihapus.`}
        onCancel={() => setDeleting(null)}
        onConfirm={jumlahDipakai ? () => setDeleting(null) : onDelete}
      />
    </>
  )
}
