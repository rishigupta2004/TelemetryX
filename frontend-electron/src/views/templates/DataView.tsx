import type { ReactNode, DependencyList } from 'react'
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { BaseView, type ViewState, type BaseViewProps } from './BaseView'

export interface UseDataOptions<T> {
  initialState?: T | null
  cacheKey?: string
  cacheTTL?: number
  onSuccess?: (data: T) => void
  onError?: (error: string) => void
}

export interface DataViewProps<T> extends Omit<BaseViewProps, 'state' | 'children'> {
  data: T | null
  loading: boolean
  error: string | null
  children: (data: T) => ReactNode
  refetch?: () => void
}

function createCache<K, V>(maxSize = 50): Map<K, { value: V; timestamp: number }> {
  return new Map()
}

function getFromCache<K, V>(cache: Map<K, { value: V; timestamp: number }>, key: K, ttl: number): V | undefined {
  const entry = cache.get(key)
  if (!entry) return undefined
  if (Date.now() - entry.timestamp > ttl) {
    cache.delete(key)
    return undefined
  }
  return entry.value
}

function setCache<K, V>(cache: Map<K, { value: V; timestamp: number }>, key: K, value: V): void {
  if (cache.size >= 50) {
    const firstKey = cache.keys().next().value
    if (firstKey !== undefined) cache.delete(firstKey)
  }
  cache.set(key, { value, timestamp: Date.now() })
}

export function useDataFetch<T>(
  fetchFn: () => Promise<T>,
  deps: DependencyList,
  options: UseDataOptions<T> = {}
): {
  data: T | null
  loading: boolean
  error: string | null
  refetch: () => void
} {
  const { initialState = null, onSuccess, onError } = options
  const cacheRef = useRef(createCache<string, T>())
  
  const [data, setData] = useState<T | null>(initialState)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(() => {
    let cancelled = false
    
    setLoading(true)
    setError(null)

    fetchFn()
      .then((result) => {
        if (cancelled) return
        setData(result)
        onSuccess?.(result)
      })
      .catch((err) => {
        if (cancelled) return
        const message = String(err)
        setError(message)
        onError?.(message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, deps)

  useEffect(() => {
    fetch()
  }, [fetch])

  return { data, loading, error, refetch: fetch }
}

export function useDataFetchWithCache<T>(
  fetchFn: () => Promise<T>,
  cacheKey: string,
  deps: DependencyList,
  options: UseDataOptions<T> = {}
): {
  data: T | null
  loading: boolean
  error: string | null
  refetch: () => void
} {
  const { initialState = null, cacheTTL = 5 * 60 * 1000, onSuccess, onError } = options
  const cacheRef = useRef(createCache<string, T>())
  
  const [data, setData] = useState<T | null>(() => {
    if (cacheKey) {
      const cached = getFromCache(cacheRef.current, cacheKey, cacheTTL)
      if (cached) return cached
    }
    return initialState
  })
  const [loading, setLoading] = useState(!data)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(() => {
    if (cacheKey) {
      const cached = getFromCache(cacheRef.current, cacheKey, cacheTTL)
      if (cached) {
        setData(cached)
        setLoading(false)
        return
      }
    }

    let cancelled = false
    
    setLoading(true)
    setError(null)

    fetchFn()
      .then((result) => {
        if (cancelled) return
        setData(result)
        if (cacheKey) setCache(cacheRef.current, cacheKey, result)
        onSuccess?.(result)
      })
      .catch((err) => {
        if (cancelled) return
        const message = String(err)
        setError(message)
        onError?.(message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [cacheKey, cacheTTL, ...deps])

  useEffect(() => {
    fetch()
  }, [fetch])

  return { data, loading, error, refetch: fetch }
}

export function DataView<T>({
  data,
  loading,
  error,
  children,
  refetch: _refetch,
  ...baseProps
}: DataViewProps<T>) {
  const viewState: ViewState = loading ? 'loading' : error ? 'error' : data ? 'ready' : 'empty'
  
  const content = data ? children(data) : null

  return (
    <BaseView
      state={viewState}
      errorMessage={error || undefined}
      emptyMessage={baseProps.emptyMessage || 'No data available'}
      {...baseProps}
    >
      {content}
    </BaseView>
  )
}

export { BaseView }
export type { BaseViewProps, ViewState }
