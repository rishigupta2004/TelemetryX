import { useEffect, useRef, useCallback } from 'react'

const FLIP_CSS = `
  @keyframes f1FlipIn {
    0% { transform: scaleY(0.2); opacity: 0.3; }
    100% { transform: scaleY(1); opacity: 1; }
  }
  .f1-flip { animation: f1FlipIn 300ms ease-out forwards; will-change: transform, opacity; }
`

let cssInjected = false
function injectFlipCSS() {
  if (cssInjected) return
  cssInjected = true
  if (typeof document !== 'undefined') {
    const style = document.createElement('style')
    style.textContent = FLIP_CSS
    document.head.appendChild(style)
  }
}

export function useF1Flip<T>(value: T) {
  const ref = useRef<HTMLSpanElement>(null)
  const prevValue = useRef(value)
  const animationRef = useRef<number | null>(null)

  useEffect(() => {
    injectFlipCSS()
  }, [])

  useEffect(() => {
    if (value != null && prevValue.current !== value) {
      const el = ref.current
      if (el) {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current)
        }
        el.classList.remove('f1-flip')
        void el.offsetWidth
        el.classList.add('f1-flip')
        animationRef.current = requestAnimationFrame(() => {
          animationRef.current = null
        })
      }
      prevValue.current = value
    }
  }, [value])

  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [])

  return ref
}
