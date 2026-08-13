import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { Card, InfoItem } from '../components/ui/Card'
import { Tabs } from '../components/ui/Tabs'
import { Button, IconButton } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Modal, ConfirmDialog } from '../components/ui/Modal'
import { Field, Input, DateInput, Select } from '../components/ui/Field'
import { CurrencyInput } from '../components/ui/CurrencyInput'
import { useData } from '../store/DataProvider'
import { useAuth } from '../store/AuthProvider'
import { useToast } from '../store/ToastProvider'
import { tfPembayaran, totalUj } from '../lib/calculations'
import { formatDate, formatDateLong, formatRupiah, todayISO } from '../lib/format'
import { EXPENSE_TYPES } from '../types'
import type { OperationalExpense, UjPayment } from '../types'
import { STATUS_LABEL, STATUS_TONE } from './DataKomisiPage'

type UjForm = { payment_date: string; uj_amount: number; kasbon_deduction: number; notes: string }
type ExpForm = { expense_type: string; amount: number; expense_date: string; notes: string }

export function TripDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { db, transactionRows, deliveryNoteRows, billingRows, loading, create, update, remove } = useData()
  const { canEdit } = useAuth()
  const toast = useToast()

  const [tab, setTab] = useState('overview')
  const [ujOpen, setUjOpen] = useState(false)
  const [ujEditing, setUjEditing] = useState<UjPayment | null>(null)
  const [ujForm, setUjForm] = useState<UjForm>({ payment_date: todayISO(), uj_amount: 0, kasbon_deduction: 0, notes: '' })
  const [ujErr, setUjErr] = useState<string | null>(null)
  const [ujDel, setUjDel] = useState<UjPayment | null>(null)

  const [expOpen, setExpOpen] = useState(false)
  const [expEditing, setExpEditing] = useState<OperationalExpense | null>(null)
  const [expForm, setExpForm] = useState<ExpForm>({ expense_type: 'DEX', amount: 0, expense_date: todayISO(), notes: '' })
  const [expErr, setExpErr] = useState<string | null>(null)
  const [expDel, setExpDel] = useState<OperationalExpense | null>(null)

  const trip = transactionRows.find((t) => t.id === id)
  const payments = useMemo(
    () => db.ujPayments.filter((p) => p.trip_id === id).sort((a, b) => a.sequence - b.sequence),
    [db.ujPayments, id],
  )
  const expenses = useMemo(
    () => db.expenses.filter((e) => e.trip_id === id).sort((a, b) => a.expense_date.localeCompare(b.expense_date)),
    [db.expenses, id],
  )
  const uj = totalUj(payments)
  const expTotal = expenses.reduce((a, e) => a + e.amount, 0)

  const docs = useMemo(() => ({
    suratJalan: deliveryNoteRows.filter((n) => trip && n.job_order_id === trip.job_order_id && n.vehicle_id === trip.vehicle_id),
    tagihan: billingRows.filter((b) => trip && b.job_order_id === trip.job_order_id),
  }), [deliveryNoteRows, billingRows, trip])

  if (loading) {
    return (
      <>
        <PageHeader title="Memuat trip..." crumbs={[{ label: 'Transaksi' }, { label: 'Data Komisi', to: '/transaksi/komisi' }]} />
        <div className="skeleton h-64 rounded-xl" />
      </>
    )
  }

  if (!trip) {
    return (
      <>
        <PageHeader title="Trip tidak ditemukan" crumbs={[{ label: 'Transaksi' }, { label: 'Data Komisi', to: '/transaksi/komisi' }]} />
        <Card>
          <div className="px-6 py-14 text-center">
            <p className="text-[14px] font-semibold text-ink">Data tidak ditemukan.</p>
            <p className="mt-1 text-[13px] text-ink-3">Trip mungkin sudah dihapus.</p>
            <Button className="mt-4" onClick={() => navigate('/transaksi/komisi')}>Kembali ke daftar</Button>
          </div>
        </Card>
      </>
    )
  }

  /* ── Uang Jalan ───────────────────────────────────────────── */
  function openUj(p?: UjPayment) {
    setUjEditing(p ?? null)
    setUjForm(p
      ? { payment_date: p.payment_date, uj_amount: p.uj_amount, kasbon_deduction: p.kasbon_deduction, notes: p.notes }
      : { payment_date: trip!.transaction_date, uj_amount: 0, kasbon_deduction: 0, notes: '' })
    setUjErr(null); setUjOpen(true)
  }

  function saveUj() {
    if (ujForm.uj_amount <= 0) { setUjErr('Nilai UJ harus lebih dari 0.'); return }
    if (ujForm.kasbon_deduction > ujForm.uj_amount) { setUjErr('Potong kasbon tidak boleh melebihi UJ.'); return }
    if (!ujForm.payment_date) { setUjErr('Tanggal wajib diisi.'); return }
    if (ujEditing) {
      update('ujPayments', ujEditing.id, ujForm)
      toast.success('Termin berhasil diperbarui.')
    } else {
      const seq = payments.reduce((m, p) => Math.max(m, p.sequence), 0) + 1
      create('ujPayments', { ...ujForm, trip_id: trip!.id, sequence: seq })
      toast.success('Termin uang jalan berhasil ditambahkan.')
    }
    setUjOpen(false)
  }

  function deleteUj() {
    if (!ujDel) return
    remove('ujPayments', ujDel.id)
    toast.success('Termin berhasil dihapus.')
    setUjDel(null)
  }

  /* ── Biaya operasional ────────────────────────────────────── */
  function openExp(e?: OperationalExpense) {
    setExpEditing(e ?? null)
    setExpForm(e
      ? { expense_type: e.expense_type, amount: e.amount, expense_date: e.expense_date, notes: e.notes }
      : { expense_type: 'DEX', amount: 0, expense_date: trip!.transaction_date, notes: '' })
    setExpErr(null); setExpOpen(true)
  }

  function saveExp() {
    if (expForm.amount <= 0) { setExpErr('Nominal harus lebih dari 0.'); return }
    if (!expForm.expense_date) { setExpErr('Tanggal wajib diisi.'); return }
    if (expEditing) { update('expenses', expEditing.id, expForm); toast.success('Biaya berhasil diperbarui.') }
    else { create('expenses', { ...expForm, trip_id: trip!.id }); toast.success('Biaya berhasil ditambahkan.') }
    setExpOpen(false)
  }

  function deleteExp() {
    if (!expDel) return
    remove('expenses', expDel.id)
    toast.success('Biaya berhasil dihapus.')
    setExpDel(null)
  }

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'uj', label: 'Uang Jalan', badge: payments.length },
    { id: 'biaya', label: 'Biaya Operasional', badge: expenses.length },
    { id: 'dokumen', label: 'Dokumen', badge: docs.suratJalan.length + docs.tagihan.length },
  ]

  return (
    <>
      <PageHeader
        title={`Trip ${trip.transaction_no}`}
        description={`${formatDateLong(trip.transaction_date)} · ${trip.driver_name || 'tanpa sopir'} · ${trip.plate_number || 'tanpa mobil'}`}
        crumbs={[{ label: 'Transaksi' }, { label: 'Data Komisi', to: '/transaksi/komisi' }, { label: trip.transaction_no }]}
        actions={
          <>
            <Button icon={<ArrowLeft size={15} />} onClick={() => navigate('/transaksi/komisi')}>Kembali</Button>
            <Badge tone={STATUS_TONE[trip.status]}>{STATUS_LABEL[trip.status]}</Badge>
          </>
        }
      />

      {/* Ringkasan finansial trip */}
      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Total UJ', formatRupiah(uj.uj), `${uj.termin} termin`],
          ['Potong Kasbon', formatRupiah(uj.kasbon), 'pengurang UJ'],
          ['TF ke Sopir', formatRupiah(uj.tf), 'UJ − Potong Kasbon'],
          ['Biaya Operasional', formatRupiah(expTotal), `${expenses.length} item`],
        ].map(([label, value, hint]) => (
          <div key={label} className="shadow-card rounded-xl border border-hairline bg-surface p-4">
            <p className="text-[12.5px] font-medium text-ink-3">{label}</p>
            <p className="mt-1.5 text-[19px] leading-none font-semibold tracking-tight text-ink">{value}</p>
            <p className="mt-2 text-[11.5px] text-ink-3">{hint}</p>
          </div>
        ))}
      </div>

      <Card>
        <Tabs items={tabs} value={tab} onChange={setTab} className="px-2" />

        {tab === 'overview' && (
          <div className="p-4">
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <InfoItem label="NoTrans" value={trip.transaction_no} mono />
              <InfoItem label="Tanggal" value={formatDate(trip.transaction_date)} mono />
              <InfoItem label="Project" value={trip.project_code ? `${trip.project_code} — ${trip.project_name}` : '—'} />
              <InfoItem label="Status" value={STATUS_LABEL[trip.status]} />
              <InfoItem label="Sopir" value={trip.driver_name ? `${trip.driver_code} — ${trip.driver_name}` : '—'} />
              <InfoItem label="No. Polisi" value={trip.plate_number || '—'} mono />
              <InfoItem label="Route" value={trip.route_code || '—'} mono />
              <InfoItem label="Detail Tujuan" value={trip.destination_detail || '—'} />
            </dl>

            <div className="mt-4 rounded-lg border border-hairline bg-sunken p-4">
              <p className="mb-3 text-[12px] font-semibold tracking-wide text-ink-2">IDENTIFIER DOKUMEN</p>
              <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <InfoItem label="TR" value={trip.tr_reference || '—'} mono />
                <InfoItem
                  label="SI / Job Order"
                  mono
                  value={trip.sijo
                    ? <Link to={`/pencarian/sijo?sijo=${trip.sijo}`} className="text-brand-700 hover:underline">{trip.sijo}</Link>
                    : '—'}
                />
                <InfoItem label="No PI" value={trip.pi_number || '—'} mono />
                <InfoItem label="Status PI" value={trip.pi_status || '—'} />
              </dl>
              <p className="mt-3 text-[11.5px] leading-relaxed text-ink-3">
                TR, SI/Job Order, dan No PI disimpan terpisah — belum ada bukti ketiganya merujuk hal yang sama (TBD-08).
                Status seperti <span className="font-medium text-ink-2">di pool</span> atau{' '}
                <span className="font-medium text-ink-2">masih moving</span> kini punya kolom sendiri, tidak lagi menumpang di No PI.
              </p>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <InfoItem label="Kont (No. Container)" value={trip.container_no || '—'} mono />
              <InfoItem
                label={<span className="inline-flex items-center gap-1">COST <Badge tone="warning">TBD-02</Badge></span>}
                value={trip.cost_value ? formatRupiah(trip.cost_value) : '—'}
                mono
              />
              <InfoItem label="Tgl Bon" value={trip.bon_date ? formatDate(trip.bon_date) : '—'} mono />
              <InfoItem label="Bon Pribadi" value={trip.personal_bon ? formatRupiah(trip.personal_bon) : '—'} mono />
            </div>
            {trip.notes && (
              <div className="mt-4">
                <InfoItem label="Catatan" value={trip.notes} />
              </div>
            )}
          </div>
        )}

        {tab === 'uj' && (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-4 py-3">
              <p className="text-[12.5px] text-ink-3">
                Uang jalan boleh dibayar bertahap. TF dihitung otomatis dan tidak dapat diketik.
              </p>
              <Button size="sm" variant="primary" icon={<Plus size={14} />} disabled={!canEdit} onClick={() => openUj()}>
                Tambah Termin
              </Button>
            </div>
            {payments.length === 0 ? (
              <div className="px-6 py-14 text-center">
                <p className="text-[14px] font-semibold text-ink">Belum ada pembayaran uang jalan.</p>
                <p className="mt-1 text-[13px] text-ink-3">Tambahkan termin pertama untuk memulai.</p>
                {canEdit && <Button className="mt-4" variant="primary" icon={<Plus size={15} />} onClick={() => openUj()}>Tambah Termin</Button>}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-max text-[13px]">
                  <thead className="bg-sunken">
                    <tr className="border-b border-hairline">
                      {['Termin', 'Tanggal', 'UJ', 'Potong Kasbon', 'TF', 'Catatan', 'Action'].map((h, i) => (
                        <th key={h} className={`px-3 py-2 text-[11.5px] font-semibold tracking-wide text-ink-2 uppercase ${i >= 2 && i <= 4 ? 'text-right' : i === 6 ? 'text-right' : 'text-left'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id} className="border-b border-grid last:border-0 hover:bg-sunken">
                        <td className="px-3 py-2.5"><Badge tone="neutral">Termin {p.sequence}</Badge></td>
                        <td className="tnum px-3 py-2.5 text-ink-2">{formatDate(p.payment_date)}</td>
                        <td className="tnum px-3 py-2.5 text-right font-medium">{formatRupiah(p.uj_amount)}</td>
                        <td className="tnum px-3 py-2.5 text-right text-ink-2">{p.kasbon_deduction ? formatRupiah(p.kasbon_deduction) : '—'}</td>
                        <td className="tnum px-3 py-2.5 text-right font-semibold text-ink">{formatRupiah(tfPembayaran(p))}</td>
                        <td className="px-3 py-2.5 text-ink-3">{p.notes || '—'}</td>
                        <td className="px-3 py-2.5 text-right">
                          <div className="flex justify-end gap-1">
                            <IconButton label="Ubah" icon={<Pencil size={14} />} disabled={!canEdit} onClick={() => openUj(p)} />
                            <IconButton label="Hapus" tone="danger" icon={<Trash2 size={14} />} disabled={!canEdit} onClick={() => setUjDel(p)} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-hairline bg-sunken font-semibold">
                    <tr>
                      <td className="px-3 py-2.5 text-[12px] text-ink-2" colSpan={2}>Total {uj.termin} termin</td>
                      <td className="tnum px-3 py-2.5 text-right">{formatRupiah(uj.uj)}</td>
                      <td className="tnum px-3 py-2.5 text-right">{formatRupiah(uj.kasbon)}</td>
                      <td className="tnum px-3 py-2.5 text-right text-ink">{formatRupiah(uj.tf)}</td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
            <p className="border-t border-hairline px-4 py-2.5 text-[11.5px] text-ink-3">
              Aturan <span className="font-semibold text-ink-2">TF = UJ − Potong Kasbon</span> berasal dari formula asli pada
              file operasional dan konsisten di seluruh data — bukan asumsi.
            </p>
          </div>
        )}

        {tab === 'biaya' && (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-4 py-3">
              <p className="text-[12.5px] text-ink-3">Tambahkan hanya biaya yang benar-benar terjadi pada trip ini.</p>
              <Button size="sm" variant="primary" icon={<Plus size={14} />} disabled={!canEdit} onClick={() => openExp()}>
                Tambah Biaya
              </Button>
            </div>
            {expenses.length === 0 ? (
              <div className="px-6 py-14 text-center">
                <p className="text-[14px] font-semibold text-ink">Belum ada biaya operasional.</p>
                <p className="mt-1 text-[13px] text-ink-3">Trip ini belum mencatat DEX, tol, nginap, atau biaya lain.</p>
                {canEdit && <Button className="mt-4" variant="primary" icon={<Plus size={15} />} onClick={() => openExp()}>Tambah Biaya</Button>}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-max text-[13px]">
                  <thead className="bg-sunken">
                    <tr className="border-b border-hairline">
                      {['Jenis Biaya', 'Tanggal', 'Nominal', 'Catatan', 'Action'].map((h, i) => (
                        <th key={h} className={`px-3 py-2 text-[11.5px] font-semibold tracking-wide text-ink-2 uppercase ${i === 2 || i === 4 ? 'text-right' : 'text-left'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((e) => (
                      <tr key={e.id} className="border-b border-grid last:border-0 hover:bg-sunken">
                        <td className="px-3 py-2.5"><Badge tone="brand">{e.expense_type}</Badge></td>
                        <td className="tnum px-3 py-2.5 text-ink-2">{formatDate(e.expense_date)}</td>
                        <td className="tnum px-3 py-2.5 text-right font-semibold text-ink">{formatRupiah(e.amount)}</td>
                        <td className="px-3 py-2.5 text-ink-3">{e.notes || '—'}</td>
                        <td className="px-3 py-2.5 text-right">
                          <div className="flex justify-end gap-1">
                            <IconButton label="Ubah" icon={<Pencil size={14} />} disabled={!canEdit} onClick={() => openExp(e)} />
                            <IconButton label="Hapus" tone="danger" icon={<Trash2 size={14} />} disabled={!canEdit} onClick={() => setExpDel(e)} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-hairline bg-sunken font-semibold">
                    <tr>
                      <td className="px-3 py-2.5 text-[12px] text-ink-2" colSpan={2}>Total {expenses.length} biaya</td>
                      <td className="tnum px-3 py-2.5 text-right text-ink">{formatRupiah(expTotal)}</td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
            <p className="border-t border-hairline px-4 py-2.5 text-[11.5px] text-ink-3">
              Biaya disimpan sebagai baris terpisah (jenis + nominal), bukan tujuh kolom tetap — jenis baru bisa ditambah
              tanpa mengubah struktur database. Biaya ini <span className="font-medium text-ink-2">belum</span> ikut mengurangi
              pendapatan netto sampai formulanya dikonfirmasi (TBD-03).
            </p>
          </div>
        )}

        {tab === 'dokumen' && (
          <div className="grid gap-4 p-4 lg:grid-cols-2">
            <div className="rounded-lg border border-hairline">
              <p className="border-b border-hairline bg-sunken px-3.5 py-2 text-[12px] font-semibold text-ink-2">
                Surat Jalan ({docs.suratJalan.length})
              </p>
              {docs.suratJalan.length === 0 ? (
                <p className="px-3.5 py-8 text-center text-[13px] text-ink-3">Belum ada Surat Jalan terkait.</p>
              ) : (
                <ul className="divide-y divide-grid">
                  {docs.suratJalan.map((n) => (
                    <li key={n.id}>
                      <Link to={`/transaksi/surat-jalan/${n.id}`} className="flex items-center justify-between gap-3 px-3.5 py-2.5 transition-colors hover:bg-sunken">
                        <span>
                          <span className="tnum block text-[13px] font-semibold text-brand-700">{n.sj_no}</span>
                          <span className="block text-[12px] text-ink-3">{formatDate(n.sj_date)} · {n.container_count} container</span>
                        </span>
                        {n.printed_at ? <Badge tone="good">Tercetak</Badge> : <Badge tone="warning">Draft</Badge>}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-lg border border-hairline">
              <p className="border-b border-hairline bg-sunken px-3.5 py-2 text-[12px] font-semibold text-ink-2">
                Tagihan ({docs.tagihan.length})
              </p>
              {docs.tagihan.length === 0 ? (
                <p className="px-3.5 py-8 text-center text-[13px] text-ink-3">Belum ada tagihan terkait.</p>
              ) : (
                <ul className="divide-y divide-grid">
                  {docs.tagihan.map((b) => (
                    <li key={b.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                      <span>
                        <span className="tnum block text-[13px] font-semibold text-ink">{b.invoice_no}</span>
                        <span className="block text-[12px] text-ink-3">{b.cost_code} · {formatDate(b.billing_date)}</span>
                      </span>
                      <span className="tnum text-[13px] font-semibold text-ink">{formatRupiah(b.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Modal termin uang jalan */}
      <Modal
        open={ujOpen}
        onClose={() => setUjOpen(false)}
        title={ujEditing ? `Ubah Termin ${ujEditing.sequence}` : 'Tambah Termin Uang Jalan'}
        subtitle={`Trip ${trip.transaction_no}`}
        size="sm"
        footer={
          <>
            <Button onClick={() => setUjOpen(false)}>Batal</Button>
            <Button variant="primary" onClick={saveUj}>Simpan</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Tanggal" required>
            {(fid) => <DateInput id={fid} value={ujForm.payment_date} onChange={(e) => setUjForm({ ...ujForm, payment_date: e.target.value })} />}
          </Field>
          <Field label="UJ" required>
            {(fid) => <CurrencyInput id={fid} value={ujForm.uj_amount} onValueChange={(v) => setUjForm({ ...ujForm, uj_amount: v })} />}
          </Field>
          <Field label="Potong Kasbon">
            {(fid) => <CurrencyInput id={fid} value={ujForm.kasbon_deduction} onValueChange={(v) => setUjForm({ ...ujForm, kasbon_deduction: v })} />}
          </Field>
          <div className="rounded-lg border border-brand-100 bg-brand-50 px-3.5 py-3">
            <p className="flex items-center justify-between gap-3">
              <span className="text-[12.5px] font-medium text-brand-800">TF ke sopir</span>
              <span className="tnum text-[16px] font-semibold text-brand-800">
                {formatRupiah(ujForm.uj_amount - ujForm.kasbon_deduction)}
              </span>
            </p>
            <p className="mt-1 text-[11.5px] text-brand-700">Dihitung otomatis: UJ − Potong Kasbon</p>
          </div>
          <Field label="Catatan">
            {(fid) => <Input id={fid} value={ujForm.notes} onChange={(e) => setUjForm({ ...ujForm, notes: e.target.value })} />}
          </Field>
          {ujErr && <p className="text-[12px] font-medium text-[color:var(--color-critical)]">{ujErr}</p>}
        </div>
      </Modal>

      {/* Modal biaya operasional */}
      <Modal
        open={expOpen}
        onClose={() => setExpOpen(false)}
        title={expEditing ? 'Ubah Biaya' : 'Tambah Biaya Operasional'}
        subtitle={`Trip ${trip.transaction_no}`}
        size="sm"
        footer={
          <>
            <Button onClick={() => setExpOpen(false)}>Batal</Button>
            <Button variant="primary" onClick={saveExp}>Simpan</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Jenis Biaya" required>
            {(fid) => (
              <Select id={fid} value={expForm.expense_type} onChange={(e) => setExpForm({ ...expForm, expense_type: e.target.value })}>
                {EXPENSE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Nominal" required>
            {(fid) => <CurrencyInput id={fid} value={expForm.amount} onValueChange={(v) => setExpForm({ ...expForm, amount: v })} />}
          </Field>
          <Field label="Tanggal" required>
            {(fid) => <DateInput id={fid} value={expForm.expense_date} onChange={(e) => setExpForm({ ...expForm, expense_date: e.target.value })} />}
          </Field>
          <Field label="Catatan">
            {(fid) => <Input id={fid} value={expForm.notes} onChange={(e) => setExpForm({ ...expForm, notes: e.target.value })} />}
          </Field>
          {expErr && <p className="text-[12px] font-medium text-[color:var(--color-critical)]">{expErr}</p>}
        </div>
      </Modal>

      <ConfirmDialog
        open={!!ujDel}
        title="Hapus termin?"
        message={`Termin ${ujDel?.sequence} senilai ${formatRupiah(ujDel?.uj_amount ?? 0)} akan dihapus.`}
        onCancel={() => setUjDel(null)}
        onConfirm={deleteUj}
      />
      <ConfirmDialog
        open={!!expDel}
        title="Hapus biaya?"
        message={`${expDel?.expense_type} senilai ${formatRupiah(expDel?.amount ?? 0)} akan dihapus.`}
        onCancel={() => setExpDel(null)}
        onConfirm={deleteExp}
      />
    </>
  )
}
