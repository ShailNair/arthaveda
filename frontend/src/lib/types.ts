export interface LotteryAlert {
  id: string
  symbol: string
  name: string
  price: number
  score: number
  time_horizon: string
  potential_gain_low: number
  potential_gain_high: number
  stop_loss_pct: number
  risk_level: 'Low' | 'Medium' | 'High'
  plain_reason: string
  technical_reasons: string[]
  how_to_buy_zerodha: string[]
  how_to_buy_groww: string[]
  signal_accuracy_pct: number
  category: string
  catalyst: string
  score_breakdown: {
    technical: number
    smart_money: number
    fundamental: number
    geopolitical: number
    sentiment_gap: number
  }
  // Trust score fields
  trust_score: number
  trust_label: string
  trust_color: string
  trust_reasons: string[]
  forensic_flags: string[]
  pchange_365d: number
  pchange_30d: number
  timestamp: string
}

export interface MacroRisk {
  risk_score: number
  label: string
  color: string
  advice: string
  sip_advice: string
  components: {
    vix:         { value: number | null; signal: string; pts: number }
    fii_flow:    { value: number | null; signal: string; pts: number }
    breadth:     { value: number | null; signal: string; pts: number }
    nifty_trend: { value: number | null; signal: string; pts: number }
  }
  timestamp: string
}

export interface GeoEvent {
  id: string
  headline: string
  source: string
  link: string
  event_type: string
  india_relevance: number
  severity: number
  affected_sectors: string[]
  affected_stocks: { symbol: string; name: string; sector: string }[]
  plain_explanation: string
  time_horizon: string
  opportunity_type: string
  sentiment: string
  timestamp: string
}

export interface MegaTrend {
  id: string
  title: string
  description: string
  plain_explanation: string
  trigger_events: string[]
  top_stocks: { symbol: string; name: string; why: string }[]
  top_funds: { name: string; category: string }[]
  time_horizon_years: string
  confidence: number
  suggested_approach: string
  category: string
}

export interface MarketOverview {
  nifty50: number
  nifty50_change: number
  sensex: number
  sensex_change: number
  nifty_bank: number
  nifty_bank_change: number
  market_regime: 'BULL' | 'BEAR' | 'SIDEWAYS'
  regime_confidence: number
  india_vix?: number
  fii_net?: number
  top_gainers: { symbol: string; change_pct: number; price: number }[]
  top_losers: { symbol: string; change_pct: number; price: number }[]
  timestamp: string
}

export interface MutualFund {
  scheme_code: string
  scheme_name: string
  fund_house: string
  category: string
  nav: number
  nav_date: string
  is_direct: boolean
  star_pick: boolean
  score?: number
  recommendation?: string
}

export interface SIPRecommendation {
  action: 'INCREASE' | 'MAINTAIN' | 'PAUSE' | 'SWITCH'
  amount_multiplier: number
  reason: string
  market_context: string
  historical_accuracy: string
}

export type WSMessage =
  | { type: 'CONNECTED'; message: string; market: MarketOverview; timestamp: string }
  | { type: 'MARKET_OVERVIEW'; data: MarketOverview }
  | { type: 'GEO_ALERT'; data: GeoEvent; message: string }
  | { type: 'LOTTERY_ALERT'; data: LotteryAlert[]; count: number; message: string }
  | { type: 'heartbeat'; ts: string }
  | { type: 'pong' }
