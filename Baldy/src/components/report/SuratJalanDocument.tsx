import type { DeliveryNoteRow } from '../../types'
import { formatDateLong } from '../../lib/format'
import { cn } from '../../lib/utils'

/**
 * Layout dokumen Surat Jalan ukuran A4 (bukan screenshot UI).
 * Dua varian: Dengan Logo dan Tanpa Logo.
 */
export function SuratJalanDocument({ note, withLogo = true }: { note: DeliveryNoteRow; withLogo?: boolean }) {
  const rows: Array<[string, string]> = [
    ['No. Polisi', note.plate_number || '-'],
    ['Party', note.party || '-'],
    ['SI / BL', note.sijo || '-'],
    ['Jenis Brg', note.goods_type || '-'],
    ['Kosongan', note.kosongan || '-'],
    ['Lokasi', note.location || '-'],
    ['Kapal', note.ship || '-'],
    ['Tujuan', note.destination || '-'],
  ]

  return (
    <section
      className={cn(
        'print-sheet mx-auto flex w-[210mm] max-w-full flex-col bg-white p-[16mm] text-[11.5px] text-black',
        'shadow-card border border-hairline print:border-0 print:shadow-none',
      )}
    >
      {/* Kop surat */}
      <header className={cn('flex items-start justify-between gap-8 pb-3', withLogo ? 'border-b-[3px] border-black' : 'border-b border-black')}>
        <div className="flex items-start gap-3.5">
          {withLogo && (
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-sm border-[2.5px] border-black">
              <span className="text-[19px] leading-none font-black tracking-tighter">BM</span>
            </div>
          )}
          <div>
            <p className="text-[17px] leading-tight font-bold tracking-tight">PT BIMAJAYA MUSTIKA</p>
            <p className="text-[11px] tracking-[.18em]">JAKARTA</p>
            {withLogo && <p className="mt-1 text-[9.5px] text-neutral-600">Transportation &amp; Container Trucking Services</p>}
          </div>
        </div>
        <div className="pt-1 text-right text-[10.5px]">
          <p>Jakarta, {formatDateLong(note.sj_date)}</p>
        </div>
      </header>

      {/* Judul */}
      <div className="mt-5 mb-4 text-center">
        <h1 className="inline-block border-b-2 border-black px-3 pb-0.5 text-[16px] font-bold tracking-[.12em]">SURAT JALAN</h1>
        <p className="mt-1.5 text-[11.5px] font-semibold">Nomor: {note.sj_no}</p>
      </div>

      {/* Penerima */}
      <div className="mb-4 grid grid-cols-[74px_1fr] gap-x-2 gap-y-1 text-[11.5px]">
        <span className="font-semibold">Kepada Yth</span>
        <span>: {note.recipient_name || '-'}</span>
        <span className="font-semibold">di</span>
        <span>
          : {note.recipient_address_1 || '-'}
          {note.recipient_address_2 && (
            <>
              <br />
              <span className="pl-2">{note.recipient_address_2}</span>
            </>
          )}
        </span>
      </div>

      <p className="mb-3 text-[11px] leading-relaxed">
        Dengan hormat, bersama ini kami kirimkan barang dengan keterangan sebagai berikut:
      </p>

      {/* Rincian pengiriman */}
      <table className="mb-4 w-full border-collapse text-[11px]">
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label}>
              <td className="w-[34%] border border-neutral-500 bg-neutral-100 px-2 py-[5px] font-semibold">{label}</td>
              <td className="border border-neutral-500 px-2 py-[5px]">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Container */}
      <div className="mb-5">
        <p className="mb-1.5 text-[11.5px] font-semibold">
          No. Container <span className="font-normal text-neutral-600">({note.containers.length} container)</span>
        </p>
        {note.containers.length === 0 ? (
          <p className="border border-neutral-500 px-2 py-3 text-center text-[10.5px] text-neutral-500">
            Tidak ada nomor container.
          </p>
        ) : (
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr className="bg-neutral-100">
                <th className="w-12 border border-neutral-500 px-2 py-[5px] text-left font-semibold">No.</th>
                <th className="border border-neutral-500 px-2 py-[5px] text-left font-semibold">Nomor Container</th>
              </tr>
            </thead>
            <tbody>
              {note.containers.map((c, i) => (
                <tr key={`${c}-${i}`}>
                  <td className="border border-neutral-500 px-2 py-[5px]">{i + 1}.</td>
                  <td className="border border-neutral-500 px-2 py-[5px] font-medium tracking-wide">{c}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="mb-6 text-[11px] leading-relaxed">
        Mohon barang tersebut di atas diterima dalam keadaan baik dan lengkap. Atas perhatian dan kerja samanya kami
        ucapkan terima kasih.
      </p>

      {/* Tanda tangan */}
      <div className="mt-auto grid grid-cols-3 gap-6 pt-4 text-center text-[11px]">
        {['Penerima', 'Sopir', 'Hormat kami,'].map((role) => (
          <div key={role}>
            <p className="mb-14">{role}</p>
            <p className="mx-auto w-4/5 border-t border-black pt-1 text-[10.5px]">
              {role === 'Sopir' ? '( ................................ )' : '( ................................ )'}
            </p>
          </div>
        ))}
      </div>

      <footer className="mt-5 border-t border-neutral-400 pt-1.5 text-[8.5px] text-neutral-500">
        SIKOTIS — Sistem Komisi Otomatis · PT Bimajaya Mustika · Surat Jalan {note.sj_no}
      </footer>
    </section>
  )
}
