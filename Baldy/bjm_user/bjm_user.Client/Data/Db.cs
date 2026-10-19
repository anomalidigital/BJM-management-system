using System.Net.Http.Json;
using bjm_user.Client.Layanan;
using bjm_user.Client.Logika;
using bjm_user.Client.Model;

namespace bjm_user.Client.Data;

/// <summary>Isian termin uang jalan dari form.</summary>
public sealed class IsianTermin
{
    public string PaymentDate { get; set; } = Format.HariIni();
    public string DriverId { get; set; } = "";
    public string? Jenis { get; set; } = JenisTermin.Uj;
    public long UjAmount { get; set; }
    public long KasbonDeduction { get; set; }
    public string Notes { get; set; } = "";
    public List<string> Attachments { get; set; } = [];
    public string? OverrideNote { get; set; }
    public string? OverrideBy { get; set; }
}

public sealed record RincianTermin(string Id, int Sequence, string DriverId, long Uj, long Kasbon, long Tf);

/// <summary>Ringkasan isi trip sebelum dibatalkan / dihapus.</summary>
public sealed class IsiTrip
{
    public int Termin { get; init; }
    public long Uj { get; init; }
    public long Kasbon { get; init; }
    public long KasbonKembali { get; init; }
    public List<RincianTermin> RincianTermin { get; init; } = [];
    public int Biaya { get; init; }
    public long BiayaTotal { get; init; }
    public int Internal { get; init; }
    public long InternalTotal { get; init; }
    public int Lainnya { get; init; }
    public int Perjalanan { get; init; }
}

public sealed class OpsiBatal
{
    public string Alasan { get; set; } = "";
    /// <summary>Per termin: TF yang sudah diterima sopir dikembalikan tunai ("kembali") atau jadi kasbon ("kasbon").</summary>
    public Dictionary<string, string> Penyelesaian { get; set; } = [];
    public long BiayaCancel { get; set; }
}

public sealed class OpsiTutup
{
    public bool PodFisik { get; set; }
    public List<string> PodFoto { get; set; } = [];
    public bool? AdaBackload { get; set; }
    public bool DiPool { get; set; }
}

public sealed class IsianAudit
{
    public string Aksi { get; set; } = "ubah";
    public string Entitas { get; set; } = "";
    public string EntityId { get; set; } = "";
    public string Label { get; set; } = "";
    public string Ringkasan { get; set; } = "";
    public List<PerubahanAudit>? Perubahan { get; set; }
}

/// <summary>
/// Penyimpanan data aplikasi di browser (localStorage) + aturan domain trip, padanan DataProvider React.
/// Nanti diganti lapisan API tanpa mengubah halaman: halaman hanya memakai Db.
/// </summary>
public sealed class Db(Penyimpanan simpan, Sesi sesi, HttpClient http)
{
    private const int BatasAudit = 3000;

    public Database Semua { get; private set; } = new();
    public bool Siap { get; private set; }
    public string? Galat { get; private set; }
    public event Action? Berubah;

    private int _versi;
    private int _diam;
    private bool _hidrasi;
    private readonly List<CatatanAudit> _antrianAudit = [];

    private string _wsCache = "";
    private int _versiCache = -1;
    private Database? _scoped;
    private List<BarisTrip>? _baris;
    private List<BarisTagihan>? _barisTagihan;
    private Dictionary<string, long>? _saldo;

    /* ── Muat & simpan ───────────────────────────────────────────────────── */

    public async Task MuatAsync()
    {
        Galat = null;
        try
        {
            var mentah = await simpan.BacaAsync(Penyimpanan.KunciDb);
            var db = string.IsNullOrEmpty(mentah) ? null : Database.Dari(mentah);
            if (db is null)
            {
                db = await http.GetFromJsonAsync<Database>("data/contoh.json", Database.Json) ?? new Database();
                db.Rapikan();
                await simpan.SimpanAsync(Penyimpanan.KunciDb, db.KeJson());
            }
            else db.Rapikan();
            Semua = db;
            _hidrasi = true;
        }
        catch (Exception e)
        {
            Galat = "Gagal memuat data: " + e.Message;
            Semua = new Database();
        }
        Siap = true;
        Ubah();
    }

    /// <summary>Ganti seluruh isi dengan data contoh.</summary>
    public async Task ResetKeContohAsync()
    {
        await simpan.HapusAsync(Penyimpanan.KunciDb);
        await simpan.HapusAsync(Penyimpanan.KunciMigrasi);
        _hidrasi = false;
        Siap = false;
        Ubah();
        await MuatAsync();
    }

    public async Task MuatUlangAsync()
    {
        Siap = false; Ubah();
        await MuatAsync();
    }

    private void Ubah()
    {
        _versi++;
        Berubah?.Invoke();
        if (_hidrasi) _ = simpan.SimpanAsync(Penyimpanan.KunciDb, Semua.KeJson());
    }

    /* ── Koleksi generik ─────────────────────────────────────────────────── */

