using bjm_user.Client.Logika;
using bjm_user.Client.Model;

namespace bjm_user.Client.Pages.Trip.Detail;

/// <summary>Satu baris pemeriksaan rekap: ok (lengkap), kurang (perlu dibetulkan), atau catatan. Tab = tempat membetulkannya.</summary>
public sealed record CekRekap(string Tingkat, string Teks, string? Tab = null);

public sealed class AngkaRekap
{
    public long Uj { get; init; }
    public long Kasbon { get; init; }
    public long Tf { get; init; }
    public long Biaya { get; init; }
    public long BiayaPerusahaan { get; init; }
    public long BiayaSopir { get; init; }
    public long Ditagihkan { get; init; }
    public long Internal { get; init; }
    public long Komisi { get; init; }
    public long Harga { get; init; }
    public long Tagihan { get; init; }
    /// <summary>Uang jalan yang dihitung keluar (patokan bila trip belum ditutup dan belum lunas dibayar).</summary>
    public long UjDihitung { get; init; }
    public long Netto { get; init; }
}

/// <summary>Rekap satu trip (padanan DataRekap di pages/trip/rekap.ts).</summary>
public sealed class DataRekap
{
    public required BarisTrip Trip { get; init; }
    public string Klien { get; init; } = "—";
    public string Layanan { get; init; } = "";
    public string Kontrak { get; init; } = "";
    public List<string> Supir { get; init; } = [];
    public string Manager { get; init; } = "";
    public string Gandengan { get; init; } = "";
    public List<ItemMuatan> Muatan { get; init; } = [];
    public List<KejadianTrip> Kejadian { get; init; } = [];
    public List<TerminUj> Termin { get; init; } = [];
    public List<BiayaOperasional> Biaya { get; init; } = [];
    public List<BiayaInternal> Internal { get; init; } = [];
    public Func<string, string> NamaKaryawan { get; init; } = _ => "—";
    public AngkaRekap Angka { get; init; } = new();
    public List<CekRekap> Cek { get; init; } = [];
}

/// <summary>
/// Rekap Trip (permintaan 13 Okt 2026): rangkuman lengkap satu trip beserta daftar hal yang masih kurang. Tampil dari menu ⋯
/// "Rekap Trip" dan sebelum Tutup Trip, supaya kekurangan bisa dibetulkan dulu. Dibaca dari seluruh data (arsip trip batal ikut).
/// </summary>
public static class Rekap
{
    public static readonly string[] UrutTingkat = ["kurang", "catatan", "ok"];

    public static string LabelTermin(TerminUj p) => JenisTermin.Label(p.Jenis);

