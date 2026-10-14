import { useCallback, useMemo, useState } from 'react'
import { FaBan, FaCircleCheck, FaEye, FaPen, FaPlus, FaTrashCan } from '../../components/ui/icons'
import { PageHeader } from '../../components/layout/PageHeader'
import { Card } from '../../components/ui/Card'
import { DataTable } from '../../components/ui/DataTable'
import type { Column } from '../../components/ui/DataTable'
import { Pagination } from '../../components/ui/Pagination'
import { PanelFilter, SearchInput, Toolbar } from '../../components/ui/Toolbar'
import { Button, IconButton } from '../../components/ui/Button'
import { ConfirmDialog, Modal } from '../../components/ui/Modal'
import { Field, Select } from '../../components/ui/Field'
import { Badge } from '../../components/ui/Badge'
import { EmptyState, NotFoundState } from '../../components/ui/States'
import { useData } from '../../store/DataProvider'
import { useAuth } from '../../store/AuthProvider'
import { useToast } from '../../store/ToastProvider'
import { useTable } from '../../lib/useTable'
import { useFilter } from '../../lib/useFilter'
import { matchesQuery } from '../../lib/utils'
import { formatNumber } from '../../lib/format'
import type { Alamat } from '../../types'
import { ModalAlamat } from './FormAlamat'
import { pemakaianKodeArea } from '../../lib/kodeArea'

/**
 * Master Data -> Alamat: lokasi pick up & destinasi beserta kontaknya, dipakai di form trip
 * (Pick Up / Destination Details) dan sebagai Area di form rute. Kode area dibuat otomatis dari
 * kota (revisi 13 Okt 2026); koordinat & ID lokasi klien tidak ditampilkan lagi.
 * Ubah data hanya Manager & Owner (izin master); peran lain melihat rinciannya saja.
 */