    public List<T> Daftar<T>() where T : Record => (List<T>)(object)(typeof(T) switch
    {
        var t when t == typeof(Trip) => Semua.Trip,
        var t when t == typeof(Rute) => Semua.Rute,
        var t when t == typeof(Karyawan) => Semua.Karyawan,
        var t when t == typeof(Kendaraan) => Semua.Kendaraan,
        var t when t == typeof(Klien) => Semua.Klien,
        var t when t == typeof(Kontrak) => Semua.Kontrak,
        var t when t == typeof(TerminUj) => Semua.Termin,
        var t when t == typeof(BiayaOperasional) => Semua.Biaya,
        var t when t == typeof(BiayaInternal) => Semua.BiayaInternal,
        var t when t == typeof(CatatanTrip) => Semua.CatatanTrip,
        var t when t == typeof(KejadianTrip) => Semua.Kejadian,
        var t when t == typeof(MutasiKasbon) => Semua.Kasbon,
        var t when t == typeof(AturanKomisi) => Semua.AturanKomisi,
        var t when t == typeof(Alamat) => Semua.Alamat,
        var t when t == typeof(Dokumen) => Semua.Dokumen,
        var t when t == typeof(Tagihan) => Semua.Tagihan,
        var t when t == typeof(JobOrder) => Semua.JobOrders,
        var t when t == typeof(CatatanAudit) => Semua.Audit,
        _ => throw new InvalidOperationException($"Koleksi untuk {typeof(T).Name} tidak dikenal"),
    });

    public static string NamaKoleksi<T>() => typeof(T) switch
    {
        var t when t == typeof(Trip) => Koleksi.Trip,
        var t when t == typeof(Rute) => Koleksi.Rute,
        var t when t == typeof(Karyawan) => Koleksi.Karyawan,
        var t when t == typeof(Kendaraan) => Koleksi.Kendaraan,
        var t when t == typeof(Klien) => Koleksi.Klien,
        var t when t == typeof(Kontrak) => Koleksi.Kontrak,
        var t when t == typeof(TerminUj) => Koleksi.Termin,
        var t when t == typeof(BiayaOperasional) => Koleksi.Biaya,
        var t when t == typeof(BiayaInternal) => Koleksi.BiayaInternal,
        var t when t == typeof(CatatanTrip) => Koleksi.CatatanTrip,
        var t when t == typeof(KejadianTrip) => Koleksi.Kejadian,
        var t when t == typeof(MutasiKasbon) => Koleksi.Kasbon,
        var t when t == typeof(AturanKomisi) => Koleksi.AturanKomisi,
        var t when t == typeof(Alamat) => Koleksi.Alamat,
        var t when t == typeof(Dokumen) => Koleksi.Dokumen,
        var t when t == typeof(Tagihan) => Koleksi.Tagihan,
        var t when t == typeof(JobOrder) => Koleksi.JobOrder,
        var t when t == typeof(CatatanAudit) => Koleksi.Audit,
        _ => typeof(T).Name,
    };

    public T? Cari<T>(string? id) where T : Record => string.IsNullOrEmpty(id) ? null : Daftar<T>().FirstOrDefault(r => r.Id == id);

    private static string NamaEntitas(string koleksi) => Koleksi.Label(koleksi).ToLowerInvariant();

    /// <summary>Tambah record: id, jejak waktu, dan workspace (untuk koleksi per workspace) diisi di sini.</summary>
    public T Buat<T>(T row) where T : Record
    {
        var koleksi = NamaKoleksi<T>();
        var waktu = Format.SekarangIso();
        row.Id = Util.Uid(koleksi.Length >= 3 ? koleksi[..3] : koleksi);
        row.CreatedAt = waktu; row.UpdatedAt = waktu;
        if (row is RecordWorkspace rw && Koleksi.PerWorkspace.Contains(koleksi) && string.IsNullOrEmpty(rw.Workspace)) rw.Workspace = sesi.Workspace;
        Daftar<T>().Insert(0, row);
        if (koleksi != Koleksi.Audit)
            CatatAudit(new IsianAudit { Aksi = "buat", Entitas = koleksi, EntityId = row.Id, Label = AuditLogika.Label(koleksi, row, Semua), Ringkasan = $"Menambah {NamaEntitas(koleksi)}" });
        Ubah();
        return row;
    }

    /// <summary>Ubah record lewat aksi; perubahan isian dicatat ke Audit Log.</summary>
    public bool Ubah<T>(string id, Action<T> ubah) where T : Record
    {
        var koleksi = NamaKoleksi<T>();
        var r = Cari<T>(id);
        if (r is null) return false;
        var lama = Database.Salin(r);
        ubah(r);
        r.UpdatedAt = Format.SekarangIso();
        if (koleksi != Koleksi.Audit)
        {
            var perubahan = AuditLogika.Beda(lama, r);
            if (perubahan.Count > 0)
                CatatAudit(new IsianAudit
                {
                    Aksi = "ubah", Entitas = koleksi, EntityId = id, Label = AuditLogika.Label(koleksi, r, Semua),
                    Ringkasan = Potong($"Mengubah {NamaEntitas(koleksi)}: {string.Join(", ", perubahan.Select(p => p.Field))}", 160), Perubahan = perubahan,
                });
        }
        Ubah();
        return true;
    }

    public int Hapus<T>(params string[] ids) where T : Record => Hapus<T>((IEnumerable<string>)ids);

    public int Hapus<T>(IEnumerable<string> ids) where T : Record
    {
        var target = new HashSet<string>(ids);
        if (target.Count == 0) return 0;
        var koleksi = NamaKoleksi<T>();
        var daftar = Daftar<T>();
        var lama = daftar.Where(r => target.Contains(r.Id)).ToList();
        daftar.RemoveAll(r => target.Contains(r.Id));
        if (koleksi != Koleksi.Audit && lama.Count > 0)
            CatatAudit(new IsianAudit
            {
                Aksi = "hapus", Entitas = koleksi, EntityId = lama[0].Id,
                Label = Potong(string.Join(", ", lama.Select(r => AuditLogika.Label(koleksi, r, Semua)).Where(x => x != "")), 120),
                Ringkasan = lama.Count > 1 ? $"Menghapus {lama.Count} {NamaEntitas(koleksi)}" : $"Menghapus {NamaEntitas(koleksi)}",
            });
        Ubah();
        return target.Count;
    }

