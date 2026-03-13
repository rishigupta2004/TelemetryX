export interface LRUCacheOptions<T> {
  maxSize: number
  onEvict?: (key: string, value: T) => void
}

export class LRUCache<T> {
  private cache = new Map<string, T>()
  private maxSize: number
  private onEvict?: (key: string, value: T) => void

  constructor(options: LRUCacheOptions<T>) {
    this.maxSize = options.maxSize
    this.onEvict = options.onEvict
  }

  get(key: string): T | undefined {
    if (!this.cache.has(key)) return undefined
    
    const value = this.cache.get(key)!
    this.cache.delete(key)
    this.cache.set(key, value)
    
    return value
  }

  set(key: string, value: T): void {
    if (this.cache.has(key)) {
      this.cache.delete(key)
    } else if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value
      if (firstKey !== undefined) {
        const evicted = this.cache.get(firstKey)
        this.cache.delete(firstKey)
        if (evicted && this.onEvict) {
          this.onEvict(firstKey, evicted)
        }
      }
    }
    this.cache.set(key, value)
  }

  has(key: string): boolean {
    return this.cache.has(key)
  }

  delete(key: string): boolean {
    return this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }

  get size(): number {
    return this.cache.size
  }

  keys(): string[] {
    return Array.from(this.cache.keys())
  }
}

export function createBoundedCache<T>(maxSize: number, onEvict?: (key: string, value: T) => void): LRUCache<T> {
  return new LRUCache({ maxSize, onEvict })
}

const CACHE_REGISTRY: Set<LRUCache<any>> = new Set()

export function registerCache<T>(cache: LRUCache<T>): void {
  CACHE_REGISTRY.add(cache)
}

export function clearAllCaches(): void {
  for (const cache of CACHE_REGISTRY) {
    cache.clear()
  }
}

export function getCacheStats(): { totalCaches: number, totalEntries: number } {
  let totalEntries = 0
  for (const cache of CACHE_REGISTRY) {
    totalEntries += cache.size
  }
  return { totalCaches: CACHE_REGISTRY.size, totalEntries }
}
