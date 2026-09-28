# Database Schema — SIKOTIS

Relational schema untuk Phase 2. Prototype saat ini memakai bentuk yang sama di
`localStorage`, jadi migrasi ke database tinggal memindahkan sumber datanya.

## Relasi tingkat tinggi

```text
drivers ─────┐
             ├──> commission_transactions <──── routes
vehicles ────┤              │
             │              │
job_orders ──┘              ├──> delivery_notes (Surat Jalan)
     │                      │
     │                      └──> (Cek Ritan: bon_date, personal_bon)
     │
     └──> billings (Data Tagihan)

commission_transactions ──> Laporan Komisi (per sopir / semua / global)
commission_transactions + billings ──> Laporan Pendapatan Netto
```

Satu **SI / Job Order** dapat memiliki banyak transaksi komisi (banyak mobil), banyak
surat jalan, dan satu atau lebih tagihan. Inilah yang membuat kolom `Sijo` bisa diklik:
dari satu nomor, sistem menampilkan customer beserta seluruh mobil dan sopirnya.

## DDL (PostgreSQL / MySQL-compatible)

```sql
CREATE TABLE drivers (
  id            BIGSERIAL PRIMARY KEY,
  driver_code   VARCHAR(20)  NOT NULL UNIQUE,   -- Kode
  driver_name   VARCHAR(120) NOT NULL,          -- Nama Sopir
  address_1     VARCHAR(180),                   -- Alamat   (jalan dan nomor)
  address_2     VARCHAR(120),                   -- Alamat 2 (kecamatan / area)
  city          VARCHAR(80)  NOT NULL,          -- Kota
  phone         VARCHAR(25),
  status        VARCHAR(10)  NOT NULL DEFAULT 'aktif',
  created_at    TIMESTAMP    NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE routes (
  id            BIGSERIAL PRIMARY KEY,
  route_code    VARCHAR(20)  NOT NULL UNIQUE,   -- No. Route
  route_name    VARCHAR(140) NOT NULL,          -- Nama Route
  fart          VARCHAR(10)  NOT NULL,          -- Fart (1X20, 1X40, 2X20, ...)
  ujroute       BIGINT       NOT NULL DEFAULT 0,-- UjRoute
  commissioner  BIGINT       NOT NULL DEFAULT 0,-- Komisioner
  price         BIGINT       NOT NULL DEFAULT 0,-- Harga
  created_at    TIMESTAMP    NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE vehicles (
  id            BIGSERIAL PRIMARY KEY,
  plate_number  VARCHAR(20)  NOT NULL UNIQUE,   -- No Mobil / No. Polisi
  vehicle_type  VARCHAR(40),
  status        VARCHAR(10)  NOT NULL DEFAULT 'aktif',
  created_at    TIMESTAMP    NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE job_orders (
  id                BIGSERIAL PRIMARY KEY,
  sijo              VARCHAR(30)  NOT NULL UNIQUE, -- Sijo / No. SI - Job Order
  customer_code     VARCHAR(20)  NOT NULL,        -- Kode Cust
  customer_name     VARCHAR(160) NOT NULL,        -- Customer
  customer_address  VARCHAR(220),
  party             VARCHAR(40),                  -- Party
  ship              VARCHAR(120),                 -- Kapal
  goods             VARCHAR(120),                 -- Barang
  is_complete       BOOLEAN      NOT NULL DEFAULT FALSE, -- Komplit
  created_at        TIMESTAMP    NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMP    NOT NULL DEFAULT NOW()
);
```

