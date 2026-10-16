using System.Globalization;
using System.Text;

namespace bjm_user.Client.Logika;

/// <summary>Format khas Indonesia (Rupiah, tanggal dd/mm/yyyy, angka ribuan) tanpa bergantung ICU browser.</summary>
public static class Format
{
    private const string Nbsp = " ";
    private static readonly string[] Bulan = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    private static readonly string[] BulanPendek = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
    private static readonly string[] Hari = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

    /// <summary>12500000 -> "12.500.000"; -1500 -> "-1.500".</summary>
    public static string Angka(long v)
    {
        var s = Math.Abs(v).ToString(CultureInfo.InvariantCulture);
        var sb = new StringBuilder();
        for (var i = 0; i < s.Length; i++)
        {
            if (i > 0 && (s.Length - i) % 3 == 0) sb.Append('.');
            sb.Append(s[i]);
        }
        return (v < 0 ? "-" : "") + sb;
    }

    public static string Angka(long? v) => v is null ? "-" : Angka(v.Value);
    public static string Angka(double v) => Angka((long)Math.Round(v));

    public static string Rupiah(long v) => $"Rp{Nbsp}{Angka(v)}";
    public static string Rupiah(long? v) => v is null ? "-" : Rupiah(v.Value);
    public static string Rupiah(double v) => Rupiah((long)Math.Round(v));
    public static string RupiahRingkas(long v) => $"Rp{Nbsp}{Ringkas(v)}";

    /// <summary>12500000 -> "12,5 jt"; 1284 -> "1.284"; 4200000000 -> "4,2 M".</summary>
    public static string Ringkas(long v)
    {
        var abs = Math.Abs((double)v);
        var tanda = v < 0 ? "-" : "";
        static string Potong(double n) => (n % 1 == 0 ? n.ToString("0", CultureInfo.InvariantCulture) : n.ToString("0.0", CultureInfo.InvariantCulture)).Replace('.', ',');
        if (abs >= 1_000_000_000) return $"{tanda}{Potong(abs / 1_000_000_000)}{Nbsp}M";
        if (abs >= 1_000_000) return $"{tanda}{Potong(abs / 1_000_000)}{Nbsp}jt";
        if (abs >= 10_000) return $"{tanda}{Potong(abs / 1_000)}{Nbsp}rb";
        return Angka(v);
    }

    /// <summary>"2026-08-01" -> "01/08/2026".</summary>
    public static string Tanggal(string? iso)
    {
        if (string.IsNullOrEmpty(iso) || iso.Length < 10) return "-";
        var b = iso[..10].Split('-');
        return b.Length == 3 ? $"{b[2]}/{b[1]}/{b[0]}" : "-";
    }

    /// <summary>"2026-08-01" -> "1 Agustus 2026".</summary>
    public static string TanggalPanjang(string? iso)
    {
        if (!Pecah(iso, out var y, out var m, out var d)) return "-";
        return $"{d} {Bulan[m - 1]} {y}";
    }

    /// <summary>"2026-08-01" -> "1 Agu".</summary>
    public static string TanggalPendek(string? iso) => Pecah(iso, out _, out var m, out var d) ? $"{d} {BulanPendek[m - 1]}" : "-";

    /// <summary>"2026-10-14" -> "Rab, 14 Okt 2026" (isian tanggal).</summary>
    public static string TanggalHari(string? iso)
    {
        if (!Pecah(iso, out var y, out var m, out var d)) return "";
        var hari = Hari[(int)new DateTime(y, m, d).DayOfWeek];
        return $"{hari}, {d} {BulanPendek[m - 1]} {y}";
    }

    /// <summary>"2026-08-01" -> "Agustus 2026".</summary>
    public static string LabelBulan(string? iso) => Pecah(iso, out var y, out var m, out _) ? $"{Bulan[m - 1]} {y}" : "-";

    /// <summary>"2026-09-12T08:00" -> "12/09/2026 08:00".</summary>
    public static string Waktu(string? waktu)
    {
        if (string.IsNullOrEmpty(waktu)) return "—";
        var bagian = waktu.Split('T');
        var tgl = Tanggal(bagian[0]);
        return bagian.Length > 1 && bagian[1].Length >= 5 ? $"{tgl} {bagian[1][..5]}" : tgl;
    }

    /// <summary>Tanggal + jam untuk footer "Dicetak pada".</summary>
    public static string WaktuCetak(DateTime? d = null)
    {
        var t = d ?? DateTime.Now;
        return $"{t:dd/MM/yyyy HH:mm}";
    }

    public static bool Pecah(string? iso, out int y, out int m, out int d)
    {
        y = m = d = 0;
        if (string.IsNullOrEmpty(iso) || iso.Length < 10) return false;
        var b = iso[..10].Split('-');
        return b.Length == 3 && int.TryParse(b[0], out y) && int.TryParse(b[1], out m) && int.TryParse(b[2], out d)
            && y > 0 && m is >= 1 and <= 12 && d is >= 1 and <= 31;
    }

    public static string KeIso(DateTime d) => $"{d:yyyy-MM-dd}";
    public static string HariIni() => KeIso(DateTime.Now);
    public static string AwalBulan(DateTime? acuan = null) { var r = acuan ?? DateTime.Now; return KeIso(new DateTime(r.Year, r.Month, 1)); }
    public static string AkhirBulan(DateTime? acuan = null) { var r = acuan ?? DateTime.Now; return KeIso(new DateTime(r.Year, r.Month, DateTime.DaysInMonth(r.Year, r.Month))); }
    /// <summary>Waktu sekarang dalam format isian: yyyy-mm-ddThh:mm.</summary>
    public static string SekarangLokal() => $"{DateTime.Now:yyyy-MM-ddTHH:mm}";
    public static string SekarangIso() => DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ", CultureInfo.InvariantCulture);

    public static string TambahHari(string iso, int hari) => Pecah(iso, out var y, out var m, out var d) ? KeIso(new DateTime(y, m, d).AddDays(hari)) : iso;

    public static DateTime? KeTanggal(string? iso) => Pecah(iso, out var y, out var m, out var d) ? new DateTime(y, m, d) : null;

    /// <summary>Isian uang: "12.500.000" -> 12500000.</summary>
    public static long BacaUang(string? mentah)
    {
        if (string.IsNullOrEmpty(mentah)) return 0;
        var digit = new string(mentah.Where(char.IsDigit).ToArray());
        return digit.Length > 0 && long.TryParse(digit, out var v) ? v : 0;
    }

    public static string Inisial(string nama)
    {
        var kata = nama.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries).Take(2);
        return string.Concat(kata.Select(k => char.ToUpperInvariant(k[0])));
    }

    /// <summary>"01/10/2026 – 31/10/2026", "sejak 01/10/2026", "s/d 31/10/2026".</summary>
    public static string RentangTanggal(string dari, string sampai)
    {
        if (dari != "" && sampai != "") return $"{Tanggal(dari)} – {Tanggal(sampai)}";
        if (dari != "") return $"sejak {Tanggal(dari)}";
        if (sampai != "") return $"s/d {Tanggal(sampai)}";
        return "";
    }

    /// <summary>Pesan bila rentang tanggal terbalik; null bila boleh.</summary>
    public static string? GalatRentang(string dari, string sampai) =>
        dari != "" && sampai != "" && string.CompareOrdinal(dari, sampai) > 0 ? "Tanggal awal tidak boleh lebih besar dari tanggal akhir." : null;

    public static string Persen(double v) => v.ToString("0.#", CultureInfo.InvariantCulture).Replace('.', ',');
}
