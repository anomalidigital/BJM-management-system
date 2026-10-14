import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { Field, Input } from '../../../components/ui/Field'
import { SearchableSelect } from '../../../components/ui/SearchableSelect'
import type { Option } from '../../../components/ui/SearchableSelect'
import type { Alamat, TitikAlamat } from '../../../types'
import { normalKodeArea } from '../../../lib/trip'

/** Nilai pilihan untuk titik trip lama yang dulu diketik manual (belum ada di Master Alamat). */
export const TITIK_LAMA = '__lama'

/** Alamat lengkap satu baris: "Jl. ..., Bekasi". */
export const tulisAlamat = (a: Pick<Alamat, 'alamat' | 'kota'>) => [a.alamat, a.kota].map((s) => (s ?? '').trim()).filter(Boolean).join(', ')

/** Label pilihan alamat seperti mock atasan: "PT SLB LAMPUNG | CONTACT: BP IRAWAN 0877…". */
export function labelAlamat(nama: string, kontak?: string, telepon?: string): string {
  const kontaknya = [kontak, telepon].map((s) => (s ?? '').trim()).filter(Boolean).join(' ')
  return kontaknya ? `${nama} | CONTACT: ${kontaknya}` : nama
}

/**
 * Salinan titik dengan susunan isian tetap (alamat_id, nama, alamat, kontak, telepon, catatan). Audit Log
 * membandingkan isi record apa adanya, jadi salinan yang sama tidak boleh beda urutan.
 */
export function titikRapi(t: TitikAlamat | undefined): TitikAlamat | undefined {
  if (!t) return undefined
  const catatan = (t.catatan ?? '').trim()
  return {
    ...(t.alamat_id ? { alamat_id: t.alamat_id } : {}),
    nama: (t.nama ?? '').trim(), alamat: (t.alamat ?? '').trim(), kontak: (t.kontak ?? '').trim(), telepon: (t.telepon ?? '').trim(),
    ...(catatan ? { catatan } : {}),
  }
}

/** Dua salinan titik sama isinya? (urutan isian diabaikan) */
export const samaTitik = (a: TitikAlamat | undefined, b: TitikAlamat | undefined) =>
  JSON.stringify(titikRapi(a) ?? null) === JSON.stringify(titikRapi(b) ?? null)

/** Salinan Master Alamat untuk trip, beserta catatan khusus trip ini. */
export function titikDariAlamat(a: Alamat, catatan: string): TitikAlamat {
  return titikRapi({ alamat_id: a.id, nama: a.nama, alamat: tulisAlamat(a), kontak: a.nama_kontak, telepon: a.telepon, catatan })!
}

/** Isi titik ada? (data lama boleh hanya berisi sebagian) */
export const titikTerisi = (t: TitikAlamat | undefined) => !!t && !!(t.nama || t.alamat || t.kontak || t.telepon)

/** Kode area sama, tanpa beda huruf besar / nomor site ("RAWA 52" = RAWA). */
export const samaArea = (a: string, b: string) => !!a && !!b && normalKodeArea(a) === normalKodeArea(b)

/**
 * Pick Up Details / Destination Details form trip (mock 1b): pilih alamat tersimpan berlabel
 * "NAMA | CONTACT: kontak telp". Alamat di area rute tampil paling atas. Belum ada? Baris
 * pertama daftar = "Tambah alamat" (cari dulu, tambah bila tidak ketemu). Di bawahnya catatan
 * khusus trip ini.
 */
export function PilihAlamatTrip({
  label, hint, nilai, onChange, catatan, onCatatan, labelCatatan, placeholderCatatan, daftar, area, titikLama, onTambah,
  bolehTambah, disabled,
}: {
  label: string
  hint: ReactNode
  /** Id Master Alamat, TITIK_LAMA, atau kosong. */
  nilai: string
  onChange: (v: string) => void
  catatan: string
  onCatatan: (v: string) => void
  labelCatatan: string
  placeholderCatatan: string
  daftar: Alamat[]
  /** Kode area rute di sisi ini (pick up / destinasi): alamatnya tampil paling atas. */
  area: string
  /** Titik trip lama yang diketik manual: tetap bisa dipertahankan. */
  titikLama?: TitikAlamat
  /** Buka form Tambah Alamat dengan ketikan pencarian sebagai nama lokasi. */
  onTambah: (query: string) => void
  bolehTambah: boolean
  disabled?: boolean
}) {
  const opsi = useMemo<Option[]>(() => {
    const dipakai = daftar
      .filter((a) => a.status === 'aktif' || a.id === nilai)
      .sort((a, b) => Number(samaArea(b.kode_area, area)) - Number(samaArea(a.kode_area, area)) || a.nama.localeCompare(b.nama, 'id'))
      .map((a) => ({
        value: a.id,
        label: labelAlamat(a.nama, a.nama_kontak, a.telepon),
        meta: [samaArea(a.kode_area, area) ? `Area rute ${a.kode_area}` : a.kode_area ? `Area ${a.kode_area}` : '', tulisAlamat(a)].filter(Boolean).join(' · '),
        keywords: `${a.kode_area} ${a.kota} ${a.catatan}`,
      }))
    if (titikLama) {
      dipakai.unshift({ value: TITIK_LAMA, label: labelAlamat(titikLama.nama || 'Tanpa nama', titikLama.kontak, titikLama.telepon), meta: [titikLama.alamat, 'isian lama, belum di Master Alamat'].filter(Boolean).join(' · '), keywords: '' })
    }
    return dipakai
  }, [daftar, nilai, area, titikLama])

  return (
    <div className="space-y-2.5">
      <Field label={label} hint={hint}>
        {(fid) => (
          <SearchableSelect id={fid} options={opsi} value={nilai || null} disabled={disabled}
            placeholder="Pilih alamat tersimpan..." searchPlaceholder="Cari nama lokasi, kontak, atau kota..."
            emptyText="Alamat belum ada. Tambahkan lewat baris paling atas."
            onChange={(v) => onChange(v ?? '')}
            tambahan={{
              label: (q) => (q.trim() ? `Tambah alamat “${q.trim()}”` : 'Tambah alamat baru'),
              onClick: onTambah,
              disabled: !bolehTambah,
              hint: bolehTambah ? undefined : 'Perlu izin ubah data master.',
            }} />
        )}
      </Field>
      <Field label={labelCatatan}>
        {(fid) => <Input id={fid} value={catatan} disabled={disabled} placeholder={placeholderCatatan} onChange={(e) => onCatatan(e.target.value)} />}
      </Field>
    </div>
  )
}
