import type { ReactNode } from 'react'
import { Inbox, RotateCcw, SearchX, TriangleAlert } from 'lucide-react'
import { Button } from './Button'
import { cn } from '../../lib/utils'

function Shell({ icon, title, description, action }: { icon: ReactNode; title: string; description: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full border border-hairline bg-sunken text-ink-3">
        {icon}
      </div>
      <p className="text-[14px] font-semibold text-ink">{title}</p>
      <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-ink-3">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

/** Belum ada data sama sekali. */
export function EmptyState({ entity, action }: { entity: string; action?: ReactNode }) {
  return (
    <Shell
      icon={<Inbox size={20} />}
      title="Belum ada data."
      description={`Tambahkan ${entity} pertama untuk memulai.`}
      action={action}
    />
  )
}

/** Ada data, tapi filter/pencarian tidak menemukan apa pun. */
export function NotFoundState({ onReset }: { onReset?: () => void }) {
  return (
    <Shell
      icon={<SearchX size={20} />}
      title="Data tidak ditemukan."
      description="Coba periksa kembali kata kunci atau filter."
      action={
        onReset && (
          <Button size="sm" icon={<RotateCcw size={14} />} onClick={onReset}>
            Reset filter
          </Button>
        )
      }
    />
  )
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <Shell
      icon={<TriangleAlert size={20} className="text-[color:var(--color-critical)]" />}
      title="Gagal memuat data."
      description={message ?? 'Terjadi kendala saat mengambil data dari server.'}
      action={
        onRetry && (
          <Button size="sm" variant="primary" icon={<RotateCcw size={14} />} onClick={onRetry}>
            Coba lagi
          </Button>
        )
      }
    />
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} />
}

/** Skeleton berbentuk tabel, dipakai saat data awal dimuat. */
export function TableSkeleton({ rows = 8, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="px-4 py-3" aria-busy="true" aria-label="Memuat data">
      <div className="mb-3 flex gap-3 border-b border-hairline pb-3">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex gap-3">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} className="h-3.5 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export function CardSkeleton({ height = 'h-24' }: { height?: string }) {
  return <Skeleton className={cn('w-full rounded-xl', height)} />
}
