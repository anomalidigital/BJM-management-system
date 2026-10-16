using bjm_user.Client.Model;

namespace bjm_user.Client.Logika;

/// <summary>Perhitungan bisnis per trip (padanan lib/calculations.ts). Trip batal tidak dihitung di laporan mana pun.</summary>
public static class Hitung
{
    public static bool Dihitung(BarisTrip r) => !r.Batal;

    public static long Komisi(BarisTrip r) => r.KomisiSopir;

    public static long Pendapatan(BarisTrip r) => Dihitung(r) ? r.Harga : 0;

    /// <summary>Uang jalan sebagai biaya: termin yang dibayar; sebelum ditutup, sisa patokan dianggap masih akan dibayar.</summary>
    public static long UangJalan(BarisTrip r)
    {
        if (!Dihitung(r)) return 0;
        return r.Status == StatusTrip.Selesai && r.TerminCount > 0 ? r.UjTotal : Math.Max(r.UjTotal, r.Ujroute);
    }

    public static long Ditagihkan(BarisTrip r) => Dihitung(r) ? r.BiayaDitagihkan : 0;
    public static long BiayaPerusahaan(BarisTrip r) => Dihitung(r) ? r.BiayaPerusahaan : 0;

    /// <summary>Netto = harga + biaya ditagihkan − uang jalan − biaya perusahaan − komisi.</summary>
    public static long Netto(BarisTrip r) => Dihitung(r) ? r.Harga + r.BiayaDitagihkan - UangJalan(r) - BiayaPerusahaan(r) - Komisi(r) : 0;

    public static int Ritan(BarisTrip _) => 1;

    public sealed record Ringkasan(int Transaksi, int Ritan, long Komisi, long Pendapatan, long Ujroute, long UangJalan, long Ditagihkan, long BiayaPerusahaan, long Netto, long BonPribadi, long Cost);

    public static Ringkasan Ringkas(IEnumerable<BarisTrip> semua)
    {
        var rows = semua.Where(Dihitung).ToList();
        return new Ringkasan(
            rows.Count, rows.Sum(Ritan), rows.Sum(Komisi), rows.Sum(Pendapatan), rows.Sum(r => r.Ujroute), rows.Sum(UangJalan),
            rows.Sum(Ditagihkan), rows.Sum(BiayaPerusahaan), rows.Sum(Netto), rows.Sum(r => r.T.PersonalBon), rows.Sum(r => r.T.CostValue));
    }

    public static double? DeltaPersen(long kini, long lalu) => lalu == 0 ? null : (kini - lalu) * 100.0 / lalu;
}
