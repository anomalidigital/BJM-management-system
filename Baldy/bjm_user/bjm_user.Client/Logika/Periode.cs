namespace bjm_user.Client.Logika;

/// <summary>Periode laporan: bulan terakhir yang punya transaksi, paling jauh bulan berjalan.</summary>
public sealed record Periode(string Awal, string Akhir, DateTime Acuan, bool DariData)
{
    private static Periode Dari(string iso, bool dariData)
    {
        var acuan = Format.KeTanggal(iso) ?? DateTime.Now;
        return new Periode(Format.AwalBulan(acuan), Format.AkhirBulan(acuan), acuan, dariData);
    }

    public static Periode Aktif(IEnumerable<string> tanggal)
    {
        var kini = Format.HariIni();
        var bulanIni = kini[..7];
        var terakhir = tanggal.Where(d => !string.IsNullOrEmpty(d) && d.Length >= 7 && string.CompareOrdinal(d[..7], bulanIni) <= 0)
            .OrderBy(d => d, StringComparer.Ordinal).LastOrDefault();
        if (terakhir is null) return Dari(kini, false);
        if (terakhir[..7] == bulanIni) return Dari(kini, false);
        return Dari(terakhir, true);
    }

    public Periode Sebelumnya()
    {
        var acuan = new DateTime(Acuan.Year, Acuan.Month, 1).AddMonths(-1);
        return new Periode(Format.AwalBulan(acuan), Format.AkhirBulan(acuan), acuan, DariData);
    }

    public bool Memuat(string? iso) => !string.IsNullOrEmpty(iso) && string.CompareOrdinal(iso, Awal) >= 0 && string.CompareOrdinal(iso[..Math.Min(10, iso.Length)], Akhir) <= 0;
}
