import { useState, useEffect, useRef, RefObject } from 'react'

export interface ViewportState {
  width: number
  height: number
}

export interface UseViewportResult {
  viewport: ViewportState
  containerRef: RefObject<HTMLDivElement | null>
}

export const useTrackViewport = (enabled = true): UseViewportResult => {
  const [viewport, setViewport] = useState({ width: 1000, height: 620 })
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!enabled) return
    
    const el = containerRef.current
    if (!el) return

    const update = () => {
      const rect = el.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        setViewport({ width: Math.floor(rect.width), height: Math.floor(rect.height) })
      }
    }

    update()
    // Warm-up remeasurements to avoid stale initial layout sizes after tab/view transitions.
    const raf1 = requestAnimationFrame(update)
    const t1 = window.setTimeout(update, 80)
    const t2 = window.setTimeout(update, 220)
    const observer = new ResizeObserver(update)
    observer.observe(el)
    window.addEventListener('resize', update)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', update)
      cancelAnimationFrame(raf1)
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [enabled])

  return { viewport, containerRef }
}