```sql
CREATE TABLE commission_transactions (
  id                  BIGSERIAL PRIMARY KEY,
  transaction_no      VARCHAR(20) NOT NULL UNIQUE,  -- NoTrans (YYYYMM + urut)
  transaction_date    DATE        NOT NULL,         -- Tanggal
  driver_id           BIGINT      NOT NULL REFERENCES drivers(id),
  vehicle_id          BIGINT      NOT NULL REFERENCES vehicles(id),
  job_order_id        BIGINT      NOT NULL REFERENCES job_orders(id),
  route_id            BIGINT      NOT NULL REFERENCES routes(id),
  destination_detail  VARCHAR(140),                 -- Detail Tujuan
  container_no        VARCHAR(30),                  -- Kont
  is_done             BOOLEAN     NOT NULL DEFAULT FALSE, -- Selesai
  bon_date            DATE,                         -- Tgl Bon    (Cek Ritan)
  personal_bon        BIGINT      NOT NULL DEFAULT 0,-- Bon Pribadi (Cek Ritan)
  created_at          TIMESTAMP   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMP   NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_trx_date   ON commission_transactions(transaction_date);
CREATE INDEX idx_trx_driver ON commission_transactions(driver_id);
CREATE INDEX idx_trx_jo     ON commission_transactions(job_order_id);

CREATE TABLE billings (
  id                BIGSERIAL PRIMARY KEY,
  invoice_no        VARCHAR(30) NOT NULL UNIQUE,  -- No Faktur / Nofaktur
  job_order_id      BIGINT      NOT NULL REFERENCES job_orders(id),
  cost_code         VARCHAR(20) NOT NULL,         -- Data Cost / Kodecost
  billing_date      DATE        NOT NULL,         -- Tgl Tagih
  withdrawal_date   DATE,                         -- Tgl Tarik
  amount            BIGINT      NOT NULL DEFAULT 0, -- Jumlah Rp
  guarantee_amount  BIGINT      NOT NULL DEFAULT 0, -- Jaminan Rp
  is_sunting        BOOLEAN     NOT NULL DEFAULT FALSE, -- SUNTING
  is_rejected       BOOLEAN     NOT NULL DEFAULT FALSE, -- DITOLAK
  paid_date         DATE,                         -- Tanggal Lunas
  bl_no             VARCHAR(30),                  -- legacy, bukan fokus MVP
  invoice_ref       VARCHAR(30),                  -- legacy
  notes             TEXT,                         -- legacy
  created_at        TIMESTAMP   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMP   NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_billing_date ON billings(billing_date);
CREATE INDEX idx_billing_cost ON billings(cost_code);
```

```sql
CREATE TABLE delivery_notes (              -- Surat Jalan
  id                   BIGSERIAL PRIMARY KEY,
  sj_no                VARCHAR(30) NOT NULL UNIQUE, -- Nomor Surat Jalan
  sj_date              DATE        NOT NULL,        -- Tanggal
  recipient_name       VARCHAR(160) NOT NULL,       -- Kepada Yth
  recipient_address_1  VARCHAR(180),                -- di (baris 1)
  recipient_address_2  VARCHAR(180),                -- di (baris 2)
  vehicle_id           BIGINT REFERENCES vehicles(id),   -- No.Polisi
  job_order_id         BIGINT REFERENCES job_orders(id), -- SI/BL
  party                VARCHAR(40),                 -- Party
  goods_type           VARCHAR(80),                 -- Jenis Brg
  kosongan             VARCHAR(80),                 -- Kosongan
  location             VARCHAR(80),                 -- Lokasi
  ship                 VARCHAR(120),                -- Kapal
  destination          VARCHAR(140),                -- Tujuan
  printed_at           DATE,                        -- NULL = Draft
  created_at           TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Container dibuat sebagai tabel terpisah supaya jumlahnya tidak dibatasi
-- (menggantikan popup "masukkan jumlah container" pada aplikasi lama).
CREATE TABLE delivery_note_containers (
  id                BIGSERIAL PRIMARY KEY,
  delivery_note_id  BIGINT      NOT NULL REFERENCES delivery_notes(id) ON DELETE CASCADE,
  container_no      VARCHAR(20) NOT NULL,
  sort_order        INT         NOT NULL DEFAULT 0,
  UNIQUE (delivery_note_id, container_no)   -- container tidak boleh dobel dalam 1 SJ
);

-- Opsional / implementasi berikutnya (Data Bon Sopir tidak masuk MVP)
CREATE TABLE driver_bons (
  id                  BIGSERIAL PRIMARY KEY,
  driver_id           BIGINT NOT NULL REFERENCES drivers(id),
  transaction_id      BIGINT REFERENCES commission_transactions(id),
  bon_date            DATE   NOT NULL,
  personal_bon_amount BIGINT NOT NULL DEFAULT 0,
  created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMP NOT NULL DEFAULT NOW()
);
```

## Catatan

- Nominal disimpan sebagai `BIGINT` dalam satuan Rupiah penuh (tanpa desimal) untuk
  menghindari galat pembulatan floating point.
