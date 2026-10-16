using System.Text.Json;
using bjm_user.Client.Logika;
using bjm_user.Client.Model;

namespace bjm_user.Client.Pages.Trip;

/// <summary>Trip yang masih menahan kendaraan & supirnya (belum kembali ke pool).</summary>
public sealed class Ditahan
{
    public Dictionary<string, BarisTrip> Kendaraan { get; } = [];
    public Dictionary<string, BarisTrip> Supir { get; } = [];
}

/// <summary>Aturan kecil form & daftar trip Karawang (padanan pages/trip/form/aturan.ts, TitikAlamatInput.tsx, status.ts).</summary>
public static class AturanTrip
{
    /// <summary>"LB" → "Low Bed", "6X6 DL" → "6x6 DL".</summary>
    public static string LabelGandengan(string kode)
    {
        var k = kode.Trim().ToUpperInvariant();
        if (k == "") return "";
        if (KonfigurasiKendaraan.Semua.Contains(k)) return KonfigurasiKendaraan.Label(k);
        return string.Join(' ', k.Split(' ', StringSplitOptions.RemoveEmptyEntries).Select(KonfigurasiKendaraan.Label));
    }

    public static string RapikanGandengan(string v) => string.Join(' ', v.Trim().ToUpperInvariant().Split(' ', StringSplitOptions.RemoveEmptyEntries));

    /// <summary>Pilihan Sub Kendaraan / Gandengan: kode baku + konfigurasi kendaraan dan nilai sekarang bila gabungan.</summary>
    public static List<Komponen.Ui.Opsi> OpsiGandengan(string nilai, string konfigurasiKendaraan)
    {
        var baku = KonfigurasiKendaraan.Semua.ToList();
        var kendaraan = RapikanGandengan(konfigurasiKendaraan);
        var lain = new[] { kendaraan, RapikanGandengan(nilai) }.Where(x => x != "" && !baku.Contains(x));
        return lain.Concat(baku).Distinct().Select(k => new Komponen.Ui.Opsi(k, $"{LabelGandengan(k)}{(k == kendaraan ? " (sesuai kendaraan)" : "")}")).ToList();
    }

    /// <summary>Kendaraan & supir yang masih dipakai trip lain; trip yang diubah & trip asal backload dilewati.</summary>
    public static Ditahan PetaDitahan(IEnumerable<BarisTrip> rows, params string?[] kecuali)
    {
        var lewati = new HashSet<string>(kecuali.Where(x => !string.IsNullOrEmpty(x))!);
        var d = new Ditahan();
        foreach (var t in rows)
        {
            if (!t.MenahanKendaraan || lewati.Contains(t.Id)) continue;
            if (t.T.VehicleId != "" && !d.Kendaraan.ContainsKey(t.T.VehicleId)) d.Kendaraan[t.T.VehicleId] = t;
            foreach (var s in t.DriverIds) if (s != "" && !d.Supir.ContainsKey(s)) d.Supir[s] = t;
        }
        return d;
    }

    public static string AlasanDitahan(BarisTrip t) => $"Masih di trip {t.IdTampil} · {StatusTrip.Label(t.Status)} · belum kembali ke pool";

    /// <summary>Trip Draft / Menunggu Supir masih bebas diubah; Aktif dan Selesai dikunci.</summary>
    public static bool TripSudahJalan(string? status) => !string.IsNullOrEmpty(status) && status != StatusTrip.Draft && status != StatusTrip.MenungguSopir;

    /// <summary>Pilihan filter status: Karawang tanpa Draft, kecuali masih ada trip draft.</summary>
    public static IEnumerable<string> PilihanStatus(bool karawang, bool adaDraft) => karawang && !adaDraft ? StatusTrip.Urut.Where(s => s != StatusTrip.Draft) : StatusTrip.Urut;

    /// <summary>Kata kunci pencarian No. Referensi: "TR2600512595" dan "2600512595" sama-sama ketemu.</summary>
    public static string CariTr(IEnumerable<string> list) => string.Join(' ', list.SelectMany(tr => new[] { tr, TripLogika.KunciTr(tr), "TR" + TripLogika.KunciTr(tr) }));

    /* ── Titik alamat (Pick Up / Destination) ─────────────────────────────── */

    /// <summary>Nilai pilihan untuk titik trip lama yang diketik manual (belum ada di Master Alamat).</summary>
    public const string TitikLama = "__lama";

    public static string TulisAlamat(Alamat a) => string.Join(", ", new[] { a.Jalan, a.Kota }.Select(s => (s ?? "").Trim()).Where(s => s != ""));

    /// <summary>"PT SLB LAMPUNG | CONTACT: BP IRAWAN 0877…".</summary>
    public static string LabelAlamat(string nama, string? kontak, string? telepon)
    {
        var k = string.Join(' ', new[] { kontak, telepon }.Select(s => (s ?? "").Trim()).Where(s => s != ""));
        return k != "" ? $"{nama} | CONTACT: {k}" : nama;
    }

    /// <summary>Salinan titik dengan isian rapi (trim); kosong bila tidak ada.</summary>
    public static TitikAlamat? TitikRapi(TitikAlamat? t)
    {
        if (t is null) return null;
        var catatan = (t.Catatan ?? "").Trim();
        return new TitikAlamat
        {
            AlamatId = string.IsNullOrEmpty(t.AlamatId) ? null : t.AlamatId,
            Nama = (t.Nama ?? "").Trim(), Jalan = (t.Jalan ?? "").Trim(), Kontak = (t.Kontak ?? "").Trim(), Telepon = (t.Telepon ?? "").Trim(),
            Catatan = catatan == "" ? null : catatan,
        };
    }

    public static bool SamaTitik(TitikAlamat? a, TitikAlamat? b) =>
        JsonSerializer.Serialize(TitikRapi(a), Database.Json) == JsonSerializer.Serialize(TitikRapi(b), Database.Json);

    public static TitikAlamat TitikDariAlamat(Alamat a, string catatan) =>
        TitikRapi(new TitikAlamat { AlamatId = a.Id, Nama = a.Nama, Jalan = TulisAlamat(a), Kontak = a.NamaKontak, Telepon = a.Telepon, Catatan = catatan })!;

    public static bool TitikTerisi(TitikAlamat? t) => t is not null && (!string.IsNullOrEmpty(t.Nama) || !string.IsNullOrEmpty(t.Jalan) || !string.IsNullOrEmpty(t.Kontak) || !string.IsNullOrEmpty(t.Telepon));

    /// <summary>Kode area sama, tanpa beda huruf besar / nomor site ("RAWA 52" = RAWA).</summary>
    public static bool SamaArea(string? a, string? b) => !string.IsNullOrEmpty(a) && !string.IsNullOrEmpty(b) && TripLogika.NormalKodeArea(a) == TripLogika.NormalKodeArea(b);
}