    private static string Potong(string s, int n) => s.Length > n ? s[..n] : s;

    /* ── Audit Log ───────────────────────────────────────────────────────── */

    public void CatatAudit(IsianAudit e)
    {
        if (_diam > 0) return;
        var u = sesi.Pengguna;
        var waktu = Format.SekarangIso();
        var log = new CatatanAudit
        {
            Id = Util.Uid("aud"), Waktu = waktu, Username = u?.Username ?? "", Nama = u?.Name ?? "", Peran = u?.Role ?? "", Workspace = sesi.Workspace,
            Aksi = e.Aksi, Entitas = e.Entitas, EntityId = e.EntityId, Label = e.Label, Ringkasan = e.Ringkasan, Perubahan = e.Perubahan ?? [],
            CreatedAt = waktu, UpdatedAt = waktu,
        };
        Semua.Audit.Insert(0, log);
        if (Semua.Audit.Count > BatasAudit) Semua.Audit.RemoveRange(BatasAudit, Semua.Audit.Count - BatasAudit);
    }

    /// <summary>Beberapa perubahan sebagai satu catatan Audit Log yang bermakna.</summary>
    public void DenganAudit(IsianAudit e, Action kerja)
    {
        _diam++;
        try { kerja(); }
        finally { _diam--; CatatAudit(e); Ubah(); }
    }

    private string LabelTrip(string tripId) => Cari<Trip>(tripId)?.TransactionNo ?? "";

    /* ── Tampilan per workspace & baris gabungan ─────────────────────────── */

    private void SegarkanCache()
    {
        if (_versiCache == _versi && _wsCache == sesi.Workspace && _scoped is not null) return;
        _versiCache = _versi; _wsCache = sesi.Workspace;
        _scoped = SusunScoped(); _baris = null; _barisTagihan = null; _saldo = null;
    }

    private static string WsDari(RecordWorkspace r) => string.IsNullOrEmpty(r.Workspace) ? WorkspaceKode.Priok : r.Workspace;

    private Database SusunScoped()
    {
        var ws = sesi.Workspace;
        var trip = Semua.Trip.Where(t => WsDari(t) == ws).ToList();
        var tripIds = new HashSet<string>(trip.Select(t => t.Id));
        var tripAktif = new HashSet<string>(trip.Where(t => t.Status != StatusTrip.Batal).Select(t => t.Id));
        return new Database
        {
            Karyawan = Semua.Karyawan, Rute = Semua.Rute, Kendaraan = Semua.Kendaraan, JobOrders = Semua.JobOrders, Klien = Semua.Klien,
            Kasbon = Semua.Kasbon, Alamat = Semua.Alamat, Audit = Semua.Audit,
            Trip = trip,
            Termin = Semua.Termin.Where(p => tripAktif.Contains(p.TripId)).ToList(),
            Biaya = Semua.Biaya.Where(e => tripAktif.Contains(e.TripId)).ToList(),
            BiayaInternal = Semua.BiayaInternal.Where(c => tripAktif.Contains(c.TripId)).ToList(),
            CatatanTrip = Semua.CatatanTrip.Where(n => tripIds.Contains(n.TripId)).ToList(),
            Kejadian = Semua.Kejadian.Where(e => tripIds.Contains(e.TripId)).ToList(),
            Tagihan = Semua.Tagihan.Where(b => WsDari(b) == ws).ToList(),
            AturanKomisi = Semua.AturanKomisi.Where(s => WsDari(s) == ws).ToList(),
            Kontrak = Semua.Kontrak.Where(c => WsDari(c) == ws).ToList(),
            Dokumen = Semua.Dokumen.Where(d => WsDari(d) == ws).ToList(),
        };
    }

    /// <summary>Data yang sudah disaring mengikuti workspace aktif (catatan trip batal tidak ikut).</summary>
    public Database Data { get { SegarkanCache(); return _scoped!; } }

    public bool Karawang => sesi.Workspace == WorkspaceKode.Karawang;

    /// <summary>Trip workspace aktif yang sudah digabung dengan supir, kendaraan, rute, klien, termin, biaya, komisi.</summary>
    public List<BarisTrip> Baris { get { SegarkanCache(); return _baris ??= SusunBaris(); } }

    public BarisTrip? BarisTrip(string? id) => string.IsNullOrEmpty(id) ? null : Baris.FirstOrDefault(b => b.Id == id);

    public List<BarisTagihan> BarisTagihan
    {
        get
        {
            SegarkanCache();
            return _barisTagihan ??= Data.Tagihan.Select(b =>
            {
                var j = Data.JobOrders.FirstOrDefault(x => x.Id == b.JobOrderId);
                return new BarisTagihan { B = b, Sijo = j?.Sijo ?? "", CustomerName = j?.CustomerName ?? "", CustomerCode = j?.CustomerCode ?? "", Party = j?.Party ?? "" };
            }).ToList();
        }
    }

    /// <summary>Saldo kasbon tiap karyawan (lintas workspace).</summary>
    public Dictionary<string, long> SaldoKasbon { get { SegarkanCache(); return _saldo ??= Kasbon.PetaSaldo(Semua.Kasbon); } }

