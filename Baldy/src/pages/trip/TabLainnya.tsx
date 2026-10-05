import { useMemo, useState } from 'react'
import { FaPen, FaTrashCan } from '../../components/ui/icons'
import { Button, IconButton } from '../../components/ui/Button'
import { Modal, ConfirmDialog } from '../../components/ui/Modal'
import { Field, Input, DateInput, Textarea } from '../../components/ui/Field'
import { LampiranInput, LampiranThumbs } from '../../components/ui/Lampiran'
import { useData } from '../../store/DataProvider'
import { useToast } from '../../store/ToastProvider'
import { hapusLampiran } from '../../lib/lampiran'
import { formatDate } from '../../lib/format'
import type { TransactionRow, TripNote } from '../../types'
import { KepalaTab, KepalaTabel, KosongTab, PesanGalat } from './bagian'

type Form = Pick<TripNote, 'note_date' | 'title' | 'notes' | 'attachments'>

/** Tab Lainnya (dulu Dokumen): berkas, gambar, atau catatan apa pun untuk trip ini. */
export function TabLainnya({ trip, bisaUbah }: { trip: TransactionRow; bisaUbah: boolean }) {
  const { dbAll, create, update, remove } = useData()
  const toast = useToast()

  const [terbuka, setTerbuka] = useState(false)
  const [editing, setEditing] = useState<TripNote | null>(null)
  const [form, setForm] = useState<Form>({ note_date: '', title: '', notes: '', attachments: [] })
  const [galat, setGalat] = useState<string | null>(null)
  const [menghapus, setMenghapus] = useState<TripNote | null>(null)

  const catatan = useMemo(
    () => dbAll.tripNotes.filter((n) => n.trip_id === trip.id).sort((a, b) => b.note_date.localeCompare(a.note_date) || b.created_at.localeCompare(a.created_at)),
    [dbAll.tripNotes, trip.id],
  )

  function buka(n?: TripNote) {
    setEditing(n ?? null)
    setForm(n
      ? { note_date: n.note_date, title: n.title, notes: n.notes, attachments: n.attachments ?? [] }
      : { note_date: trip.transaction_date, title: '', notes: '', attachments: [] })
    setGalat(null); setTerbuka(true)
  }

  function simpan() {
    if (!form.title.trim()) { setGalat('Judul wajib diisi.'); return }
    if (!form.note_date) { setGalat('Tanggal wajib diisi.'); return }
    const isi = { ...form, title: form.title.trim(), notes: form.notes.trim() }
    if (editing) { update('tripNotes', editing.id, isi); toast.success('Catatan berhasil diperbarui.') }
    else { create('tripNotes', { ...isi, trip_id: trip.id }); toast.success('Catatan berhasil ditambahkan.') }
    setTerbuka(false)
  }

  function hapus() {
    if (!menghapus) return
    remove('tripNotes', menghapus.id)
    void hapusLampiran(menghapus.attachments ?? [])
    toast.success('Catatan berhasil dihapus.')
    setMenghapus(null)
  }

  return (
    <div>
      <KepalaTab
        keterangan="Simpan berkas, foto, atau catatan apa pun yang menyertai trip ini — mis. foto segel, tanda terima, atau kronologi di jalan."
        tombol="Tambah Catatan"
        bisaUbah={bisaUbah}
        onTambah={() => buka()}
      />
      {catatan.length === 0 ? (
        <KosongTab
          judul="Belum ada catatan lain."
          keterangan="Unggah berkas atau tulis catatan untuk trip ini."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-max text-[13px]">
            <KepalaTabel kolom={[{ label: 'Tanggal' }, { label: 'Judul' }, { label: 'Catatan' }, { label: 'Berkas' }, { label: 'Action', kanan: true }]} />
            <tbody>
              {catatan.map((n) => (
                <tr key={n.id} className="border-b border-grid align-top last:border-0 hover:bg-sunken">
                  <td className="tnum px-3 py-2.5 whitespace-nowrap text-ink-2">{formatDate(n.note_date)}</td>
                  <td className="px-3 py-2.5 font-medium text-ink">{n.title}</td>
                  <td className="max-w-md px-3 py-2.5 whitespace-pre-line text-ink-2">{n.notes || <span className="text-ink-3">—</span>}</td>
                  <td className="px-3 py-2.5"><LampiranThumbs ids={n.attachments ?? []} ukuran={40} /></td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="flex justify-end gap-1">
                      <IconButton label="Ubah" icon={<FaPen size={14} />} disabled={!bisaUbah} onClick={() => buka(n)} />
                      <IconButton label="Hapus" tone="danger" icon={<FaTrashCan size={14} />} disabled={!bisaUbah} onClick={() => setMenghapus(n)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={terbuka}
        onClose={() => setTerbuka(false)}
        title={editing ? 'Ubah Catatan' : 'Tambah Catatan'}
        subtitle={`Trip ${trip.transaction_no}`}
        size="md"
        footer={
          <>
            <Button onClick={() => setTerbuka(false)}>Batal</Button>
            <Button variant="primary" onClick={simpan}>Simpan</Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Judul" required className="sm:col-span-2">
            {(fid) => <Input id={fid} value={form.title} placeholder="Foto segel container" onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />}
          </Field>
          <Field label="Tanggal" required>
            {(fid) => <DateInput id={fid} value={form.note_date} onChange={(e) => setForm((f) => ({ ...f, note_date: e.target.value }))} />}
          </Field>
          <Field label="Catatan" className="sm:col-span-3">
            {(fid) => <Textarea id={fid} rows={4} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />}
          </Field>
          <Field label="Berkas" className="sm:col-span-3" hint="Gambar, PDF, atau berkas lain. Foto diperkecil otomatis.">
            {(fid) => <LampiranInput id={fid} accept="" label="Tambah berkas" value={form.attachments} onChange={(v) => setForm((f) => ({ ...f, attachments: v }))} />}
          </Field>
          <div className="sm:col-span-3"><PesanGalat>{galat}</PesanGalat></div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!menghapus}
        title="Hapus catatan?"
        message={`"${menghapus?.title}" akan dihapus beserta ${menghapus?.attachments?.length ?? 0} berkasnya.`}
        onCancel={() => setMenghapus(null)}
        onConfirm={hapus}
      />
    </div>
  )
}
