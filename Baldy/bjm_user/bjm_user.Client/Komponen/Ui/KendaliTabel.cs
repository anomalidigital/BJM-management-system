using bjm_user.Client.Logika;

namespace bjm_user.Client.Komponen.Ui;

/// <summary>Keadaan tabel standar: pencarian + urutan + halaman (jumlah baris per halaman tetap, tanpa pemilih).</summary>
public sealed class KendaliTabel<T>
{
    public KendaliTabel(int pageSize = 10, string? sortKey = null, bool naik = true)
    {
        PageSize = pageSize; SortKey = sortKey; Naik = naik;
    }

    public string Query { get; private set; } = "";
    public string? SortKey { get; private set; }
    public bool Naik { get; private set; }
    public int Page { get; private set; } = 1;
    public int PageSize { get; }
    public int Total { get; private set; }
    public int TotalPages => Math.Max(1, (int)Math.Ceiling(Total / (double)PageSize));

    /// <summary>Pencarian bebas: predikat baris vs kata kunci.</summary>
    public Func<T, string, bool>? Search { get; set; }
    /// <summary>Peta kunci kolom -> nilai yang dipakai mengurutkan.</summary>
    public Func<string, Func<T, object?>>? SortAccessor { get; set; }
    public Func<T, object?>? TieBreak { get; set; }
    public Func<T, bool>? ExtraFilter { get; set; }
    public bool ExtraFilterActive { get; set; }

    public bool IsFiltered => Query.Trim() != "" || ExtraFilterActive;

    /// <summary>Seluruh baris tersaring & terurut (dipakai total / cetak / ekspor).</summary>
    public List<T> Saring(IEnumerable<T> rows)
    {
        IEnumerable<T> out_ = rows;
        if (Query.Trim() != "" && Search is not null) out_ = out_.Where(r => Search(r, Query));
        if (ExtraFilter is not null) out_ = out_.Where(ExtraFilter);
        var daftar = out_.ToList();
        if (SortKey is not null && SortAccessor is not null) daftar = Util.Urutkan(daftar, SortAccessor(SortKey), Naik, TieBreak);
        Total = daftar.Count;
        if (Page > TotalPages) Page = TotalPages;
        return daftar;
    }

    /// <summary>Baris halaman yang sedang tampil.</summary>
    public List<T> Halaman(List<T> tersaring) => tersaring.Skip((Page - 1) * PageSize).Take(PageSize).ToList();

    public void ToggleSort(string key)
    {
        if (SortKey == key) Naik = !Naik; else { SortKey = key; Naik = true; }
        Page = 1;
    }
    public void SetQuery(string v) { Query = v; Page = 1; }
    public void SetPage(int p) { Page = Math.Max(1, p); }
    public void Reset() { Query = ""; Page = 1; }
}
