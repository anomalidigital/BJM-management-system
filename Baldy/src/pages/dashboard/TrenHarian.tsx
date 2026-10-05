import { LineChart } from '../../components/charts/LineChart'
import { VIZ } from '../../components/charts/chartUtils'
import { formatDateShort, formatRupiah } from '../../lib/format'
import { Panel } from './Panel'

/**
 * Pendapatan dan komisi per hari. Dua grafik bertumpuk dengan skala masing-masing:
 * komisi hanya sebagian kecil pendapatan, jadi di satu sumbu garisnya rata di dasar.
 */
export function TrenHarian({
  bulan,
  hari,
  pendapatan,
  komisi,
}: {
  bulan: string
  /** Tanggal ISO dari tanggal 1 sampai hari terakhir yang ditampilkan. */
  hari: string[]
  pendapatan: number[]
  komisi: number[]
}) {
  const labels = hari.map(formatDateShort)
  const seri = [
    { nama: 'Pendapatan', warna: VIZ.series1, nilai: pendapatan },
    { nama: 'Komisi sopir', warna: VIZ.series2, nilai: komisi },
  ]

  return (
    <Panel
      title="Pendapatan & komisi per hari"
      subtitle={`${bulan}, tanggal 1 s/d ${labels.at(-1) ?? '-'}. Tiap grafik punya skala sendiri.`}
    >
      <div className="space-y-4 px-3 pb-4">
        {seri.map((s) => {
          const total = s.nilai.reduce((a, b) => a + b, 0)
          return (
            <div key={s.nama}>
              <div className="flex items-baseline justify-between gap-3 px-2">
                <span className="flex items-center gap-1.5 text-[13px] text-ink">
                  <span className="size-2 rounded-full" style={{ background: s.warna }} aria-hidden="true" />
                  {s.nama}
                </span>
                <span className="text-[12px] text-ink-3">
                  sebulan <span className="tnum font-rail text-[17px] font-semibold text-ink">{formatRupiah(total, { compact: true })}</span>
                </span>
              </div>
              {total === 0 ? (
                <p className="px-2 py-5 text-[12.5px] text-ink-3">Belum ada {s.nama.toLowerCase()} tercatat di bulan ini.</p>
              ) : (
                <LineChart labels={labels} series={[{ name: s.nama, color: s.warna, values: s.nilai }]} height={132} />
              )}
            </div>
          )
        })}
      </div>
    </Panel>
  )
}
