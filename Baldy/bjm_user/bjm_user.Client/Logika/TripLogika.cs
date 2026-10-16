using System.Text.RegularExpressions;
using bjm_user.Client.Model;

namespace bjm_user.Client.Logika;

/// <summary>Aturan kecil seputar trip Karawang: TR, lokasi muat & bongkar, backload, ATA, nomor PI (padanan lib/trip.ts).</summary>
public static class TripLogika
{
    /// <summary>ID Perjalanan pertama trip (item muatan pertama yang ber-ID, atau trip_ids data lama).</summary>
    public static string IdPerjalanan(Trip t) =>
        (t.Muatan ?? []).Select(m => m.IdPerjalanan.Trim()).FirstOrDefault(x => x != "")
        ?? t.TripIds.FirstOrDefault(x => !string.IsNullOrEmpty(x)) ?? "";

    /// <summary>Add Items Details: isian muatan, atau disusun dari ID Perjalanan & Jenis Barang data lama.</summary>
    public static List<ItemMuatan> Muatan(Trip t)
    {
        if (t.Muatan is not null) return t.Muatan;
        var ids = t.TripIds.Where(x => !string.IsNullOrEmpty(x)).ToList();
        var barang = t.GoodsType.Trim();
        if (ids.Count == 0) return barang != "" ? [new ItemMuatan { IdPerjalanan = "", Keterangan = barang }] : [];
        return ids.Select((id, i) => new ItemMuatan { IdPerjalanan = id, Keterangan = i == 0 ? barang : "" }).ToList();
    }

    /// <summary>TR trip: daftar baru, atau satu TR data lama.</summary>
    public static List<string> Tr(Trip t)
    {
        if (t.TrNumbers is not null) return t.TrNumbers.Where(x => !string.IsNullOrEmpty(x)).ToList();
        var lama = t.TrReference.Trim();
        return lama != "" ? [lama] : [];
    }

    public static string RapikanTr(string v) => Regex.Replace(v.Trim().ToUpperInvariant(), @"\s+", "");

    /// <summary>Kunci pembanding TR: "TR2600512595" dan "2600512595" adalah nomor yang sama.</summary>
    public static string KunciTr(string v)
    {
        var bersih = new string(v.ToUpperInvariant().Where(char.IsAsciiLetterOrDigit).ToArray());
        return Regex.Replace(bersih, @"^TR(?=\d)", "");
    }

    /// <summary>Nama rute "ASAL - TUJUAN": asal sebelum " - " pertama; penanda backload di ujung dibuang.</summary>
    public static (string Asal, string Tujuan) LokasiRute(string namaRute)
    {
        var nama = namaRute.Trim();
        var i = nama.IndexOf(" - ", StringComparison.Ordinal);
        static string TanpaPenanda(string v) => Kode.PenandaBackload.Replace(v, "").Trim();
        if (i < 0) return ("", TanpaPenanda(nama));
        return (nama[..i].Trim(), TanpaPenanda(nama[(i + 3)..]));
    }

    /// <summary>Lokasi muat & bongkar trip: isian sendiri, atau turunan nama rute.</summary>
    public static (string Muat, string Bongkar) Lokasi(Trip t, string namaRute)
    {
        var r = LokasiRute(namaRute);
        var muat = (t.LokasiMuat ?? "").Trim();
        var bongkar = (t.LokasiBongkar ?? "").Trim();
        return (muat != "" ? muat : r.Asal, bongkar != "" ? bongkar : r.Tujuan);
    }

    /// <summary>Kode area dari satu sisi nama rute: nomor site di ujung dibuang ("RAWA 52" -> RAWA, "BLSE (2)" -> BLSE).</summary>
    public static string NormalKodeArea(string v)
    {
        var s = v.Trim().ToUpperInvariant();
        s = Regex.Replace(s, @"\s*\(\d+\)$", "");
        s = Regex.Replace(s, @"\s+\d{1,2}$", "");
        return s.Trim();
    }

    /// <summary>Kode area pick up & destinasi rute: isian di master Rute, atau turunan namanya.</summary>
    public static (string Asal, string Tujuan) KodeArea(Rute r) => KodeArea(r.RouteName, r.KodeAreaAsal, r.KodeAreaTujuan);