- Pada prototype, `containers` masih berupa array di dalam objek Surat Jalan; di database
  bentuknya menjadi tabel `delivery_note_containers` seperti di atas.
- Constraint `UNIQUE (delivery_note_id, container_no)` menegakkan aturan validasi
  "Nomor container sudah digunakan" di level database.

---

# Tambahan — Corrective Update

Ditambahkan setelah cross-check dengan spreadsheet operasional real. Ketiga tabel di
bawah menggantikan asumsi lama bahwa satu trip hanya punya satu nilai uang jalan dan
bahwa biaya operasional cukup disimpan sebagai kolom tetap.

```sql
CREATE TABLE projects (
  id           BIGSERIAL PRIMARY KEY,
  project_code VARCHAR(20)  NOT NULL UNIQUE,   -- SLB, ATLAS, PDT, ...
  project_name VARCHAR(120) NOT NULL,
  description  VARCHAR(240),
  -- Data real: seluruh trip CASH tercatat tanpa TR dan tanpa No PI.
  -- Penanda ini memisahkan order tunai dari dimensi customer (TBD-09).
  requires_document BOOLEAN NOT NULL DEFAULT TRUE,
  status       VARCHAR(10)  NOT NULL DEFAULT 'aktif',
  created_at   TIMESTAMP    NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- Uang jalan dibayar bertahap: data real menunjukkan 1 sampai 4 termin per trip.
CREATE TABLE uj_payments (
  id                BIGSERIAL PRIMARY KEY,
  trip_id           BIGINT   NOT NULL REFERENCES commission_transactions(id) ON DELETE CASCADE,
  sequence          INT      NOT NULL,          -- Termin ke-
  payment_date      DATE     NOT NULL,
  uj_amount         BIGINT   NOT NULL DEFAULT 0, -- UJ
  kasbon_deduction  BIGINT   NOT NULL DEFAULT 0, -- Potong Kasbon
  notes             TEXT,
  created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (trip_id, sequence),
  -- Aturan TERVERIFIKASI dari formula asli spreadsheet.
  CONSTRAINT chk_kasbon CHECK (kasbon_deduction <= uj_amount)
);
-- tf_amount TIDAK disimpan; selalu dihitung: uj_amount - kasbon_deduction

-- Jenis biaya sebagai data, bukan tujuh kolom permanen.
CREATE TABLE operational_expenses (
  id           BIGSERIAL PRIMARY KEY,
  trip_id      BIGINT      NOT NULL REFERENCES commission_transactions(id) ON DELETE CASCADE,
  expense_type VARCHAR(40) NOT NULL,   -- DEX, Tol, SPSI, Nginap, Reimbus, Uang Dorong, ...
  amount       BIGINT      NOT NULL DEFAULT 0,
  expense_date DATE        NOT NULL,
  notes        TEXT,
  created_at   TIMESTAMP   NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMP   NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_expense_trip ON operational_expenses(trip_id);
CREATE INDEX idx_expense_type ON operational_expenses(expense_type);

-- Biaya internal: pengeluaran perusahaan sendiri atas satu trip.
-- Dipisah dari operational_expenses agar laporan internal dan biaya jalan
-- tidak tercampur (lihat TBD-19).
CREATE TABLE internal_costs (
  id         BIGSERIAL PRIMARY KEY,
  trip_id    BIGINT      NOT NULL REFERENCES commission_transactions(id) ON DELETE CASCADE,
  cost_type  VARCHAR(40) NOT NULL,   -- Uang Jalan, Uang Makan, Kernet, Servis & Sparepart, ...
  amount     BIGINT      NOT NULL DEFAULT 0,
  cost_date  DATE        NOT NULL,
  notes      TEXT,
  created_at TIMESTAMP   NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP   NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_internal_trip ON internal_costs(trip_id);

-- Komisi (menu Master -> Komisi). Daftar tarif, bukan pemantauan:
-- komisi dasar dipakai selama target belum tercapai, setelah tercapai memakai
-- komisi target. Tiap nilai boleh Rupiah atau persen (TBD-16).
CREATE TABLE commission_schemes (
  id                     BIGSERIAL PRIMARY KEY,
  workspace              VARCHAR(20)   NOT NULL DEFAULT 'jakarta',
  name                   VARCHAR(140)  NOT NULL,       -- Nama
  target                 BIGINT        NOT NULL DEFAULT 0,
  base_commission        NUMERIC(14,2) NOT NULL DEFAULT 0,
  base_commission_unit   VARCHAR(10)   NOT NULL DEFAULT 'rp',   -- rp | persen
  target_commission      NUMERIC(14,2) NOT NULL DEFAULT 0,
  target_commission_unit VARCHAR(10)   NOT NULL DEFAULT 'rp',
  notes                  TEXT,
  created_at             TIMESTAMP     NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMP     NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_scheme_workspace ON commission_schemes(workspace);
```