    private List<BarisTrip> SusunBaris()
    {
        var d = Data;
        var drivers = d.Karyawan.ToDictionary(x => x.Id);
        var vehicles = d.Kendaraan.ToDictionary(x => x.Id);
        var routes = d.Rute.ToDictionary(x => x.Id);
        var jobOrders = d.JobOrders.ToDictionary(x => x.Id);
        var projects = d.Klien.ToDictionary(x => x.Id);
        var contracts = d.Kontrak.ToDictionary(x => x.Id);
        var uj = new Dictionary<string, (long Uj, long Kasbon, int N)>();
        foreach (var p in d.Termin)
        {
            var a = uj.GetValueOrDefault(p.TripId);
            uj[p.TripId] = (a.Uj + p.UjAmount, a.Kasbon + p.KasbonDeduction, a.N + 1);
        }
        var exp = new Dictionary<string, long>(); var tol = new Dictionary<string, long>();
        var tagih = new Dictionary<string, long>(); var prsh = new Dictionary<string, long>();
        foreach (var e in d.Biaya)
        {
            exp[e.TripId] = exp.GetValueOrDefault(e.TripId) + e.Amount;
            if (e.ExpenseType == "Tol") tol[e.TripId] = tol.GetValueOrDefault(e.TripId) + e.Amount;
            if (TripLogika.Ditagihkan(e)) tagih[e.TripId] = tagih.GetValueOrDefault(e.TripId) + e.Amount;
            if (TripLogika.DibayarPerusahaan(e)) prsh[e.TripId] = prsh.GetValueOrDefault(e.TripId) + e.Amount;
        }
        var internal_ = new Dictionary<string, long>();
        foreach (var c in d.BiayaInternal) internal_[c.TripId] = internal_.GetValueOrDefault(c.TripId) + c.Amount;
        var jalan = new Dictionary<string, List<KejadianTrip>>();
        foreach (var e in d.Kejadian.OrderBy(e => e.Waktu, StringComparer.Ordinal).ThenBy(e => e.CreatedAt, StringComparer.Ordinal))
        {
            if (!jalan.TryGetValue(e.TripId, out var l)) jalan[e.TripId] = l = [];
            l.Add(e);
        }
        var dilanjutkan = new HashSet<string>(d.Trip.Where(t => !string.IsNullOrEmpty(t.BackloadDari) && t.Status != StatusTrip.Batal).Select(t => t.BackloadDari!));
        var aturan = d.AturanKomisi;

        return d.Trip.Select(t =>
        {
            var ids = t.DriverIds.Count > 0 ? t.DriverIds : t.DriverId != "" ? [t.DriverId] : new List<string>();
            drivers.TryGetValue(ids.FirstOrDefault() ?? t.DriverId, out var dr);
            vehicles.TryGetValue(t.VehicleId, out var v);
            routes.TryGetValue(t.RouteId, out var r);
            jobOrders.TryGetValue(t.JobOrderId, out var j);
            projects.TryGetValue(t.ProjectId, out var pr);
            Karyawan? m = null; if (t.ManagerId != "") drivers.TryGetValue(t.ManagerId, out m);
            var u = uj.GetValueOrDefault(t.Id);
            Kontrak? k = null; if (t.ContractId != "") contracts.TryGetValue(t.ContractId, out k);
            var batal = t.Status == StatusTrip.Batal;
            var kejadian = jalan.GetValueOrDefault(t.Id) ?? [];
            var lokasi = TripLogika.Lokasi(t, r?.RouteName ?? "");
            var area = r is not null ? TripLogika.KodeArea(r) : (TripLogika.NormalKodeArea(lokasi.Muat), TripLogika.NormalKodeArea(lokasi.Bongkar));
            var harga = Komisi.HargaTrip(t.CostValue, r?.Price ?? 0);
            var dasar = new DataTripKomisi
            {
                Layanan = string.IsNullOrEmpty(t.ServiceType) ? TipeKlien.Callout : t.ServiceType, Konfigurasi = v?.Configuration ?? "",
                CostValue = t.CostValue, RoutePrice = r?.Price ?? 0, Ujroute = r?.Ujroute ?? 0, UjTotal = u.Uj,
            };
            var kSopir = batal ? null : Komisi.HitungTrip(aturan, new DataTripKomisi { Role = PeranKaryawan.Sopir, Layanan = dasar.Layanan, Konfigurasi = dasar.Konfigurasi, CostValue = dasar.CostValue, RoutePrice = dasar.RoutePrice, Ujroute = dasar.Ujroute, UjTotal = dasar.UjTotal });
            var kManager = batal || (t.ManagerId == "" && t.ManagerName == "") ? null : Komisi.HitungTrip(aturan, new DataTripKomisi { Role = PeranKaryawan.Manager, Layanan = dasar.Layanan, Konfigurasi = dasar.Konfigurasi, CostValue = dasar.CostValue, RoutePrice = dasar.RoutePrice, Ujroute = dasar.Ujroute, UjTotal = dasar.UjTotal });
            var tagihTrip = tagih.GetValueOrDefault(t.Id);
            return new BarisTrip
            {
                T = t, DriverIds = ids,
                DriverCode = dr?.DriverCode ?? "", DriverName = dr?.DriverName ?? "",
                DriverNames = string.Join(", ", ids.Select(i => drivers.GetValueOrDefault(i)?.DriverName).Where(x => !string.IsNullOrEmpty(x))),
                PlateNumber = v?.PlateNumber ?? "", Sijo = j?.Sijo ?? "",
                RouteCode = r?.RouteCode ?? "", RouteName = r?.RouteName ?? "", RoutePrice = r?.Price ?? 0,
                Harga = harga, HargaKhusus = t.CostValue > 0 && t.CostValue != (r?.Price ?? 0),
                Ujroute = r?.Ujroute ?? 0, Toll = r?.Toll ?? 0, Commissioner = r?.Commissioner ?? 0,
                ProjectCode = pr?.ProjectCode ?? "", ProjectName = pr?.ProjectName ?? "",
                ManagerLabel = m?.DriverName ?? t.ManagerName,
                UjTotal = u.Uj, KasbonTotal = u.Kasbon, TfTotal = u.Uj - u.Kasbon, TerminCount = u.N,
                ExpenseTotal = exp.GetValueOrDefault(t.Id), InternalTotal = internal_.GetValueOrDefault(t.Id), TollPaid = tol.GetValueOrDefault(t.Id),
                VehicleConfig = v?.Configuration ?? "", ContractNo = k?.ContractNo ?? "",
                ClientName = k is not null ? projects.GetValueOrDefault(k.ProjectId)?.ProjectName ?? "" : "",
                TrList = TripLogika.Tr(t), Muat = lokasi.Muat, Bongkar = lokasi.Bongkar,
                Ata = TripLogika.Ata(kejadian), Posisi = kejadian.LastOrDefault(),
                BiayaDitagihkan = tagihTrip, BiayaPerusahaan = prsh.GetValueOrDefault(t.Id),
                KomisiSopir = kSopir?.Nilai ?? 0, KomisiManager = kManager?.Nilai ?? 0,
                KomisiKeterangan = batal ? "Trip dibatalkan"
                    : kSopir?.Aturan is null && t.VehicleId == "" ? "Kendaraan trip belum diisi, jadi aturan komisi belum bisa dipilih"
                    : kSopir?.Keterangan ?? "",
                IdPerjalanan = TripLogika.IdPerjalanan(t),
                MenahanKendaraan = TripLogika.MenahanKendaraan(t, kejadian.Any(e => e.Jenis == "pool"), dilanjutkan.Contains(t.Id)),
                TagihanTotal = batal ? t.CancelFee ?? 0 : harga + tagihTrip,
                AreaAsal = area.Item1, AreaTujuan = area.Item2,
            };
        }).ToList();
    }

