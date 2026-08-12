import { useNavigate } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'

export function NotFoundPage() {
  const navigate = useNavigate()
  return (
    <Card className="mx-auto max-w-lg">
      <div className="px-6 py-16 text-center">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full border border-hairline bg-sunken text-ink-3">
          <Compass size={22} />
        </div>
        <p className="text-[18px] font-semibold text-ink">Halaman tidak ditemukan</p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-ink-3">
          Alamat yang Anda buka tidak tersedia pada prototype ini.
        </p>
        <Button className="mt-5" variant="primary" onClick={() => navigate('/dashboard')}>Kembali ke Dashboard</Button>
      </div>
    </Card>
  )
}
