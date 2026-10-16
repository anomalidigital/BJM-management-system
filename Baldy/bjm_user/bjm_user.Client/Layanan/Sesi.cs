using System.Text.Json;
using bjm_user.Client.Data;
using bjm_user.Client.Logika;
using bjm_user.Client.Model;

namespace bjm_user.Client.Layanan;

/// <summary>Pengguna yang sedang masuk (simulasi, sampai backend ada).</summary>
public sealed class PenggunaMasuk
{
    public string Username { get; set; } = "";
    public string Name { get; set; } = "";
    public string Role { get; set; } = Peran.Admin;
}

/// <summary>Sesi: siapa yang masuk, perannya & izinnya, workspace aktif, dan daftar akun (Pengguna & Peran).</summary>
public sealed class Sesi(Penyimpanan simpan)
{
    public PenggunaMasuk? Pengguna { get; private set; }
    public bool SudahMasuk => Pengguna is not null;
    public string Workspace { get; private set; } = WorkspaceKode.Karawang;
    public List<Pengguna> Akun { get; private set; } = [];
    public bool Siap { get; private set; }
    public event Action? Berubah;

    /// <summary>Matriks izin (Meeting 17 Sep 2026). Admin hanya input harian; Manager semua kecuali hapus trip & pengguna; Owner semua.</summary>
    public static readonly (string Aksi, string Label, string[] Peran)[] Izin =
    [
        ("trip", "Input / ubah trip harian (termasuk uang jalan)", [Peran.Owner, Peran.Manager, Peran.Admin]),
        ("nota", "Catat nota biaya operasional (tol, solar, SPSI, overnight, ...)", [Peran.Owner, Peran.Manager, Peran.Admin]),
        ("master", "Tambah rute & data master", [Peran.Owner, Peran.Manager]),
        ("biaya", "Biaya internal, hapus nota, dan ubah status ditagihkan / dibayar oleh", [Peran.Owner, Peran.Manager]),
        ("override", "Override biaya (harga di luar Harga Rute, uang jalan di atas patokan)", [Peran.Owner, Peran.Manager]),
        ("bukti", "Upload bukti persetujuan", [Peran.Owner, Peran.Manager]),
        ("batal", "Batalkan trip", [Peran.Owner, Peran.Manager]),
        // 15 Okt 2026 (Baldy): admin juga boleh membuat PI — antrian Dashboard "Buat PI lalu tagihkan" berlaku untuknya.
        ("tagihan", "Buat PI & ubah tahap tagihan", [Peran.Owner, Peran.Manager, Peran.Admin]),
        ("komisi", "Ubah aturan komisi", [Peran.Owner]),
        ("audit", "Lihat Audit Log", [Peran.Owner, Peran.Manager]),
        ("hapus", "Hapus trip permanen", [Peran.Owner]),
        ("pengguna", "Pengaturan pengguna & peran", [Peran.Owner]),
    ];

    public bool Bisa(string aksi)
    {
        var peran = Pengguna?.Role;
        if (peran is null) return false;
        var izin = Izin.FirstOrDefault(i => i.Aksi == aksi);
        return izin.Aksi is not null && izin.Peran.Contains(peran);
    }

    public static bool PeranBisa(string peran, string aksi)
    {
        var izin = Izin.FirstOrDefault(i => i.Aksi == aksi);
        return izin.Aksi is not null && izin.Peran.Contains(peran);
    }

    /// <summary>Boleh menambah / mengubah data master (padanan canEdit).</summary>
    public bool BisaMaster => Bisa("master");

    private static readonly (string Username, string Name, string Role)[] AkunAwal =
    [
        ("owner", "Owner", Peran.Owner), ("manager", "Manager Operasional", Peran.Manager),
        ("admin", "Admin Harian", Peran.Admin), ("viewer", "Management Viewer", Peran.Viewer),
    ];