    /* ── Aksi domain trip ────────────────────────────────────────────────── */

    private IEnumerable<MutasiKasbon> PotonganTrip(string tripId) => Semua.Kasbon.Where(e => e.TripId == tripId && e.Kind == JenisKasbon.Trip && e.Amount < 0);

    /// <summary>Mutasi kasbon "trip" yang mengikuti satu termin: dibuat, diubah, atau dihapus.</summary>
    private void SelaraskanKasbon(string tripId, TerminUj p)
    {
        var ada = Semua.Kasbon.FirstOrDefault(e => e.UjPaymentId == p.Id && e.Kind == JenisKasbon.Trip);
        if (p.KasbonDeduction <= 0 || p.DriverId == "")
        {
            if (ada is not null) Hapus<MutasiKasbon>(ada.Id);
            return;
        }
        if (ada is not null)
            Ubah<MutasiKasbon>(ada.Id, e => { e.EmployeeId = p.DriverId; e.EntryDate = p.PaymentDate; e.Amount = -p.KasbonDeduction; e.TripId = tripId; });
        else
            Buat(new MutasiKasbon { EmployeeId = p.DriverId, EntryDate = p.PaymentDate, Amount = -p.KasbonDeduction, TripId = tripId, Kind = JenisKasbon.Trip, UjPaymentId = p.Id });
    }

    public Trip BuatTrip(Trip t) => Buat(t);

    /// <summary>Simpan termin uang jalan sekaligus menyelaraskan potongan kasbon sopirnya.</summary>
    public void SimpanTermin(string tripId, IsianTermin form, TerminUj? ada = null)
    {
        var seq = ada?.Sequence ?? Semua.Termin.Where(p => p.TripId == tripId).Select(p => p.Sequence).DefaultIfEmpty(0).Max() + 1;
        var potong = form.KasbonDeduction > 0 ? $", potong kasbon {Format.Rupiah(form.KasbonDeduction)}" : "";
        var alasan = (form.OverrideNote ?? "").Trim();
        var disetujui = alasan != "" ? $" (di atas patokan, disetujui {(string.IsNullOrEmpty(form.OverrideBy) ? "Manager / Owner" : form.OverrideBy)}: {alasan})" : "";
        var perubahan = ada is null ? [] : AuditLogika.Beda(ada, Terapkan(Database.Salin(ada), form));
        DenganAudit(new IsianAudit
        {
            Aksi = ada is null ? "buat" : "ubah", Entitas = Koleksi.Termin, EntityId = ada?.Id ?? "", Label = $"Termin {seq} · {LabelTrip(tripId)}",
            Ringkasan = Potong($"{(ada is null ? "Menambah" : "Mengubah")} termin {seq} uang jalan {Format.Rupiah(form.UjAmount)}{potong}{disetujui}", 240), Perubahan = perubahan,
        }, () =>
        {
            if (ada is not null)
            {
                Ubah<TerminUj>(ada.Id, p => Terapkan(p, form));
                SelaraskanKasbon(tripId, Cari<TerminUj>(ada.Id)!);
            }
            else
            {
                var baru = Buat(Terapkan(new TerminUj { TripId = tripId, Sequence = seq }, form));
                SelaraskanKasbon(tripId, baru);
            }
        });
    }

    private static TerminUj Terapkan(TerminUj p, IsianTermin f)
    {
        p.PaymentDate = f.PaymentDate; p.DriverId = f.DriverId; p.Jenis = f.Jenis; p.UjAmount = f.UjAmount; p.KasbonDeduction = f.KasbonDeduction;
        p.Notes = f.Notes; p.Attachments = f.Attachments; p.OverrideNote = f.OverrideNote; p.OverrideBy = f.OverrideBy;
        return p;
    }

