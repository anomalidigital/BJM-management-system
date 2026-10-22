using System.Text.RegularExpressions;
using bjm_user.Client.Data;
using bjm_user.Client.Komponen.Ui;
using bjm_user.Client.Model;

namespace bjm_user.Client.Logika;

/// <summary>Satu kolom template import: judul (sama dengan label di form), wajib, dan keterangan isinya.</summary>
public sealed record KolomImport(string Judul, bool Wajib = false, string? Keterangan = null);

/// <summary>Hasil pemeriksaan satu baris berkas: status, kunci, nama, keterangan, dan aksi simpannya (null bila galat).</summary>
public sealed class HasilImport
{
    public const string Baru = "Baru", Diperbarui = "Diperbarui", Galat = "Dilewati";
    public int Baris { get; init; }
    public string Status { get; init; } = Baru;
    public string Kunci { get; init; } = "";
    public string Nama { get; init; } = "";
    public string Pesan { get; init; } = "";
    public Action? Terapkan { get; init; }

    public static HasilImport Salah(int baris, string kunci, string nama, string pesan) => new() { Baris = baris, Status = Galat, Kunci = kunci, Nama = nama, Pesan = pesan };
}

/// <summary>Kunci yang sudah muncul di berkas yang sama (baris kembar dilewati).</summary>
public sealed class KonteksImport
{
    public HashSet<string> Terpakai { get; } = new(StringComparer.OrdinalIgnoreCase);
}

/// <summary>Aturan import satu master: kolom template dan cara memeriksa / menyimpan tiap baris.</summary>
public sealed class DefinisiImport
{
    public required string Nama { get; init; }
    public required string Koleksi { get; init; }
    /// <summary>Kolom penentu data lama vs baru, mis. "Kode" atau "No. Kendaraan".</summary>
    public required string Kunci { get; init; }
    public required List<KolomImport> Kolom { get; init; }
    public required Func<ImportData.BarisImport, KonteksImport, HasilImport> Periksa { get; init; }
    public string NamaTemplate => $"template-import-{Regex.Replace(Nama.ToLowerInvariant(), @"[^a-z0-9]+", "-").Trim('-')}.csv";
}

/// <summary>Definisi import untuk tiap halaman Master Data (Baldy 22 Okt 2026). Kolom kosong tidak menghapus isian lama.</summary>
public static class ImportMaster
{
    private static string? Isi(string v) => v.Trim() == "" ? null : v.Trim();

    private static string? StatusDari(string v) => ImportData.Normal(v) switch
    {
        "" => null, "aktif" or "active" => "aktif", "nonaktif" or "tidakaktif" or "inactive" or "non" => "nonaktif", _ => "?",
    };

    private static string Gabung(IEnumerable<string?> isi) => string.Join(" · ", isi.Where(x => !string.IsNullOrEmpty(x)));

    /// <summary>Dokumen penting dari kolom nomor / tanggal berlaku; dokumen lama dipertahankan, berkasnya tidak tersentuh.</summary>
    private static Dictionary<string, DokumenPenting>? GabungDokumen(Dictionary<string, DokumenPenting>? lama, IEnumerable<(string Kode, string? Nomor, string? Berlaku)> isian)
    {
        var d = lama is null ? new Dictionary<string, DokumenPenting>() : Database.Salin(lama);
        foreach (var (kode, nomor, berlaku) in isian)
        {
            if (nomor is null && berlaku is null) continue;
            var dok = d.GetValueOrDefault(kode) ?? new DokumenPenting();
            if (nomor is not null) dok.Nomor = nomor;
            if (berlaku is not null) dok.BerlakuSampai = berlaku;
            d[kode] = dok;
        }
        return d.Count > 0 ? d : null;
    }

    /* ── Supir / Karyawan ────────────────────────────────────────────── */

