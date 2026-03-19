"""
Smart Money Detection Service
Detects institutional accumulation, unusual volume, promoter activity
These are signals that big players are quietly buying before a price move
"""
import yfinance as yf
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import json, os

BASE_DIR = os.path.dirname(os.path.dirname(__file__))

with open(os.path.join(BASE_DIR, "data", "sector_mapping.json"), "r") as f:
    SECTOR_MAP = json.load(f)


def detect_accumulation(symbol: str) -> Dict:
    """
    Detect if big players are quietly accumulating a stock.
    Signs: rising volume + flat/slightly rising price + increasing delivery %
    """
    result = {
        "symbol": symbol,
        "accumulation_score": 0,
        "signals": [],
        "alert_level": "NONE"
    }

    try:
        import yfinance as yf
        # Use download() — more reliable, avoids 429 vs ticker.history()
        raw = yf.download(symbol, period="3mo", progress=False, auto_adjust=True)
        if raw.empty:
            return result
        hist = raw

        if len(hist) < 20:
            return result

        closes  = hist["Close"].values.flatten().astype(float)
        volumes = hist["Volume"].values.flatten().astype(float)

        # Signal 1: Volume trend vs price trend divergence
        # Price flat or slightly up BUT volume increasing = accumulation
        price_change_30d = (closes[-1] - closes[-30]) / closes[-30] * 100
        vol_avg_recent = np.mean(volumes[-10:])
        vol_avg_old = np.mean(volumes[-30:-10])
        volume_trend = (vol_avg_recent - vol_avg_old) / (vol_avg_old + 1) * 100

        if volume_trend > 30 and -5 < price_change_30d < 15:
            result["signals"].append({
                "type": "VOLUME_ACCUMULATION",
                "detail": f"Volume increased {volume_trend:.0f}% while price moved only {price_change_30d:.1f}% — classic accumulation pattern",
                "strength": min(int(volume_trend / 3), 30)
            })
            result["accumulation_score"] += min(int(volume_trend / 3), 30)

        # Signal 2: Unusual single-day volume spike
        recent_vol = volumes[-1]
        avg_vol_20d = np.mean(volumes[-21:-1])
        if avg_vol_20d > 0:
            vol_ratio = recent_vol / avg_vol_20d
            if vol_ratio > 3.0:
                result["signals"].append({
                    "type": "UNUSUAL_VOLUME",
                    "detail": f"Today's volume is {vol_ratio:.1f}x the 20-day average — someone is buying in bulk",
                    "strength": min(int(vol_ratio * 8), 35)
                })
                result["accumulation_score"] += min(int(vol_ratio * 8), 35)

        # Signal 3: Price holding above key support despite market weakness
        ma20 = np.mean(closes[-20:])
        if closes[-1] > ma20 * 1.02:
            result["signals"].append({
                "type": "HOLDING_ABOVE_MA",
                "detail": "Stock is holding 2%+ above 20-day average — strong hands holding",
                "strength": 10
            })
            result["accumulation_score"] += 10

        # Signal 4: Consecutive up-volume days
        up_vol_days = 0
        for i in range(-5, 0):
            if closes[i] > closes[i - 1] and volumes[i] > avg_vol_20d:
                up_vol_days += 1
        if up_vol_days >= 3:
            result["signals"].append({
                "type": "CONSECUTIVE_BUY_DAYS",
                "detail": f"{up_vol_days} of last 5 days had above-average buying volume — sustained institutional interest",
                "strength": up_vol_days * 5
            })
            result["accumulation_score"] += up_vol_days * 5

        # Signal 5: Near 52-week low but buying increasing (turnaround signal)
        high_52w = np.max(closes[-252:]) if len(closes) >= 252 else np.max(closes)
        low_52w = np.min(closes[-252:]) if len(closes) >= 252 else np.min(closes)
        range_52w = high_52w - low_52w
        if range_52w > 0:
            position_in_range = (closes[-1] - low_52w) / range_52w
            if position_in_range < 0.25 and volume_trend > 20:
                result["signals"].append({
                    "type": "BOTTOM_ACCUMULATION",
                    "detail": f"Stock is near 52-week low but buying is increasing — potential turnaround by big investors",
                    "strength": 25
                })
                result["accumulation_score"] += 25

        # Final alert level
        score = result["accumulation_score"]
        if score >= 60:
            result["alert_level"] = "HIGH"
        elif score >= 35:
            result["alert_level"] = "MEDIUM"
        elif score >= 15:
            result["alert_level"] = "LOW"

    except Exception as e:
        print(f"[SmartMoney] Error for {symbol}: {e}")

    return result


