"""
The Lottery Scorer — Core Engine (NSE-only, no yfinance)
Score >= 80 = Lottery Alert
Score 60-79 = Strong opportunity
Includes: Trust Score, Forensic Flags, FII Pressure signals
"""
import json, os, time
from datetime import datetime
from typing import Dict, List, Optional
from services.nse_data import (
    get_stock_score_data, get_market_overview,
    SECTOR_MAP, SYMBOL_NAME_MAP, _nse_get
)
from services.trust_score import compute_trust_score

BASE_DIR = os.path.dirname(os.path.dirname(__file__))

HOW_TO_BUY = {
    "zerodha": [
        "Open Zerodha Kite app on your phone",
        "Search for the stock name in the search bar",
        "Tap on the stock → Tap 'BUY' button",
        "Select 'NSE' exchange, enter quantity (start with what you can afford to lose)",
        "Choose 'LIMIT' order type, set price slightly above current price",
        "Review and tap 'Submit Order' — done! ✅"
    ],
    "groww": [
        "Open Groww app on your phone",
        "Tap 'Stocks' from the bottom menu",
        "Search for the company name",
        "Tap 'Buy' on the stock page",
        "Enter number of shares and tap 'Place Order'",
        "Confirm with your PIN — done! ✅"
    ],
}

ANTI_SCAM = {"min_price": 20}

# Prioritised stocks — scan these first (best quality signals)
PRIORITY_STOCKS = [
    "HAL.NS", "BEL.NS", "RELIANCE.NS", "TCS.NS", "INFY.NS",
    "NTPC.NS", "SUNPHARMA.NS", "DIVISLAB.NS", "WAAREEENER.NS",
    "LT.NS", "HDFCBANK.NS", "ADANIPORTS.NS", "DIXON.NS",
    "COALINDIA.NS", "NMDC.NS", "HCLTECH.NS", "TECHM.NS",
    "BAJFINANCE.NS", "ICICIBANK.NS", "WIPRO.NS",
]


def _passes_scam_filter(data: Dict) -> tuple:
    price = data.get("price", 0)
    if price < ANTI_SCAM["min_price"]:
        return False, f"Price Rs.{price} too low — penny stock excluded"
    return True, "OK"


def _score_technical(data: Dict) -> tuple:
    """
    Technical score using NSE-provided data:
    - nearWKH (% from 52-week high) — buying zone detection
    - pchange_today — today's momentum
    - pchange_30d — medium-term trend
    - Price vs VWAP — intraday strength
    Max: 25 pts
    """
    score, signals = 0, []

    near52 = data.get("near_52w_high_pct", 0)   # negative = below 52w high
    p_today = data.get("pchange_today", 0)
    p_30d = data.get("pchange_30d", 0)
    p_365d = data.get("pchange_365d", 0)
    price = data.get("price", 0)
    vwap = data.get("vwap", 0)
    year_high = data.get("year_high", 0)
    year_low = data.get("year_low", 0)

    # 1. 52-week position — buy zone scoring
    if -20 <= near52 <= -3:
        score += 7
        signals.append(f"Price is {abs(near52):.0f}% below 52-week high — classic buying opportunity zone")
    elif -35 <= near52 < -20:
        score += 5
        signals.append(f"Stock is {abs(near52):.0f}% below 52-week high — deep discount from recent peak")
    elif near52 > -3:
        score += 2  # near high, momentum play
        signals.append("Near 52-week high — strong momentum stock")

    # 2. Today's price action
    if p_today >= 3.0:
        score += 7
        signals.append(f"Up {p_today:.1f}% today — strong buying momentum, likely institutional")
    elif p_today >= 1.5:
        score += 5
        signals.append(f"Up {p_today:.1f}% today — above-average buying interest")
    elif p_today >= 0.5:
        score += 3
        signals.append(f"Up {p_today:.1f}% today — positive movement")
    elif p_today < -2.0:
        score -= 2

    # 3. Bounce signal — down in 30d but recovering today
    if p_30d < -8 and p_today > 1.5:
        score += 6
        signals.append(f"Down {abs(p_30d):.0f}% in past month but bouncing up {p_today:.1f}% today — potential reversal point")
    elif p_30d < -4 and p_today > 0.5:
        score += 3
        signals.append(f"Recovering after {abs(p_30d):.0f}% pullback — value entry emerging")

    # 4. Annual trend (confirms quality)
    if p_365d > 25:
        score += 4
        signals.append(f"Up {p_365d:.0f}% over past year — strong long-term momentum")
    elif p_365d > 10:
        score += 2

    # 5. Price vs VWAP — intraday strength
    if vwap and price and price > vwap * 1.01:
        score += 3
        signals.append("Trading above today's average price — buyers in control")

    # 6. 52-week range position (lower = more upside)
    if year_high and year_low and year_high > year_low:
        range_pos = (price - year_low) / (year_high - year_low) * 100
        if range_pos < 30:
            score += 4
            signals.append(f"In lower {range_pos:.0f}% of 52-week range — significant upside potential")

    return min(score, 25), signals


