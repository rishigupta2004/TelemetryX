import { create } from 'zustand'
import { fetchClustering, fetchStrategyRecommendations, postUndercutPredict } from '../api/models'
import type { ClusterResult, StrategyRecommendationsResponse, UndercutPredictRequest, UndercutPredictResponse } from '../types'

interface MLState {
  clustering: ClusterResult[] | null
  undercut: UndercutPredictResponse | null
  strategyRecs: StrategyRecommendationsResponse | null
  loading: boolean
  failedEndpoints: string[]
  preloadML: (year: number, race: string) => Promise<void>
  predictUndercut: (payload: UndercutPredictRequest) => Promise<void>
  clear: () => void
}

export const useMLStore = create<MLState>((set) => ({
  clustering: null,
  undercut: null,
  strategyRecs: null,
  loading: false,
  failedEndpoints: [],

  preloadML: async (year, race) => {
    set({ loading: true, failedEndpoints: [], clustering: null, strategyRecs: null })
    const failures: string[] = []

    await Promise.allSettled([
      fetchClustering()
        .then((data) => set({ clustering: data }))
        .catch(() => failures.push('clustering')),
      fetchStrategyRecommendations(year, race)
        .then((data) => set({ strategyRecs: data }))
        .catch(() => failures.push('strategy-recs'))
    ])

    set({ loading: false, failedEndpoints: failures })
  },

  predictUndercut: async (payload) => {
    set({ loading: true })
    try {
      const result = await postUndercutPredict(payload)
      set({ undercut: result, loading: false })
    } catch {
      set((state) => ({ loading: false, failedEndpoints: [...state.failedEndpoints, 'undercut'] }))
    }
  },

  clear: () => set({ clustering: null, undercut: null, strategyRecs: null, loading: false, failedEndpoints: [] })
}))
