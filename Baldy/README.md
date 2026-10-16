# SIKOTIS — PT Bimajaya Mustika (Blazor + Bootstrap 5)

Sistem Komisi Otomatis (**SIKOTIS**) untuk operasional *trucking* PT Bimajaya Mustika (workspace **Karawang** dan **Tanjung Priok**), dibangun dengan **Blazor WebAssembly (.NET 10)** dan **Bootstrap 5**.

- **Demo Live:** <https://anomalidigital.github.io/BJM-management-system/>
- **Solusi Utama:** [`bjm_user/`](./bjm_user/)
- **Dokumentasi & Rancangan Database:** [`docs/`](./docs/) (`DATABASE.md`, `RANCANGAN-DATABASE.md`, `DESIGN-SYSTEM.md`)

> **Catatan Data Demo:** Seluruh data pada versi demo ini berjalan mandiri di peramban (*browser*) menggunakan `localStorage` (`sikotis.db.v2`) yang dimuat awal dari `wwwroot/data/contoh.json`, bukan terhubung ke database produksi asli. Perubahan data pada demo hanya tersimpan di peramban masing-masing pengguna dan dapat diatur ulang melalui menu **Tools → Reset data ke kondisi awal**.

## Menjalankan Secara Lokal

Prasyarat: **.NET SDK 10.0**.

```bash
cd Baldy/bjm_user
dotnet run --project bjm_user/bjm_user.csproj --no-launch-profile -e ASPNETCORE_ENVIRONMENT=Development --urls http://localhost:5200
```

Buka `http://localhost:5200` di peramban.

## Merakit Demo Statis (GitHub Pages)

Dari dalam folder `Baldy/bjm_user`:

```bash
bash alat/pages/rakit.sh ./keluaran /BJM-management-system/
```

Skrip akan menerbitkan (*publish*) proyek `bjm_user.Client` dalam mode mandiri (`-p:SikotisMandiri=true`), memasang `<base href="/BJM-management-system/" />`, menyalin `404.html` sebagai *fallback* SPA, dan menambahkan `.nojekyll`.
