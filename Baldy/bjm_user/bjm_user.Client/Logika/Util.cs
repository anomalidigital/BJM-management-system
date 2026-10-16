using System.Text.RegularExpressions;

namespace bjm_user.Client.Logika;

public static class Util
{
    private static readonly Random Acak = new();

    /// <summary>Id unik: awalan + 8 huruf/angka acak + 4 digit waktu (padanan uid React).</summary>
    public static string Uid(string awalan = "id")
    {
        const string huruf = "abcdefghijklmnopqrstuvwxyz0123456789";
        var acak = new string(Enumerable.Range(0, 8).Select(_ => huruf[Acak.Next(huruf.Length)]).ToArray());
        var waktu = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds().ToString("x");
        return $"{awalan}_{acak}{waktu[^4..]}";
    }

    public static string Norm(object? v) => (v?.ToString() ?? "").Trim().ToLowerInvariant();

    /// <summary>Seluruh kata kunci harus ada di gabungan isian (pencarian bebas huruf besar/kecil).</summary>
    public static bool CocokCari(string? query, params object?[] isian)
    {
        var q = Norm(query);
        if (q == "") return true;
        var tumpukan = string.Join(' ', isian.Select(Norm));
        return q.Split(' ', StringSplitOptions.RemoveEmptyEntries).All(tumpukan.Contains);
    }

    /// <summary>Pembanding teks alami Indonesia: angka di dalam teks diurutkan sebagai angka, abaikan huruf besar.</summary>
    public static int Banding(object? a, object? b)
    {
        switch (a)
        {
            case long x when b is long y: return x.CompareTo(y);
            case int x when b is int y: return x.CompareTo(y);
            case double x when b is double y: return x.CompareTo(y);
            case bool x when b is bool y: return x.CompareTo(y);
        }
        return BandingAlami(a?.ToString() ?? "", b?.ToString() ?? "");
    }

    private static readonly Regex Potongan = new(@"\d+|\D+", RegexOptions.Compiled);

    public static int BandingAlami(string a, string b)
    {
        var pa = Potongan.Matches(a).Select(m => m.Value).ToList();
        var pb = Potongan.Matches(b).Select(m => m.Value).ToList();
        for (var i = 0; i < Math.Min(pa.Count, pb.Count); i++)
        {
            var x = pa[i]; var y = pb[i];
            int c;
            if (char.IsDigit(x[0]) && char.IsDigit(y[0]))
            {
                c = x.TrimStart('0').Length.CompareTo(y.TrimStart('0').Length);
                if (c == 0) c = string.CompareOrdinal(x.TrimStart('0'), y.TrimStart('0'));
            }
            else c = string.Compare(x, y, StringComparison.OrdinalIgnoreCase);
            if (c != 0) return c;
        }
        return pa.Count.CompareTo(pb.Count);
    }

    /// <summary>Urutkan tanpa membalik hasil: nilai sama tetap di urutan asal (data baru di depan).</summary>
    public static List<T> Urutkan<T>(IEnumerable<T> baris, Func<T, object?>? kunci, bool naik, Func<T, object?>? kunciKedua = null)
    {
        var daftar = baris.ToList();
        if (kunci is null) return daftar;
        var arah = naik ? 1 : -1;
        return daftar
            .Select((r, i) => (r, i))
            .OrderBy(x => x, Comparer<(T r, int i)>.Create((x, y) =>
            {
                var c = arah * Banding(kunci(x.r), kunci(y.r));
                if (c == 0 && kunciKedua is not null) c = arah * Banding(kunciKedua(x.r), kunciKedua(y.r));
                return c != 0 ? c : x.i.CompareTo(y.i);
            }))
            .Select(x => x.r).ToList();
    }

    public static long Clamp(long n, long min, long maks) => Math.Min(maks, Math.Max(min, n));
}
