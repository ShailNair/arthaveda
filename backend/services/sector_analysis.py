"""
Sector Analysis Engine
Fetches NSE sector index performance (1d, 30d, 365d) and identifies
which sectors are in early recovery vs late momentum vs distribution.

This is the foundation of the prediction engine — we predict sector moves
BEFORE individual stocks react, then pick the best stock in that sector.
"""
from datetime import datetime
from typing import Dict, List, Optional
from services.nse_data import _nse_get, _cache_valid, _cache_set, _cache

SECTOR_CACHE_TTL = 180  # 3 minutes

# NSE sector index identifiers → human-readable + our internal sector key
SECTOR_INDICES = {
    "NIFTY IT":         {"label": "IT & Technology",    "key": "IT",        "icon": "💻"},
    "NIFTY BANK":       {"label": "Banking",            "key": "BANK",      "icon": "🏦"},
    "NIFTY AUTO":       {"label": "Automobile",         "key": "AUTO",      "icon": "🚗"},
    "NIFTY PHARMA":     {"label": "Pharma & Healthcare","key": "PHARMA",    "icon": "💊"},
    "NIFTY FMCG":       {"label": "FMCG",               "key": "FMCG",      "icon": "🛒"},
    "NIFTY METAL":      {"label": "Metals & Mining",    "key": "METAL",     "icon": "⛏️"},
    "NIFTY REALTY":     {"label": "Real Estate",        "key": "REALTY",    "icon": "🏠"},
    "NIFTY ENERGY":     {"label": "Energy & Oil",       "key": "ENERGY",    "icon": "⚡"},
    "NIFTY INFRA":      {"label": "Infrastructure",     "key": "INFRA",     "icon": "🏗️"},
    "NIFTY PSU BANK":   {"label": "PSU Banks",          "key": "PSU_BANK",  "icon": "🏛️"},
    "NIFTY MEDIA":      {"label": "Media",              "key": "MEDIA",     "icon": "📺"},
    "NIFTY FIN SERVICE":{"label": "Financial Services", "key": "FINSERV",   "icon": "📊"},
    "NIFTY MIDCAP 100": {"label": "Midcap",             "key": "MIDCAP",    "icon": "📈"},
}

# Best quality stocks per sector (for picking top candidates)
SECTOR_STOCKS = {
    "IT":       ["TCS.NS", "INFY.NS", "HCLTECH.NS", "WIPRO.NS", "TECHM.NS"],
    "BANK":     ["HDFCBANK.NS", "ICICIBANK.NS", "AXISBANK.NS", "KOTAKBANK.NS"],
    "AUTO":     ["MARUTI.NS", "TATAMOTORS.NS", "M&M.NS", "BAJAJ-AUTO.NS"],
    "PHARMA":   ["SUNPHARMA.NS", "DRREDDY.NS", "CIPLA.NS", "DIVISLAB.NS"],
    "FMCG":     ["HINDUNILVR.NS", "ITC.NS", "NESTLEIND.NS", "BRITANNIA.NS"],
    "METAL":    ["TATASTEEL.NS", "HINDALCO.NS", "NMDC.NS", "COALINDIA.NS"],
    "REALTY":   ["DLF.NS", "GODREJPROP.NS", "OBEROIRLTY.NS"],
    "ENERGY":   ["RELIANCE.NS", "NTPC.NS", "POWERGRID.NS", "ONGC.NS"],
    "INFRA":    ["LT.NS", "ADANIPORTS.NS", "SIEMENS.NS"],
    "PSU_BANK": ["SBIN.NS", "BANKBARODA.NS", "CANARABANK.NS"],
    "FINSERV":  ["BAJFINANCE.NS", "BAJAJFINSV.NS", "MUTHOOTFIN.NS"],
    "MIDCAP":   ["DIXON.NS", "PERSISTENT.NS", "COFORGE.NS", "ZOMATO.NS"],
}

# Known top stocks for defence sector (not in NSE sector index)
DEFENCE_STOCKS = ["HAL.NS", "BEL.NS", "MAZDOCK.NS", "COCHINSHIP.NS", "BEML.NS"]


