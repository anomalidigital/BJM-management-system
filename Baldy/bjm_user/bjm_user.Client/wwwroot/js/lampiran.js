// Penyimpanan lampiran (gambar / PDF) di IndexedDB. Record hanya menyimpan id-nya; isi berkas di sini.
// Gambar diperkecil lebih dulu supaya satu foto ponsel tidak memakan belasan MB.
(function () {
  const NAMA_DB = 'sikotis-lampiran'
  const STORE = 'berkas'
  let koneksi = null
  const cacheUrl = new Map()

  function uid(awalan) {
    return awalan + '_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
  }

  function buka() {
    if (!koneksi) {
      koneksi = new Promise((resolve, reject) => {
        const req = indexedDB.open(NAMA_DB, 1)
        req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'id' }) }
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => { koneksi = null; reject(req.error) }
      })
    }
    return koneksi
  }

  function jalankan(mode, kerja) {
    return buka().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode)
      const req = kerja(tx.objectStore(STORE))
      tx.oncomplete = () => resolve(req ? req.result : undefined)
      tx.onerror = () => reject(tx.error)
    }))
  }

  async function perkecil(file, maks, mutu) {
    maks = maks || 1600; mutu = mutu || 0.82
    let gambar
    try { gambar = await createImageBitmap(file) } catch { return file }
    const skala = Math.min(1, maks / Math.max(gambar.width, gambar.height))
    if (skala === 1 && file.size < 700000) { gambar.close(); return file }
    const kanvas = document.createElement('canvas')
    kanvas.width = Math.round(gambar.width * skala)
    kanvas.height = Math.round(gambar.height * skala)
    const ctx = kanvas.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, kanvas.width, kanvas.height)
    ctx.drawImage(gambar, 0, 0, kanvas.width, kanvas.height)
    gambar.close()
    return new Promise((resolve) => kanvas.toBlob((b) => resolve(b || file), 'image/jpeg', mutu))
  }

  async function simpan(file) {
    const blob = file.type.startsWith('image/') && file.type !== 'image/gif' ? await perkecil(file) : file
    const berkas = { id: uid('lmp'), name: file.name, type: blob.type || file.type, size: blob.size, blob, created_at: new Date().toISOString() }
    await jalankan('readwrite', (s) => s.put(berkas))
    return berkas.id
  }

  window.sikotis.lampiran = {
    TIPE_DITERIMA: 'image/*,application/pdf',
    /** Simpan seluruh berkas dari <input type=file>; kembalikan daftar id. */
    async simpanDariInput(input) {
      const files = input && input.files ? Array.from(input.files) : []
      const ids = []
      for (const f of files) ids.push(await simpan(f))
      try { input.value = '' } catch { /* abaikan */ }
      return ids
    },
    /** Info + object URL satu lampiran; null bila tidak ada. */
    async info(id) {
      const b = await jalankan('readonly', (s) => s.get(id))
      if (!b) return null
      let url = cacheUrl.get(id)
      if (!url) { url = URL.createObjectURL(b.blob); cacheUrl.set(id, url) }
      return { id: b.id, name: b.name, type: b.type, size: b.size, url, gambar: b.type.startsWith('image/') }
    },
    async hapus(ids) {
      if (!ids || ids.length === 0) return
      await jalankan('readwrite', (s) => { ids.forEach((id) => s.delete(id)) })
      ids.forEach((id) => { const url = cacheUrl.get(id); if (url) { URL.revokeObjectURL(url); cacheUrl.delete(id) } })
    },
    async hitung() { return (await jalankan('readonly', (s) => s.count())) || 0 },
    /** Hapus berkas yang tidak dirujuk record mana pun dan sudah berumur lebih dari 6 jam. */
    async bersihkan(dipakai) {
      const set = new Set(dipakai || [])
      const semua = (await jalankan('readonly', (s) => s.getAll())) || []
      const batas = Date.now() - 6 * 60 * 60 * 1000
      const yatim = semua.filter((b) => !set.has(b.id) && Date.parse(b.created_at) < batas).map((b) => b.id)
      await window.sikotis.lampiran.hapus(yatim)
      return yatim.length
    },
    buka(url) { window.open(url, '_blank', 'noopener') },
  }
})()