    public async Task MuatAsync()
    {
        var auth = await simpan.BacaAsync(Penyimpanan.KunciAuth);
        if (!string.IsNullOrEmpty(auth))
        {
            try { Pengguna = JsonSerializer.Deserialize<PenggunaMasuk>(auth, Database.Json); } catch { Pengguna = null; }
            if (Pengguna is not null && (string.IsNullOrEmpty(Pengguna.Username) || !Peran.Semua.Contains(Pengguna.Role))) Pengguna = null;
        }
        var ws = (await simpan.BacaAsync(Penyimpanan.KunciWorkspace) ?? "").Trim('"');
        Workspace = WorkspaceKode.Semua.Contains(ws) ? ws : WorkspaceKode.Karawang;
        var akun = await simpan.BacaAsync(Penyimpanan.KunciAkun);
        List<Pengguna>? daftar = null;
        if (!string.IsNullOrEmpty(akun))
        {
            try { daftar = JsonSerializer.Deserialize<List<Pengguna>>(akun, Database.Json); } catch { daftar = null; }
        }
        if (daftar is null || daftar.Count == 0)
        {
            var waktu = Format.SekarangIso();
            daftar = AkunAwal.Select(a => new Pengguna { Username = a.Username, Name = a.Name, Role = a.Role, Aktif = true, CreatedAt = waktu, UpdatedAt = waktu }).ToList();
            await simpan.SimpanAsync(Penyimpanan.KunciAkun, JsonSerializer.Serialize(daftar, Database.Json));
        }
        Akun = daftar;
        Siap = true;
        Berubah?.Invoke();
    }

    public const string SandiDefault = "BJM2026";

    /// <summary>
    /// Masuk (simulasi sampai backend ada): hanya akun yang terdaftar & aktif di Pengguna & Peran dengan sandi BJM2026.
    /// Di produksi diganti POST /api/v1/auth/public/login.
    /// </summary>
    public async Task MasukAsync(string username, string password)
    {
        await Task.Delay(350);
        var nama = username.Trim();
        if (nama == "") throw new InvalidOperationException("Username wajib diisi.");
        if (password.Trim() == "") throw new InvalidOperationException("Password wajib diisi.");
        if (!string.Equals(password.Trim(), SandiDefault, StringComparison.Ordinal))
            throw new InvalidOperationException("Password yang dimasukkan salah.");
        var akun = Akun.FirstOrDefault(p => string.Equals(p.Username, nama, StringComparison.OrdinalIgnoreCase))
            ?? throw new InvalidOperationException("Akun tidak terdaftar. Minta Owner menambahkannya di Pengguna & Peran.");
        if (!akun.Aktif) throw new InvalidOperationException("Akun ini dinonaktifkan. Hubungi Owner.");
        Pengguna = new PenggunaMasuk { Username = akun.Username, Name = akun.Name, Role = akun.Role };
        await simpan.SimpanAsync(Penyimpanan.KunciAuth, JsonSerializer.Serialize(Pengguna, Database.Json));
        Berubah?.Invoke();
    }

    public async Task KeluarAsync()
    {
        Pengguna = null;
        await simpan.HapusAsync(Penyimpanan.KunciAuth);
        Berubah?.Invoke();
    }

    public async Task GantiWorkspaceAsync(string ws)
    {
        if (!WorkspaceKode.Semua.Contains(ws) || ws == Workspace) return;
        Workspace = ws;
        await simpan.SimpanAsync(Penyimpanan.KunciWorkspace, ws);
        Berubah?.Invoke();
    }

    /// <summary>Tambah atau ubah akun; `usernameLama` dipakai bila username diganti.</summary>
    public async Task SimpanAkunAsync(Pengguna p, string? usernameLama = null)
    {
        var waktu = Format.SekarangIso();
        var kunci = (usernameLama ?? p.Username).ToLowerInvariant();
        var ada = Akun.FirstOrDefault(x => x.Username.ToLowerInvariant() == kunci);
        if (ada is not null)
        {
            ada.Username = p.Username; ada.Name = p.Name; ada.Role = p.Role; ada.Aktif = p.Aktif; ada.UpdatedAt = waktu;
            if (Pengguna is not null && string.Equals(Pengguna.Username, usernameLama ?? p.Username, StringComparison.OrdinalIgnoreCase))
            {
                Pengguna = new PenggunaMasuk { Username = ada.Username, Name = ada.Name, Role = ada.Role };
                await simpan.SimpanAsync(Penyimpanan.KunciAuth, JsonSerializer.Serialize(Pengguna, Database.Json));
            }
        }
        else
        {
            p.CreatedAt = waktu; p.UpdatedAt = waktu;
            Akun.Add(p);
        }
        await simpan.SimpanAsync(Penyimpanan.KunciAkun, JsonSerializer.Serialize(Akun, Database.Json));
        Berubah?.Invoke();
    }
}
