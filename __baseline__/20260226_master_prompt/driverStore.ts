import { create } from 'zustand'

interface DriverState {
  primaryDriver: string | null
  compareDriver: string | null
  selectPrimary: (driverCode: string | null) => void
  selectCompare: (driverCode: string | null) => void
  clearSelection: () => void
}

export const useDriverStore = create<DriverState>((set) => ({
  primaryDriver: null,
  compareDriver: null,

  selectPrimary: (driverCode) =>
    set((state) => {
      if (!driverCode) return { primaryDriver: null }
      if (state.compareDriver === driverCode) {
        return { primaryDriver: driverCode, compareDriver: null }
      }
      return { primaryDriver: driverCode }
    }),

  selectCompare: (driverCode) =>
    set((state) => {
      if (!driverCode) return { compareDriver: null }
      if (state.primaryDriver === driverCode) return state
      return { compareDriver: driverCode }
    }),

  clearSelection: () => set({ primaryDriver: null, compareDriver: null })
}))