def get_all_sector_performance() -> List[Dict]:
    """
    Returns performance of all major NSE sector indices.
    Uses allIndices for 1d, then individual calls for 30d/365d.
    """
    cache_key = "sector_performance"
    if _cache_valid(cache_key, SECTOR_CACHE_TTL):
        return _cache[cache_key]

    result = []

    # Step 1: Get today's performance from allIndices (single call)
    today_map = {}
    try:
        data = _nse_get("allIndices")
        if data and "data" in data:
            for idx in data["data"]:
                sym = idx.get("indexSymbol", "")
                if sym in SECTOR_INDICES:
                    today_map[sym] = {
                        "pchange_1d":  float(idx.get("percentChange", 0)),
                        "last":        float(idx.get("last", 0)),
                        "year_high":   float(idx.get("yearHigh", idx.get("last", 0))),
                        "year_low":    float(idx.get("yearLow",  idx.get("last", 0))),
                    }
    except Exception as e:
        print(f"[Sectors] allIndices error: {e}")

    # Step 2: For each sector, get 30d + 365d from individual endpoint
    for index_sym, meta in SECTOR_INDICES.items():
        if index_sym not in today_map:
            continue
        td = today_map[index_sym]
        entry = {
            "index":        index_sym,
            "label":        meta["label"],
            "key":          meta["key"],
            "icon":         meta["icon"],
            "last":         td["last"],
            "pchange_1d":   td["pchange_1d"],
            "pchange_30d":  None,
            "pchange_365d": None,
            "year_high":    td["year_high"],
            "year_low":     td["year_low"],
            "near_high_pct": 0.0,
            "phase":        "UNKNOWN",
            "phase_color":  "#9ca3af",
        }

        # Fetch 30d/365d from sector-specific endpoint
        try:
            enc = index_sym.replace(" ", "%20").replace("&", "%26")
            idx_data = _nse_get(f"equity-stockIndices?index={enc}")
            if idx_data and "data" in idx_data and idx_data["data"]:
                row = idx_data["data"][0]  # first row = the index itself
                entry["pchange_30d"]  = float(row.get("perChange30d",  0))
                entry["pchange_365d"] = float(row.get("perChange365d", 0))
                if not entry["year_high"]:
                    entry["year_high"] = float(row.get("yearHigh", 0))
                if not entry["year_low"]:
                    entry["year_low"]  = float(row.get("yearLow",  0))
        except Exception as e:
            print(f"[Sectors] {index_sym} detail error: {e}")

        # Compute near-high %
        if entry["year_high"] > 0:
            entry["near_high_pct"] = round(
                ((entry["last"] - entry["year_high"]) / entry["year_high"]) * 100, 1
            )

        # Classify phase
        entry["phase"], entry["phase_color"] = _classify_phase(entry)
        result.append(entry)

    result.sort(key=lambda x: (x.get("pchange_365d") or 0))
    _cache_set(cache_key, result)
    return result


def _classify_phase(s: Dict) -> tuple:
    """
    Classify sector into market cycle phase:
    EARLY_RECOVERY, RECOVERY, MOMENTUM, DISTRIBUTION, CORRECTION, DEEP_VALUE
    """
    p365 = s.get("pchange_365d") or 0
    p30  = s.get("pchange_30d")  or 0
    p1d  = s.get("pchange_1d",  0)
    near = s.get("near_high_pct", 0)   # negative = below high

    # Deep value — sector massively beaten down
    if p365 < -20 and near < -30:
        if p1d > 1.0 or p30 > -2:      # early signs of life
            return "EARLY RECOVERY", "#f59e0b"
        return "DEEP VALUE", "#60a5fa"

    # Correction after rally
    if p365 > 10 and p30 < -8 and near < -15:
        return "CORRECTION", "#f87171"

    # Momentum — recent strong run
    if p365 > 20 and p30 > 5 and near > -10:
        return "MOMENTUM", "#a78bfa"

    # Recovery — bouncing from lows
    if p365 < 0 and p30 > 3:
        return "RECOVERY", "#4ade80"

    # Stable / accumulation
    if -10 <= p365 <= 10:
        return "SIDEWAYS", "#9ca3af"

    return "TRENDING", "#60a5fa"


def get_sector_opportunity_score(sector: Dict, macro_state: Dict) -> int:
    """
    Score a sector 0-100 for forward-looking opportunity.
    Higher = more likely to outperform in next 4-8 weeks.
    This is the PREDICTION signal — not what's already happened.
    """
    score = 0
    p365  = sector.get("pchange_365d") or 0
    p30   = sector.get("pchange_30d")  or 0
    p1d   = sector.get("pchange_1d",   0)
    near  = sector.get("near_high_pct", 0)
    phase = sector.get("phase", "")
    key   = sector.get("key", "")

    # 1. Discount from peak → potential upside (30 pts)
    if near < -30:   score += 30   # massive discount = huge upside if thesis correct
    elif near < -20: score += 22
    elif near < -12: score += 15
    elif near < -5:  score += 8

    # 2. Early recovery signal — most predictive pattern (25 pts)
    if p1d > 2 and p30 < -5:      # big up day after sustained weakness = reversal
        score += 25
    elif p1d > 1 and p365 < -5:   # up day in beaten-down sector
        score += 15
    elif p30 > 5 and p365 < 0:    # 30d recovery in negative annual
        score += 18

    # 3. Macro alignment (25 pts)
    vix      = macro_state.get("vix", 15)
    fii_signal = macro_state.get("fii_signal", "NEUTRAL")
    regime   = macro_state.get("regime", "SIDEWAYS")

    if key in ("IT", "PHARMA") and vix > 18:
        score += 15   # defensive sectors outperform in high VIX
    if key in ("BANK", "FINSERV", "AUTO") and regime == "BULL" and fii_signal == "BUYING":
        score += 20   # cyclicals outperform in bull + FII buying
    if key in ("METAL", "ENERGY") and macro_state.get("crude_signal") == "RISING":
        score += 15
    if key == "IT" and macro_state.get("usd_inr_signal") == "WEAK_INR":
        score += 15   # weak INR = IT earns more in rupee terms
    if key in ("REALTY", "AUTO", "FINSERV") and macro_state.get("rate_signal") == "FALLING":
        score += 15   # rate-sensitive sectors benefit from rate cuts

    # 4. Phase bonus (20 pts)
    if phase == "EARLY RECOVERY": score += 20
    elif phase == "DEEP VALUE":   score += 15
    elif phase == "RECOVERY":     score += 10
    elif phase == "CORRECTION":   score += 8
    elif phase == "MOMENTUM":     score += 5

    return min(score, 100)
