import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { FaArrowLeft, FaLink, FaPen, FaPlus, FaTrashCan } from '../components/ui/icons'
import { PageHeader } from '../components/layout/PageHeader'
import { Card, CardHeader, InfoItem } from '../components/ui/Card'
import { Tabs } from '../components/ui/Tabs'
import { Button, IconButton } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Modal, ConfirmDialog } from '../components/ui/Modal'
import { Field, DateInput, Select, Textarea } from '../components/ui/Field'
import { CurrencyInput } from '../components/ui/CurrencyInput'
import { SearchableSelect } from '../components/ui/SearchableSelect'
import { LampiranInput, LampiranThumbs } from '../components/ui/Lampiran'
import { useData } from '../store/DataProvider'
import { useAuth } from '../store/AuthProvider'
import { useToast } from '../store/ToastProvider'
import { ARAH_KASBON, saldoKasbon } from '../lib/kasbon'
import { hapusLampiran } from '../lib/lampiran'
import { formatDate, formatRupiah, todayISO } from '../lib/format'
import { cn } from '../lib/utils'
import { KASBON_LABEL, ROLE_LABEL } from '../types'
import type { KasbonEntry, KasbonKind } from '../types'

type Form = {
  amount: number
  kind: KasbonKind
  arah: 1 | -1
  trip_id: string
  entry_date: string
  notes: string
  attachments: string[]
}

const NADA: Record<KasbonKind, 'brand' | 'warning' | 'good' | 'neutral'> = {
  admin: 'brand', trip: 'warning', pembatalan: 'good', manual: 'neutral',
}

/**
 * Jenis yang boleh diinput tangan. "Potong dari Trip" dan "Pembatalan Trip"
 * dibuat otomatis dari halaman trip, jadi tidak ditawarkan supaya potongan
 * tidak tercatat dua kali.
 */
const JENIS_MANUAL: KasbonKind[] = ['admin', 'manual']

