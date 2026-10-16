using bjm_user.Client.Logika;
using bjm_user.Client.Model;

namespace bjm_user.Client.Pages.Laporan;

/// <summary>Trip yang berangkat dalam periode, beserta rincian pengeluarannya (tab Per Trip).</summary>
public sealed class BarisPengeluaran
{
    public required BarisTrip R { get; init; }
    /// <summary>Biaya yang dibayar supir dari uang jalan: hanya keterangan, sudah termasuk di uang jalan.</summary>
    public long BiayaSopir { get; init; }
    /// <summary>Total keluar = uang jalan + dibayar perusahaan langsung + biaya internal.</summary>
    public long Keluar { get; init; }
}

/// <summary>Termin uang jalan dalam periode, digabung dengan trip dan supir penerimanya.</summary>
public sealed class TerminTrip
{
    public required TerminUj P { get; init; }
    public required BarisTrip Trip { get; init; }
    /// <summary>Supir penerima termin; termin lama tanpa penerima memakai supir utama trip.</summary>
    public string SupirId { get; init; } = "";
    public string SupirNama { get; init; } = "";
    public string SupirKode { get; init; } = "";
    /// <summary>Transfer ke supir = uang jalan - potong kasbon.</summary>
    public long Tf { get; init; }
}

/// <summary>Nota biaya operasional dalam periode, digabung dengan trip-nya.</summary>
public sealed class NotaTrip
{
    public required BiayaOperasional E { get; init; }
    public required BarisTrip Trip { get; init; }
    /// <summary>Ikut ditagihkan ke klien (isian nota, atau mengikuti jenisnya).</summary>
    public bool Ditagih { get; init; }
    /// <summary>Dibayar perusahaan langsung, bukan dari uang jalan supir.</summary>
    public bool OlehPerusahaan { get; init; }
}

/// <summary>Deret nilai per tanggal untuk grafik garis.</summary>
public sealed record DeretGrafik(List<string> Labels, List<long> Values, bool PerBulan);

/// <summary>Satu seri grafik garis.</summary>
public sealed record SeriGrafik(string Nama, string Warna, List<long> Nilai);

/// <summary>Satu baris diagram peringkat.</summary>
public sealed record BarisPeringkat(string Id, string Label, string? Meta, long Nilai);

/// <summary>Suku deretan angka berhubungan, mis. Uang jalan − Potong kasbon = Transfer ke supir.</summary>
public sealed record SukuRumus(string Label, long Nilai, string? Operator = null, bool Tebal = false);

/// <summary>Perhitungan bersama laporan (padanan fungsi pembantu di LapUangJalanPage / LapBiayaPage React).</summary>
public static class LaporanLogika
{
    /// <summary>Warna palet data (urutan tetap, sama dengan React).</summary>
    public const string Seri1 = "var(--series-1)", Seri2 = "#eb6834", Seri3 = "#1baf7a", Ink2 = "#52514e";
    /// <summary>"Ditagihkan ke klien" hijau seperti lencana "Ke klien" di detail trip.</summary>
    public const string WarnaTagih = "#008300";
    /// <summary>Bagian sisanya: abu-abu, supaya yang ditagihkan menonjol.</summary>
    public const string WarnaSisa = "#c3c2b7";

    public static bool Iso(string? s) => s is { Length: 10 } && Format.Pecah(s, out _, out _, out _) && s[4] == '-' && s[7] == '-';

    private static bool Dalam(string? tanggal, string awal, string akhir) =>
        !string.IsNullOrEmpty(tanggal) && string.CompareOrdinal(tanggal, awal) >= 0 && string.CompareOrdinal(tanggal, akhir) <= 0;

    /// <summary>Trip yang berangkat dalam periode (trip batal tidak dihitung).</summary>
    public static List<BarisPengeluaran> TripPeriode(IEnumerable<BarisTrip> rows, string awal, string akhir) => rows
        .Where(t => Hitung.Dihitung(t) && Dalam(t.T.TransactionDate, awal, akhir))
        .Select(t => new BarisPengeluaran { R = t, BiayaSopir = t.ExpenseTotal - t.BiayaPerusahaan, Keluar = t.UjTotal + t.BiayaPerusahaan + t.InternalTotal })
        .OrderBy(t => t.R.T.TransactionDate, StringComparer.Ordinal).ThenBy(t => t.R.T.TransactionNo, StringComparer.Ordinal)
        .ToList();

    /// <summary>
    /// Termin yang dibayar dalam periode (berdasarkan tanggal bayar termin). Termin trip batal sudah tidak ada
    /// di <c>Db.Data.Termin</c>, jadi otomatis tidak terhitung.
    /// </summary>
    public static List<TerminTrip> TerminPeriode(IEnumerable<TerminUj> termin, Dictionary<string, BarisTrip> tripById, IEnumerable<Karyawan> drivers, string awal, string akhir)
    {
        var supir = drivers.GroupBy(d => d.Id).ToDictionary(g => g.Key, g => g.First());
        var hasil = new List<TerminTrip>();
        foreach (var p in termin)
        {
            if (!Dalam(p.PaymentDate, awal, akhir)) continue;
            if (!tripById.TryGetValue(p.TripId, out var trip)) continue;
            var id = p.DriverId != "" ? p.DriverId : trip.T.DriverId ?? "";
            supir.TryGetValue(id, out var d);
            hasil.Add(new TerminTrip { P = p, Trip = trip, SupirId = id, SupirNama = d?.DriverName ?? "", SupirKode = d?.DriverCode ?? "", Tf = p.UjAmount - p.KasbonDeduction });
        }
        return hasil.OrderBy(x => x.P.PaymentDate, StringComparer.Ordinal).ThenBy(x => x.Trip.T.TransactionNo, StringComparer.Ordinal).ThenBy(x => x.P.Sequence).ToList();
    }

