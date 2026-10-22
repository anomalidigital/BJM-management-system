using System.Text.RegularExpressions;
using bjm_user.Client.Model;

namespace bjm_user.Client.Logika;

/// <summary>Pembuat nomor & kode otomatis (padanan lib/kode.ts).</summary>
public static class Kode
{
    private const string Konsonan = "BCDFGHJKLMNPQRSTVWXYZ";
    private static readonly Random Acak = new();

    /// <summary>
    /// No. Kendaraan pola TNKB: kode wilayah 1–2 huruf, nomor 1–4 angka, seri 0–3 huruf ("B 9015 UWW", "AB 1 C").
    /// Ketikan "b9015uww" atau "B 9015UWW" dirapikan; yang tidak sesuai pola hanya dibesarkan dan spasinya dirapikan.
    /// </summary>
    public static string RapikanNoKendaraan(string? s)
    {
        var m = Regex.Match(KunciNoKendaraan(s), @"^([A-Z]{1,2})(\d{1,4})([A-Z]{0,3})$");
        if (m.Success) return string.Join(' ', new[] { m.Groups[1].Value, m.Groups[2].Value, m.Groups[3].Value }.Where(x => x != ""));
        return Regex.Replace((s ?? "").Trim().ToUpperInvariant(), @"\s+", " ");
    }

    /// <summary>No. Kendaraan tanpa spasi / tanda baca, untuk membandingkan ("B9015UWW" = "B 9015 UWW").</summary>
    public static string KunciNoKendaraan(string? s) => Regex.Replace((s ?? "").ToUpperInvariant(), @"[^A-Z0-9]", "");

    /// <summary>13 digit waktu + 7 huruf mati acak, mis. 1779754321123KDFRZMP (ID Perjalanan Priok).</summary>
    public static string BuatKodeUnik(IEnumerable<string>? terpakai = null)
    {
        var ada = new HashSet<string>((terpakai ?? []).Select(k => k.ToUpperInvariant()));
        while (true)
        {
            var huruf = new string(Enumerable.Range(0, 7).Select(_ => Konsonan[Acak.Next(Konsonan.Length)]).ToArray());
            var kode = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() + huruf;
            if (!ada.Contains(kode)) return kode;
        }
    }

    /// <summary>Nomor berurut berawalan tetap: INV-001, KLN001.</summary>
    public static string NomorBerurut(string awalan, IEnumerable<string> nomorAda, int digit)
    {
        long maks = 0;
        foreach (var n in nomorAda)
        {
            if (!n.ToUpperInvariant().StartsWith(awalan)) continue;
            var angka = new string(n[awalan.Length..].Where(char.IsDigit).ToArray());
            if (long.TryParse(angka, out var v)) maks = Math.Max(maks, v);
        }
        return awalan + (maks + 1).ToString().PadLeft(digit, '0');
    }

    private static readonly string[] BadanUsaha = ["PT", "CV", "UD", "TBK"];

    /// <summary>Kode klien: singkatan nama (PT Sumber Pangan Dingin -> SPD), unik; KLN001 bila nama kosong.</summary>
    public static string KodeKlienBerikut(string nama, IEnumerable<string> terpakai)
    {
        var daftar = terpakai.ToList();
        var ada = new HashSet<string>(daftar.Select(k => k.ToUpperInvariant()));
        var kata = Regex.Split(nama.ToUpperInvariant(), "[^A-Z0-9]+").Where(k => k != "" && !BadanUsaha.Contains(k)).ToList();
        var dasar = (kata.Count > 1 ? string.Concat(kata.Select(k => k[0])) : kata.FirstOrDefault() ?? "");
        dasar = dasar.Length > 5 ? dasar[..5] : dasar;
        if (dasar == "") return NomorBerurut("KLN", daftar, 3);
        var kode = dasar;
        for (var i = 2; ada.Contains(kode); i++) kode = $"{dasar}{i}";
        return kode;
    }

