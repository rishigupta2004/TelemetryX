import { useEffect, useRef } from 'react'
import { animate } from 'animejs'

export function useFlashObserver<T>(
    value: T,
    condition: boolean,
    flashColor: string = '#B138FF',
    duration: number = 800
) {
    const ref = useRef<any>(null)
    const prevValue = useRef(value)

    useEffect(() => {
        if (value != null && prevValue.current !== value) {
            if (condition && ref.current) {
                animate(ref.current, {
                    backgroundColor: [flashColor, ''],
                    color: ['#FFFFFF', ''],
                    duration,
                    ease: 'outExpo',
                })
            }
            prevValue.current = value
        }
    }, [value, condition, flashColor, duration])

    return ref
}
