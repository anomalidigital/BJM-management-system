import { useMemo, useState } from 'react'
import { FaBan, FaCircleCheck, FaCircleInfo, FaPen, FaUserPlus } from '../components/ui/icons'
import { PageHeader } from '../components/layout/PageHeader'
import { Card, CardHeader } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Button, IconButton } from '../components/ui/Button'
import { ConfirmDialog, Modal } from '../components/ui/Modal'
import { Checkbox, Field, Input, Select } from '../components/ui/Field'
import { IZIN, useAuth } from '../store/AuthProvider'
import { useData } from '../store/DataProvider'
import { useToast } from '../store/ToastProvider'
import { bedaRecord } from '../lib/audit'
import { formatPrintedAt } from '../lib/format'
import { cn } from '../lib/utils'
import { ROLE_PENGGUNA } from '../types'
import type { Pengguna, Role } from '../types'

/** Kolom matriks: tiga peran dari meeting. Viewer tidak punya izin ubah apa pun. */
const PERAN_MATRIKS: Role[] = ['owner', 'manager', 'admin']
/** Urutan peran di daftar akun & pilihan form. */
const SEMUA_PERAN: Role[] = ['owner', 'manager', 'admin', 'viewer']
/** Username: huruf kecil, angka, titik, garis bawah, atau tanda minus; 3–32 karakter, tanpa spasi. */
const POLA_USERNAME = /^[a-z0-9._-]{3,32}$/

type IsiAkun = Pick<Pengguna, 'username' | 'name' | 'role' | 'aktif'>

const NADA_PERAN: Record<Role, 'brand' | 'good' | 'neutral' | 'warning'> = { owner: 'warning', manager: 'brand', admin: 'good', viewer: 'neutral' }

/**
 * Pengaturan -> Pengguna & Peran.
 * Bagian Akun: siapa saja yang boleh masuk dan perannya. Hanya Owner (bisa('pengguna')) yang
 * menambah, mengubah, menonaktifkan, atau mengaktifkan akun; perubahannya tercatat di Audit Log.
 * Bagian Izin: matriks yang sama dengan yang dipakai seluruh halaman lewat useAuth().bisa(),
 * jadi aksi baru di IZIN otomatis ikut tampil.
 */
