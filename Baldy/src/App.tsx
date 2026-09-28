import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom'
import { AuthProvider } from './store/AuthProvider'
import { WorkspaceProvider } from './store/WorkspaceProvider'
import { DataProvider } from './store/DataProvider'
import { ToastProvider } from './store/ToastProvider'
import { AppShell } from './components/layout/AppShell'

import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { DataKaryawanPage } from './pages/DataKaryawanPage'
import { KaryawanTransaksiPage } from './pages/KaryawanTransaksiPage'
import { DataRoutePage } from './pages/DataRoutePage'
import { DataMobilPage } from './pages/DataMobilPage'
import { KlienPage } from './pages/KlienPage'
import { KlienDetailPage } from './pages/KlienDetailPage'
import { KomisiPage } from './pages/KomisiPage'
import { TripDetailPage } from './pages/TripDetailPage'
import { LapUangJalanPage } from './pages/LapUangJalanPage'
import { LapBiayaPage } from './pages/LapBiayaPage'
import { TripListPage } from './pages/TripListPage'
import { TripFormPage } from './pages/TripFormPage'
import { DataTagihanPage } from './pages/DataTagihanPage'
import { SijoSearchPage } from './pages/SijoSearchPage'
import { LapKomisiPage } from './pages/LapKomisiPage'
import { LapNettoPage } from './pages/LapNettoPage'
import { LapRitanPage } from './pages/LapRitanPage'
import { ToolsPage } from './pages/ToolsPage'
import { NotFoundPage } from './pages/NotFoundPage'

/** Tautan lama Surat Jalan -> trip hasil penggabungannya (id-nya dipertahankan). */
function AlihkanSuratJalan({ edit = false }: { edit?: boolean }) {
  const { id } = useParams()
  return <Navigate to={`/transaksi/trip/${id}${edit ? '/edit' : ''}`} replace />
}

export function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AuthProvider>
        <WorkspaceProvider>
          <DataProvider>
            <ToastProvider>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route element={<AppShell />}>
                  <Route index element={<Navigate to="/dashboard" replace />} />
                  <Route path="/dashboard" element={<DashboardPage />} />

                  <Route path="/master/karyawan" element={<DataKaryawanPage />} />
                  <Route path="/master/karyawan/:id" element={<KaryawanTransaksiPage />} />
                  <Route path="/master/sopir" element={<Navigate to="/master/karyawan" replace />} />
                  <Route path="/master/mobil" element={<DataMobilPage />} />
                  <Route path="/master/route" element={<DataRoutePage />} />
                  <Route path="/master/klien" element={<KlienPage />} />
                  <Route path="/master/klien/:id" element={<KlienDetailPage />} />
                  {/* Alamat lama: Data Project kini Klien, dan kontrak dikelola di halaman klien */}
                  <Route path="/master/project" element={<Navigate to="/master/klien" replace />} />
                  <Route path="/master/kontrak" element={<Navigate to="/master/klien" replace />} />
                  <Route path="/master/komisi" element={<KomisiPage />} />

                  <Route path="/transaksi/trip" element={<TripListPage />} />
                  <Route path="/transaksi/trip/tambah" element={<TripFormPage mode="create" />} />
                  <Route path="/transaksi/trip/:id" element={<TripDetailPage />} />
                  <Route path="/transaksi/trip/:id/edit" element={<TripFormPage mode="edit" />} />
                  {/* Alamat lama: Surat Jalan dan Data Pengeluaran kini menjadi Trip */}
                  <Route path="/transaksi/surat-jalan" element={<Navigate to="/transaksi/trip" replace />} />
                  <Route path="/transaksi/surat-jalan/tambah" element={<Navigate to="/transaksi/trip/tambah" replace />} />
                  <Route path="/transaksi/surat-jalan/:id" element={<AlihkanSuratJalan />} />
                  <Route path="/transaksi/surat-jalan/:id/edit" element={<AlihkanSuratJalan edit />} />
                  <Route path="/transaksi/komisi" element={<Navigate to="/transaksi/trip" replace />} />
                  <Route path="/transaksi/tagihan" element={<DataTagihanPage />} />

                  <Route path="/laporan/komisi" element={<LapKomisiPage />} />
                  <Route path="/laporan/netto" element={<LapNettoPage />} />
                  <Route path="/laporan/ritan" element={<LapRitanPage />} />
                  <Route path="/laporan/uang-jalan" element={<LapUangJalanPage />} />
                  <Route path="/laporan/biaya" element={<LapBiayaPage />} />

                  <Route path="/pencarian/sijo" element={<SijoSearchPage />} />
                  <Route path="/tools" element={<ToolsPage />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Route>
              </Routes>
            </ToastProvider>
          </DataProvider>
        </WorkspaceProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
