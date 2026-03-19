"""
Feature Engineering Service
Computes RSI, MACD, ATR, Bollinger Bands, VWAP deviation,
volume spikes, momentum, 52w range position from OHLCV + live NSE data.

All indicators use standard formulas (Wilder's RSI, true-range ATR).
"""
from datetime import datetime
from typing import Optional
import numpy as np
import pandas as pd


# ── Private helpers ────────────────────────────────────────────────────────

def _ema(values: np.ndarray, period: int) -> np.ndarray:
    """Exponential moving average using standard multiplier 2/(period+1)."""
    result = np.full(len(values), np.nan)
    if len(values) < period:
        return result
    result[period - 1] = np.mean(values[:period])
    k = 2.0 / (period + 1)
    for i in range(period, len(values)):
        result[i] = values[i] * k + result[i - 1] * (1 - k)
    return result


def _rsi(closes: np.ndarray, period: int = 14) -> Optional[float]:
    """
    Wilder's smoothed RSI (the standard definition).
    Uses exponential smoothing (alpha=1/period), NOT simple mean.
    """
    if len(closes) < period + 1:
        return None
    deltas = np.diff(closes)
    gains  = np.where(deltas > 0, deltas, 0.0)
    losses = np.where(deltas < 0, -deltas, 0.0)

    # Wilder's smoothing: initial avg is SMA, then exponential
    avg_gain = np.mean(gains[:period])
    avg_loss = np.mean(losses[:period])
    alpha = 1.0 / period
    for i in range(period, len(gains)):
        avg_gain = avg_gain * (1 - alpha) + gains[i] * alpha
        avg_loss = avg_loss * (1 - alpha) + losses[i] * alpha

    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return round(100.0 - (100.0 / (1.0 + rs)), 2)


def _macd(closes: np.ndarray, fast=12, slow=26, signal=9) -> Optional[dict]:
    """MACD line, signal line, and histogram."""
    if len(closes) < slow + signal:
        return None
    ema_fast   = _ema(closes, fast)
    ema_slow   = _ema(closes, slow)
    macd_line  = ema_fast - ema_slow
    valid      = macd_line[~np.isnan(macd_line)]
    if len(valid) < signal:
        return None
    signal_line = _ema(valid, signal)
    m  = float(valid[-1])
    s  = float(signal_line[-1])
    return {
        "macd":      round(m, 4),
        "signal":    round(s, 4),
        "histogram": round(m - s, 4),
    }


def _atr(highs: np.ndarray, lows: np.ndarray,
          closes: np.ndarray, period: int = 14) -> Optional[float]:
    """Average True Range using Wilder's smoothing."""
    if len(closes) < period + 1:
        return None
    tr = np.maximum.reduce([
        highs[1:]  - lows[1:],
        np.abs(highs[1:]  - closes[:-1]),
        np.abs(lows[1:]   - closes[:-1]),
    ])
    # Wilder's smoothing
    atr = np.mean(tr[:period])
    alpha = 1.0 / period
    for i in range(period, len(tr)):
        atr = atr * (1 - alpha) + tr[i] * alpha
    return round(float(atr), 4)


def _bollinger(closes: np.ndarray, period=20, std_dev=2) -> Optional[dict]:
    """Bollinger Bands and %B position (0=at lower, 1=at upper)."""
    if len(closes) < period:
        return None
    window = closes[-period:]
    mid    = float(np.mean(window))
    std    = float(np.std(window, ddof=1))
    upper  = mid + std_dev * std
    lower  = mid - std_dev * std
    price  = float(closes[-1])
    pct_b  = (price - lower) / (upper - lower) if upper != lower else 0.5
    return {
        "upper":  round(upper, 2),
        "middle": round(mid, 2),
        "lower":  round(lower, 2),
        "pct_b":  round(max(0.0, min(1.0, pct_b)), 4),
    }


def _momentum_returns(closes: np.ndarray) -> dict:
    """Momentum over 1, 5, 20, 60 bars."""
    n = len(closes)
    def ret(period):
        if n <= period:
            return None
        r = (closes[-1] / closes[-1 - period]) - 1
        return round(float(r), 4)
    return {
        "mom_1d":  ret(1),
        "mom_5d":  ret(5),
        "mom_20d": ret(20),
        "mom_60d": ret(60),
    }


