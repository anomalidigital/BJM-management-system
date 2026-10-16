using System.Text.RegularExpressions;
using bjm_user.Client.Model;

namespace bjm_user.Client.Logika;

public sealed class PakaiKode
{
    public int Rute { get; set; }
    public int Alamat { get; set; }
    public int Total => Rute + Alamat;
    public string Teks => string.Join(", ", new[] { Rute > 0 ? $"{Rute} rute" : "", Alamat > 0 ? $"{Alamat} alamat" : "" }.Where(x => x != ""));
}

public sealed class UbahRute
{
    public required Rute Rute { get; init; }
    public required string NamaBaru { get; init; }
    public string? KodeAreaAsal { get; init; }
    public string? KodeAreaTujuan { get; init; }
    public Rute? KembarDengan { get; init; }
}

public sealed class RencanaRapikan
{
    public List<UbahRute> Rute { get; init; } = [];
    public List<UbahRute> Kembar { get; init; } = [];
    public List<(Alamat Alamat, string KodeLama)> Alamat { get; init; } = [];
}

/// <summary>Kode area pick up & destinasi: perapian, deteksi salah ketik, pemakaian (padanan lib/kodeArea.ts).</summary>
public static class KodeArea
{
    public static string Rapikan(string v) => Regex.Replace(v.ToUpperInvariant(), @"\s+", " ").TrimStart();

    /// <summary>Kunci pembanding: tanpa spasi & tanda baca; penanda backload di ujung dibuang.</summary>
    public static string Kunci(string kode)
    {
        var s = Regex.Replace(kode.Trim().ToUpperInvariant(), @"\s+(BCKLD|BKLD|BACKLOAD)$", "");
        return new string(s.Where(char.IsAsciiLetterOrDigit).ToArray());
    }

    private static int JarakEdit(string a, string b)
    {
        var prev = Enumerable.Range(0, b.Length + 1).ToArray();
        for (var i = 1; i <= a.Length; i++)
        {
            var cur = new int[b.Length + 1];
            cur[0] = i;
            for (var j = 1; j <= b.Length; j++)
                cur[j] = Math.Min(Math.Min(prev[j] + 1, cur[j - 1] + 1), prev[j - 1] + (a[i - 1] == b[j - 1] ? 0 : 1));
            prev = cur;
        }
        return prev[b.Length];
    }

    /// <summary>Dua kode mirip (mungkin salah ketik): sama tanpa spasi, atau beda sedikit huruf (batas ikut panjang).</summary>
    public static bool Mirip(string a, string b)
    {
        var x = a.Trim().ToUpperInvariant();
        var y = b.Trim().ToUpperInvariant();
        if (x == "" || y == "" || x == y) return false;
        var ka = Kunci(x); var kb = Kunci(y);
        if (ka == "" || kb == "") return false;
        if (ka == kb) return true;
        var pendek = Math.Min(ka.Length, kb.Length);
        var batas = pendek >= 8 ? 2 : pendek >= 4 ? 1 : 0;
        return batas > 0 && Math.Abs(ka.Length - kb.Length) <= batas && JarakEdit(ka, kb) <= batas;
    }

    public static Dictionary<string, PakaiKode> Pemakaian(IEnumerable<Rute> routes, IEnumerable<Alamat>? alamat = null, string? kecualiRute = null)
    {
        var m = new Dictionary<string, PakaiKode>();
        void Tambah(string kode, bool rute)
        {
            var k = kode.Trim().ToUpperInvariant();
            if (k == "") return;
            if (!m.TryGetValue(k, out var p)) m[k] = p = new PakaiKode();
            if (rute) p.Rute++; else p.Alamat++;
        }
        foreach (var r in routes)
        {
            if (r.Id == kecualiRute) continue;
            var k = TripLogika.KodeArea(r);
            Tambah(k.Asal, true);
            if (k.Tujuan != k.Asal) Tambah(k.Tujuan, true);
        }
        foreach (var a in alamat ?? []) Tambah(a.KodeArea, false);
        return m;
    }

