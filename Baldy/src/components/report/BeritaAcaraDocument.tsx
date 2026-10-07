import type { ReactNode } from 'react'
import type { TransactionRow } from '../../types'
import { cn } from '../../lib/utils'

/**
 * Berita Acara Serah Terima Barang untuk trip Karawang, mengikuti format yang
 * diminta Ibu (IMG_7978, Meeting 2). Dicetak dari sistem dengan isian yang sudah
 * diketahui; yang belum diketahui tampil sebagai titik-titik untuk ditulis tangan
 * oleh sopir dan penerima, jadi trip boleh dicetak walau baru berisi ID, rute,
 * dan kendaraan. Kop memakai identitas perusahaan sendiri, bukan logo klien.
 */
export function BeritaAcaraDocument({ note, withLogo = true }: { note: TransactionRow; withLogo?: boolean }) {
  const tgl = note.transaction_date ? new Date(`${note.transaction_date}T00:00:00`) : null
  const hari = tgl ? tgl.toLocaleDateString('id-ID', { weekday: 'long' }) : ''
  const kendaraan = note.plate_number ? ['1 unit', note.vehicle_config].filter(Boolean).join(' · ') : ''
  const idPerjalanan = note.trip_ids?.[0] ?? ''

  const baris: Array<[string, ReactNode]> = [
    ['Nomor TR/OR', note.tr_list.join(', ')],
    ['Lokasi Muat', note.muat],
    ['Lokasi Bongkar', note.bongkar],
    ['Jumlah & Jenis Kendaraan', kendaraan],
    ['Plat No', note.plate_number],
    ['Nama Driver', note.driver_names],
    ['Nama Helper', ''],
  ]

  return (
    <section
      className={cn(
        'print-sheet mx-auto flex w-[210mm] max-w-full flex-col bg-white p-[14mm] text-[11px] leading-snug text-black',
        'shadow-card border border-hairline print:border-0 print:shadow-none',
      )}
    >
      <header className={cn('flex items-start justify-between gap-6 pb-2.5', withLogo ? 'border-b-[3px] border-black' : 'border-b border-black')}>
        <div className="flex items-start gap-3">
          {withLogo && (
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-sm border-[2.5px] border-black">
              <span className="text-[17px] leading-none font-black tracking-tighter">BM</span>
            </div>
          )}
          <div>
            <p className="text-[16px] leading-tight font-bold tracking-tight">PT BIMAJAYA MUSTIKA</p>
            <p className="text-[10.5px] tracking-[.18em]">KARAWANG</p>
            {withLogo && <p className="mt-0.5 text-[9px] text-neutral-600">Heavy Equipment Transportation</p>}
          </div>
        </div>
        <dl className="grid grid-cols-[auto_auto] gap-x-2 text-right text-[9.5px] leading-relaxed">
          <dt className="text-neutral-600">No. Trip</dt>
          <dd className="font-semibold">{note.transaction_no}</dd>
          <dt className="text-neutral-600">ID Perjalanan</dt>
          <dd className="max-w-[46mm] font-semibold break-all">{idPerjalanan || '—'}</dd>
        </dl>
      </header>

      <h1 className="mt-4 text-center text-[14px] font-bold tracking-[.06em] underline underline-offset-4">BERITA ACARA SERAH TERIMA BARANG</h1>

      <p className="mt-3.5 flex flex-wrap items-end gap-x-1.5 gap-y-1">
        <span>Pada hari</span>
        <Isian className="w-[26mm]">{hari}</Isian>
        <span>tanggal</span>
        <Isian className="w-[12mm]">{tgl ? String(tgl.getDate()) : ''}</Isian>
        <span>bulan</span>
        <Isian className="w-[12mm]">{tgl ? String(tgl.getMonth() + 1).padStart(2, '0') : ''}</Isian>
        <span>tahun</span>
        <Isian className="w-[16mm]">{tgl ? String(tgl.getFullYear()) : ''}</Isian>
      </p>
      <p className="mt-2">Bahwa yang bertanda tangan di bawah ini telah melakukan serah terima barang berdasarkan:</p>

      <div className="mt-2 border border-black px-3 py-2">
        {baris.map(([label, nilai]) => (
          <div key={label} className="flex items-end gap-2 py-[3px]">
            <span className="w-[44mm] shrink-0 font-semibold">{label}</span>
            <span>:</span>
            <Isian className="flex-1">{nilai}</Isian>
          </div>
        ))}
        <div className="flex items-end gap-2 py-[3px]">
          <span className="w-[44mm] shrink-0 font-semibold">Kategori Barang</span>
          <span>:</span>
          <span className="flex gap-5"><Kotak>B3</Kotak><Kotak>Non B3</Kotak></span>
        </div>
        <div className="flex items-end gap-2 py-[3px]">
          <span className="w-[44mm] shrink-0 font-semibold">Berat & Jumlah Kolli</span>
          <span>:</span>
          <Isian className="w-[24mm]" />
          <span>Kg,</span>
          <Isian className="w-[20mm]" />
          <span>Collie(s)</span>
        </div>
        <div className="flex items-start gap-2 py-[3px]">
          <span className="w-[44mm] shrink-0 font-semibold">Mode of Transport (MOT)</span>
          <span>:</span>
          {/* Truk selalu lewat darat; sisanya dicentang tangan bila berlaku. */}
          <span className="flex flex-wrap gap-x-5 gap-y-1">
            <Kotak centang>Darat</Kotak><Kotak>Laut</Kotak><Kotak>Udara</Kotak>
            <Kotak>Multidrop</Kotak><Kotak>Combine</Kotak><Kotak>Multi Pick-up</Kotak>
          </span>
        </div>
      </div>

      <p className="mt-3 font-semibold">Pelaksanaan Pengiriman:</p>
      <div className="mt-1 space-y-1.5">
        <p className="flex items-end gap-1.5"><Kotak>Menginap di lokasi muat sejak tanggal</Kotak><Isian className="w-[28mm]" /></p>
        <p className="flex items-end gap-1.5"><Kotak>Menginap di lokasi bongkar sejak tanggal</Kotak><Isian className="w-[28mm]" /><span>s/d</span><Isian className="w-[28mm]" /></p>
        <p className="flex items-end gap-1.5"><Kotak>Relokasi / dialihkan, alasannya</Kotak><Isian className="flex-1" /></p>
        <p className="flex items-end gap-1.5"><Kotak>Dikembalikan ke gudang, alasannya</Kotak><Isian className="flex-1" /></p>
        <p className="flex items-end gap-1.5"><Kotak>Disimpan sementara sejak tanggal</Kotak><Isian className="w-[28mm]" /><span>s/d</span><Isian className="w-[28mm]" /></p>
      </div>

      <div className="mt-3 space-y-1.5 border-t border-black pt-2">
        {([
          ['Kondisi kemasan / peti / karton / kardus', 'Baik', 'Rusak'],
          ['Kondisi lashing', 'Sesuai standar', 'Tidak sesuai standar'],
          ['Jumlah & jenis barang sesuai dokumen OR / TR', 'Ya', 'Tidak'],
        ] as const).map(([label, ya, tidak]) => (
          <div key={label} className="grid grid-cols-[1fr_38mm_42mm] items-center gap-2">
            <span>{label}</span>
            <Kotak>{ya}</Kotak>
            <Kotak>{tidak}</Kotak>
          </div>
        ))}
      </div>

      <p className="mt-3 font-semibold">Packing list / keterangan lain:</p>
      <div className="mt-1 space-y-2.5">
        <Isian className="block w-full" />
        <Isian className="block w-full" />
        <Isian className="block w-full" />
      </div>

      <p className="mt-3">Demikian Berita Acara ini dibuat dengan sebenarnya untuk dipergunakan sebagaimana mestinya.</p>

      <div className="mt-3 grid grid-cols-3 gap-5">
        <TandaTangan peran="Yang Menyerahkan" baris={[['Nama', ''], ['Tanggal', '']]} />
        <TandaTangan peran="Transporter" baris={[['Nama', note.driver_names], ['Tanggal', '']]} />
        <TandaTangan peran="Penerima" baris={[['Nama', ''], ['Tgl & jam', ''], ['Perusahaan', ''], ['HP', '']]} />
      </div>

      <div className="mt-3 space-y-1.5 border-t border-black pt-2">
        <p className="flex items-end gap-1.5"><span className="shrink-0">Penerima tiba di site, tgl & jam:</span><Isian className="flex-1" /></p>
        <p className="flex items-end gap-1.5">
          <span className="shrink-0">Pengirim tiba di site, tgl & jam:</span><Isian className="flex-1" />
          <span className="shrink-0">Selesai bongkar, tgl & jam:</span><Isian className="flex-1" />
          <span className="shrink-0 font-semibold">(wajib diisi)</span>
        </p>
      </div>

      <p className="mt-3 text-center text-[9.5px] leading-relaxed font-semibold">
        Bila kolom keterangan lain dibiarkan kosong dan Berita Acara ini sudah ditandatangani penerima, barang dinyatakan
        diterima sesuai jenis, jumlah, dan kondisinya.
      </p>

      <footer className="mt-auto border-t border-neutral-400 pt-1.5 text-[8.5px] text-neutral-500">
        SIKOTIS · PT Bimajaya Mustika · Trip {note.transaction_no}{idPerjalanan && ` · ID ${idPerjalanan}`}
      </footer>
    </section>
  )
}