## Perubahan pada tabel yang sudah ada

```sql
ALTER TABLE vehicles ADD COLUMN configuration VARCHAR(20);   -- 6X6, DL, LB, HB, EXT, ...

ALTER TABLE commission_transactions
  ADD COLUMN project_id   BIGINT REFERENCES projects(id),
  ADD COLUMN tr_reference VARCHAR(30),   -- TR, DIPISAH dari sijo (TBD-08)
  ADD COLUMN pi_number    VARCHAR(30),   -- No PI, nomor saja
  ADD COLUMN pi_status    VARCHAR(40),   -- "di pool", "masih moving" - dulu menumpang di No PI
  ADD COLUMN cost_value   BIGINT DEFAULT 0,  -- Harga trip (COST di spreadsheet); 0 = ikut Harga route
  ADD COLUMN status       VARCHAR(10) NOT NULL DEFAULT 'draft', -- draft/aktif/selesai/batal
  ADD COLUMN notes        TEXT;

-- Kolom is_done lama digantikan status; migrasi memetakan
-- is_done = true  -> status 'selesai'
-- is_done = false -> status 'aktif'
ALTER TABLE commission_transactions DROP COLUMN is_done;

ALTER TABLE routes ADD COLUMN toll BIGINT NOT NULL DEFAULT 0;  -- Uang Tol (TBD-18)

-- Workspace (Jakarta / Tangerang): satu aplikasi, dua sistem management.
-- Hanya tabel transaksional yang dipisah; master masih dipakai bersama (TBD-17).
ALTER TABLE commission_transactions ADD COLUMN workspace VARCHAR(20) NOT NULL DEFAULT 'jakarta';
ALTER TABLE delivery_notes          ADD COLUMN workspace VARCHAR(20) NOT NULL DEFAULT 'jakarta';
ALTER TABLE billings                ADD COLUMN workspace VARCHAR(20) NOT NULL DEFAULT 'jakarta';
CREATE INDEX idx_trx_workspace ON commission_transactions(workspace, transaction_date);
```

## Catatan penting

- `tf_amount` sengaja **tidak** disimpan sebagai kolom. Nilainya turunan
  (`uj_amount - kasbon_deduction`), jadi menyimpannya hanya menciptakan peluang data
  tidak sinkron.
- `route_rates` (tarif per rute yang bisa berubah menurut project / kendaraan / tanggal
  berlaku) **belum** dibuat. Data real menunjukkan COST pada rute yang sama bisa berbeda
  (`CIB - DURI`: 35jt / 42jt / 43jt), tetapi penentunya belum diketahui — menunggu
  jawaban TBD-02 sebelum strukturnya dikunci.

---

# Perubahan 25 September 2026 — Trip, Karyawan, Kasbon, Lampiran

Surat Jalan dan Data Pengeluaran **digabung menjadi Trip**: satu perjalanan menyimpan
dokumen Surat Jalan-nya sekaligus seluruh catatan keuangannya. Tabel `delivery_notes`
dan `delivery_note_containers` tidak dipakai lagi; datanya dipindah ke
`commission_transactions` (nama tabel dipertahankan karena seluruh laporan membacanya).

