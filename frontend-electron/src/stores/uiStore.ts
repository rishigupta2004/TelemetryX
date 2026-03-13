import { create } from 'zustand'

export type AppView = 'timing' | 'telemetry' | 'strategy' | 'track' | 'features' | 'analytics' | 'standings' | 'profiles' | 'fia_documents' | 'compare'

interface UIState {
  activeView: AppView
  sidebarCollapsed: boolean
  primaryDriver: string | null
  compareDriver: string | null
  setActiveView: (view: AppView) => void
  setSidebarCollapsed: (collapsed: boolean) => void
  toggleSidebar: () => void
  selectPrimary: (driverCode: string | null) => void
  selectCompare: (driverCode: string | null) => void
  clearSelection: () => void
}

export const useUIStore = create<UIState>((set) => ({
  activeView: 'timing', sidebarCollapsed: false, primaryDriver: null, compareDriver: null,

  setActiveView: (view) => set({ activeView: view }),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  selectPrimary: (driverCode) => set((s) => {
    if (!driverCode) return { primaryDriver: null }
    if (s.compareDriver === driverCode) return { primaryDriver: driverCode, compareDriver: null }
    return { primaryDriver: driverCode }
  }),

  selectCompare: (driverCode) => set((s) => {
    if (!driverCode) return { compareDriver: null }
    if (s.primaryDriver === driverCode) return s
    return { compareDriver: driverCode }
  }),

  clearSelection: () => set({ primaryDriver: null, compareDriver: null })
}))
