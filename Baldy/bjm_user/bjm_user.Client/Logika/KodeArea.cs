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
}
