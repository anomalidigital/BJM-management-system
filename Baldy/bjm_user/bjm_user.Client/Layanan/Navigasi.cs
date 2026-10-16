using bjm_user.Client.Komponen;
using bjm_user.Client.Model;

namespace bjm_user.Client.Layanan;

public sealed record ItemNav(string Label, string Ke, IkonDef Ikon, string? Workspace = null);
public sealed record GrupNav(string? Judul, ItemNav[] Items);

/// <summary>Struktur menu utama (susunan Ibu Anne, revisi 12 Okt 2026). Tools dibuka dari menu akun.</summary>
public static class Navigasi
{
    public static readonly GrupNav[] Grup =
    [
        new(null, [new("Dashboard", "dashboard", Ikon.GaugeHigh)]),
        new(null, [new("Trip / Job Order", "transaksi/trip", Ikon.TruckFast)]),
        new("Laporan",
        [
            new("Pengeluaran", "laporan/pengeluaran", Ikon.Wallet),
            new("Tagihan", "transaksi/tagihan", Ikon.FileInvoiceDollar),
            new("Komisi", "laporan/komisi", Ikon.SackDollar),
            new("Piutang Karyawan", "laporan/piutang-karyawan", Ikon.HandHoldingDollar),
        ]),
        new("Master Data",
        [
            new("Supir / Karyawan", "master/karyawan", Ikon.Users),
            new("Kendaraan", "master/mobil", Ikon.Truck),
            new("Rute", "master/rute", Ikon.Route),
            new("Alamat", "master/alamat", Ikon.MapLocationDot),
            new("Klien / Pelanggan", "master/klien", Ikon.Building),
        ]),
        new(null, [new("Dokumen", "dokumen", Ikon.FolderOpen)]),
        new("Pencarian", [new("SI / Job Order", "pencarian/sijo", Ikon.MagnifyingGlass, WorkspaceKode.Priok)]),
        new("Pengaturan",
        [
            new("Pengguna & Peran", "pengaturan/pengguna", Ikon.UsersGear),
            new("Audit Log", "pengaturan/audit-log", Ikon.ClockRotateLeft),
        ]),
    ];

    public static IEnumerable<GrupNav> Untuk(string workspace) => Grup
        .Select(g => new GrupNav(g.Judul, g.Items.Where(i => i.Workspace is null || i.Workspace == workspace).ToArray()))
        .Where(g => g.Items.Length > 0);

    /// <summary>Tujuan satu label breadcrumb: judul grup → halaman pertama grup; label menu → halamannya.</summary>
    public static string? CariHref(string label)
    {
        var cari = label.Trim().ToLowerInvariant();
        foreach (var g in Grup)
        {
            if (g.Judul is not null && g.Judul.ToLowerInvariant() == cari) return g.Items[0].Ke;
            foreach (var it in g.Items) if (it.Label.ToLowerInvariant() == cari) return it.Ke;
        }
        return null;
    }
}
