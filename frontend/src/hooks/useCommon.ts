import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  RefObject,
} from 'react'
import { animate } from 'animejs'

export interface PaginationState {
  page: number
  pageSize: number
  total?: number
}

export interface PaginatedFetchResult<T> {
  data: T[]
  loading: boolean
  error: Error | null
  pagination: PaginationState
  setPage: (page: number) => void
  setPageSize: (size: number) => void
  refetch: () => void
  hasMore: boolean
}

/**
 * Hook for paginated API calls with state management.
 * @param fetchFn - Async function that returns data and optional total count
 * @param initialPage - Initial page number (default: 1)
 * @param initialPageSize - Initial page size (default: 20)
 */
export function usePaginatedFetch<T>(
  fetchFn: (page: number, pageSize: number) => Promise<{ data: T[]; total?: number }>,
  initialPage = 1,
  initialPageSize = 20
): PaginatedFetchResult<T> {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [pagination, setPagination] = useState<PaginationState>({
    page: initialPage,
    pageSize: initialPageSize,
  })

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetchFn(pagination.page, pagination.pageSize)
      setData(result.data)
      setPagination((prev) => ({ ...prev, total: result.total }))
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Fetch failed'))
    } finally {
      setLoading(false)
    }
  }, [fetchFn, pagination.page, pagination.pageSize])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const setPage = useCallback((page: number) => {
    setPagination((prev) => ({ ...prev, page: Math.max(1, page) }))
  }, [])

  const setPageSize = useCallback((pageSize: number) => {
    setPagination((prev) => ({ ...prev, pageSize: Math.max(1, pageSize), page: 1 }))
  }, [])

  const hasMore = useMemo(() => {
    if (pagination.total === undefined) return true
    return pagination.page * pagination.pageSize < pagination.total
  }, [pagination.page, pagination.pageSize, pagination.total])

  return { data, loading, error, pagination, setPage, setPageSize, refetch: fetchData, hasMore }
}

interface CacheEntry<T> {
  data: T
  timestamp: number
}

export interface CachedFetchOptions {
  ttl?: number
  enabled?: boolean
}

/**
 * Hook for fetching data with TTL-based caching.
 * @param key - Unique cache key
 * @param fetchFn - Async function to fetch data
 * @param options - Cache TTL in ms (default: 60000) and enabled flag
 */
export function useCachedFetch<T>(
  key: string,
  fetchFn: () => Promise<T>,
  options: CachedFetchOptions = {}
): { data: T | null; loading: boolean; error: Error | null; refetch: () => void } {
  const { ttl = 60000, enabled = true } = options
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const cacheRef = useRef<Map<string, CacheEntry<T>>>(new Map())

  const fetchData = useCallback(async () => {
    if (!enabled) return

    const cached = cacheRef.current.get(key)
    if (cached && Date.now() - cached.timestamp < ttl) {
      setData(cached.data)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const result = await fetchFn()
      cacheRef.current.set(key, { data: result, timestamp: Date.now() })
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Fetch failed'))
    } finally {
      setLoading(false)
    }
  }, [key, fetchFn, ttl, enabled])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}

/**
 * Hook for debounced API calls that only trigger after delay.
 * @param fetchFn - Async function to call
 * @param delay - Debounce delay in ms (default: 300)
 */
export function useDebouncedFetch<T>(
  fetchFn: () => Promise<T>,
  delay = 300
): { execute: () => void; cancel: () => void } {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  const execute = useCallback(() => {
    cancel()
    timeoutRef.current = setTimeout(fetchFn, delay)
  }, [fetchFn, delay, cancel])

  useEffect(() => {
    return () => cancel()
  }, [cancel])

  return { execute, cancel }
}

export interface SelectionState<T> {
  selected: T | null
  select: (item: T) => void
  clear: () => void
  isSelected: (item: T) => boolean
  toggle: (item: T) => void
}

/**
 * Hook for single item selection logic.
 * @param initialValue - Initial selected item
 */
export function useSelection<T>(initialValue: T | null = null): SelectionState<T> {
  const [selected, setSelected] = useState<T | null>(initialValue)

  const select = useCallback((item: T) => {
    setSelected(item)
  }, [])

  const clear = useCallback(() => {
    setSelected(null)
  }, [])

  const isSelected = useCallback(
    (item: T) => {
      if (selected === null) return false
      return selected === item
    },
    [selected]
  )

  const toggle = useCallback(
    (item: T) => {
      setSelected((prev) => (prev === item ? null : item))
    },
    []
  )

  return { selected, select, clear, isSelected, toggle }
}

