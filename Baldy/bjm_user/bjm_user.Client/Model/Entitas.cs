// Model data SIKOTIS. Nama properti JSON mengikuti data React (snake_case) supaya data contoh dan
// kontrak data backend tidak berubah; nama kelas memakai istilah bisnis PT Bimajaya Mustika.
using System.Text.Json.Serialization;

namespace bjm_user.Client.Model;

/// <summary>Semua record punya id dan jejak waktu.</summary>
public abstract class Record
{
    public string Id { get; set; } = "";
    public string CreatedAt { get; set; } = "";
    public string UpdatedAt { get; set; } = "";
}

/// <summary>Record yang terpisah antar workspace (cabang). Kosong = Priok (data lama).</summary>
public abstract class RecordWorkspace : Record
{
    public string? Workspace { get; set; }
}

public sealed class Pengguna : Record
{
    public string Username { get; set; } = "";
    public string Name { get; set; } = "";
    public string Role { get; set; } = Peran.Admin;
    public bool Aktif { get; set; } = true;
}

/// <summary>Dokumen penting (KTP, SIM, STNK, ...) dengan masa berlaku opsional (yyyy-mm-dd).</summary>
public sealed class DokumenPenting
{
    public List<string> Berkas { get; set; } = [];
    public string? BerlakuSampai { get; set; }
    /// <summary>Nomor dokumen (No. KTP, No. STNK, No. KIR, No. BPKB) untuk jenis yang memakainya.</summary>
    public string? Nomor { get; set; }
}

/// <summary>Master -> Supir / Karyawan (koleksi `drivers`).</summary>
public sealed class Karyawan : Record
{
    public string DriverCode { get; set; } = "";
    /// <summary>Nama panggilan: nama yang dipakai di trip, laporan, dan cetakan (seperti kolom SUPIR di Excel klien).</summary>
    public string DriverName { get; set; } = "";
    /// <summary>Nama lengkap sesuai KTP.</summary>
    public string NamaLengkap { get; set; } = "";
    public string Role { get; set; } = PeranKaryawan.Sopir;
    public string Address1 { get; set; } = "";
    public string Address2 { get; set; } = "";
    public string City { get; set; } = "";
    public string Phone { get; set; } = "";
    public string Status { get; set; } = "aktif";
    public Dictionary<string, DokumenPenting>? Dokumen { get; set; }
    public List<string> Attachments { get; set; } = [];
}

/// <summary>Master -> Rute.</summary>
public sealed class Rute : Record
{
    public string RouteCode { get; set; } = "";
    public string? RouteCodeLama { get; set; }
    public string RouteName { get; set; } = "";
    public string ProjectId { get; set; } = "";
    public string Feet { get; set; } = "";
    public long Ujroute { get; set; }
    public long Toll { get; set; }
    public long Commissioner { get; set; }
    public long Price { get; set; }
    public List<string>? EstimatedFields { get; set; }
    public string? KodeAreaAsal { get; set; }
    public string? KodeAreaTujuan { get; set; }
}

/// <summary>Master -> Kendaraan.</summary>
public sealed class Kendaraan : Record
{
    public string PlateNumber { get; set; } = "";
    public string VehicleType { get; set; } = "";
    public string Configuration { get; set; } = "";
    public string Status { get; set; } = "aktif";
    public Dictionary<string, DokumenPenting>? Dokumen { get; set; }
    public List<string> Attachments { get; set; } = [];
}

/// <summary>Master -> Alamat: titik pick up / destinasi beserta kontaknya.</summary>
public sealed class Alamat : Record
{
    public string KodeArea { get; set; } = "";
    public string Nama { get; set; } = "";
    [JsonPropertyName("alamat")] public string Jalan { get; set; } = "";
    public string Kota { get; set; } = "";
    public string NamaKontak { get; set; } = "";
    public string Telepon { get; set; } = "";
    public string ProjectId { get; set; } = "";
    public string Jenis { get; set; } = JenisAlamat.Keduanya;
    public string LatLong { get; set; } = "";
    public string IdLokasiKlien { get; set; } = "";
    public string Catatan { get; set; } = "";
    public string Status { get; set; } = "aktif";
}

