import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom'
import { Container, FileDown, Pencil, Printer, Trash2 } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { Card, CardHeader, InfoItem } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { OverflowMenu } from '../components/ui/Menu'
import { ConfirmDialog } from '../components/ui/Modal'
import { Badge } from '../components/ui/Badge'
import { SuratJalanPrintFlow } from '../components/report/SuratJalanPrintFlow'
import { useData } from '../store/DataProvider'
import { useAuth } from '../store/AuthProvider'
import { useToast } from '../store/ToastProvider'
import { formatDate, formatDateLong } from '../lib/format'

export function SuratJalanDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { deliveryNoteRows, update, remove, loading } = useData()
  const { canEdit } = useAuth()
  const toast = useToast()

  const note = deliveryNoteRows.find((n) => n.id === id)
  const [printing, setPrinting] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Datang dari "Simpan & Cetak" -> langsung buka Print Settings.
  useEffect(() => {
    if (params.get('print') === '1' && note) {
      setPrinting(true)
      params.delete('print')
      setParams(params, { replace: true })
    }
  }, [params, note, setParams])

  if (loading) {
    return (
      <>
        <PageHeader title="Memuat Surat Jalan..." crumbs={[{ label: 'Transaksi' }, { label: 'Surat Jalan', to: '/transaksi/surat-jalan' }]} />
        <div className="skeleton h-64 rounded-xl" />
      </>
    )
  }

  if (!note) {
    return (
      <>
        <PageHeader title="Surat Jalan tidak ditemukan" crumbs={[{ label: 'Transaksi' }, { label: 'Surat Jalan', to: '/transaksi/surat-jalan' }]} />
        <Card>
          <div className="px-6 py-14 text-center">
            <p className="text-[14px] font-semibold text-ink">Data tidak ditemukan.</p>
            <p className="mt-1 text-[13px] text-ink-3">Surat Jalan mungkin sudah dihapus atau tautannya salah.</p>
            <Button className="mt-4" onClick={() => navigate('/transaksi/surat-jalan')}>Kembali ke daftar</Button>
          </div>
        </Card>
      </>
    )
  }

  function onDelete() {
    remove('deliveryNotes', note!.id)
    toast.success('Data berhasil dihapus.')
    navigate('/transaksi/surat-jalan')
  }

  const shipping: Array<[string, string]> = [
    ['No. Polisi', note.plate_number || '—'],
    ['Party', note.party || '—'],
    ['SI / BL', note.sijo || '—'],
    ['Jenis Brg', note.goods_type || '—'],
    ['Kosongan', note.kosongan || '—'],
    ['Lokasi', note.location || '—'],
    ['Kapal', note.ship || '—'],
    ['Tujuan', note.destination || '—'],
  ]

  return (
    <>
      <PageHeader
        title={`Surat Jalan ${note.sj_no}`}
        description={formatDateLong(note.sj_date)}
        crumbs={[{ label: 'Transaksi' }, { label: 'Surat Jalan', to: '/transaksi/surat-jalan' }, { label: note.sj_no }]}
        actions={
          <>
            <Button icon={<Pencil size={15} />} disabled={!canEdit} onClick={() => navigate(`/transaksi/surat-jalan/${note.id}/edit`)}>
              Edit
            </Button>
            <Button icon={<FileDown size={15} />} onClick={() => setPrinting(true)}>Download PDF</Button>
            <Button variant="primary" icon={<Printer size={15} />} onClick={() => setPrinting(true)}>Cetak</Button>
            <OverflowMenu
              actions={[{ label: 'Hapus Surat Jalan', icon: <Trash2 size={14} />, tone: 'danger', disabled: !canEdit, onSelect: () => setDeleting(true) }]}
            />
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card>
            <CardHeader
              title="Informasi Dokumen"
              actions={note.printed_at ? <Badge tone="good">Tercetak {formatDate(note.printed_at)}</Badge> : <Badge tone="warning">Draft</Badge>}
            />
            <dl className="grid gap-4 p-4 sm:grid-cols-3">
              <InfoItem label="Tanggal" value={formatDate(note.sj_date)} mono />
              <InfoItem label="Nomor Surat Jalan" value={note.sj_no} mono />
              <InfoItem label="No. Container" value={note.containers[0] || '—'} />
            </dl>
          </Card>

          <Card>
            <CardHeader title="Penerima" />
            <dl className="grid gap-4 p-4 sm:grid-cols-2">
              <InfoItem label="Kepada Yth" value={note.recipient_name} />
              <InfoItem
                label="di"
                value={
                  <>
                    {note.recipient_address_1 || '—'}
                    {note.recipient_address_2 && (
                      <>
                        <br />
                        {note.recipient_address_2}
                      </>
                    )}
                  </>
                }
              />
            </dl>
          </Card>

          <Card>
            <CardHeader title="Informasi Pengiriman" />
            <dl className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
              {shipping.map(([label, value]) => (
                <InfoItem
                  key={label}
                  label={label}
                  mono={label === 'No. Polisi' || label === 'SI / BL'}
                  value={
                    label === 'SI / BL' && note.sijo ? (
                      <Link to={`/pencarian/sijo?sijo=${note.sijo}`} className="text-brand-700 hover:underline">
                        {note.sijo}
                      </Link>
                    ) : (
                      value
                    )
                  }
                />
              ))}
            </dl>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader title="Container" subtitle="Satu nomor container per Surat Jalan." />
          <div className="p-4">
            {note.containers.length === 0 ? (
              <p className="py-8 text-center text-[13px] text-ink-3">Belum ada nomor container.</p>
            ) : (
              <ol className="space-y-1.5">
                {note.containers.map((c, i) => (
                  <li key={`${c}-${i}`} className="flex items-center gap-2.5 rounded-md border border-hairline bg-sunken px-3 py-2">
                    <span className="tnum w-5 shrink-0 text-[12px] font-semibold text-ink-3">{i + 1}.</span>
                    <Container size={14} className="shrink-0 text-ink-3" />
                    <span className="tnum text-[13px] font-medium tracking-wide text-ink">{c}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </Card>
      </div>

      <SuratJalanPrintFlow
        notes={[note]}
        open={printing}
        onClose={() => setPrinting(false)}
        onPrinted={(ids) => ids.forEach((i) => update('deliveryNotes', i, { printed_at: new Date().toISOString().slice(0, 10) }))}
      />

      <ConfirmDialog
        open={deleting}
        title="Hapus Surat Jalan?"
        message={
          <>
            Data yang sudah dihapus mungkin tidak dapat dikembalikan.
            <br />
            <span className="mt-2 block font-medium text-ink">{note.sj_no} — {note.recipient_name}</span>
          </>
        }
        onCancel={() => setDeleting(false)}
        onConfirm={onDelete}
      />
    </>
  )
}
