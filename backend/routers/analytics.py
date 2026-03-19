"""
Analytics API Router
Exposes feature engineering, ML scoring, and backtesting endpoints.
"""
import asyncio
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Query

router   = APIRouter(prefix="/api/analytics", tags=["analytics"])
executor = ThreadPoolExecutor(max_workers=2)

# 6-hour backtest cache (expensive to compute)
_backtest_cache: Optional[dict] = None
_backtest_ts: Optional[datetime] = None
BACKTEST_TTL_HOURS = 6


async def _run(func, *args):
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(executor, func, *args)


def _normalize(symbol: str) -> str:
    return symbol.upper().replace(".NS", "")


def _get_features_sync(symbol: str) -> dict:
    from services.historical_data import get_historical_ohlcv
    from services.nse_data        import get_stock_score_data
    from services.feature_engine  import compute_features

    df        = get_historical_ohlcv(symbol)
    live_data = get_stock_score_data(f"{symbol}.NS") or {"symbol": symbol, "price": 0, "vwap": 0}
    features  = compute_features(df, live_data)
    return features


def _get_model_score_sync(symbol: str) -> dict:
    from services.ml_scorer        import get_model_score
    from services.prediction_engine import get_macro_state

    features    = _get_features_sync(symbol)
    macro_state = get_macro_state()
    # Remove the heavy sector_perf dict (not needed by scorer)
    macro_lean  = {k: v for k, v in macro_state.items() if k != "sector_perf"}
    return get_model_score(symbol, features, macro_lean)


def _run_backtest_sync(symbols_str: Optional[str]) -> dict:
    from services.backtester import run_backtest
    symbols = [s.strip() for s in symbols_str.split(",")] if symbols_str else None
    return run_backtest(symbols)


@router.get("/features/{symbol}")
async def get_features(symbol: str):
    """
    Return all engineered technical features for a stock.
    RSI, MACD, ATR, Bollinger Bands, VWAP deviation, momentum, 52w position.
    """
    clean = _normalize(symbol)
    return await _run(_get_features_sync, clean)


@router.get("/model-score/{symbol}")
async def get_model_score_endpoint(symbol: str):
    """
    Return ML probability score: P(return > 8% in next 4 weeks).
    Includes feature contributions and top driving factors.
    Uses rules-based scoring engine (no training required).
    """
    clean = _normalize(symbol)
    return await _run(_get_model_score_sync, clean)


@router.get("/backtest")
async def backtest_endpoint(
    symbols: Optional[str] = Query(None, description="Comma-separated symbols, e.g. RELIANCE,TCS"),
    force: bool = Query(False, description="Force refresh (bypass cache)")
):
    """
    Run walk-forward backtest on current signal criteria.
    Shows historical win rate, returns, drawdown, Sharpe ratio.
    Results are cached for 6 hours (expensive computation).
    """
    global _backtest_cache, _backtest_ts

    now = datetime.now()
    cache_age = (now - _backtest_ts).total_seconds() if _backtest_ts else None
    if not force and _backtest_cache and cache_age and cache_age < BACKTEST_TTL_HOURS * 3600:
        result = dict(_backtest_cache)
        result["cache_age_seconds"] = int(cache_age)
        result["cached"] = True
        return result

    result = await _run(_run_backtest_sync, symbols)
    _backtest_cache = result
    _backtest_ts    = now
    result["cached"] = False
    return result


@router.post("/train")
async def train_model_endpoint(
    symbols: Optional[str] = Query(None, description="Comma-separated symbols to train on")
):
    """
    Train the LightGBM model on historical data.
    Takes 2-5 minutes. Run this once to activate ML backend.
    """
    from services.ml_scorer import train_lgbm_model
    from services.sector_analysis import SECTOR_STOCKS

    if symbols:
        sym_list = [s.strip() for s in symbols.split(",")]
    else:
        # Use top stocks from all sectors
        sym_list = []
        for stocks in SECTOR_STOCKS.values():
            sym_list.extend(stocks[:3])
        sym_list = list(dict.fromkeys(sym_list))  # dedupe

    return await _run(train_lgbm_model, sym_list)
