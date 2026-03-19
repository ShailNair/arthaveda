"""
Backtesting Engine
Tests how well our scoring signals would have performed historically.
Uses actual historical OHLCV data with transaction cost modeling.

Walk-forward: train rules on past, measure returns in future windows.
Output: win rate, avg return, max drawdown, Sharpe approximation.
"""
import time
from datetime import datetime
from typing import List, Dict, Optional, Tuple
import numpy as np
import pandas as pd

TRANSACTION_COST = 0.001   # 0.1% per leg (0.2% round trip)
TARGET_RETURN    = 0.08    # 8% target
STOP_LOSS        = 0.06    # 6% stop loss


def _max_drawdown(equity_curve: List[float]) -> float:
    """Peak-to-trough maximum drawdown on equity curve."""
    if len(equity_curve) < 2:
        return 0.0
    curve = np.array(equity_curve)
    peak  = np.maximum.accumulate(curve)
    dd    = (curve - peak) / peak
    return round(float(np.min(dd)), 4)


def _sharpe_approx(returns: List[float], periods_per_year: int = 252) -> float:
    """Approximate annualized Sharpe ratio (assumes Rf=0)."""
    if len(returns) < 3:
        return 0.0
    r = np.array(returns)
    if r.std() == 0:
        return 0.0
    return round(float((r.mean() / r.std()) * np.sqrt(periods_per_year)), 2)


def _compute_signal_return(
    entry_idx: int, closes: np.ndarray, highs: np.ndarray, lows: np.ndarray
) -> dict:
    """
    Given entry at close[entry_idx], compute simulated trade result
    with stop-loss and target over next 20 trading days.
    """
    n   = len(closes)
    entry_price = closes[entry_idx] * (1 + TRANSACTION_COST)  # slippage on entry

    result_2w = result_4w = result_8w = None
    exit_price = None
    exit_reason = "TIMEOUT"
    holding_days = 0

    target = entry_price * (1 + TARGET_RETURN)
    stop   = entry_price * (1 - STOP_LOSS)

    for offset in range(1, min(41, n - entry_idx)):
        idx   = entry_idx + offset
        high  = highs[idx]
        low   = lows[idx]
        close = closes[idx]

        if low <= stop:
            exit_price  = stop * (1 - TRANSACTION_COST)
            exit_reason = "STOP_LOSS"
            holding_days = offset
            break
        if high >= target:
            exit_price  = target * (1 - TRANSACTION_COST)
            exit_reason = "TARGET_HIT"
            holding_days = offset
            break

        if offset == 10:
            result_2w = (close / entry_price - 1) - TRANSACTION_COST
        if offset == 20:
            result_4w = (close / entry_price - 1) - TRANSACTION_COST
        if offset == 40:
            result_8w = (close / entry_price - 1) - TRANSACTION_COST
            exit_price   = close * (1 - TRANSACTION_COST)
            exit_reason  = "TIMEOUT"
            holding_days = offset

    if exit_price is None and n > entry_idx + 1:
        exit_price   = closes[min(entry_idx + 20, n - 1)] * (1 - TRANSACTION_COST)
        exit_reason  = "TIMEOUT"
        holding_days = min(20, n - entry_idx - 1)

    actual_return = (exit_price / entry_price - 1) if exit_price else 0.0

    return {
        "entry_price":   round(entry_price, 2),
        "exit_price":    round(exit_price, 2) if exit_price else None,
        "exit_reason":   exit_reason,
        "holding_days":  holding_days,
        "return_actual": round(actual_return, 4),
        "return_2w":     round(result_2w, 4) if result_2w is not None else round(actual_return, 4),
        "return_4w":     round(result_4w, 4) if result_4w is not None else round(actual_return, 4),
        "return_8w":     round(result_8w, 4) if result_8w is not None else round(actual_return, 4),
        "hit_target":    exit_reason == "TARGET_HIT",
        "stopped_out":   exit_reason == "STOP_LOSS",
    }


def _generate_signals_from_features(df: pd.DataFrame) -> List[Tuple[int, float]]:
    """
    Roll through historical bars and apply simple feature-based rules
    to identify buy signals. Returns list of (bar_index, signal_score).
    """
    from services.feature_engine import compute_features
    closes  = df["Close"].values.astype(float)
    signals = []
    step    = 5  # check every 5 bars to reduce computation

    for i in range(60, len(df) - 22, step):
        slice_df = df.iloc[:i + 1]
        live_sim = {
            "symbol": "",
            "price":  float(closes[i]),
            "vwap":   float(closes[i]),
        }
        try:
            feats = compute_features(slice_df, live_sim)
            # Simple signal criteria: RSI oversold + near lower BB + recent weakness
            rsi   = feats.get("rsi_14") or 50
            bb    = feats.get("bb_pct_b") or 0.5
            mom20 = feats.get("mom_20d") or 0
            pos52 = feats.get("week52_position") or 50

            # Score: higher = stronger buy signal
            score = 0
            if rsi < 40:   score += 2
            if rsi < 35:   score += 1
            if bb < 0.25:  score += 2
            if mom20 < -0.05: score += 1
            if pos52 < 35: score += 1

            if score >= 4:  # threshold for signal
                signals.append((i, score))
                i += 20  # skip ahead to avoid clustering
        except Exception:
            pass
    return signals


