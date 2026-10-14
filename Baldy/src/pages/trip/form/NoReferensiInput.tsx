import { useState } from 'react'
import type { KeyboardEvent } from 'react'
import { FaPlus, FaRotateLeft, FaXmark } from '../../../components/ui/icons'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Field'
import { kunciTr, rapikanTr } from '../../../lib/trip'

/**
 * Isian No. Referensi (nomor order klien, mis. TR DHL / Order Release): ketik lalu Enter,
 * koma, atau tombol Tambah. Boleh lebih dari satu dan tidak pernah dibuat sistem.
 * Nomor yang sama ("TR2600512595" dan "2600512595") hanya dicatat sekali.
 */
export function NoReferensiInput({ id, value, onChange }: { id?: string; value: string[]; onChange: (v: string[]) => void }) {
  const [ketik, setKetik] = useState('')
  function tambah(teks = ketik) {
    const baru = teks.split(/[,;\n]/).map(rapikanTr).filter(Boolean)
    const gabung = [...value]
    for (const no of baru) if (!gabung.some((x) => kunciTr(x) === kunciTr(no))) gabung.push(no)
    if (gabung.length !== value.length) onChange(gabung)
    setKetik('')
  }
  function tombol(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); tambah() }
    if (e.key === 'Backspace' && !ketik && value.length) onChange(value.slice(0, -1))
  }
  return (
    <div>
      <div className="flex items-center gap-2">
        <Input id={id} value={ketik} placeholder="TR2600512595" className="min-w-0 flex-1"
          onChange={(e) => setKetik(e.target.value)} onKeyDown={tombol} onBlur={() => ketik.trim() && tambah()} />
        <Button size="sm" icon={<FaPlus size={13} />} disabled={!ketik.trim()} onClick={() => tambah()}>Tambah</Button>
      </div>
      {value.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {value.map((no) => (
            <li key={no} className="tnum inline-flex max-w-full items-center gap-1 rounded-md border border-hairline bg-sunken py-0.5 pr-1 pl-2 text-[12.5px] font-medium text-ink">
              <span className="truncate">{no}</span>
              <button type="button" aria-label={`Hapus No. Referensi ${no}`} onClick={() => onChange(value.filter((x) => x !== no))}
                className="grid h-5 w-5 shrink-0 place-items-center rounded text-ink-3 transition hover:bg-surface hover:text-[color:var(--color-critical)]">
                <FaXmark size={11} />
              </button>
            </li>
          ))}
          {value.length > 1 && (
            <li>
              <button type="button" onClick={() => onChange([])} className="inline-flex items-center gap-1 px-1 py-0.5 text-[12px] text-ink-3 hover:text-ink">
                <FaRotateLeft size={11} /> Kosongkan
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
