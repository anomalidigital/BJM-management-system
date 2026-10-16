namespace bjm_user.Client.Model;

/// <summary>Trip yang sudah digabung dengan supir, kendaraan, rute, klien, termin, biaya, dan komisi (padanan TransactionRow).</summary>
public sealed class BarisTrip
{
    public required Trip T { get; init; }

    public string Id => T.Id;
    public string IdTampil => T.TransactionNo;
    public string Status => T.Status;
    public bool Batal => T.Status == StatusTrip.Batal;

    public List<string> DriverIds { get; init; } = [];
    public string DriverCode { get; init; } = "";
    public string DriverName { get; init; } = "";
    public string DriverNames { get; init; } = "";
    public string PlateNumber { get; init; } = "";
    public string Sijo { get; init; } = "";
    public string RouteCode { get; init; } = "";
    public string RouteName { get; init; } = "";
    public long RoutePrice { get; init; }
    /// <summary>Harga trip yang dipakai komisi & pendapatan: Harga trip, atau Harga Rute bila kosong.</summary>
    public long Harga { get; init; }
    public bool HargaKhusus { get; init; }
    public long Ujroute { get; init; }
    public long Toll { get; init; }
    public long Commissioner { get; init; }
    public string ProjectCode { get; init; } = "";
    public string ProjectName { get; init; } = "";
    public string ManagerLabel { get; init; } = "";
    public long UjTotal { get; init; }
    public long KasbonTotal { get; init; }
    public long TfTotal { get; init; }
    public int TerminCount { get; init; }
    public long ExpenseTotal { get; init; }
    public long InternalTotal { get; init; }
    public long TollPaid { get; init; }
    public string VehicleConfig { get; init; } = "";
    public string ContractNo { get; init; } = "";
    public string ClientName { get; init; } = "";
    public List<string> TrList { get; init; } = [];
    public string Muat { get; init; } = "";
    public string Bongkar { get; init; } = "";
    public string Ata { get; init; } = "";
    public KejadianTrip? Posisi { get; init; }
    public long BiayaDitagihkan { get; init; }
    public long BiayaPerusahaan { get; init; }
    public long KomisiSopir { get; init; }
    public long KomisiManager { get; init; }
    public string KomisiKeterangan { get; init; } = "";
    public string IdPerjalanan { get; init; } = "";
    public bool MenahanKendaraan { get; init; }
    public long TagihanTotal { get; init; }
    public string AreaAsal { get; init; } = "";
    public string AreaTujuan { get; init; } = "";
}

/// <summary>Tagihan Priok yang sudah digabung dengan SI/JO.</summary>
public sealed class BarisTagihan
{
    public required Tagihan B { get; init; }
    public string Sijo { get; init; } = "";
    public string CustomerName { get; init; } = "";
    public string CustomerCode { get; init; } = "";
    public string Party { get; init; } = "";
}
