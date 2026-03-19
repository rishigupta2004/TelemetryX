import { create } from 'zustand'
import type { Driver } from '../types'

export interface SelectedDriver {
  driverCode: string
  driverNumber: number
  teamColor: string
  driverName: string
  lapNumber: number
}

interface MultiDriverState {
  selectedDrivers: SelectedDriver[]
  maxDrivers: number
  availableDrivers: Driver[]
  setAvailableDrivers: (drivers: Driver[]) => void
  addDriver: (driver: Driver, lapNumber?: number) => void
  removeDriver: (driverCode: string) => void
  updateDriverLap: (driverCode: string, lapNumber: number) => void
  clearDrivers: () => void
  isDriverSelected: (driverCode: string) => boolean
  getDriverSelection: (driverCode: string) => SelectedDriver | undefined
}

export const useMultiDriverStore = create<MultiDriverState>((set, get) => ({
  selectedDrivers: [],
  maxDrivers: 4,
  availableDrivers: [],

  setAvailableDrivers: (drivers) => set({ availableDrivers: drivers }),

  addDriver: (driver, lapNumber = 1) => {
    const { selectedDrivers, maxDrivers, isDriverSelected } = get()
    if (isDriverSelected(driver.code)) return
    if (selectedDrivers.length >= maxDrivers) return
    
    const newDriver: SelectedDriver = {
      driverCode: driver.code,
      driverNumber: driver.driverNumber,
      teamColor: driver.teamColor,
      driverName: driver.driverName,
      lapNumber,
    }
    set({ selectedDrivers: [...selectedDrivers, newDriver] })
  },

  removeDriver: (driverCode) => {
    set((state) => ({
      selectedDrivers: state.selectedDrivers.filter((d) => d.driverCode !== driverCode),
    }))
  },

  updateDriverLap: (driverCode, lapNumber) => {
    set((state) => ({
      selectedDrivers: state.selectedDrivers.map((d) =>
        d.driverCode === driverCode ? { ...d, lapNumber } : d
      ),
    }))
  },

  clearDrivers: () => set({ selectedDrivers: [] }),

  isDriverSelected: (driverCode) => {
    return get().selectedDrivers.some((d) => d.driverCode === driverCode)
  },

  getDriverSelection: (driverCode) => {
    return get().selectedDrivers.find((d) => d.driverCode === driverCode)
  },
}))
