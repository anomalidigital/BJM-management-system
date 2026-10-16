# Panduan memindahkan halaman SIKOTIS dari React ke Blazor

Versi React (acuan tampilan & logika): `Z:\Projects\BJM_260812\Baldy\Perbaikan sementara\src` (baca langsung dengan Read/Grep).
Versi Blazor (tujuan): `C:\Users\baldy\.sikotis-dev\blazor\bjm_user` (solusi .NET 10, proyek `bjm_user.Client` = seluruh UI, WebAssembly).

Tujuan port: **tampilan dan perilaku sama dengan React**, hanya kerangkanya Blazor + Bootstrap 5. Data masih di browser
(localStorage) lewat `Db`, persis seperti React, sampai backend ada.

## Aturan tetap (keputusan Baldy)
1. Bahasa kode & UI: Indonesia (nama komponen, metode, variabel, teks). Istilah ditulis lengkap: Uang Jalan, Transfer, Berita Acara,
   Tanggal (bukan UJ/TF/BA/Tgl). Singkatan resmi tetap: PI, POD, STNK, KIR, TR.
2. CSS: **hanya kelas Bootstrap 5** + kelas khusus yang sudah ada di `wwwroot/css/sikotis.css`, `komponen.css`, `cetak.css`
   (fs-11 … fs-26, text-ink/-2/-3, bg-sunken, border-hairline, tnum, kartu, kotak-info/peringatan/galat, badge-nada, dll).
   Jangan menulis kelas Tailwind (`flex`, `gap-2`, `text-[13px]`, `rounded-lg`, …) — terjemahkan ke Bootstrap (`d-flex`, `gap-2`,
   `fs-13`, `rounded-3`). Gaya baru yang benar-benar perlu: tulis di `wwwroot/css/halaman.css` (buat bila belum ada) dengan nama
   kelas berawalan nama halaman, atau inline `style`.
3. Tombol yang tidak boleh diakses peran → cukup **mati** (`Disabled`), **tanpa tooltip/alasan** "hanya Manager/Owner". Alasan
   hanya untuk keadaan data (mis. "Sudah ditagih lewat PI 0473").
4. **Tanpa pemilih jumlah baris per halaman** ("10 / halaman"); paginasi saja (`Pagination`).
5. Backload / lanjutan hanya dari menu ⋯ di daftar trip, tidak dari detail trip.
6. Cetak selalu lewat preview (`ReportPreview`), satu tombol **Cetak / PDF**; tidak ada tombol Preview terpisah, tidak ada
   Export PDF / Print terpisah.
7. Harga trip selalu ikut Harga Rute saat rute dipilih; tidak ada "ubah harga trip ini" di form trip.
8. Kendaraan dipilih tidak mengisi supir otomatis (dan sebaliknya). Tidak ada tombol "Kosongkan" untuk No Referensi.
9. Placeholder tidak memakai nama orang nyata.
10. Navigasi (sidebar) selalu lapisan paling atas; panel dropdown tidak boleh menutupinya (sudah diatur di CSS).

## Arsitektur singkat
- `Model/Entitas.cs`: kelas data (`Trip`, `Rute`, `Karyawan`, `Kendaraan`, `Klien`, `Kontrak`, `TerminUj`, `BiayaOperasional`,
  `BiayaInternal`, `KejadianTrip`, `CatatanTrip`, `MutasiKasbon`, `AturanKomisi`, `Alamat`, `Dokumen`, `Tagihan`, `JobOrder`,
  `CatatanAudit`). Properti PascalCase dari nama snake_case React (`route_code` → `RouteCode`, `uj_amount` → `UjAmount`).
  Uang = `long`. Tanggal = string ISO `yyyy-mm-dd`; waktu = `yyyy-mm-ddThh:mm`.
- `Model/Konstanta.cs`: kode & label pilihan (`StatusTrip`, `TipeKlien`, `JenisTermin`, `JenisBiaya`, `PembayarBiaya`,
  `JenisBiayaInternal`, `JenisPerjalanan`, `TahapPi`, `JenisKasbon`, `DasarKomisi`, `Peran`, `PeranKaryawan`, `KonfigurasiKendaraan`,
  `JenisAlamat`, `AksiAudit`, `KategoriDokumen`, `WorkspaceKode`, `DokumenPentingJenis`).