/// <summary>Salinan alamat pada satu trip (pick up / destinasi).</summary>
public sealed class TitikAlamat
{
    public string? AlamatId { get; set; }
    public string Nama { get; set; } = "";
    [JsonPropertyName("alamat")] public string Jalan { get; set; } = "";
    public string Kontak { get; set; } = "";
    public string Telepon { get; set; } = "";
    public string? Catatan { get; set; }

    public TitikAlamat Salin() => (TitikAlamat)MemberwiseClone();
}

/// <summary>Add Items Details: barang yang dibawa satu trip.</summary>
public sealed class ItemMuatan
{
    public string IdPerjalanan { get; set; } = "";
    public string Keterangan { get; set; } = "";
    public ItemMuatan Salin() => (ItemMuatan)MemberwiseClone();
}

/// <summary>Master -> Klien (koleksi `projects`).</summary>
public sealed class Klien : Record
{
    public string ProjectCode { get; set; } = "";
    public string ProjectName { get; set; } = "";
    public string ClientType { get; set; } = TipeKlien.Callout;
    public string Description { get; set; } = "";
    public string AlamatResmi { get; set; } = "";
    /// <summary>Alamat surat-menyurat bila berbeda dari alamat resmi.</summary>
    public string AlamatSurat { get; set; } = "";
    /// <summary>ID perpajakan (NPWP) klien.</summary>
    public string Npwp { get; set; } = "";
    public bool RequiresDocument { get; set; } = true;
    public string Status { get; set; } = "aktif";
}

/// <summary>SI / Job Order (Priok).</summary>
public sealed class JobOrder : Record
{
    public string Sijo { get; set; } = "";
    public string CustomerCode { get; set; } = "";
    public string CustomerName { get; set; } = "";
    public string CustomerAddress { get; set; } = "";
    public string Party { get; set; } = "";
    public string Ship { get; set; } = "";
    public string Goods { get; set; } = "";
    public bool IsComplete { get; set; }
}

/// <summary>Kontrak layanan Dedicated milik satu klien.</summary>
public sealed class Kontrak : RecordWorkspace
{
    public string ContractNo { get; set; } = "";
    public string ProjectId { get; set; } = "";
    public long Value { get; set; }
    public string StartDate { get; set; } = "";
    public string EndDate { get; set; } = "";
    public string Status { get; set; } = "aktif";
    public string Notes { get; set; } = "";
    public List<string> Attachments { get; set; } = [];
}

/// <summary>Penyelesaian uang jalan yang sudah diterima sopir saat trip dibatalkan.</summary>
public sealed class PenyelesaianUj
{
    public string UjPaymentId { get; set; } = "";
    public string DriverId { get; set; } = "";
    public long Tf { get; set; }
    /// <summary>kembali (dikembalikan tunai) atau kasbon (jadi kasbon sopir).</summary>
    public string Cara { get; set; } = "kasbon";
}

public sealed class NilaiPi
{
    public long Pokok { get; set; }
    public long Tambahan { get; set; }
    public long Total { get; set; }
}