    public static DefinisiImport Karyawan(Db db) => new()
    {
        Nama = "Karyawan", Koleksi = Model.Koleksi.Karyawan, Kunci = "Kode",
        Kolom =
        [
            new("Kode", Keterangan: "SPR001 / MGR001. Kosong = dibuat otomatis untuk karyawan baru."),
            new("Peran", Keterangan: "Supir atau Manager. Kosong = Supir."),
            new("Nama Lengkap", Keterangan: "Sesuai KTP. Wajib untuk karyawan baru."),
            new("Nama Panggilan", true, "Dipakai di trip, laporan, dan cetakan."),
            new("Alamat"), new("Kota", Keterangan: "Wajib untuk karyawan baru."), new("Telepon"),
            new("No. KTP"), new("No. SIM"), new("SIM Berlaku s/d", Keterangan: "Tanggal, mis. 31/12/2027."),
            new("Status", Keterangan: "Aktif atau Nonaktif. Kosong = Aktif."),
        ],
        Periksa = (b, ctx) =>
        {
            var kode = b.Ambil("Kode").ToUpperInvariant();
            var nama = b.Ambil("Nama Panggilan");
            var lengkap = b.Ambil("Nama Lengkap");
            var peranTeks = ImportData.Normal(b.Ambil("Peran"));
            string? peran = peranTeks switch { "" => null, "supir" or "sopir" or "driver" => PeranKaryawan.Sopir, "manager" or "manajer" => PeranKaryawan.Manager, _ => "?" };
            var status = StatusDari(b.Ambil("Status"));
            var tampil = nama != "" ? nama : lengkap;
            if (peran == "?") return HasilImport.Salah(b.Nomor, kode, tampil, "Peran harus Supir atau Manager.");
            if (status == "?") return HasilImport.Salah(b.Nomor, kode, tampil, "Status harus Aktif atau Nonaktif.");
            if (!ImportData.Tanggal(b.Ambil("SIM Berlaku s/d"), out var simBerlaku)) return HasilImport.Salah(b.Nomor, kode, tampil, "SIM Berlaku s/d bukan tanggal yang dikenali.");
            var telepon = b.Ambil("Telepon");
            if (telepon != "" && !Regex.IsMatch(telepon, @"^[\d+\-\s()]{6,20}$")) return HasilImport.Salah(b.Nomor, kode, tampil, "Format nomor telepon tidak valid.");
            if (kode != "" && !ctx.Terpakai.Add(kode)) return HasilImport.Salah(b.Nomor, kode, tampil, $"Kode {kode} muncul lebih dari sekali di berkas.");
            var lama = kode == "" ? null : db.Data.Karyawan.FirstOrDefault(k => k.DriverCode.Equals(kode, StringComparison.OrdinalIgnoreCase));
            var dokumen = new[] { ("KTP", Isi(b.Ambil("No. KTP")), (string?)null), ("SIM", Isi(b.Ambil("No. SIM")), Isi(simBerlaku)) };
            if (lama is null)
            {
                if (nama == "") return HasilImport.Salah(b.Nomor, kode, lengkap, "Nama Panggilan wajib diisi.");
                if (lengkap == "") return HasilImport.Salah(b.Nomor, kode, nama, "Nama Lengkap wajib diisi untuk karyawan baru.");
                if (b.Ambil("Kota") == "") return HasilImport.Salah(b.Nomor, kode, nama, "Kota wajib diisi untuk karyawan baru.");
                var p = peran ?? PeranKaryawan.Sopir;
                return new HasilImport
                {
                    Baris = b.Nomor, Status = HasilImport.Baru, Kunci = kode != "" ? kode : "otomatis", Nama = nama, Pesan = Gabung([PeranKaryawan.Label(p), b.Ambil("Kota")]),
                    Terapkan = () => db.Buat(new Model.Karyawan
                    {
                        DriverCode = kode != "" ? kode : Kode.KodeKaryawanBerikut(db.Data.Karyawan, p), DriverName = nama, NamaLengkap = lengkap, Role = p,
                        Address1 = b.Ambil("Alamat"), City = b.Ambil("Kota"), Phone = telepon, Status = status ?? StatusKaryawan.Aktif,
                        Dokumen = GabungDokumen(null, dokumen),
                    }),
                };
            }
            return new HasilImport
            {
                Baris = b.Nomor, Status = HasilImport.Diperbarui, Kunci = lama.DriverCode, Nama = nama != "" ? nama : lama.DriverName, Pesan = "Kolom yang diisi menimpa data lama.",
                Terapkan = () => db.Ubah<Model.Karyawan>(lama.Id, k =>
                {
                    k.DriverName = Isi(nama) ?? k.DriverName; k.NamaLengkap = Isi(lengkap) ?? k.NamaLengkap; k.Role = peran ?? k.Role;
                    k.Address1 = Isi(b.Ambil("Alamat")) ?? k.Address1; k.City = Isi(b.Ambil("Kota")) ?? k.City; k.Phone = Isi(telepon) ?? k.Phone;
                    k.Status = status ?? k.Status; k.Dokumen = GabungDokumen(k.Dokumen, dokumen);
                }),
            };
        },
    };

