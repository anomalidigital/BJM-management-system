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