- `Model/BarisTrip.cs`: `BarisTrip` = trip yang sudah digabung (padanan `TransactionRow`): `T` (Trip asli), `IdTampil`,
  `DriverNames`, `PlateNumber`, `RouteName`, `Harga`, `UjTotal`, `KasbonTotal`, `TfTotal`, `TerminCount`, `ExpenseTotal`,
  `BiayaDitagihkan`, `BiayaPerusahaan`, `KomisiSopir`, `KomisiManager`, `KomisiKeterangan`, `TrList`, `Muat`, `Bongkar`, `Ata`,
  `Posisi`, `MenahanKendaraan`, `TagihanTotal`, `AreaAsal`, `AreaTujuan`, `ProjectCode/Name`, `ContractNo`, `ClientName`, …
- `Logika/*`: `Format` (Rupiah, Angka, Tanggal, TanggalPanjang, LabelBulan, Waktu, HariIni, AwalBulan, AkhirBulan, GalatRentang,
  RentangTanggal, BacaUang, Inisial), `Kode` (NomorTripBerikut, KodeRuteDari, KodeKlienBerikut, KodeKaryawanBerikut,
  NomorKontrakBerikut, NomorSuratJalanBerikut, BuatKodeUnik), `TripLogika` (Tr, RapikanTr, KunciTr, Lokasi, KodeArea,
  NormalKodeArea, MenahanKendaraan, IdBackload, Kejadian, Ata, Ditagihkan, DibayarPerusahaan, NomorPiBerikut, Muatan, IdPerjalanan),
  `Komisi` (HitungTrip, HitungKontrak, PilihAturan, Terapkan, TulisRentang, HargaTrip), `Kasbon` (Saldo, PetaSaldo, Arah,
  JenisPiutang, SisiKaryawan), `Periode` (Aktif, Sebelumnya, Memuat), `Hitung` (Ringkas, Netto, UangJalan, Pendapatan, DeltaPersen),
  `KodeArea` (Pemakaian, KelompokMirip, Saran, DariLokasi, AlamatMirip, RencanaRapikan, Kunci, Mirip), `AuditLogika` (Tautan, Label),
  `Util` (CocokCari, Urutkan, Banding, Uid).
- `Data/Db.cs` (scoped service): **satu-satunya pintu data**.
  - `Db.Data` = data workspace aktif (padanan `db` React: trip batal tidak membawa termin/biaya); `Db.Semua` = lintas workspace
    (padanan `dbAll`); `Db.Baris` = `List<BarisTrip>` workspace aktif; `Db.BarisTrip(id)`; `Db.BarisTagihan`; `Db.SaldoKasbon`
    (Dictionary id karyawan → saldo); `Db.Karawang` (bool).
  - CRUD generik beraudit: `Db.Buat(new Rute { … })` (id & waktu diisi), `Db.Ubah<Rute>(id, r => { r.Price = …; })`,
    `Db.Hapus<Rute>(id)` / `Db.Hapus<T>(IEnumerable<string>)`, `Db.Cari<T>(id)`, `Db.Daftar<T>()`.
  - Aksi domain: `BuatTrip`, `SimpanTermin(tripId, IsianTermin, TerminUj? ada)`, `HapusTermin(TerminUj)`, `IsiTrip(tripId)`,
    `BatalkanTrip(tripId, OpsiBatal)`, `TutupTrip(tripId, OpsiTutup)`, `TandaiDiPool(tripId)`, `HapusTrip(tripId)`,
    `TandaiDicetak(ids)`, `CatatAudit`, `DenganAudit(IsianAudit, Action)`, `ResetKeContohAsync`, `MuatUlangAsync`,
    `LampiranDipakai()`.
  - Setelah mutasi, `Db.Berubah` dipicu; komponen turunan `KomponenData` otomatis render ulang.
