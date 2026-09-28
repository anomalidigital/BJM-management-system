import { cn } from '../../lib/utils'

/**
 * Kode depo workspace (JKT, TNG) dalam kotak berstensil, meniru kotak kode
 * yang dicat di badan kontainer. Dipakai di rel navigasi dan menu akun
 * supaya cabang yang aktif selalu terbaca dengan cara yang sama.
 */
export function KodeDepot({ kode, warna, className }: {
  kode: string
  /** Isi kotak dengan warna baja workspace (untuk daftar pilihan workspace). */
  warna?: string
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex h-[17px] shrink-0 items-center border px-[5px] font-stencil text-[11.5px] leading-none font-extrabold tracking-[.08em]',
        warna ? 'border-transparent text-white' : 'border-current',
        className,
      )}
      style={warna ? { background: warna } : undefined}
    >
      {kode}
    </span>
  )
}
