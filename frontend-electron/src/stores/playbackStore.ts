import { create } from 'zustand'

interface PlaybackState {
  currentTime: number
  setCurrentTime: (time: number) => void
}

export const usePlaybackStore = create<PlaybackState>((set) => ({
  // Mid-race default provides usable track marker separation until playback controls are added.
  currentTime: 3000,
  setCurrentTime: (time) => set({ currentTime: time })
}))
