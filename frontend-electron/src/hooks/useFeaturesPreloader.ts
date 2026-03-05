import { useCallback, useMemo } from 'react'
import { useFeaturesStore } from '../stores/featuresStore'
import { useMLStore } from '../stores/mlStore'

export function useFeaturesPreloader() {
  const featuresLoading = useFeaturesStore((s) => s.loading)
  const loadedCount = useFeaturesStore((s) => s.loadedCount)
  const totalCount = useFeaturesStore((s) => s.totalCount)
  const featureFailures = useFeaturesStore((s) => s.failedEndpoints)
  const loadFeatures = useFeaturesStore((s) => s.loadFeatures)

  const mlLoading = useMLStore((s) => s.loading)
  const mlFailures = useMLStore((s) => s.failedEndpoints)
  const preloadML = useMLStore((s) => s.preloadML)

  const preload = useCallback(
    async (year: number, race: string, session: string) => {
      await Promise.allSettled([
        loadFeatures(year, race, session),
        preloadML(year, race)
      ])
    },
    [loadFeatures, preloadML]
  )

  const ready = !featuresLoading && !mlLoading && loadedCount >= totalCount
  const progress = totalCount > 0 ? Math.min(1, loadedCount / totalCount) : 0
  const failedEndpoints = useMemo(() => [...featureFailures, ...mlFailures], [featureFailures, mlFailures])

  return { ready, progress, failedEndpoints, preload, loadedCount, totalCount }
}
