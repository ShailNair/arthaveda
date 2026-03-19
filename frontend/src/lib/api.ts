const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { next: { revalidate: 60 } })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

export const api = {
  market: {
    overview: () => get<any>('/api/market/overview'),
    stock: (sym: string, period = '6mo') => get<any>(`/api/market/stock/${sym}?period=${period}`),
    bulkDeals: () => get<any>('/api/market/bulk-deals'),
    breakouts: () => get<any>('/api/market/breakouts'),
    macroRisk: () => get<any>('/api/market/macro-risk'),
  },
  alerts: {
    lottery: () => get<any>('/api/alerts/signals'),
    top: () => get<any>('/api/alerts/signals/top'),
    scoreStock: (sym: string) => get<any>(`/api/alerts/stock/${sym}`),
    refresh: () => fetch(`${API}/api/alerts/refresh`, { method: 'POST' }).then(r => r.json()),
  },
  geo: {
    events: (limit = 20) => get<any>(`/api/geo/events?limit=${limit}`),
    highImpact: () => get<any>('/api/geo/high-impact'),
    megaTrends: () => get<any>('/api/geo/mega-trends'),
    refresh: () => fetch(`${API}/api/geo/refresh`, { method: 'POST' }).then(r => r.json()),
  },
  funds: {
    top: (category?: string) => get<any>(`/api/funds/top${category ? `?category=${category}` : ''}`),
    sipAdvice: () => get<any>('/api/funds/sip-advice'),
    categories: () => get<any>('/api/funds/categories'),
    search: (q: string) => get<any>(`/api/funds/search?q=${encodeURIComponent(q)}`),
  },
  predictions: {
    get: () => get<any>('/api/predictions/'),
  },
  analytics: {
    features:   (sym: string) => get<any>(`/api/analytics/features/${sym}`),
    modelScore: (sym: string) => get<any>(`/api/analytics/model-score/${sym}`),
    backtest:   (symbols?: string, force = false) => get<any>(`/api/analytics/backtest?${symbols ? `symbols=${symbols}&` : ''}${force ? 'force=true' : ''}`),
  },
}
