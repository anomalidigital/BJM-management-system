const pptx = require('pptxgenjs')
const path = require('path')

const P = 'Z:/Projects/BJM_260812/presentasi'
const B = path.join(P, 'BEFORE - tampilan lama')
const A = path.join(P, 'AFTER - tampilan baru')
const BRAND = path.join(P, 'ASSET BRANDING UNTUK PPT')
const TPL = 'C:/Users/baldy/AppData/Local/Temp/claude/Z--Projects-BJM-260812/a2f390e9-9b8a-40c6-88e2-4997885d976f/scratchpad/tpl'

const ORANGE = 'F37721'
const INK    = '1C1A18'
const INK2   = '5A5450'
const MUTED  = '9A938C'
const CREAM  = 'FDF6EF'
const CARD   = 'F7F1EA'
const LIGHT  = 'F5F6F7'
const LINE   = 'E6DED5'
const LINE2  = 'E2E5E8'
const W = 13.333

const pres = new pptx()
pres.layout = 'LAYOUT_WIDE'
pres.author = 'Anomali Studio'
pres.company = 'Anomali Studio'
pres.title = 'SIKOTIS — Sebelum & Sesudah'

const F = 'Poppins'

const eyebrow = (s, t, x, y) => s.addText(t, {
  x, y, w: 8, h: 0.28, fontFace: F, fontSize: 10, bold: true,
  color: ORANGE, charSpacing: 1.6, margin: 0,
})
const logo = (s) => s.addImage({ path: path.join(BRAND, 'logo-anomali.png'), x: 12.05, y: 6.85, w: 0.92, h: 0.34 })

/* ── 1. Sampul ─────────────────────────────────────────────── */
{
  const s = pres.addSlide()
  s.background = { color: CREAM }
  s.addImage({ path: path.join(TPL, 'image1.png'), x: 0, y: 6.55, w: W, h: 0.95 })
  s.addImage({ path: path.join(BRAND, 'logo-anomali.png'), x: 0.85, y: 0.7, w: 1.45, h: 0.53 })
  eyebrow(s, 'REDESIGN SISTEM OPERASIONAL', 0.85, 1.9)
  s.addText('SIKOTIS', { x: 0.85, y: 2.2, w: 11, h: 1.2, fontFace: F, fontSize: 62, bold: true, color: INK, margin: 0 })
  s.addText('Dari aplikasi desktop lama menjadi sistem manajemen berbasis web.', {
    x: 0.85, y: 3.42, w: 9.4, h: 0.5, fontFace: F, fontSize: 17, color: INK2, margin: 0 })

  const meta = [['CLIENT', 'PT Bimajaya Mustika'], ['SCOPE', 'Audit & Rebuild'], ['OWNER', 'Anomali Studio'], ['DATE', 'Agustus 2026']]
  meta.forEach(([k, v], i) => {
    const x = 0.85 + i * 2.95
    s.addText(k, { x, y: 4.62, w: 2.8, h: 0.24, fontFace: F, fontSize: 9, bold: true, color: ORANGE, charSpacing: 1.4, margin: 0 })
    s.addText(v, { x, y: 4.9, w: 2.85, h: 0.34, fontFace: F, fontSize: 13.5, color: INK, margin: 0 })
  })
  s.addNotes('Pembuka. Sebutkan bahwa seluruh angka pada presentasi ini berasal dari data operasional yang diberikan client, bukan contoh.')
}