export function PeranPage() {
  const { user, pengguna, simpanPengguna, bisa } = useAuth()
  const { catatAudit } = useData()
  const toast = useToast()
  const boleh = bisa('pengguna')
  const saya = user?.username.toLowerCase() ?? ''

  const [form, setForm] = useState<{ edit: Pengguna | null } | null>(null)
  const [menonaktifkan, setMenonaktifkan] = useState<Pengguna | null>(null)

  const akun = useMemo(
    () => [...pengguna].sort((a, b) => SEMUA_PERAN.indexOf(a.role) - SEMUA_PERAN.indexOf(b.role) || a.username.localeCompare(b.username)),
    [pengguna],
  )
  const ownerAktif = pengguna.filter((p) => p.role === 'owner' && p.aktif)
  /** Owner aktif terakhir: tidak boleh dinonaktifkan atau diturunkan perannya. */
  const ownerTerakhir = (p: Pengguna) => p.role === 'owner' && p.aktif && ownerAktif.length <= 1
  const akunSaya = (p: Pengguna) => p.username.toLowerCase() === saya

  /** Alasan akun ini tidak bisa dinonaktifkan; kosong = boleh. */
  function alasanTidakBisaNonaktif(p: Pengguna): string {
    if (akunSaya(p)) return 'Akun yang sedang dipakai tidak bisa dinonaktifkan.'
    if (ownerTerakhir(p)) return 'Owner aktif terakhir tidak bisa dinonaktifkan: harus ada minimal satu Owner aktif.'
    return ''
  }

  function simpan(isi: IsiAkun, lama: Pengguna | null) {
    const label = `${isi.name} (${isi.username})`
    if (lama) {
      const perubahan = bedaRecord(lama, isi)
      if (perubahan.length === 0) { toast.info('Tidak ada yang berubah.'); setForm(null); return }
      simpanPengguna(isi, lama.username)
      catatAudit({
        aksi: 'ubah', entitas: 'pengguna', entity_id: isi.username, label,
        ringkasan: `Mengubah akun ${lama.username}: ${perubahan.map((x) => x.field).join(', ')}`, perubahan,
      })
      toast.success(`Akun ${isi.username} diperbarui.`)
    } else {
      simpanPengguna(isi)
      catatAudit({ aksi: 'buat', entitas: 'pengguna', entity_id: isi.username, label, ringkasan: `Menambah akun ${isi.username} sebagai ${ROLE_PENGGUNA[isi.role].label}` })
      toast.success(`Akun ${isi.username} (${ROLE_PENGGUNA[isi.role].label}) ditambahkan.`)
    }
    setForm(null)
  }

  function ubahAktif(p: Pengguna, aktif: boolean) {
    const isi: IsiAkun = { username: p.username, name: p.name, role: p.role, aktif }
    simpanPengguna(isi, p.username)
    catatAudit({
      aksi: 'ubah', entitas: 'pengguna', entity_id: p.username, label: `${p.name} (${p.username})`,
      ringkasan: `${aktif ? 'Mengaktifkan' : 'Menonaktifkan'} akun ${p.username}`, perubahan: bedaRecord(p, { aktif }),
    })
    toast.success(aktif ? `Akun ${p.username} aktif kembali dan bisa masuk.` : `Akun ${p.username} dinonaktifkan. Akun ini tidak bisa masuk sampai diaktifkan lagi.`)
  }

  return (
    <>
      <PageHeader
        title="Pengguna & Peran"
        crumbs={[{ label: 'Pengaturan' }, { label: 'Pengguna & Peran' }]}
        description="Akun yang boleh masuk dan izin tiap peran. Peran melekat pada akun, bukan dipilih saat masuk. Hanya Owner yang bisa menambah atau mengubah akun."
        actions={
          <Button variant="primary" icon={<FaUserPlus size={15} />} disabled={!boleh} onClick={() => setForm({ edit: null })}
            title={boleh ? undefined : 'Hanya Owner yang bisa menambah akun'}>
            Tambah Akun
          </Button>
        }
      />

      <div className="grid items-start gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Akun"
            subtitle={`${pengguna.filter((p) => p.aktif).length} aktif dari ${pengguna.length} akun.${boleh ? '' : ' Anda hanya bisa melihat daftar ini.'}`}
          />
          <ul className="divide-y divide-grid">
            {akun.map((p) => {
              const alasan = alasanTidakBisaNonaktif(p)
              return (
                <li key={p.username} className={cn('flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3', !p.aktif && 'bg-sunken')}>
                  <div className="min-w-0 flex-1" style={{ minWidth: 170 }}>
                    <p className={cn('text-[13px] font-semibold', p.aktif ? 'text-ink' : 'text-ink-3')}>
                      {p.name}
                      {akunSaya(p) && <span className="ml-1.5 text-[11.5px] font-normal text-ink-3">(Anda)</span>}
                    </p>
                    <p className="text-[12px] text-ink-3">
                      Username <span className="tnum font-medium text-ink-2">{p.username}</span>
                      {p.updated_at && <span className="ml-1.5">· diubah {formatPrintedAt(new Date(p.updated_at))}</span>}
                    </p>
                  </div>
                  <div className="min-w-0" style={{ minWidth: 150 }}>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge tone={NADA_PERAN[p.role]}>{ROLE_PENGGUNA[p.role]?.label ?? p.role}</Badge>
                      {p.aktif ? <Badge tone="good">Aktif</Badge> : <Badge tone="neutral">Nonaktif</Badge>}
                    </div>
                    <p className="mt-1 text-[11.5px] text-ink-3">{ROLE_PENGGUNA[p.role]?.ringkas}</p>
                  </div>
                  <div className="ml-auto flex shrink-0 gap-1">
                    <IconButton label={boleh ? `Ubah akun ${p.username}` : 'Hanya Owner yang bisa mengubah akun'} icon={<FaPen size={14} />} disabled={!boleh}
                      onClick={() => setForm({ edit: p })} />
                    {p.aktif ? (
                      <IconButton label={!boleh ? 'Hanya Owner yang bisa menonaktifkan akun' : alasan || `Nonaktifkan akun ${p.username}`} tone="danger"
                        icon={<FaBan size={14} />} disabled={!boleh || !!alasan} onClick={() => setMenonaktifkan(p)} />
                    ) : (
                      <IconButton label={boleh ? `Aktifkan lagi akun ${p.username}` : 'Hanya Owner yang bisa mengaktifkan akun'} icon={<FaCircleCheck size={14} />}
                        disabled={!boleh} onClick={() => ubahAktif(p, true)} />
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
          <div className="flex items-start gap-2 border-t border-hairline bg-sunken px-4 py-3 text-[12px] leading-relaxed text-ink-2">
            <FaCircleInfo size={14} className="mt-0.5 shrink-0 text-brand-600" />
            <div>
              <p>
                <span className="font-semibold text-ink">Sandi belum disimpan:</span> login masih simulasi sampai terhubung ke API backend
                (<code className="rounded bg-surface px-1 py-0.5 text-[11.5px]">POST /api/v1/auth/public/login</code>).
              </p>
              <p className="mt-1 text-ink-3">
                Selama simulasi, sandi bebas (minimal 4 karakter) dan username yang tidak terdaftar masuk sebagai Admin. Akun nonaktif tidak bisa masuk.
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Izin per peran"
            subtitle={`Anda masuk sebagai ${user ? ROLE_PENGGUNA[user.role]?.label ?? user.role : '—'}. Viewer hanya melihat dan export.`}
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-[12.5px]">
              <thead>
                <tr className="border-b border-hairline text-ink-3">
                  <th className="px-4 py-2 text-left font-medium">Aksi</th>
                  {PERAN_MATRIKS.map((r) => <th key={r} className="w-20 px-2 py-2 text-center font-medium">{ROLE_PENGGUNA[r].label}</th>)}
                </tr>
              </thead>
              <tbody>
                {Object.entries(IZIN).map(([aksi, izin]) => (
                  <tr key={aksi} className="border-b border-grid last:border-0">
                    <td className="px-4 py-2 text-ink-2">{izin.label}</td>
                    {PERAN_MATRIKS.map((r) => (
                      <td key={r} className="px-2 py-2 text-center">
                        {izin.peran.includes(r)
                          ? <span className="font-semibold text-[#0a7d0a]" aria-label="boleh">✓</span>
                          : <span className="text-ink-3" aria-label="tidak boleh">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {form && (
        <ModalAkun
          edit={form.edit}
          pengguna={pengguna}
          akunSaya={form.edit ? akunSaya(form.edit) : false}
          ownerTerakhir={form.edit ? ownerTerakhir(form.edit) : false}
          onClose={() => setForm(null)}
          onSimpan={(isi) => simpan(isi, form.edit)}
        />
      )}

      <ConfirmDialog
        open={!!menonaktifkan}
        title="Nonaktifkan akun?"
        message={
          <>
            <span className="block font-medium text-ink">{menonaktifkan?.name} ({menonaktifkan?.username})</span>
            <span className="mt-1 block">Akun ini tidak bisa masuk lagi sampai diaktifkan kembali. Data yang pernah dibuatnya tetap tersimpan.</span>
          </>
        }
        confirmLabel="Nonaktifkan"
        onCancel={() => setMenonaktifkan(null)}
        onConfirm={() => { if (menonaktifkan) ubahAktif(menonaktifkan, false); setMenonaktifkan(null) }}
      />
    </>
  )
}

/** Tambah / ubah satu akun. Username unik; akun sendiri & Owner aktif terakhir tidak bisa diturunkan atau dinonaktifkan. */
function ModalAkun({ edit, pengguna, akunSaya, ownerTerakhir, onClose, onSimpan }: {
  edit: Pengguna | null
  pengguna: Pengguna[]
  akunSaya: boolean
  ownerTerakhir: boolean
  onClose: () => void
  onSimpan: (isi: IsiAkun) => void
}) {
  const [isi, setIsi] = useState<IsiAkun>(() => edit
    ? { username: edit.username, name: edit.name, role: edit.role, aktif: edit.aktif }
    : { username: '', name: '', role: 'admin', aktif: true })
  const [galat, setGalat] = useState<Partial<Record<'username' | 'name' | 'role' | 'aktif', string>>>({})
  const kunciPeran = akunSaya || ownerTerakhir
  const kunciAktif = akunSaya || ownerTerakhir

  function simpan() {
    const g: typeof galat = {}
    const username = isi.username.trim().toLowerCase()
    if (!username) g.username = 'Username wajib diisi.'
    else if (!POLA_USERNAME.test(username)) g.username = 'Gunakan 3–32 huruf kecil, angka, titik, garis bawah, atau tanda minus, tanpa spasi.'
    else if (pengguna.some((p) => p.username.toLowerCase() === username && p.username.toLowerCase() !== edit?.username.toLowerCase())) {
      g.username = 'Username ini sudah dipakai akun lain.'
    }
    if (!isi.name.trim()) g.name = 'Nama wajib diisi.'
    if (ownerTerakhir && isi.role !== 'owner') g.role = 'Harus ada minimal satu Owner aktif.'
    if (kunciAktif && !isi.aktif) g.aktif = akunSaya ? 'Akun yang sedang dipakai tidak bisa dinonaktifkan.' : 'Harus ada minimal satu Owner aktif.'
    setGalat(g)
    if (Object.keys(g).length > 0) return
    onSimpan({ username, name: isi.name.trim(), role: isi.role, aktif: isi.aktif })
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={edit ? 'Ubah Akun' : 'Tambah Akun'}
      subtitle={edit ? `Username ${edit.username}` : 'Tanda * wajib diisi. Sandi diatur setelah terhubung ke backend.'}
      size="sm"
      footer={
        <>
          <Button onClick={onClose}>Batal</Button>
          <Button variant="primary" onClick={simpan}>{edit ? 'Simpan Perubahan' : 'Simpan'}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Username" required error={galat.username} hint="Dipakai untuk masuk. Huruf kecil tanpa spasi, mis. admin.krw">
          {(fid) => (
            <Input id={fid} value={isi.username} invalid={!!galat.username} autoComplete="off" spellCheck={false} placeholder="admin.krw"
              onChange={(e) => setIsi((f) => ({ ...f, username: e.target.value }))} />
          )}
        </Field>
        <Field label="Nama" required error={galat.name}>
          {(fid) => (
            <Input id={fid} value={isi.name} invalid={!!galat.name} placeholder="Nama lengkap pemakai akun"
              onChange={(e) => setIsi((f) => ({ ...f, name: e.target.value }))} />
          )}
        </Field>
        <Field label="Peran" required error={galat.role}
          hint={akunSaya ? 'Peran akun Anda sendiri tidak bisa diubah di sini, supaya tidak terkunci. Minta Owner lain bila perlu.'
            : ownerTerakhir ? 'Owner aktif terakhir: peran tetap Owner supaya selalu ada yang bisa mengatur pengguna.'
            : ROLE_PENGGUNA[isi.role]?.ringkas}>
          {(fid) => (
            <Select id={fid} value={isi.role} disabled={kunciPeran} onChange={(e) => setIsi((f) => ({ ...f, role: e.target.value as Role }))}>
              {SEMUA_PERAN.map((r) => <option key={r} value={r}>{ROLE_PENGGUNA[r].label} — {ROLE_PENGGUNA[r].ringkas}</option>)}
            </Select>
          )}
        </Field>
        <div>
          <Checkbox label="Akun aktif (bisa masuk)" checked={isi.aktif} disabled={kunciAktif}
            onChange={(e) => setIsi((f) => ({ ...f, aktif: e.target.checked }))} />
          {galat.aktif
            ? <p className="mt-1 text-[12px] font-medium text-[color:var(--color-critical)]">{galat.aktif}</p>
            : kunciAktif && <p className="mt-1 text-[12px] text-ink-3">{akunSaya ? 'Akun yang sedang dipakai tidak bisa dinonaktifkan.' : 'Owner aktif terakhir tidak bisa dinonaktifkan.'}</p>}
        </div>
      </div>
    </Modal>
  )
}