- `Layanan/Sesi.cs`: `Sesi.Pengguna` (Username, Name, Role), `Sesi.Bisa("trip"|"nota"|"master"|"biaya"|"override"|"bukti"|
  "batal"|"tagihan"|"komisi"|"audit"|"hapus"|"pengguna")`, `Sesi.BisaMaster`, `Sesi.Workspace`, `Sesi.Akun` (daftar akun),
  `SimpanAkunAsync`, `KeluarAsync`, `Sesi.Izin` (matriks). `Layanan/Toast.cs`: `Toast.Sukses/Info/Galat(teks)`.
  `Layanan/Navigasi.cs`: struktur menu & `CariHref(label)`.
- `Data/Penyimpanan.cs`: `CetakAsync`, `UnduhAsync(nama, isi, mime)`, `FokusAsync`, `GulirKeAsync`. `Data/Lampiran.cs`: IndexedDB.

## Kerangka halaman
```razor
@page "/master/rute"
@inherits KomponenData          @* memberi Db, Sesi, Toast, Nav, Bisa(), Karawang, Ke(url) dan render ulang otomatis *@
<PageTitle>Rute — SIKOTIS</PageTitle>
<PageHeader Title="Rute" Crumbs="@(new List<Crumb> { new("Master Data"), new("Rute") })">
    <Description>…</Description>
    <Actions><Tombol Variant="primary" Icon="Ikon.Plus" Disabled="@(!Bisa("master"))" OnClick="BukaTambah">Tambah Rute</Tombol></Actions>
</PageHeader>
<Kartu> <Toolbar><Left>…</Left><Right>…</Right></Toolbar> <DataTable …/> <Pagination …/> </Kartu>
```
Parameter route: `@page "/transaksi/trip/{Id}"` + `[Parameter] public string Id { get; set; }`. Query string: `[SupplyParameterFromQuery] public string? Tab { get; set; }`.
Membaca query manual: `Nav.ToAbsoluteUri(Nav.Uri).Query` + `System.Web.HttpUtility.ParseQueryString` (atau `QueryHelpers` dari
Microsoft.AspNetCore.WebUtilities — sudah tersedia di WASM).
Contoh lengkap yang sudah jalan & teruji: `bjm_user.Client/Pages/UjiKomponen.razor` (daftar + cari + filter berdraf + tabel urut +
paginasi + modal form + dropdown + lampiran + preview cetak).