    /* ── Kendaraan ───────────────────────────────────────────────────── */

    public static DefinisiImport Kendaraan(Db db) => new()
    {
        Nama = "Kendaraan", Koleksi = Model.Koleksi.Kendaraan, Kunci = "No. Kendaraan",
        Kolom =
        [
            new("No. Kendaraan", true, "Dirapikan otomatis, mis. B9015UWW menjadi B 9015 UWW."),
            new("Jenis Kendaraan", Keterangan: "Mis. Tronton 6x2, Trailer 40 FT. Wajib untuk kendaraan baru."),
            new("Konfigurasi", Keterangan: $"Kosong = Standar. Pilihan: {string.Join(", ", KonfigurasiKendaraan.Semua.Select(KonfigurasiKendaraan.Label))}."),
            new("Status", Keterangan: "Aktif atau Nonaktif. Kosong = Aktif."),
            new("No. STNK"), new("STNK Berlaku s/d", Keterangan: "Tanggal, mis. 31/12/2027."),
            new("No. KIR"), new("KIR Berlaku s/d", Keterangan: "Tanggal."), new("No. BPKB"),
        ],
        Periksa = (b, ctx) =>
        {
            var plat = Kode.RapikanNoKendaraan(b.Ambil("No. Kendaraan"));
            var kunci = Kode.KunciNoKendaraan(plat);
            var jenis = b.Ambil("Jenis Kendaraan");
            var konfTeks = ImportData.Normal(b.Ambil("Konfigurasi"));
            var konf = konfTeks is "" or "standar" ? (konfTeks == "standar" ? "" : null)
                : KonfigurasiKendaraan.Semua.FirstOrDefault(k => ImportData.Normal(k) == konfTeks || ImportData.Normal(KonfigurasiKendaraan.Label(k)) == konfTeks) ?? "?";
            var status = StatusDari(b.Ambil("Status"));
            if (kunci == "") return HasilImport.Salah(b.Nomor, "", jenis, "No. Kendaraan wajib diisi.");
            if (konf == "?") return HasilImport.Salah(b.Nomor, plat, jenis, "Konfigurasi tidak dikenal.");
            if (status == "?") return HasilImport.Salah(b.Nomor, plat, jenis, "Status harus Aktif atau Nonaktif.");
            if (!ImportData.Tanggal(b.Ambil("STNK Berlaku s/d"), out var stnk) || !ImportData.Tanggal(b.Ambil("KIR Berlaku s/d"), out var kir))
                return HasilImport.Salah(b.Nomor, plat, jenis, "Tanggal berlaku bukan tanggal yang dikenali.");
            if (!ctx.Terpakai.Add(kunci)) return HasilImport.Salah(b.Nomor, plat, jenis, $"No. Kendaraan {plat} muncul lebih dari sekali di berkas.");
            var dokumen = new[]
            {
                ("STNK", Isi(b.Ambil("No. STNK")), Isi(stnk)), ("KIR", Isi(b.Ambil("No. KIR")), Isi(kir)), ("BPKB", Isi(b.Ambil("No. BPKB")), (string?)null),
            };
            var lama = db.Data.Kendaraan.FirstOrDefault(v => Kode.KunciNoKendaraan(v.PlateNumber) == kunci);
            if (lama is null)
            {
                if (jenis == "") return HasilImport.Salah(b.Nomor, plat, "", "Jenis Kendaraan wajib diisi untuk kendaraan baru.");
                return new HasilImport
                {
                    Baris = b.Nomor, Status = HasilImport.Baru, Kunci = plat, Nama = jenis, Pesan = konf is { Length: > 0 } ? KonfigurasiKendaraan.Label(konf) : "Standar",
                    Terapkan = () => db.Buat(new Model.Kendaraan
                    {
                        PlateNumber = plat, VehicleType = jenis, Configuration = konf ?? "", Status = status ?? StatusKendaraan.Aktif, Dokumen = GabungDokumen(null, dokumen),
                    }),
                };
            }
            return new HasilImport
            {
                Baris = b.Nomor, Status = HasilImport.Diperbarui, Kunci = lama.PlateNumber, Nama = jenis != "" ? jenis : lama.VehicleType, Pesan = "Kolom yang diisi menimpa data lama.",
                Terapkan = () => db.Ubah<Model.Kendaraan>(lama.Id, v =>
                {
                    v.VehicleType = Isi(jenis) ?? v.VehicleType; v.Configuration = konf ?? v.Configuration; v.Status = status ?? v.Status;
                    v.Dokumen = GabungDokumen(v.Dokumen, dokumen);
                }),
            };
        },
    };