    public static string KodeKaryawanBerikut(IEnumerable<Karyawan> karyawan, string peran)
    {
        var awalan = PeranKaryawan.Awalan(peran);
        long maks = 0;
        foreach (var k in karyawan)
        {
            if (!k.DriverCode.ToUpperInvariant().StartsWith(awalan)) continue;
            var angka = new string(k.DriverCode.Where(char.IsDigit).ToArray());
            if (long.TryParse(angka, out var v)) maks = Math.Max(maks, v);
        }
        return awalan + (maks + 1).ToString().PadLeft(3, '0');
    }

    /// <summary>Kode Trip berikutnya untuk bulan tanggal itu: YYYYMM + 4 digit urut.</summary>
    public static string NomorTripBerikut(IEnumerable<string> nomorAda, string tanggalIso)
    {
        var ym = tanggalIso.Length >= 7 ? tanggalIso[..4] + tanggalIso[5..7] : DateTime.Now.ToString("yyyyMM");
        long maks = 0;
        foreach (var n in nomorAda)
        {
            if (!n.StartsWith(ym) || n.Length < 10) continue;
            if (long.TryParse(n[6..10], out var v)) maks = Math.Max(maks, v);
        }
        return ym + (maks + 1).ToString().PadLeft(4, '0');
    }

    public static string NomorSuratJalanBerikut(IEnumerable<string> nomorAda)
    {
        long maks = 0;
        foreach (var n in nomorAda)
        {
            var angka = new string(n.Where(char.IsDigit).ToArray());
            if (long.TryParse(angka, out var v)) maks = Math.Max(maks, v);
        }
        return "SJ-" + (maks + 1).ToString().PadLeft(6, '0');
    }

    public static string NomorKontrakBerikut(IEnumerable<string> nomorAda, string tahun)
    {
        var awalan = $"KTR-{tahun}-";
        long maks = 0;
        foreach (var n in nomorAda) if (n.StartsWith(awalan) && long.TryParse(n[awalan.Length..], out var v)) maks = Math.Max(maks, v);
        return awalan + (maks + 1).ToString().PadLeft(3, '0');
    }

    /* ── No. Rute ───────────────────────────────────────────────────────────── */