def _week52_position(closes: np.ndarray) -> Optional[float]:
    """Position in 52-week range: 0 = at 52w low, 100 = at 52w high."""
    if len(closes) < 2:
        return None
    hi = float(np.max(closes))
    lo = float(np.min(closes))
    if hi == lo:
        return 50.0
    return round(((closes[-1] - lo) / (hi - lo)) * 100, 1)


def _sma_deviations(closes: np.ndarray) -> dict:
    """How far current price is from SMA50 and SMA200 (ratio: 1.05 = 5% above)."""
    price = float(closes[-1])
    def dev(period):
        if len(closes) < period:
            return None
        sma = float(np.mean(closes[-period:]))
        return round(price / sma, 4) if sma else None
    return {
        "price_vs_sma50":  dev(50),
        "price_vs_sma200": dev(200),
    }


def _volume_spike(volumes: np.ndarray, avg_period=20) -> Optional[float]:
    """Today's volume vs 20-day average volume."""
    if len(volumes) < avg_period + 1:
        return None
    avg = float(np.mean(volumes[-avg_period - 1:-1]))
    if avg == 0:
        return None
    return round(float(volumes[-1]) / avg, 2)


# ── Public API ─────────────────────────────────────────────────────────────

def compute_features(df: pd.DataFrame, live_data: dict) -> dict:
    """
    Compute all technical features from OHLCV DataFrame + live NSE snapshot.
    Returns a flat dict with all features. Missing values are None.

    df:        pd.DataFrame with columns [Open, High, Low, Close, Volume], DatetimeIndex
    live_data: dict from nse_data.get_stock_score_data() (contains vwap, price, etc.)
    """
    if df is None or len(df) < 5:
        return {"symbol": live_data.get("symbol", ""), "error": "insufficient_data", "data_bars": 0}

    closes  = df["Close"].values.astype(float)
    highs   = df["High"].values.astype(float)
    lows    = df["Low"].values.astype(float)
    volumes = df["Volume"].values.astype(float)

    # RSI
    rsi_14 = _rsi(closes, 14)
    rsi_5  = _rsi(closes, 5)

    # MACD
    macd_data = _macd(closes)

    # ATR
    atr_val = _atr(highs, lows, closes)
    price   = float(closes[-1])
    atr_pct = round((atr_val / price) * 100, 3) if atr_val and price else None

    # Bollinger
    bb = _bollinger(closes)

    # VWAP deviation (live VWAP from NSE vs current price)
    vwap = live_data.get("vwap") or live_data.get("price")
    vwap_dev = None
    if vwap and price:
        vwap_dev = round((price - float(vwap)) / float(vwap), 4)

    # Volume spike
    vol_spike = _volume_spike(volumes)

    # Momentum
    mom = _momentum_returns(closes)

    # 52-week position
    pos52 = _week52_position(closes)

    # SMA deviations
    sma = _sma_deviations(closes)

    return {
        "symbol":           live_data.get("symbol", ""),
        # RSI
        "rsi_14":           rsi_14,
        "rsi_5":            rsi_5,
        # MACD
        "macd":             macd_data["macd"]      if macd_data else None,
        "macd_signal":      macd_data["signal"]    if macd_data else None,
        "macd_histogram":   macd_data["histogram"] if macd_data else None,
        # Volatility
        "atr_14":           atr_val,
        "atr_pct":          atr_pct,
        # Bollinger Bands
        "bb_upper":         bb["upper"]  if bb else None,
        "bb_middle":        bb["middle"] if bb else None,
        "bb_lower":         bb["lower"]  if bb else None,
        "bb_pct_b":         bb["pct_b"]  if bb else None,
        # Price vs market price levels
        "vwap_deviation":   vwap_dev,
        "vol_spike_ratio":  vol_spike,
        # Momentum
        "mom_1d":           mom["mom_1d"],
        "mom_5d":           mom["mom_5d"],
        "mom_20d":          mom["mom_20d"],
        "mom_60d":          mom["mom_60d"],
        # Range and trend
        "week52_position":  pos52,
        "price_vs_sma50":   sma["price_vs_sma50"],
        "price_vs_sma200":  sma["price_vs_sma200"],
        # Meta
        "data_bars":        len(df),
        "computed_at":      datetime.now().isoformat(),
    }