    /* ── Rute ────────────────────────────────────────────────────────── */

    public static DefinisiImport Rute(Db db) => new()
    {
        Nama = "Rute", Koleksi = Model.Koleksi.Rute, Kunci = "No. Rute",
        Kolom =
        [
            new("Nama Rute", true, "Pick up - destinasi, mis. CIB - DURI."),
            new("No. Rute", Keterangan: "Kosong = dibuat otomatis dari Nama Rute. Rute dengan No. Rute / Nama Rute yang sama diperbarui."),
            new("Uang Jalan Rute", Keterangan: "Rupiah, mis. 1500000."), new("Uang Tol", Keterangan: "Rupiah."),
            new("Harga Jual", Keterangan: "Rupiah. Wajib untuk rute baru."), new("Catatan"),
        ],
        Periksa = (b, ctx) =>
        {
            var nama = Regex.Replace(b.Ambil("Nama Rute").ToUpperInvariant(), @"\s+", " ");
            var kode = Regex.Replace(b.Ambil("No. Rute").ToUpperInvariant(), @"\s+", "");
            var uj = ImportData.Rupiah(b.Ambil("Uang Jalan Rute"));
            var tol = ImportData.Rupiah(b.Ambil("Uang Tol"));
            var harga = ImportData.Rupiah(b.Ambil("Harga Jual"));
            var catatan = b.Ambil("Catatan");
            if (nama == "" || Regex.IsMatch(nama, @"-\s*$")) return HasilImport.Salah(b.Nomor, kode, nama, "Nama Rute wajib lengkap, mis. CIB - DURI.");
            var kunciNama = KodeArea.KunciNamaRute(nama);
            if (!ctx.Terpakai.Add("n:" + kunciNama) || (kode != "" && !ctx.Terpakai.Add("k:" + kode)))
                return HasilImport.Salah(b.Nomor, kode, nama, "Rute ini muncul lebih dari sekali di berkas.");
            var lama = (kode != "" ? db.Data.Rute.FirstOrDefault(r => r.RouteCode.Equals(kode, StringComparison.OrdinalIgnoreCase)) : null)
                       ?? db.Data.Rute.FirstOrDefault(r => KodeArea.KunciNamaRute(r.RouteName) == kunciNama);
            if (lama is null)
            {
                if (harga is not > 0) return HasilImport.Salah(b.Nomor, kode, nama, "Harga Jual wajib lebih dari 0 untuk rute baru.");
                if (kode != "" && db.Semua.Rute.Any(r => r.RouteCode.Equals(kode, StringComparison.OrdinalIgnoreCase)))
                    return HasilImport.Salah(b.Nomor, kode, nama, $"No. Rute {kode} sudah dipakai rute lain.");
                return new HasilImport
                {
                    Baris = b.Nomor, Status = HasilImport.Baru, Kunci = kode != "" ? kode : "otomatis", Nama = nama, Pesan = $"Harga Jual {Format.Rupiah(harga ?? 0)}",
                    Terapkan = () => db.Buat(new Model.Rute
                    {
                        RouteCode = kode != "" ? kode : Kode.KodeRuteDari(nama, db.Semua.Rute), RouteName = nama, ProjectId = "", Feet = "",
                        Ujroute = uj ?? 0, Toll = tol ?? 0, Price = harga ?? 0, EstimatedFields = [], Catatan = catatan,
                    }),
                };
            }
            return new HasilImport
            {
                Baris = b.Nomor, Status = HasilImport.Diperbarui, Kunci = lama.RouteCode, Nama = lama.RouteName, Pesan = "Kolom yang diisi menimpa data lama.",
                Terapkan = () => db.Ubah<Model.Rute>(lama.Id, r =>
                {
                    if (uj is not null) r.Ujroute = uj.Value;
                    if (tol is not null) r.Toll = tol.Value;
                    if (harga is not null) r.Price = harga.Value;
                    // Nominal yang diisi lewat import sudah bukan perkiraan.
                    r.EstimatedFields = r.EstimatedFields?.Where(k => (k == "ujroute" && uj is null) || (k == "toll" && tol is null) || (k == "price" && harga is null)).ToList();
                    r.Catatan = Isi(catatan) ?? r.Catatan;
                }),
            };
        },
    };

