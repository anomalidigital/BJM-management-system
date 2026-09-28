import { useEffect, useRef, useState } from 'react'
import { FaChevronLeft, FaChevronRight, FaCircleNotch, FaFileLines, FaImage, FaXmark } from './icons'
import { TIPE_DITERIMA, simpanLampiran, urlLampiran } from '../../lib/lampiran'
import type { Berkas } from '../../lib/lampiran'
import { cn } from '../../lib/utils'

/** Muat satu lampiran dari IndexedDB. */
function useLampiran(id: string) {
  const [data, setData] = useState<{ url: string; berkas: Berkas } | null | undefined>(undefined)
  useEffect(() => {
    let batal = false
    urlLampiran(id).then((d) => { if (!batal) setData(d) }).catch(() => { if (!batal) setData(null) })
    return () => { batal = true }
  }, [id])
  return data
}

function Ubin({ id, ukuran, onBuka, onHapus }: {
  id: string
  ukuran: number
  onBuka?: () => void
  onHapus?: () => void
}) {
  const data = useLampiran(id)
  const gambar = data?.berkas.type.startsWith('image/')
  return (
    <div className="group relative shrink-0" style={{ width: ukuran, height: ukuran }}>
      <button
        type="button"
        onClick={onBuka}
        title={data?.berkas.name}
        className="grid h-full w-full place-items-center overflow-hidden rounded-md border border-hairline bg-sunken transition hover:border-brand-300"
      >
        {data === undefined ? (
          <FaCircleNotch size={14} className="animate-spin text-ink-3" />
        ) : data === null ? (
          <span className="px-1 text-center text-[10px] text-ink-3">hilang</span>
        ) : gambar ? (
          <img src={data.url} alt={data.berkas.name} className="h-full w-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-0.5 px-1 text-ink-3">
            <FaFileLines size={ukuran > 48 ? 18 : 14} />
            <span className="max-w-full truncate text-[9.5px]">{data.berkas.name}</span>
          </span>
        )}
      </button>
      {onHapus && (
        <button
          type="button"
          onClick={onHapus}
          aria-label="Hapus lampiran"
          className="absolute -top-1.5 -right-1.5 grid h-5 w-5 place-items-center rounded-full border border-hairline bg-surface text-ink-3 shadow-card transition hover:text-[color:var(--color-critical)]"
        >
          <FaXmark size={11} />
        </button>
      )}
    </div>
  )
}

/** Tampilan penuh satu lampiran, bisa digeser ke lampiran lain. */
function Penampil({ ids, awal, onTutup }: { ids: string[]; awal: number; onTutup: () => void }) {
  const [i, setI] = useState(awal)
  const data = useLampiran(ids[i])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onTutup()
      if (e.key === 'ArrowRight') setI((v) => Math.min(ids.length - 1, v + 1))
      if (e.key === 'ArrowLeft') setI((v) => Math.max(0, v - 1))
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [ids.length, onTutup])

  return (
    <div className="animate-in-fade fixed inset-0 z-[70] flex flex-col bg-black/85" onClick={onTutup}>
      <div className="flex items-center justify-between px-5 py-3 text-white" onClick={(e) => e.stopPropagation()}>
        <p className="truncate text-[13px]">{data?.berkas.name ?? 'Memuat...'} <span className="text-white/50">· {i + 1} / {ids.length}</span></p>
        <button type="button" onClick={onTutup} aria-label="Tutup" className="rounded-md p-1.5 hover:bg-white/10"><FaXmark size={18} /></button>
      </div>
      <div className="relative flex flex-1 items-center justify-center px-14 pb-8" onClick={(e) => e.stopPropagation()}>
        {i > 0 && (
          <button type="button" onClick={() => setI(i - 1)} aria-label="Sebelumnya" className="absolute left-3 rounded-full bg-white/10 p-2 text-white hover:bg-white/20">
            <FaChevronLeft size={20} />
          </button>
        )}
        {data?.berkas.type.startsWith('image/') ? (
          <img src={data.url} alt={data.berkas.name} className="max-h-full max-w-full rounded-md object-contain" />
        ) : data ? (
          <a
            href={data.url}
            target="_blank"
            rel="noreferrer"
            download={data.berkas.type === 'application/pdf' ? undefined : data.berkas.name}
            className="rounded-lg bg-white px-5 py-4 text-[13px] font-medium text-ink"
          >
            {data.berkas.type === 'application/pdf' ? 'Buka' : 'Unduh'} {data.berkas.name}
          </a>
        ) : (
          <FaCircleNotch size={22} className="animate-spin text-white/70" />
        )}
        {i < ids.length - 1 && (
          <button type="button" onClick={() => setI(i + 1)} aria-label="Berikutnya" className="absolute right-3 rounded-full bg-white/10 p-2 text-white hover:bg-white/20">
            <FaChevronRight size={20} />
          </button>
        )}
      </div>
    </div>
  )
}

