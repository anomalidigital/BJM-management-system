import { useRef, useState } from 'react'

/**
 * Kendali satu panel filter (revisi Baldy 14 Okt 2026): isian di panel adalah draf, dan baru
 * berlaku setelah tombol Terapkan diklik, supaya tabel tidak berganti-ganti selagi filter diatur.
 */
export interface KendaliFilter<T> {
  /** Filter yang sedang berlaku (dipakai menyaring tabel). */
  nilai: T
  /** Isian panel yang belum diterapkan. */
  draf: T
  /** Ubah isian panel. */
  ubah: (patch: Partial<T>) => void
  /** Panel dibuka: isian panel mulai dari filter yang berlaku. */
  mulai: () => void
  /** Terapkan isian panel. */
  terapkan: () => void
  /** Kosongkan isian panel ke nilai awal (belum diterapkan). */
  kosongkan: () => void
  /** Pasang filter langsung tanpa panel, mis. klik kode area di kotak peringatan. */
  atur: (patch: Partial<T>) => void
  /** Lepas satu atau beberapa filter yang berlaku, langsung (tanda × pada chip). */
  lepas: (...kunci: Array<keyof T>) => void
  /** Lepas semua filter yang berlaku, langsung. */
  lepasSemua: () => void
  /** Isian panel berbeda dari filter yang berlaku. */
  belumDiterapkan: boolean
  /** Isian panel berbeda dari nilai awal (ada yang bisa dikosongkan). */
  drafTerisi: boolean
}

const sama = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/**
 * Filter berdraf. `awal` = nilai kosong / bawaan tiap filter. Tanpa `kendali`, filter yang berlaku
 * disimpan di sini; dengan `kendali`, nilainya dibaca & ditulis di luar (mis. alamat halaman).
 */
export function useFilter<T extends object>(awal: T, kendali?: { nilai: T; terapkan: (v: T) => void }): KendaliFilter<T> {
  const awalRef = useRef(awal)
  awalRef.current = awal
  const [lokal, setLokal] = useState<T>(awal)
  const nilai = kendali?.nilai ?? lokal
  const tulis = kendali?.terapkan ?? setLokal
  const [draf, setDraf] = useState<T>(nilai)

  return {
    nilai,
    draf,
    ubah: (patch) => setDraf((d) => ({ ...d, ...patch })),
    mulai: () => setDraf(nilai),
    terapkan: () => tulis(draf),
    kosongkan: () => setDraf(awalRef.current),
    atur: (patch) => {
      const baru = { ...nilai, ...patch }
      tulis(baru)
      setDraf(baru)
    },
    lepas: (...kunci) => {
      const baru = { ...nilai }
      for (const k of kunci) baru[k] = awalRef.current[k]
      tulis(baru)
      setDraf(baru)
    },
    lepasSemua: () => { tulis(awalRef.current); setDraf(awalRef.current) },
    belumDiterapkan: !sama(draf, nilai),
    drafTerisi: !sama(draf, awalRef.current),
  }
}
