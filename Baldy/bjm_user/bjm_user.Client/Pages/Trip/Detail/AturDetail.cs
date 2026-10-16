using System.Globalization;
using bjm_user.Client.Logika;
using bjm_user.Client.Model;
using Microsoft.AspNetCore.Components;

namespace bjm_user.Client.Pages.Trip.Detail;

/// <summary>Aturan kecil halaman Detail Trip dan tab-tabnya (padanan potongan TripDetailPage.tsx & tab trip React).</summary>
public static class AturDetail
{
    /// <summary>Nama tab di URL (?tab=). Tab "dokumen" dulu bernama "lainnya": alamat lama tetap dikenali.</summary>
    public const string Overview = "overview", Perjalanan = "perjalanan", Uj = "uj", Biaya = "biaya", Internal = "internal", Dokumen = "dokumen";

    public static string NormalTab(string? tab) => tab == "lainnya" ? Dokumen : tab ?? Overview;

    /// <summary>Trip workspace Karawang (kosong = Priok, data lama).</summary>
    public static bool Karawang(BarisTrip t) => t.T.Workspace == WorkspaceKode.Karawang;

    public static string Strip(string? v) => string.IsNullOrEmpty(v) ? "—" : v;

    /// <summary>Alamat tab detail trip, atau form Edit bila tab = "edit".</summary>
    public static string AlamatTab(string tripId, string tab) =>
        tab == "edit" ? $"transaksi/trip/{tripId}/edit" : $"transaksi/trip/{tripId}{(tab == Overview ? "" : $"?tab={tab}")}";

    /// <summary>Jam lokal dari timestamp ISO (created_at): yyyy-mm-ddThh:mm.</summary>
    public static string Lokal(string? iso)
    {
        if (string.IsNullOrEmpty(iso)) return "";
        return DateTimeOffset.TryParse(iso, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var d)
            ? d.ToLocalTime().ToString("yyyy-MM-ddTHH:mm", CultureInfo.InvariantCulture)
            : "";
    }

    /// <summary>Waktu mobil tercatat di pool: isian trip, atau catatan "Tiba di pool" terakhir.</summary>
    public static string WaktuPool(BarisTrip t, IEnumerable<KejadianTrip> kejadian) =>
        !string.IsNullOrEmpty(t.T.PoolAt) ? t.T.PoolAt : kejadian.LastOrDefault(e => e.Jenis == "pool")?.Waktu ?? "";

    /// <summary>Teks biasa sebagai RenderFragment (untuk Hint Field); null tetap null.</summary>
    public static RenderFragment? Teks(string? s) => s is null ? null : b => b.AddContent(0, s);

    /// <summary>"Tol, DEX, ..., dan ASDP": jenis biaya yang bawaannya ditagihkan ke klien, urut daftar jenis.</summary>
    public static string JenisDitagihkan()
    {
        var nama = JenisBiaya.Semua.Where(j => JenisBiaya.Ditagihkan.Contains(j)).Select(JenisBiaya.Label).ToList();
        return nama.Count > 1 ? $"{string.Join(", ", nama.Take(nama.Count - 1))}, dan {nama[^1]}" : string.Concat(nama);
    }

    /// <summary>Gaya garis-coret untuk arsip trip batal.</summary>
    public static string Coret(bool batal) => batal ? "text-decoration-line-through" : "";
}
