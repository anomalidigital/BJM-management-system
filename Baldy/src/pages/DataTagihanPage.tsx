import { useState } from 'react'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { Tabs } from '../components/ui/Tabs'
import { useData } from '../store/DataProvider'
import { ProsesDataTab } from './tagihan/ProsesDataTab'
import { BrowsingDataTab } from './tagihan/BrowsingDataTab'
import { PencarianDataTab } from './tagihan/PencarianDataTab'
import { TagihanPiPage } from './tagihan/TagihanPiPage'
import { useWorkspace } from '../store/WorkspaceProvider'

/** Laporan -> Tagihan. Karawang menagih per trip lewat PI; Priok per SI/JO seperti sistem lama. */
export function DataTagihanPage() {
  const { workspace } = useWorkspace()
  return workspace === 'karawang' ? <TagihanPiPage /> : <TagihanSijo />
}

function TagihanSijo() {
  const { db } = useData()
  const [tab, setTab] = useState('proses')

  return (
    <>
      <PageHeader
        title="Tagihan"
        crumbs={[{ label: 'Laporan' }, { label: 'Tagihan' }]}
      />

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
