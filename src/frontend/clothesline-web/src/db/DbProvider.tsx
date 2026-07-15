import { useEffect, useState, type ReactNode } from 'react'
import { RxDatabaseProvider } from 'rxdb/plugins/react'
import { LoadListSkeleton } from '../components/Skeleton'
import { getDb, type ClotheslineDatabase } from './index'

export function DbProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<ClotheslineDatabase | null>(null)

  useEffect(() => {
    let cancelled = false
    getDb().then((resolved) => {
      if (!cancelled) setDb(resolved)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (!db) {
    return <LoadListSkeleton />
  }

  return <RxDatabaseProvider database={db}>{children}</RxDatabaseProvider>
}
