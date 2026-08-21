import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronsUpDown, Search, X } from 'lucide-react'
import { cn, matchesQuery } from '../../lib/utils'

export interface Option {
  value: string
  label: string
  /** Baris kedua kecil di bawah label (mis. nama route / kota sopir). */
  meta?: string
  /** Teks tambahan yang ikut dicari tapi tidak ditampilkan. */
  keywords?: string
}

interface Props {
  options: Option[]
  value: string | null
  onChange: (value: string | null) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  disabled?: boolean
  invalid?: boolean
  clearable?: boolean
  id?: string
}

/** Dropdown dengan autocomplete — dipakai untuk daftar Sopir / Route / SI-JO. */
export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Pilih...',
  searchPlaceholder = 'Ketik untuk mencari...',
  emptyText = 'Tidak ada pilihan yang cocok.',
  disabled,
  invalid,
  clearable = true,
  id,
}: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = options.find((o) => o.value === value) ?? null
  const filtered = useMemo(
    () => options.filter((o) => matchesQuery(query, o.label, o.meta, o.keywords, o.value)),
    [options, query],
  )

  useEffect(() => {
    if (!open) return
    const onDocDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocDown)
    return () => document.removeEventListener('mousedown', onDocDown)
  }, [open])

  useEffect(() => {
    if (open) {
      setQuery('')
      setActive(0)
      window.setTimeout(() => inputRef.current?.focus(), 10)
    }
  }, [open])

  function commit(v: string) {
    onChange(v)
    setOpen(false)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[active]) commit(filtered[active].value)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex h-9 w-full items-center gap-2 rounded-md border bg-surface px-2.5 text-left text-[13px] transition-colors',
          'focus:border-brand-400 focus:ring-2 focus:ring-brand-500/15 focus:outline-none',
          'disabled:cursor-not-allowed disabled:bg-sunken disabled:text-ink-3',
          invalid ? 'border-[color:var(--color-critical)]' : 'border-hairline',
          open && 'border-brand-400 ring-2 ring-brand-500/15',
        )}
      >
        <span className={cn('flex-1 truncate', selected ? 'text-ink' : 'text-ink-3/80')}>
          {selected ? selected.label : placeholder}
        </span>
        {clearable && selected && !disabled && (
          <span
            role="button"
            tabIndex={-1}
            aria-label="Kosongkan pilihan"
            onClick={(e) => {
              e.stopPropagation()
              onChange(null)
            }}
            className="rounded p-0.5 text-ink-3 hover:bg-black/5 hover:text-ink"
          >
            <X size={13} />
          </span>
        )}
        <ChevronsUpDown size={14} className="shrink-0 text-ink-3" />
      </button>

      {open && (
        <div className="animate-in-pop absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-hairline bg-surface shadow-pop">
          <div className="flex items-center gap-2 border-b border-hairline px-2.5 py-2">
            <Search size={14} className="shrink-0 text-ink-3" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setActive(0)
              }}
              onKeyDown={onKeyDown}
              placeholder={searchPlaceholder}
              className="w-full bg-transparent text-[13px] text-ink placeholder:text-ink-3/70 focus:outline-none"
            />
          </div>
          <ul role="listbox" className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 && <li className="px-3 py-6 text-center text-[12px] text-ink-3">{emptyText}</li>}
            {filtered.map((o, i) => (
              <li key={o.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={o.value === value}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => commit(o.value)}
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] transition-colors',
                    i === active ? 'bg-brand-50' : 'bg-transparent',
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-ink">{o.label}</span>
                    {o.meta && <span className="block truncate text-[11.5px] text-ink-3">{o.meta}</span>}
                  </span>
                  {o.value === value && <Check size={14} className="shrink-0 text-brand-600" />}
                </button>
              </li>
            ))}
          </ul>
          <div className="border-t border-hairline bg-sunken px-3 py-1.5 text-[11px] text-ink-3">
            {filtered.length} dari {options.length} data
          </div>
        </div>
      )}
    </div>
  )
}
