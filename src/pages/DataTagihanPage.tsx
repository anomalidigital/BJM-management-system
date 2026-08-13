import { useState } from 'react'
import { PageHeader } from '../components/layout/PageHeader'
import { DataContohNotice } from '../components/ui/DataNotice'
import { Card } from '../components/ui/Card'
import { Tabs } from '../components/ui/Tabs'
import { useData } from '../store/DataProvider'
import { ProsesDataTab } from './tagihan/ProsesDataTab'
import { BrowsingDataTab } from './tagihan/BrowsingDataTab'
import { PencarianDataTab } from './tagihan/PencarianDataTab'

/** Transaksi -> Data Tagihan. Tiga tab sesuai dokumen bagian 7. */
export function DataTagihanPage() {
  const { db } = useData()
  const [tab, setTab] = useState('proses')

  return (
    <>
      <PageHeader
        title="Data Tagihan"
        crumbs={[{ label: 'Transaksi' }, { label: 'Data Tagihan' }]}
      />

      <DataContohNotice modul="tagihan" />

      <Card>
        <Tabs
          value={tab}
          onChange={setTab}
          className="px-2"
          items={[
            { id: 'proses', label: 'Proses Data' },
            { id: 'browsing', label: 'Browsing Data', badge: db.billings.length },
            { id: 'pencarian', label: 'Pencarian Data' },
          ]}
        />
        {tab === 'proses' && <ProsesDataTab />}
        {tab === 'browsing' && <BrowsingDataTab />}
        {tab === 'pencarian' && <PencarianDataTab />}
      </Card>
    </>
  )
}
