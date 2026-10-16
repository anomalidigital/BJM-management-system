using bjm_user.Client.Data;
using bjm_user.Client.Komponen.Ui;
using bjm_user.Client.Logika;
using bjm_user.Client.Model;

namespace bjm_user.Client.Pages.PapanDashboard;

/// <summary>Satu trip di papan depo: satu kotak kontainer.</summary>
public sealed record TripPapan(string Id, string Status);

/// <summary>Satu kolom tanggal di papan depo.</summary>
/// <param name="Label">"Sel, 9 Sep" untuk keterangan.</param>
/// <param name="Mendatang">Hari setelah hari ini: belum terjadi.</param>
public sealed record HariPapan(string Iso, int Tanggal, string Label, List<TripPapan> Trip, bool Mendatang, bool HariIni);

/// <summary>Satu baris antrian "Perlu ditindak". Nada: masalah (merah), perhatian (kuning sinyal), info (abu baja).</summary>
public sealed record ItemTindak(string Id, string Label, string? Keterangan, int Jumlah, string Ke, string Nada);

public sealed record KontrakBerjalan(string Id, string Nomor, string KlienId, string Klien, long Nilai, long Sisa);

public sealed record BarisRitan(string Id, string Nama, string Keterangan, int Ritan);

public sealed record JumlahTerbaru(int Trip, int Tagihan, int BelumLunas, int Ditolak, int Sijo, int Komplit);

public sealed record RingkasanPi(List<BarisTrip> Rows, int Total, int BelumLunas);

/// <summary>Satu seri grafik garis: warna berupa nilai CSS (mis. var(--series-1)).</summary>
public sealed record SeriGrafik(string Nama, string Warna, List<long> Nilai);

public sealed record UangBulan(long Uj, long Kasbon, long Tf, long Biaya, int Termin);

/// <summary>Warna & urutan status di papan gelap (padanan HeroDepo.tsx).</summary>
public static class StatusPapan
{
    /// <summary>Status yang dihitung di papan, urut dari dasar tumpukan ke atas.</summary>
    public static readonly string[] UrutTumpuk = [StatusTrip.Selesai, StatusTrip.Aktif, StatusTrip.MenungguSopir, StatusTrip.Draft];

    /// <summary>Hijau beres, biru di jalan, kuning perlu supir, abu belum mulai.</summary>
    public static string Warna(string s) => s switch
    {
        StatusTrip.Selesai => "#46c58a",
        StatusTrip.Aktif => "#6fb5ff",
        StatusTrip.MenungguSopir => "var(--signal)",
        _ => "#8da2bf",
    };

    /// <summary>Gaya isi kotak. Draft = kontainer kosong: hanya garis tepi.</summary>
    public static string Isi(string s) => s == StatusTrip.Draft
        ? "background:transparent;background-image:none;box-shadow:inset 0 0 0 1.5px #8da2bf"
        : $"background:{Warna(s)}";

    public static int Urutan(string s) => Array.IndexOf(UrutTumpuk, s);
}

/// <summary>
/// Semua angka Dashboard dalam satu kali hitung (padanan useMemo di DashboardPage.tsx).
/// Trip batal hanya arsip: tidak dihitung di ringkasan mana pun.
/// </summary>
public sealed class RingkasanPapan
{
    public required Periode Periode { get; init; }
    public required Periode Sebelum { get; init; }
    public required Hitung.Ringkasan Kini { get; init; }
    public required Hitung.Ringkasan Lalu { get; init; }
    public int Batal { get; init; }
    public required Dictionary<string, int> PerStatus { get; init; }
    public required List<HariPapan> Hari { get; init; }
    public required List<string> TrenHari { get; init; }
    public required List<long> TrenPendapatan { get; init; }
    public required List<long> TrenKomisi { get; init; }
    public int SopirBertugas { get; init; }
    public int SopirAktif { get; init; }
    public int KaryawanAktif { get; init; }
    public int KaryawanTotal { get; init; }
    public int MobilTerpakai { get; init; }
    public int MobilTotal { get; init; }
    public required List<ItemTindak> Tindak { get; init; }
    public required UangBulan Uang { get; init; }
    public required UangBulan UangLalu { get; init; }
    public int CalloutTrip { get; init; }
    public long CalloutPendapatan { get; init; }
    public int DedicatedTrip { get; init; }
    public required List<KontrakBerjalan> Kontrak { get; init; }
    public required List<BarisRitan> Ritan { get; init; }
    public required List<BarisTrip> TripTerbaru { get; init; }
    public required List<BarisTagihan> TagihanTerbaru { get; init; }
    public required List<JobOrder> SijoTerbaru { get; init; }
    public required RingkasanPi Pi { get; init; }
    public required JumlahTerbaru Jumlah { get; init; }

