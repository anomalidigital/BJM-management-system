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