/** Master -> Data Karyawan -> Transaksi {nama}: kasbon dan biaya karyawan. */
export function KaryawanTransaksiPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { db, dbAll, loading, create, update, remove } = useData()
  const { canEdit } = useAuth()
  const toast = useToast()

  const [tab, setTab] = useState('overview')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<KasbonEntry | null>(null)
  const [form, setForm] = useState<Form>(kosong())
  /** Pesan salah per kolom, ditampilkan langsung di bawah kolomnya. */
  const [galat, setGalat] = useState<Partial<Record<'amount' | 'notes' | 'trip_id' | 'entry_date', string>>>({})
  const [deleting, setDeleting] = useState<KasbonEntry | null>(null)

  const orang = db.drivers.find((d) => d.id === id)

  const tripMap = useMemo(() => new Map(dbAll.transactions.map((t) => [t.id, t])), [dbAll.transactions])
  const routeMap = useMemo(() => new Map(dbAll.routes.map((r) => [r.id, r])), [dbAll.routes])

  /** Trip yang pernah dibawa karyawan ini (lintas workspace). */
  const tripSaya = useMemo(
    () => dbAll.transactions
      .filter((t) => (t.driver_ids?.length ? t.driver_ids : [t.driver_id]).includes(id ?? ''))
      .sort((a, b) => b.transaction_date.localeCompare(a.transaction_date)),
    [dbAll.transactions, id],
  )

  /** Mutasi kasbon, urut waktu, lengkap dengan saldo berjalan. */
  const mutasi = useMemo(() => {
    const milik = db.kasbonEntries
      .filter((e) => e.employee_id === id)
      .sort((a, b) => a.entry_date.localeCompare(b.entry_date) || a.created_at.localeCompare(b.created_at))
    let saldo = 0
    return milik.map((e) => { saldo += e.amount; return { ...e, saldo } })
  }, [db.kasbonEntries, id])

  /** Trip tempat karyawan ini menjadi sopir utama (penanggung biaya & penerima komisi). */
  const utamaDi = useMemo(
    () => new Set(tripSaya.filter((t) => (t.driver_ids?.[0] ?? t.driver_id) === id).map((t) => t.id)),
    [tripSaya, id],
  )

  const biayaSaya = useMemo(() => {
    // Biaya trip batal tidak dihitung (arsip).
    const idTrip = new Set(tripSaya.filter((t) => t.status !== 'batal').map((t) => t.id))
    return dbAll.expenses.filter((e) => idTrip.has(e.trip_id)).sort((a, b) => b.expense_date.localeCompare(a.expense_date))
  }, [dbAll.expenses, tripSaya])
  const totalBiayaUtama = biayaSaya.reduce((a, b) => (utamaDi.has(b.trip_id) ? a + b.amount : a), 0)

  const uangJalan = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of dbAll.ujPayments) m.set(p.trip_id, (m.get(p.trip_id) ?? 0) + p.uj_amount)
    return m
  }, [dbAll.ujPayments])

  if (loading) {
    return (
      <>
        <PageHeader title="Memuat karyawan..." crumbs={[{ label: 'Master' }, { label: 'Data Karyawan', to: '/master/karyawan' }]} />
        <div className="skeleton h-64 rounded-xl" />
      </>
    )
  }

  if (!orang) {
    return (
      <>
        <PageHeader title="Karyawan tidak ditemukan" crumbs={[{ label: 'Master' }, { label: 'Data Karyawan', to: '/master/karyawan' }]} />
        <Card>
          <div className="px-6 py-14 text-center">
            <p className="text-[14px] font-semibold text-ink">Data tidak ditemukan.</p>
            <p className="mt-1 text-[13px] text-ink-3">Karyawan mungkin sudah dihapus.</p>
            <Button className="mt-4" onClick={() => navigate('/master/karyawan')}>Kembali ke daftar</Button>
          </div>
        </Card>
      </>
    )
  }

  const saldo = saldoKasbon(db.kasbonEntries, orang.id)
  const masuk = mutasi.reduce((a, e) => (e.amount > 0 ? a + e.amount : a), 0)
  const keluar = mutasi.reduce((a, e) => (e.amount < 0 ? a - e.amount : a), 0)

  const tripOptions = tripSaya.map((t) => ({
    value: t.id,
    label: t.transaction_no,
    meta: `${formatDate(t.transaction_date)} · ${routeMap.get(t.route_id)?.route_name ?? t.destination_detail ?? ''}`,
  }))

  function kosong(): Form {
    return { amount: 0, kind: 'admin', arah: 1, trip_id: '', entry_date: todayISO(), notes: '', attachments: [] }
  }

  function bukaTambah() {
    setEditing(null); setForm(kosong()); setGalat({}); setOpen(true)
  }

  function bukaUbah(e: KasbonEntry) {
    setEditing(e)
    setForm({
      amount: Math.abs(e.amount), kind: e.kind, arah: e.amount < 0 ? -1 : 1, trip_id: e.trip_id,
      entry_date: e.entry_date, notes: e.notes, attachments: e.attachments ?? [],
    })
    setGalat({}); setOpen(true)
  }

  const arah = ARAH_KASBON[form.kind] || form.arah
  const perluTrip = form.kind === 'trip' || form.kind === 'pembatalan'
  const saldoTanpaIni = saldo - (editing?.amount ?? 0)
  const saldoSetelah = saldoTanpaIni + arah * form.amount

  function simpan() {
    const g: typeof galat = {}
    if (form.amount <= 0) g.amount = 'Jumlah harus lebih dari 0.'
    if (form.kind === 'manual' && !form.notes.trim()) g.notes = 'Penyesuaian wajib diberi catatan alasannya.'
    if (perluTrip && !form.trip_id) g.trip_id = 'Pilih trip yang terkait.'
    if (!form.entry_date) g.entry_date = 'Tanggal wajib diisi.'
    // Saldo tidak boleh minus: potongan tidak melebihi kasbon, dan kasbon yang
    // sudah terpotong tidak bisa diperkecil melewati potongannya.
    if (!g.amount && saldoSetelah < 0) {
      g.amount = arah < 0
        ? `Potongan melebihi saldo kasbon (${formatRupiah(saldoTanpaIni)}).`
        : `Kasbon ini sudah terpotong; saldo akan menjadi minus ${formatRupiah(-saldoSetelah)}.`
    }
    setGalat(g)
    if (Object.keys(g).length > 0) return
    const isi = {
      employee_id: orang!.id,
      entry_date: form.entry_date,
      kind: form.kind,
      amount: arah * form.amount,
      trip_id: perluTrip ? form.trip_id : '',
      notes: form.notes.trim(),
      attachments: form.attachments,
    }
    if (editing) { update('kasbonEntries', editing.id, isi); toast.success('Transaksi berhasil diperbarui.') }
    else {
      create('kasbonEntries', { ...isi, uj_payment_id: '' })
      toast.success(`${KASBON_LABEL[form.kind]} ${formatRupiah(form.amount)} untuk ${orang!.driver_name} tersimpan.`)
    }
    setOpen(false)
    // Tampilkan daftar kasbon supaya transaksi yang baru disimpan langsung terlihat.
    setTab('kasbon')
  }

  function hapus() {
    if (!deleting) return
    if (saldo - deleting.amount < 0) {
      toast.error(`Tidak bisa dihapus: kasbon ini sudah terpotong, saldo akan menjadi minus ${formatRupiah(deleting.amount - saldo)}.`)
      setDeleting(null)
      return
    }
    remove('kasbonEntries', deleting.id)
    void hapusLampiran(deleting.attachments ?? [])
    toast.success('Transaksi berhasil dihapus.')
    setDeleting(null)
  }

  /** Keterangan satu mutasi: trip yang terkait, catatan, atau keduanya. */
  function keterangan(e: KasbonEntry) {
    const t = e.trip_id ? tripMap.get(e.trip_id) : undefined
    return (
      <span className="block leading-snug">
        {t ? (
          <Link to={`/transaksi/trip/${t.id}${e.kind === 'trip' ? '?tab=uj' : ''}`} className="font-medium text-brand-700 hover:underline">
            Trip {t.transaction_no}
          </Link>
        ) : e.trip_id ? (
          <span className="text-ink-3">Trip sudah dihapus</span>
        ) : null}
        {e.uj_payment_id && e.kind === 'trip' && <span className="ml-1.5 text-[11.5px] text-ink-3">dari termin uang jalan</span>}
        {e.notes && <span className={cn('block text-[12px] text-ink-3', !t && !e.trip_id && 'text-[13px] text-ink-2')}>{e.notes}</span>}
        {!t && !e.trip_id && !e.notes && <span className="text-ink-3">—</span>}
      </span>
    )
  }

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'kasbon', label: 'Kasbon', badge: mutasi.length },
    { id: 'biaya', label: 'Biaya Operasional', badge: biayaSaya.length },
  ]

  return (
    <>
      <PageHeader
        title={`Transaksi ${orang.driver_name}`}
        description={`${orang.driver_code} · ${ROLE_LABEL[orang.role ?? 'sopir']} · ${orang.city || 'kota belum diisi'}`}
        crumbs={[{ label: 'Master' }, { label: 'Data Karyawan', to: '/master/karyawan' }, { label: orang.driver_name }]}
        actions={
          <>
            <Button icon={<FaArrowLeft size={15} />} onClick={() => navigate('/master/karyawan')}>Kembali</Button>
            <Button variant="primary" icon={<FaPlus size={15} />} disabled={!canEdit} onClick={bukaTambah}>Tambah Transaksi</Button>
          </>
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        {[
          ['Kasbon Masuk', formatRupiah(masuk), 'diberikan admin & pengembalian'],
          ['Kasbon Terpotong', formatRupiah(keluar), 'dipotong dari trip & penyesuaian'],
          ['Jumlah Trip', String(tripSaya.length), 'trip yang pernah dibawa'],
        ].map(([label, nilai, ket]) => (
          <div key={label} className="shadow-card rounded-xl border border-hairline bg-surface p-4">
            <p className="text-[12.5px] font-medium text-ink-3">{label}</p>
            <p className="tnum mt-1.5 text-[19px] leading-none font-semibold tracking-tight text-ink">{nilai}</p>
            <p className="mt-2 text-[11.5px] text-ink-3">{ket}</p>
          </div>
        ))}
      </div>

      <Card>
        <Tabs items={tabs} value={tab} onChange={setTab} className="px-2" />

        {tab === 'overview' && (
          <div className="grid gap-4 p-4 lg:grid-cols-2">
            <div className="rounded-lg border border-hairline">
              <CardHeader title="Profil" />
              <dl className="grid gap-4 p-4 sm:grid-cols-2">
                <InfoItem label="Kode" value={orang.driver_code} mono />
                <InfoItem label="Peran" value={ROLE_LABEL[orang.role ?? 'sopir']} />
                <InfoItem label="Telepon" value={orang.phone || '—'} mono />
                <InfoItem label="Status" value={orang.status === 'aktif' ? 'Aktif' : 'Nonaktif'} />
                <InfoItem label="Alamat" value={[orang.address_1, orang.address_2].filter(Boolean).join(', ') || '—'} />
                <InfoItem label="Kota" value={orang.city || '—'} />
              </dl>
              <div className="border-t border-hairline px-4 py-3">
                <p className="mb-2 text-[11.5px] font-semibold tracking-wide text-ink-3 uppercase">Dokumen (KTP, SIM, dll.)</p>
                {(orang.attachments ?? []).length > 0
                  ? <LampiranThumbs ids={orang.attachments} ukuran={56} />
                  : <p className="text-[12.5px] text-ink-3">Belum ada dokumen. Tambahkan lewat Ubah di Data Karyawan.</p>}
              </div>
            </div>
            <div className="rounded-lg border border-hairline">
              <CardHeader title="Trip terakhir" subtitle={`${tripSaya.length} trip tercatat`} />
              {tripSaya.length === 0 ? (
                <p className="px-4 py-10 text-center text-[13px] text-ink-3">Belum pernah membawa trip.</p>
              ) : (
                <ul className="divide-y divide-grid">
                  {tripSaya.slice(0, 6).map((t) => (
                    <li key={t.id}>
                      <Link to={`/transaksi/trip/${t.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-sunken">
                        <span className="min-w-0">
                          <span className="tnum block text-[13px] font-semibold text-brand-700">{t.transaction_no}</span>
                          <span className="block truncate text-[12px] text-ink-3">
                            {formatDate(t.transaction_date)} · {routeMap.get(t.route_id)?.route_name ?? t.destination_detail ?? '—'}
                            {!utamaDi.has(t.id) && ' · sopir tambahan'}
                            {t.status === 'batal' && ' · dibatalkan'}
                          </span>
                        </span>
                        <span className="tnum shrink-0 text-[13px] text-ink-2">{formatRupiah(uangJalan.get(t.id) ?? 0)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {tab === 'kasbon' && (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-4 py-3">
              <p className="text-[12.5px] text-ink-3">
                Kasbon bertambah saat diberikan admin, dan berkurang saat dipotong dari uang jalan trip. Potongan dan
                pembatalan trip tercatat otomatis dari halaman trip.
              </p>
              <Button size="sm" variant="primary" icon={<FaPlus size={14} />} disabled={!canEdit} onClick={bukaTambah}>Tambah Transaksi</Button>
            </div>
            {mutasi.length === 0 ? (
              <div className="px-6 py-14 text-center">
                <p className="text-[14px] font-semibold text-ink">Belum ada transaksi kasbon.</p>
                <p className="mt-1 text-[13px] text-ink-3">Catat kasbon pertama yang diberikan ke {orang.driver_name}.</p>
                {canEdit && <Button className="mt-4" variant="primary" icon={<FaPlus size={15} />} onClick={bukaTambah}>Tambah Transaksi</Button>}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-max text-[13px]">
                  <thead className="bg-sunken">
                    <tr className="border-b border-hairline">
                      {['Tanggal', 'Jenis', 'Keterangan', 'Masuk', 'Keluar', 'Saldo', 'Bukti', 'Action'].map((h, i) => (
                        <th key={h} className={`px-3 py-2 text-[11.5px] font-semibold tracking-wide text-ink-2 uppercase ${i >= 3 && i <= 5 ? 'text-right' : i === 7 ? 'text-right' : 'text-left'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {mutasi.map((e) => (
                      <tr key={e.id} className="border-b border-grid align-top last:border-0 hover:bg-sunken">
                        <td className="tnum px-3 py-2.5 text-ink-2">{formatDate(e.entry_date)}</td>
                        <td className="px-3 py-2.5"><Badge tone={NADA[e.kind]}>{KASBON_LABEL[e.kind]}</Badge></td>
                        <td className="max-w-[360px] px-3 py-2.5">{keterangan(e)}</td>
                        <td className="tnum px-3 py-2.5 text-right font-medium text-[#0a7d0a]">{e.amount > 0 ? `+${formatRupiah(e.amount)}` : ''}</td>
                        <td className="tnum px-3 py-2.5 text-right font-medium text-[color:var(--color-critical)]">{e.amount < 0 ? `−${formatRupiah(-e.amount)}` : ''}</td>
                        <td className="tnum px-3 py-2.5 text-right font-semibold text-ink">{formatRupiah(e.saldo)}</td>
                        <td className="px-3 py-2.5"><LampiranThumbs ids={e.attachments ?? []} ukuran={30} /></td>
                        <td className="px-3 py-2.5 text-right">
                          {e.uj_payment_id ? (
                            <IconButton
                              label={e.kind === 'pembatalan' ? 'Otomatis dari pembatalan trip' : 'Diatur dari termin uang jalan trip'}
                              icon={<FaLink size={14} />}
                              onClick={() => navigate(`/transaksi/trip/${e.trip_id}${e.kind === 'trip' ? '?tab=uj' : ''}`)}
                            />
                          ) : (
                            <div className="flex justify-end gap-1">
                              <IconButton label="Ubah" icon={<FaPen size={14} />} disabled={!canEdit} onClick={() => bukaUbah(e)} />
                              <IconButton label="Hapus" tone="danger" icon={<FaTrashCan size={14} />} disabled={!canEdit} onClick={() => setDeleting(e)} />
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-hairline bg-sunken font-semibold">
                    <tr>
                      <td className="px-3 py-2.5 text-[12px] text-ink-2" colSpan={3}>Total {mutasi.length} transaksi</td>
                      <td className="tnum px-3 py-2.5 text-right">{formatRupiah(masuk)}</td>
                      <td className="tnum px-3 py-2.5 text-right">{formatRupiah(keluar)}</td>
                      <td className="tnum px-3 py-2.5 text-right text-ink">{formatRupiah(saldo)}</td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === 'biaya' && (
          <div>
            <p className="border-b border-hairline px-4 py-3 text-[12.5px] text-ink-3">
              Biaya operasional dari trip yang dibawa {orang.driver_name}. Total hanya menghitung trip saat ia menjadi sopir
              utama, supaya biaya yang sama tidak terhitung di dua sopir.
            </p>
            {biayaSaya.length === 0 ? (
              <p className="px-6 py-14 text-center text-[13px] text-ink-3">Belum ada biaya operasional pada trip karyawan ini.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-max text-[13px]">
                  <thead className="bg-sunken">
                    <tr className="border-b border-hairline">
                      {['Tanggal', 'Trip', 'Sebagai', 'Jenis Biaya', 'Nominal', 'Catatan', 'Bukti'].map((h, i) => (
                        <th key={h} className={`px-3 py-2 text-[11.5px] font-semibold tracking-wide text-ink-2 uppercase ${i === 4 ? 'text-right' : 'text-left'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {biayaSaya.map((b) => {
                      const t = tripMap.get(b.trip_id)
                      return (
                        <tr key={b.id} className="border-b border-grid last:border-0 hover:bg-sunken">
                          <td className="tnum px-3 py-2.5 text-ink-2">{formatDate(b.expense_date)}</td>
                          <td className="px-3 py-2.5">
                            {t ? <Link to={`/transaksi/trip/${t.id}?tab=biaya`} className="tnum font-medium text-brand-700 hover:underline">{t.transaction_no}</Link> : '—'}
                          </td>
                          <td className="px-3 py-2.5 text-[12.5px] text-ink-2">{utamaDi.has(b.trip_id) ? 'Sopir utama' : 'Sopir tambahan'}</td>
                          <td className="px-3 py-2.5"><Badge tone="brand">{b.expense_type}</Badge></td>
                          <td className={cn('tnum px-3 py-2.5 text-right font-semibold', utamaDi.has(b.trip_id) ? 'text-ink' : 'text-ink-3')}>{formatRupiah(b.amount)}</td>
                          <td className="px-3 py-2.5 text-ink-3">{b.notes || '—'}</td>
                          <td className="px-3 py-2.5"><LampiranThumbs ids={b.attachments ?? []} ukuran={30} /></td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot className="border-t-2 border-hairline bg-sunken font-semibold">
                    <tr>
                      <td className="px-3 py-2.5 text-[12px] text-ink-2" colSpan={4}>Total sebagai sopir utama</td>
                      <td className="tnum px-3 py-2.5 text-right text-ink">{formatRupiah(totalBiayaUtama)}</td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Ubah Transaksi' : 'Tambah Transaksi'}
        subtitle={`Kasbon ${orang.driver_name}`}
        size="sm"
        footer={
          <>
            <Button onClick={() => setOpen(false)}>Batal</Button>
            <Button variant="primary" onClick={simpan}>Simpan</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Jumlah" required error={galat.amount}>
            {(fid) => <CurrencyInput id={fid} value={form.amount} onValueChange={(v) => setForm({ ...form, amount: v })} />}
          </Field>
          <Field label="Jenis" required>
            {(fid) => (
              <Select id={fid} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as KasbonKind })}>
                {/* Catatan lama berjenis trip/pembatalan tetap bisa dibuka dengan jenisnya. */}
                {[...JENIS_MANUAL, ...(editing && !JENIS_MANUAL.includes(editing.kind) ? [editing.kind] : [])].map((k) => (
                  <option key={k} value={k}>{KASBON_LABEL[k]}</option>
                ))}
              </Select>
            )}
          </Field>
          {form.kind === 'manual' && (
            <Field label="Arah">
              {(fid) => (
                <Select id={fid} value={String(form.arah)} onChange={(e) => setForm({ ...form, arah: Number(e.target.value) as 1 | -1 })}>
                  <option value="1">Menambah kasbon</option>
                  <option value="-1">Mengurangi kasbon</option>
                </Select>
              )}
            </Field>
          )}
          {perluTrip && (
            <Field label="Trip" required error={galat.trip_id} hint={tripOptions.length === 0 ? 'Karyawan ini belum pernah membawa trip.' : undefined}>
              {(fid) => (
                <SearchableSelect id={fid} options={tripOptions} value={form.trip_id || null}
                  placeholder="Pilih nomor trip..." onChange={(v) => setForm({ ...form, trip_id: v ?? '' })} />
              )}
            </Field>
          )}
          <Field label="Tanggal" required error={galat.entry_date}>
            {(fid) => <DateInput id={fid} value={form.entry_date} onChange={(e) => setForm({ ...form, entry_date: e.target.value })} />}
          </Field>
          <Field label="Catatan" required={form.kind === 'manual'} error={galat.notes} hint={form.kind === 'manual' ? 'Tulis alasan penyesuaian.' : undefined}>
            {(fid) => <Textarea id={fid} rows={2} value={form.notes} className="resize-y" onChange={(e) => setForm({ ...form, notes: e.target.value })} />}
          </Field>
          <Field label="Bukti" hint="Foto nota, bukti transfer, dan sejenisnya.">
            {(fid) => <LampiranInput id={fid} value={form.attachments} onChange={(v) => setForm((f) => ({ ...f, attachments: v }))} />}
          </Field>

          <div className="rounded-lg border border-hairline bg-sunken px-3.5 py-3 text-[12.5px]">
            <p className="flex items-center justify-between gap-3 text-ink-2">
              <span>Saldo sekarang</span>
              <span className="tnum font-medium">{formatRupiah(saldoTanpaIni)}</span>
            </p>
            <p className="mt-1 flex items-center justify-between gap-3 font-semibold text-ink">
              <span>Setelah transaksi</span>
              <span className={cn('tnum', saldoSetelah < 0 && 'text-[color:var(--color-critical)]')}>{formatRupiah(saldoSetelah)}</span>
            </p>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title="Hapus transaksi kasbon?"
        message={`${deleting ? KASBON_LABEL[deleting.kind] : ''} senilai ${formatRupiah(Math.abs(deleting?.amount ?? 0))} akan dihapus dan saldo kasbon ikut menyesuaikan.`}
        onCancel={() => setDeleting(null)}
        onConfirm={hapus}
      />
    </>
  )
}