/* ── 2. Kenapa lebih mudah dipakai ─────────────────────────── */
{
  const s = pres.addSlide()
  s.background = { color: 'FFFFFF' }
  eyebrow(s, 'RINGKASAN', 0.72, 0.48)
  s.addText('Lebih mudah dipakai sehari-hari', { x: 0.72, y: 0.76, w: 11.5, h: 0.66, fontFace: F, fontSize: 32, bold: true, color: INK, margin: 0 })
  s.addText('Fungsinya sama seperti sistem lama. Yang berubah adalah jumlah langkah yang harus dilakukan petugas untuk menyelesaikan satu pekerjaan.',
    { x: 0.72, y: 1.46, w: 11.3, h: 0.6, fontFace: F, fontSize: 13.5, color: INK2, margin: 0 })

  const kartu = [
    ['Tidak lagi buka-tutup jendela',
     'Menu tetap di sisi kiri dan isinya berganti di tempat. Petugas tidak perlu menutup satu jendela untuk membuka jendela lain seperti sebelumnya.'],
    ['Cari tanpa harus hafal kode',
     'Ketik sebagian nama sopir, nomor polisi, atau nomor dokumen — daftar langsung menyusut. Tidak perlu menggulir satu per satu.'],
    ['Angka langsung terbaca',
     'Nominal tampil dalam format Rupiah dengan total di bawah tabel. Tidak ada lagi penjumlahan manual di kertas atau kalkulator.'],
    ['Hasil cetak terlihat lebih dulu',
     'Dokumen A4 ditampilkan persis seperti hasil cetaknya sebelum tombol Print ditekan, sehingga kertas tidak terbuang.'],
  ]
  kartu.forEach(([j, d], i) => {
    const x = 0.72 + (i % 2) * 6.1
    const y = 2.34 + Math.floor(i / 2) * 1.92
    s.addShape(pres.ShapeType.roundRect, { x, y, w: 5.7, h: 1.68, fill: { color: CARD }, line: { color: LINE, width: 1 }, rectRadius: 0.1 })
    s.addText(String(i + 1).padStart(2, '0'), { x: x + 0.32, y: y + 0.24, w: 0.62, h: 0.34, fontFace: F, fontSize: 13, bold: true, color: ORANGE, margin: 0 })
    s.addText(j, { x: x + 1.0, y: y + 0.22, w: 4.5, h: 0.36, fontFace: F, fontSize: 14.5, bold: true, color: INK, margin: 0 })
    s.addText(d, { x: x + 1.0, y: y + 0.62, w: 4.45, h: 0.92, fontFace: F, fontSize: 11.5, color: INK2, margin: 0, valign: 'top' })
  })

  s.addText('Sekaligus menampung yang selama ini di luar sistem: Rp 993 juta uang jalan dalam 343 termin pembayaran, dan Rp 103 juta biaya operasional.',
    { x: 0.72, y: 6.38, w: 11.2, h: 0.4, fontFace: F, fontSize: 12, bold: true, color: INK, margin: 0 })
  logo(s)
}

/* Dimensi asli tiap gambar, agar bingkai mengikuti rasio gambar
   dan tidak ada yang gepeng maupun terkurung ruang kosong. */
const DIM = require(path.join(P, 'dimensi.json'))
const fit = (file, maxW, maxH) => {
  const d = DIM[file]
  if (!d) return { w: maxW, h: maxH }
  const skala = Math.min(maxW / d[0], maxH / d[1])
  return { w: +(d[0] * skala).toFixed(3), h: +(d[1] * skala).toFixed(3) }
}

/* ── Pembuka bagian ────────────────────────────────────────── */
const sectionOpener = (nomor, judul, pesan) => {
  const s = pres.addSlide()
  s.background = { color: CREAM }
  s.addImage({ path: path.join(TPL, 'image5.png'), x: 0, y: 6.65, w: W, h: 0.85 })
  eyebrow(s, `${nomor} — BAGIAN`, 0.85, 2.2)
  s.addText(judul, { x: 0.85, y: 2.52, w: 11.2, h: 1.15, fontFace: F, fontSize: 40, bold: true, color: INK, margin: 0 })
  s.addText('PESAN UTAMA', { x: 0.85, y: 4.15, w: 4, h: 0.24, fontFace: F, fontSize: 9, bold: true, color: ORANGE, charSpacing: 1.4, margin: 0 })
  s.addText(pesan, { x: 0.85, y: 4.44, w: 9.6, h: 0.72, fontFace: F, fontSize: 14.5, color: INK2, margin: 0 })
}

