/**
 * Isi awal Master Alamat: lokasi pick up / destinasi yang tercantum di kolom
 * "Detail Origin" dan "Detail Address" Summary Submission PI 14 Agustus 2026.
 * Hanya alamat lokasi perusahaan; nama & nomor PIC tidak disalin (diisi admin).
 * Kode area mengikuti kode di nama rute ("CIB - DURI").
 */
import type { Alamat, Project } from '../types'

interface Benih {
  kode_area: string
  nama: string
  alamat: string
  kota: string
  lat_long: string
  id_lokasi_klien?: string
  jenis?: Alamat['jenis']
}

const BENIH: Benih[] = [
  { kode_area: 'CIB', nama: 'Schlumberger Base (CIB)', alamat: 'Kawasan GIIC, Nagasari Terpadu Indonesia-China Kav 17-18', kota: 'Bekasi, Jawa Barat 17330', lat_long: '-6.3925131, 107.160905' },
  { kode_area: 'DURI', nama: 'SLB Duri (Onsite 3782)', alamat: 'Balai Raja, Jl. Raya Duri - Pekanbaru KM 11', kota: 'Duri, Riau 28884', lat_long: '', id_lokasi_klien: '3782' },
  { kode_area: 'KB 575', nama: 'Wellsite O-O-87A (KOTA00575)', alamat: 'O-O-87A (KOTA00575)', kota: 'Riau', lat_long: '0.692841, 101.077517', id_lokasi_klien: 'KOTA00575', jenis: 'penerima' },
  { kode_area: 'RAWA', nama: 'Wellsite RAWA-52', alamat: 'RAWA-52', kota: 'Jambi', lat_long: '-2.657180, 104.095349', id_lokasi_klien: 'RAWA-52', jenis: 'penerima' },
  { kode_area: 'LAMONGAN', nama: 'Lamongan Shorebase', alamat: 'Jl. Raya Daendels KM 64-65, Desa Kemantren, Kec. Paciran', kota: 'Kab. Lamongan, Jawa Timur 62264', lat_long: '-6.8659476, 112.414766' },
  { kode_area: 'BSA', nama: 'PT Besmindotama Semesta', alamat: 'Jl. KH Noor Alie, Kp. Cibuntu RT 02 RW 02, Cibitung', kota: 'Bekasi 17520', lat_long: '-6.232794, 106.98413' },
  { kode_area: 'PUNINAR', nama: 'Puninar', alamat: 'Jl. Reformasi RT 8 / RW 3, Cilincing', kota: 'Jakarta Utara 14120', lat_long: '-6.12830, 106.94100' },
  { kode_area: 'OSES', nama: 'PHE OSES Kalijapat Shorebase', alamat: 'PHE OSES Receiving, Kalijapat Shorebase', kota: 'Jakarta Utara 14310', lat_long: '' },
  { kode_area: 'MEDCO KJP', nama: 'Medco Kalijapat', alamat: 'Jl. Industri 1, Tanjung Priok', kota: 'Jakarta Utara 14310', lat_long: '-6.11436, 106.86580' },
  { kode_area: 'MARUNDA', nama: 'PHE Marunda', alamat: 'RW 2, Cilincing', kota: 'Jakarta Utara 14120', lat_long: '-6.09660, 106.95600' },
  { kode_area: 'RUMBAI', nama: 'SLB Rumbai (Onsite 3785)', alamat: 'Jl. Yos Sudarso No. 18, Muara Fajar, Kec. Rumbai', kota: 'Pekanbaru, Riau 28267', lat_long: '', id_lokasi_klien: '3785' },
  { kode_area: 'BBS', nama: 'Wellsite BBS-19', alamat: 'BBS-19', kota: 'Jawa Barat', lat_long: '-6.248981, 107.315155', id_lokasi_klien: 'BBS-19', jenis: 'penerima' },
  { kode_area: 'JAS', nama: 'Wellsite JAS-034 (JAS-F3)', alamat: 'JAS-034 (JAS-F3)', kota: 'Jawa Barat', lat_long: '-6.278917, 107.880778', id_lokasi_klien: 'JAS-034', jenis: 'penerima' },
  { kode_area: 'CLU', nama: 'Wellsite CLU-023 (CLU-INF4)', alamat: 'CLU-023 (CLU-INF4)', kota: 'Jawa Barat', lat_long: '-6.246371, 107.495704', id_lokasi_klien: 'CLU-023', jenis: 'penerima' },
  { kode_area: 'LM', nama: 'Wellsite L5A-313 (LM-07)', alamat: 'L5A-313 (LM-07)', kota: 'Sumatera Selatan', lat_long: '-3.493188, 104.090958', id_lokasi_klien: 'L5A-313', jenis: 'penerima' },
  { kode_area: 'TPN', nama: 'Wellsite TPN-3', alamat: 'TPN-3', kota: 'Jawa Timur', lat_long: '-7.034679, 111.745978', id_lokasi_klien: 'TPN-3', jenis: 'penerima' },
  { kode_area: 'SECANGGANG', nama: 'Secanggang', alamat: 'Secanggang', kota: 'Sumatera Utara', lat_long: '', jenis: 'penerima' },
  { kode_area: 'WAYANG WINDU', nama: 'Wayang Windu', alamat: 'Wayang Windu', kota: 'Jawa Barat', lat_long: '', jenis: 'penerima' },
]

/** Alamat awal; klien SLB bila ada (seluruh lokasi di Summary PI adalah order SLB). */
export function alamatAwal(projects: Pick<Project, 'id' | 'project_code'>[], stamp: string): Alamat[] {
  const slb = projects.find((p) => p.project_code === 'SLB')?.id ?? ''
  return BENIH.map((b, i) => ({
    id: `alm-${i + 1}`,
    kode_area: b.kode_area,
    nama: b.nama,
    alamat: b.alamat,
    kota: b.kota,
    nama_kontak: '',
    telepon: '',
    project_id: slb,
    jenis: b.jenis ?? 'keduanya',
    lat_long: b.lat_long,
    id_lokasi_klien: b.id_lokasi_klien ?? '',
    catatan: 'Dari Summary Submission PI 14 Agustus 2026.',
    status: 'aktif',
    created_at: stamp,
    updated_at: stamp,
  }))
}
