# SIKOTIS — Web Management System

**Sistem Komisi Otomatis · PT Bimajaya Mustika**

Rebuild aplikasi desktop legacy **SIKOTIS** menjadi *modern web-based Transportation,
Driver Commission, Billing & Reporting Management System*.

Prototype ini adalah **Phase 1 — Prototype UI**: seluruh halaman, komponen, alur, dan
interaksi sudah berjalan penuh menggunakan **data dummy realistis** yang tersimpan di
`localStorage`, sehingga bisa langsung dicoba tanpa backend.

---

## Menjalankan

```bash
npm install
```

```bash
npm run dev
```

Buka `http://localhost:5180`.

Login apa pun diterima (password minimal 4 karakter). Pilih peran **Admin** (akses penuh)
atau **Viewer / Management** (hanya lihat dan export).

Build produksi:

```bash
npm run build
```

---

## Tech Stack

| Bagian | Pilihan | Alasan |
|---|---|---|
| Framework | React 19 + TypeScript | Type-safe, mudah dilanjutkan ke Phase 2 |
| Build tool | Vite 6 | Dev server cepat, build ringan |
| Styling | Tailwind CSS v4 | Design token terpusat di `src/index.css` |
| Routing | React Router 7 | Client-side routing |
| Ikon | lucide-react | Konsisten, ringan |
| Chart | SVG buatan sendiri | Tanpa dependency berat, kontrol penuh atas aksesibilitas |
| Data | In-memory + `localStorage` | CRUD benar-benar tersimpan saat refresh |
| Print / PDF | CSS paged media + `window.print()` | Preview sama dengan hasil cetak, PDF via Save as PDF |

---

## Sitemap

```text
/login                              Login (Admin / Viewer)
/dashboard                          Dashboard

MASTER
/master/sopir                       Data Sopir          (legacy: PENGISIAN DATA SOPIR)
/master/route                       Data Route          (legacy: Pengisian Data Route)

TRANSAKSI
/transaksi/surat-jalan              Surat Jalan - daftar + bulk print
/transaksi/surat-jalan/tambah       Surat Jalan - form tambah
/transaksi/surat-jalan/:id          Surat Jalan - detail
/transaksi/surat-jalan/:id/edit     Surat Jalan - form ubah
/transaksi/komisi                   Data Komisi         (legacy: Pengisian Data Surat Jalan)
/transaksi/tagihan                  Data Tagihan        (legacy: Pemrosesan file data SI / JO)
                                    tab: Proses Data / Browsing Data / Pencarian Data

LAP. BULAN INI
/laporan/komisi                     Komisi Bulan Berjalan
/laporan/netto                      Netto Bulan Berjalan
/laporan/ritan                      Cek Ritan Bulan Ini

PENCARIAN
/pencarian/sijo                     Pencarian nomor SI - Job Order

LAINNYA
/tools                              Tools + daftar TBD
```

---

## Perbaikan utama dari sistem lama

| Sistem lama | Sistem baru |
|---|---|
| Copy nilai `Sijo` dari Browsing Data lalu paste ke halaman pencarian | Nilai **Sijo dapat diklik** di semua tabel dan langsung membuka detail SI/JO. Pencarian manual tetap tersedia. |
| Navigasi record `Atas / Bawah / Sebelum / Berikut` | **Previous / Next Record**, pencarian, dan daftar record yang bisa diklik langsung |
| Popup "masukkan jumlah container" sebelum mengisi | **Dynamic container list** - tambah/hapus bebas, jumlah dihitung otomatis, bisa paste banyak nomor sekaligus |
| Dropdown terpisah untuk SI/JO, sopir, mobil, route | **Satu form terintegrasi** dengan searchable dropdown; Detail Tujuan terisi otomatis dari master Route |
| Cetak langsung ke printer | **Print Settings, Preview A4, lalu Cetak / PDF** |
| Tag record dengan tombol SPACE | Checkbox + **contextual toolbar** yang muncul saat ada baris terpilih |

---

## Struktur kode

```text
src/
├── components/
│   ├── charts/       ColumnChart, LineChart, RankingBars, token warna viz
│   ├── layout/       AppShell, Sidebar, Topbar, PageHeader, navigation
│   ├── report/       PrintDocument, PrintTable, ReportPreview,
│   │                 SuratJalanDocument, SuratJalanPrintFlow
│   └── ui/           Button, Field, DataTable, Modal, Drawer, Toolbar,
│                     SearchableSelect, CurrencyInput, Badge, Pagination,
│                     StatCard, Tabs, Menu, Card, States
├── data/dummy.ts     Generator dummy data (seeded, tanggal relatif hari ini)
├── lib/
│   ├── calculations.ts  SEMUA formula TBD ada di sini
│   ├── format.ts        Rupiah, tanggal dd/mm/yyyy, angka ribuan
│   ├── useTable.ts      Hook search + sort + pagination
│   └── utils.ts
├── pages/            Satu file per halaman (+ pages/tagihan/ untuk 3 tab)
├── store/            DataProvider (CRUD), AuthProvider, ToastProvider
└── types/            Domain types
```

