import { create } from 'zustand'
import {
  fetchComparisonFeatures,
  fetchLapFeatures,
  fetchOvertakesFeatures,
  fetchPointsFeatures,
  fetchPositionFeatures,
  fetchRaceContextFeatures,
  fetchTelemetryFeatures,
  fetchTrafficFeatures,
  fetchTyreFeatures
} from '../api/features'
import type {
  ComparisonFeature,
  LapFeature,
  OvertakeFeature,
  PointsFeature,
  PositionFeature,
  RaceContextFeature,
  TelemetryFeature,
  TrafficFeature,
  TyreFeature
} from '../types'

const FEATURE_KEYS = [
  'lap',
  'tyre',
  'telemetry',
  'comparison',
  'position',
  'raceContext',
  'traffic',
  'overtakes',
  'points'
] as const

type FeatureKey = typeof FEATURE_KEYS[number]

interface FeaturesState {
  lap: LapFeature[] | null
  tyre: TyreFeature[] | null
  telemetry: TelemetryFeature[] | null
  comparison: ComparisonFeature[] | null
  position: PositionFeature[] | null
  raceContext: RaceContextFeature[] | null
  traffic: TrafficFeature[] | null
  overtakes: OvertakeFeature[] | null
  points: PointsFeature[] | null
  loading: boolean
  loadedCount: number
  totalCount: number
  failedEndpoints: string[]
  loadFeatures: (year: number, race: string, session: string) => Promise<void>
  clear: () => void
}

export const useFeaturesStore = create<FeaturesState>((set) => ({
  lap: null,
  tyre: null,
  telemetry: null,
  comparison: null,
  position: null,
  raceContext: null,
  traffic: null,
  overtakes: null,
  points: null,
  loading: false,
  loadedCount: 0,
  totalCount: FEATURE_KEYS.length,
  failedEndpoints: [],

  loadFeatures: async (year, race, session) => {
    set({
      loading: true,
      loadedCount: 0,
      totalCount: FEATURE_KEYS.length,
      failedEndpoints: [],
      lap: null,
      tyre: null,
      telemetry: null,
      comparison: null,
      position: null,
      raceContext: null,
      traffic: null,
      overtakes: null,
      points: null
    })

    const failures: string[] = []
    const bump = () => set((state) => ({ loadedCount: state.loadedCount + 1 }))

    const tasks: Array<Promise<unknown>> = [
      fetchLapFeatures(year, race, session)
        .then((data) => set({ lap: data }))
        .catch(() => failures.push('lap'))
        .finally(bump),
      fetchTyreFeatures(year, race, session)
        .then((data) => set({ tyre: data }))
        .catch(() => failures.push('tyre'))
        .finally(bump),
      fetchTelemetryFeatures(year, race, session)
        .then((data) => set({ telemetry: data }))
        .catch(() => failures.push('telemetry'))
        .finally(bump),
      fetchComparisonFeatures(year, race, session)
        .then((data) => set({ comparison: data }))
        .catch(() => failures.push('comparison'))
        .finally(bump),
      fetchPositionFeatures(year, race, session)
        .then((data) => set({ position: data }))
        .catch(() => failures.push('position'))
        .finally(bump),
      fetchRaceContextFeatures(year, race, session)
        .then((data) => set({ raceContext: data }))
        .catch(() => failures.push('race-context'))
        .finally(bump),
      fetchTrafficFeatures(year, race, session)
        .then((data) => set({ traffic: data }))
        .catch(() => failures.push('traffic'))
        .finally(bump),
      fetchOvertakesFeatures(year, race, session)
        .then((data) => set({ overtakes: data }))
        .catch(() => failures.push('overtakes'))
        .finally(bump),
      fetchPointsFeatures(year, race, session)
        .then((data) => set({ points: data }))
        .catch(() => failures.push('points'))
        .finally(bump)
    ]

    await Promise.allSettled(tasks)
    set({ loading: false, failedEndpoints: failures })
  },

  clear: () =>
    set({
      lap: null,
      tyre: null,
      telemetry: null,
      comparison: null,
      position: null,
      raceContext: null,
      traffic: null,
      overtakes: null,
      points: null,
      loading: false,
      loadedCount: 0,
      totalCount: FEATURE_KEYS.length,
      failedEndpoints: []
    })
}))
