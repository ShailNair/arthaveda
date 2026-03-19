from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class StockQuote(BaseModel):
    symbol: str
    name: str
    price: float
    change: float
    change_pct: float
    volume: int
    avg_volume: int
    delivery_pct: Optional[float] = None
    market_cap: Optional[float] = None
    sector: Optional[str] = None


class LotteryAlert(BaseModel):
    id: str
    symbol: str
    name: str
    price: float
    score: int
    time_horizon: str
    potential_gain_low: float
    potential_gain_high: float
    stop_loss_pct: float
    risk_level: str  # Low / Medium / High
    plain_reason: str
    technical_reasons: List[str]
    how_to_buy_zerodha: List[str]
    how_to_buy_groww: List[str]
    signal_accuracy_pct: float
    category: str  # swing / event / trend
    catalyst: Optional[str] = None
    timestamp: datetime = None

    def __init__(self, **data):
        if not data.get("timestamp"):
            data["timestamp"] = datetime.now()
        super().__init__(**data)


class GeoEvent(BaseModel):
    id: str
    headline: str
    source: str
    event_type: str  # conflict/trade/energy/policy/climate/sanctions
    india_relevance: int  # 1-10
    severity: int  # 1-10
    affected_sectors: List[str]
    affected_stocks: List[dict]
    plain_explanation: str
    time_horizon: str  # days/weeks/months/years
    opportunity_type: str  # spike / structural
    timestamp: datetime = None

    def __init__(self, **data):
        if not data.get("timestamp"):
            data["timestamp"] = datetime.now()
        super().__init__(**data)


class MegaTrend(BaseModel):
    id: str
    title: str
    description: str
    plain_explanation: str
    trigger_events: List[str]
    top_stocks: List[dict]
    top_funds: List[dict]
    time_horizon_years: str
    confidence: int
    suggested_approach: str
    category: str


class MutualFund(BaseModel):
    scheme_code: str
    scheme_name: str
    nav: float
    nav_date: str
    category: str
    fund_house: str
    score: Optional[int] = None
    recommendation: Optional[str] = None
    reason: Optional[str] = None


class SIPRecommendation(BaseModel):
    action: str  # increase / maintain / pause / switch
    amount_multiplier: float
    reason: str
    market_context: str
    historical_accuracy: str


class MarketOverview(BaseModel):
    nifty50: float
    nifty50_change: float
    sensex: float
    sensex_change: float
    nifty_bank: float
    nifty_bank_change: float
    market_regime: str  # BULL / BEAR / SIDEWAYS
    regime_confidence: int
    fii_net: Optional[float] = None
    dii_net: Optional[float] = None
    india_vix: Optional[float] = None
    top_gainers: List[dict] = []
    top_losers: List[dict] = []
    timestamp: datetime = None

    def __init__(self, **data):
        if not data.get("timestamp"):
            data["timestamp"] = datetime.now()
        super().__init__(**data)


class WatchlistItem(BaseModel):
    symbol: str
    name: str
    added_price: float
    current_price: float
    change_pct: float
    lottery_score: int
    alert_on_score: int = 70
