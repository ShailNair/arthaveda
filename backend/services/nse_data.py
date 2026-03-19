"""
NSE/BSE Market Data Service
Uses NSE India's official website API — free, no key needed, real-time
Falls back to yfinance for historical OHLCV data
"""
import requests, time, brotli, json, os, numpy as np
from datetime import datetime
from typing import Dict, List, Optional
import yfinance as yf

BASE_DIR = os.path.dirname(os.path.dirname(__file__))
with open(os.path.join(BASE_DIR, "data", "sector_mapping.json"), "r") as f:
    SECTOR_MAP = json.load(f)

SYMBOL_NAME_MAP: Dict[str, str] = {}
for _sd in SECTOR_MAP.values():
    for _s in _sd["stocks"]:
        SYMBOL_NAME_MAP[_s["symbol"]] = _s["name"]

WATCHLIST_SYMBOLS = list(SYMBOL_NAME_MAP.keys())

_cache: Dict = {}
_cache_time: Dict = {}
CACHE_TTL_LIVE   = 120    # 2 min for live prices
CACHE_TTL_HIST   = 1800   # 30 min for history


def _cache_valid(key: str, ttl: int = CACHE_TTL_LIVE) -> bool:
    return key in _cache_time and (datetime.now() - _cache_time[key]).seconds < ttl


def _cache_set(key: str, val):
    _cache[key] = val
    _cache_time[key] = datetime.now()


# ─── NSE Session ─────────────────────────────────────────────────────────────
_nse_session: Optional[requests.Session] = None
_nse_session_time: Optional[datetime] = None


def _get_nse_session() -> requests.Session:
    global _nse_session, _nse_session_time
    now = datetime.now()
    # Renew session every 25 minutes
    if _nse_session and _nse_session_time and (now - _nse_session_time).seconds < 1500:
        return _nse_session

    s = requests.Session()
    s.headers.update({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': 'https://www.nseindia.com/',
        'Connection': 'keep-alive',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
    })
    try:
        s.get('https://www.nseindia.com/market-data/live-equity-market', timeout=10)
        time.sleep(0.5)
    except Exception as e:
        print(f"[NSE] Session init warning: {e}")

    _nse_session = s
    _nse_session_time = now
    return s


def _nse_get(endpoint: str) -> Optional[Dict]:
    """Make a request to NSE API with Brotli decoding"""
    session = _get_nse_session()
    url = f"https://www.nseindia.com/api/{endpoint}"
    try:
        r = session.get(url, timeout=10)
        content = r.content
        if not content:
            return None
        # Decode Brotli if needed
        try:
            content = brotli.decompress(content)
        except Exception:
            pass
        return json.loads(content)
    except Exception as e:
        print(f"[NSE] API error ({endpoint}): {e}")
        return None


# ─── Market Overview ──────────────────────────────────────────────────────────
def get_market_overview() -> Dict:
    key = "market_overview"
    if _cache_valid(key, CACHE_TTL_LIVE):
        return _cache[key]

    result = {
        "nifty50": 0.0, "nifty50_change": 0.0,
        "sensex": 0.0, "sensex_change": 0.0,
        "nifty_bank": 0.0, "nifty_bank_change": 0.0,
        "market_regime": "SIDEWAYS", "regime_confidence": 60,
        "fii_net": None, "dii_net": None,
        "top_gainers": [], "top_losers": [],
        "timestamp": datetime.now().isoformat()
    }

    try:
        data = _nse_get("allIndices")
        if data and "data" in data:
            for idx in data["data"]:
                sym = idx.get("indexSymbol", "")
                last = float(idx.get("last", 0))
                chg  = float(idx.get("percentChange", 0))
                if sym == "NIFTY 50":
                    result["nifty50"] = last; result["nifty50_change"] = chg
                elif sym == "NIFTY BANK":
                    result["nifty_bank"] = last; result["nifty_bank_change"] = chg

        # Sensex from BSE
        bse = _get_sensex()
        if bse:
            result["sensex"] = bse["price"]
            result["sensex_change"] = bse["change"]

        result["market_regime"] = _detect_regime(result["nifty50_change"])
        result["regime_confidence"] = _regime_confidence(result["nifty50_change"])

        # Top gainers/losers from NSE
        movers = _get_nse_movers()
        result["top_gainers"] = movers["gainers"]
        result["top_losers"]  = movers["losers"]

    except Exception as e:
        print(f"[NSE] Overview error: {e}")

    _cache_set(key, result)
    return result