---

## Business rule yang masih TBD

Sesuai instruksi dokumen, **formula yang belum tervalidasi tidak dikarang**. Semuanya
memakai placeholder dan dikumpulkan di satu file: `src/lib/calculations.ts`. Daftar
lengkapnya juga tampil di halaman **Tools**.

| ID | Topik | Placeholder sekarang | Perlu dikonfirmasi |
|---|---|---|---|
| TBD-01 | Komisi sopir per transaksi | Nilai `Komisioner` dari master Route | Apakah komisi = Komisioner, atau ada persentase/potongan lain? |
| TBD-02 | Pendapatan bruto | `Harga` dari master Route | Dari Harga route atau dari `Jumlah Rp` Data Tagihan? |
| TBD-03 | Pendapatan netto | `Harga - UjRoute - Komisioner` | Komponen biaya apa saja yang mengurangi netto? |
| TBD-04 | `Data Cost` pada Data Tagihan | Mengikuti `Kode Cust` SI/JO | Sama dengan Kode Cust, atau master kode biaya tersendiri? |
| TBD-05 | Definisi 1 Ritan | 1 transaksi = 1 ritan | Per transaksi, per container, atau per surat jalan? |
| TBD-06 | Tombol `4B` di Data Komisi | Secondary action tanpa logic | Apa fungsi bisnisnya? |
| TBD-07 | Auto-number Surat Jalan | `SJ-000001` berurutan | Ada pola khusus (per bulan / customer / armada)? |

Setelah rumus resminya diberikan, cukup ubah isi fungsi di `calculations.ts` — halaman
lain tidak perlu disentuh.

---

## Keputusan desain yang perlu diketahui

**Dua kolom "Alamat" pada Data Sopir.** Aplikasi lama menampilkan dua header bernama
sama. Di sistem baru keduanya dipisah menjadi `address_1` (**Alamat** — nama jalan dan
nomor) dan `address_2` (**Alamat 2** — kecamatan / area), mengikuti pola data aslinya
(`Jl. Melati No. 12` | `Jakarta Timur` | `Jakarta`). Datanya tetap utuh, tetapi kini bisa
dicari dan difilter terpisah.

**Istilah bisnis dipertahankan apa adanya.** `SIJO`, `No. SI / Job Order`, `Data Cost`
(bukan *Data Cust*), `Kode Cust`, `UjRoute` (bukan *U-Route*), `Komisioner`, `S / JO`,
`Ritan`, `Bon Pribadi`, `Tandai`, `Selesai`, dan judul menu **Lap. Bulan Ini**.

**Tanggal dummy relatif terhadap hari ini.** Data dibuat untuk bulan berjalan dan bulan
sebelumnya, jadi menu "Lap. Bulan Ini" selalu berisi data kapan pun prototype dibuka.

**Warna chart tervalidasi.** Palet seri (biru `#2a78d6`, oranye `#eb6834`) lolos uji
keterbacaan colour-vision-deficiency dan kontras minimal 3:1 terhadap permukaan kartu.
Identitas seri tidak pernah bergantung pada warna saja — selalu ada legend dan tooltip.

---

## Isi data dummy

| Entitas | Jumlah |
|---|---|
| Sopir | 26 |
| Route | 18 |
| Mobil | 16 |
| SI / Job Order | 42 |
| Transaksi Komisi | 88 |
| Data Tagihan | 38 |
| Surat Jalan | 34 |

Reset atau export data dummy lewat halaman **Tools**.

---

## Status pengerjaan

- [x] **Phase 1 — Prototype UI** (semua halaman, komponen, state, print/PDF)
- [ ] Phase 2 — Database dan API
- [ ] Phase 3 — Business logic (menunggu jawaban TBD-01 s/d TBD-07)
- [ ] Phase 4 — Reporting lanjutan
- [ ] Phase 5 — QA

Dokumen teknis lain: [`docs/DATABASE.md`](docs/DATABASE.md) dan [`docs/DESIGN-SYSTEM.md`](docs/DESIGN-SYSTEM.md)
