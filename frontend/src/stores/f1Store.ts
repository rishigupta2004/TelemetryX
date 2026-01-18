import { create } from 'zustand';

interface Race {
  id: string;
  name: string;
  circuit: string;
  date: string;
  round: number;
}

interface Driver {
  id: string;
  name: string;
  team: string;
  number: number;
  nationality: string;
}

interface F1Store {
  selectedSeason: number;
  selectedRaceId: string | null;
  selectedDriverId: string | null;
  races: Race[];
  drivers: Driver[];
  setSelectedSeason: (season: number) => void;
  setSelectedRaceId: (raceId: string | null) => void;
  setSelectedDriverId: (driverId: string | null) => void;
  setRaces: (races: Race[]) => void;
  setDrivers: (drivers: Driver[]) => void;
}

export const useF1Store = create<F1Store>((set) => ({
  selectedSeason: new Date().getFullYear(),
  selectedRaceId: null,
  selectedDriverId: null,
  races: [],
  drivers: [],
  setSelectedSeason: (season) => set({ selectedSeason: season }),
  setSelectedRaceId: (raceId) => set({ selectedRaceId: raceId }),
  setSelectedDriverId: (driverId) => set({ selectedDriverId: driverId }),
  setRaces: (races) => set({ races }),
  setDrivers: (drivers) => set({ drivers }),
}));
