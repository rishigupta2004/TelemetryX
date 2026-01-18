import { create } from 'zustand';
import type { SelectedSession, SessionData } from '@/types';

interface RaceStore {
  // Session Selection
  selectedSession: SelectedSession | null;
  setSelectedSession: (session: SelectedSession | null) => void;

  // Session Data
  sessionData: SessionData | null;
  setSessionData: (data: SessionData | null) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  loadError: string | null;
  setLoadError: (error: string | null) => void;

  // Playback State
  isPlaying: boolean;
  currentTime: number;
  playbackSpeed: number;
  duration: number;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  seek: (time: number) => void;
  setPlaybackSpeed: (speed: number) => void;
  setDuration: (duration: number) => void;

  // Driver Selection
  selectedDriver: string | null;
  setSelectedDriver: (driver: string | null) => void;

  // Active Tab
  activeTab: string;
  setActiveTab: (tab: string) => void;

  // Telemetry Window (seconds)
  telemetryWindow: number;
  setTelemetryWindow: (window: number) => void;

  // Driver Filter
  filteredDrivers: string[];
  setFilteredDrivers: (drivers: string[]) => void;
}

export const useRaceStore = create<RaceStore>((set, get) => ({
  // Session Selection
  selectedSession: null,
  setSelectedSession: (session) => set({ selectedSession: session }),

  // Session Data
  sessionData: null,
  setSessionData: (data) => set({ sessionData: data }),
  isLoading: false,
  setIsLoading: (loading) => set({ isLoading: loading }),
  loadError: null,
  setLoadError: (error) => set({ loadError: error }),

  // Playback State
  isPlaying: false,
  currentTime: 0,
  playbackSpeed: 1,
  duration: 0,
  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
  seek: (time) => {
    const { duration } = get();
    const clampedTime = Math.max(0, Math.min(time, duration));
    set({ currentTime: clampedTime });
  },
  setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),
  setDuration: (duration) => set({ duration }),

  // Driver Selection
  selectedDriver: null,
  setSelectedDriver: (driver) => set({ selectedDriver: driver }),

  // Active Tab
  activeTab: 'telemetry',
  setActiveTab: (tab) => set({ activeTab: tab }),

  // Telemetry Window
  telemetryWindow: 10,
  setTelemetryWindow: (window) => set({ telemetryWindow: window }),

  // Driver Filter
  filteredDrivers: [],
  setFilteredDrivers: (drivers) => set({ filteredDrivers: drivers }),
}));

// Selectors
export const selectDrivers = (state: RaceStore) => state.sessionData?.drivers || [];
export const selectLaps = (state: RaceStore) => state.sessionData?.laps || [];
export const selectTelemetry = (state: RaceStore) => state.sessionData?.telemetry || [];
export const selectCurrentLaps = (state: RaceStore) => {
  const { sessionData } = state;
  if (!sessionData) return [];
  
  // Get current laps based on time - simplified version
  return sessionData.laps.filter(() => {
    // This is a placeholder - actual implementation needs lap timing data
    return true;
  });
};