    private static string Layanan(BarisTrip t) => string.IsNullOrEmpty(t.T.ServiceType) ? TipeKlien.Callout : t.T.ServiceType;

    /// <summary>"Sel, 9 Sep": hari singkat, tanggal, bulan singkat (tanpa tahun).</summary>
    private static string LabelHari(string iso)
    {
        var s = Format.TanggalHari(iso);
        var akhir = s.LastIndexOf(' ');
        return akhir > 0 ? s[..akhir] : s;
    }

    private static UangBulan HitungUang(List<BarisTrip> rows) => new(
        rows.Sum(t => t.UjTotal), rows.Sum(t => t.KasbonTotal), rows.Sum(t => t.TfTotal), rows.Sum(t => t.ExpenseTotal), rows.Sum(t => t.TerminCount));

    /// <param name="cabangContainer">
    /// SI/Job Order & nomor container hanya ada di Priok; Karawang memakai No. Referensi (TR) dan No PI,
    /// dengan ID Trip sebagai penanda trip.
    /// </param>
    public static RingkasanPapan Susun(Db db, bool cabangContainer)
    {
        var rows = db.Baris;
        var tagihan = db.BarisTagihan;
        var data = db.Data;

        var periode = Periode.Aktif(rows.Select(t => t.T.TransactionDate));
        var sebelum = periode.Sebelumnya();
        var hariIni = Format.HariIni();

        var bulanIni = rows.Where(t => Hitung.Dihitung(t) && periode.Memuat(t.T.TransactionDate)).ToList();
        var bulanLalu = rows.Where(t => Hitung.Dihitung(t) && sebelum.Memuat(t.T.TransactionDate)).ToList();
        var batal = rows.Count(t => t.Status == StatusTrip.Batal && periode.Memuat(t.T.TransactionDate));

        var perStatus = StatusPapan.UrutTumpuk.ToDictionary(s => s, s => bulanIni.Count(t => t.Status == s));

        // Satu kolom per tanggal sebulan penuh; hari yang belum terjadi tampil kosong.
        var perTanggal = bulanIni.GroupBy(t => t.T.TransactionDate).ToDictionary(g => g.Key, g => g.ToList());
        var jumlahHari = int.Parse(periode.Akhir.Substring(8, 2));
        var awalan = periode.Awal[..8];
        var hari = Enumerable.Range(1, jumlahHari).Select(i =>
        {
            var iso = $"{awalan}{i:D2}";
            var trip = (perTanggal.GetValueOrDefault(iso) ?? [])
                .Select(t => new TripPapan(t.Id, t.Status))
                .OrderBy(t => StatusPapan.Urutan(t.Status))
                .ToList();
            return new HariPapan(iso, i, LabelHari(iso), trip, string.CompareOrdinal(iso, hariIni) > 0, iso == hariIni);
        }).ToList();

        // Pendapatan & komisi per hari, dari tanggal 1 sampai hari ini (atau trip terakhir bila tanggalnya sudah lewat hari ini).
        var tglAkhir = new[] { hariIni }.Concat(bulanIni.Select(t => t.T.TransactionDate))
            .Where(d => string.CompareOrdinal(d, periode.Awal) >= 0 && string.CompareOrdinal(d, periode.Akhir) <= 0)
            .OrderBy(d => d, StringComparer.Ordinal)
            .LastOrDefault() ?? periode.Akhir;
        var tanggalTren = hari.Take(int.Parse(tglAkhir.Substring(8, 2))).Select(h => h.Iso).ToList();
        var trenPendapatan = tanggalTren.Select(iso => (perTanggal.GetValueOrDefault(iso) ?? []).Sum(Hitung.Pendapatan)).ToList();
        var trenKomisi = tanggalTren.Select(iso => (perTanggal.GetValueOrDefault(iso) ?? []).Sum(Hitung.Komisi)).ToList();

        var sopirBertugas = bulanIni.SelectMany(t => t.DriverIds).Distinct().Count();
        var sopirAktif = data.Karyawan.Count(d => (string.IsNullOrEmpty(d.Role) ? PeranKaryawan.Sopir : d.Role) == PeranKaryawan.Sopir && d.Status == "aktif");
        var karyawanAktif = data.Karyawan.Count(d => d.Status == "aktif");
        var mobilTerpakai = bulanIni.Select(t => t.T.VehicleId).Where(v => !string.IsNullOrEmpty(v)).Distinct().Count();
        var mobilTotal = data.Kendaraan.Count(v => v.Status == "aktif");

        // Klien yang punya alur dokumen (TR dari DHL, lalu PI). CASH tidak.
        var klienDokumen = data.Klien.Where(p => p.RequiresDocument).Select(p => p.Id).ToHashSet();
        var tripDokumen = rows.Where(t => t.Status != StatusTrip.Batal && klienDokumen.Contains(t.T.ProjectId)).ToList();
        // Antrean PI sama dengan halaman Tagihan: semua trip selesai kecuali klien tanpa dokumen (CASH).
        var klienTanpaPi = data.Klien.Where(p => !p.RequiresDocument).Select(p => p.Id).ToHashSet();

        // Yang perlu ditindak, urut dari yang paling mendesak.
        var tindak = new List<ItemTindak>
        {
            new("menunggu-sopir", "Trip menunggu supir", "Pilih supir supaya trip bisa jalan.", perStatus[StatusTrip.MenungguSopir], "transaksi/trip", "perhatian"),
        };
        // Karawang (12 Okt 2026): mobil baru bisa dipakai trip lain setelah tercatat kembali di pool.
        if (!cabangContainer)
            tindak.Add(new("belum-pool", "Mobil belum kembali ke pool", "Trip sudah selesai. Tandai setelah mobil kembali, supaya bisa dipakai trip lain.",
                rows.Count(t => t.Status == StatusTrip.Selesai && t.MenahanKendaraan), "transaksi/trip?pool=belum", "perhatian"));
        tindak.Add(cabangContainer
            ? new("sj-draft", "Surat Jalan belum dicetak", "Trip sudah bernomor Surat Jalan tapi belum dicetak.",
                rows.Count(t => !string.IsNullOrEmpty(t.T.SjNo) && string.IsNullOrEmpty(t.T.PrintedAt) && t.Status != StatusTrip.Batal), "transaksi/trip", "perhatian")
            : new("ba-draft", "Berita Acara belum dicetak", "Trip yang sedang berjalan sebaiknya membawa Berita Acara.",
                rows.Count(t => string.IsNullOrEmpty(t.T.PrintedAt) && (t.Status == StatusTrip.Aktif || t.Status == StatusTrip.MenungguSopir)), "transaksi/trip", "perhatian"));
        tindak.Add(new("ditolak", "Tagihan ditolak", "Perlu diperbaiki lalu diajukan ulang.", tagihan.Count(b => b.B.IsRejected), "transaksi/tagihan", "masalah"));
        // Flow Karawang: trip selesai & dokumen fisik diterima -> buat PI -> tagihan.
        if (!cabangContainer)
            tindak.Add(new("belum-pi", "Trip selesai belum ada No PI", "Buat PI lalu tagihkan ke klien.",
                rows.Count(t => string.IsNullOrEmpty(t.T.PiTahap) && !klienTanpaPi.Contains(t.T.ProjectId)
                    && (t.Status == StatusTrip.Selesai || (t.Status == StatusTrip.Batal && (t.T.CancelFee ?? 0) > 0))), "transaksi/tagihan", "perhatian"));
        // Tambahan versi Blazor: surat kendaraan & dokumen karyawan yang habis / habis dalam 30 hari.
        tindak.Add(ItemDokumen("dok-kendaraan", "Dokumen kendaraan habis atau segera habis", "Perbarui di master Kendaraan.", "master/mobil",
            data.Kendaraan.Where(v => v.Status != "nonaktif").Select(v => DokumenPentingInput.Ringkas(DokumenPentingJenis.Kendaraan, v.Dokumen))));
        tindak.Add(ItemDokumen("dok-karyawan", "Dokumen karyawan habis atau segera habis", "Perbarui di master Supir / Karyawan.", "master/karyawan",
            data.Karyawan.Where(d => d.Status != "nonaktif").Select(d => DokumenPentingInput.Ringkas(DokumenPentingJenis.Karyawan, d.Dokumen))));
        tindak.Add(new("belum-selesai",
            cabangContainer ? "Trip belum ditandai Selesai" : "Trip belum ditutup",
            cabangContainer ? "Tandai setelah mobil kembali ke pool." : "Tutup setelah POD diterima, sekaligus tanyakan backload / rute lanjutan.",
            bulanIni.Count(t => t.Status != StatusTrip.Selesai), "transaksi/trip", "info"));
        tindak.Add(new("belum-lunas", "Tagihan belum lunas", "Belum ada tanggal lunas.",
            tagihan.Count(b => string.IsNullOrEmpty(b.B.PaidDate) && !b.B.IsRejected), "transaksi/tagihan", "info"));
        if (cabangContainer)
        {
            tindak.Add(new("sijo-belum-komplit", "SI / Job Order belum komplit", null, data.JobOrders.Count(j => !j.IsComplete), "pencarian/sijo", "info"));
            tindak.Add(new("id-trip", "Trip tanpa ID Perjalanan/Trip", null, bulanIni.Count(t => t.T.TripIds.Count == 0), "transaksi/trip", "info"));
        }
        else
        {
            tindak.Add(new("tanpa-tr", "Trip tanpa No. Referensi", "Isi No. Referensi (nomor TR/OR dari DHL) di form trip.",
                tripDokumen.Count(t => t.TrList.Count == 0), "transaksi/trip", "info"));
        }

        // Callout = klien tetap, Dedicated = klien kontrak.
        var callout = bulanIni.Where(t => Layanan(t) == TipeKlien.Callout).ToList();

        var terpakai = new Dictionary<string, long>();
        foreach (var t in rows)
        {
            if (string.IsNullOrEmpty(t.T.ContractId) || t.Status == StatusTrip.Batal) continue;
            terpakai[t.T.ContractId] = terpakai.GetValueOrDefault(t.T.ContractId) + t.UjTotal + t.ExpenseTotal + t.InternalTotal;
        }
        var klien = data.Klien.ToDictionary(p => p.Id);
        var kontrak = data.Kontrak
            .Where(c => c.Status == "aktif")
            .Select(c => new KontrakBerjalan(c.Id, c.ContractNo, c.ProjectId, klien.GetValueOrDefault(c.ProjectId)?.ProjectName ?? "Klien tidak ditemukan",
                c.Value, c.Value - terpakai.GetValueOrDefault(c.Id)))
            .OrderBy(k => (double)k.Sisa / Math.Max(1, k.Nilai))
            .ToList();

        // Ritan per supir utama.
        var ritan = bulanIni.GroupBy(t => t.T.DriverId)
            .Where(g => !string.IsNullOrEmpty(g.Key))
            .Select(g =>
            {
                var daftar = g.ToList();
                var komisi = daftar.Sum(Hitung.Komisi);
                var uj = daftar.Sum(r => r.UjTotal);
                return new BarisRitan(g.Key, string.IsNullOrEmpty(daftar[0].DriverName) ? "Tanpa nama" : daftar[0].DriverName,
                    komisi > 0 ? $"komisi {Format.RupiahRingkas(komisi)}" : uj > 0 ? $"uang jalan {Format.RupiahRingkas(uj)}" : "",
                    daftar.Count);
            })
            .OrderByDescending(r => r.Ritan)
            .Take(6)
            .ToList();

        // Karawang: PI terbaru menurut tanggal tahap terakhirnya.
        var adaPi = rows.Where(t => !string.IsNullOrEmpty(t.T.PiTahap)).ToList();

        return new RingkasanPapan
        {
            Periode = periode, Sebelum = sebelum, Kini = Hitung.Ringkas(bulanIni), Lalu = Hitung.Ringkas(bulanLalu), Batal = batal,
            PerStatus = perStatus, Hari = hari, TrenHari = tanggalTren, TrenPendapatan = trenPendapatan, TrenKomisi = trenKomisi,
            SopirBertugas = sopirBertugas, SopirAktif = sopirAktif, KaryawanAktif = karyawanAktif, KaryawanTotal = data.Karyawan.Count,
            MobilTerpakai = mobilTerpakai, MobilTotal = mobilTotal,
            Tindak = tindak.Where(a => a.Jumlah > 0).ToList(),
            Uang = HitungUang(bulanIni), UangLalu = HitungUang(bulanLalu),
            CalloutTrip = callout.Count, CalloutPendapatan = callout.Sum(Hitung.Pendapatan), DedicatedTrip = bulanIni.Count - callout.Count,
            Kontrak = kontrak, Ritan = ritan,
            TripTerbaru = rows
                .OrderByDescending(t => t.T.TransactionDate, StringComparer.Ordinal)
                .ThenByDescending(t => t.T.TransactionNo, StringComparer.Ordinal)
                .Take(6).ToList(),
            TagihanTerbaru = tagihan.OrderByDescending(b => b.B.BillingDate, StringComparer.Ordinal).Take(6).ToList(),
            SijoTerbaru = Enumerable.Reverse(data.JobOrders.TakeLast(6)).ToList(),
            Pi = new RingkasanPi(
                adaPi.OrderByDescending(t => t.T.PiTahapDate ?? t.T.PiDate ?? "", StringComparer.Ordinal)
                    .ThenByDescending(t => t.T.TransactionNo, StringComparer.Ordinal)
                    .Take(6).ToList(),
                adaPi.Count,
                adaPi.Count(t => t.T.PiTahap != TahapPi.Lunas)),
            Jumlah = new JumlahTerbaru(rows.Count, tagihan.Count,
                tagihan.Count(b => string.IsNullOrEmpty(b.B.PaidDate) && !b.B.IsRejected), tagihan.Count(b => b.B.IsRejected),
                data.JobOrders.Count, data.JobOrders.Count(j => j.IsComplete)),
        };
    }

    /// <summary>Satu item dokumen: jumlah pemilik (kendaraan / karyawan) yang punya dokumen habis atau habis dalam 30 hari.</summary>
    private static ItemTindak ItemDokumen(string id, string label, string saran, string ke, IEnumerable<DokumenPentingInput.Ringkasan> semua)
    {
        var daftar = semua.ToList();
        var habis = daftar.Count(r => r.Habis.Count > 0);
        var segera = daftar.Count(r => r.Habis.Count == 0 && r.Segera.Count > 0);
        var bagian = new List<string>();
        if (habis > 0) bagian.Add($"{Format.Angka(habis)} sudah habis");
        if (segera > 0) bagian.Add($"{Format.Angka(segera)} habis dalam 30 hari");
        var keterangan = bagian.Count > 0 ? $"{string.Join(", ", bagian)}. {saran}" : saran;
        return new ItemTindak(id, label, keterangan, habis + segera, ke, habis > 0 ? "masalah" : "perhatian");
    }
}