/// <summary>Transaksi -> Trip (koleksi `transactions`): satu perjalanan beserta seluruh catatannya.</summary>
public sealed class Trip : RecordWorkspace
{
    public string TransactionNo { get; set; } = "";
    public string TransactionDate { get; set; } = "";
    public string? OrderDate { get; set; }
    public string ServiceType { get; set; } = TipeKlien.Callout;
    public string ContractId { get; set; } = "";
    public List<string> TripIds { get; set; } = [];
    public List<ItemMuatan>? Muatan { get; set; }
    public string RouteId { get; set; } = "";
    public List<string>? TrNumbers { get; set; }
    public string? LokasiMuat { get; set; }
    public string? LokasiBongkar { get; set; }
    public string? BackloadDari { get; set; }
    public bool? AdaBackload { get; set; }
    public TitikAlamat? Pengirim { get; set; }
    public TitikAlamat? Penerima { get; set; }
    public string? Gandengan { get; set; }
    public string? PoolAt { get; set; }
    public string SjNo { get; set; } = "";
    public string ManagerId { get; set; } = "";
    public string ManagerName { get; set; } = "";
    public string ProjectId { get; set; } = "";
    public string Status { get; set; } = StatusTrip.Aktif;
    public string RecipientName { get; set; } = "";
    public string RecipientAddress1 { get; set; } = "";
    public string RecipientAddress2 { get; set; } = "";
    public string VehicleId { get; set; } = "";
    public string DriverId { get; set; } = "";
    public List<string> DriverIds { get; set; } = [];
    public string JobOrderId { get; set; } = "";
    public string Party { get; set; } = "";
    public string GoodsType { get; set; } = "";
    public string Kosongan { get; set; } = "";
    public string Location { get; set; } = "";
    public string Ship { get; set; } = "";
    public string DestinationDetail { get; set; } = "";
    public string TrReference { get; set; } = "";
    public string PiNumber { get; set; } = "";
    public string PiStatus { get; set; } = "";
    public string? PiTahap { get; set; }
    public string? PiDate { get; set; }
    public string? PiTahapDate { get; set; }
    public string? PiNote { get; set; }
    public List<string>? PiAttachments { get; set; }
    public NilaiPi? PiNilai { get; set; }
    public string? ClosedAt { get; set; }
    public bool? PodFisik { get; set; }
    public string? PodFisikAt { get; set; }
    public List<string>? PodAttachments { get; set; }
    public long? CancelFee { get; set; }
    public long CostValue { get; set; }
    public string? OverrideNote { get; set; }
    public List<string>? OverrideAttachments { get; set; }
    public string Notes { get; set; } = "";
    public bool IsMarked { get; set; }
    public string? BonDate { get; set; }
    public long PersonalBon { get; set; }
    public string? PrintedAt { get; set; }
    public string? CancelledAt { get; set; }
    public string CancelReason { get; set; } = "";
    public List<PenyelesaianUj> CancelSettlement { get; set; } = [];
    public string ContainerNo { get; set; } = "";
}

/// <summary>Termin uang jalan. Transfer ke sopir = UJ − potong kasbon.</summary>
public sealed class TerminUj : Record
{
    public string TripId { get; set; } = "";
    public int Sequence { get; set; }
    public string PaymentDate { get; set; } = "";
    public string DriverId { get; set; } = "";
    public string? Jenis { get; set; }
    public long UjAmount { get; set; }
    public long KasbonDeduction { get; set; }
    public string? OverrideNote { get; set; }
    public string? OverrideBy { get; set; }
    public string Notes { get; set; } = "";
    public List<string> Attachments { get; set; } = [];

    public long Tf => UjAmount - KasbonDeduction;
}

/// <summary>Biaya operasional (nota di jalan) satu trip.</summary>
public sealed class BiayaOperasional : Record
{
    public string TripId { get; set; } = "";
    public string ExpenseType { get; set; } = "";
    public long Amount { get; set; }
    public string ExpenseDate { get; set; } = "";
    public string Notes { get; set; } = "";
    public bool? Ditagihkan { get; set; }
    public string? Dibayar { get; set; }
    public List<string> Attachments { get; set; } = [];
}

/// <summary>Biaya internal perusahaan atas satu trip (komisi, uang makan, kernet, ...).</summary>
public sealed class BiayaInternal : Record
{
    public string TripId { get; set; } = "";
    public string CostType { get; set; } = "";
    public long Amount { get; set; }
    public string CostDate { get; set; } = "";
    public string Notes { get; set; } = "";
    public string RecipientRole { get; set; } = "";
    public string RecipientId { get; set; } = "";
    public string RecipientName { get; set; } = "";
    public List<string> Attachments { get; set; } = [];
}

/// <summary>Kejadian selama perjalanan (tab Perjalanan).</summary>
public sealed class KejadianTrip : Record
{
    public string TripId { get; set; } = "";
    public string Jenis { get; set; } = "";
    public string Waktu { get; set; } = "";
    public string Lokasi { get; set; } = "";
    public string Catatan { get; set; } = "";
    public List<string> Attachments { get; set; } = [];
}

