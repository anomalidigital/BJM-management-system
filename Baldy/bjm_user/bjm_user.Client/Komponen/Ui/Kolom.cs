using Microsoft.AspNetCore.Components;

namespace bjm_user.Client.Komponen.Ui;

/// <summary>Definisi kolom DataTable. Isi sel lewat Render (markup) atau Teks (string).</summary>
public sealed class Kolom<T>
{
    public string Key { get; init; } = "";
    public string Header { get; init; } = "";
    public RenderFragment<T>? Render { get; init; }
    public Func<T, string>? Teks { get; init; }
    public bool Sortable { get; init; }
    /// <summary>left | right | center</summary>
    public string Align { get; init; } = "left";
    public string? Width { get; init; }
    public string? HeaderClass { get; init; }
    public string? CellClass { get; init; }
    /// <summary>Kolom hanya untuk layar (tidak ikut cetak).</summary>
    public bool NoPrint { get; init; }
}