def _get_sensex() -> Optional[Dict]:
    try:
        r = requests.get(
            "https://api.bseindia.com/BseIndiaAPI/api/ComHeader/w",
            headers={"User-Agent": "Mozilla/5.0", "Referer": "https://www.bseindia.com/"},
            timeout=8
        )
        d = r.json()
        price  = float(d.get("Sensex", 0))
        change = float(d.get("SensexChange", 0))
        pct    = float(d.get("SensexChangePercent", 0))
        return {"price": price, "change": pct}
    except Exception:
        return None


def _get_nse_movers() -> Dict:
    key = "nse_movers"
    if _cache_valid(key, 300):
        return _cache[key]

    gainers, losers = [], []
    try:
        data = _nse_get("equity-stockIndices?index=NIFTY%2050")
        if data and "data" in data:
            stocks = data["data"][1:]  # skip index itself
            for s in stocks:
                sym  = s.get("symbol", "")
                chg  = float(s.get("pChange", 0))
                ltp  = float(s.get("lastPrice", 0))
                entry = {"symbol": sym, "change_pct": round(chg, 2), "price": ltp}
                (gainers if chg > 0 else losers).append(entry)
    except Exception as e:
        print(f"[NSE] Movers error: {e}")

    result = {
        "gainers": sorted(gainers, key=lambda x: x["change_pct"], reverse=True)[:5],
        "losers":  sorted(losers,  key=lambda x: x["change_pct"])[:5]
    }
    _cache_set(key, result)
    return result


def _detect_regime(change: float) -> str:
    if change > 0.5:  return "BULL"
    if change < -0.5: return "BEAR"
    return "SIDEWAYS"


def _regime_confidence(change: float) -> int:
    a = abs(change)
    if a > 2: return 90
    if a > 1: return 75
    if a > 0.5: return 60
    return 50


# ─── Stock Quote (live) ───────────────────────────────────────────────────────
def get_live_quote(symbol_ns: str) -> Optional[Dict]:
    """Get live NSE quote — symbol like 'RELIANCE' (without .NS)"""
    sym = symbol_ns.replace(".NS", "").upper()
    key = f"quote_{sym}"
    if _cache_valid(key, CACHE_TTL_LIVE):
        return _cache[key]

    try:
        data = _nse_get(f"quote-equity?symbol={requests.utils.quote(sym)}")
        if not data:
            return None
        pi = data.get("priceInfo", {})
        dd = data.get("industryInfo", {})
        result = {
            "symbol":     sym,
            "name":       data.get("info", {}).get("companyName", sym),
            "price":      float(pi.get("lastPrice", 0)),
            "change_pct": float(pi.get("pChange", 0)),
            "open":       float(pi.get("open", 0)),
            "high":       float(pi.get("intraDayHighLow", {}).get("max", 0)),
            "low":        float(pi.get("intraDayHighLow", {}).get("min", 0)),
            "prev_close": float(pi.get("previousClose", 0)),
            "week_high":  float(pi.get("weekHighLow", {}).get("max", 0)),
            "week_low":   float(pi.get("weekHighLow", {}).get("min", 0)),
            "sector":     dd.get("macro", "Unknown"),
        }
        _cache_set(key, result)
        return result
    except Exception as e:
        print(f"[NSE] Quote error for {sym}: {e}")
        return None


# ─── Historical data (yfinance with rate limiting) ────────────────────────────
def get_stock_data(symbol: str, period: str = "6mo") -> Dict:
    key = f"hist_{symbol}_{period}"
    if _cache_valid(key, CACHE_TTL_HIST):
        return _cache[key]

    name = SYMBOL_NAME_MAP.get(symbol, symbol.replace(".NS", ""))
    result = {"symbol": symbol, "name": name, "price": 0, "data": [], "indicators": {}}

    # Try live quote first for current price
    live = get_live_quote(symbol)
    if live:
        result["price"] = live["price"]
        result["name"]  = live.get("name", name)

    # Historical OHLCV via yfinance (with retry)
    try:
        for attempt in range(3):
            try:
                data = yf.download(symbol, period=period, progress=False, auto_adjust=True)
                if not data.empty:
                    break
            except Exception:
                pass
            time.sleep(2 * (attempt + 1))

        if not data.empty:
            closes  = data["Close"].values.flatten().astype(float)
            volumes = data["Volume"].values.flatten().astype(float)
            opens   = data["Open"].values.flatten().astype(float)
            highs   = data["High"].values.flatten().astype(float)
            lows    = data["Low"].values.flatten().astype(float)
            dates   = data.index

            ohlcv = [
                {
                    "date":   d.strftime("%Y-%m-%d") if hasattr(d, "strftime") else str(d)[:10],
                    "open":   round(float(opens[i]),  2),
                    "high":   round(float(highs[i]),  2),
                    "low":    round(float(lows[i]),   2),
                    "close":  round(float(closes[i]), 2),
                    "volume": int(volumes[i])
                }
                for i, d in enumerate(dates)
            ]

            if not result["price"] and len(closes):
                result["price"] = round(float(closes[-1]), 2)

            result["data"]       = ohlcv
            result["indicators"] = _compute_indicators(closes, volumes)
    except Exception as e:
        print(f"[NSE] History error for {symbol}: {e}")

    # If still no price, check live quote again
    if result["price"] == 0 and live:
        result["price"] = live["price"]

    _cache_set(key, result)
    return result