/* ── Halaman perbandingan ──────────────────────────────────── */
const banding = (judul, sub, fBefore, fAfter, kBefore, kAfter, catatan) => {
  const s = pres.addSlide()
  s.background = { color: 'FFFFFF' }
  eyebrow(s, 'SEBELUM & SESUDAH', 0.62, 0.4)
  s.addText(judul, { x: 0.62, y: 0.68, w: 8.6, h: 0.56, fontFace: F, fontSize: 26, bold: true, color: INK, margin: 0 })
  s.addText(sub, { x: 0.62, y: 1.26, w: 12.1, h: 0.32, fontFace: F, fontSize: 12.5, color: INK2, margin: 0 })

  const KOL_W = 5.79, AREA_H = 3.34, TOP = 2.16
  const kolom = [
    { x: 0.62, label: 'SEBELUM', warna: MUTED, file: fBefore, dir: B, cap: kBefore, bg: LIGHT },
    { x: 6.92, label: 'SESUDAH', warna: ORANGE, file: fAfter, dir: A, cap: kAfter, bg: 'FDF0E4' },
  ]
  kolom.forEach((k) => {
    s.addShape(pres.ShapeType.roundRect, { x: k.x, y: 1.68, w: 1.3, h: 0.32, fill: { color: k.bg }, line: { color: k.bg }, rectRadius: 0.16 })
    s.addText(k.label, { x: k.x, y: 1.68, w: 1.3, h: 0.32, fontFace: F, fontSize: 9, bold: true, color: k.warna, align: 'center', charSpacing: 1.2, margin: 0 })
    // bingkai mengikuti ukuran gambar setelah diskalakan, jadi rasio tetap utuh
    const g = fit(k.file, KOL_W, AREA_H)
    const gx = k.x + (KOL_W - g.w) / 2
    const gy = TOP + (AREA_H - g.h) / 2
    s.addShape(pres.ShapeType.rect, { x: gx - 0.05, y: gy - 0.05, w: g.w + 0.1, h: g.h + 0.1, fill: { color: 'FFFFFF' }, line: { color: LINE2, width: 1 } })
    s.addImage({ path: path.join(k.dir, k.file), x: gx, y: gy, w: g.w, h: g.h })
    s.addText(k.cap, { x: k.x, y: 5.72, w: KOL_W, h: 0.8, fontFace: F, fontSize: 11.5, color: INK2, margin: 0, valign: 'top' })
  })
  if (catatan) {
    s.addShape(pres.ShapeType.ellipse, { x: 0.62, y: 6.74, w: 0.19, h: 0.19, fill: { color: ORANGE } })
    s.addText(catatan, { x: 0.96, y: 6.68, w: 10.9, h: 0.34, fontFace: F, fontSize: 11.5, bold: true, color: INK, margin: 0 })
  }
  logo(s)
}

