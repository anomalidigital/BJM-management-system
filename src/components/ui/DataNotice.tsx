import { Info } from 'lucide-react'
import { cn } from '../../lib/utils'

/**
 * Penanda sumber data. REKAPAN SHAZA hanya memuat trip, uang jalan, dan biaya —
 * modul SI/Job Order, Tagihan, dan Surat Jalan belum punya data asli, jadi
 * ditandai agar tidak disalahartikan saat demo.
 */
export function DataContohNotice({ modul, className }: { modul: string; className?: string }) {
  return (
    <div
      className={cn(
        'no-print mb-4 flex items-start gap-2.5 rounded-lg border border-[#f6e2ac] bg-[#fff8e6] px-3.5 py-2.5',
        className,
      )}
    >
      <Info size={15} className="mt-px shrink-0 text-[#8a6100]" />
      <p className="text-[12.5px] leading-relaxed text-[#8a6100]">
        <span className="font-semibold">Data contoh.</span> File operasional REKAPAN SHAZA tidak memuat data{' '}
        {modul}, sehingga halaman ini masih memakai data buatan. Modul Trip, Uang Jalan, dan Biaya Operasional
        sudah memakai data sebenarnya.
      </p>
    </div>
  )
}
