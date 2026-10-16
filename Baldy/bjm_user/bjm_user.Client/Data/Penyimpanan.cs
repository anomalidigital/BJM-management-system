using Microsoft.JSInterop;

namespace bjm_user.Client.Data;

/// <summary>localStorage browser lewat sikotis.js. Kunci sama dengan versi React supaya data di browser yang sama tetap terbaca.</summary>
public sealed class Penyimpanan(IJSRuntime js)
{
    public const string KunciDb = "sikotis.db.v2";
    public const string KunciAuth = "sikotis.auth.v1";
    public const string KunciAkun = "sikotis.users.v1";
    public const string KunciWorkspace = "sikotis.workspace.v2";
    public const string KunciMigrasi = "sikotis.migrasi.v1";
    public const string KunciTandaKode = "sikotis.kodeAreaMirip.v1";

    public async Task<string?> BacaAsync(string kunci)
    {
        try { return await js.InvokeAsync<string?>("sikotis.baca", kunci); } catch { return null; }
    }

    public async Task<bool> SimpanAsync(string kunci, string nilai)
    {
        try { return await js.InvokeAsync<bool>("sikotis.simpan", kunci, nilai); } catch { return false; }
    }

    public async Task HapusAsync(string kunci)
    {
        try { await js.InvokeVoidAsync("sikotis.hapus", kunci); } catch { /* abaikan */ }
    }

    public async Task CetakAsync() { try { await js.InvokeVoidAsync("sikotis.cetak"); } catch { /* abaikan */ } }
    public async Task UnduhAsync(string nama, string isi, string mime = "application/json") { try { await js.InvokeVoidAsync("sikotis.unduh", nama, isi, mime); } catch { /* abaikan */ } }
    public async Task FokusAsync(string selector) { try { await js.InvokeVoidAsync("sikotis.fokus", selector); } catch { /* abaikan */ } }
    public async Task GulirKeAsync(string selector) { try { await js.InvokeVoidAsync("sikotis.gulirKe", selector); } catch { /* abaikan */ } }
    public async Task AturHalamanCetakAsync(string orientasi) { try { await js.InvokeVoidAsync("sikotis.aturHalamanCetak", orientasi); } catch { /* abaikan */ } }
    public async Task HapusHalamanCetakAsync() { try { await js.InvokeVoidAsync("sikotis.hapusHalamanCetak"); } catch { /* abaikan */ } }
    public async Task KunciGulirAsync(bool kunci) { try { await js.InvokeVoidAsync("sikotis.kunciGulir", kunci); } catch { /* abaikan */ } }
}