/* ── Halaman sorot: penjelasan kiri, satu tangkapan layar besar kanan ── */
const sorot = (judul, sub, file, poin, catatan) => {
  const s = pres.addSlide()
  s.background = { color: 'FFFFFF' }
  eyebrow(s, 'MODUL BARU', 0.62, 0.4)
  s.addText(judul, { x: 0.62, y: 0.68, w: 4.5, h: 0.95, fontFace: F, fontSize: 24, bold: true, color: INK, margin: 0 })
  s.addText(sub, { x: 0.62, y: 1.72, w: 4.5, h: 0.75, fontFace: F, fontSize: 12.5, color: INK2, margin: 0 })
  poin.forEach((t, i) => {
    const y = 2.68 + i * 0.86
    s.addShape(pres.ShapeType.ellipse, { x: 0.62, y: y + 0.05, w: 0.19, h: 0.19, fill: { color: ORANGE } })
    s.addText(t, { x: 0.96, y, w: 4.2, h: 0.78, fontFace: F, fontSize: 12, color: INK2, margin: 0, valign: 'top' })
  })
  if (catatan) s.addText(catatan, { x: 0.62, y: 6.35, w: 4.5, h: 0.5, fontFace: F, fontSize: 12, bold: true, color: ORANGE, margin: 0 })

  const MAX_W = 7.3, MAX_H = 6.0
  const g = fit(file, MAX_W, MAX_H)
  const gx = 5.45 + (MAX_W - g.w) / 2
  const gy = 0.72 + (MAX_H - g.h) / 2
  s.addShape(pres.ShapeType.rect, { x: gx - 0.05, y: gy - 0.05, w: g.w + 0.1, h: g.h + 0.1, fill: { color: 'FFFFFF' }, line: { color: LINE2, width: 1 } })
  s.addImage({ path: path.join(A, file), x: gx, y: gy, w: g.w, h: g.h })
  logo(s)
}

sectionOpener('01', 'Layar lama, layar baru', 'Setiap fungsi yang ada di sistem lama tetap ada — hanya dipindahkan ke tampilan yang lebih mudah dibaca dan lebih sedikit langkahnya.')

banding('Data Sopir', 'Master data pengemudi.',
  'pengisian data sopir_before.jpg', '03 - Master Data Sopir.jpg',
  'Tabel di dalam jendela kecil. Dua kolom Alamat kosong seluruhnya, dan nama sopir tercampur dengan kode kendaraan.',
  'Pencarian langsung, pengurutan kolom, dan halaman. Alamat dipisah menjadi dua kolom yang dapat dicari terpisah.',
  '39 nama sopir berhasil dirapikan dari 55 varian penulisan.')

banding('Data Route', 'Master rute pengiriman.',
  'Pengisian data route_before.jpg', '05 - Master Data Route.jpg',
  'Daftar rute dengan kolom tarif yang harus dibaca satu per satu dari layar sempit.',
  'Nominal terformat Rupiah, ada baris total, pencarian, dan penyaring ukuran container.',
  'Kolom yang selama ini terbaca "Fart" ternyata "Feet" — ukuran container dalam kaki.')

banding('Surat Jalan', 'Daftar dokumen pengiriman.',
  'pengisian surat jalan_before.jpg', '07 - Surat Jalan - Daftar.jpg',
  'Satu dokumen dibuka satu per satu. Tidak ada cara melihat seluruh surat jalan sekaligus.',
  'Seluruh surat jalan dalam satu tabel, lengkap dengan penyaring tanggal, customer, dan status.',
  null)

banding('Input Container', 'Pengisian nomor container.',
  'masukkan jumlah container.jpg', '08 - Surat Jalan - Form Tambah.jpg',
  'Sistem menanyakan jumlah container lebih dulu lewat kotak dialog, baru nomornya diisi satu per satu.',
  'Container ditambah dan dihapus bebas dalam satu halaman. Jumlahnya dihitung sendiri oleh sistem.',
  'Nomor container dapat ditempel sekaligus dari Excel.')

banding('Cetak Surat Jalan', 'Pilihan cetak dokumen.',
  'PILIHAN MAU DENGAN logo atau tanpa logo.jpg', '09b - Surat Jalan - Pengaturan Cetak.jpg',
  'Pilihan dengan atau tanpa logo, lalu langsung menuju printer.',
  'Pilihan template dan tujuan cetak, dilanjutkan preview A4 sebelum benar-benar dicetak.',
  'Beberapa surat jalan dapat dicetak sekaligus, satu dokumen per halaman.')

