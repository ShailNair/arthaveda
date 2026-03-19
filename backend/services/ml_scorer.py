"""
ML Scoring Service
Produces P(return > 8% in 4 weeks) for a stock using engineered features.

Two backends:
  rules  — weighted feature scoring (immediate, no training needed)
  lgbm   — LightGBM classifier (activates once trained on enough symbols)

The interface stays identical regardless of backend.
"""
import os, json, time
from datetime import datetime
from typing import Dict, List, Optional, Tuple
import numpy as np

MODEL_BACKEND = "rules"   # flip to "lgbm" once training validates AUC > 0.57
MIN_LGBM_BARS = 180       # minimum bars needed per symbol for training

# ── Feature weights for rules-based backend ────────────────────────────────
# Each entry: (feature_key, weight, transform_fn)
# transform_fn maps raw feature value → [0,1] score (1=most bullish)
_RULES = [
    # RSI: oversold (<30) = bullish, overbought (>70) = bearish
    ("rsi_14",          0.15, lambda v: 1 - v/100 if v is not None else 0.5),
    # MACD histogram: positive = bullish momentum
    ("macd_histogram",  0.12, lambda v: 0.5 + min(max(v * 20, -0.5), 0.5) if v is not None else 0.5),
    # Bollinger %B: near lower band (0) = bullish
    ("bb_pct_b",        0.10, lambda v: 1 - v if v is not None else 0.5),
    # Volume spike: high = institutional interest
    ("vol_spike_ratio", 0.10, lambda v: min((v - 1) / 3, 1) if v is not None and v > 1 else 0.0),
    # 20d momentum: negative = beaten down = opportunity
    ("mom_20d",         0.10, lambda v: 1 - min(max(v + 0.15, 0), 0.30) / 0.30 if v is not None else 0.5),
    # 60d momentum: positive = trend intact
    ("mom_60d",         0.08, lambda v: min(max(v + 0.10, 0), 0.30) / 0.30 if v is not None else 0.5),
    # VWAP deviation: below VWAP = institutions selling, near VWAP = neutral
    ("vwap_deviation",  0.08, lambda v: 1 - min(max(v + 0.03, 0), 0.06) / 0.06 if v is not None else 0.5),
    # 52w position: lower = more upside
    ("week52_position", 0.12, lambda v: 1 - v/100 if v is not None else 0.5),
    # Price vs SMA50: below = potential bounce
    ("price_vs_sma50",  0.08, lambda v: 1 - min(max(v - 0.85, 0), 0.30) / 0.30 if v is not None else 0.5),
    # ATR: medium volatility sweet spot (not too low, not too high)
    ("atr_pct",         0.07, lambda v: 1 - abs(v - 2.5) / 5 if v is not None else 0.5),
]

# Macro signal encoding
_MACRO_WEIGHTS = {
    "regime":    {"BULL": 0.12,  "SIDEWAYS": 0.0,  "BEAR": -0.10, "UNCERTAIN": -0.05},
    "fii_signal":{"BUYING": 0.10, "NEUTRAL": 0.0,   "SELLING": -0.08},
    "rate_signal":{"FALLING": 0.06, "NEUTRAL": 0.0, "RISING": -0.04},
}


def _sigmoid(x: float) -> float:
    return 1.0 / (1.0 + np.exp(-x))


def _rules_based_score(features: dict, macro_state: dict) -> float:
    """
    Weighted feature scoring → logit space → sigmoid → probability.
    """
    total_weight = sum(w for _, w, _ in _RULES)
    raw_score = 0.0

    for key, weight, transform in _RULES:
        val = features.get(key)
        score = transform(val)  # 0-1, higher = more bullish
        raw_score += weight * score

    raw_score /= total_weight  # normalize to 0-1

    # Macro adjustment (additive bonus/penalty in logit space)
    macro_adj = 0.0
    macro_adj += _MACRO_WEIGHTS["regime"].get(macro_state.get("regime", "SIDEWAYS"), 0)
    macro_adj += _MACRO_WEIGHTS["fii_signal"].get(macro_state.get("fii_signal", "NEUTRAL"), 0)
    macro_adj += _MACRO_WEIGHTS["rate_signal"].get(macro_state.get("rate_signal", "NEUTRAL"), 0)

    # Convert to logit space, add macro adjustment, back to probability
    epsilon = 1e-6
    raw_score = max(epsilon, min(1 - epsilon, raw_score))
    logit = np.log(raw_score / (1 - raw_score))
    logit += macro_adj * 2  # scale macro contribution
    prob = float(_sigmoid(logit))
    return round(prob, 4)


def _feature_contributions(features: dict, macro_state: dict) -> List[dict]:
    """Return top feature contributions for explanation."""
    contribs = []
    for key, weight, transform in _RULES:
        val = features.get(key)
        score = transform(val) if val is not None else 0.5
        # Contribution = weight × (score - 0.5) → positive = bullish
        contrib = weight * (score - 0.5)
        direction = "BULLISH" if score > 0.55 else "BEARISH" if score < 0.45 else "NEUTRAL"
        contribs.append({
            "name":         key,
            "value":        round(val, 3) if val is not None else None,
            "contribution": round(contrib, 4),
            "direction":    direction,
        })
    # Sort by absolute contribution
    contribs.sort(key=lambda x: abs(x["contribution"]), reverse=True)
    return contribs


def _confidence_label(features: dict) -> str:
    """Data completeness → confidence label."""
    bars = features.get("data_bars", 0)
    non_null = sum(1 for k, _, _ in _RULES if features.get(k) is not None)
    if bars >= 200 and non_null >= 8:
        return "HIGH"
    elif bars >= 60 and non_null >= 5:
        return "MEDIUM"
    return "LOW"