    public void HapusTermin(TerminUj p)
    {
        DenganAudit(new IsianAudit
        {
            Aksi = "hapus", Entitas = Koleksi.Termin, EntityId = p.Id, Label = $"Termin {p.Sequence} · {LabelTrip(p.TripId)}",
            Ringkasan = $"Menghapus termin {p.Sequence} uang jalan {Format.Rupiah(p.UjAmount)}",
        }, () =>
        {
            Hapus<TerminUj>(p.Id);
            var terkait = Semua.Kasbon.Where(e => e.UjPaymentId == p.Id).Select(e => e.Id).ToList();
            if (terkait.Count > 0) Hapus<MutasiKasbon>(terkait);
        });
    }

    public IsiTrip IsiTrip(string tripId)
    {
        var termin = Semua.Termin.Where(p => p.TripId == tripId).ToList();
        var biaya = Semua.Biaya.Where(e => e.TripId == tripId).ToList();
        var internal_ = Semua.BiayaInternal.Where(c => c.TripId == tripId).ToList();
        return new IsiTrip
        {
            Termin = termin.Count, Uj = termin.Sum(p => p.UjAmount), Kasbon = termin.Sum(p => p.KasbonDeduction),
            KasbonKembali = PotonganTrip(tripId).Sum(e => -e.Amount),
            RincianTermin = termin.OrderBy(p => p.Sequence).Select(p => new RincianTermin(p.Id, p.Sequence, p.DriverId, p.UjAmount, p.KasbonDeduction, p.UjAmount - p.KasbonDeduction)).ToList(),
            Biaya = biaya.Count, BiayaTotal = biaya.Sum(e => e.Amount), Internal = internal_.Count, InternalTotal = internal_.Sum(c => c.Amount),
            Lainnya = Semua.CatatanTrip.Count(n => n.TripId == tripId), Perjalanan = Semua.Kejadian.Count(e => e.TripId == tripId),
        };
    }

    private void KosongkanTrip(string tripId)
    {
        Hapus<TerminUj>(Semua.Termin.Where(x => x.TripId == tripId).Select(x => x.Id).ToList());
        Hapus<BiayaOperasional>(Semua.Biaya.Where(x => x.TripId == tripId).Select(x => x.Id).ToList());
        Hapus<BiayaInternal>(Semua.BiayaInternal.Where(x => x.TripId == tripId).Select(x => x.Id).ToList());
        Hapus<CatatanTrip>(Semua.CatatanTrip.Where(x => x.TripId == tripId).Select(x => x.Id).ToList());
        Hapus<KejadianTrip>(Semua.Kejadian.Where(x => x.TripId == tripId).Select(x => x.Id).ToList());
    }

    /// <summary>Batalkan trip: potongan kasbon dikembalikan, TF yang sudah diterima sopir dikembalikan tunai atau jadi kasbon.</summary>
    public void BatalkanTrip(string tripId, OpsiBatal opsi)
    {
        var trip = Cari<Trip>(tripId);
        var no = trip?.TransactionNo ?? "";
        var hariIni = Format.HariIni();
        _diam++;
        try
        {
            foreach (var e in PotonganTrip(tripId).ToList())
                Buat(new MutasiKasbon
                {
                    EmployeeId = e.EmployeeId, EntryDate = hariIni, Kind = JenisKasbon.Pembatalan, Amount = -e.Amount, TripId = tripId,
                    UjPaymentId = e.UjPaymentId, Notes = $"Potongan dikembalikan: trip {no} dibatalkan",
                });
            var penyelesaian = new List<PenyelesaianUj>();
            foreach (var p in Semua.Termin.Where(x => x.TripId == tripId).ToList())
            {
                var tf = p.UjAmount - p.KasbonDeduction;
                if (tf <= 0) continue;
                var cara = p.DriverId != "" ? opsi.Penyelesaian.GetValueOrDefault(p.Id) ?? "kasbon" : "kembali";
                penyelesaian.Add(new PenyelesaianUj { UjPaymentId = p.Id, DriverId = p.DriverId, Tf = tf, Cara = cara });
                if (cara == "kasbon")
                    Buat(new MutasiKasbon
                    {
                        EmployeeId = p.DriverId, EntryDate = hariIni, Kind = JenisKasbon.Pembatalan, Amount = tf, TripId = tripId, UjPaymentId = p.Id,
                        Notes = $"Uang jalan termin {p.Sequence} trip {no} tidak dikembalikan, jadi kasbon",
                    });
            }
            Ubah<Trip>(tripId, t =>
            {
                t.Status = StatusTrip.Batal; t.CancelledAt = hariIni; t.CancelReason = opsi.Alasan.Trim(); t.CancelSettlement = penyelesaian;
                t.CancelFee = Math.Max(0, opsi.BiayaCancel);
            });
        }
        finally { _diam--; }
        CatatAudit(new IsianAudit
        {
            Aksi = "batal", Entitas = Koleksi.Trip, EntityId = tripId, Label = no,
            Ringkasan = Potong($"Membatalkan trip: {opsi.Alasan.Trim()}{(opsi.BiayaCancel > 0 ? $" (biaya cancel {Format.Rupiah(opsi.BiayaCancel)})" : "")}", 200),
        });
        Ubah();
    }

    private bool PunyaPool(string tripId) => Semua.Kejadian.Any(e => e.TripId == tripId && e.Jenis == "pool");

