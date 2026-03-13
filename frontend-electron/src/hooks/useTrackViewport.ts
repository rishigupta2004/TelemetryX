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
    const observer = new ResizeObserver(update)
    observer.observe(el)

    return () => observer.disconnect()
  }, [enabled])

  return { viewport, containerRef }
}
