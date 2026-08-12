import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './store/AuthProvider'
import { DataProvider } from './store/DataProvider'
import { ToastProvider } from './store/ToastProvider'
import { AppShell } from './components/layout/AppShell'

import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { DataSopirPage } from './pages/DataSopirPage'
import { DataRoutePage } from './pages/DataRoutePage'
import { SuratJalanListPage } from './pages/SuratJalanListPage'
import { SuratJalanFormPage } from './pages/SuratJalanFormPage'
import { SuratJalanDetailPage } from './pages/SuratJalanDetailPage'
import { DataKomisiPage } from './pages/DataKomisiPage'
import { DataTagihanPage } from './pages/DataTagihanPage'
import { SijoSearchPage } from './pages/SijoSearchPage'
import { LapKomisiPage } from './pages/LapKomisiPage'
import { LapNettoPage } from './pages/LapNettoPage'
import { LapRitanPage } from './pages/LapRitanPage'
import { ToolsPage } from './pages/ToolsPage'
import { NotFoundPage } from './pages/NotFoundPage'

export function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AuthProvider>
        <DataProvider>
          <ToastProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route element={<AppShell />}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<DashboardPage />} />

                <Route path="/master/sopir" element={<DataSopirPage />} />
                <Route path="/master/route" element={<DataRoutePage />} />

                <Route path="/transaksi/surat-jalan" element={<SuratJalanListPage />} />
                <Route path="/transaksi/surat-jalan/tambah" element={<SuratJalanFormPage mode="create" />} />
                <Route path="/transaksi/surat-jalan/:id" element={<SuratJalanDetailPage />} />
                <Route path="/transaksi/surat-jalan/:id/edit" element={<SuratJalanFormPage mode="edit" />} />
                <Route path="/transaksi/komisi" element={<DataKomisiPage />} />
                <Route path="/transaksi/tagihan" element={<DataTagihanPage />} />

                <Route path="/laporan/komisi" element={<LapKomisiPage />} />
                <Route path="/laporan/netto" element={<LapNettoPage />} />
                <Route path="/laporan/ritan" element={<LapRitanPage />} />

                <Route path="/pencarian/sijo" element={<SijoSearchPage />} />
                <Route path="/tools" element={<ToolsPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Routes>
          </ToastProvider>
        </DataProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
