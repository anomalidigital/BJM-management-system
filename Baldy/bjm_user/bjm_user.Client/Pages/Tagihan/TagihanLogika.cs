namespace bjm_user.Client.Pages.Tagihan;

using System.Text.Json;
using bjm_user.Client.Logika;
using bjm_user.Client.Model;

/// <summary>
/// Baris tabel Tagihan Karawang: trip beserta nilai PI yang dipakai tabel, export, dan cetak, yaitu
/// nilai beku saat PI dibuat; trip yang belum ber-PI memakai nilai sekarang.
/// </summary>
public sealed class BarisPi
{
    public required BarisTrip R { get; init; }
    public Model.Trip T => R.T;
    public string Id => R.Id;
    public long NilaiPokok { get; init; }
    public long NilaiTambahan { get; init; }
    public long NilaiTotal { get; init; }
    /// <summary>Nilai trip sekarang dikurangi nilai PI beku; 0 bila sama atau PI belum dibuat.</summary>
    public long Selisih { get; init; }
    /// <summary>Tahap PI, atau "siap" bila belum dibuatkan PI.</summary>
    public string Tahap => string.IsNullOrEmpty(T.PiTahap) ? "siap" : T.PiTahap!;
    public bool PunyaTahap => !string.IsNullOrEmpty(T.PiTahap);
}

/// <summary>Isian Buat PI untuk satu trip.</summary>
public sealed record IsiPi(string Id, string Nomor, string Tanggal);

/// <summary>Isian pindah tahap PI.</summary>
public sealed record IsiTahap(List<BarisPi> Rows, string Tahap, string Tanggal, string Catatan, List<string> Bukti);

/// <summary>Aturan kecil halaman Tagihan Karawang (padanan fungsi bantu TagihanPiPage React).</summary>
public static class TagihanLogika
{
    /// <summary>Nada badge per tahap PI.</summary>
    public static string Nada(string? tahap) => tahap switch
    {
        TahapPi.Dikirim => "brand", TahapPi.Revisi => "warning", TahapPi.Disetujui or TahapPi.Lunas => "good", _ => "neutral",
    };

    /// <summary>Langkah berikutnya yang wajar dari tiap tahap.</summary>
    public static string[] Lanjut(string? tahap) => tahap switch
    {
        TahapPi.Tercetak => [TahapPi.Dikirim],
        TahapPi.Dikirim => [TahapPi.Revisi, TahapPi.Disetujui],
        TahapPi.Revisi => [TahapPi.Dikirim, TahapPi.Disetujui],
        TahapPi.Disetujui => [TahapPi.Lunas],
        _ => [],
    };

    public static string Aksi(string tahap) => tahap switch
    {
        TahapPi.Tercetak => "Tandai PI Tercetak", TahapPi.Dikirim => "Tandai PI Dikirim", TahapPi.Revisi => "Minta revisi PI",
        TahapPi.Disetujui => "Tandai Disetujui", TahapPi.Lunas => "Tandai Lunas", _ => tahap,
    };

    /// <summary>Bukti yang biasanya menyertai tiap tahap PI.</summary>
    public static string BuktiTahap(string tahap) => tahap switch
    {
        TahapPi.Tercetak => "Scan / PDF PI.",
        TahapPi.Dikirim => "Tanda terima atau email pengiriman PI ke klien.",
        TahapPi.Revisi => "Email / catatan revisi dari klien.",
        TahapPi.Disetujui => "Email konfirmasi atau approval sheet dari klien.",
        TahapPi.Lunas => "Bukti transfer dari klien.",
        _ => "",
    };

    /// <summary>Nama biaya di Summary Submission PI (OVERNIGHT, ESCORT, ...).</summary>
    public static string NamaBiayaPi(string kode) => kode switch { "Nginap" => "OVERNIGHT", "Tol" => "TOL", "Escort" => "ESCORT", _ => kode.ToUpperInvariant() };

    /// <summary>Trip yang bisa ditagihkan: selesai, atau batal dengan biaya cancel.</summary>
    public static bool BisaDitagih(BarisTrip t) => t.Status == StatusTrip.Selesai || (t.Status == StatusTrip.Batal && (t.T.CancelFee ?? 0) > 0);

    /// <summary>Nilai tagihan trip sekarang: harga (trip batal: biaya cancel) + biaya yang ditagihkan.</summary>
    public static NilaiPi NilaiSekarang(BarisTrip t)
    {
        var batal = t.Status == StatusTrip.Batal;
        var pokok = batal ? t.T.CancelFee ?? 0 : t.Harga;
        var tambahan = batal ? 0 : t.BiayaDitagihkan;
        return new NilaiPi { Pokok = pokok, Tambahan = tambahan, Total = pokok + tambahan };
    }