def get_model_score(symbol: str, features: dict, macro_state: dict) -> dict:
    """
    Returns probability score and feature explanations.

    features:    output of feature_engine.compute_features()
    macro_state: output of prediction_engine.get_macro_state()
    """
    if features.get("error"):
        return {
            "symbol":      symbol,
            "probability": 0.5,
            "model_backend": "rules",
            "confidence":  "LOW",
            "error":       features["error"],
        }

    prob         = _rules_based_score(features, macro_state)
    contribs     = _feature_contributions(features, macro_state)
    top_features = contribs[:3]
    confidence   = _confidence_label(features)

    return {
        "symbol":               symbol,
        "probability":          prob,
        "probability_pct":      round(prob * 100, 1),
        "signal_label":         "STRONG BUY" if prob > 0.70 else
                                "BUY"        if prob > 0.58 else
                                "NEUTRAL"    if prob > 0.42 else
                                "AVOID",
        "signal_color":         "#4ade80" if prob > 0.70 else
                                "#a3e635" if prob > 0.58 else
                                "#9ca3af" if prob > 0.42 else
                                "#f87171",
        "model_backend":        MODEL_BACKEND,
        "confidence":           confidence,
        "feature_contributions": contribs,
        "top_features":         top_features,
        "macro_impact":         {
            "regime":      macro_state.get("regime"),
            "fii_signal":  macro_state.get("fii_signal"),
            "rate_signal": macro_state.get("rate_signal"),
            "vix":         macro_state.get("vix"),
        },
        "computed_at": datetime.now().isoformat(),
    }


# ── LightGBM training (call once to train / retrain weekly) ───────────────

def train_lgbm_model(symbols: List[str]) -> dict:
    """
    Train LightGBM on historical feature + label data from all symbols.
    Label: did the stock return > 8% at any point in the next 20 trading days?

    Saves model to data/lgbm_model.txt.
    Returns training metrics.
    """
    try:
        import lightgbm as lgb
        from sklearn.model_selection import TimeSeriesSplit
        from sklearn.metrics import roc_auc_score
    except ImportError:
        return {"error": "lightgbm or sklearn not installed"}

    from services.historical_data import get_historical_ohlcv
    from services.feature_engine   import compute_features

    all_features, all_labels = [], []
    FEATURE_KEYS = [k for k, _, _ in _RULES]

    for sym in symbols:
        try:
            df = get_historical_ohlcv(sym)
            if df is None or len(df) < MIN_LGBM_BARS:
                continue

            closes = df["Close"].values.astype(float)
            # Generate one feature vector + label per bar (rolling window)
            # Use last 200 bars to keep computation fast
            start = max(0, len(df) - 200)
            for i in range(start + 60, len(df) - 21):  # need 60 bars history + 20 forward
                row_df   = df.iloc[:i + 1]
                live_sim = {
                    "symbol": sym,
                    "price":  float(closes[i]),
                    "vwap":   float(closes[i]),  # approximate
                }
                feats = compute_features(row_df, live_sim)
                fvec  = [feats.get(k) or 0.0 for k in FEATURE_KEYS]

                # Label: max forward return over next 20 bars > 8.1% (including 0.1% tx cost)
                fwd_closes = closes[i + 1: i + 21]
                max_ret    = (max(fwd_closes) - closes[i]) / closes[i]
                label      = 1 if max_ret > 0.081 else 0

                all_features.append(fvec)
                all_labels.append(label)

            time.sleep(0.3)  # rate limit Yahoo
        except Exception as e:
            print(f"[MLScorer] Training data error for {sym}: {e}")

    if len(all_features) < 200:
        return {"error": f"Insufficient training data: {len(all_features)} samples"}

    X = np.array(all_features)
    y = np.array(all_labels)

    print(f"[MLScorer] Training on {len(X)} samples, {y.sum()} positives ({y.mean():.1%})")

    # Walk-forward validation (TimeSeriesSplit)
    tscv   = TimeSeriesSplit(n_splits=3)
    aucs   = []
    params = {
        "objective":   "binary",
        "metric":      "auc",
        "learning_rate": 0.05,
        "num_leaves":  31,
        "min_data_in_leaf": 20,
        "verbose":     -1,
    }

    for train_idx, test_idx in tscv.split(X):
        X_tr, X_te = X[train_idx], X[test_idx]
        y_tr, y_te = y[train_idx], y[test_idx]
        dtrain = lgb.Dataset(X_tr, label=y_tr, feature_name=FEATURE_KEYS)
        model  = lgb.train(params, dtrain, num_boost_round=100, verbose_eval=False)
        preds  = model.predict(X_te)
        try:
            auc = roc_auc_score(y_te, preds)
            aucs.append(auc)
        except Exception:
            pass

    avg_auc = float(np.mean(aucs)) if aucs else 0.5

    # Train final model on full dataset
    dtrain_full = lgb.Dataset(X, label=y, feature_name=FEATURE_KEYS)
    final_model = lgb.train(params, dtrain_full, num_boost_round=100, verbose_eval=False)

    # Save
    model_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "data", "lgbm_model.txt"
    )
    final_model.save_model(model_path)

    result = {
        "auc_cv":       round(avg_auc, 4),
        "n_samples":    len(X),
        "n_positives":  int(y.sum()),
        "positive_rate": round(float(y.mean()), 3),
        "model_path":   model_path,
        "symbols":      len(symbols),
        "trained_at":   datetime.now().isoformat(),
        "verdict":      "GOOD" if avg_auc > 0.57 else "MARGINAL" if avg_auc > 0.52 else "POOR",
    }
    print(f"[MLScorer] Training complete. AUC={avg_auc:.4f} ({result['verdict']})")
    return result
