import type { ReactNode } from 'react'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { cn } from '../../lib/utils'

interface Props {
  label: string
  value: ReactNode
  icon?: ReactNode
  /** Perubahan dalam persen terhadap periode pembanding. */
  delta?: number | null
  deltaLabel?: string
  /** Untuk metrik yang "naik = buruk". */
  invertDelta?: boolean
  hint?: ReactNode
}

export function StatCard({ label, value, icon, delta, deltaLabel = 'vs bulan lalu', invertDelta, hint }: Props) {
  const hasDelta = delta !== null && delta !== undefined && Number.isFinite(delta)
  const up = hasDelta && delta! > 0
  const flat = hasDelta && Math.abs(delta!) < 0.05
  const good = invertDelta ? !up : up
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight

  return (
    <div className="shadow-card rounded-xl border border-hairline bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[12.5px] font-medium text-ink-3">{label}</p>
        {icon && <span className="shrink-0 rounded-md bg-brand-50 p-1.5 text-brand-600">{icon}</span>}
      </div>
      <p className="mt-2 text-[24px] leading-none font-semibold tracking-tight text-ink">{value}</p>
      {hasDelta ? (
        <p className="mt-2.5 flex items-center gap-1 text-[12px]">
          <Icon
            size={13}
            className={cn(flat ? 'text-ink-3' : good ? 'text-[color:var(--color-good)]' : 'text-[color:var(--color-critical)]')}
          />
          <span className={cn('tnum font-semibold', flat ? 'text-ink-3' : good ? 'text-[#006300]' : 'text-[color:var(--color-critical)]')}>
            {flat ? '0%' : `${up ? '+' : ''}${delta!.toFixed(1).replace('.', ',')}%`}
          </span>
          <span className="text-ink-3">{deltaLabel}</span>
        </p>
      ) : (
        hint && <p className="mt-2.5 text-[12px] text-ink-3">{hint}</p>
      )}
    </div>
  )
}
