using bjm_user.Client.Model;

namespace bjm_user.Client.Logika;

/// <summary>Kasbon karyawan: saldo = jumlah seluruh mutasi (positif menambah utang karyawan).</summary>
public static class Kasbon
{
    public static long Saldo(IEnumerable<MutasiKasbon> entries, string employeeId, string kecualiUjId = "") =>
        entries.Where(e => e.EmployeeId == employeeId && (kecualiUjId == "" || e.UjPaymentId != kecualiUjId)).Sum(e => e.Amount);

    public static Dictionary<string, long> PetaSaldo(IEnumerable<MutasiKasbon> entries)
    {
        var m = new Dictionary<string, long>();
        foreach (var e in entries) m[e.EmployeeId] = m.GetValueOrDefault(e.EmployeeId) + e.Amount;
        return m;
    }

    /// <summary>Arah bawaan tiap jenis mutasi; manual ikut tanda nominalnya.</summary>
    public static int Arah(string kind) => kind switch
    {
        JenisKasbon.Admin => 1, JenisKasbon.Trip => -1, JenisKasbon.Pembatalan => 1, JenisKasbon.Lunas => -1, _ => 0,
    };

    /// <summary>Jenis di layar: piutang (utang bertambah) atau lunas.</summary>
    public static string JenisPiutang(MutasiKasbon e) => e.Amount > 0 ? "piutang" : "lunas";

    /// <summary>Nilai dari sisi karyawan: piutang tampil minus, pelunasan plus.</summary>
    public static long SisiKaryawan(long amount) => amount == 0 ? 0 : -amount;
}