    /// <summary>Kelompok kode yang mirip satu sama lain; yang paling banyak dipakai di depan.</summary>
    public static List<List<string>> KelompokMirip(Dictionary<string, PakaiKode> pakai)
    {
        var kode = pakai.Keys.ToList();
        var induk = kode.ToDictionary(k => k, k => k);
        string Akar(string k) { var x = k; while (induk[x] != x) x = induk[x]; return x; }
        for (var i = 0; i < kode.Count; i++)
            for (var j = i + 1; j < kode.Count; j++)
                if (Mirip(kode[i], kode[j])) induk[Akar(kode[i])] = Akar(kode[j]);
        var grup = new Dictionary<string, List<string>>();
        foreach (var k in kode) { var a = Akar(k); if (!grup.TryGetValue(a, out var l)) grup[a] = l = []; l.Add(k); }
        int Total(string k) => pakai.TryGetValue(k, out var p) ? p.Total : 0;
        return grup.Values.Where(g => g.Count > 1)
            .Select(g => g.OrderByDescending(Total).ThenBy(x => x, StringComparer.Ordinal).ToList())
            .OrderBy(g => g[0], StringComparer.Ordinal).ToList();
    }

    public static bool SudahDitandai(List<string> kelompok, List<List<string>> tanda) => tanda.Any(t => kelompok.All(t.Contains));

    public static (string Kode, PakaiKode Pakai)? Saran(string kode, Dictionary<string, PakaiKode> pakai, List<List<string>>? tanda = null)
    {
        var v = kode.Trim().ToUpperInvariant();
        if (v == "") return null;
        var sendiri = pakai.TryGetValue(v, out var ps) ? ps.Total : 0;
        (string, PakaiKode)? hasil = null;
        foreach (var (k, p) in pakai)
        {
            if (p.Total <= sendiri || !Mirip(v, k)) continue;
            if ((tanda ?? []).Any(t => t.Contains(v) && t.Contains(k))) continue;
            if (hasil is null || p.Total > hasil.Value.Item2.Total) hasil = (k, p);
        }
        return hasil;
    }

    private static readonly Regex BukanNamaKota = new(@"^(KAB|KABUPATEN|KOTA|KEC|KECAMATAN|KEL|KELURAHAN|DESA|PROV|PROVINSI)\.?$", RegexOptions.Compiled);
    private static readonly Regex BukanNamaLokasi = new(@"^(PT|CV|UD|TBK|PERSERO|WELLSITE|SITE|GUDANG|DEPO|BASE)\.?$", RegexOptions.Compiled);

    /// <summary>Kode area alamat baru dari kota ("Duri, Riau 28884" -> DURI); kota kosong = dua kata pertama nama lokasi.</summary>
    public static string DariLokasi(string kota, string nama)
    {
        var bagianKota = kota.Split(',')[0].ToUpperInvariant();
        var dariKota = Regex.Split(Regex.Replace(bagianKota, @"\d+", " "), "[^A-Z]+").Where(k => k != "" && !BukanNamaKota.IsMatch(k)).ToList();
        if (dariKota.Count > 0) return string.Join(' ', dariKota);
        var dariNama = Regex.Split(Regex.Replace(nama.ToUpperInvariant(), @"\(.*?\)", " "), "[^A-Z0-9]+").Where(k => k != "" && !BukanNamaLokasi.IsMatch(k)).ToList();
        return string.Join(' ', dariNama.Take(2));
    }

    public static string KunciNamaLokasi(string nama) =>
        string.Join(' ', Regex.Split(nama.ToUpperInvariant(), "[^A-Z0-9]+").Where(k => k != "" && !Regex.IsMatch(k, "^(PT|CV|UD|TBK|PERSERO)$")));