```sql
-- Data Sopir -> Data Karyawan: tabel yang sama, ditambah peran.
ALTER TABLE drivers ADD COLUMN role VARCHAR(10) NOT NULL DEFAULT 'sopir';  -- sopir | manager

-- Satu route milik satu project; UJ route ikut terhitung ke project itu.
-- route_code kini dibuat otomatis: 13 digit timestamp + 7 huruf mati acak.
ALTER TABLE routes ADD COLUMN project_id BIGINT REFERENCES projects(id);
ALTER TABLE routes ALTER COLUMN route_code TYPE VARCHAR(30);

-- Trip menyerap field Surat Jalan.
ALTER TABLE commission_transactions
  ADD COLUMN sj_no               VARCHAR(30) UNIQUE,              -- Nomor Surat Jalan (boleh kosong)
  ADD COLUMN manager_id          BIGINT REFERENCES drivers(id),   -- manager terdaftar...
  ADD COLUMN manager_name        VARCHAR(120),                    -- ...atau diisi manual
  ADD COLUMN recipient_name      VARCHAR(160),                    -- Kepada Yth
  ADD COLUMN recipient_address_1 VARCHAR(180),
  ADD COLUMN recipient_address_2 VARCHAR(180),
  ADD COLUMN party               VARCHAR(40),
  ADD COLUMN goods_type          VARCHAR(80),                     -- Jenis Brg
  ADD COLUMN kosongan            VARCHAR(80),
  ADD COLUMN location            VARCHAR(80),                     -- Lokasi
  ADD COLUMN ship                VARCHAR(120),                    -- Kapal
  ADD COLUMN printed_at          DATE;                            -- NULL = belum dicetak
ALTER TABLE commission_transactions ALTER COLUMN driver_id    DROP NOT NULL;  -- = sopir utama
ALTER TABLE commission_transactions ALTER COLUMN vehicle_id   DROP NOT NULL;
ALTER TABLE commission_transactions ALTER COLUMN job_order_id DROP NOT NULL;
ALTER TABLE commission_transactions DROP COLUMN container_no;   -- pindah ke trip_refs

-- ID Perjalanan/Trip (dulu No. Container / Kont): boleh lebih dari satu per trip.
CREATE TABLE trip_refs (
  id         BIGSERIAL PRIMARY KEY,
  trip_id    BIGINT      NOT NULL REFERENCES commission_transactions(id) ON DELETE CASCADE,
  trip_ref   VARCHAR(30) NOT NULL,
  sort_order INT         NOT NULL DEFAULT 0,
  UNIQUE (trip_id, trip_ref)
);
CREATE INDEX idx_trip_ref ON trip_refs(trip_ref);   -- cek kembar antar trip yang belum batal

-- Sopir: boleh lebih dari satu per trip; urutan 0 = sopir utama.
CREATE TABLE trip_drivers (
  trip_id    BIGINT NOT NULL REFERENCES commission_transactions(id) ON DELETE CASCADE,
  driver_id  BIGINT NOT NULL REFERENCES drivers(id),
  sort_order INT    NOT NULL DEFAULT 0,
  PRIMARY KEY (trip_id, driver_id)
);

-- Termin UJ mencatat sopir penerima; potong kasbon diambil dari kasbon sopir itu.
ALTER TABLE uj_payments ADD COLUMN driver_id BIGINT REFERENCES drivers(id);

-- Biaya internal jenis "Komisi" mencatat penerimanya.
ALTER TABLE internal_costs
  ADD COLUMN recipient_role VARCHAR(10),                    -- sopir | manager
  ADD COLUMN recipient_id   BIGINT REFERENCES drivers(id),  -- terdaftar...
  ADD COLUMN recipient_name VARCHAR(120);                   -- ...atau manual

-- Tab "Lainnya" (dulu Dokumen): berkas, gambar, atau catatan bebas per trip.
CREATE TABLE trip_notes (
  id         BIGSERIAL PRIMARY KEY,
  trip_id    BIGINT       NOT NULL REFERENCES commission_transactions(id) ON DELETE CASCADE,
  note_date  DATE         NOT NULL,
  title      VARCHAR(160) NOT NULL,
  notes      TEXT,
  created_at TIMESTAMP    NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- Kasbon karyawan sebagai buku mutasi. amount bertanda: + menambah kasbon, - mengurangi.
-- Saldo = SUM(amount) per karyawan.
CREATE TABLE kasbon_entries (
  id            BIGSERIAL PRIMARY KEY,
  employee_id   BIGINT      NOT NULL REFERENCES drivers(id),
  entry_date    DATE        NOT NULL,
  kind          VARCHAR(12) NOT NULL,   -- admin | trip | pembatalan | manual
  amount        BIGINT      NOT NULL,
  trip_id       BIGINT REFERENCES commission_transactions(id) ON DELETE SET NULL,
  uj_payment_id BIGINT REFERENCES uj_payments(id) ON DELETE SET NULL,  -- mutasi "trip" otomatis
  notes         TEXT,
  created_at    TIMESTAMP   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP   NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_kasbon_employee ON kasbon_entries(employee_id, entry_date);

-- Lampiran untuk seluruh record (foto kendaraan, bukti UJ / biaya, berkas Lainnya,
-- bukti kasbon). Prototype menyimpan isinya di IndexedDB browser.
CREATE TABLE attachments (
  id          BIGSERIAL PRIMARY KEY,
  owner_table VARCHAR(40)  NOT NULL,   -- vehicles, uj_payments, operational_expenses, ...
  owner_id    BIGINT       NOT NULL,
  file_name   VARCHAR(200) NOT NULL,
  mime_type   VARCHAR(80)  NOT NULL,
  size_bytes  BIGINT       NOT NULL,
  storage_key VARCHAR(200) NOT NULL,   -- lokasi di object storage
  created_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_attachment_owner ON attachments(owner_table, owner_id);

-- Komisi bertingkat: satu pengaturan untuk satu peran, berisi beberapa tingkat target.
ALTER TABLE commission_schemes
  ADD COLUMN role VARCHAR(10) NOT NULL DEFAULT 'sopir',
  DROP COLUMN target, DROP COLUMN base_commission, DROP COLUMN base_commission_unit,
  DROP COLUMN target_commission, DROP COLUMN target_commission_unit;
CREATE TABLE commission_tiers (
  id              BIGSERIAL PRIMARY KEY,
  scheme_id       BIGINT        NOT NULL REFERENCES commission_schemes(id) ON DELETE CASCADE,
  target_awal     BIGINT        NOT NULL DEFAULT 0,
  target_akhir    BIGINT,                          -- NULL = tanpa batas atas
  commission      NUMERIC(14,2) NOT NULL DEFAULT 0,
  commission_unit VARCHAR(10)   NOT NULL DEFAULT 'rp'  -- rp | persen
);

DROP TABLE delivery_note_containers;
DROP TABLE delivery_notes;
```

