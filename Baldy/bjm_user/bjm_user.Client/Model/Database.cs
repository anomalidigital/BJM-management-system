using System.Text.Json;
using System.Text.Json.Serialization;

namespace bjm_user.Client.Model;

/// <summary>Seluruh data aplikasi. Nama koleksi mengikuti data React (camelCase) supaya data contoh terbaca.</summary>
public sealed class Database
{
    [JsonPropertyName("drivers")] public List<Karyawan> Karyawan { get; set; } = [];
    [JsonPropertyName("routes")] public List<Rute> Rute { get; set; } = [];
    [JsonPropertyName("vehicles")] public List<Kendaraan> Kendaraan { get; set; } = [];
    [JsonPropertyName("jobOrders")] public List<JobOrder> JobOrders { get; set; } = [];
    [JsonPropertyName("transactions")] public List<Trip> Trip { get; set; } = [];
    [JsonPropertyName("billings")] public List<Tagihan> Tagihan { get; set; } = [];
    [JsonPropertyName("projects")] public List<Klien> Klien { get; set; } = [];
    [JsonPropertyName("ujPayments")] public List<TerminUj> Termin { get; set; } = [];
    [JsonPropertyName("expenses")] public List<BiayaOperasional> Biaya { get; set; } = [];
    [JsonPropertyName("internalCosts")] public List<BiayaInternal> BiayaInternal { get; set; } = [];
    [JsonPropertyName("tripNotes")] public List<CatatanTrip> CatatanTrip { get; set; } = [];
    [JsonPropertyName("tripEvents")] public List<KejadianTrip> Kejadian { get; set; } = [];
    [JsonPropertyName("kasbonEntries")] public List<MutasiKasbon> Kasbon { get; set; } = [];
    [JsonPropertyName("commissionSchemes")] public List<AturanKomisi> AturanKomisi { get; set; } = [];
    [JsonPropertyName("contracts")] public List<Kontrak> Kontrak { get; set; } = [];
    [JsonPropertyName("alamat")] public List<Alamat> Alamat { get; set; } = [];
    [JsonPropertyName("auditLogs")] public List<CatatanAudit> Audit { get; set; } = [];
    [JsonPropertyName("dokumen")] public List<Dokumen> Dokumen { get; set; } = [];

    /// <summary>Pengaturan JSON data: snake_case, enum sebagai string, properti tak dikenal diabaikan.</summary>
    public static readonly JsonSerializerOptions Json = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        NumberHandling = JsonNumberHandling.AllowReadingFromString,
        ReadCommentHandling = JsonCommentHandling.Skip,
        AllowTrailingCommas = true,
    };

    public static Database? Dari(string json)
    {
        try { return JsonSerializer.Deserialize<Database>(json, Json); } catch { return null; }
    }

    public string KeJson() => JsonSerializer.Serialize(this, Json);

    /// <summary>Salinan dalam (lewat JSON) untuk membandingkan sebelum / sesudah perubahan.</summary>
    public static T Salin<T>(T v) => JsonSerializer.Deserialize<T>(JsonSerializer.Serialize(v, Json), Json)!;
}

/// <summary>Nama koleksi (kunci JSON) yang dipakai Audit Log dan Tools.</summary>
public static class Koleksi
{
    public const string Trip = "transactions", Rute = "routes", Karyawan = "drivers", Kendaraan = "vehicles", Klien = "projects",
        Kontrak = "contracts", Termin = "ujPayments", Biaya = "expenses", BiayaInternal = "internalCosts", CatatanTrip = "tripNotes",
        Kejadian = "tripEvents", Kasbon = "kasbonEntries", AturanKomisi = "commissionSchemes", Alamat = "alamat", Dokumen = "dokumen",
        Tagihan = "billings", JobOrder = "jobOrders", Audit = "auditLogs";

    public static string Label(string k) => k switch
    {
        Trip => "Trip", Rute => "Rute", Karyawan => "Supir / Karyawan", Kendaraan => "Kendaraan", Klien => "Klien", Kontrak => "Kontrak",
        Termin => "Uang jalan", Biaya => "Biaya operasional", BiayaInternal => "Biaya internal", CatatanTrip => "Dokumen trip",
        Kejadian => "Perjalanan", Kasbon => "Kasbon", AturanKomisi => "Aturan komisi", Alamat => "Alamat", Dokumen => "Dokumen",
        Tagihan => "Tagihan", JobOrder => "SI / Job Order", _ => k,
    };

    /// <summary>Koleksi yang isinya terpisah antar workspace.</summary>
    public static readonly HashSet<string> PerWorkspace = [Trip, Tagihan, AturanKomisi, Kontrak, Dokumen];
}