    /* ── Alamat ──────────────────────────────────────────────────────── */

    public static DefinisiImport Alamat(Db db) => new()
    {
        Nama = "Alamat", Koleksi = Model.Koleksi.Alamat, Kunci = "Kode Area",
        Kolom =
        [
            new("Nama Lokasi", true, "Nama perusahaan atau tempat."),
            new("Kode Area", Keterangan: "Kosong = dibuat otomatis dari kota / nama lokasi."),
            new("Alamat"), new("Kota"), new("Nama Kontak"), new("Telepon"), new("Catatan"),
        ],
        Periksa = (b, ctx) =>
        {
            var nama = b.Ambil("Nama Lokasi");
            var kota = b.Ambil("Kota");
            var kode = KodeArea.Rapikan(b.Ambil("Kode Area")).Trim();
            if (nama == "") return HasilImport.Salah(b.Nomor, kode, "", "Nama Lokasi wajib diisi.");
            var kodePakai = kode != "" ? kode : KodeArea.DariLokasi(kota, nama);
            if (!ctx.Terpakai.Add($"{kodePakai}|{nama}")) return HasilImport.Salah(b.Nomor, kodePakai, nama, "Alamat ini muncul lebih dari sekali di berkas.");
            var lama = db.Data.Alamat.FirstOrDefault(a => a.Nama.Equals(nama, StringComparison.OrdinalIgnoreCase) && a.KodeArea.Equals(kodePakai, StringComparison.OrdinalIgnoreCase));
            if (lama is null)
                return new HasilImport
                {
                    Baris = b.Nomor, Status = HasilImport.Baru, Kunci = kodePakai, Nama = nama, Pesan = Gabung([b.Ambil("Alamat"), kota]),
                    Terapkan = () => db.Buat(new Model.Alamat
                    {
                        KodeArea = kodePakai, Nama = nama, Jalan = b.Ambil("Alamat"), Kota = kota, NamaKontak = b.Ambil("Nama Kontak"), Telepon = b.Ambil("Telepon"),
                        Catatan = b.Ambil("Catatan"), Jenis = JenisAlamat.Keduanya, Status = "aktif",
                    }),
                };
            return new HasilImport
            {
                Baris = b.Nomor, Status = HasilImport.Diperbarui, Kunci = lama.KodeArea, Nama = lama.Nama, Pesan = "Kolom yang diisi menimpa data lama.",
                Terapkan = () => db.Ubah<Model.Alamat>(lama.Id, a =>
                {
                    a.Jalan = Isi(b.Ambil("Alamat")) ?? a.Jalan; a.Kota = Isi(kota) ?? a.Kota; a.NamaKontak = Isi(b.Ambil("Nama Kontak")) ?? a.NamaKontak;
                    a.Telepon = Isi(b.Ambil("Telepon")) ?? a.Telepon; a.Catatan = Isi(b.Ambil("Catatan")) ?? a.Catatan;
                }),
            };
        },
    };