def _compute_indicators(closes: np.ndarray, volumes: np.ndarray) -> Dict:
    ind = {}
    try:
        c = closes.astype(float); v = volumes.astype(float)

        if len(c) >= 15:
            delta = np.diff(c)
            g = np.where(delta > 0, delta, 0.0); l = np.where(delta < 0, -delta, 0.0)
            rs = np.mean(g[-14:]) / (np.mean(l[-14:]) + 1e-10)
            ind["rsi"] = round(100 - (100 / (1 + rs)), 2)

        if len(v) >= 21:
            ind["volume_ratio"] = round(float(v[-1]) / (np.mean(v[-21:-1]) + 1), 2)

        if len(c) >= 50:  ind["ma50"]  = round(float(np.mean(c[-50:])),  2)
        if len(c) >= 200: ind["ma200"] = round(float(np.mean(c[-200:])), 2)

        if len(c) >= 252:
            h52 = np.max(c[-252:])
            ind["pct_from_52w_high"] = round(((c[-1] - h52) / h52) * 100, 2)

        if len(c) >= 26:
            e12 = _ema(c, 12); e26 = _ema(c, 26); macd = e12 - e26; sig = _ema(macd, 9)
            ind["macd_histogram"] = round(float(macd[-1] - sig[-1]), 3)
    except Exception as e:
        print(f"[Indicators] {e}")
    return ind


def _ema(d: np.ndarray, p: int) -> np.ndarray:
    a = 2 / (p + 1); e = np.zeros_like(d, dtype=float); e[0] = d[0]
    for i in range(1, len(d)): e[i] = a * d[i] + (1 - a) * e[i - 1]
    return e


def get_stock_score_data(symbol: str) -> Dict:
    """
    Get scoring data purely from NSE live API — no yfinance needed.
    Uses equity-stockIndices for bulk data + quote-equity for PE/VWAP.
    """
    sym = symbol.replace(".NS", "").upper()
    key = f"score_{sym}"
    if _cache_valid(key, CACHE_TTL_LIVE):
        return _cache[key]

    name = SYMBOL_NAME_MAP.get(symbol, sym)
    result = {
        "symbol": symbol, "name": name, "price": 0,
        "pchange_today": 0.0, "pchange_30d": 0.0, "pchange_365d": 0.0,
        "year_high": 0.0, "year_low": 0.0, "near_52w_high_pct": 0.0,
        "volume": 0, "free_float_mcap": 0.0,
        "pe_ratio": None, "sector_pe": None, "vwap": 0.0,
        "sector": "Unknown",
    }

    # Fetch from equity-stockIndices (usually already cached via movers call)
    try:
        idx_data = _nse_get("equity-stockIndices?index=NIFTY%2050")
        if idx_data and "data" in idx_data:
            for s in idx_data["data"]:
                if s.get("symbol") == sym:
                    result["price"]           = float(s.get("lastPrice", 0))
                    result["pchange_today"]   = float(s.get("pChange", 0))
                    result["pchange_30d"]     = float(s.get("perChange30d", 0))
                    result["pchange_365d"]    = float(s.get("perChange365d", 0))
                    result["year_high"]       = float(s.get("yearHigh", 0))
                    result["year_low"]        = float(s.get("yearLow", 0))
                    # NSE nearWKH is positive % below 52w high; negate so -12 = 12% below high
                    result["near_52w_high_pct"] = -abs(float(s.get("nearWKH", 0)))
                    result["volume"]          = int(s.get("totalTradedVolume", 0))
                    result["free_float_mcap"] = float(s.get("ffmc", 0))
                    result["name"]            = s.get("meta", {}).get("companyName", name)
                    break
    except Exception as e:
        print(f"[NSE] stockIndices error for {sym}: {e}")

    # If not in Nifty 50, try broader index
    if result["price"] == 0:
        try:
            idx_data2 = _nse_get("equity-stockIndices?index=NIFTY%20500")
            if idx_data2 and "data" in idx_data2:
                for s in idx_data2["data"]:
                    if s.get("symbol") == sym:
                        result["price"]           = float(s.get("lastPrice", 0))
                        result["pchange_today"]   = float(s.get("pChange", 0))
                        result["pchange_30d"]     = float(s.get("perChange30d", 0))
                        result["pchange_365d"]    = float(s.get("perChange365d", 0))
                        result["year_high"]       = float(s.get("yearHigh", 0))
                        result["year_low"]        = float(s.get("yearLow", 0))
                        result["near_52w_high_pct"] = -abs(float(s.get("nearWKH", 0)))
                        result["volume"]          = int(s.get("totalTradedVolume", 0))
                        result["free_float_mcap"] = float(s.get("ffmc", 0))
                        result["name"]            = s.get("meta", {}).get("companyName", name)
                        break
        except Exception:
            pass

    # Fall back to individual quote if still no price
    if result["price"] == 0:
        live = get_live_quote(symbol)
        if live:
            result["price"] = live["price"]
            result["pchange_today"] = live.get("change_pct", 0)
            result["year_high"] = live.get("week_high", 0)
            result["year_low"] = live.get("week_low", 0)
            result["sector"] = live.get("sector", "Unknown")

    # Get PE ratio and VWAP from individual quote endpoint (cached 2 min)
    try:
        qdata = _nse_get(f"quote-equity?symbol={requests.utils.quote(sym)}")
        if qdata:
            pi = qdata.get("priceInfo", {})
            md = qdata.get("metadata", {})
            ii = qdata.get("industryInfo", {})
            result["vwap"]      = float(pi.get("vwap", 0))
            result["pe_ratio"]  = _safe_float(md.get("pdSymbolPe"))
            result["sector_pe"] = _safe_float(md.get("pdSectorPe"))
            result["sector"]    = ii.get("sector", result["sector"])
            if not result["year_high"] and pi.get("weekHighLow"):
                result["year_high"] = float(pi["weekHighLow"].get("max", 0))
                result["year_low"]  = float(pi["weekHighLow"].get("min", 0))
            if not result["near_52w_high_pct"] and result["year_high"] and result["price"]:
                result["near_52w_high_pct"] = ((result["price"] - result["year_high"]) / result["year_high"]) * 100
    except Exception as e:
        print(f"[NSE] Quote PE error for {sym}: {e}")

    _cache_set(key, result)
    return result


