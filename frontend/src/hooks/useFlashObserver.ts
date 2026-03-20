import { useEffect, useRef } from 'react'

const FLASH_CSS = `
  @keyframes flashPulse {
    0% { background-color: var(--flash-color); color: #ffffff; }
    100% { background-color: transparent; color: inherit; }
  }
  .flash-active {
    animation: flashPulse 800ms ease-out forwards;
    will-change: background-color, color;
  }
`

let cssInjected = false
function injectFlashCSS() {
  if (cssInjected) return
  cssInjected = true
  if (typeof document !== 'undefined') {
    const style = document.createElement('style')
    style.textContent = FLASH_CSS
    document.head.appendChild(style)
  }
}

export function useFlashObserver<T>(
    value: T,
    condition: boolean,
    flashColor: string = '#B138FF',
    duration: number = 800
) {
    const ref = useRef<HTMLDivElement>(null)
    const prevValue = useRef(value)

    useEffect(() => {
      injectFlashCSS()
    }, [])

    useEffect(() => {
        if (value != null && prevValue.current !== value) {
            const el = ref.current
            if (condition && el) {
                el.style.setProperty('--flash-color', flashColor)
                el.classList.remove('flash-active')
                void el.offsetWidth
                el.classList.add('flash-active')
            }
            prevValue.current = value
        }
    }, [value, condition, flashColor])

    return ref
}