export interface MultiSelectState<T> {
  selected: Set<T>
  select: (item: T) => void
  deselect: (item: T) => void
  toggle: (item: T) => void
  selectAll: (items: T[]) => void
  clear: () => void
  isSelected: (item: T) => boolean
  selectedArray: T[]
}

/**
 * Hook for multi-select patterns with Set-based storage.
 * @param initialValues - Initial selected items
 */
export function useMultiSelect<T>(initialValues: T[] = []): MultiSelectState<T> {
  const [selected, setSelected] = useState<Set<T>>(() => new Set(initialValues))

  const select = useCallback((item: T) => {
    setSelected((prev) => new Set(prev).add(item))
  }, [])

  const deselect = useCallback((item: T) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.delete(item)
      return next
    })
  }, [])

  const toggle = useCallback((item: T) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(item)) {
        next.delete(item)
      } else {
        next.add(item)
      }
      return next
    })
  }, [])

  const selectAll = useCallback((items: T[]) => {
    setSelected(new Set(items))
  }, [])

  const clear = useCallback(() => {
    setSelected(new Set())
  }, [])

  const isSelected = useCallback(
    (item: T) => selected.has(item),
    [selected]
  )

  const selectedArray = useMemo(() => Array.from(selected), [selected])

  return { selected, select, deselect, toggle, selectAll, clear, isSelected, selectedArray }
}

export interface FilterState<T> {
  filtered: T[]
  filter: (predicate: (item: T) => boolean) => void
  setItems: (items: T[]) => void
  sort: (compareFn?: (a: T, b: T) => number) => void
  search: (query: string, keys: (keyof T)[]) => void
  reset: () => void
}

/**
 * Hook for filtering and sorting lists.
 * @param items - Initial items array
 */
export function useFilter<T>(items: T[] = []): FilterState<T> {
  const [allItems, setAllItems] = useState<T[]>(items)
  const [filtered, setFiltered] = useState<T[]>(items)
  const [currentPredicate, setCurrentPredicate] = useState<((item: T) => boolean) | null>(null)

  useEffect(() => {
    setAllItems(items)
    if (!currentPredicate) {
      setFiltered(items)
    }
  }, [items])

  const filter = useCallback((predicate: (item: T) => boolean) => {
    setCurrentPredicate(() => predicate)
    setFiltered(allItems.filter(predicate))
  }, [allItems])

  const setItems = useCallback((newItems: T[]) => {
    setAllItems(newItems)
    if (currentPredicate) {
      setFiltered(newItems.filter(currentPredicate))
    } else {
      setFiltered(newItems)
    }
  }, [currentPredicate])

  const sort = useCallback((compareFn?: (a: T, b: T) => number) => {
    setFiltered((prev) => [...prev].sort(compareFn))
  }, [])

  const search = useCallback(
    (query: string, keys: (keyof T)[]) => {
      const lowerQuery = query.toLowerCase().trim()
      if (!lowerQuery) {
        if (currentPredicate) {
          setFiltered(allItems.filter(currentPredicate))
        } else {
          setFiltered(allItems)
        }
        return
      }
      const predicate = (item: T) =>
        keys.some((key) => {
          const value = item[key]
          if (typeof value === 'string') {
            return value.toLowerCase().includes(lowerQuery)
          }
          return false
        })
      const combined = currentPredicate
        ? (item: T) => currentPredicate(item) && predicate(item)
        : predicate
      setFiltered(allItems.filter(combined))
      setCurrentPredicate(() => combined)
    },
    [allItems, currentPredicate]
  )

  const reset = useCallback(() => {
    setFiltered(allItems)
    setCurrentPredicate(null)
  }, [allItems])

  return { filtered, filter, setItems, sort, search, reset }
}

/**
 * Hook for hover state management.
 * @returns Ref and hover state
 */
export function useHover(): [RefObject<HTMLDivElement | null>, boolean] {
  const [isHovered, setIsHovered] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const onMouseEnter = () => setIsHovered(true)
    const onMouseLeave = () => setIsHovered(false)

    element.addEventListener('mouseenter', onMouseEnter)
    element.addEventListener('mouseleave', onMouseLeave)

    return () => {
      element.removeEventListener('mouseenter', onMouseEnter)
      element.removeEventListener('mouseleave', onMouseLeave)
    }
  }, [])

  return [ref, isHovered]
}

/**
 * Hook for active/pressed state management.
 * @returns Ref and active state
 */
