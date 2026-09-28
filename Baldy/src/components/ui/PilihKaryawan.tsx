import { useState } from 'react'
import { UserPlus } from 'lucide-react'
import { SearchableSelect } from './SearchableSelect'
import { Input } from './Field'
import { Button } from './Button'
import { useData } from '../../store/DataProvider'
import { useAuth } from '../../store/AuthProvider'
import { useToast } from '../../store/ToastProvider'
import { kodeKaryawanBerikut } from '../../lib/kode'
import { ROLE_LABEL } from '../../types'
import type { Driver, EmployeeRole } from '../../types'

const MANUAL = '__manual__'

/**
 * Pilih karyawan terdaftar, atau ketik nama sendiri bila orangnya belum
 * terdaftar. Nama ketikan bisa langsung disimpan sebagai karyawan baru supaya
 * "Pak Budi", "Budi", dan "BUDI" tidak tercatat sebagai tiga orang berbeda.
 * Nilai yang dikirim: id karyawan (kosong bila manual) dan nama.
 */
export function PilihKaryawan({
  id,
  karyawan,
  valueId,
  valueNama,
  onChange,
  peran,
  placeholder = 'Pilih karyawan...',
}: {
  id?: string
  karyawan: Driver[]
  valueId: string
  valueNama: string
  onChange: (id: string, nama: string) => void
  /** Peran untuk karyawan baru yang disimpan dari nama ketikan. */
  peran: EmployeeRole
  placeholder?: string
}) {
  const { dbAll, create } = useData()
  const { canEdit } = useAuth()
  const toast = useToast()
  const [manual, setManual] = useState(!valueId && !!valueNama)

  const options = [
    ...karyawan.map((k) => ({ value: k.id, label: k.driver_name, meta: k.driver_code, keywords: k.city })),
    { value: MANUAL, label: 'Isi nama sendiri', meta: 'belum terdaftar di Data Karyawan' },
  ]

  function pilih(v: string | null) {
    if (v === MANUAL) { setManual(true); onChange('', valueId ? '' : valueNama); return }
    setManual(false)
    const k = karyawan.find((x) => x.id === v)
    onChange(k?.id ?? '', k?.driver_name ?? '')
  }

  const nama = valueNama.trim()
  /** Nama yang sama persis dengan karyawan terdaftar cukup dipilih, tidak dibuat ulang. */
  const kembar = nama ? dbAll.drivers.find((d) => d.driver_name.trim().toLowerCase() === nama.toLowerCase()) : undefined

  function simpanBaru() {
    if (!nama) return
    if (kembar) {
      setManual(false)
      onChange(kembar.id, kembar.driver_name)
      toast.info(`${kembar.driver_name} sudah terdaftar (${kembar.driver_code}), langsung dipilih.`)
      return
    }
    const baru = create('drivers', {
      driver_code: kodeKaryawanBerikut(dbAll.drivers, peran),
      driver_name: nama,
      role: peran,
      address_1: '', address_2: '', city: '', phone: '',
      status: 'aktif',
      attachments: [],
    })
    setManual(false)
    onChange(baru.id, baru.driver_name)
    toast.success(`${baru.driver_name} disimpan sebagai ${ROLE_LABEL[peran].toLowerCase()} baru (${baru.driver_code}).`)
  }

  return (
    <div className="space-y-2">
      <SearchableSelect
        id={id}
        options={options}
        value={manual ? MANUAL : valueId || null}
        placeholder={placeholder}
        onChange={pilih}
      />
      {manual && (
        <div className="flex gap-2">
          <Input value={valueNama} placeholder="Ketik nama" autoFocus onChange={(e) => onChange('', e.target.value)} />
          <Button
            icon={<UserPlus size={14} />}
            disabled={!canEdit || !nama}
            title={kembar ? 'Nama ini sudah terdaftar' : `Simpan ke Data Karyawan sebagai ${ROLE_LABEL[peran]}`}
            onClick={simpanBaru}
          >
            {kembar ? 'Pilih yang terdaftar' : 'Simpan sebagai karyawan'}
          </Button>
        </div>
      )}
    </div>
  )
}
