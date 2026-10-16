using bjm_user.Client.Data;
using bjm_user.Client.Layanan;
using Microsoft.AspNetCore.Components;

namespace bjm_user.Client.Komponen;

/// <summary>Dasar halaman / komponen yang membaca Db & Sesi: merender ulang tiap data berubah.</summary>
public abstract class KomponenData : ComponentBase, IDisposable
{
    [Inject] protected Db Db { get; set; } = default!;
    [Inject] protected Sesi Sesi { get; set; } = default!;
    [Inject] protected Toast Toast { get; set; } = default!;
    [Inject] protected NavigationManager Nav { get; set; } = default!;

    protected bool Bisa(string aksi) => Sesi.Bisa(aksi);
    protected bool Karawang => Db.Karawang;

    protected override void OnInitialized()
    {
        Db.Berubah += Segarkan;
        Sesi.Berubah += Segarkan;
    }

    private void Segarkan() => InvokeAsync(StateHasChanged);

    /// <summary>Pindah halaman.</summary>
    protected void Ke(string url, bool ganti = false) => Nav.NavigateTo(url, replace: ganti);

    public virtual void Dispose()
    {
        Db.Berubah -= Segarkan;
        Sesi.Berubah -= Segarkan;
        GC.SuppressFinalize(this);
    }
}
