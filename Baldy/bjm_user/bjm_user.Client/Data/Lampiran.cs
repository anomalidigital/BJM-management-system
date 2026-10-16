using Microsoft.AspNetCore.Components;
using Microsoft.JSInterop;

namespace bjm_user.Client.Data;

public sealed class InfoLampiran
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string Type { get; set; } = "";
    public long Size { get; set; }
    public string Url { get; set; } = "";
    public bool Gambar { get; set; }
}

/// <summary>Lampiran (gambar / PDF) di IndexedDB browser lewat lampiran.js.</summary>
public sealed class Lampiran(IJSRuntime js)
{
    public const string TipeDiterima = "image/*,application/pdf";
    private readonly Dictionary<string, InfoLampiran?> _cache = [];

    public async Task<List<string>> SimpanDariInputAsync(ElementReference input)
    {
        try { return await js.InvokeAsync<List<string>>("sikotis.lampiran.simpanDariInput", input); }
        catch { throw new InvalidOperationException("Berkas gagal disimpan. Coba pilih ulang."); }
    }

    public async Task<InfoLampiran?> InfoAsync(string id)
    {
        if (_cache.TryGetValue(id, out var ada)) return ada;
        InfoLampiran? info = null;
        try { info = await js.InvokeAsync<InfoLampiran?>("sikotis.lampiran.info", id); } catch { /* abaikan */ }
        _cache[id] = info;
        return info;
    }

    public async Task HapusAsync(IEnumerable<string> ids)
    {
        var daftar = ids.ToList();
        if (daftar.Count == 0) return;
        foreach (var id in daftar) _cache.Remove(id);
        try { await js.InvokeVoidAsync("sikotis.lampiran.hapus", daftar); } catch { /* abaikan */ }
    }

    public async Task<int> BersihkanAsync(IEnumerable<string> dipakai)
    {
        try { return await js.InvokeAsync<int>("sikotis.lampiran.bersihkan", dipakai.ToList()); } catch { return 0; }
    }

    public async Task BukaAsync(string url) { try { await js.InvokeVoidAsync("sikotis.lampiran.buka", url); } catch { /* abaikan */ } }
}