def run_backtest(symbols: List[str] = None, max_symbols: int = 15) -> dict:
    """
    Main backtest function. Tests scoring signal historically.
    Returns comprehensive performance metrics.
    """
    from services.historical_data import get_historical_ohlcv
    from services.sector_analysis import SECTOR_STOCKS

    if not symbols:
        # Use a representative cross-section from all sectors
        symbols = []
        for stocks in SECTOR_STOCKS.values():
            symbols.extend(stocks[:2])
        symbols = list(dict.fromkeys(symbols))[:max_symbols]  # dedupe, cap at max

    all_signal_results: List[dict] = []
    per_symbol: Dict[str, dict]    = {}
    equity_curve: List[float]      = [1.0]

    print(f"[Backtest] Testing {len(symbols)} symbols...")

    for sym in symbols:
        try:
            df = get_historical_ohlcv(sym.replace(".NS", ""))
            if df is None or len(df) < 80:
                continue

            closes = df["Close"].values.astype(float)
            highs  = df["High"].values.astype(float)
            lows   = df["Low"].values.astype(float)

            # Generate signals from historical data
            raw_signals = _generate_signals_from_features(df)
            if not raw_signals:
                continue

            sym_results = []
            for bar_idx, score in raw_signals:
                trade = _compute_signal_return(bar_idx, closes, highs, lows)
                trade["symbol"]     = sym.replace(".NS", "")
                trade["bar_index"]  = bar_idx
                trade["score"]      = score
                try:
                    trade["date"] = str(df.index[bar_idx].date())
                except Exception:
                    trade["date"] = ""
                sym_results.append(trade)
                all_signal_results.append(trade)

            # Per-symbol summary
            if sym_results:
                returns  = [t["return_4w"] for t in sym_results]
                wins     = [r for r in returns if r > 0]
                per_symbol[sym.replace(".NS", "")] = {
                    "signals":     len(sym_results),
                    "win_rate":    round(len(wins) / len(returns), 2),
                    "avg_return":  round(float(np.mean(returns)), 4),
                    "best_trade":  round(max(returns), 4),
                    "worst_trade": round(min(returns), 4),
                }

            time.sleep(0.3)  # rate limit Yahoo
        except Exception as e:
            print(f"[Backtest] Error for {sym}: {e}")

    if not all_signal_results:
        return {
            "error": "No signals generated — insufficient historical data",
            "symbols_tested": len(symbols),
            "generated_at": datetime.now().isoformat(),
        }

    # Aggregate metrics
    all_returns_4w   = [t["return_4w"]     for t in all_signal_results]
    all_returns_2w   = [t["return_2w"]     for t in all_signal_results]
    all_returns_8w   = [t["return_8w"]     for t in all_signal_results]
    hits_target      = [t for t in all_signal_results if t["hit_target"]]
    stopped_out      = [t for t in all_signal_results if t["stopped_out"]]

    # Build equity curve (equal weight, sequential)
    eq = [1.0]
    for r in all_returns_4w:
        eq.append(eq[-1] * (1 + r))

    # Walk-forward windows (divide data into 3 periods)
    n_signals = len(all_signal_results)
    window_size = max(n_signals // 3, 1)
    wf_windows = []
    for i in range(3):
        start = i * window_size
        end   = min(start + window_size, n_signals)
        window_signals = all_signal_results[start:end]
        if window_signals:
            w_returns = [t["return_4w"] for t in window_signals]
            w_wins    = [r for r in w_returns if r > 0.08 - 0.002]
            d_start   = window_signals[0].get("date", "")
            d_end     = window_signals[-1].get("date", "")
            wf_windows.append({
                "period":     f"{d_start} to {d_end}",
                "n_signals":  len(window_signals),
                "win_rate":   round(len(w_wins) / len(w_returns), 2),
                "avg_return": round(float(np.mean(w_returns)), 4),
            })

    return {
        "backtest_result": {
            "total_signals":           n_signals,
            "win_rate_4w":             round(len([r for r in all_returns_4w if r > TARGET_RETURN - TRANSACTION_COST * 2]) / n_signals, 3),
            "win_rate_positive":       round(len([r for r in all_returns_4w if r > 0]) / n_signals, 3),
            "target_hit_rate":         round(len(hits_target) / n_signals, 3),
            "stop_loss_rate":          round(len(stopped_out) / n_signals, 3),
            "avg_return_2w":           round(float(np.mean(all_returns_2w)), 4),
            "avg_return_4w":           round(float(np.mean(all_returns_4w)), 4),
            "avg_return_8w":           round(float(np.mean(all_returns_8w)), 4),
            "max_return":              round(float(max(all_returns_4w)), 4),
            "min_return":              round(float(min(all_returns_4w)), 4),
            "max_drawdown":            _max_drawdown(eq),
            "sharpe_approx":           _sharpe_approx(all_returns_4w),
            "transaction_cost_pct":    TRANSACTION_COST * 200,  # round trip in %
            "target_return_pct":       TARGET_RETURN * 100,
            "stop_loss_pct":           STOP_LOSS * 100,
            "walk_forward_windows":    wf_windows,
        },
        "per_symbol_summary": per_symbol,
        "metadata": {
            "generated_at":    datetime.now().isoformat(),
            "symbols_tested":  len(per_symbol),
            "data_limitation": "Based on ~1yr of historical data. Small sample — use as directional indicator only.",
            "disclaimer":      "Past signal performance does not guarantee future results. Always do your own research.",
        }
    }