banding('Data Tagihan', 'Pemrosesan file SI / Job Order.',
  'PEMROSESAN FILE DATA SI atau JO dia itu ke proses data nya_before.jpg', '13 - Data Tagihan.jpg',
  'Perpindahan antar data memakai tombol Atas, Bawah, Sebelum, dan Berikut.',
  'Daftar record dapat diklik langsung, dilengkapi tombol Previous dan Next Record serta pencarian.',
  null)

banding('Pencarian SI / Job Order', 'Menemukan seluruh mobil dalam satu job order.',
  'pencarian nomor SI JOB ORDER_before.jpg', '14 - Pencarian SI Job Order.jpg',
  'Nomor Sijo disalin dari layar Browsing Data, lalu ditempel manual ke layar pencarian ini.',
  'Nomor Sijo dapat diklik dari tabel mana pun dan langsung membuka detailnya. Pencarian manual tetap tersedia.',
  'Langkah salin-tempel manual hilang sepenuhnya.')

banding('Cetak Komisi Bulan Berjalan', 'Laporan komisi sopir.',
  'CETAK KOMISI BULAN BERJALAN_before.jpg', '15 - Cetak Komisi Bulan Berjalan.jpg',
  'Pilih periode dan jenis laporan, lalu hasilnya langsung menuju printer.',
  'Ringkasan tampil lebih dulu di layar, disusul preview A4 yang sama persis dengan hasil cetak.',
  null)

banding('Pendapatan Netto', 'Laporan pendapatan bersih.',
  'PENDAPATAN NETTO BULAN BERJALAN_before.jpg', '16 - Pendapatan Netto.jpg',
  'Dua pilihan cetak tanpa gambaran isi laporannya terlebih dahulu.',
  'Rekap per mobil tampil langsung di layar, lengkap dengan kartu ringkasan di atasnya.',
  null)

banding('Cek Ritan Bulan Ini', 'Rekap ritan sopir.',
  'RITAN SOPIR BULAN BERJALAN_before.jpg', '17 - Cek Ritan Bulan Ini.jpg',
  'Tabel padat dengan tombol Cetak, Hapus, Sunting, dan Simpan di bagian bawah.',
  'Penyuntingan langsung di dalam tabel, dengan penyaring sopir dan kota serta total bon di kanan atas.',
  null)

sectionOpener('02', 'Yang sebelumnya di luar sistem', 'Uang jalan, potongan kasbon, dan biaya operasional selama ini dicatat di spreadsheet terpisah. Sekarang semuanya menyatu dengan trip-nya.')

sorot('Uang Jalan Multi Termin', 'Satu trip dapat dibayar bertahap, dan sistem menghitung sisanya sendiri.',
  '12a - Trip Detail - Uang Jalan Multi Termin.jpg',
  ['Data operasional menunjukkan 66 dari 241 trip dibayar lebih dari satu kali, sampai empat termin.',
   'Nilai transfer ke sopir dihitung otomatis dan tidak dapat diketik manual.',
   'Total uang jalan, potongan kasbon, dan transfer tampil di baris bawah tabel.'],
  'TF = UJ − Potong Kasbon')

sorot('Biaya Operasional', 'DEX, tol, SPSI, nginap, dan biaya lain kini melekat pada trip-nya.',
  '12b - Trip Detail - Biaya Operasional.jpg',
  ['Biaya dicatat sebagai baris tersendiri, bukan kolom tetap — jenis baru bisa ditambah kapan saja.',
   'Terbaca dari data operasional: Rp 103.076.250 dari 84 catatan biaya.',
   'DEX menjadi komponen terbesar, yaitu Rp 71,5 juta.'],
  null)

sorot('Master Data Mobil', 'Kendaraan dipisahkan dari data sopir.',
  '04 - Master Data Mobil.jpg',
  ['Sebelumnya konfigurasi seperti 6X6, DL, dan LB ditulis menempel pada nama sopir.',
   'Akibatnya satu orang terbaca sebagai beberapa sopir berbeda.',
   'Kini konfigurasi menjadi atribut kendaraan, dan nama sopir kembali utuh.'],
  '29 kendaraan terdaftar')

