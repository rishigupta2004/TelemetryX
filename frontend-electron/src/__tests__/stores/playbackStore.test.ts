import { describe, it, expect, beforeEach, vi, beforeAll } from 'vitest'
import { usePlaybackStore } from '../../stores/playbackStore'

// Polyfill requestAnimationFrame / cancelAnimationFrame for Node
beforeAll(() => {
    if (typeof globalThis.requestAnimationFrame === 'undefined') {
        globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(cb, 16) as unknown as number
        globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id)
    }
})

describe('playbackStore', () => {
    beforeEach(() => {
        usePlaybackStore.getState().reset()
    })

    it('starts with default state', () => {
        const state = usePlaybackStore.getState()
        expect(state.currentTime).toBe(0)
        expect(state.isPlaying).toBe(false)
        expect(state.speed).toBe(1)
        expect(state.duration).toBe(0)
        expect(state.sessionStartTime).toBe(0)
        expect(state.externalClock).toBe(false)
    })

    it('does not play when duration is 0', () => {
        usePlaybackStore.getState().play()
        expect(usePlaybackStore.getState().isPlaying).toBe(false)
    })

    it('plays and pauses when duration > 0', () => {
        usePlaybackStore.getState().setDuration(100, 0)
        usePlaybackStore.getState().play()
        expect(usePlaybackStore.getState().isPlaying).toBe(true)

        usePlaybackStore.getState().pause()
        expect(usePlaybackStore.getState().isPlaying).toBe(false)
    })

    it('togglePlay toggles between play and pause', () => {
        usePlaybackStore.getState().setDuration(100, 0)
        usePlaybackStore.getState().togglePlay()
        expect(usePlaybackStore.getState().isPlaying).toBe(true)

        usePlaybackStore.getState().togglePlay()
        expect(usePlaybackStore.getState().isPlaying).toBe(false)
    })

    it('seek clamps to [0, duration]', () => {
        usePlaybackStore.getState().setDuration(100, 0)

        usePlaybackStore.getState().seek(-10)
        expect(usePlaybackStore.getState().currentTime).toBe(0)

        usePlaybackStore.getState().seek(999)
        expect(usePlaybackStore.getState().currentTime).toBe(100)

        usePlaybackStore.getState().seek(50)
        expect(usePlaybackStore.getState().currentTime).toBe(50)
    })

    it('setCurrentTime clamps to [0, duration]', () => {
        usePlaybackStore.getState().setDuration(60, 0)

        usePlaybackStore.getState().setCurrentTime(30)
        expect(usePlaybackStore.getState().currentTime).toBe(30)

        usePlaybackStore.getState().setCurrentTime(-5)
        expect(usePlaybackStore.getState().currentTime).toBe(0)

        usePlaybackStore.getState().setCurrentTime(200)
        expect(usePlaybackStore.getState().currentTime).toBe(60)
    })

    it('setSpeed updates speed', () => {
        usePlaybackStore.getState().setSpeed(4)
        expect(usePlaybackStore.getState().speed).toBe(4)
    })

    it('setDuration resets currentTime and stops playback', () => {
        usePlaybackStore.getState().setDuration(100, 0)
        usePlaybackStore.getState().seek(50)
        usePlaybackStore.getState().setDuration(200, 10)

        expect(usePlaybackStore.getState().currentTime).toBe(0)
        expect(usePlaybackStore.getState().duration).toBe(200)
        expect(usePlaybackStore.getState().sessionStartTime).toBe(10)
        expect(usePlaybackStore.getState().isPlaying).toBe(false)
    })

    it('setExternalClock enables external clock mode', () => {
        usePlaybackStore.getState().setExternalClock(true)
        expect(usePlaybackStore.getState().externalClock).toBe(true)

        // In external clock mode, play sets isPlaying but uses external time source
        usePlaybackStore.getState().setDuration(100, 0)
        usePlaybackStore.getState().play()
        expect(usePlaybackStore.getState().isPlaying).toBe(true)
    })

    it('reset clears all state', () => {
        usePlaybackStore.getState().setDuration(100, 10)
        usePlaybackStore.getState().seek(50)
        usePlaybackStore.getState().setSpeed(8)
        usePlaybackStore.getState().reset()

        const state = usePlaybackStore.getState()
        expect(state.currentTime).toBe(0)
        expect(state.isPlaying).toBe(false)
        expect(state.speed).toBe(1)
        expect(state.duration).toBe(0)
        expect(state.sessionStartTime).toBe(0)
    })

    it('togglePlay rewinds when at end of playback', () => {
        usePlaybackStore.getState().setDuration(100, 0)
        usePlaybackStore.getState().seek(100)
        expect(usePlaybackStore.getState().currentTime).toBe(100)

        usePlaybackStore.getState().togglePlay()
        expect(usePlaybackStore.getState().currentTime).toBe(0)
        expect(usePlaybackStore.getState().isPlaying).toBe(true)
    })
})
