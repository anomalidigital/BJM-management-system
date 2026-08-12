import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

export interface PrintCol {
  label: string
  align?: 'left' | 'right' | 'center'
  width?: string
}

const ALIGN = { left: 'text-left', right: 'text-right', center: 'text-center' } as const

/** Tabel bergaris untuk dokumen cetak (A4). */
export function PrintTable({ cols, children }: { cols: PrintCol[]; children: ReactNode }) {
  return (
    <table className="w-full border-collapse text-[10px]">
      <thead>
        <tr className="bg-neutral-100">
          {cols.map((c) => (
            <th
              key={c.label}
              style={c.width ? { width: c.width } : undefined}
              className={cn('border border-neutral-400 px-1.5 py-1 font-semibold', ALIGN[c.align ?? 'left'])}
            >
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  )
}

export function PRow({ children, tone }: { children: ReactNode; tone?: 'total' | 'group' }) {
  return (
    <tr className={cn(tone === 'total' && 'bg-neutral-100 font-bold', tone === 'group' && 'bg-neutral-50 font-semibold')}>
      {children}
    </tr>
  )
}

export function PCell({
  children,
  align = 'left',
  colSpan,
  bold,
}: {
  children?: ReactNode
  align?: 'left' | 'right' | 'center'
  colSpan?: number
  bold?: boolean
}) {
  return (
    <td colSpan={colSpan} className={cn('border border-neutral-400 px-1.5 py-1', ALIGN[align], bold && 'font-semibold')}>
      {children}
    </td>
  )
}
