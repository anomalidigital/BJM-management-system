using System.Text.RegularExpressions;
using bjm_user.Client.Model;

namespace bjm_user.Client.Logika;

public sealed class HasilKomisi
{
    public long Nilai { get; init; }
    public long Dasar { get; init; }
    public AturanKomisi? Aturan { get; init; }
    public TingkatKomisi? Tingkat { get; init; }
    public string Keterangan { get; init; } = "";
}

public sealed class DataTripKomisi
{
    public string Role { get; init; } = PeranKaryawan.Sopir;
    public string Layanan { get; init; } = TipeKlien.Callout;
    public string Konfigurasi { get; init; } = "";
    public long CostValue { get; init; }
    public long RoutePrice { get; init; }
    public long Ujroute { get; init; }
    public long UjTotal { get; init; }
}

/// <summary>Komisi otomatis dari Komisi -> tab Aturan (padanan lib/komisi.ts).</summary>
public static class Komisi
{
    /// <summary>"6X6 DL" -> ["6X6", "DL"].</summary>
    public static List<string> TokenKonfigurasi(string konfigurasi) =>
        Regex.Split(konfigurasi.ToUpperInvariant(), @"[\s,/+]+").Where(k => k != "").ToList();

    public static TingkatKomisi? CariTingkat(IEnumerable<TingkatKomisi> tiers, long nilai)
    {
        var urut = tiers.OrderBy(t => t.TargetAwal).ToList();
        if (urut.Count == 0 || nilai <= 0 || nilai < urut[0].TargetAwal) return null;
        return urut.FirstOrDefault(t => t.TargetAkhir == 0 || nilai <= t.TargetAkhir);
    }

    public static long NilaiTingkat(TingkatKomisi t, long dasar) =>
        t.CommissionUnit == "persen" ? (long)Math.Round(dasar * t.Commission / 100) : (long)Math.Round(t.Commission);

    public static string TulisRentang(TingkatKomisi t) =>
        t.TargetAkhir > 0 ? $"{Format.Rupiah(t.TargetAwal)} – {Format.Rupiah(t.TargetAkhir)}" : $"≥ {Format.Rupiah(t.TargetAwal)}";

    /// <summary>Aturan yang berlaku: yang menyebut konfigurasi kendaraan & layanan spesifik lebih diutamakan.</summary>
    public static AturanKomisi? PilihAturan(IEnumerable<AturanKomisi> aturan, string role, string layanan, string konfigurasi)
    {
        var token = new HashSet<string>(TokenKonfigurasi(konfigurasi));
        AturanKomisi? terbaik = null;
        var skor = -1;
        foreach (var s in aturan)
        {
            if (!s.IsActive || (s.Role ?? PeranKaryawan.Sopir) != role || s.Basis == DasarKomisi.Kontrak) continue;
            var l = string.IsNullOrEmpty(s.ServiceType) ? TipeKlien.Callout : s.ServiceType;
            if (l != "semua" && l != layanan) continue;
            var kendaraan = s.Configurations ?? [];
            if (kendaraan.Count > 0 && !kendaraan.Any(k => token.Contains(k.ToUpperInvariant()))) continue;
            var nilai = (kendaraan.Count > 0 ? 2 : 0) + (l != "semua" ? 1 : 0);
            if (nilai > skor) { terbaik = s; skor = nilai; }
        }
        return terbaik;
    }

    /// <summary>Harga trip: harga yang diisi di trip, atau Harga Rute bila kosong.</summary>
    public static long HargaTrip(long costValue, long routePrice) => costValue > 0 ? costValue : routePrice;

    public static long DasarTrip(string basis, DataTripKomisi t) => basis switch
    {
        DasarKomisi.Uj => t.Ujroute != 0 ? t.Ujroute : t.UjTotal,
        DasarKomisi.Nilai => HargaTrip(t.CostValue, t.RoutePrice),
        _ => 0,
    };

    public static HasilKomisi Terapkan(AturanKomisi aturan, long dasarKotor)
    {
        var potong = aturan.BaseDeductionPct;
        var dasar = (long)Math.Round(dasarKotor * (1 - potong / 100));
        var tingkat = CariTingkat(aturan.Tiers ?? [], dasar);
        if (dasarKotor == 0) return new HasilKomisi { Nilai = 0, Dasar = 0, Aturan = aturan, Keterangan = $"{aturan.Name}: nilai dasar belum ada" };
        if (tingkat is null) return new HasilKomisi { Nilai = 0, Dasar = dasar, Aturan = aturan, Keterangan = $"{aturan.Name}: di bawah tingkat pertama" };
        var potongTeks = potong != 0 ? $" setelah potong {Format.Persen(potong)}%" : "";
        return new HasilKomisi
        {
            Nilai = NilaiTingkat(tingkat, dasar), Dasar = dasar, Aturan = aturan, Tingkat = tingkat,
            Keterangan = $"{aturan.Name} · dasar {Format.Rupiah(dasar)}{potongTeks} · tingkat {TulisRentang(tingkat)}",
        };
    }

    public static HasilKomisi HitungTrip(IEnumerable<AturanKomisi> aturan, DataTripKomisi p)
    {
        var s = PilihAturan(aturan, p.Role, p.Layanan, p.Konfigurasi);
        if (s is null)
        {
            var keterangan = p.Layanan == TipeKlien.Dedicated
                ? "Dedicated: komisi dihitung per kontrak, lihat halaman klien"
                : p.Konfigurasi.Trim() != ""
                    ? $"Belum ada aturan komisi untuk kendaraan {p.Konfigurasi.Trim()}"
                    : "Belum ada aturan komisi Callout yang aktif di Komisi → tab Aturan";
            return new HasilKomisi { Keterangan = keterangan };
        }
        return Terapkan(s, DasarTrip(s.Basis, p));
    }

    /// <summary>Komisi kontrak Dedicated, mis. (nilai kontrak − 5%) × 2,5%.</summary>
    public static HasilKomisi? HitungKontrak(IEnumerable<AturanKomisi> aturan, long nilaiKontrak)
    {
        var s = aturan.FirstOrDefault(a => a.IsActive && a.Basis == DasarKomisi.Kontrak && (string.IsNullOrEmpty(a.ServiceType) ? TipeKlien.Dedicated : a.ServiceType) != TipeKlien.Callout);
        return s is null ? null : Terapkan(s, nilaiKontrak);
    }
}