def _score_smart_money(data: Dict) -> tuple:
    """
    Smart money detection using NSE live data:
    - Free float turnover % (high = institutional activity)
    - Price+volume divergence
    Max: 30 pts
    """
    score, signals = 0, []
    price = data.get("price", 0)
    volume = data.get("volume", 0)
    ffmc = data.get("free_float_mcap", 0)
    p_today = data.get("pchange_today", 0)
    p_30d = data.get("pchange_30d", 0)
    year_high = data.get("year_high", 0)
    year_low = data.get("year_low", 0)

    # 1. Free float turnover ratio
    if ffmc > 0 and volume > 0 and price > 0:
        traded_value = volume * price
        ff_turnover = (traded_value / ffmc) * 100
        if ff_turnover > 0.8:
            score += 15
            signals.append(f"Exceptional trading: {ff_turnover:.1f}% of free float traded today — strong institutional conviction")
        elif ff_turnover > 0.4:
            score += 10
            signals.append(f"High activity: {ff_turnover:.1f}% of free float traded — above-average institutional interest")
        elif ff_turnover > 0.15:
            score += 5
            signals.append(f"Moderate activity: {ff_turnover:.1f}% of free float trading hands today")

    # 2. Smart money buying pattern — big price+volume move
    if p_today > 2.5 and volume > 0:
        score += 8
        signals.append(f"Strong up-move of {p_today:.1f}% — price+volume confirms institutional buying")
    elif p_today > 1.0:
        score += 4

    # 3. Recovery from oversold with buying (bottom fishing by institutions)
    if year_high > year_low > 0:
        range_pos = (price - year_low) / (year_high - year_low)
        if range_pos < 0.25 and p_today > 0.5:
            score += 10
            signals.append("Near 52-week low but buying today — institutions accumulating at bottom")
        elif range_pos < 0.35 and p_30d < -10 and p_today > 0:
            score += 7
            signals.append("Severely beaten down stock with renewed buying — smart money stepping in")

    # 4. FII/DII sentiment from market overview
    try:
        mkt = get_market_overview()
        gainers = [g["symbol"] for g in mkt.get("top_gainers", [])]
        sym_clean = data.get("symbol", "").replace(".NS", "")
        if sym_clean in gainers:
            score += 5
            signals.append("Featured in today's top gainers — strong market recognition")
    except Exception:
        pass

    return min(score, 30), signals


def _score_fundamental(data: Dict) -> tuple:
    """
    Fundamental score using NSE PE data.
    Max: 20 pts
    """
    score, signals = 8, []  # base score
    pe = data.get("pe_ratio")
    sector_pe = data.get("sector_pe")
    p_365d = data.get("pchange_365d", 0)

    if pe and sector_pe and sector_pe > 0:
        if pe < sector_pe * 0.8:
            score += 8
            signals.append(f"P/E of {pe:.1f} is {((sector_pe - pe)/sector_pe*100):.0f}% below sector average ({sector_pe:.1f}) — undervalued")
        elif pe < sector_pe:
            score += 4
            signals.append(f"P/E of {pe:.1f} is below sector average ({sector_pe:.1f}) — reasonable valuation")
        elif pe > sector_pe * 1.5:
            score -= 3
    elif pe:
        if pe < 20:
            score += 5
            signals.append(f"Low P/E of {pe:.1f} — attractively valued")
        elif pe < 35:
            score += 2

    if p_365d > 20:
        score += 4
        signals.append(f"Strong {p_365d:.0f}% annual return — fundamentally growing company")
    elif p_365d > 0:
        score += 2
        signals.append("Positive annual returns — company on growth path")

    return max(0, min(score, 20)), signals


