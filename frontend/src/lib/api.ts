import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export async function fetchApi<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`);

  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`);
  }

  return response.json();
}

export const api = {
  seasons: {
    getAll: () => fetchApi<number[]>('/seasons'),
    getCurrent: () => fetchApi<number>('/seasons/current'),
  },
  races: {
    getAll: (season: number) => fetchApi<Race[]>(`/races/${season}`),
    getById: (raceId: string) => fetchApi<Race>(`/races/id/${raceId}`),
  },
  drivers: {
    getAll: (season: number) => fetchApi<Driver[]>(`/drivers/${season}`),
    getById: (driverId: string) => fetchApi<Driver>(`/drivers/id/${driverId}`),
  },
  telemetry: {
    getLapData: (year: number, race: string, driver: string, lap: number) =>
      fetchApi<TelemetryResponse>(`/telemetry/${year}/${race}/${driver}/laps/${lap}`),
  },
};

export interface TelemetryPoint {
  session_time_seconds: number;
  lap_time: number;
  distance: number;
  speed: number;
  rpm: number;
  throttle: number;
  brake: number;
  gear: number;
  drs: number;
}

export interface TelemetryResponse {
  driver: string;
  lap: number;
  data: TelemetryPoint[];
}

export interface Race {
  id: string;
  name: string;
  circuit: string;
  date: string;
  round: number;
}

export interface Driver {
  id: string;
  name: string;
  team: string;
  number: number;
  nationality: string;
}

export interface LapData {
  lap: number;
  time: number;
  sector1: number;
  sector2: number;
  sector3: number;
}

export interface SectorTimes {
  sector1: number[];
  sector2: number[];
  sector3: number[];
}