    public static BarisPi Baris(BarisTrip t)
    {
        var beku = !string.IsNullOrEmpty(t.T.PiTahap) && t.T.PiNilai is not null ? t.T.PiNilai : null;
        var nilai = beku ?? NilaiSekarang(t);
        return new BarisPi
        {
            R = t, NilaiPokok = nilai.Pokok, NilaiTambahan = nilai.Tambahan, NilaiTotal = nilai.Total,
            Selisih = beku is not null ? t.TagihanTotal - beku.Total : 0,
        };
    }

    /// <summary>+Rp 500.000 / −Rp 500.000</summary>
    public static string RupiahBertanda(long n) => $"{(n > 0 ? "+" : "−")}{Format.Rupiah(Math.Abs(n))}";

    /// <summary>
    /// Isian yang berubah untuk Audit Log (padanan perubahanPi): hanya isian patch yang dibandingkan; nilai PI dirinci
    /// per bagian (harga, tambahan, total) supaya mudah dibaca, bukan satu teks JSON.
    /// </summary>
    public static List<PerubahanAudit> PerubahanPi(Model.Trip lama, Model.Trip baru, IEnumerable<string> isian, NilaiPi? nilaiBaru)
    {
        var a = JsonSerializer.SerializeToElement(lama, Database.Json);
        var b = JsonSerializer.SerializeToElement(baru, Database.Json);
        var keluar = new List<PerubahanAudit>();
        foreach (var k in isian)
        {
            var adaA = a.TryGetProperty(k, out var va);
            var adaB = b.TryGetProperty(k, out var vb);
            var ta = adaA ? va.GetRawText() : "null";
            var tb = adaB ? vb.GetRawText() : "null";
            if (ta == tb) continue;
            keluar.Add(new PerubahanAudit { Field = k, Dari = adaA ? AuditLogika.NilaiAudit(va) : "—", Ke = adaB ? AuditLogika.NilaiAudit(vb) : "—" });
        }
        if (nilaiBaru is not null)
        {
            var dulu = lama.PiNilai;
            void Tambah(string k, long? d, long ke)
            {
                if (d == ke) return;
                keluar.Add(new PerubahanAudit { Field = $"pi_nilai.{k}", Dari = d is null ? "—" : Format.Rupiah(d.Value), Ke = Format.Rupiah(ke) });
            }
            Tambah("pokok", dulu?.Pokok, nilaiBaru.Pokok);
            Tambah("tambahan", dulu?.Tambahan, nilaiBaru.Tambahan);
            Tambah("total", dulu?.Total, nilaiBaru.Total);
        }
        return keluar;
    }

    public sealed record Titik(string Nama, string Alamat);

    /// <summary>
    /// Titik pick up / destinasi trip untuk export dan rekap: salinan alamat di trip. Trip lama belum punya salinan, jadi
    /// dicari di Master Alamat dengan kode area rute yang sama (klien trip atau alamat umum), hanya bila cocoknya tepat satu.
    /// </summary>
    public static Titik? TitikTrip(BarisTrip t, bool asal, IEnumerable<Alamat> master)
    {
        var titik = asal ? t.T.Pengirim : t.T.Penerima;
        var nama = (titik?.Nama ?? "").Trim();
        var alamat = (titik?.Jalan ?? "").Trim();
        if (nama != "" || alamat != "") return new Titik(nama, alamat);
        var kode = (asal ? t.AreaAsal : t.AreaTujuan).Trim().ToUpperInvariant();
        if (kode == "") return null;
        var cocok = master.Where(a => a.Status != "nonaktif" && a.KodeArea.Trim().ToUpperInvariant() == kode && (a.ProjectId == "" || a.ProjectId == t.T.ProjectId)).ToList();
        var pilih = cocok.Count > 1 ? cocok.Where(a => a.ProjectId == t.T.ProjectId).ToList() : cocok;
        if (pilih.Count != 1) return null;
        var x = pilih[0];
        return new Titik(x.Nama.Trim(), string.Join(", ", new[] { x.Jalan, x.Kota }.Select(v => (v ?? "").Trim()).Where(v => v != "")));
    }

    /// <summary>"Nama, alamat" untuk kolom Detail Origin / Detail Address; tanpa alamat memakai lokasi rute.</summary>
    public static string TeksTitik(Titik? p, string cadangan)
    {
        var s = p is null ? "" : string.Join(", ", new[] { p.Nama, p.Alamat }.Where(v => v != ""));
        return s != "" ? s : cadangan;
    }

    /// <summary>"12/09/2026" dari waktu ATA "2026-09-12T08:00".</summary>
    public static string TanggalAta(string ata) => ata == "" ? "" : Format.Tanggal(ata);
}