## Aturan yang dijalankan aplikasi

- **UJ ikut route.** Saat trip dibuat, termin 1 terisi otomatis sebesar UJROUTE route.
  Bila route diganti dan termin itu belum diubah tangan, nilainya ikut route baru.
- **Potong kasbon** tidak boleh melebihi UJ termin maupun saldo kasbon sopir penerima.
  Menyimpan termin otomatis membuat / memperbarui mutasi kasbon jenis `trip`.
- **Batalkan Trip**: status menjadi `batal`, seluruh termin, biaya, biaya internal, dan
  catatan Lainnya dihapus. Potongan kasbon tetap di riwayat, lalu dikembalikan lewat
  mutasi `pembatalan` sehingga saldo kembali seperti sebelum trip.
- **Hapus Trip**: trip dan seluruh catatannya hilang, termasuk mutasi kasbon yang tertaut.

---

# Perubahan 28 September 2026 — Komisi dari meeting, Dedicated, pembatalan tanpa hapus

```sql
-- Karyawan: dokumen (KTP, SIM, dll) lewat tabel attachments (owner_table = 'drivers').
-- Status piutang = saldo kasbon > 0 (dihitung, tidak disimpan).

-- Layanan trip dipilih di awal form: callout (per order) atau dedicated (kontrak).
-- Kontrak milik satu klien dan dikelola di halaman klien (Master -> Klien -> detail).
CREATE TABLE contracts (
  id           BIGSERIAL PRIMARY KEY,
  workspace    VARCHAR(20)  NOT NULL DEFAULT 'jakarta',
  contract_no  VARCHAR(30)  NOT NULL UNIQUE,      -- KTR-2026-001
  project_id   BIGINT       NOT NULL REFERENCES projects(id),  -- klien pemilik kontrak
  value        BIGINT       NOT NULL,             -- nilai kontrak
  start_date   DATE,
  end_date     DATE,
  status       VARCHAR(10)  NOT NULL DEFAULT 'aktif',
  notes        TEXT,
  created_at   TIMESTAMP    NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMP    NOT NULL DEFAULT NOW()
);
ALTER TABLE commission_transactions
  ADD COLUMN service_type      VARCHAR(10) NOT NULL DEFAULT 'callout',  -- callout | dedicated
  ADD COLUMN contract_id       BIGINT REFERENCES contracts(id),         -- wajib untuk dedicated
  ADD COLUMN cancelled_at      DATE,
  ADD COLUMN cancel_reason     TEXT;
-- Penyelesaian UJ saat trip batal: TF yang sudah diterima sopir dikembalikan atau jadi kasbon.
CREATE TABLE trip_cancel_settlements (
  trip_id       BIGINT NOT NULL REFERENCES commission_transactions(id) ON DELETE CASCADE,
  uj_payment_id BIGINT NOT NULL REFERENCES uj_payments(id),
  driver_id     BIGINT REFERENCES drivers(id),
  tf            BIGINT NOT NULL,
  method        VARCHAR(10) NOT NULL,          -- kembali | kasbon
  PRIMARY KEY (trip_id, uj_payment_id)
);

-- Komisi: satu-satunya sumber aturan. Kolom routes.commissioner tidak dipakai lagi.
ALTER TABLE commission_schemes
  ADD COLUMN service_type       VARCHAR(10) NOT NULL DEFAULT 'callout', -- callout | dedicated | semua
  ADD COLUMN basis              VARCHAR(10) NOT NULL DEFAULT 'nilai',   -- nilai | uj | kontrak
  ADD COLUMN base_deduction_pct NUMERIC(5,2) NOT NULL DEFAULT 0,        -- mis. 5 untuk (nilai - 5%)
  ADD COLUMN is_active          BOOLEAN NOT NULL DEFAULT TRUE;
CREATE TABLE commission_scheme_vehicles (          -- kosong = semua kendaraan
  scheme_id     BIGINT NOT NULL REFERENCES commission_schemes(id) ON DELETE CASCADE,
  configuration VARCHAR(20) NOT NULL,              -- HB, LB, DL, TRONTON, CDD, ...
  PRIMARY KEY (scheme_id, configuration)
);
```

