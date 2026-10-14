import { cn } from '../../lib/utils'
import { formatRupiah } from '../../lib/format'

/** Teks nominal bertanda dari sisi karyawan: "−Rp 100.000" / "+Rp 50.000" / "Rp 0". */
export const teksPiutang = (n: number) => (n < 0 ? `−${formatRupiah(-n)}` : n > 0 ? `+${formatRupiah(n)}` : formatRupiah(0))

/**
 * Nominal piutang karyawan dari sisi karyawan (revisi 13 Okt 2026): minus merah = masih punya
 * piutang / piutang bertambah, plus hijau = pelunasan, nol abu-abu.
 */
export function NilaiPiutang({ nilai, tebal, className }: { nilai: number; tebal?: boolean; className?: string }) {
  return (
    <span className={cn(
      'tnum whitespace-nowrap',
      tebal && 'font-semibold',
      nilai < 0 ? 'text-[color:var(--color-critical)]' : nilai > 0 ? 'text-[#0a7d0a]' : 'text-ink-3',
      className,
    )}>
      {teksPiutang(nilai)}
    </span>
  )
}