    /// <summary>Nota yang tanggalnya masuk periode. Nota trip batal sudah tidak ada di <c>Db.Data.Biaya</c>.</summary>
    public static List<NotaTrip> NotaPeriode(IEnumerable<BiayaOperasional> biaya, Dictionary<string, BarisTrip> tripById, string awal, string akhir)
    {
        var hasil = new List<NotaTrip>();
        foreach (var e in biaya)
        {
            if (!Dalam(e.ExpenseDate, awal, akhir)) continue;
            if (tripById.TryGetValue(e.TripId, out var trip))
                hasil.Add(new NotaTrip { E = e, Trip = trip, Ditagih = TripLogika.Ditagihkan(e), OlehPerusahaan = TripLogika.DibayarPerusahaan(e) });
        }
        return hasil.OrderBy(x => x.E.ExpenseDate, StringComparer.Ordinal).ThenBy(x => x.Trip.T.TransactionNo, StringComparer.Ordinal).ToList();
    }

    /// <summary>
    /// Uang dorong tetap dicatat sebagai termin Uang Jalan (keputusan 7 Okt 2026). Di Biaya Operasional hanya
    /// ditampilkan sebagai keterangan dan tidak ikut dijumlah / ditagihkan.
    /// </summary>
    public static List<(TerminUj P, BarisTrip Trip)> UangDorongPeriode(IEnumerable<TerminUj> termin, Dictionary<string, BarisTrip> tripById, string awal, string akhir) => termin
        .Where(p => p.Jenis == JenisTermin.UangDorong && Dalam(p.PaymentDate, awal, akhir) && tripById.ContainsKey(p.TripId))
        .Select(p => (p, tripById[p.TripId]))
        .OrderBy(x => x.p.PaymentDate, StringComparer.Ordinal)
        .ToList();

    private static string BulanBerikut(string ym)
    {
        var y = int.Parse(ym[..4]); var m = int.Parse(ym[5..7]);
        return m == 12 ? $"{y + 1}-01" : $"{y}-{m + 1:00}";
    }

    /// <summary>Jumlah nilai per hari untuk grafik garis. Periode lebih dari 62 hari dijumlah per bulan supaya garisnya tetap terbaca.</summary>
    public static DeretGrafik DeretTanggal(string awal, string akhir, IEnumerable<(string Tanggal, long Nilai)> isi)
    {
        if (!Iso(awal) || !Iso(akhir) || string.CompareOrdinal(awal, akhir) > 0) return new DeretGrafik([], [], false);
        var hari = (int)Math.Round((Format.KeTanggal(akhir)!.Value - Format.KeTanggal(awal)!.Value).TotalDays) + 1;
        var perBulan = hari > 62;
        var kunci = new List<string>();
        if (perBulan) for (var k = awal[..7]; string.CompareOrdinal(k, akhir[..7]) <= 0 && kunci.Count < 240; k = BulanBerikut(k)) kunci.Add(k);
        else for (var k = awal; string.CompareOrdinal(k, akhir) <= 0 && kunci.Count < 62; k = Format.TambahHari(k, 1)) kunci.Add(k);
        var urut = kunci.Select((k, i) => (k, i)).ToDictionary(x => x.k, x => x.i);
        var values = kunci.Select(_ => 0L).ToList();
        foreach (var x in isi)
        {
            if (string.IsNullOrEmpty(x.Tanggal) || x.Tanggal.Length < 10) continue;
            if (urut.TryGetValue(perBulan ? x.Tanggal[..7] : x.Tanggal[..10], out var i)) values[i] += x.Nilai;
        }
        var labels = kunci.Select(k => perBulan ? $"{Format.TanggalPendek($"{k}-01").Split(' ')[1]} {k[..4]}" : Format.TanggalPendek(k)).ToList();
        return new DeretGrafik(labels, values, perBulan);
    }

    /// <summary>Persen bagian terhadap total; "&lt;1%" untuk bagian kecil yang bukan nol.</summary>
    public static double Persen(long n, long total) => total > 0 ? n * 100.0 / total : 0;
    public static string TulisPersen(long n, long total)
    {
        var p = Persen(n, total);
        return p > 0 && p < 1 ? "<1%" : $"{Math.Round(p, MidpointRounding.AwayFromZero)}%";
    }

    /// <summary>Penanda ditagihkan per jenis biaya: semua, sebagian, atau tidak sama sekali.</summary>
    public static string PenandaTagih(long nominal, long tagih) =>
        tagih <= 0 ? "tidak ditagihkan" : tagih >= nominal ? "ditagihkan ke klien" : $"sebagian ditagihkan ({Format.RupiahRingkas(tagih)})";

    /// <summary>Gaya persen untuk atribut style (titik desimal, bukan koma).</summary>
    public static string Css(double v) => v.ToString("0.###", System.Globalization.CultureInfo.InvariantCulture);
}