def _safe_float(v) -> Optional[float]:
    try:
        return float(v) if v not in (None, "", "0", 0) else None
    except Exception:
        return None


def get_bulk_deals() -> List[Dict]:
    key = "bulk_deals"
    if _cache_valid(key, 900):
        return _cache[key]

    deals = []
    try:
        data = _nse_get("equity-stockIndices?index=NIFTY%2050")
        if data and "data" in data:
            for s in data["data"][1:]:
                sym = s.get("symbol", "")
                vol = float(s.get("totalTradedVolume", 0))
                avg_vol = float(s.get("ffmc", vol))  # approximate
                if avg_vol > 0 and vol / avg_vol > 2.5:
                    deals.append({
                        "symbol": sym,
                        "name":   SYMBOL_NAME_MAP.get(sym + ".NS", sym),
                        "volume_ratio": round(vol / avg_vol, 2),
                        "price":  float(s.get("lastPrice", 0)),
                        "signal": "UNUSUAL_VOLUME"
                    })
    except Exception as e:
        print(f"[BulkDeals] {e}")

    deals = sorted(deals, key=lambda x: x["volume_ratio"], reverse=True)[:10]
    _cache_set(key, deals)
    return deals


def get_breakout_candidates() -> List[Dict]:
    key = "breakouts"
    if _cache_valid(key, 1800):
        return _cache[key]

    candidates = []
    sample = WATCHLIST_SYMBOLS[:15]
    for sym in sample:
        try:
            data = get_stock_data(sym, "6mo")
            ohlcv = data.get("data", [])
            if len(ohlcv) < 60:
                continue
            closes = np.array([d["close"] for d in ohlcv], dtype=float)
            vola = np.std(closes[-20:]) / np.mean(closes[-20:]) * 100
            h52  = np.max(closes[-min(252, len(closes)):])
            if vola < 4.0 and closes[-1] > h52 * 0.92:
                candidates.append({
                    "symbol":        sym.replace(".NS", ""),
                    "name":          SYMBOL_NAME_MAP.get(sym, sym),
                    "price":         round(float(closes[-1]), 2),
                    "volatility_pct":round(vola, 2),
                    "near_52w_high": round((closes[-1] / h52) * 100, 1),
                    "detail":        f"Tight {vola:.1f}% range near 52w high — coiled spring"
                })
            time.sleep(0.5)  # rate limit
        except Exception:
            continue

    candidates = sorted(candidates, key=lambda x: x["near_52w_high"], reverse=True)[:10]
    _cache_set(key, candidates)
    return candidates