    public static (string Asal, string Tujuan) KodeArea(string routeName, string? kodeAsal, string? kodeTujuan)
    {
        var l = LokasiRute(routeName ?? "");
        var asal = (kodeAsal ?? "").Trim().ToUpperInvariant();
        var tujuan = (kodeTujuan ?? "").Trim().ToUpperInvariant();
        return (asal != "" ? asal : NormalKodeArea(l.Asal), tujuan != "" ? tujuan : NormalKodeArea(l.Tujuan));
    }

    /// <summary>Trip ini masih menahan kendaraannya (aturan 12 Okt 2026) sampai batal / kembali ke pool / dilanjutkan backload.</summary>
    public static bool MenahanKendaraan(Trip t, bool sudahDiPool, bool adaLanjutan)
    {
        if (t.VehicleId == "" || t.Status == StatusTrip.Batal) return false;
        if (!string.IsNullOrEmpty(t.PoolAt) || sudahDiPool || adaLanjutan) return false;
        if (t.Status == StatusTrip.Selesai && string.IsNullOrEmpty(t.ClosedAt)) return false;
        return true;
    }

    public static bool SamaLokasi(string a, string b) => a.Trim() != "" && string.Equals(a.Trim(), b.Trim(), StringComparison.OrdinalIgnoreCase);

    /// <summary>Kode trip backload = kode trip asal + "-BL" (backload kedua: -BL2).</summary>
    public static string IdBackload(string idAsal, IEnumerable<string> terpakai)
    {
        var ada = new HashSet<string>(terpakai.Select(x => x.ToUpperInvariant()));
        var dasar = $"{(idAsal == "" ? "TRIP" : idAsal)}-BL";
        if (!ada.Contains(dasar.ToUpperInvariant())) return dasar;
        for (var i = 2; ; i++) if (!ada.Contains($"{dasar}{i}".ToUpperInvariant())) return $"{dasar}{i}";
    }

    /// <summary>Kejadian perjalanan satu trip, urut waktu.</summary>
    public static List<KejadianTrip> Kejadian(IEnumerable<KejadianTrip> semua, string tripId) =>
        semua.Where(e => e.TripId == tripId).OrderBy(e => e.Waktu, StringComparer.Ordinal).ThenBy(e => e.CreatedAt, StringComparer.Ordinal).ToList();

    /// <summary>ATA = kejadian "Tiba di tujuan" pertama.</summary>
    public static string Ata(IEnumerable<KejadianTrip> urut) => urut.FirstOrDefault(e => e.Jenis == "tiba")?.Waktu ?? "";

    public static bool DibayarPerusahaan(BiayaOperasional e) => e.Dibayar == PembayarBiaya.Perusahaan;

    /// <summary>Biaya ini ikut ditagihkan ke klien? Isian per biaya, atau mengikuti jenisnya.</summary>
    public static bool Ditagihkan(BiayaOperasional e) => e.Ditagihkan ?? JenisBiaya.Ditagihkan.Contains(e.ExpenseType);

    private static readonly string[] Romawi = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

    /// <summary>Nomor PI berikutnya: 0661/SLB/BJM/VIII/2026; urutan empat digit berlanjut terus.</summary>
    public static string NomorPiBerikut(IEnumerable<string> nomorAda, string kodeKlien, string tanggalIso, int tambahan = 0)
    {
        long maks = 0;
        foreach (var n in nomorAda)
        {
            var m = Regex.Match(n ?? "", @"^\s*(\d+)");
            if (m.Success && long.TryParse(m.Groups[1].Value, out var v)) maks = Math.Max(maks, v);
        }
        var bulan = Format.Pecah(tanggalIso, out _, out var mm, out _) ? Romawi[mm - 1] : "I";
        var kode = (string.IsNullOrEmpty(kodeKlien) ? "KLIEN" : kodeKlien).ToUpperInvariant();
        var tahun = tanggalIso.Length >= 4 ? tanggalIso[..4] : DateTime.Now.Year.ToString();
        return $"{(maks + 1 + tambahan).ToString().PadLeft(4, '0')}/{kode}/BJM/{bulan}/{tahun}";
    }
}