/// <summary>Dokumen / catatan lain yang menyertai trip (tab Dokumen).</summary>
public sealed class CatatanTrip : Record
{
    public string TripId { get; set; } = "";
    public string NoteDate { get; set; } = "";
    public string Title { get; set; } = "";
    public string Notes { get; set; } = "";
    public List<string> Attachments { get; set; } = [];
}

/// <summary>Satu mutasi kasbon karyawan: positif menambah utang karyawan, negatif mengurangi.</summary>
public sealed class MutasiKasbon : Record
{
    public string EmployeeId { get; set; } = "";
    public string EntryDate { get; set; } = "";
    public string Kind { get; set; } = JenisKasbon.Admin;
    public long Amount { get; set; }
    public string TripId { get; set; } = "";
    public string UjPaymentId { get; set; } = "";
    public string Notes { get; set; } = "";
    public List<string> Attachments { get; set; } = [];
}

/// <summary>Transaksi -> Data Tagihan (Priok).</summary>
public sealed class Tagihan : RecordWorkspace
{
    public string InvoiceNo { get; set; } = "";
    public string JobOrderId { get; set; } = "";
    public string CostCode { get; set; } = "";
    public string BillingDate { get; set; } = "";
    public string WithdrawalDate { get; set; } = "";
    public long Amount { get; set; }
    public long GuaranteeAmount { get; set; }
    public bool IsSunting { get; set; }
    public bool IsRejected { get; set; }
    public string? PaidDate { get; set; }
    public bool IsMarked { get; set; }
    public string BlNo { get; set; } = "";
    public string InvoiceRef { get; set; } = "";
    public string Notes { get; set; } = "";
}

public sealed class TingkatKomisi
{
    public long TargetAwal { get; set; }
    /// <summary>0 = tanpa batas atas.</summary>
    public long TargetAkhir { get; set; }
    public double Commission { get; set; }
    /// <summary>rp atau persen.</summary>
    public string CommissionUnit { get; set; } = "rp";
    public TingkatKomisi Salin() => (TingkatKomisi)MemberwiseClone();
}

/// <summary>Komisi -> tab Aturan: satu peran + layanan + konfigurasi kendaraan, dengan beberapa tingkat.</summary>
public sealed class AturanKomisi : RecordWorkspace
{
    public string Name { get; set; } = "";
    public string Role { get; set; } = PeranKaryawan.Sopir;
    public string ServiceType { get; set; } = "semua";
    public List<string> Configurations { get; set; } = [];
    public string Basis { get; set; } = DasarKomisi.Nilai;
    public double BaseDeductionPct { get; set; }
    public bool IsActive { get; set; } = true;
    public List<TingkatKomisi> Tiers { get; set; } = [];
    public string Notes { get; set; } = "";
}

public sealed class PerubahanAudit
{
    public string Field { get; set; } = "";
    public string Dari { get; set; } = "";
    public string Ke { get; set; } = "";
}

/// <summary>Pengaturan -> Audit Log.</summary>
public sealed class CatatanAudit : RecordWorkspace
{
    public string Waktu { get; set; } = "";
    public string Username { get; set; } = "";
    public string Nama { get; set; } = "";
    public string Peran { get; set; } = "";
    public string Aksi { get; set; } = "";
    public string Entitas { get; set; } = "";
    public string EntityId { get; set; } = "";
    public string Label { get; set; } = "";
    public string Ringkasan { get; set; } = "";
    public List<PerubahanAudit> Perubahan { get; set; } = [];
}

/// <summary>Dokumen umum yang tidak menempel pada satu trip.</summary>
public sealed class Dokumen : RecordWorkspace
{
    public string Judul { get; set; } = "";
    public string Kategori { get; set; } = "Umum";
    public string Tanggal { get; set; } = "";
    public string Catatan { get; set; } = "";
    public List<string> Attachments { get; set; } = [];
}