/** Garis isian: nilai dari sistem, atau titik-titik untuk ditulis tangan. */
function Isian({ children, className }: { children?: ReactNode; className?: string }) {
  const kosong = children === undefined || children === null || children === ''
  return (
    <span className={cn('inline-block min-h-[15px] border-b border-dotted border-neutral-700 px-1 leading-[15px]', className)}>
      {kosong ? ' ' : children}
    </span>
  )
}

function Kotak({ children, centang = false }: { children: ReactNode; centang?: boolean }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5">
      <span className="grid h-[11px] w-[11px] place-items-center border border-black text-[9px] leading-none font-bold">{centang ? '✓' : ''}</span>
      <span>{children}</span>
    </span>
  )
}

function TandaTangan({ peran, baris }: { peran: string; baris: Array<[string, ReactNode]> }) {
  return (
    <div>
      <p className="font-semibold">{peran},</p>
      <div className="h-[18mm]" />
      <div className="space-y-1">
        {baris.map(([label, nilai]) => (
          <p key={label} className="flex items-end gap-1">
            <span className="w-[17mm] shrink-0 text-[10px]">{label}</span>
            <span>:</span>
            <Isian className="min-w-0 flex-1 text-[10px]">{nilai}</Isian>
          </p>
        ))}
      </div>
    </div>
  )
}
