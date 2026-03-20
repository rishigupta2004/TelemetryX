import type { ReactNode } from 'react'
import React, { useRef, useEffect } from 'react'
import { animate } from 'animejs'

interface FadeInPanelProps {
  children: ReactNode
  delay?: number
  className?: string
  duration?: number
}

export const FadeInPanel = React.memo(function FadeInPanel({
  children,
  delay = 0,
  className = '',
  duration = 400
}: FadeInPanelProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (ref.current) {
      animate(ref.current, {
        opacity: [0, 1],
        translateY: [12, 0],
        duration,
        delay,
        easing: 'easeOutCubic'
      })
    }
  }, [delay, duration])

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
})

interface StaggerPanelProps {
  children: ReactNode
  className?: string
  staggerDelay?: number
  baseDelay?: number
}

export const StaggerPanel = React.memo(function StaggerPanel({
  children,
  className = '',
  staggerDelay = 50,
  baseDelay = 0
}: StaggerPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const childrenArray = React.Children.toArray(children)

  useEffect(() => {
    if (!containerRef.current) return
    
    const childElements = containerRef.current.children
    if (childElements.length === 0) return

    Array.from(childElements).forEach((el, i) => {
      animate(el as HTMLElement, {
        opacity: [0, 1],
        translateY: [10, 0],
        duration: 350,
        delay: baseDelay + i * staggerDelay,
        easing: 'easeOutCubic'
      })
    })
  }, [staggerDelay, baseDelay])

  return (
    <div ref={containerRef} className={className}>
      {childrenArray.map((child, i) => (
        <div key={i} style={{ opacity: 0 }}>
          {child}
        </div>
      ))}
    </div>
  )
})
