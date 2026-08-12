# Design System — SIKOTIS

Karakter visual: **modern enterprise dashboard** — profesional, bersih, fokus data, tidak
dekoratif. Desktop-first (nyaman di 1366 / 1440 / 1920 px), responsif untuk tablet.
Seluruh token didefinisikan sekali di `src/index.css` lewat `@theme` Tailwind v4.

## Warna

| Peran | Token | Nilai |
|---|---|---|
| Aksen utama | `brand-500` | `#2a78d6` |
| Aksen hover / aktif | `brand-600` / `brand-700` | `#256abf` / `#1c5cab` |
| Latar halaman | `page` | `#f4f5f7` |
| Permukaan kartu | `surface` | `#ffffff` |
| Permukaan tenggelam | `sunken` | `#f8f9fa` |
| Teks utama | `ink` | `#0b0b0b` |
| Teks sekunder | `ink-2` | `#52514e` |
| Teks redup | `ink-3` | `#898781` |
| Garis rambut | `hairline` | `#e4e5e9` |
| Sidebar | `nav-900` | `#0d1523` |

Status: `good #0ca30c`, `warning #fab219`, `serious #ec835a`, `critical #d03b3b`.
Status selalu tampil sebagai **warna + teks**, tidak pernah warna saja, dan tidak pernah
dipakai sebagai warna seri chart.

## Data visualisation

Seri: `series-1 #2a78d6` (biru), `series-2 #eb6834` (oranye). Divalidasi terhadap
permukaan kartu putih: CVD protan ΔE 24,7 (target minimal 8), normal-vision ΔE 33,6
(lantai 15), kontras minimal 3:1.

Aturan:

- **Satu sumbu Y saja** — Pendapatan dan Komisi sama-sama Rupiah, tidak pernah sumbu ganda.
- Bar maksimal 24px, ujung membulat 4px, dasar siku di baseline, jarak 2px antar kolom.
- Garis 2px, marker radius 4,5px dengan ring 2px warna permukaan.
- Gridline hairline solid `#eceef1`, tidak putus-putus.
- Teks label memakai token teks, **tidak pernah** warna seri.
- Legend selalu ada untuk 2 seri atau lebih; satu seri tidak perlu legend.
- Setiap chart punya tooltip hover; line chart punya crosshair.

## Tipografi

Font sistem tunggal: `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`.

| Peran | Ukuran | Bobot |
|---|---|---|
| Judul halaman | 19px | 600 |
| Judul kartu | 14px | 600 |
| Angka stat | 24px | 600 |
| Isi tabel / form | 13px | 400-500 |
| Header tabel | 11,5px uppercase | 600 |
| Keterangan | 11,5-12px | 400 |

`tabular-nums` dipakai pada kolom angka dan tick sumbu agar rata vertikal.

## Radius, jarak, bayangan

Radius kartu 12px, kontrol form dan tombol 6px, badge penuh. Tinggi kontrol 36px (md) dan
32px (sm). `shadow-card` untuk kartu, `shadow-pop` untuk modal, drawer, dropdown, toast.

## Komponen reusable

`Sidebar`, `Topbar`, `PageHeader` (+breadcrumb), `DataTable`, `SearchInput`, `Toolbar`,
`FilterField`, `DateInput`, `SearchableSelect`, `CurrencyInput`, `Badge`, `Modal`,
`Drawer`, `ConfirmDialog`, `Toast`, `Pagination`, `StatCard`, `Tabs`, `OverflowMenu`,
`EmptyState`, `NotFoundState`, `ErrorState`, `TableSkeleton`, `PrintDocument`,
`PrintPage`, `PrintTable`, `ReportPreview`.

## State setiap halaman

| State | Tampilan |
|---|---|
| Loading | Skeleton, bukan spinner penuh layar |
| Empty | "Belum ada data." + ajakan menambah data pertama |
| Search not found | "Data tidak ditemukan." + tombol reset filter |
| Error | "Gagal memuat data." + tombol Coba lagi |
| Success | Toast: "Data berhasil disimpan / diperbarui / dihapus." |
| Confirmation | Dialog "Hapus Data?" — penghapusan tidak pernah langsung |

## Aturan tabel dan form

Tabel: pencarian tanpa reload, sort, pagination, row hover, sticky header, horizontal
scroll bila kolom lebar. Form: field wajib ditandai `*`, validasi numerik, format mata
uang otomatis, date picker untuk tanggal, autocomplete bila data banyak. Error tampil
inline — tidak pernah memakai `alert()` browser.