export function useActive(): [RefObject<HTMLDivElement | null>, boolean] {
  const [isActive, setIsActive] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const onMouseDown = () => setIsActive(true)
    const onMouseUp = () => setIsActive(false)
    const onMouseLeave = () => setIsActive(false)

    element.addEventListener('mousedown', onMouseDown)
    element.addEventListener('mouseup', onMouseUp)
    element.addEventListener('mouseleave', onMouseLeave)

    return () => {
      element.removeEventListener('mousedown', onMouseDown)
      element.removeEventListener('mouseup', onMouseUp)
      element.removeEventListener('mouseleave', onMouseLeave)
    }
  }, [])

  return [ref, isActive]
}

export interface ExpandedState {
  isExpanded: boolean
  toggle: () => void
  expand: () => void
  collapse: () => void
}

/**
 * Hook for accordion/expandable state management.
 * @param initialExpanded - Initial expanded state
 */
export function useExpanded(initialExpanded = false): ExpandedState {
  const [isExpanded, setIsExpanded] = useState(initialExpanded)

  const toggle = useCallback(() => {
    setIsExpanded((prev) => !prev)
  }, [])

  const expand = useCallback(() => {
    setIsExpanded(true)
  }, [])

  const collapse = useCallback(() => {
    setIsExpanded(false)
  }, [])

  return { isExpanded, toggle, expand, collapse }
}

export interface ModalState {
  isOpen: boolean
  open: () => void
  close: () => void
  toggle: () => void
}

/**
 * Hook for modal state management.
 * @param initialOpen - Initial open state
 */
export function useModal(initialOpen = false): ModalState {
  const [isOpen, setIsOpen] = useState(initialOpen)

  const open = useCallback(() => {
    setIsOpen(true)
  }, [])

  const close = useCallback(() => {
    setIsOpen(false)
  }, [])

  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev)
  }, [])

  return { isOpen, open, close, toggle }
}

/**
 * Hook for requestAnimationFrame loop.
 * @param callback - Function to call on each frame
 * @param enabled - Whether to run the loop
 */
export function useRAF(callback: (deltaTime: number) => void, enabled = true): void {
  const rafIdRef = useRef<number | null>(null)
  const previousTimeRef = useRef<number>(0)
  const callbackRef = useRef(callback)

  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  useEffect(() => {
    if (!enabled) return

    const animate = (timestamp: number) => {
      const deltaTime = timestamp - previousTimeRef.current
      previousTimeRef.current = timestamp
      callbackRef.current(deltaTime)
      rafIdRef.current = requestAnimationFrame(animate)
    }

    rafIdRef.current = requestAnimationFrame(animate)

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }
    }
  }, [enabled])
}

/**
 * Hook for idle detection.
 * @param timeout - Idle timeout in ms (default: 3000)
 * @returns Whether user is idle
 */
export function useIdle(timeout = 3000): boolean {
  const [isIdle, setIsIdle] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const resetTimer = useCallback(() => {
    setIsIdle(false)
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    timeoutRef.current = setTimeout(() => {
      setIsIdle(true)
    }, timeout)
  }, [timeout])

  useEffect(() => {
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart']

    const handleActivity = () => resetTimer()

    events.forEach((event) => {
      document.addEventListener(event, handleActivity, { passive: true })
    })

    resetTimer()

    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, handleActivity)
      })
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [resetTimer])

  return isIdle
}

export interface IntersectionOptions {
  threshold?: number | number[]
  root?: Element | null
  rootMargin?: string
}

/**
 * Hook for intersection observer - useful for lazy loading.
 * @param options - IntersectionObserver options
 * @returns Ref and intersection state
 */
export function useIntersection(
  options: IntersectionOptions = {}
): [RefObject<HTMLDivElement | null>, boolean] {
  const [isIntersecting, setIsIntersecting] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    observerRef.current = new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting)
    }, options)

    observerRef.current.observe(element)

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
        observerRef.current = null
      }
    }
  }, [options.threshold, options.root, options.rootMargin])

  return [ref, isIntersecting]
}

export interface ResizeObserverResult {
  width: number
  height: number
}

/**
 * Hook for resize observer - useful for responsive components.
 * @returns Ref and dimensions
 */
export function useResizeObserver(): [RefObject<HTMLDivElement | null>, ResizeObserverResult] {
  const [dimensions, setDimensions] = useState<ResizeObserverResult>({ width: 0, height: 0 })
  const ref = useRef<HTMLDivElement>(null)
  const observerRef = useRef<ResizeObserver | null>(null)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    observerRef.current = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      setDimensions({ width, height })
    })

    observerRef.current.observe(element)

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
        observerRef.current = null
      }
    }
  }, [])

  return [ref, dimensions]
}