def _score_geo_catalyst(symbol: str, sector: str) -> tuple:
    score, signals = 0, []
    try:
        from services.geo_intelligence import get_high_impact_events
        events = get_high_impact_events()
        stock_sector = None
        for s_name, s_data in SECTOR_MAP.items():
            for stk in s_data["stocks"]:
                if symbol in stk["symbol"]:
                    stock_sector = s_name
                    break
        if not stock_sector and sector:
            # Try to match sector string
            for s_name in SECTOR_MAP:
                if s_name.lower() in sector.lower() or sector.lower() in s_name.lower():
                    stock_sector = s_name
                    break
        if stock_sector:
            for event in events:
                if stock_sector in event.get("affected_sectors", []):
                    bonus = min(int((event.get("india_relevance", 0) + event.get("severity", 0)) / 2), 8)
                    score += bonus
                    signals.append(f"Geo catalyst: '{event['headline'][:55]}' — directly impacts this sector")
                    break
    except Exception as e:
        print(f"[Scorer] Geo err: {e}")
    return min(score, 15), signals


def _score_sentiment_gap(data: Dict) -> tuple:
    """
    Sentiment gap: stock beaten down while fundamentals intact.
    Max: 10 pts
    """
    score, signals = 4, []  # base 4
    near52 = data.get("near_52w_high_pct", 0)
    p_30d = data.get("pchange_30d", 0)
    p_today = data.get("pchange_today", 0)
    p_365d = data.get("pchange_365d", 0)

    if near52 < -25 and p_365d > 0 and p_today > 0:
        score = 10
        signals.append(f"Stock is {abs(near52):.0f}% below peak but annual trend positive — retail panic, value opportunity")
    elif near52 < -15 and p_30d < -8 and p_today > 0:
        score = 8
        signals.append("Significant pullback with recovery starting — market may be oversold on this stock")
    elif p_30d < -5 and p_today > 1.0:
        score = 6
        signals.append("Recent dip with buying today — under the radar recovery signal")

    return score, signals