## Komponen bersama (`Komponen/Ui`, `Komponen/Cetak`) — pakai ini, jangan membuat ulang
| Komponen | Parameter utama |
|---|---|
| `PageHeader` | `Title`, `Description` (fragment), `Crumbs` (List<Crumb>), `Actions` (fragment) |
| `Kartu`, `KepalaKartu`(Title, Subtitle, Actions), `IsiKartu`, `InfoItem`(Label, Value/child, Mono) | kartu Bootstrap |
| `Toolbar`(Left, Right), `SearchInput`(Value/ValueChanged, Placeholder, Width) | baris pencarian + filter + aksi |
| `PanelFilter<T>`(Filter: KendaliFilter<T>, Chips, Galat, TampilChips, ChildContent) + `DaftarChipFilter` | satu tombol Filter berdraf; isian panel menulis `Filter.Draf` lewat `Filter.Ubah(d => …)` |
| `KendaliFilter<T>` (kelas) | `new(() => new F(), StateHasChanged)`; `Nilai`, `Draf`, `Ubah`, `Terapkan`, `Lepas((n,a)=>n.X=a.X)`, `LepasSemua`, `Atur`, `Aktif` |
| `KendaliTabel<T>` (kelas) | `new(pageSize, sortKey)`; set `Search`, `SortAccessor`, `ExtraFilter`, `ExtraFilterActive`; `Saring(rows)` → `Halaman(list)`; `ToggleSort`, `SetQuery`, `SetPage`, `Reset`, `IsFiltered`, `Total` |
| `DataTable<T>` | `Columns` (List<Kolom<T>>), `Rows`, `RowKey`, `SortKey`, `SortNaik`, `OnSortChange`, `SelectedKeys`/`OnToggleRow`/`OnToggleAll`, `OnRowClick`, `ActiveKey`, `Empty`/`NotFound` (fragment), `IsFiltered`, `Footer`, `Dense`, `MaxHeight` |
| `Kolom<T>` | `Key`, `Header`, `Teks` (Func<T,string>) atau `Render` (RenderFragment<T>: `r => @<span>…</span>`), `Sortable`, `Align` ("right"), `Width`, `CellClass`, `NoPrint` |
| `Pagination` | `Page`, `PageSize`, `Total`, `OnPageChange` |
| `Tabs`(Items: List<TabItem(Id, Label, Badge)>, Value/ValueChanged), `TabKartu`(Items: List<KartuTab>, Value), `TombolSegmen` | tab garis bawah / kartu / segmen |
| `Modal`(Open, Title, Subtitle, Size sm/md/lg/xl, OnClose, ChildContent, Footer), `KonfirmasiDialog`(Open, Title, Message, ConfirmLabel, Tone "danger", OnCancel, OnConfirm) | dialog; Esc & klik tirai menutup |
| `OverflowMenu`(Actions: List<AksiMenu(label, onSelect, icon, tone, disabled)>) | menu ⋯ |
| `Tombol`(Variant primary/secondary/ghost/danger/outlineDanger/subtle, Size sm, Icon, Loading, Disabled, Title, OnClick, Type), `TombolIkon`(Label, Icon, Tone, Disabled, OnClick), `TombolTeks` | tombol |
| `Badge`(Tone neutral/brand/good/warning/serious/critical), `KotakInfo`(Jenis info/peringatan/galat), `StatCard`, `EmptyState`(Entity), `NotFoundState`(OnReset), `ErrorState`, `TableSkeleton` | tampilan |
| `Field`(Label, Required, Error, Hint, Class) → child menerima `context` = id untuk kontrol | pembungkus label+galat |
| `Pilihan`(Options: List<Opsi>, Value/ValueChanged (string?), Placeholder, Cari, Clearable, Invalid, Disabled, Tambahan: AksiTambahan, EmptyText, Ukuran "sm", AriaLabel) | dropdown semua jenis (pengganti `<select>` & SearchableSelect). `new Opsi(value, label, meta, keywords, disabled)` |
| `TanggalInput`, `WaktuInput`, `UangInput`(Value long), `Checkbox`(Label, Checked/CheckedChanged), `Radio`(Name, Label, Description, Checked, OnChange), `KodeInput`, `PilihKaryawan`, `NilaiPiutang`(Nilai) | isian |
| `LampiranInput`(Value/ValueChanged List<string>, Label, Nama), `LampiranThumbs`(Ids, Ukuran), `DokumenPentingInput`(Jenis, Value, ValueChanged, LainnyaLabel, Lainnya, LainnyaChanged), `DokumenPentingRingkas` | lampiran |
| `ReportPreview`(OnClose, OnPrint, Settings, ChildContent(context = orientasi), OrientasiAwal, OrientasiTetap), `PrintDocument` (+ `PrintDocument.Bagi`, `BarisPerLembar`), `PrintPage`(Title, Subtitle, Periode, Page, TotalPages, Meta, WithLogo), `PrintTable`(Cols) + `<td class="p-sel">`, `BeritaAcaraDocument`(Note: BarisTrip), `SuratJalanDocument`, `SuratJalanPrintFlow`(Notes, Open, OnClose) | cetak |
| `IkonSvg Def="Ikon.Truck" Size="15"` | ikon (daftar nama di `Komponen/Ikon.g.cs`; tambah ikon lewat `alat/ikon.mjs`) |

Isian teks biasa: `<input id="@context" class="form-control" value="@x" @oninput="e => x = e.Value?.ToString() ?? string.Empty" />`
(pakai `@oninput`, bukan `@bind`, supaya uji otomatis yang mengirim event `input` bekerja). Textarea sama dengan `<textarea>`.

