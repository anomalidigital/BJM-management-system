using System.Globalization;
using System.IO.Compression;
using System.Net;
using System.Text;
using System.Text.RegularExpressions;

namespace bjm_user.Client.Logika;

/// <summary>
/// Pembaca berkas import master data (Baldy 22 Okt 2026): CSV (pemisah ; , atau tab, dengan / tanpa BOM) dan Excel .xlsx
/// (lembar pertama). Hasilnya baris berisi kolom → nilai, dengan nama kolom dinormalkan ("No. Kendaraan*" → "nokendaraan").
/// Excel dibaca langsung dari isi zip-nya tanpa pustaka tambahan.
/// </summary>
public static class ImportData
{
    /// <summary>Satu baris data: nomor baris di berkas (1 = judul kolom) dan nilainya per kolom ternormal.</summary>
    public sealed record BarisImport(int Nomor, IReadOnlyDictionary<string, string> Nilai)
    {
        public string Ambil(string kolom) => Nilai.TryGetValue(Normal(kolom), out var v) ? v.Trim() : "";
    }

    /// <summary>Nama kolom tanpa spasi, tanda baca, tanda wajib (*), dan huruf besar.</summary>
    public static string Normal(string judul) => new(judul.ToLowerInvariant().Where(char.IsAsciiLetterOrDigit).ToArray());

    /// <summary>Baca berkas CSV / XLSX. Baris yang seluruh isinya kosong dilewati.</summary>
    public static (List<string> Judul, List<BarisImport> Baris) Baca(string namaBerkas, byte[] isi)
    {
        var tabel = namaBerkas.EndsWith(".xlsx", StringComparison.OrdinalIgnoreCase) ? BacaXlsx(isi) : BacaCsv(isi);
        if (tabel.Count == 0) return ([], []);
        var judul = tabel[0].Select(j => j.Trim()).ToList();
        var kunci = judul.Select(Normal).ToList();
        var baris = new List<BarisImport>();
        for (var i = 1; i < tabel.Count; i++)
        {
            var sel = tabel[i];
            if (sel.All(s => string.IsNullOrWhiteSpace(s))) continue;
            var nilai = new Dictionary<string, string>();
            for (var k = 0; k < kunci.Count; k++)
                if (kunci[k] != "" && !nilai.ContainsKey(kunci[k])) nilai[kunci[k]] = k < sel.Count ? sel[k] : "";
            baris.Add(new BarisImport(i + 1, nilai));
        }
        return (judul, baris);
    }

    /* ── CSV ─────────────────────────────────────────────────────────── */

    private static List<List<string>> BacaCsv(byte[] isi)
    {
        var teks = Encoding.UTF8.GetString(isi).TrimStart('﻿');
        // Baris "sep=;" dari Excel menentukan pemisah.
        char? pemisah = null;
        var awal = Regex.Match(teks, @"^sep=(.)\r?\n");
        if (awal.Success) { pemisah = awal.Groups[1].Value[0]; teks = teks[awal.Length..]; }
        var barisPertama = teks.Split('\n')[0];
        pemisah ??= new[] { ';', ',', '\t' }.OrderByDescending(c => barisPertama.Count(x => x == c)).First();

        var hasil = new List<List<string>>();
        var baris = new List<string>();
        var sel = new StringBuilder();
        var kutip = false;
        for (var i = 0; i < teks.Length; i++)
        {
            var c = teks[i];
            if (kutip)
            {
                if (c == '"' && i + 1 < teks.Length && teks[i + 1] == '"') { sel.Append('"'); i++; }
                else if (c == '"') kutip = false;
                else sel.Append(c);
            }
            else if (c == '"') kutip = true;
            else if (c == pemisah) { baris.Add(sel.ToString()); sel.Clear(); }
            else if (c == '\n' || c == '\r')
            {
                if (c == '\r' && i + 1 < teks.Length && teks[i + 1] == '\n') i++;
                baris.Add(sel.ToString()); sel.Clear();
                hasil.Add(baris); baris = [];
            }
            else sel.Append(c);
        }
        if (sel.Length > 0 || baris.Count > 0) { baris.Add(sel.ToString()); hasil.Add(baris); }
        return hasil;
    }

    /* ── XLSX (lembar pertama) ───────────────────────────────────────── */

    private static readonly RegexOptions Ops = RegexOptions.Singleline | RegexOptions.CultureInvariant;

