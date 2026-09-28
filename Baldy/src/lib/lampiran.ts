/**
 * Penyimpanan lampiran (gambar / PDF) di IndexedDB.
 *
 * localStorage hanya muat beberapa MB dan sudah terisi data, jadi isi berkas
 * disimpan terpisah di sini. Record di database cukup menyimpan id-nya.
 * Gambar diperkecil lebih dulu supaya satu foto dari ponsel tidak memakan
 * belasan MB.
 */
import { uid } from './utils'

const NAMA_DB = 'sikotis-lampiran'
const STORE = 'berkas'

export interface Berkas {
  id: string
  name: string
  type: string
  size: number
  blob: Blob
  created_at: string
}

let koneksi: Promise<IDBDatabase> | null = null

function buka(): Promise<IDBDatabase> {
  if (!koneksi) {
    koneksi = new Promise((resolve, reject) => {
      const req = indexedDB.open(NAMA_DB, 1)
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'id' })
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => { koneksi = null; reject(req.error) }
    })
  }
  return koneksi
}

function jalankan<T>(mode: IDBTransactionMode, kerja: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return buka().then((db) => new Promise<T | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const req = kerja(tx.objectStore(STORE))
    tx.oncomplete = () => resolve(req ? (req.result as T) : undefined)
    tx.onerror = () => reject(tx.error)
  }))
}

/**
 * Perkecil foto ke sisi terpanjang 1600 px. Berkas kecil dibiarkan apa adanya,
 * begitu juga format yang tidak bisa dibaca browser (mis. HEIC).
 */
async function perkecil(file: File, maks = 1600, mutu = 0.82): Promise<Blob> {
  let gambar: ImageBitmap
  try { gambar = await createImageBitmap(file) } catch { return file }
  const skala = Math.min(1, maks / Math.max(gambar.width, gambar.height))
  if (skala === 1 && file.size < 700_000) { gambar.close(); return file }
  const kanvas = document.createElement('canvas')
  kanvas.width = Math.round(gambar.width * skala)
  kanvas.height = Math.round(gambar.height * skala)
  const ctx = kanvas.getContext('2d')!
  // JPEG tidak punya transparansi; beri alas putih supaya PNG tidak jadi hitam.
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, kanvas.width, kanvas.height)
  ctx.drawImage(gambar, 0, 0, kanvas.width, kanvas.height)
  gambar.close()
  return new Promise((resolve) => kanvas.toBlob((b) => resolve(b ?? file), 'image/jpeg', mutu))
}

export const TIPE_DITERIMA = 'image/*,application/pdf'

export async function simpanLampiran(file: File): Promise<string> {
  const blob = file.type.startsWith('image/') && file.type !== 'image/gif' ? await perkecil(file) : file
  const berkas: Berkas = {
    id: uid('lmp'),
    name: file.name,
    type: blob.type || file.type,
    size: blob.size,
    blob,
    created_at: new Date().toISOString(),
  }
  await jalankan('readwrite', (s) => s.put(berkas))
  return berkas.id
}

export function ambilLampiran(id: string): Promise<Berkas | undefined> {
  return jalankan<Berkas>('readonly', (s) => s.get(id))
}

export async function hapusLampiran(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  await jalankan('readwrite', (s) => { ids.forEach((id) => s.delete(id)) })
  ids.forEach((id) => {
    const url = cacheUrl.get(id)
    if (url) { URL.revokeObjectURL(url); cacheUrl.delete(id) }
  })
}

export function hitungLampiran(): Promise<number | undefined> {
  return jalankan<number>('readonly', (s) => s.count())
}

/**
 * Hapus berkas yang tidak dirujuk record mana pun - sisa form yang dibatalkan
 * atau record yang sudah dihapus. Berkas yang baru dibuat dibiarkan dulu,
 * siapa tahu formnya masih terbuka di tab lain.
 */
export async function bersihkanLampiran(dipakai: Set<string>, umurMinimalMs = 6 * 60 * 60 * 1000): Promise<number> {
  const semua = (await jalankan<Berkas[]>('readonly', (s) => s.getAll())) ?? []
  const batas = Date.now() - umurMinimalMs
  const yatim = semua.filter((b) => !dipakai.has(b.id) && Date.parse(b.created_at) < batas).map((b) => b.id)
  await hapusLampiran(yatim)
  return yatim.length
}

/* Object URL dipakai ulang supaya thumbnail tidak dibuat berulang kali. */
const cacheUrl = new Map<string, string>()

export async function urlLampiran(id: string): Promise<{ url: string; berkas: Berkas } | null> {
  const berkas = await ambilLampiran(id)
  if (!berkas) return null
  let url = cacheUrl.get(id)
  if (!url) { url = URL.createObjectURL(berkas.blob); cacheUrl.set(id, url) }
  return { url, berkas }
}