    /* ── Klien / Pelanggan ───────────────────────────────────────────── */

    public static DefinisiImport Klien(Db db) => new()
    {
        Nama = "Klien", Koleksi = Model.Koleksi.Klien, Kunci = "Kode Klien",
        Kolom =
        [
            new("Nama Klien", true, "Nama resmi perusahaan."),
            new("Kode Klien", Keterangan: "Kosong = singkatan Nama Klien untuk klien baru."),
            new("Tipe Layanan", Keterangan: "Callout atau Dedicated. Kosong = Callout."),
            new("NPWP"), new("Deskripsi"), new("Status", Keterangan: "Aktif atau Nonaktif. Kosong = Aktif."),
        ],
        Periksa = (b, ctx) =>
        {
            var nama = b.Ambil("Nama Klien");
            var kode = b.Ambil("Kode Klien").ToUpperInvariant();
            var tipeTeks = ImportData.Normal(b.Ambil("Tipe Layanan"));
            string? tipe = tipeTeks switch { "" => null, "callout" => TipeKlien.Callout, "dedicated" => TipeKlien.Dedicated, _ => "?" };
            var status = StatusDari(b.Ambil("Status"));
            if (tipe == "?") return HasilImport.Salah(b.Nomor, kode, nama, "Tipe Layanan harus Callout atau Dedicated.");
            if (status == "?") return HasilImport.Salah(b.Nomor, kode, nama, "Status harus Aktif atau Nonaktif.");
            var lama = kode == "" ? null : db.Data.Klien.FirstOrDefault(p => p.ProjectCode.Equals(kode, StringComparison.OrdinalIgnoreCase));
            if (lama is null && nama == "") return HasilImport.Salah(b.Nomor, kode, "", "Nama Klien wajib diisi.");
            var kunci = kode != "" ? kode : "n:" + nama;
            if (!ctx.Terpakai.Add(kunci)) return HasilImport.Salah(b.Nomor, kode, nama, "Klien ini muncul lebih dari sekali di berkas.");
            if (lama is null)
            {
                if (db.Data.Klien.Any(p => p.ProjectName.Equals(nama, StringComparison.OrdinalIgnoreCase)))
                    return HasilImport.Salah(b.Nomor, kode, nama, "Nama Klien sudah terdaftar. Isi Kode Klien-nya untuk memperbarui.");
                return new HasilImport
                {
                    Baris = b.Nomor, Status = HasilImport.Baru, Kunci = kode != "" ? kode : "otomatis", Nama = nama, Pesan = TipeKlien.Label(tipe ?? TipeKlien.Callout),
                    Terapkan = () => db.Buat(new Model.Klien
                    {
                        ProjectCode = kode != "" ? kode : Kode.KodeKlienBerikut(nama, db.Data.Klien.Select(p => p.ProjectCode)), ProjectName = nama,
                        ClientType = tipe ?? TipeKlien.Callout, Npwp = b.Ambil("NPWP"), Description = b.Ambil("Deskripsi"), RequiresDocument = true, Status = status ?? "aktif",
                    }),
                };
            }
            return new HasilImport
            {
                Baris = b.Nomor, Status = HasilImport.Diperbarui, Kunci = lama.ProjectCode, Nama = nama != "" ? nama : lama.ProjectName, Pesan = "Kolom yang diisi menimpa data lama.",
                Terapkan = () => db.Ubah<Model.Klien>(lama.Id, p =>
                {
                    p.ProjectName = Isi(nama) ?? p.ProjectName; p.ClientType = tipe ?? p.ClientType; p.Npwp = Isi(b.Ambil("NPWP")) ?? p.Npwp;
                    p.Description = Isi(b.Ambil("Deskripsi")) ?? p.Description; p.Status = status ?? p.Status;
                }),
            };
        },
    };
}