sorot('Dashboard', 'Ringkasan operasional dalam satu layar.',
  '02 - Dashboard.jpg',
  ['Sepuluh kartu ringkasan: transaksi, uang jalan, potongan kasbon, transfer, dan biaya.',
   'Grafik transaksi harian serta peringkat sopir berdasarkan jumlah ritan.',
   'Panel "perlu perhatian" menyoroti data yang belum lengkap.'],
  null)

sorot('Preview Cetak A4', 'Yang terlihat di layar sama persis dengan hasil cetak.',
  '19b - Rekap Biaya - Preview Cetak A4.jpg',
  ['Setiap lembar memuat kop PT Bimajaya Mustika, nama laporan, periode, dan nomor halaman.',
   'Tersedia pilihan orientasi potret maupun lanskap.',
   'Menyimpan sebagai PDF dilakukan langsung dari dialog cetak browser.'],
  null)

/* ── Angka dari data operasional ───────────────────────────── */
{
  const s = pres.addSlide()
  s.background = { color: 'FFFFFF' }
  eyebrow(s, 'DATA OPERASIONAL', 0.72, 0.48)
  s.addText('Angka yang sudah terbaca sistem', { x: 0.72, y: 0.76, w: 11.5, h: 0.62, fontFace: F, fontSize: 30, bold: true, color: INK, margin: 0 })
  s.addText('Periode 1 Juni sampai 21 Juli 2026, dibaca langsung dari berkas operasional yang diberikan.',
    { x: 0.72, y: 1.44, w: 10.5, h: 0.4, fontFace: F, fontSize: 13, color: INK2, margin: 0 })

  const baris = [
    ['Uang jalan', 'Rp 993.133.000', 'dibayar dalam 343 termin'],
    ['Potongan kasbon', 'Rp 20.035.500', 'pengurang uang jalan'],
    ['Transfer ke sopir', 'Rp 973.097.500', 'dihitung otomatis oleh sistem'],
    ['Biaya operasional', 'Rp 103.076.250', 'DEX, tol, SPSI, nginap, dan lainnya'],
  ]
  baris.forEach(([k, v, ket], i) => {
    const y = 2.24 + i * 0.94
    s.addShape(pres.ShapeType.rect, { x: 0.72, y, w: 11.9, h: 0.8, fill: { color: i % 2 ? 'FFFFFF' : CARD }, line: { color: LINE, width: 1 } })
    s.addText(k, { x: 1.02, y: y + 0.22, w: 3.2, h: 0.38, fontFace: F, fontSize: 13.5, bold: true, color: INK, margin: 0 })
    s.addText(v, { x: 4.3, y: y + 0.16, w: 3.4, h: 0.5, fontFace: F, fontSize: 19, bold: true, color: ORANGE, align: 'right', margin: 0 })
    s.addText(ket, { x: 8.15, y: y + 0.24, w: 4.3, h: 0.36, fontFace: F, fontSize: 11.5, color: INK2, margin: 0 })
  })
  s.addText('Seluruh nilai di atas cocok persis dengan berkas sumbernya — tidak ada angka yang dikira-kira.',
    { x: 0.72, y: 6.22, w: 11.5, h: 0.4, fontFace: F, fontSize: 12, bold: true, color: INK, margin: 0 })
  logo(s)
}