    /// <summary>Alamat yang mungkin sama dengan nama lokasi yang diketik.</summary>
    public static List<Alamat> AlamatMirip(string nama, IEnumerable<Alamat> daftar, int batas = 3)
    {
        var k = KunciNamaLokasi(nama);
        if (k.Length < 4) return [];
        var semua = daftar.ToList();
        var sama = semua.Where(a => KunciNamaLokasi(a.Nama) == k);
        var memuat = semua.Where(a => { var x = KunciNamaLokasi(a.Nama); return x != k && x.Length >= 4 && (x.Contains(k) || k.Contains(x)); });
        return sama.Concat(memuat).Take(batas).ToList();
    }

    public static string KunciNamaRute(string nama) => new(nama.ToUpperInvariant().Where(char.IsAsciiLetterOrDigit).ToArray());

    private static readonly Regex PenandaBalik = new(@"\s+(BCKLD|BKLD|BACKLOAD)$", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    /// <summary>Rencana menyatukan penulisan satu kelompok kode area ke `benar` (nama rute, isian area, kode alamat).</summary>
    public static RencanaRapikan RencanaRapikan(List<string> kelompok, string benar, List<Rute> routes, List<Alamat> alamat)
    {
        var salah = new HashSet<string>(kelompok.Select(k => k.Trim().ToUpperInvariant()).Where(k => k != benar));
        string GantiBagian(string bagian)
        {
            var teks = bagian.Trim().ToUpperInvariant();
            var area = TripLogika.NormalKodeArea(teks);
            return salah.Contains(area) && teks.StartsWith(area) ? benar + teks[area.Length..] : teks;
        }
        string GantiNama(string nama)
        {
            var bagian = nama.Split(" - ");
            if (bagian.Length < 2) return GantiBagian(nama);
            var akhir = bagian[^1];
            var penanda = PenandaBalik.Match(akhir).Value;
            bagian[0] = GantiBagian(bagian[0]);
            bagian[^1] = GantiBagian(penanda != "" ? akhir[..^penanda.Length] : akhir) + penanda.ToUpperInvariant();
            return string.Join(" - ", bagian);
        }
        string? GantiIsian(string? v) => v is not null && salah.Contains(v.Trim().ToUpperInvariant()) ? benar : v;

        var akhirNama = new Dictionary<string, Rute>();
        foreach (var r in routes) akhirNama[KunciNamaRute(r.RouteName)] = r;
        var hasil = new RencanaRapikan();
        foreach (var r in routes)
        {
            var namaBaru = GantiNama(r.RouteName);
            var asal = GantiIsian(r.KodeAreaAsal);
            var tujuan = GantiIsian(r.KodeAreaTujuan);
            if (namaBaru == r.RouteName.Trim().ToUpperInvariant() && asal == r.KodeAreaAsal && tujuan == r.KodeAreaTujuan) continue;
            var turunan = TripLogika.KodeArea(namaBaru, null, null);
            var ubah = new UbahRute
            {
                Rute = r, NamaBaru = namaBaru,
                KodeAreaAsal = asal is not null && TripLogika.NormalKodeArea(asal) != TripLogika.NormalKodeArea(turunan.Asal) ? asal : null,
                KodeAreaTujuan = tujuan is not null && TripLogika.NormalKodeArea(tujuan) != TripLogika.NormalKodeArea(turunan.Tujuan) ? tujuan : null,
                KembarDengan = akhirNama.TryGetValue(KunciNamaRute(namaBaru), out var lain) && lain.Id != r.Id ? lain : null,
            };
            if (ubah.KembarDengan is not null) { hasil.Kembar.Add(ubah); continue; }
            akhirNama.Remove(KunciNamaRute(r.RouteName));
            akhirNama[KunciNamaRute(namaBaru)] = r;
            hasil.Rute.Add(ubah);
        }
        foreach (var a in alamat.Where(a => salah.Contains(a.KodeArea.Trim().ToUpperInvariant()))) hasil.Alamat.Add((a, a.KodeArea));
        return hasil;
    }
}
