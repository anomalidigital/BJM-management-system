// Jembatan JavaScript kecil untuk SIKOTIS (Blazor WebAssembly): penyimpanan browser, cetak, unduh, fokus.
// Lampiran (IndexedDB) ada di lampiran.js.
window.sikotis = {
  baca(kunci) {
    try { return localStorage.getItem(kunci) } catch { return null }
  },
  simpan(kunci, nilai) {
    try { localStorage.setItem(kunci, nilai); return true } catch { return false }
  },
  hapus(kunci) {
    try { localStorage.removeItem(kunci) } catch { /* abaikan */ }
  },
  cetak() { window.print() },
  unduh(nama, isi, mime) {
    const blob = new Blob([isi], { type: mime || 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = nama
    a.click()
    URL.revokeObjectURL(url)
  },
  fokus(selector) {
    const el = document.querySelector(selector)
    if (el) el.focus()
  },
  gulirKe(selector) {
    const el = document.querySelector(selector)
    if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  },
  /** Ukuran halaman cetak (@page) mengikuti orientasi preview. */
  aturHalamanCetak(orientasi) {
    let el = document.querySelector('style[data-cetak="ukuran-halaman"]')
    if (!el) { el = document.createElement('style'); el.dataset.cetak = 'ukuran-halaman'; document.head.appendChild(el) }
    el.textContent = orientasi === 'lanskap'
      ? '@page { size: A4 landscape; margin: 10mm 12mm 12mm 12mm; }'
      : '@page { size: A4 portrait; margin: 12mm 10mm 14mm 10mm; }'
  },
  hapusHalamanCetak() { document.querySelector('style[data-cetak="ukuran-halaman"]')?.remove() },
  /** Tutup lewat Esc / klik di luar: pasang sekali, panggil balik ke .NET. */
  pasangTutupLuar(elemen, dotnet) {
    const klik = (e) => { if (!elemen.contains(e.target)) dotnet.invokeMethodAsync('TutupDariLuar') }
    const tombol = (e) => { if (e.key === 'Escape') dotnet.invokeMethodAsync('TutupDariLuar') }
    document.addEventListener('mousedown', klik)
    document.addEventListener('keydown', tombol)
    return { lepas() { document.removeEventListener('mousedown', klik); document.removeEventListener('keydown', tombol) } }
  },
  lepasTutupLuar(pegangan) { pegangan?.lepas?.() },
  kunciGulir(kunci) { document.body.style.overflow = kunci ? 'hidden' : '' },
}

// Tooltip ikon "?" ([data-info]): satu elemen fixed di <body> supaya tidak terpotong modal yang bisa digulir.
// Muncul saat diarahkan mouse, difokus keyboard, atau diketuk (layar sentuh); hilang saat keluar, Esc, atau digulir.
;(() => {
  let tip = null, pemilik = null, sejak = 0
  const tampil = (el) => {
    const teks = el.getAttribute('data-info')
    if (!teks) return
    if (!tip) {
      tip = document.createElement('div')
      tip.className = 'tip-info'
      tip.id = 'tip-info'
      tip.setAttribute('role', 'tooltip')
      document.body.appendChild(tip)
    }
    tip.textContent = teks
    tip.style.display = 'block'
    pemilik = el
    sejak = Date.now()
    const r = el.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight
    const x = Math.max(8, Math.min(r.left + r.width / 2 - w / 2, innerWidth - w - 8))
    const y = r.top - h - 8 < 8 ? r.bottom + 8 : r.top - h - 8
    tip.style.left = `${x}px`
    tip.style.top = `${y}px`
  }
  const sembunyi = () => {
    if (tip) tip.style.display = 'none'
    pemilik = null
  }
  const cari = (e) => (e.target instanceof Element ? e.target.closest('[data-info]') : null)
  document.addEventListener('mouseover', (e) => { const el = cari(e); if (el && el !== pemilik) tampil(el) })
  document.addEventListener('mouseout', (e) => { const el = cari(e); if (el && !(e.relatedTarget instanceof Node && el.contains(e.relatedTarget))) sembunyi() })
  document.addEventListener('focusin', (e) => { const el = cari(e); if (el) tampil(el) })
  document.addEventListener('focusout', (e) => { if (cari(e)) sembunyi() })
  document.addEventListener('click', (e) => {
    const el = cari(e)
    if (!el) { if (pemilik) sembunyi(); return }
    // Ketukan sentuh memicu mouseover lalu click: jangan langsung ditutup lagi.
    if (pemilik === el && Date.now() - sejak > 400) sembunyi()
    else tampil(el)
  })
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && pemilik) sembunyi() })
  addEventListener('scroll', () => { if (pemilik) sembunyi() }, true)
})()
