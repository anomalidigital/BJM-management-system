import { useCallback, useEffect, useMemo, useState } from 'react'
import { sortRows } from './utils'
import type { SortDir } from './utils'

interface Options<T> {
  /** Predikat pencarian bebas per baris. */
  search: (row: T, query: string) => boolean
  initialSortKey?: string | null
  initialSortDir?: SortDir
  /** Peta kunci kolom -> field yang dipakai untuk sorting. */
  sortAccessor?: (key: string) => keyof T
  pageSize?: number
  /** Filter tambahan (tanggal, status, dsb). */
  extraFilter?: (row: T) => boolean
  /** Ikut dihitung sebagai "sedang memfilter" untuk memilih empty vs not-found. */
  extraFilterActive?: boolean
}

/** State tabel standar: pencarian + sort + pagination, tanpa reload halaman. */
export function useTable<T>(rows: T[], opts: Options<T>) {
  const { search, initialSortKey = null, initialSortDir = 'asc', sortAccessor, pageSize: initialPageSize = 10, extraFilter, extraFilterActive } = opts

  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<{ key: string | null; dir: SortDir }>({ key: initialSortKey, dir: initialSortDir })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(initialPageSize)

  const filtered = useMemo(() => {
    let out = rows
    if (query.trim()) out = out.filter((r) => search(r, query))
    if (extraFilter) out = out.filter(extraFilter)
    return out
  }, [rows, query, search, extraFilter])

  const sorted = useMemo(() => {
    if (!sort.key) return filtered
    const field = (sortAccessor ? sortAccessor(sort.key) : (sort.key as keyof T))
    return sortRows(filtered, field, sort.dir)
  }, [filtered, sort, sortAccessor])

  const total = sorted.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  // Jangan tertinggal di halaman kosong setelah filter menyusut.
  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const pageRows = useMemo(() => sorted.slice((page - 1) * pageSize, page * pageSize), [sorted, page, pageSize])

  const toggleSort = useCallback((key: string) => {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))
    setPage(1)
  }, [])

  const changeQuery = useCallback((v: string) => {
    setQuery(v)
    setPage(1)
  }, [])

  const changePageSize = useCallback((n: number) => {
    setPageSize(n)
    setPage(1)
  }, [])

  const reset = useCallback(() => {
    setQuery('')
    setPage(1)
  }, [])

  return {
    query,
    setQuery: changeQuery,
    sort,
    toggleSort,
    page,
    setPage,
    pageSize,
    setPageSize: changePageSize,
    pageRows,
    filtered: sorted,
    total,
    isFiltered: Boolean(query.trim()) || Boolean(extraFilterActive),
    reset,
  }
}
