import { create } from 'zustand'

type ProfileMode = 'drivers' | 'teams'

interface ProfileState {
  mode: ProfileMode
  driverName: string | null
  teamName: string | null
  openDriver: (name: string) => void
  openTeam: (name: string) => void
  clearIntent: () => void
}

export const useProfileStore = create<ProfileState>((set) => ({
  mode: 'drivers',
  driverName: null,
  teamName: null,
  openDriver: (name) => set({ mode: 'drivers', driverName: name, teamName: null }),
  openTeam: (name) => set({ mode: 'teams', teamName: name, driverName: null }),
  clearIntent: () => set({ driverName: null, teamName: null })
}))
