using System.Text.Json;
using bjm_user.Client.Data;

namespace bjm_user.Client.Komponen.Form;

/// <summary>
/// Kelompok kode area mirip yang ditandai "bukan salah ketik" (mis. SUBAN / SUBANG), disimpan di browser
/// dengan kunci yang sama dengan versi React (sikotis.kodeAreaMirip.v1).
/// </summary>
public static class TandaKodeArea
{
    public static async Task<List<List<string>>> BacaAsync(Penyimpanan simpan)
    {
        var mentah = await simpan.BacaAsync(Penyimpanan.KunciTandaKode);
        if (string.IsNullOrEmpty(mentah)) return [];
        try
        {
            using var doc = JsonDocument.Parse(mentah);
            if (doc.RootElement.ValueKind != JsonValueKind.Array) return [];
            var hasil = new List<List<string>>();
            foreach (var g in doc.RootElement.EnumerateArray())
            {
                if (g.ValueKind != JsonValueKind.Array) continue;
                var isi = g.EnumerateArray().ToList();
                if (isi.All(k => k.ValueKind == JsonValueKind.String)) hasil.Add(isi.Select(k => k.GetString() ?? "").ToList());
            }
            return hasil;
        }
        catch (JsonException) { return []; }
    }

    /// <summary>Penyimpanan browser tidak tersedia: tandanya berlaku sampai halaman dimuat ulang.</summary>
    public static Task SimpanAsync(Penyimpanan simpan, List<List<string>> tanda) =>
        simpan.SimpanAsync(Penyimpanan.KunciTandaKode, JsonSerializer.Serialize(tanda));
}
