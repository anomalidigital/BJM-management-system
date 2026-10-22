using Microsoft.AspNetCore.Components;

namespace bjm_user.Client.Komponen.Ui;

/// <summary>Satu pilihan dropdown. Pilihan nonaktif tetap tampil (dengan alasannya di Meta) tapi tidak bisa dipilih.</summary>
public sealed class Opsi
{
    public string Value { get; init; } = "";
    public string Label { get; init; } = "";
    public string? Meta { get; init; }
    public string? Keywords { get; init; }
    public bool Disabled { get; init; }

    public Opsi() { }
    public Opsi(string value, string label, string? meta = null, string? keywords = null, bool disabled = false)
    {
        Value = value; Label = label; Meta = meta; Keywords = keywords; Disabled = disabled;
    }

    public static List<Opsi> Dari(IEnumerable<string> nilai, Func<string, string>? label = null) =>
        nilai.Select(v => new Opsi(v, label is null ? v : label(v))).ToList();
}

/// <summary>Aksi di baris pertama daftar dropdown, mis. "Tambah alamat" bila yang dicari belum ada.</summary>
public sealed class AksiTambahan
{
    /// <summary>Teks aksi dari ketikan pencarian saat itu.</summary>
    public Func<string, string> Label { get; init; } = _ => "Tambah";
    public Func<string, Task> OnClick { get; init; } = _ => Task.CompletedTask;
    public bool Disabled { get; init; }
    public string? Hint { get; init; }
}

public sealed record TabItem(string Id, string Label, string? Badge = null);

public sealed record KartuTab(string Id, string Label, IkonDef Ikon, string Nilai, string? Keterangan = null, string? Judul = null);

public sealed record Segmen(string Id, string Label, string? Judul = null);

public sealed class AksiMenu
{
    public string Label { get; init; } = "";
    public IkonDef? Icon { get; init; }
    public Func<Task> OnSelect { get; init; } = () => Task.CompletedTask;
    /// <summary>default | danger</summary>
    public string Tone { get; init; } = "default";
    public bool Disabled { get; init; }
    /// <summary>Keterangan DATA kenapa aksi tidak bisa dipakai (mis. "Sudah ditagih lewat PI 0473"); bukan keterangan hak akses.</summary>
    public string? Alasan { get; init; }
    public AksiMenu() { }
    public AksiMenu(string label, Action onSelect, IkonDef? icon = null, string tone = "default", bool disabled = false)
    {
        Label = label; Icon = icon; Tone = tone; Disabled = disabled; OnSelect = () => { onSelect(); return Task.CompletedTask; };
    }
}

public sealed record Crumb(string Label, string? Ke = null);

public sealed class ChipFilter
{
    public string Label { get; init; } = "";
    /// <summary>Kosong = keterangan saja (mis. periode bawaan), tidak bisa dilepas.</summary>
    public Action? Lepas { get; init; }
    public ChipFilter() { }
    public ChipFilter(string label, Action? lepas = null) { Label = label; Lepas = lepas; }
}

/// <summary>
/// Satu dokumen yang bisa dicetak dari tombol / menu Cetak (mis. "Berita Acara", "Rekap Trip"). Jalankan berupa EventCallback milik
/// halaman pemanggil (EventCallback.Factory.Create(this, ...)) supaya halaman itu dirender ulang dan preview-nya terbuka.
/// </summary>
public sealed record PilihanCetak(string Label, EventCallback Jalankan, string? Keterangan = null);