## Komponen khusus trip yang sudah ada (`Pages/Trip/`, namespace `bjm_user.Client.Pages.Trip`, sudah di-import global)
`AturanTrip` (LabelGandengan, RapikanGandengan, OpsiGandengan, PetaDitahan → `Ditahan.Kendaraan/Supir`, AlasanDitahan,
TripSudahJalan, PilihanStatus, CariTr, TitikLama, TulisAlamat, LabelAlamat, TitikRapi, SamaTitik, TitikDariAlamat, TitikTerisi,
SamaArea), `Bagian`(Nomor, Judul, Keterangan, Aksi), `NilaiInfo`(Label, Merah), `Peringatan`(kuning), `KunciTrip`(Status, Terbuka,
BolehBuka, OnBuka, Isian), `NoReferensiInput`(Value/ValueChanged), `PilihAlamatTrip`. CSS `wwwroot/css/trip.css` (`form-bar`,
`halaman-form`, `kotak-backload`, `bar-pilihan`). Daftar trip (`/transaksi/trip`) dan form tambah/ubah trip
(`/transaksi/trip/tambah`, `/transaksi/trip/{Id}/edit`) dikerjakan terpisah oleh sesi utama — jangan dibuat ulang.

## Jebakan Razor yang sering
- Variabel loop (`for`/`foreach`) yang dipakai di child content / lambda **harus disalin dulu** (`var ii = i;`), kalau tidak
  nilainya berubah saat fragment dirender (ArgumentOutOfRange).
- Jangan menulis `\"` di dalam atribut Razor; pindahkan lambda rumit ke metode di `@code`.
- Komponen yang memakai `KomponenData` jangan menimpa `OnInitialized` tanpa `base.OnInitialized()`.
- Setelah `Db.Buat/Ubah/Hapus` tidak perlu `StateHasChanged` (sudah lewat `Db.Berubah`).
- Satu halaman yang memakai dua `Pilihan` dengan label sama → beri `AriaLabel` berbeda.

## Uji otomatis (wajib dijalankan sebelum selesai)
Harness Chrome headless: `C:\Users\baldy\.sikotis-dev\uji\cdp.mjs` (`bukaBrowser({ port, profil, bersihkan: true })`,
`b.goto`, `b.evaluate`, `b.s('isi'|'pilih'|'opsi'|'cari'|'nilai'|'pesan'|'klik'|'galat'|'radio'|'centang', …)`, `b.shot`,
`b.konsol`). Helper mencari isian lewat `<label for>` → elemen ber-id, dropdown lewat `button.form-select` + `[role=listbox]
[role=option] .label-opsi`, modal lewat `[role=dialog]`, galat lewat `.invalid-feedback`, toast lewat `[role=status]`, tab
`[role=tab]`, menu ⋯ `button[aria-haspopup=menu]` + `[role=menuitem]`. Contoh: `blz-dasar.mjs`, `blz-komponen.mjs`.
Skrip uji React untuk halaman yang sama ada di folder yang sama (`uji-*.mjs`, `sim-*.mjs`) — tiru alurnya.
Login untuk uji: `localStorage.setItem('sikotis.auth.v1', JSON.stringify({username:'owner',name:'Owner',role:'owner'}))` lalu buka halaman.

## Cara kerja per kelompok (agen)
1. Salin solusi ke folder kerja sendiri: `robocopy C:\Users\baldy\.sikotis-dev\blazor C:\Users\baldy\.sikotis-dev\blazor-<grup> /MIR /XD bin obj node_modules .git`
   (kerjakan di salinan; jangan menyentuh folder `blazor` utama).
2. Tulis halaman di `bjm_user.Client/Pages/<Grup>/…razor`. Build: `dotnet build bjm_user/bjm_user.csproj -nologo -v q` (dari folder `bjm_user`).
3. Jalankan: `dotnet run --project bjm_user/bjm_user/bjm_user.csproj --no-launch-profile -e ASPNETCORE_ENVIRONMENT=Development --urls http://localhost:<port>`
   (port unik per kelompok), lalu uji dengan skrip CDP (port CDP unik). Hentikan server sebelum build ulang (DLL terkunci).
4. Hasil akhir: daftar file yang dibuat/diubah (path relatif `bjm_user.Client/…`) + ringkasan perilaku yang berbeda dari React
   (kalau ada) + hasil uji. Jangan mengubah file di luar `Pages/<Grup>` kecuali menambah `wwwroot/css/halaman.css`
   atau menambah ikon lewat `alat/ikon.mjs` (sebutkan di laporan).
