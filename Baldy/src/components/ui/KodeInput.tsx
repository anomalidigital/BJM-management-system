import { FaWandMagicSparkles } from './icons'
import { Button } from './Button'
import { Input } from './Field'
import { cn } from '../../lib/utils'

/**
 * Kolom kode: terisi otomatis saat menambah data, tetap bisa diketik sendiri,
 * dan tombol Generate di kanannya membuat kode baru kapan saja.
 */
export function KodeInput({
  id,
  value,
  onChange,
  onGenerate,
  invalid,
  placeholder,
  readOnly,
  uppercase,
  className,
  inputClassName,
  generateTitle = 'Buat kode otomatis',
  'aria-label': ariaLabel,
}: {
  id?: string
  value: string
  onChange: (value: string) => void
  onGenerate: () => void
  invalid?: boolean
  placeholder?: string
  /** Mode lihat: kolom terkunci dan tombol Generate disembunyikan. */
  readOnly?: boolean
  /** Ketikan otomatis jadi huruf besar. */
  uppercase?: boolean
  className?: string
  inputClassName?: string
  generateTitle?: string
  'aria-label'?: string
}) {
  return (
    <div className={cn('flex gap-2', className)}>
      <Input
        id={id}
        value={value}
        invalid={invalid}
        placeholder={placeholder}
        readOnly={readOnly}
        aria-label={ariaLabel}
        className={cn('tnum font-medium tracking-wide', inputClassName)}
        onChange={(e) => onChange(uppercase ? e.target.value.toUpperCase() : e.target.value)}
      />
      {!readOnly && (
        <Button icon={<FaWandMagicSparkles size={14} />} title={generateTitle} className="shrink-0" onClick={onGenerate}>
          Generate
        </Button>
      )}
    </div>
  )
}