def score_stock(symbol: str) -> Optional[Dict]:
    try:
        data = get_stock_score_data(symbol)
        if not data or data.get("price", 0) == 0:
            return None

        passes, _ = _passes_scam_filter(data)
        if not passes:
            return None

        sector = data.get("sector", "Unknown")
        all_signals = []
        t_score,  t_sigs  = _score_technical(data)
        sm_score, sm_sigs = _score_smart_money(data)
        f_score,  f_sigs  = _score_fundamental(data)
        g_score,  g_sigs  = _score_geo_catalyst(symbol, sector)
        s_score,  s_sigs  = _score_sentiment_gap(data)

        for sigs in (t_sigs, sm_sigs, f_sigs, g_sigs, s_sigs):
            all_signals.extend(sigs)

        total = max(0, min(t_score + sm_score + f_score + g_score + s_score, 100))
        if total < 50:
            return None

        risk    = _assess_risk(data, total)
        pot     = _estimate_potential(total, risk)
        cat     = _categorize(data, total)
        sym_clean = symbol.replace(".NS", "")
        name    = data.get("name") or SYMBOL_NAME_MAP.get(symbol, sym_clean)

        # Trust score — how reliable is this company historically
        trust = compute_trust_score(data)

        # Forensic flags — red flags to show investor
        forensic_flags = _forensic_flags(data) + trust.get("flags", [])

        return {
            "id":                   f"{sym_clean}_{datetime.now().strftime('%Y%m%d%H')}",
            "symbol":               sym_clean,
            "name":                 name,
            "price":                data.get("price", 0),
            "score":                total,
            "time_horizon":         _horizon(cat),
            "potential_gain_low":   pot[0],
            "potential_gain_high":  pot[1],
            "stop_loss_pct":        pot[2],
            "risk_level":           risk,
            "plain_reason":         _plain(sym_clean, name, all_signals, total),
            "technical_reasons":    all_signals[:5],
            "how_to_buy_zerodha":   HOW_TO_BUY["zerodha"],
            "how_to_buy_groww":     HOW_TO_BUY["groww"],
            "signal_accuracy_pct":  round(50 + (total - 50) * 0.6, 1),
            "category":             cat,
            "catalyst":             (all_signals[0][:80] if all_signals else "Technical setup"),
            "score_breakdown": {
                "technical":      t_score,
                "smart_money":    sm_score,
                "fundamental":    f_score,
                "geopolitical":   g_score,
                "sentiment_gap":  s_score
            },
            "trust_score":          trust["score"],
            "trust_label":          trust["label"],
            "trust_color":          trust["color"],
            "trust_reasons":        trust["reasons"],
            "forensic_flags":       forensic_flags[:4],
            "pchange_365d":         data.get("pchange_365d", 0),
            "pchange_30d":          data.get("pchange_30d", 0),
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        print(f"[Scorer] {symbol}: {e}")
        return None


def _forensic_flags(data: Dict) -> List[str]:
    """Red flags that investors should know before buying."""
    flags = []
    pe      = data.get("pe_ratio")
    p365    = data.get("pchange_365d", 0)
    p30     = data.get("pchange_30d", 0)
    near52  = data.get("near_52w_high_pct", 0)
    price   = data.get("price", 0)
    ffmc    = data.get("free_float_mcap", 0)
    sector_pe = data.get("sector_pe")

    # Valuation concerns
    if pe and pe > 80:
        flags.append(f"Very high P/E ({pe:.0f}x) — needs strong earnings growth to justify price")
    if pe and sector_pe and pe > sector_pe * 2:
        flags.append(f"P/E ({pe:.0f}x) is {pe/sector_pe:.1f}x sector average — expensive vs peers")

    # Trend concerns
    if p365 < -20:
        flags.append(f"Down {abs(p365):.0f}% in past year — underlying business may have weakened")
    if p30 < -15:
        flags.append(f"Fell {abs(p30):.0f}% in last 30 days — investigate trigger before buying")

    # Proximity to lows
    if near52 < -45:
        flags.append(f"Near 52-week lows ({abs(near52):.0f}% below peak) — falling knife risk")

    # Small cap risk
    if 0 < ffmc < 5e9:  # < 50 crore free float
        flags.append("Very small company — low liquidity, difficult to exit quickly")

    return flags


def _assess_risk(data: Dict, score: int) -> str:
    price = data.get("price", 0)
    pe = data.get("pe_ratio")
    if price > 300 and score > 65:  return "Low"
    if price > 100:                 return "Medium"
    return "High"


def _estimate_potential(score: int, risk: str) -> tuple:
    base = score / 5
    if risk == "Low":    return (round(base * 0.5, 1), round(base * 1.0, 1), 7.0)
    if risk == "Medium": return (round(base * 0.8, 1), round(base * 1.5, 1), 10.0)
    return               (round(base * 1.0, 1), round(base * 2.5, 1), 15.0)


def _categorize(data: Dict, score: int) -> str:
    p_today = data.get("pchange_today", 0)
    ffmc = data.get("free_float_mcap", 0)
    volume = data.get("volume", 0)
    price = data.get("price", 1)
    if ffmc > 0 and (volume * price / ffmc) > 0.4:
        return "swing"
    if score >= 80:
        return "event"
    return "trend"


def _horizon(cat: str) -> str:
    return {"swing": "3-10 days", "event": "1-4 weeks", "trend": "1-3 months"}.get(cat, "2-4 weeks")


def _plain(sym: str, name: str, signals: List[str], score: int) -> str:
    pfx = "VERY HIGH CONVICTION" if score >= 85 else "HIGH CONVICTION" if score >= 75 else "MODERATE CONVICTION"
    top = ". Also, ".join(signals[:2]) if signals else "multiple factors align"
    return f"{pfx}: {name} ({sym}) — {top}. This pattern has historically led to significant moves."


def _fetch_all_nse_stocks() -> List[str]:
    """Get symbols from NSE Nifty 100 + sector-specific stocks"""
    symbols = list(PRIORITY_STOCKS)
    # Add sector stocks
    for sector_data in SECTOR_MAP.values():
        for stk in sector_data["stocks"]:
            if stk["symbol"] not in symbols:
                symbols.append(stk["symbol"])
            if len(symbols) >= 30:
                break
        if len(symbols) >= 30:
            break
    return symbols[:30]


def run_full_scan() -> List[Dict]:
    """
    Scan stocks using NSE live data only — fast, no yfinance 429 issues.
    Each stock needs 2 API calls (stockIndices cached, quote-equity fresh).
    Rate limit: 0.5s between stocks = ~15 seconds total for 30 stocks.
    """
    alerts = []
    stocks = _fetch_all_nse_stocks()
    print(f"[Scan] Starting NSE-only scan of {len(stocks)} stocks...")

    for i, sym in enumerate(stocks):
        try:
            result = score_stock(sym)
            if result and result["score"] >= 55:
                alerts.append(result)
                print(f"[Scan] {sym}: score={result['score']} ({result['category']}) OK")
        except Exception as e:
            print(f"[Scan] {sym} error: {e}")

        # Lighter rate limit since NSE is much more permissive than Yahoo Finance
        if i < len(stocks) - 1:
            time.sleep(0.5)

    alerts = sorted(alerts, key=lambda x: x["score"], reverse=True)[:15]
    print(f"[Scan] Complete. {len(alerts)} opportunities found.")
    return alerts
