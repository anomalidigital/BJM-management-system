// Kode & label pilihan. Kode yang tersimpan tetap (kontrak data), label boleh berubah.
namespace bjm_user.Client.Model;

public static class Peran
{
    public const string Owner = "owner", Manager = "manager", Admin = "admin", Viewer = "viewer";
    public static readonly string[] Semua = [Owner, Manager, Admin, Viewer];
    public static string Label(string r) => r switch { Owner => "Owner", Manager => "Manager", Admin => "Admin", Viewer => "Viewer", _ => r };
    public static string Ringkas(string r) => r switch
    {
        Owner => "super admin: akses penuh", Manager => "semua kecuali hapus trip & atur pengguna",
        Admin => "input & ubah trip harian", Viewer => "hanya lihat & export", _ => "",
    };
}

public static class WorkspaceKode
{
    public const string Karawang = "karawang", Priok = "priok";
    public static readonly string[] Semua = [Karawang, Priok];
    public static string Label(string w) => w == Priok ? "Tanjung Priok" : "Karawang";
}

public sealed record JenisDokumenPenting(string Kode, string Label, bool Berlaku = false);

public static class DokumenPentingJenis
{
    public static readonly JenisDokumenPenting[] Karyawan =
    [
        new("KTP", "KTP"), new("SIM", "SIM", true), new("KK", "Kartu Keluarga"), new("NPWP", "NPWP"),
    ];
    public static readonly JenisDokumenPenting[] Kendaraan =
    [
        new("STNK", "STNK", true), new("KIR", "KIR", true), new("PAJAK", "Pajak Kendaraan", true), new("ASURANSI", "Asuransi", true),
    ];
}

public static class PeranKaryawan
{
    public const string Sopir = "sopir", Manager = "manager";
    public static readonly string[] Semua = [Sopir, Manager];
    public static string Label(string r) => r == Manager ? "Manager" : "Supir";
    public static string Awalan(string r) => r == Manager ? "MGR" : "SPR";
}

public static class KonfigurasiKendaraan
{
    public static readonly string[] Semua = ["6X6", "4X4", "DL", "LB", "HB", "EXT", "TRONTON", "DOLLY", "CDD"];
    public static string Label(string k) => k switch
    {
        "HB" => "Hi Bed", "LB" => "Low Bed", "DOLLY" => "Dolly", "TRONTON" => "Tronton", "DL" => "DL", "6X6" => "6x6",
        "4X4" => "4x4", "EXT" => "Extension", "CDD" => "CDD", _ => k,
    };
}

public static class JenisAlamat
{
    public const string Pengirim = "pengirim", Penerima = "penerima", Keduanya = "keduanya";
    public static readonly string[] Semua = [Pengirim, Penerima, Keduanya];
    public static string Label(string j) => j switch { Pengirim => "Pick up (pengirim)", Penerima => "Destinasi (penerima)", _ => "Pick up & destinasi" };
}

public static class TipeKlien
{
    public const string Callout = "callout", Dedicated = "dedicated";
    public static readonly string[] Semua = [Callout, Dedicated];
    public static string Label(string t) => t == Dedicated ? "Dedicated" : "Callout";
    public static string Keterangan(string t) => t == Dedicated
        ? "Kendaraan dikontrak klien ini. Kontraknya dikelola di halaman klien."
        : "Order per perjalanan dengan No. Referensi dari klien. Harga ikut rute.";
}

public static class StatusTrip
{
    public const string Draft = "draft", MenungguSopir = "menunggu_sopir", Aktif = "aktif", Selesai = "selesai", Batal = "batal";
    public static readonly string[] Urut = [Draft, MenungguSopir, Aktif, Selesai, Batal];
    public static string Label(string s) => s switch
    {
        Draft => "Draft", MenungguSopir => "Menunggu Supir", Aktif => "Aktif", Selesai => "Selesai", Batal => "Dibatalkan", _ => s,
    };
    /// <summary>Nada warna badge: neutral / warning / brand / good / critical.</summary>
    public static string Nada(string s) => s switch
    {
        Draft => "neutral", MenungguSopir => "warning", Aktif => "brand", Selesai => "good", Batal => "critical", _ => "neutral",
    };
    public static bool BisaDitutup(string s) => s is Aktif or MenungguSopir;
}