    /// <summary>Tutup trip: status Selesai, POD dicatat, backload ditandai bila ada, mobil di pool bila dijawab ya.</summary>
    public void TutupTrip(string tripId, OpsiTutup opsi)
    {
        var waktu = Format.SekarangLokal();
        var catatan = string.Join(", ", new[]
        {
            $"POD {(opsi.PodFisik ? "fisik diterima" : "baru foto")}", opsi.AdaBackload == true ? "ada backload / lanjutan" : "", opsi.DiPool ? "mobil sudah di pool" : "",
        }.Where(x => x != ""));
        DenganAudit(new IsianAudit { Aksi = "tutup", Entitas = Koleksi.Trip, EntityId = tripId, Label = LabelTrip(tripId), Ringkasan = $"Menutup trip: {catatan}" }, () =>
        {
            Ubah<Trip>(tripId, t =>
            {
                t.Status = StatusTrip.Selesai; t.ClosedAt = Format.HariIni(); t.PodFisik = opsi.PodFisik; t.PodFisikAt = opsi.PodFisik ? Format.HariIni() : null;
                t.PodAttachments = opsi.PodFoto;
                if (opsi.AdaBackload is not null) t.AdaBackload = opsi.AdaBackload;
                if (opsi.DiPool) t.PoolAt = waktu;
            });
            if (opsi.DiPool && !PunyaPool(tripId))
                Buat(new KejadianTrip { TripId = tripId, Jenis = "pool", Waktu = waktu, Lokasi = "Pool", Catatan = "Dicatat saat Tutup Trip" });
        });
    }

    public void TandaiDiPool(string tripId, string? waktu = null, string lokasi = "Pool")
    {
        var w = waktu ?? Format.SekarangLokal();
        DenganAudit(new IsianAudit { Aksi = "pool", Entitas = Koleksi.Trip, EntityId = tripId, Label = LabelTrip(tripId), Ringkasan = $"Mobil kembali di pool ({w.Replace('T', ' ')})" }, () =>
        {
            Ubah<Trip>(tripId, t => t.PoolAt = w);
            if (!PunyaPool(tripId)) Buat(new KejadianTrip { TripId = tripId, Jenis = "pool", Waktu = w, Lokasi = lokasi });
        });
    }

    /// <summary>Hapus trip beserta seluruh catatannya, seolah tidak pernah ada.</summary>
    public void HapusTrip(string tripId)
    {
        DenganAudit(new IsianAudit { Aksi = "hapus", Entitas = Koleksi.Trip, EntityId = tripId, Label = LabelTrip(tripId), Ringkasan = "Menghapus trip beserta seluruh catatannya" }, () =>
        {
            KosongkanTrip(tripId);
            var mutasi = Semua.Kasbon.Where(e => e.TripId == tripId).Select(e => e.Id).ToList();
            if (mutasi.Count > 0) Hapus<MutasiKasbon>(mutasi);
            Hapus<Trip>(tripId);
        });
    }

    /// <summary>Seluruh id lampiran yang masih dirujuk record, lintas workspace (untuk membersihkan berkas yatim).</summary>
    public HashSet<string> LampiranDipakai()
    {
        var ids = new HashSet<string>();
        void Ambil(IEnumerable<List<string>?> daftar) { foreach (var l in daftar) if (l is not null) ids.UnionWith(l); }
        Ambil(Semua.Kendaraan.Select(x => x.Attachments)); Ambil(Semua.Karyawan.Select(x => x.Attachments)); Ambil(Semua.Kontrak.Select(x => x.Attachments));
        Ambil(Semua.Termin.Select(x => x.Attachments)); Ambil(Semua.Biaya.Select(x => x.Attachments)); Ambil(Semua.BiayaInternal.Select(x => x.Attachments));
        Ambil(Semua.CatatanTrip.Select(x => x.Attachments)); Ambil(Semua.Kasbon.Select(x => x.Attachments)); Ambil(Semua.Kejadian.Select(x => x.Attachments));
        Ambil(Semua.Dokumen.Select(x => x.Attachments));
        foreach (var d in Semua.Karyawan.Select(x => x.Dokumen).Concat(Semua.Kendaraan.Select(x => x.Dokumen))) if (d is not null) foreach (var x in d.Values) ids.UnionWith(x.Berkas);
        foreach (var t in Semua.Trip) { Ambil([t.OverrideAttachments, t.PodAttachments, t.PiAttachments]); }
        return ids;
    }

    /// <summary>Tandai trip sudah dicetak (Berita Acara / Surat Jalan).</summary>
    public void TandaiDicetak(IEnumerable<string> ids)
    {
        var waktu = Format.SekarangIso();
        foreach (var id in ids)
        {
            var t = Cari<Trip>(id);
            if (t is null) continue;
            DenganAudit(new IsianAudit { Aksi = "cetak", Entitas = Koleksi.Trip, EntityId = id, Label = t.TransactionNo, Ringkasan = Karawang ? "Mencetak Berita Acara" : "Mencetak Surat Jalan" },
                () => Ubah<Trip>(id, x => x.PrintedAt = waktu));
        }
    }
}

