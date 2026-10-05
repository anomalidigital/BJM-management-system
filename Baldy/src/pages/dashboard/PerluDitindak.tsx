import { Link } from 'react-router-dom'
import { FaChevronRight } from '../../components/ui/icons'
import { cn } from '../../lib/utils'
import { formatNumber } from '../../lib/format'
import { Panel } from './Panel'

export interface ItemTindak {
  id: string
  label: string
  keterangan?: string
  jumlah: number
  to: string
  /** masalah = merah, perhatian = kuning sinyal, info = abu baja. */
  nada: 'masalah' | 'perhatian' | 'info'
}

const PENANDA: Record<ItemTindak['nada'], string> = {
  masalah: 'bg-[color:var(--color-critical)]',
  perhatian: 'bg-signal',
  info: 'bg-[#c5cfdc]',
}

/** Antrian tindakan: jawaban pertama atas pertanyaan admin, "apa yang harus dikerjakan sekarang?" */
export function PerluDitindak({ items }: { items: ItemTindak[] }) {
  return (
    <Panel title="Perlu ditindak" subtitle={items.length > 0 ? 'Tekan salah satu untuk membuka datanya.' : undefined}>
      {items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 pb-8 text-center">
          <p className="font-rail text-[17px] font-semibold text-ink">Semua beres</p>
          <p className="mt-1 text-[12.5px] text-ink-3">Tidak ada trip, Surat Jalan, atau tagihan yang tertahan.</p>
        </div>
      ) : (
        <ul className="px-2 pb-2">
          {items.map((a) => (
            <li key={a.id}>
              <Link to={a.to} className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-sunken">
                <span className={cn('h-9 w-1 shrink-0 rounded-full', PENANDA[a.nada])} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] leading-snug text-ink">{a.label}</span>
                  {a.keterangan && <span className="mt-0.5 block text-[12px] leading-snug text-ink-3">{a.keterangan}</span>}
                </span>
                <span className="tnum font-rail text-[24px] leading-none font-semibold text-ink">{formatNumber(a.jumlah)}</span>
                <FaChevronRight size={12} className="shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