## Aturan yang dijalankan aplikasi (menggantikan bagian sebelumnya)

- **UJROUTE = patokan.** Membuat trip tidak lagi mencatat uang jalan otomatis. Termin
  dicatat saat uang benar-benar dibayar; tab Uang Jalan menampilkan sisa terhadap patokan.
- **Batalkan Trip tidak menghapus apa pun.** Status menjadi `batal`, semua catatan tetap
  ada sebagai arsip dan dikeluarkan dari seluruh laporan. Potongan kasbon dikembalikan;
  TF yang sudah diterima sopir dicatat dikembalikan tunai, atau dijadikan kasbon sopir.
- **Komisi trip** = aturan aktif yang paling cocok (peran, layanan, konfigurasi kendaraan).
  Dasar `nilai` = COST trip, atau Harga route bila COST kosong. Nilai di antara dua tingkat
  ikut tingkat berikutnya; di bawah tingkat pertama tidak dapat komisi. Penerimanya sopir
  utama; sopir tambahan lewat biaya operasional "Double Driver".
- **Komisi Dedicated** dihitung per kontrak: (nilai kontrak - potongan dasar) x persen.
- **Tol**: Uang Tol route = patokan; yang dihitung hanya biaya operasional jenis Tol.
- **Biaya internal** tidak punya jenis "Uang Jalan" lagi (data lama diubah ke "Lainnya").
- **Kasbon manual** hanya "Kasbon dari Admin" dan "Penyesuaian" (wajib catatan).
- **No. Route** dibuat tombol Generate: 13 digit waktu + 7 huruf mati acak, dijamin unik; boleh diketik manual.

---

# Perubahan 28 September 2026 (lanjutan) — Harga trip, jenis klien

```sql
-- Jenis klien: tetap (order per perjalanan, Callout) atau kontrak (perusahaan lain
-- yang memakai jasa lewat kontrak Dedicated). Kontrak hanya untuk klien kontrak.
ALTER TABLE projects ADD COLUMN client_type VARCHAR(10) NOT NULL DEFAULT 'tetap';  -- tetap | kontrak
```

- **Harga trip** = `cost_value` bila diisi, selain itu Harga route. Trip baru terisi Harga
  route dan boleh diubah. Harga trip menjadi dasar komisi (tabel HB/LB/DL/TRONTON) dan
  pendapatan; netto sementara = harga trip - UJROUTE - komisi.
- **Nominal route** yang belum ada di spreadsheet diturunkan dari trip asli (median);
  sisanya perkiraan dan ditandai sampai diisi admin (khusus prototype).