/* ── Yang menunggu keputusan ───────────────────────────────── */
{
  const s = pres.addSlide()
  s.background = { color: 'FFFFFF' }
  eyebrow(s, 'LANGKAH BERIKUTNYA', 0.72, 0.48)
  s.addText('Yang masih menunggu keputusan', { x: 0.72, y: 0.76, w: 11.5, h: 0.62, fontFace: F, fontSize: 30, bold: true, color: INK, margin: 0 })
  s.addText('Sistem sudah siap menampung semuanya. Yang belum ada adalah aturan hitungnya — dan itu tidak kami tebak.',
    { x: 0.72, y: 1.44, w: 11, h: 0.4, fontFace: F, fontSize: 13, color: INK2, margin: 0 })

  const kartu = [
    ['Tarif per route', 'Nilai Feet, UJROUTE, Komisioner, dan Harga belum tersedia untuk 136 route. Ini yang paling berdampak — begitu ada, empat halaman laporan langsung hidup.'],
    ['Arti kolom COST', 'Terisi pada 107 dari 241 trip, dan nilainya berbeda-beda pada route yang sama. Perlu dipastikan apakah ini harga ke customer atau biaya.'],
    ['Formula komisi', 'Menu komisi tetap dipertahankan, tetapi rumusnya belum ditetapkan sehingga angkanya belum ditampilkan.'],
    ['Sumber data lain', 'Berkas yang ada baru mencakup trip, uang jalan, dan biaya. SI/Job Order, tagihan, dan surat jalan belum termasuk.'],
  ]
  kartu.forEach(([j, d], i) => {
    const x = 0.72 + (i % 2) * 6.1
    const y = 2.24 + Math.floor(i / 2) * 2.16
    s.addShape(pres.ShapeType.roundRect, { x, y, w: 5.7, h: 1.9, fill: { color: CARD }, line: { color: LINE, width: 1 }, rectRadius: 0.1 })
    s.addText(String(i + 1).padStart(2, '0'), { x: x + 0.32, y: y + 0.24, w: 0.62, h: 0.34, fontFace: F, fontSize: 13, bold: true, color: ORANGE, margin: 0 })
    s.addText(j, { x: x + 1.0, y: y + 0.22, w: 4.5, h: 0.36, fontFace: F, fontSize: 14.5, bold: true, color: INK, margin: 0 })
    s.addText(d, { x: x + 1.0, y: y + 0.62, w: 4.45, h: 1.16, fontFace: F, fontSize: 11.5, color: INK2, margin: 0, valign: 'top' })
  })
  logo(s)
}

/* ── Penutup ───────────────────────────────────────────────── */
{
  const s = pres.addSlide()
  s.background = { color: CREAM }
  s.addImage({ path: path.join(TPL, 'image1.png'), x: 0, y: 6.55, w: W, h: 0.95 })
  eyebrow(s, 'PENUTUP', 0.85, 2.0)
  s.addText('Siap dilanjutkan ke tahap berikutnya', { x: 0.85, y: 2.3, w: 11.2, h: 1.5, fontFace: F, fontSize: 40, bold: true, color: INK, margin: 0 })
  s.addText('Begitu tarif route dan aturan hitungnya tersedia, laporan komisi dan pendapatan netto dapat langsung diaktifkan tanpa membangun ulang.',
    { x: 0.85, y: 3.9, w: 9.4, h: 0.8, fontFace: F, fontSize: 14.5, color: INK2, margin: 0 })

  const kontak = [['EMAIL', 'info@anomalistudio.com'], ['STUDIO', 'Anomali Studio — Jakarta']]
  kontak.forEach(([k, v], i) => {
    const x = 0.85 + i * 4.5
    s.addText(k, { x, y: 5.02, w: 4.3, h: 0.24, fontFace: F, fontSize: 9, bold: true, color: ORANGE, charSpacing: 1.4, margin: 0 })
    s.addText(v, { x, y: 5.3, w: 4.4, h: 0.34, fontFace: F, fontSize: 13.5, color: INK, margin: 0 })
  })
  s.addImage({ path: path.join(BRAND, 'logo-anomali.png'), x: 11.4, y: 5.08, w: 1.35, h: 0.49 })
}

const out = path.join(P, 'SIKOTIS - Sebelum & Sesudah.pptx')
pres.writeFile({ fileName: out }).then(() => console.log('PPT dibuat: ' + out))
