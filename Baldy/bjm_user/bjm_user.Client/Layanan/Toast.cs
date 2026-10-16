namespace bjm_user.Client.Layanan;

public sealed record PesanToast(int Id, string Jenis, string Teks);

/// <summary>Pemberitahuan singkat di pojok layar (role=status).</summary>
public sealed class Toast
{
    private int _urut;
    public List<PesanToast> Daftar { get; } = [];
    public event Action? Berubah;

    public void Sukses(string teks) => Tambah("sukses", teks);
    public void Info(string teks) => Tambah("info", teks);
    public void Galat(string teks) => Tambah("galat", teks);

    private void Tambah(string jenis, string teks)
    {
        var p = new PesanToast(++_urut, jenis, teks);
        Daftar.Add(p);
        if (Daftar.Count > 4) Daftar.RemoveAt(0);
        Berubah?.Invoke();
        _ = TutupNantiAsync(p.Id, jenis == "galat" ? 6000 : 4000);
    }

    private async Task TutupNantiAsync(int id, int ms)
    {
        await Task.Delay(ms);
        Tutup(id);
    }

    public void Tutup(int id)
    {
        if (Daftar.RemoveAll(x => x.Id == id) > 0) Berubah?.Invoke();
    }
}