    private static List<List<string>> BacaXlsx(byte[] isi)
    {
        using var zip = new ZipArchive(new MemoryStream(isi), ZipArchiveMode.Read);
        string Teks(string nama)
        {
            var e = zip.GetEntry(nama);
            if (e is null) return "";
            using var r = new StreamReader(e.Open(), Encoding.UTF8);
            return r.ReadToEnd();
        }

        // Teks bersama (shared strings); bagian fonetik (rPh) tidak ikut.
        var bersama = Regex.Matches(Teks("xl/sharedStrings.xml"), @"<si>(.*?)</si>", Ops)
            .Select(m => string.Concat(Regex.Matches(Regex.Replace(m.Groups[1].Value, @"<rPh\b.*?</rPh>", "", Ops), @"<t(?:\s[^>]*)?>(.*?)</t>", Ops)
                .Select(t => WebUtility.HtmlDecode(t.Groups[1].Value))))
            .ToList();

        // Lembar pertama menurut urutan di workbook.
        var lembar = "xl/worksheets/sheet1.xml";
        var rid = Regex.Match(Teks("xl/workbook.xml"), @"<sheet\b[^>]*\br:id=""([^""]+)""", Ops);
        if (rid.Success)
        {
            var tujuan = Regex.Match(Teks("xl/_rels/workbook.xml.rels"), $@"<Relationship\b[^>]*\bId=""{Regex.Escape(rid.Groups[1].Value)}""[^>]*\bTarget=""([^""]+)""", Ops);
            if (!tujuan.Success)
                tujuan = Regex.Match(Teks("xl/_rels/workbook.xml.rels"), $@"<Relationship\b[^>]*\bTarget=""([^""]+)""[^>]*\bId=""{Regex.Escape(rid.Groups[1].Value)}""", Ops);
            if (tujuan.Success) lembar = tujuan.Groups[1].Value.StartsWith('/') ? tujuan.Groups[1].Value.TrimStart('/') : "xl/" + tujuan.Groups[1].Value;
        }

        var hasil = new List<List<string>>();
        foreach (Match baris in Regex.Matches(Teks(lembar), @"<row\b[^>]*?(?:/>|>(.*?)</row>)", Ops))
        {
            var sel = new List<string>();
            foreach (Match c in Regex.Matches(baris.Groups[1].Value, @"<c\b([^>]*?)(?:/>|>(.*?)</c>)", Ops))
            {
                var atribut = c.Groups[1].Value;
                var kolom = Regex.Match(atribut, @"\br=""([A-Z]+)\d+""");
                var indeks = kolom.Success ? IndeksKolom(kolom.Groups[1].Value) : sel.Count;
                while (sel.Count < indeks) sel.Add("");
                var jenis = Regex.Match(atribut, @"\bt=""([^""]+)""").Groups[1].Value;
                var isiSel = c.Groups[2].Value;
                var v = WebUtility.HtmlDecode(Regex.Match(isiSel, @"<v>(.*?)</v>", Ops).Groups[1].Value);
                var nilai = jenis switch
                {
                    "s" => int.TryParse(v, out var n) && n >= 0 && n < bersama.Count ? bersama[n] : "",
                    "inlineStr" => string.Concat(Regex.Matches(isiSel, @"<t(?:\s[^>]*)?>(.*?)</t>", Ops).Select(t => WebUtility.HtmlDecode(t.Groups[1].Value))),
                    "b" => v == "1" ? "TRUE" : "FALSE",
                    _ => v,
                };
                if (indeks < sel.Count) sel[indeks] = nilai; else sel.Add(nilai);
            }
            hasil.Add(sel);
        }
        return hasil;
    }

    private static int IndeksKolom(string huruf)
    {
        var n = 0;
        foreach (var c in huruf) n = n * 26 + (c - 'A' + 1);
        return n - 1;
    }

    /* ── Nilai ───────────────────────────────────────────────────────── */

    /// <summary>Tanggal: 2026-12-31, 31/12/2026, 31-12-2026, 31.12.2026, atau nomor tanggal Excel. Kosong = "" (bukan galat).</summary>
    public static bool Tanggal(string v, out string iso)
    {
        iso = "";
        v = v.Trim();
        if (v == "") return true;
        if (DateTime.TryParseExact(v, ["yyyy-MM-dd", "d/M/yyyy", "d-M-yyyy", "d.M.yyyy", "d/M/yy", "yyyy-MM-ddTHH:mm:ss"], CultureInfo.InvariantCulture, DateTimeStyles.None, out var t)
            || (double.TryParse(v, NumberStyles.Float, CultureInfo.InvariantCulture, out var serial) && serial is > 20000 and < 80000 && (t = DateTime.FromOADate(serial)) != default))
        {
            iso = t.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
            return true;
        }
        return false;
    }

    /// <summary>Rupiah: "Rp 1.500.000", "1500000", "1,500,000.00". Kosong = null.</summary>
    public static long? Rupiah(string v)
    {
        v = v.Trim();
        if (v == "") return null;
        // Desimal (",00" / ".00") di ujung dibuang dulu supaya tidak terbaca ratusan kali lipat.
        v = Regex.Replace(v, @"[.,]\d{1,2}$", "");
        var angka = new string(v.Where(char.IsAsciiDigit).ToArray());
        return long.TryParse(angka, out var n) ? n : null;
    }

    /// <summary>CSV template: hanya baris judul kolom, pemisah titik koma + BOM supaya rapi dibuka Excel berbahasa Indonesia.</summary>
    public static string Template(IEnumerable<string> judul) => "﻿" + string.Join(';', judul.Select(j => j.Contains(';') ? $"\"{j}\"" : j)) + "\r\n";
}
