// Panel melayang (dropdown pilihan, menu ⋯, panel filter): posisi tetap di layar supaya tidak terpotong modal / tabel.
Object.assign(window.sikotis, {
  /** Gaya posisi panel dropdown di bawah tombol (atau di atasnya bila ruang bawah kurang). */
  posisiPanel(tombol, panel, lebarMin) {
    const r = tombol.getBoundingClientRect()
    const lebar = Math.min(Math.max(r.width, lebarMin || 220), window.innerWidth - 16)
    const tinggi = (panel && panel.offsetHeight) || 320
    const ruangBawah = window.innerHeight - r.bottom
    const keAtas = ruangBawah < tinggi + 12 && r.top > ruangBawah
    const left = Math.max(8, Math.min(r.left, window.innerWidth - lebar - 8))
    return keAtas
      ? 'position:fixed;left:' + left + 'px;width:' + lebar + 'px;bottom:' + (window.innerHeight - r.top + 4) + 'px;z-index:1080'
      : 'position:fixed;left:' + left + 'px;width:' + lebar + 'px;top:' + (r.bottom + 4) + 'px;z-index:1080'
  },
  posisiMenu(tombol, panel, lebar) {
    const r = tombol.getBoundingClientRect()
    const tinggi = (panel && panel.offsetHeight) || 0
    const keAtas = r.bottom + tinggi + 8 > window.innerHeight && r.top - tinggi - 4 > 0
    const left = Math.max(8, Math.min(r.right - lebar, window.innerWidth - lebar - 8))
    return 'position:fixed;left:' + left + 'px;width:' + lebar + 'px;top:' + (keAtas ? r.top - tinggi - 4 : r.bottom + 4) + 'px;z-index:1070'
  },
  posisiPanelFilter(tombol, lebar) {
    const r = tombol.getBoundingClientRect()
    const w = Math.min(lebar, window.innerWidth - 16)
    const left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8))
    const top = r.bottom + 6
    return 'position:fixed;left:' + left + 'px;top:' + top + 'px;width:' + w + 'px;max-height:' + Math.max(240, window.innerHeight - top - 12) + 'px;z-index:1070'
  },
  /** Enter / panah di dalam panel tidak mengirim form atau menggulir halaman; logikanya di .NET. */
  jagaKunci(el) {
    if (!el || el.dataset.jaga) return
    el.dataset.jaga = '1'
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === 'ArrowUp') e.preventDefault()
    })
  },
  gulirAktif(daftar) {
    const el = daftar && daftar.querySelector('[data-aktif="true"]')
    if (el) el.scrollIntoView({ block: 'nearest' })
  },
  fokusDalam(el) { setTimeout(function () { if (el && el.focus) el.focus() }, 10) },
  /** Esc menutup (preview cetak, penampil lampiran); dilepas lewat lepasTutupLuar. */
  pasangEsc(dotnet) {
    const tombol = function (e) { if (e.key === 'Escape') dotnet.invokeMethodAsync('TutupDariLuar') }
    document.addEventListener('keydown', tombol)
    return { lepas: function () { document.removeEventListener('keydown', tombol) } }
  },
})