    public static DataRekap Susun(BarisTrip trip, Database d)
    {
        var t = trip.T;
        var karyawan = new Dictionary<string, string>();
        foreach (var k in d.Karyawan) karyawan.TryAdd(k.Id, k.DriverName);
        string NamaKaryawan(string id) => karyawan.GetValueOrDefault(id) ?? "—";
        var klien = string.IsNullOrEmpty(t.ProjectId) ? null : d.Klien.FirstOrDefault(p => p.Id == t.ProjectId);
        var kontrak = string.IsNullOrEmpty(t.ContractId) ? null : d.Kontrak.FirstOrDefault(c => c.Id == t.ContractId);
        var termin = d.Termin.Where(p => p.TripId == t.Id).OrderBy(p => p.Sequence).ToList();
        var biaya = d.Biaya.Where(e => e.TripId == t.Id).OrderBy(e => e.ExpenseDate, StringComparer.Ordinal).ToList();
        var internal_ = d.BiayaInternal.Where(c => c.TripId == t.Id).OrderBy(c => c.CostDate, StringComparer.Ordinal).ToList();
        var kejadian = TripLogika.Kejadian(d.Kejadian, t.Id);
        var uj = termin.Sum(p => p.UjAmount);
        var kasbon = termin.Sum(p => p.KasbonDeduction);
        var biayaTotal = biaya.Sum(e => e.Amount);
        var biayaPerusahaan = biaya.Where(TripLogika.DibayarPerusahaan).Sum(e => e.Amount);
        var batal = trip.Batal;
        var dedicated = t.ServiceType == TipeKlien.Dedicated;

        var cek = new List<CekRekap>();
        void Tambah(bool ok, string teksOk, string teksKurang, string? tab = null, string tingkatKurang = "kurang") =>
            cek.Add(ok ? new CekRekap("ok", teksOk) : new CekRekap(tingkatKurang, teksKurang, tab));
        if (!batal)
        {
            Tambah(t.ProjectId != "", $"Klien {klien?.ProjectCode ?? ""}", "Klien belum dipilih", "edit");
            Tambah(t.VehicleId != "", $"Kendaraan {trip.PlateNumber}", "Kendaraan belum dipilih", "edit");
            Tambah(trip.DriverIds.Count > 0, $"Supir {trip.DriverNames}", "Supir belum dipilih", "edit");
            if (!dedicated) Tambah(t.RouteId != "", $"Rute {trip.RouteName}", "Rute belum dipilih", "edit");
            if (klien?.RequiresDocument != false)
                Tambah(trip.TrList.Count > 0, $"No Referensi {string.Join(", ", trip.TrList)}", "No Referensi dari klien belum diisi", "edit");
            Tambah(!string.IsNullOrEmpty(t.Pengirim?.Nama), "Pick Up Details terisi", "Pick Up Details belum diisi", "edit", "catatan");
            Tambah(!string.IsNullOrEmpty(t.Penerima?.Nama), "Destination Details terisi", "Destination Details belum diisi", "edit");
            Tambah(!string.IsNullOrEmpty(t.PrintedAt), "Berita Acara sudah dicetak", "Berita Acara belum dicetak", AturDetail.Overview, "catatan");
            Tambah(termin.Count > 0, $"Uang Jalan {termin.Count} termin", "Uang Jalan belum dicatat", AturDetail.Uj);
            // Catatan tiba / selesai bongkar tidak dicek lagi: tab Perjalanan dihapus (Baldy 22 Okt 2026).
            if (!dedicated) Tambah(trip.Harga > 0, $"Harga Jual {Format.Rupiah(trip.Harga)}", $"Harga Jual trip masih {Format.Rupiah(0)}: tagihan ke klien akan kosong", "edit");
            if (biaya.Count == 0) cek.Add(new CekRekap("catatan", "Belum ada biaya operasional (tol, solar, dst.). Abaikan bila memang tidak ada.", AturDetail.Biaya));
            if (trip.Ujroute > 0 && uj > trip.Ujroute) cek.Add(new CekRekap("catatan", $"Uang jalan {Format.Rupiah(uj)} di atas patokan {Format.Rupiah(trip.Ujroute)}", AturDetail.Uj));
        }

        return new DataRekap
        {
            Trip = trip,
            Klien = klien is not null ? $"{klien.ProjectCode} — {klien.ProjectName}" : "—",
            Layanan = TipeKlien.Label(klien?.ClientType ?? (string.IsNullOrEmpty(t.ServiceType) ? TipeKlien.Callout : t.ServiceType)),
            Kontrak = kontrak?.ContractNo ?? "",
            Supir = trip.DriverIds.Select(NamaKaryawan).ToList(),
            Manager = trip.ManagerLabel,
            Gandengan = AturanTrip.LabelGandengan(string.IsNullOrEmpty(t.Gandengan) ? trip.VehicleConfig : t.Gandengan),
            Muatan = TripLogika.Muatan(t),
            Kejadian = kejadian,
            Termin = termin,
            Biaya = biaya,
            Internal = internal_,
            NamaKaryawan = NamaKaryawan,
            Angka = new AngkaRekap
            {
                Uj = uj, Kasbon = kasbon, Tf = uj - kasbon, Biaya = biayaTotal, BiayaPerusahaan = biayaPerusahaan, BiayaSopir = biayaTotal - biayaPerusahaan,
                Ditagihkan = biaya.Where(TripLogika.Ditagihkan).Sum(e => e.Amount), Internal = internal_.Sum(c => c.Amount),
                Komisi = batal ? 0 : Hitung.Komisi(trip), Harga = trip.Harga, Tagihan = trip.TagihanTotal,
                UjDihitung = batal ? 0 : Hitung.UangJalan(trip), Netto = batal ? 0 : Hitung.Netto(trip),
            },
            Cek = cek,
        };
    }
}