/**
 * Hook for anime.js animations.
 * @param target - CSS selector or DOM element
 * @param animation - Animation config
 * @param dependencies - Dependencies to trigger re-animation
 */
export function useAnimate(
  target: string | Element | null,
  animation: Record<string, unknown>,
  dependencies: unknown[] = []
): void {
  useEffect(() => {
    if (!target) return

    animate(target, animation as any)
  }, [target, ...dependencies])
}

/**
 * Hook for enter/exit animations using anime.js.
 * @param isVisible - Whether the element should be visible
 * @param enterAnimation - Animation config for enter
 * @param exitAnimation - Animation config for exit
 * @returns Ref to attach to the animated element
 */
export function useAnimatePresence(
  isVisible: boolean,
  enterAnimation: Record<string, unknown>,
  exitAnimation: Record<string, unknown>
): RefObject<HTMLDivElement | null> {
  const targetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = targetRef.current
    if (!element) return

    if (isVisible) {
      animate(element, enterAnimation as any)
    } else {
      animate(element, {
        ...exitAnimation,
        complete: () => {
          if (!isVisible) {
            element.style.display = 'none'
          }
        },
      })
    }
  }, [isVisible, enterAnimation, exitAnimation])

  return targetRef
}

/**
 * Hook for animated counters with easing.
 * @param targetValue - Target number to animate to
 * @param duration - Animation duration in ms
 * @returns Current animated value
 */
export function useCounter(targetValue: number, duration = 1000): number {
  const [current, setCurrent] = useState(0)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const startValue = current
    const startTime = performance.now()

    const animate = (timestamp: number) => {
      const elapsed = timestamp - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      const value = startValue + (targetValue - startValue) * eased
      setCurrent(value)

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate)
      }
    }

    rafRef.current = requestAnimationFrame(animate)

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [targetValue, duration])

  return current
}

export interface TimerState {
  time: number
  isRunning: boolean
  start: () => void
  pause: () => void
  reset: () => void
  setTime: (time: number) => void
}

/**
 * Hook for countdown/up timers.
 * @param initialTime - Initial time in seconds
 * @param mode - 'countdown' or 'countup'
 * @param autoStart - Whether to start automatically
 */
export function useTimer(
  initialTime = 0,
  mode: 'countdown' | 'countup' = 'countup',
  autoStart = false
): TimerState {
  const [time, setTime] = useState(initialTime)
  const [isRunning, setIsRunning] = useState(autoStart)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!isRunning) return

    intervalRef.current = setInterval(() => {
      setTime((prev) => {
        if (mode === 'countdown') {
          return prev > 0 ? prev - 1 : 0
        }
        return prev + 1
      })
    }, 1000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [isRunning, mode])

  const start = useCallback(() => {
    setIsRunning(true)
  }, [])

  const pause = useCallback(() => {
    setIsRunning(false)
  }, [])

  const reset = useCallback(() => {
    setTime(initialTime)
    setIsRunning(false)
  }, [initialTime])

  const setTimeValue = useCallback((value: number) => {
    setTime(Math.max(0, value))
  }, [])

  return { time, isRunning, start, pause, reset, setTime: setTimeValue }
}

type StorageValue<T> = T | null

/**
 * Hook for persisted state in localStorage.
 * @param key - localStorage key
 * @param initialValue - Initial value if nothing stored
 * @returns Stored value and setter
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  const [storedValue, setStoredValue] = useState<StorageValue<T>>(() => {
    if (typeof window === 'undefined') return initialValue
    try {
      const item = window.localStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch {
      return initialValue
    }
  })

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      try {
        const valueToStore = value instanceof Function ? value(storedValue as T) : value
        setStoredValue(valueToStore)
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(key, JSON.stringify(valueToStore))
        }
      } catch (error) {
        console.error('Error saving to localStorage:', error)
      }
    },
    [key, storedValue]
  )

  const removeValue = useCallback(() => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(key)
      }
      setStoredValue(initialValue)
    } catch (error) {
      console.error('Error removing from localStorage:', error)
    }
  }, [key, initialValue])

  return [storedValue as T, setValue, removeValue]
}

/**
 * Hook to get the previous value of a value.
 * @param value - Current value
 * @returns Previous value
 */
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined)

  useEffect(() => {
    ref.current = value
  }, [value])

  return ref.current
}
