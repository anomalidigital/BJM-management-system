using System.Text.Json;
using bjm_user.Client.Model;

namespace bjm_user.Client.Logika;

/// <summary>Audit Log: pembanding record dan penanda yang dibaca orang (padanan lib/audit.ts).</summary>
public static class AuditLogika
{
    private static readonly HashSet<string> Abaikan = ["updated_at", "created_at", "id"];

    public static string NilaiAudit(JsonElement v)
    {
        switch (v.ValueKind)
        {
            case JsonValueKind.Null or JsonValueKind.Undefined: return "—";
            case JsonValueKind.True: return "Ya";
            case JsonValueKind.False: return "Tidak";
            case JsonValueKind.Array:
            {
                var isi = v.EnumerateArray().Select(x => x.ValueKind == JsonValueKind.Object ? x.GetRawText() : x.ToString()).ToList();
                if (isi.Count == 0) return "—";
                var s = string.Join(", ", isi);
                return s.Length > 80 ? s[..80] : s;
            }
            case JsonValueKind.Object: { var s = v.GetRawText(); return s.Length > 80 ? s[..80] : s; }
            default:
            {
                var s = v.ToString();
                if (s == "") return "—";
                return s.Length > 80 ? s[..80] : s;
            }
        }
    }

    /// <summary>Isian yang berubah antara record lama dan baru (dibandingkan lewat JSON).</summary>
    public static List<PerubahanAudit> Beda<T>(T lama, T baru)
    {
        var a = JsonSerializer.SerializeToElement(lama, Database.Json);
        var b = JsonSerializer.SerializeToElement(baru, Database.Json);
        var keluar = new List<PerubahanAudit>();
        var kunci = a.EnumerateObject().Select(p => p.Name).Union(b.EnumerateObject().Select(p => p.Name));
        foreach (var k in kunci)
        {
            if (Abaikan.Contains(k)) continue;
            var adaA = a.TryGetProperty(k, out var va);
            var adaB = b.TryGetProperty(k, out var vb);
            var ta = adaA ? va.GetRawText() : "null";
            var tb = adaB ? vb.GetRawText() : "null";
            if (ta == tb) continue;
            keluar.Add(new PerubahanAudit { Field = k, Dari = adaA ? NilaiAudit(va) : "—", Ke = adaB ? NilaiAudit(vb) : "—" });
        }
        return keluar;
    }

    /// <summary>Penanda record yang dibaca orang: Kode Trip, nama rute, plat, nama karyawan, ...</summary>
    public static string Label(string koleksi, object row, Database d)
    {
        string Trip(string id) => d.Trip.FirstOrDefault(x => x.Id == id)?.TransactionNo ?? "";
        return row switch
        {
            Trip t => t.TransactionNo,
            Rute r => r.RouteName,
            Karyawan k => k.DriverName,
            Kendaraan v => v.PlateNumber,
            Klien p => p.ProjectName,
            Kontrak c => c.ContractNo,
            Alamat a => string.Join(" · ", new[] { a.KodeArea, a.Nama }.Where(x => x != "")),
            Dokumen dk => dk.Judul,
            AturanKomisi s => s.Name,
            Tagihan b => b.InvoiceNo,
            JobOrder j => j.Sijo,
            TerminUj u => string.Join(" · ", new[] { $"Termin {u.Sequence}", Trip(u.TripId) }.Where(x => x != "")),
            BiayaOperasional e => string.Join(" · ", new[] { e.ExpenseType, Trip(e.TripId) }.Where(x => x != "")),
            BiayaInternal c => string.Join(" · ", new[] { c.CostType, Trip(c.TripId) }.Where(x => x != "")),
            KejadianTrip e => string.Join(" · ", new[] { e.Jenis, Trip(e.TripId) }.Where(x => x != "")),
            CatatanTrip n => string.Join(" · ", new[] { n.Title, Trip(n.TripId) }.Where(x => x != "")),
            MutasiKasbon m => d.Karyawan.FirstOrDefault(x => x.Id == m.EmployeeId)?.DriverName ?? "",
            Record r => r.Id,
            _ => "",
        };
    }

    /// <summary>Tautan ke halaman sumber record, bila ada.</summary>
    public static string? Tautan(string entitas, string id, Database d)
    {
        string? KeTrip(string? tripId) => string.IsNullOrEmpty(tripId) ? null : $"transaksi/trip/{tripId}";
        return entitas switch
        {
            Koleksi.Trip => d.Trip.Any(t => t.Id == id) ? $"transaksi/trip/{id}" : null,
            Koleksi.Termin => KeTrip(d.Termin.FirstOrDefault(x => x.Id == id)?.TripId),
            Koleksi.Biaya => KeTrip(d.Biaya.FirstOrDefault(x => x.Id == id)?.TripId),
            Koleksi.BiayaInternal => KeTrip(d.BiayaInternal.FirstOrDefault(x => x.Id == id)?.TripId),
            Koleksi.Kejadian => KeTrip(d.Kejadian.FirstOrDefault(x => x.Id == id)?.TripId),
            Koleksi.CatatanTrip => KeTrip(d.CatatanTrip.FirstOrDefault(x => x.Id == id)?.TripId),
            Koleksi.Karyawan => d.Karyawan.Any(x => x.Id == id) ? $"master/karyawan/{id}" : null,
            Koleksi.Klien => d.Klien.Any(x => x.Id == id) ? $"master/klien/{id}" : null,
            Koleksi.Rute => "master/rute",
            Koleksi.Kendaraan => "master/mobil",
            Koleksi.Alamat => "master/alamat",
            Koleksi.AturanKomisi => "laporan/komisi?tab=aturan",
            Koleksi.Dokumen => "dokumen",
            _ => null,
        };
    }
}
