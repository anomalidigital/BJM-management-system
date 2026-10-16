using System.Text.Json;

namespace bjm_user.Client.Komponen.Ui;

/// <summary>
/// Kendali satu panel filter (revisi 14 Okt 2026): isian panel adalah draf, baru berlaku setelah Terapkan.
/// T = kelas isian filter biasa (properti publik); dibandingkan lewat JSON.
/// </summary>
public sealed class KendaliFilter<T> where T : class, new()
{
    private readonly Func<T> _awal;
    private readonly Action _berubah;

    public KendaliFilter(Func<T> awal, Action berubah, T? nilaiAwal = null)
    {
        _awal = awal; _berubah = berubah;
        Nilai = nilaiAwal ?? Salin(awal());
        Draf = Salin(Nilai);
    }

    private static T Salin(T v) => JsonSerializer.Deserialize<T>(JsonSerializer.Serialize(v))!;
    private static bool Sama(T a, T b) => JsonSerializer.Serialize(a) == JsonSerializer.Serialize(b);

    /// <summary>Filter yang sedang berlaku (dipakai menyaring tabel).</summary>
    public T Nilai { get; private set; }
    /// <summary>Isian panel yang belum diterapkan.</summary>
    public T Draf { get; private set; }
    public T Awal => _awal();

    public void Ubah(Action<T> patch) { patch(Draf); _berubah(); }
    public void Mulai() { Draf = Salin(Nilai); }
    public void Terapkan() { Nilai = Salin(Draf); _berubah(); }
    public void Kosongkan() { Draf = Salin(_awal()); _berubah(); }
    /// <summary>Pasang filter langsung tanpa panel.</summary>
    public void Atur(Action<T> patch) { patch(Nilai); Draf = Salin(Nilai); _berubah(); }
    /// <summary>Lepas sebagian filter: salin isian yang dilepas dari nilai awal (mis. (n, a) => n.Status = a.Status).</summary>
    public void Lepas(Action<T, T> salinDariAwal) { salinDariAwal(Nilai, _awal()); Draf = Salin(Nilai); _berubah(); }
    public void LepasSemua() { Nilai = Salin(_awal()); Draf = Salin(Nilai); _berubah(); }
    public bool BelumDiterapkan => !Sama(Draf, Nilai);
    public bool DrafTerisi => !Sama(Draf, _awal());
    public bool Aktif => !Sama(Nilai, _awal());
}