def scan_all_stocks_for_accumulation() -> List[Dict]:
    """Scan all tracked stocks for accumulation signals"""
    results = []
    all_stocks = []

    for sector_name, sector_data in SECTOR_MAP.items():
        for stock in sector_data["stocks"]:
            all_stocks.append({**stock, "sector": sector_name})

    for stock in all_stocks:
        try:
            acc_data = detect_accumulation(stock["symbol"])
            if acc_data["alert_level"] in ["HIGH", "MEDIUM"]:
                acc_data["name"] = stock["name"]
                acc_data["sector"] = stock["sector"]
                results.append(acc_data)
        except Exception as e:
            print(f"[SmartMoney Scan] Error for {stock['symbol']}: {e}")
            continue

    return sorted(results, key=lambda x: x["accumulation_score"], reverse=True)


def get_fii_dii_sentiment() -> Dict:
    """
    Approximate FII/DII activity using index movement + sector rotation.
    Real FII data is available on NSE website (scraping needed).
    """
    try:
        hist = yf.download("^NSEI", period="5d", progress=False, auto_adjust=True)

        if len(hist) < 5:
            return {"fii_sentiment": "NEUTRAL", "confidence": 40}

        closes  = hist["Close"].values.flatten().astype(float)
        volumes = hist["Volume"].values.flatten().astype(float)

        # If index up on high volume = FII buying likely
        last_5_up = sum(1 for i in range(1, len(closes)) if closes[i] > closes[i - 1])
        avg_vol = np.mean(volumes[:-1])
        recent_vol = volumes[-1]

        if last_5_up >= 4 and recent_vol > avg_vol * 1.2:
            sentiment = "BUYING"
            confidence = 70
        elif last_5_up <= 1 and recent_vol > avg_vol * 1.2:
            sentiment = "SELLING"
            confidence = 65
        else:
            sentiment = "NEUTRAL"
            confidence = 50

        return {
            "fii_sentiment": sentiment,
            "confidence": confidence,
            "detail": f"{last_5_up}/5 days positive with {'above' if recent_vol > avg_vol else 'below'}-average volume"
        }
    except Exception as e:
        print(f"[FII/DII] Error: {e}")
        return {"fii_sentiment": "NEUTRAL", "confidence": 30}


def get_breakout_candidates() -> List[Dict]:
    """Find stocks near breakout — tight consolidation about to explode"""
    candidates = []

    all_stocks = []
    for sector_name, sector_data in SECTOR_MAP.items():
        for stock in sector_data["stocks"]:
            all_stocks.append({**stock, "sector": sector_name})

    for stock in all_stocks[:30]:  # Limit for speed
        try:
            hist = yf.download(stock["symbol"], period="6mo", progress=False, auto_adjust=True)

            if len(hist) < 60:
                continue

            closes  = hist["Close"].values.flatten().astype(float)
            volumes = hist["Volume"].values.flatten().astype(float)

            # Tight consolidation: low volatility in last 20 days
            recent_closes = closes[-20:]
            volatility = np.std(recent_closes) / np.mean(recent_closes) * 100

            # Volume contraction then expansion (spring loading)
            vol_last_20 = np.mean(volumes[-20:])
            vol_last_60 = np.mean(volumes[-60:-20])
            vol_contraction = vol_last_20 < vol_last_60 * 0.7

            # Price near 52-week high (momentum breakout)
            high_52w = np.max(closes[-252:]) if len(closes) >= 252 else np.max(closes)
            near_high = closes[-1] > high_52w * 0.92

            if volatility < 3.5 and vol_contraction and near_high:
                candidates.append({
                    "symbol": stock["symbol"].replace(".NS", ""),
                    "name": stock["name"],
                    "sector": stock["sector"],
                    "price": round(float(closes[-1]), 2),
                    "consolidation_days": 20,
                    "volatility_pct": round(volatility, 2),
                    "near_52w_high": round((closes[-1] / high_52w) * 100, 1),
                    "breakout_signal": "COILED_SPRING",
                    "detail": f"Tight {volatility:.1f}% range over 20 days near 52w high — breakout imminent"
                })
        except Exception:
            continue

    return sorted(candidates, key=lambda x: x["near_52w_high"], reverse=True)[:10]