/** Deretan thumbnail yang bisa diklik untuk dilihat penuh. */
export function LampiranThumbs({ ids, ukuran = 36, className }: { ids: string[]; ukuran?: number; className?: string }) {
  const [buka, setBuka] = useState<number | null>(null)
  if (!ids || ids.length === 0) return <span className="text-ink-3">—</span>
  return (
    <>
      <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
        {ids.map((id, i) => <Ubin key={id} id={id} ukuran={ukuran} onBuka={() => setBuka(i)} />)}
      </div>
      {buka !== null && <Penampil ids={ids} awal={buka} onTutup={() => setBuka(null)} />}
    </>
  )
}

/**
 * Isian lampiran untuk form. Berkas langsung tersimpan ke IndexedDB saat
 * dipilih; yang dikirim ke form hanya daftar id-nya.
 *
 * Melepas lampiran hanya mengeluarkannya dari daftar - berkasnya belum
 * dihapus, supaya tombol Batal pada form tetap mengembalikan keadaan semula.
 * Berkas yang akhirnya tidak dipakai dibersihkan saat aplikasi dimuat.
 */
export function LampiranInput({
  value,
  onChange,
  id,
  accept = TIPE_DITERIMA,
  label = 'Tambah gambar',
}: {
  value: string[]
  onChange: (ids: string[]) => void
  id?: string
  /** Kosongkan ('') untuk menerima berkas apa saja. */
  accept?: string
  label?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [mengunggah, setMengunggah] = useState(false)
  const [buka, setBuka] = useState<number | null>(null)
  const [galat, setGalat] = useState('')

  async function pilih(files: FileList | null) {
    if (!files || files.length === 0) return
    setMengunggah(true); setGalat('')
    try {
      const baru: string[] = []
      for (const f of Array.from(files)) baru.push(await simpanLampiran(f))
      onChange([...value, ...baru])
    } catch {
      setGalat('Berkas gagal disimpan. Coba pilih ulang.')
    } finally {
      setMengunggah(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function hapus(target: string) {
    onChange(value.filter((v) => v !== target))
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {value.map((v, i) => <Ubin key={v} id={v} ukuran={64} onBuka={() => setBuka(i)} onHapus={() => hapus(v)} />)}
        <button
          id={id}
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={mengunggah}
          className="flex h-16 min-w-16 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-hairline px-3 text-[11px] font-medium text-ink-3 transition hover:border-brand-300 hover:text-brand-600 disabled:opacity-60"
        >
          {mengunggah ? <FaCircleNotch size={16} className="animate-spin" /> : <FaImage size={16} />}
          {mengunggah ? 'Menyimpan...' : label}
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept || undefined}
        multiple
        className="hidden"
        onChange={(e) => pilih(e.target.files)}
      />
      {galat && <p className="mt-1 text-[12px] font-medium text-[color:var(--color-critical)]">{galat}</p>}
      {buka !== null && <Penampil ids={value} awal={buka} onTutup={() => setBuka(null)} />}
    </div>
  )
}