public static class DatabaseRapikan
{
    /// <summary>Isi null dari JSON lama diganti nilai kosong supaya halaman tidak perlu mengecek null di mana-mana.</summary>
    public static void Rapikan(this Database d)
    {
        d.Karyawan ??= []; d.Rute ??= []; d.Kendaraan ??= []; d.JobOrders ??= []; d.Trip ??= []; d.Tagihan ??= []; d.Klien ??= [];
        d.Termin ??= []; d.Biaya ??= []; d.BiayaInternal ??= []; d.CatatanTrip ??= []; d.Kejadian ??= []; d.Kasbon ??= [];
        d.AturanKomisi ??= []; d.Kontrak ??= []; d.Alamat ??= []; d.Audit ??= []; d.Dokumen ??= [];
        foreach (var t in d.Trip)
        {
            t.TripIds ??= []; t.DriverIds ??= []; t.CancelSettlement ??= [];
            t.TransactionNo ??= ""; t.TransactionDate ??= ""; t.ServiceType ??= TipeKlien.Callout; t.ContractId ??= ""; t.RouteId ??= "";
            t.SjNo ??= ""; t.ManagerId ??= ""; t.ManagerName ??= ""; t.ProjectId ??= ""; t.Status ??= StatusTrip.Aktif;
            t.RecipientName ??= ""; t.RecipientAddress1 ??= ""; t.RecipientAddress2 ??= ""; t.VehicleId ??= ""; t.DriverId ??= "";
            t.JobOrderId ??= ""; t.Party ??= ""; t.GoodsType ??= ""; t.Kosongan ??= ""; t.Location ??= ""; t.Ship ??= ""; t.DestinationDetail ??= "";
            t.TrReference ??= ""; t.PiNumber ??= ""; t.PiStatus ??= ""; t.Notes ??= ""; t.CancelReason ??= ""; t.ContainerNo ??= "";
        }
        foreach (var r in d.Rute) { r.RouteCode ??= ""; r.RouteName ??= ""; r.ProjectId ??= ""; r.Feet ??= ""; }
        foreach (var k in d.Karyawan) { k.DriverCode ??= ""; k.DriverName ??= ""; k.NamaLengkap ??= ""; k.Role ??= PeranKaryawan.Sopir; k.Address1 ??= ""; k.Address2 ??= ""; k.City ??= ""; k.Phone ??= ""; k.Status ??= "aktif"; k.Attachments ??= []; }
        foreach (var v in d.Kendaraan) { v.PlateNumber ??= ""; v.VehicleType ??= ""; v.Configuration ??= ""; v.Status ??= "aktif"; v.Attachments ??= []; }
        foreach (var p in d.Klien) { p.ProjectCode ??= ""; p.ProjectName ??= ""; p.ClientType ??= TipeKlien.Callout; p.Description ??= ""; p.AlamatResmi ??= ""; p.AlamatSurat ??= ""; p.Npwp ??= ""; p.Status ??= "aktif"; }
        foreach (var a in d.Alamat) { a.KodeArea ??= ""; a.Nama ??= ""; a.Jalan ??= ""; a.Kota ??= ""; a.NamaKontak ??= ""; a.Telepon ??= ""; a.ProjectId ??= ""; a.Jenis ??= JenisAlamat.Keduanya; a.LatLong ??= ""; a.IdLokasiKlien ??= ""; a.Catatan ??= ""; a.Status = "aktif"; } // status alamat sudah tidak dipakai: semua alamat aktif
        foreach (var p in d.Termin) { p.TripId ??= ""; p.PaymentDate ??= ""; p.DriverId ??= ""; p.Notes ??= ""; p.Attachments ??= []; }
        foreach (var e in d.Biaya) { e.TripId ??= ""; e.ExpenseType ??= ""; e.ExpenseDate ??= ""; e.Notes ??= ""; e.Attachments ??= []; }
        foreach (var c in d.BiayaInternal) { c.TripId ??= ""; c.CostType ??= ""; c.CostDate ??= ""; c.Notes ??= ""; c.RecipientRole ??= ""; c.RecipientId ??= ""; c.RecipientName ??= ""; c.Attachments ??= []; }
        foreach (var n in d.CatatanTrip) { n.TripId ??= ""; n.NoteDate ??= ""; n.Title ??= ""; n.Notes ??= ""; n.Attachments ??= []; }
        foreach (var e in d.Kejadian) { e.TripId ??= ""; e.Jenis ??= ""; e.Waktu ??= ""; e.Lokasi ??= ""; e.Catatan ??= ""; e.Attachments ??= []; }
        foreach (var m in d.Kasbon) { m.EmployeeId ??= ""; m.EntryDate ??= ""; m.Kind ??= JenisKasbon.Admin; m.TripId ??= ""; m.UjPaymentId ??= ""; m.Notes ??= ""; m.Attachments ??= []; }
        foreach (var s in d.AturanKomisi) { s.Name ??= ""; s.Role ??= PeranKaryawan.Sopir; s.ServiceType ??= "semua"; s.Configurations ??= []; s.Basis ??= DasarKomisi.Nilai; s.Tiers ??= []; s.Notes ??= ""; }
        foreach (var c in d.Kontrak) { c.ContractNo ??= ""; c.ProjectId ??= ""; c.StartDate ??= ""; c.EndDate ??= ""; c.Status ??= "aktif"; c.Notes ??= ""; c.Attachments ??= []; }
        foreach (var dk in d.Dokumen) { dk.Judul ??= ""; dk.Kategori ??= "Umum"; dk.Tanggal ??= ""; dk.Catatan ??= ""; dk.Attachments ??= []; }
        foreach (var b in d.Tagihan) { b.InvoiceNo ??= ""; b.JobOrderId ??= ""; b.CostCode ??= ""; b.BillingDate ??= ""; b.WithdrawalDate ??= ""; b.BlNo ??= ""; b.InvoiceRef ??= ""; b.Notes ??= ""; }
        foreach (var j in d.JobOrders) { j.Sijo ??= ""; j.CustomerCode ??= ""; j.CustomerName ??= ""; j.CustomerAddress ??= ""; j.Party ??= ""; j.Ship ??= ""; j.Goods ??= ""; }
        foreach (var a in d.Audit) { a.Waktu ??= ""; a.Username ??= ""; a.Nama ??= ""; a.Peran ??= ""; a.Aksi ??= ""; a.Entitas ??= ""; a.EntityId ??= ""; a.Label ??= ""; a.Ringkasan ??= ""; a.Perubahan ??= []; }
    }
}
