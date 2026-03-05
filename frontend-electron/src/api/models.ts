import { get, post } from './client'
import type {
  ClusterResult,
  StrategyRecommendationsResponse,
  UndercutPredictRequest,
  UndercutPredictResponse
} from '../types'
import { slugifyRace } from './sessions'

export async function fetchClustering(): Promise<ClusterResult[]> {
  const res = await get<{ clusters: ClusterResult[] }>(`/models/clustering`)
  return res.clusters ?? []
}

export async function fetchStrategyRecommendations(year: number, race: string): Promise<StrategyRecommendationsResponse> {
  const slug = slugifyRace(race)
  return get<StrategyRecommendationsResponse>(`/models/strategy-recommendations/${year}/${encodeURIComponent(slug)}`)
}

export async function postUndercutPredict(payload: UndercutPredictRequest): Promise<UndercutPredictResponse> {
  return post<UndercutPredictResponse>(`/models/undercut/predict`, payload)
}
