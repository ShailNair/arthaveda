"""
India Macro Risk Gauge
Aggregates market-wide signals to produce a 0-10 risk score.
0-3 = Safe (green), 4-6 = Caution (amber), 7-10 = Danger (red)

Data sources (all free, NSE):
- India VIX from allIndices
- Market breadth (gainers vs losers) from equity-stockIndices
- FII/DII daily net flows from NSE fiidiiTradeReact
- Nifty 50 momentum
"""
import json
from datetime import datetime
from typing import Dict, Optional
from services.nse_data import _nse_get, _cache_valid, _cache_set

MACRO_CACHE_TTL = 300   # 5 minutes


def get_macro_risk() -> Dict:
    key = "macro_risk"
    if _cache_valid(key, MACRO_CACHE_TTL):
        from services.nse_data import _cache
        return _cache[key]

    result = {
        "risk_score":   3,
        "label":        "Normal",
        "color":        "#60a5fa",
        "advice":       "Markets look balanced. Normal investment conditions.",
        "components": {
            "vix":          {"value": None, "signal": "Unknown", "pts": 0},
            "fii_flow":     {"value": None, "signal": "Unknown", "pts": 0},
            "breadth":      {"value": None, "signal": "Unknown", "pts": 0},
            "nifty_trend":  {"value": None, "signal": "Unknown", "pts": 0},
        },
        "sip_advice":    "Maintain regular SIP. No changes needed.",
        "timestamp":     datetime.now().isoformat(),
    }

    total_risk = 0

    # ── 1. India VIX (0-3 pts) ────────────────────────────────────────────────
    try:
        indices = _nse_get("allIndices")
        if indices and "data" in indices:
            for idx in indices["data"]:
                sym = idx.get("indexSymbol", "")
                if "VIX" in sym.upper() or sym == "India VIX":
                    vix = float(idx.get("last", 0))
                    if vix > 0:
                        result["components"]["vix"]["value"] = round(vix, 2)
                        if vix < 13:
                            pts, sig = 0, "Low Fear"
                        elif vix < 16:
                            pts, sig = 1, "Normal"
                        elif vix < 20:
                            pts, sig = 2, "Elevated"
                        else:
                            pts, sig = 3, "High Fear"
                        result["components"]["vix"]["pts"] = pts
                        result["components"]["vix"]["signal"] = sig
                        total_risk += pts
                    break
    except Exception as e:
        print(f"[Macro] VIX error: {e}")

    # ── 2. FII/DII Net Flows (0-3 pts) ────────────────────────────────────────
    try:
        fii_data = _nse_get("fiidiiTradeReact")
        if fii_data:
            # Find FII net buy/sell in cash market
            fii_net = None
            if isinstance(fii_data, list):
                for row in fii_data:
                    cat = str(row.get("category", "")).upper()
                    if "FII" in cat or "FPI" in cat:
                        buy  = float(row.get("buyValue",  0) or 0)
                        sell = float(row.get("sellValue", 0) or 0)
                        fii_net = buy - sell
                        break
            elif isinstance(fii_data, dict):
                for key_name in ["data", "fii", "FII"]:
                    if key_name in fii_data:
                        rows = fii_data[key_name]
                        if isinstance(rows, list) and rows:
                            r = rows[0]
                            buy  = float(r.get("buyValue",  r.get("netBuy",  0)) or 0)
                            sell = float(r.get("sellValue", r.get("netSell", 0)) or 0)
                            fii_net = buy - sell
                            break

            if fii_net is not None:
                result["components"]["fii_flow"]["value"] = round(fii_net / 1e7, 1)  # in crore
                if fii_net > 1000_00_00:    # > 1000 crore buying
                    pts, sig = 0, "Strong Buying"
                elif fii_net > 0:
                    pts, sig = 1, "Net Buying"
                elif fii_net > -1000_00_00:  # < 1000 crore selling
                    pts, sig = 2, "Net Selling"
                else:
                    pts, sig = 3, "Heavy Selling"
                result["components"]["fii_flow"]["pts"] = pts
                result["components"]["fii_flow"]["signal"] = sig
                total_risk += pts
    except Exception as e:
        print(f"[Macro] FII error: {e}")

    # ── 3. Market Breadth — gainers vs losers (0-2 pts) ──────────────────────
    try:
        idx_data = _nse_get("equity-stockIndices?index=NIFTY%2050")
        if idx_data and "data" in idx_data:
            stocks = [s for s in idx_data["data"] if s.get("symbol") != "Nifty 50"]
            gainers = sum(1 for s in stocks if float(s.get("pChange", 0)) > 0)
            losers  = sum(1 for s in stocks if float(s.get("pChange", 0)) < 0)
            total   = gainers + losers or 1
            breadth = gainers / total * 100
            result["components"]["breadth"]["value"] = round(breadth, 1)
            if breadth >= 65:
                pts, sig = 0, "Broad Advance"
            elif breadth >= 45:
                pts, sig = 1, "Balanced"
            else:
                pts, sig = 2, "Broad Decline"
            result["components"]["breadth"]["pts"] = pts
            result["components"]["breadth"]["signal"] = sig
            total_risk += pts
    except Exception as e:
        print(f"[Macro] Breadth error: {e}")

    # ── 4. Nifty 50 short-term trend (0-2 pts) ────────────────────────────────
    try:
        idx_data2 = _nse_get("allIndices")
        if idx_data2 and "data" in idx_data2:
            for idx in idx_data2["data"]:
                if idx.get("indexSymbol") == "NIFTY 50":
                    pchange = float(idx.get("percentChange", 0))
                    result["components"]["nifty_trend"]["value"] = round(pchange, 2)
                    if pchange >= 0.5:
                        pts, sig = 0, "Positive"
                    elif pchange >= -0.5:
                        pts, sig = 1, "Flat"
                    else:
                        pts, sig = 2, "Negative"
                    result["components"]["nifty_trend"]["pts"] = pts
                    result["components"]["nifty_trend"]["signal"] = sig
                    total_risk += pts
                    break
    except Exception as e:
        print(f"[Macro] Nifty trend error: {e}")

    # ── Final scoring ──────────────────────────────────────────────────────────
    result["risk_score"] = min(total_risk, 10)
    score = result["risk_score"]

    if score <= 2:
        result["label"]      = "Safe"
        result["color"]      = "#4ade80"
        result["advice"]     = "Low market risk. Good time to invest and deploy capital."
        result["sip_advice"] = "Increase SIP if possible. Market conditions are favourable."
    elif score <= 4:
        result["label"]      = "Normal"
        result["color"]      = "#60a5fa"
        result["advice"]     = "Normal market conditions. Invest as per your plan."
        result["sip_advice"] = "Maintain regular SIP. No changes needed."
    elif score <= 6:
        result["label"]      = "Caution"
        result["color"]      = "#f59e0b"
        result["advice"]     = "Elevated risk signals. Prefer quality large-caps. Reduce speculative bets."
        result["sip_advice"] = "Continue SIP but avoid lump-sum additions. Focus on large-cap funds."
    else:
        result["label"]      = "Danger"
        result["color"]      = "#f87171"
        result["advice"]     = "High market risk. Consider reducing exposure. Defensive assets preferred."
        result["sip_advice"] = "Pause lump-sum investments. Continue SIP only. Add liquid/gold fund allocation."

    _cache_set(key, result)
    return result