    public static readonly Regex PenandaBackload = new(@"\s+(BCKLD|BKLD|BACKLOAD)$", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static string Empat(string v)
    {
        var bersih = new string(v.ToUpperInvariant().Where(char.IsAsciiLetterOrDigit).ToArray());
        return bersih.Length > 4 ? bersih[..4] : bersih;
    }

    private static (string Asal, string Tujuan)? BagianRute(string nama)
    {
        var i = nama.IndexOf(" - ", StringComparison.Ordinal);
        if (i < 0) return null;
        return (nama[..i], nama[(nama.LastIndexOf(" - ", StringComparison.Ordinal) + 3)..]);
    }

    /// <summary>Pola aplikasi lama: 4 huruf asal + 4 huruf tujuan ("AKP 01 - JTB 174" -> AKP0JTB1).</summary>
    public static string KodeRuteDasar(string namaRute)
    {
        var b = BagianRute(namaRute);
        return b is null ? Empat(namaRute) : Empat(b.Value.Asal) + Empat(b.Value.Tujuan);
    }

    /// <summary>
    /// No. Rute lengkap: asal 4 huruf, lalu tiap kata tujuan 4 huruf, angka utuh (dua angka berurutan dipisah "-"),
    /// penanda backload jadi BL: "CIB - SAMBAR MOVING 1" -> CIBSAMBMOVI1, "DURI - KB 575 2" -> DURIKB575-2.
    /// </summary>
    public static string KodeRuteLengkap(string namaRute, bool kataPertamaUtuh = false)
    {
        var b = BagianRute(namaRute);
        var tujuanMentah = b?.Tujuan ?? namaRute;
        var balik = PenandaBackload.IsMatch(tujuanMentah);
        var kata = Regex.Split(PenandaBackload.Replace(tujuanMentah, "").ToUpperInvariant(), "[^A-Z0-9]+").Where(k => k != "").ToList();
        var tujuan = "";
        var angkaSebelumnya = false;
        for (var i = 0; i < kata.Count; i++)
        {
            var k = kata[i];
            var angka = k.All(char.IsDigit);
            if (angka) tujuan += (angkaSebelumnya ? "-" : "") + k;
            else
            {
                var batas = i == 0 && kataPertamaUtuh ? 10 : 4;
                tujuan += k.Length > batas ? k[..batas] : k;
            }
            angkaSebelumnya = angka;
        }
        return (b is null ? "" : Empat(b.Value.Asal)) + tujuan + (balik ? "BL" : "");
    }

    /// <summary>No. Rute dari nama, dibuat sekali saat rute disimpan: pola dasar bila tidak bentrok, kode lengkap bila bentrok.</summary>
    public static string KodeRuteDari(string namaRute, IEnumerable<Rute> rute)
    {
        var daftar = rute.ToList();
        var ada = new HashSet<string>(daftar.Select(r => r.RouteCode.ToUpperInvariant()));
        var dasar = KodeRuteDasar(namaRute);
        if (dasar == "") dasar = "RUTE";
        var sePola = daftar.Any(r => KodeRuteDasar(r.RouteName) == dasar);
        var lengkap = KodeRuteLengkap(namaRute); if (lengkap == "") lengkap = dasar;
        var utuh = KodeRuteLengkap(namaRute, true); if (utuh == "") utuh = dasar;
        var calon = new List<string>();
        if (!sePola) calon.Add(dasar);
        calon.Add(lengkap); calon.Add(utuh);
        var bebas = calon.FirstOrDefault(k => !ada.Contains(k.ToUpperInvariant()));
        if (bebas is not null) return bebas;
        for (var n = 2; ; n++) if (!ada.Contains($"{lengkap}-{n}".ToUpperInvariant())) return $"{lengkap}-{n}";
    }

    /// <summary>Rapikan No. Rute warisan aplikasi lama yang pola dasarnya bentrok; kode lama disimpan di RouteCodeLama.</summary>
    public static void RapikanNoRuteLama(List<Rute> routes)
    {
        var kelompok = new Dictionary<string, List<Rute>>();
        foreach (var r in routes)
        {
            var d = KodeRuteDasar(r.RouteName);
            if (d == "") continue;
            if (!kelompok.TryGetValue(d, out var l)) kelompok[d] = l = [];
            l.Add(r);
        }
        var sasaran = new Dictionary<string, string>();
        foreach (var (dasar, rs) in kelompok)
        {
            if (rs.Count < 2) continue;
            foreach (var r in rs) { var k = KodeRuteLengkap(r.RouteName); sasaran[r.Id] = k == "" ? dasar : k; }
        }
        if (sasaran.Count == 0) return;
        var dipakai = new HashSet<string>(routes.Where(r => !sasaran.ContainsKey(r.Id)).Select(r => r.RouteCode.ToUpperInvariant()));
        var akhir = new Dictionary<string, string>();
        string KodeAsli(Rute r) => r.RouteCodeLama ?? r.RouteCode;
        foreach (var r in routes.Where(x => sasaran.ContainsKey(x.Id)).OrderBy(KodeAsli, StringComparer.Ordinal).ThenBy(x => x.Id, StringComparer.Ordinal))
        {
            var k = sasaran[r.Id];
            if (dipakai.Contains(k.ToUpperInvariant())) { var u = KodeRuteLengkap(r.RouteName, true); k = u == "" ? k : u; }
            if (dipakai.Contains(k.ToUpperInvariant()))
            {
                var akar = sasaran[r.Id];
                var n = 2;
                while (dipakai.Contains($"{akar}-{n}".ToUpperInvariant())) n++;
                k = $"{akar}-{n}";
            }
            dipakai.Add(k.ToUpperInvariant());
            akhir[r.Id] = k;
        }
        foreach (var r in routes)
        {
            if (akhir.TryGetValue(r.Id, out var k) && k != r.RouteCode)
            {
                r.RouteCodeLama ??= r.RouteCode;
                r.RouteCode = k;
            }
        }
    }
}