export function DataAlamatPage() {
  const { db, dbAll, loading, error, reload, update, remove } = useData()
  const { bisa } = useAuth()
  const bolehUbah = bisa('master')
  const toast = useToast()

  const [form, setForm] = useState<{ buka: boolean; alamat: Alamat | null }>({ buka: false, alamat: null })
  const [hapus, setHapus] = useState<Alamat | null>(null)
  const filter = useFilter({ kode: '', status: '', pakai: '' })
  const { kode: kodeFilter, status: statusFilter, pakai: pakaiFilter } = filter.nilai
  const d = filter.draf

  const semua = db.alamat ?? []

  /** Jumlah trip (kedua workspace) yang menyalin alamat ini sebagai pick up atau destinasi. */
  const dipakai = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of dbAll.transactions) {
      for (const id of new Set([t.pengirim?.alamat_id, t.penerima?.alamat_id])) if (id) m.set(id, (m.get(id) ?? 0) + 1)
    }
    return m
  }, [dbAll.transactions])

  /** Kode area yang dipakai rute: alamat berkode lain diberi keterangan "belum ada rute". */
  const kodeRute = useMemo(() => pemakaianKodeArea(db.routes), [db.routes])
  const kodeOpsi = useMemo(() => [...new Set(semua.map((a) => a.kode_area).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [semua])

  const search = useCallback(
    (a: Alamat, q: string) => matchesQuery(q, a.kode_area, a.nama, a.alamat, a.kota, a.nama_kontak, a.telepon, a.catatan),
    [],
  )
  const extraFilter = useCallback(
    (a: Alamat) => (!kodeFilter || a.kode_area === kodeFilter)
      && (!statusFilter || a.status === statusFilter)
      && (!pakaiFilter || (pakaiFilter === 'ya') === (dipakai.get(a.id) ?? 0) > 0),
    [kodeFilter, statusFilter, pakaiFilter, dipakai],
  )
  const jumlahFilter = [kodeFilter, statusFilter, pakaiFilter].filter(Boolean).length
  const filterAktif = jumlahFilter > 0
  const table = useTable(semua, {
    search, extraFilter, extraFilterActive: filterAktif, initialSortKey: 'nama', tieBreakKey: 'kode_area', pageSize: 10,
  })
  const resetFilter = () => { table.reset(); filter.lepasSemua() }
  const chips = [
    kodeFilter && { label: `Kode area: ${kodeFilter}`, lepas: () => filter.lepas('kode') },
    pakaiFilter && { label: pakaiFilter === 'ya' ? 'Sudah dipakai trip' : 'Belum pernah dipakai', lepas: () => filter.lepas('pakai') },
    statusFilter && { label: `Status: ${statusFilter === 'aktif' ? 'Aktif' : 'Nonaktif'}`, lepas: () => filter.lepas('status') },
  ]

  const jumlahNonaktif = semua.filter((a) => a.status === 'nonaktif').length

  function ubahStatus(a: Alamat, status: Alamat['status']) {
    update('alamat', a.id, { status })
    toast.success(status === 'nonaktif'
      ? `${a.nama} dinonaktifkan: tidak ditawarkan lagi untuk trip baru.`
      : `${a.nama} diaktifkan kembali.`)
  }

  function hapusSekarang() {
    if (!hapus) return
    remove('alamat', hapus.id)
    toast.success('Data berhasil dihapus.')
    setHapus(null)
  }

  const columns: Column<Alamat>[] = [
    {
      key: 'nama', header: 'Nama Lokasi', sortable: true,
      render: (a) => (
        <span className="block min-w-[180px] leading-tight">
          <span className="font-medium text-ink">{a.nama}</span>
          {a.kota && <span className="mt-0.5 block text-[12px] text-ink-3">{a.kota}</span>}
        </span>
      ),
    },
    {
      key: 'kode_area', header: 'Kode Area', sortable: true, width: '128px',
      render: (a) => (
        <span className="block leading-tight">
          <span className="tnum font-semibold text-ink">{a.kode_area || '—'}</span>
          {a.kode_area && !kodeRute.has(a.kode_area) && (
            <span className="mt-0.5 block text-[11px] text-ink-3" title="Belum ada rute dengan kode area ini.">belum ada rute</span>
          )}
        </span>
      ),
    },
    {
      key: 'alamat', header: 'Alamat',
      render: (a) => (
        <span className="block max-w-[340px] min-w-[200px] leading-snug whitespace-normal text-ink-2">
          {a.alamat || '—'}
          {a.catatan && <span className="mt-0.5 block text-[11.5px] text-ink-3">{a.catatan}</span>}
        </span>
      ),
    },
    {
      key: 'kontak', header: 'Kontak',
      render: (a) => (a.nama_kontak || a.telepon
        ? (
          <span className="block min-w-[120px] leading-snug whitespace-normal text-ink-2">
            {[a.nama_kontak, a.telepon].filter(Boolean).join(' · ')}
          </span>
        )
        : <span className="text-ink-3">—</span>),
    },
    {
      // Trip lama tidak menyimpan alamat, jadi jumlah rute di area ini ikut ditampilkan: "0 trip" saja
      // membuat alamat yang penting tampak tidak terpakai (analisis UX 14 Okt 2026).
      key: 'dipakai', header: 'Dipakai', align: 'right', width: '104px',
      render: (a) => {
        const rute = kodeRute.get((a.kode_area ?? '').trim().toUpperCase())?.rute ?? 0
        return (
          <span className="block leading-tight">
            <span className="tnum text-ink-2">{formatNumber(dipakai.get(a.id) ?? 0)} trip</span>
            {rute > 0 && (
              <span className="tnum mt-0.5 block text-[11px] text-ink-3" title={`Rute yang area pick up / destinasinya ${a.kode_area}`}>
                {formatNumber(rute)} rute
              </span>
            )}
          </span>
        )
      },
    },
    {
      key: 'status', header: 'Status', sortable: true, width: '100px',
      render: (a) => (a.status === 'aktif' ? <Badge tone="good">Aktif</Badge> : <Badge tone="neutral">Nonaktif</Badge>),
    },
    {
      key: 'action', header: 'Action', align: 'right', width: bolehUbah ? '112px' : '64px',
      render: (a) => (
        <div className="flex justify-end gap-1">
          {bolehUbah ? (
            <>
              <IconButton label="Ubah" icon={<FaPen size={14} />} onClick={() => setForm({ buka: true, alamat: a })} />
              {a.status === 'aktif'
                ? <IconButton label="Nonaktifkan" icon={<FaBan size={14} />} onClick={() => ubahStatus(a, 'nonaktif')} />
                : <IconButton label="Aktifkan" icon={<FaCircleCheck size={14} />} onClick={() => ubahStatus(a, 'aktif')} />}
              <IconButton label="Hapus" tone="danger" icon={<FaTrashCan size={14} />} onClick={() => setHapus(a)} />
            </>
          ) : (
            <IconButton label="Lihat rincian" icon={<FaEye size={14} />} onClick={() => setForm({ buka: true, alamat: a })} />
          )}
        </div>
      ),
    },
  ]

  const jumlahTripHapus = hapus ? dipakai.get(hapus.id) ?? 0 : 0
  const tutupForm = () => setForm({ buka: false, alamat: null })

  return (
    <>
      <PageHeader
        title="Alamat"
        crumbs={[{ label: 'Master Data' }, { label: 'Alamat' }]}
        description="Lokasi pick up dan destinasi beserta kontaknya. Dipakai di form trip (Pick Up / Destination Details) dan sebagai Area di rute. Kode area dibuat otomatis dari kota."
        actions={<Button variant="primary" icon={<FaPlus size={15} />} disabled={!bolehUbah} onClick={() => setForm({ buka: true, alamat: null })}>Tambah Alamat</Button>}
      />

      <Card>
        <Toolbar
          left={
            <>
              <SearchInput value={table.query} onChange={table.setQuery} placeholder="Cari nama lokasi, kota, kode area, kontak..." />
              <PanelFilter filter={filter} chips={chips}>
                <Field label="Kode Area">
                  {(id) => (
                    <Select id={id} value={d.kode} onChange={(e) => filter.ubah({ kode: e.target.value })}>
                      <option value="">Semua</option>
                      {kodeOpsi.map((k) => <option key={k} value={k}>{k}</option>)}
                    </Select>
                  )}
                </Field>
                <Field label="Dipakai trip">
                  {(id) => (
                    <Select id={id} value={d.pakai} onChange={(e) => filter.ubah({ pakai: e.target.value })}>
                      <option value="">Semua</option>
                      <option value="ya">Sudah dipakai</option>
                      <option value="tidak">Belum pernah dipakai</option>
                    </Select>
                  )}
                </Field>
                <Field label="Status">
                  {(id) => (
                    <Select id={id} value={d.status} onChange={(e) => filter.ubah({ status: e.target.value })}>
                      <option value="">Semua</option>
                      <option value="aktif">Aktif</option>
                      <option value="nonaktif">Nonaktif</option>
                    </Select>
                  )}
                </Field>
              </PanelFilter>
            </>
          }
          right={(
            <span className="text-[12.5px] text-ink-3">
              {formatNumber(semua.length)} alamat terdaftar{jumlahNonaktif > 0 && <> · {formatNumber(jumlahNonaktif)} nonaktif</>}
            </span>
          )}
        />

        <DataTable
          columns={columns}
          rows={table.pageRows}
          rowKey={(a) => a.id}
          loading={loading}
          error={error}
          onRetry={reload}
          isFiltered={table.isFiltered || filterAktif}
          sort={table.sort}
          onSortChange={table.toggleSort}
          empty={<EmptyState entity="alamat" />}
          notFound={<NotFoundState onReset={resetFilter} />}
        />

        {table.total > 0 && (
          <Pagination page={table.page} pageSize={table.pageSize} total={table.total} onPageChange={table.setPage} onPageSizeChange={table.setPageSize} />
        )}
      </Card>

      <ModalAlamat open={form.buka} alamat={form.alamat} bacaSaja={!bolehUbah} onClose={tutupForm} />

      {/* Belum dipakai trip mana pun: boleh dihapus. */}
      <ConfirmDialog
        open={!!hapus && jumlahTripHapus === 0}
        message={
          <>
            Data yang sudah dihapus mungkin tidak dapat dikembalikan.
            <br />
            <span className="mt-2 block font-medium text-ink">{hapus?.kode_area} · {hapus?.nama}</span>
          </>
        }
        onCancel={() => setHapus(null)}
        onConfirm={hapusSekarang}
      />

      {/* Sudah dipakai trip: tidak dihapus, tawarkan nonaktifkan. */}
      <Modal
        open={!!hapus && jumlahTripHapus > 0}
        onClose={() => setHapus(null)}
        size="sm"
        title="Alamat tidak bisa dihapus"
        footer={hapus?.status === 'aktif'
          ? (
            <>
              <Button onClick={() => setHapus(null)}>Batal</Button>
              <Button variant="primary" icon={<FaBan size={14} />} onClick={() => { if (hapus) ubahStatus(hapus, 'nonaktif'); setHapus(null) }}>Nonaktifkan</Button>
            </>
          )
          : <Button onClick={() => setHapus(null)}>Tutup</Button>}
      >
        <div className="space-y-2 text-[13px] leading-relaxed text-ink-2">
          <p>
            <span className="font-medium text-ink">{hapus?.kode_area} · {hapus?.nama}</span> sudah dipakai{' '}
            {formatNumber(jumlahTripHapus)} trip. Alamatnya tidak dihapus supaya asal salinan alamat di trip tersebut tetap tercatat.
          </p>
          <p>
            {hapus?.status === 'aktif'
              ? 'Nonaktifkan saja: alamat tidak ditawarkan lagi untuk trip baru, dan bisa diaktifkan kembali kapan saja.'
              : 'Alamat ini sudah nonaktif, jadi tidak ditawarkan lagi untuk trip baru.'}
          </p>
        </div>
      </Modal>
    </>
  )
}
