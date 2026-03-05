import { useEffect, useRef } from 'react'
import { animate } from 'animejs'

export function useF1Flip<T>(value: T) {
    const ref = useRef<any>(null)
    const prevValue = useRef(value)

    useEffect(() => {
        if (value != null && prevValue.current !== value) {
            if (ref.current) {
                // Fast, mechanical "flip" effect
                animate(ref.current, {
                    scaleY: [0.2, 1],
                    opacity: [0.3, 1],
                    duration: 300,
                    ease: 'outSine',
                })
            }
            prevValue.current = value
        }
    }, [value])

    return ref
}
