import { useState } from 'react'
import { Database, Download, RefreshCw, Shuffle, TriangleAlert } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { Card, CardHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { ConfirmDialog } from '../components/ui/Modal'
import { useData } from '../store/DataProvider'
import { useAuth } from '../store/AuthProvider'
import { useToast } from '../store/ToastProvider'
import { TBD_NOTES } from '../lib/calculations'
import { downloadFile } from '../lib/utils'
import { formatNumber, todayISO } from '../lib/format'

export function ToolsPage() {
  const { db, resetToDummy, resetToSample, simulateError, reload } = useData()
  const { canEdit } = useAuth()
  const toast = useToast()
  const [confirmReset, setConfirmReset] = useState(false)
  const [confirmSample, setConfirmSample] = useState(false)

  const counts: Array<[string, number]> = [
    ['Sopir', db.drivers.length],
    ['Route', db.routes.length],
    ['Mobil', db.vehicles.length],
    ['Project', db.projects.length],
    ['SI / Job Order', db.jobOrders.length],
    ['Trip / Transaksi', db.transactions.length],
    ['Data Tagihan', db.billings.length],
    ['Surat Jalan', db.deliveryNotes.length],
    ['Termin Uang Jalan', db.ujPayments.length],
    ['Biaya Operasional', db.expenses.length],
  ]

  function exportJson() {
    downloadFile(`sikotis-dummy-${todayISO()}.json`, JSON.stringify(db, null, 2))
    toast.success('Data berhasil diexport.')
  }

  function doReset() {
    resetToDummy()
    setConfirmReset(false)
    toast.success('Data dummy berhasil dibuat ulang.')
  }

  return (
    <>
      <PageHeader
        title="Tools"
        crumbs={[{ label: 'Lainnya' }, { label: 'Tools' }]}
        description="Utilitas prototype: kelola data dummy, uji state halaman, dan lihat daftar business rule yang masih perlu dikonfirmasi."
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Business rule yang perlu dikonfirmasi"
            subtitle="Sesuai dokumen bagian 23, formula yang belum tervalidasi tidak dikarang — hanya diberi placeholder."
            actions={<Badge tone="warning">{TBD_NOTES.length} item</Badge>}
          />
          <ul className="divide-y divide-grid">
            {TBD_NOTES.map((n) => (
              <li key={n.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="neutral">{n.id}</Badge>
                  <p className="text-[13px] font-semibold text-ink">{n.title}</p>
                </div>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-2">
                  <span className="font-medium text-ink-3">Sekarang:</span> {n.current}
                </p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-ink-2">
                  <span className="font-medium text-ink-3">Perlu dijawab:</span> {n.question}
                </p>
              </li>
            ))}
          </ul>
          <p className="border-t border-hairline px-4 py-2.5 text-[11.5px] text-ink-3">
            Seluruh implementasinya berada di <code className="rounded bg-sunken px-1 py-0.5">src/lib/calculations.ts</code> —
            ganti isi fungsinya saja, halaman lain tidak perlu diubah.
          </p>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Sumber data" subtitle="Dari mana isi aplikasi ini berasal." />
            <div className="space-y-2.5 p-4">
              <div className="rounded-lg border border-[#cfeccf] bg-[#effaef] px-3.5 py-3">
                <p className="text-[12.5px] font-semibold text-[#0a7d0a]">Data operasional sebenarnya</p>
                <p className="mt-1 text-[12px] leading-relaxed text-ink-2">
                  Sopir, Mobil, Project, Route, Trip, Uang Jalan, dan Biaya Operasional berasal dari
                  REKAPAN SHAZA — 241 trip periode 01/06 s/d 21/07/2026.
                </p>
              </div>
              <div className="rounded-lg border border-[#f6e2ac] bg-[#fff8e6] px-3.5 py-3">
                <p className="text-[12.5px] font-semibold text-[#8a6100]">Masih data contoh</p>
                <p className="mt-1 text-[12px] leading-relaxed text-ink-2">
                  SI / Job Order, Data Tagihan, dan Surat Jalan — file operasional tidak memuat ketiganya.
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Isi database" subtitle="Tersimpan di localStorage browser ini." />
            <ul className="divide-y divide-grid">
              {counts.map(([label, n]) => (
                <li key={label} className="flex items-center justify-between px-4 py-2">
                  <span className="text-[13px] text-ink-2">{label}</span>
                  <span className="tnum text-[13px] font-semibold text-ink">{formatNumber(n)}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Aksi" />
            <div className="space-y-2 p-4">
              <Button className="w-full justify-start" icon={<Download size={15} />} onClick={exportJson}>
                Export data dummy (JSON)
              </Button>
              <Button className="w-full justify-start" icon={<RefreshCw size={15} />} onClick={reload}>
                Muat ulang data
              </Button>
              <Button className="w-full justify-start" icon={<TriangleAlert size={15} />} onClick={() => { simulateError(); toast.error('State error disimulasikan.') }}>
                Simulasikan state error
              </Button>
              <Button className="w-full justify-start" icon={<Shuffle size={15} />} disabled={!canEdit} onClick={() => setConfirmSample(true)}>
                Ganti ke data contoh (tanpa data asli)
              </Button>
              <Button className="w-full justify-start" variant="danger" icon={<Database size={15} />} disabled={!canEdit} onClick={() => setConfirmReset(true)}>
                Muat ulang data REKAPAN SHAZA
              </Button>
            </div>
          </Card>

          <Card>
            <CardHeader title="Tentang" />
            <dl className="space-y-2 p-4 text-[12.5px]">
              <div className="flex justify-between gap-3"><dt className="text-ink-3">Sistem</dt><dd className="font-medium text-ink">SIKOTIS — Sistem Komisi Otomatis</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-3">Perusahaan</dt><dd className="font-medium text-ink">PT Bimajaya Mustika</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-3">Versi</dt><dd className="font-medium text-ink">Prototype 0.1</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-3">Data</dt><dd className="font-medium text-ink">Dummy (localStorage)</dd></div>
            </dl>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={confirmReset}
        title="Muat ulang data REKAPAN SHAZA?"
        message="Seluruh perubahan yang Anda buat (tambah / ubah / hapus) akan hilang dan data dikembalikan ke kondisi awal dari file operasional."
        confirmLabel="Muat Ulang"
        onCancel={() => setConfirmReset(false)}
        onConfirm={doReset}
      />

      <ConfirmDialog
        open={confirmSample}
        title="Ganti ke data contoh?"
        message="Seluruh data operasional asli (nama sopir, nomor polisi, dan nominal) akan diganti dengan data buatan. Berguna bila prototype perlu ditunjukkan ke pihak luar. Data asli dapat dimuat ulang kapan saja lewat tombol di bawahnya."
        confirmLabel="Ganti ke Data Contoh"
        tone="primary"
        onCancel={() => setConfirmSample(false)}
        onConfirm={() => { resetToSample(); setConfirmSample(false); toast.success('Beralih ke data contoh.') }}
      />
    </>
  )
}