public static class JenisTermin
{
    public const string Uj = "uj", UangDorong = "uang_dorong", UangPulang = "uang_pulang", Tambahan = "tambahan";
    public static readonly string[] Semua = [Uj, UangDorong, UangPulang, Tambahan];
    public static string Label(string? j) => j switch { UangDorong => "Uang dorong", UangPulang => "Uang pulang", Tambahan => "Tambahan", _ => "Uang jalan" };
}

public static class JenisBiaya
{
    /// <summary>Kode tersimpan tetap (SPSI, Nginap); label tampilan mengikuti istilah atasan.</summary>
    public static readonly string[] Semua = ["Tol", "DEX", "SPSI", "Nginap", "Escort", "ASDP", "Double Driver", "Reimbus", "Lainnya"];
    /// <summary>Biaya yang bawaannya ikut ditagihkan ke klien sebagai Additional Cost PI.</summary>
    public static readonly string[] Ditagihkan = ["DEX", "Tol", "ASDP", "SPSI", "Nginap", "Escort"];
    public static string Label(string kode) => kode switch { "SPSI" => "SPSI Banlok", "Nginap" => "Overnight", _ => kode };
}

public static class PembayarBiaya
{
    public const string Sopir = "sopir", Perusahaan = "perusahaan";
    public static string Label(string? p) => p == Perusahaan ? "Perusahaan langsung" : "Supir, dari uang jalan";
}

public static class JenisBiayaInternal
{
    public static readonly string[] Semua = ["Uang Makan", "Kernet", "Komisi", "Servis & Sparepart", "Gaji Sopir", "Administrasi", "Lainnya"];
    public static string Label(string kode) => kode == "Gaji Sopir" ? "Gaji Supir" : kode;
}

public static class JenisPerjalanan
{
    public static readonly string[] Semua = ["pickup", "istirahat", "menginap", "kendala", "dialihkan", "tiba", "bongkar", "retur", "pool"];
    public static string Label(string j) => j switch
    {
        "pickup" => "Pick up barang", "istirahat" => "Istirahat / rest area", "menginap" => "Menginap", "kendala" => "Kendala di jalan",
        "dialihkan" => "Dialihkan / relokasi", "tiba" => "Tiba di destinasi", "bongkar" => "Selesai bongkar",
        "retur" => "Dikembalikan (retur)", "pool" => "Tiba di pool", _ => j,
    };
}

public static class TahapPi
{
    public const string Tercetak = "tercetak", Dikirim = "dikirim", Revisi = "revisi", Disetujui = "disetujui", Lunas = "lunas";
    public static readonly string[] Urut = [Tercetak, Dikirim, Revisi, Disetujui, Lunas];
    public static string Label(string? t) => t switch
    {
        Tercetak => "PI Tercetak", Dikirim => "PI Dikirim", Revisi => "PI Revisi", Disetujui => "Disetujui", Lunas => "Lunas", _ => "Siap dibuatkan PI",
    };
}

public static class JenisKasbon
{
    public const string Admin = "admin", Trip = "trip", Pembatalan = "pembatalan", Lunas = "lunas", Manual = "manual";
    public static string Label(string k) => k switch
    {
        Admin => "Kasbon", Trip => "Potong uang jalan", Pembatalan => "Pembatalan trip", Lunas => "Pelunasan", Manual => "Penyesuaian", _ => k,
    };
}

public static class DasarKomisi
{
    public const string Nilai = "nilai", Uj = "uj", Kontrak = "kontrak";
    public static readonly string[] Semua = [Nilai, Uj, Kontrak];
    public static string Label(string d) => d switch { Uj => "Uang jalan (UJ)", Kontrak => "Nilai kontrak", _ => "Harga trip" };
}

public static class AksiAudit
{
    public static readonly string[] Semua = ["buat", "ubah", "hapus", "batal", "tutup", "pool", "tahap_pi", "cetak"];
    public static string Label(string a) => a switch
    {
        "buat" => "Tambah", "ubah" => "Ubah", "hapus" => "Hapus", "batal" => "Batalkan trip", "tutup" => "Tutup trip",
        "pool" => "Kembali ke pool", "tahap_pi" => "Tahap PI", "cetak" => "Cetak", _ => a,
    };
}

public static class KategoriDokumen
{
    public static readonly string[] Semua = ["Umum", "Perusahaan", "Kendaraan", "Karyawan", "Klien", "Lainnya"];
}
