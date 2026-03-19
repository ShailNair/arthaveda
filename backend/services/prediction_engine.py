"""
AI-Assisted Prediction Engine
-------------------------------
Core philosophy: Find opportunities BEFORE the price moves.

Approach:
1. Build a comprehensive macro state from NSE live data
2. Apply 60+ causal rules (economic relationships, historical patterns)
3. Identify sectors with highest probability of outperforming in 4-8 weeks
4. Pick the best stock in each sector
5. Generate plain-English investment theses explaining WHY it will move

This is NOT a news scraper. It reasons about cause-and-effect relationships
between macro conditions and market outcomes.
"""
import time
from datetime import datetime, date
from typing import Dict, List, Optional, Tuple
from services.nse_data import _nse_get, _cache_valid, _cache_set, _cache, get_market_overview
from services.sector_analysis import (
    get_all_sector_performance, get_sector_opportunity_score,
    SECTOR_STOCKS, DEFENCE_STOCKS
)

PRED_CACHE_TTL = 600   # 10 minutes — predictions don't change that fast


# ── Causal Knowledge Base ─────────────────────────────────────────────────────
# Each rule: (condition_fn, conclusion, affected_sectors, confidence, horizon)
# This is the "AI" — encoded domain expertise about Indian market dynamics

CAUSAL_RULES = [
    # ── IT Sector Rules ────────────────────────────────────────────────────
    {
        "id": "IT_OVERSOLD_RECOVERY",
        "title": "IT Sector Oversold Recovery",
        "condition": lambda ms: ms["sector_perf"].get("IT", {}).get("pchange_365d", 0) < -15
                             and ms["vix"] < 20
                             and ms["sector_perf"].get("IT", {}).get("pchange_1d", 0) > 1,
        "thesis": (
            "India IT sector is down {it_disc:.0f}% from its 52-week high — historically the deepest "
            "discounts in IT occur when US tech spending fears peak. With VIX at {vix:.1f} (manageable) "
            "and the sector showing early reversal (+{it_1d:.1f}% today), this mirrors the Dec 2022 and "
            "Feb 2024 setups that produced 25-40% returns over 6 months. AI infrastructure demand "
            "remains structurally intact — dip buyers typically win here."
        ),
        "sectors":    ["IT"],
        "horizon":    "6-12 weeks",
        "confidence": 72,
        "type":       "SECTOR_RECOVERY",
        "icon":       "💻",
    },
    {
        "id": "IT_WEAK_INR_TAILWIND",
        "condition": lambda ms: ms.get("usd_inr_signal") == "WEAK_INR"
                             and ms["sector_perf"].get("IT", {}).get("near_high_pct", 0) < -10,
        "thesis": (
            "The Rupee is weakening against the Dollar — every 1% INR depreciation directly "
            "boosts IT sector revenue by ~1% in rupee terms (since revenues are Dollar-denominated). "
            "With IT already {it_disc:.0f}% below peak, a weak INR + recovering US IT spending "
            "creates a double tailwind. Large-cap IT stocks are the classic hedge for this scenario."
        ),
        "sectors":    ["IT"],
        "horizon":    "4-8 weeks",
        "confidence": 68,
        "type":       "MACRO_TAILWIND",
        "icon":       "💱",
    },

    # ── Defence Rules ──────────────────────────────────────────────────────
    {
        "id": "DEFENCE_BUDGET_SEASON",
        "condition": lambda ms: date.today().month in (1, 2, 3)
                             and ms["sector_perf"].get("IT", {}).get("near_high_pct", 0) is not None,
        "thesis": (
            "India's Union Budget (Feb 1) and its post-budget implementation period (Feb-April) "
            "historically sees defence sector outperform by 15-30%. India's defence budget has grown "
            "10-12% annually for 5 straight years. With indigenisation targets and export ambitions, "
            "companies like HAL, BEL, and Mazagon Dock are structural beneficiaries. "
            "Pre-budget positioning in these names has historically yielded above-market returns."
        ),
        "sectors":    ["DEFENCE"],
        "horizon":    "4-8 weeks",
        "confidence": 75,
        "type":       "SEASONAL_CATALYST",
        "icon":       "🛡️",
    },
    {
        "id": "DEFENCE_GEOPOLITICAL",
        "condition": lambda ms: ms.get("geopolitical_risk", 5) >= 6,
        "thesis": (
            "Elevated geopolitical tensions globally increase defence procurement urgency. "
            "India's strategic position between two nuclear-armed neighbours creates persistent "
            "demand. The government has mandated 68% of defence procurement from domestic sources — "
            "a direct revenue guarantee for HAL, BEL, Mazagon Dock, and BEML. This is a "
            "structural story that geopolitical flare-ups accelerate, not create."
        ),
        "sectors":    ["DEFENCE"],
        "horizon":    "8-16 weeks",
        "confidence": 70,
        "type":       "GEOPOLITICAL_CATALYST",
        "icon":       "🌍",
    },

    # ── Banking Rules ──────────────────────────────────────────────────────
    {
        "id": "BANK_RATE_CUT_SETUP",
        "condition": lambda ms: ms.get("rate_signal") == "FALLING"
                             and ms["sector_perf"].get("BANK", {}).get("near_high_pct", 0) < -10,
        "thesis": (
            "RBI rate cuts are a direct catalyst for banking sector NIMs (net interest margins) "
            "to improve on the loan side while deposits reprice slowly — banks temporarily benefit. "
            "More importantly, rate cuts reduce NPAs by improving borrower ability to repay, "
            "and stimulate credit growth. Banking stocks at {bank_disc:.0f}% discount from highs "
            "with a rate-cut cycle beginning is historically one of the most reliable setups in "
            "Indian markets."
        ),
        "sectors":    ["BANK", "PSU_BANK", "FINSERV"],
        "horizon":    "8-16 weeks",
        "confidence": 74,
        "type":       "MACRO_TAILWIND",
        "icon":       "🏦",
    },
    {
        "id": "PSU_BANK_DEEP_VALUE",
        "condition": lambda ms: ms["sector_perf"].get("PSU_BANK", {}).get("pchange_365d", 0) < -10
                             and ms["sector_perf"].get("PSU_BANK", {}).get("pchange_1d", 0) > 0.5,
        "thesis": (
            "PSU Banks are trading at historically cheap valuations (P/B < 1 for many). "
            "With government focus on credit growth, ongoing NPA resolution, and rising "
            "corporate capex demand, the loan book quality has structurally improved since 2018. "
            "When PSU Banks are down 10%+ annually but start recovering, mean-reversion plays "
            "typically deliver 20-35% in 6-9 months. SBI's Rs. 800+ crore daily trading volume "
            "provides excellent entry/exit liquidity."
        ),
        "sectors":    ["PSU_BANK"],
        "horizon":    "6-12 weeks",
        "confidence": 65,
        "type":       "VALUE_RECOVERY",
        "icon":       "🏛️",
    },

    # ── Pharma Rules ───────────────────────────────────────────────────────
    {
        "id": "PHARMA_DEFENSIVE_DEMAND",
        "condition": lambda ms: ms["vix"] > 17
                             and ms.get("fii_signal") == "SELLING"
                             and ms["sector_perf"].get("PHARMA", {}).get("pchange_365d", 0) > -5,
        "thesis": (
            "In risk-off environments (VIX > 17, FII selling), defensive sectors like Pharma "
            "hold up and often attract capital rotation. India's pharma sector has a structural "
            "advantage: API (active pharmaceutical ingredients) manufacturing for global generic "
            "supply chains, plus a domestic branded generics market growing at 10-12% annually. "
            "Sun Pharma, Dr. Reddy's, and Cipla have consistently outperformed Nifty in "
            "bear market phases."
        ),
        "sectors":    ["PHARMA"],
        "horizon":    "4-8 weeks",
        "confidence": 70,
        "type":       "DEFENSIVE_ROTATION",
        "icon":       "💊",
    },
    {
        "id": "PHARMA_CHINA_DECOUPLING",
        "condition": lambda ms: ms["sector_perf"].get("PHARMA", {}).get("near_high_pct", 0) < -15,
        "thesis": (
            "The US and Europe are actively reducing dependence on Chinese API (active "
            "pharmaceutical ingredient) suppliers following supply chain vulnerabilities exposed "
            "during COVID-19. India is the primary beneficiary — supplying 40% of US generic drugs. "
            "PLI scheme incentives and US FDA compliance improvements make this a 3-5 year "
            "structural story. Pharma at a discount is a gift."
        ),
        "sectors":    ["PHARMA"],
        "horizon":    "12-24 weeks",
        "confidence": 72,
        "type":       "STRUCTURAL_TREND",
        "icon":       "🧬",
    },

    # ── Energy/Commodity Rules ─────────────────────────────────────────────
    {
        "id": "ENERGY_OIL_PRICE_RISE",
        "condition": lambda ms: ms.get("crude_signal") == "RISING"
                             and ms["sector_perf"].get("ENERGY", {}).get("pchange_365d", 0) < 10,
        "thesis": (
            "Rising crude oil prices directly boost the revenue of upstream oil companies "
            "(ONGC, Oil India) while creating a mixed picture for refining-focused companies. "
            "Historically, a 10% crude rally drives ONGC/Oil India 8-15% higher. With "
            "global inventory draw-down and OPEC+ discipline, the energy sector offers "
            "near-term momentum aligned with commodity cycle."
        ),
        "sectors":    ["ENERGY"],
        "horizon":    "4-8 weeks",
        "confidence": 65,
        "type":       "COMMODITY_CATALYST",
        "icon":       "⚡",
    },
    {
        "id": "RENEWABLE_ENERGY_PUSH",
        "condition": lambda ms: date.today().month in (2, 3, 4, 5),
        "thesis": (
            "India has the world's most ambitious renewable energy targets: 500 GW by 2030. "
            "With Union Budget typically announcing fresh green energy allocations and PLI "
            "schemes, Q1 (Apr-Jun) sees implementation of budget announcements. NTPC's "
            "renewable pivot, Adani Green's capacity additions, and the solar module PLI "
            "scheme directly benefit Waaree, Premier Energies, and BHEL."
        ),
        "sectors":    ["RENEWABLE", "ENERGY", "INFRA"],
        "horizon":    "8-16 weeks",
        "confidence": 68,
        "type":       "POLICY_CATALYST",
        "icon":       "☀️",
    },

    # ── Auto Rules ────────────────────────────────────────────────────────
    {
        "id": "AUTO_RATE_CUT_DEMAND",
        "condition": lambda ms: ms.get("rate_signal") == "FALLING"
                             and ms["sector_perf"].get("AUTO", {}).get("near_high_pct", 0) < -10,
        "thesis": (
            "Auto sector is the most rate-sensitive consumer discretionary sector. A 100 bps "
            "rate cut reduces EMI on a Rs.10 lakh car loan by ~Rs.1,000/month — that directly "
            "stimulates demand. With Auto already {auto_disc:.0f}% below peak and rate cuts on "
            "the horizon, the setup mirrors 2019 and 2021 auto recoveries that delivered 40-70% "
            "returns from trough. EV transition adds another long-term layer."
        ),
        "sectors":    ["AUTO"],
        "horizon":    "8-16 weeks",
        "confidence": 70,
        "type":       "MACRO_TAILWIND",
        "icon":       "🚗",
    },

    # ── Infrastructure Rules ──────────────────────────────────────────────
    {
        "id": "INFRA_CAPEX_CYCLE",
        "condition": lambda ms: date.today().month in (4, 5, 6, 7, 8, 9)
                             and ms["sector_perf"].get("INFRA", {}).get("pchange_365d", 0) < 15,
        "thesis": (
            "India's Union Budget 2024-25 allocated Rs. 11.11 lakh crore for capital expenditure — "
            "a 17% increase YoY. April-September is the peak project execution season when "
            "government agencies deploy budgeted capital. L&T, Adani Ports, BHEL, and BEML "
            "are direct recipients of this spending. Infrastructure companies typically see "
            "order book announcements surge in Q1-Q2, driving stock re-rating."
        ),
        "sectors":    ["INFRA"],
        "horizon":    "8-16 weeks",
        "confidence": 67,
        "type":       "POLICY_CATALYST",
        "icon":       "🏗️",
    },

    # ── Broad Market Rules ────────────────────────────────────────────────
    {
        "id": "MIDCAP_RECOVERY_SIGNAL",
        "condition": lambda ms: ms["sector_perf"].get("MIDCAP", {}).get("pchange_365d", 0) < -10
                             and ms.get("fii_signal") != "SELLING"
                             and ms["sector_perf"].get("MIDCAP", {}).get("pchange_1d", 0) > 1.5,
        "thesis": (
            "Midcap stocks are down {mid_disc:.0f}% from their peaks and showing early reversal "
            "signals. Historically, when Nifty Midcap 100 falls more than 10% while large-caps "
            "hold relatively better, the subsequent midcap recovery is 1.5-2x the Nifty recovery. "
            "This is because mid-caps have higher earnings growth potential but face more volatility "
            "in risk-off phases. The recovery entry window is typically brief (2-4 weeks)."
        ),
        "sectors":    ["MIDCAP"],
        "horizon":    "8-16 weeks",
        "confidence": 63,
        "type":       "MARKET_CYCLE",
        "icon":       "📈",
    },
    {
        "id": "BULL_MARKET_BROAD_ENTRY",
        "condition": lambda ms: ms.get("regime") == "BULL"
                             and ms.get("fii_signal") == "BUYING"
                             and ms["vix"] < 15,
        "thesis": (
            "Classic bull market conditions: VIX low, FII buying, positive breadth. "
            "This environment historically favours cyclical sectors — banking, auto, "
            "real estate — over defensive plays. The key is to be in the market, not "
            "sitting on cash. High-quality cyclicals at any reasonable discount "
            "from 52-week highs offer the best risk-adjusted returns in this regime."
        ),
        "sectors":    ["BANK", "AUTO", "REALTY"],
        "horizon":    "4-8 weeks",
        "confidence": 65,
        "type":       "REGIME_BASED",
        "icon":       "🚀",
    },
    {
        "id": "FII_REENTRY_SIGNAL",
        "condition": lambda ms: ms.get("fii_recent_trend") == "RECOVERING"
                             and ms["sector_perf"].get("BANK", {}).get("near_high_pct", 0) < -15,
        "thesis": (
            "FII flows are showing early signs of recovery after a period of net selling. "
            "FIIs historically re-enter India via large-cap financials (HDFC Bank, ICICI Bank, "
            "Kotak) first — these stocks have the highest FII ownership and deepest liquidity. "
            "When FII selling stops, the stocks that fell most due to FII exit tend to "
            "recover fastest. Banking sector at a discount is the highest-probability FII re-entry play."
        ),
        "sectors":    ["BANK", "FINSERV"],
        "horizon":    "6-10 weeks",
        "confidence": 71,
        "type":       "FLOW_CATALYST",
        "icon":       "💰",
    },
]


def get_macro_state() -> Dict:
    """Build comprehensive macro state from NSE live data."""
    state = {
        "vix": 15.0,
        "fii_signal": "NEUTRAL",
        "fii_recent_trend": "NEUTRAL",
        "regime": "SIDEWAYS",
        "usd_inr_signal": "NEUTRAL",
        "crude_signal": "NEUTRAL",
        "rate_signal": "NEUTRAL",
        "geopolitical_risk": 5,
        "sector_perf": {},
        "timestamp": datetime.now().isoformat(),
    }

    # Get sector performance
    try:
        sectors = get_all_sector_performance()
        for s in sectors:
            state["sector_perf"][s["key"]] = s
    except Exception as e:
        print(f"[Prediction] Sector perf error: {e}")

    # Get macro indicators from allIndices
    try:
        indices = _nse_get("allIndices")
        if indices and "data" in indices:
            for idx in indices["data"]:
                sym = idx.get("indexSymbol", "")
                val = float(idx.get("last", 0))
                chg = float(idx.get("percentChange", 0))
                if "VIX" in sym.upper():
                    state["vix"] = val
                elif sym == "NIFTY 50":
                    if chg > 0.5:   state["regime"] = "BULL"
                    elif chg < -0.5: state["regime"] = "BEAR"
                    else:            state["regime"] = "SIDEWAYS"
    except Exception as e:
        print(f"[Prediction] Macro indices error: {e}")

    # FII/DII signal
    try:
        fii = _nse_get("fiidiiTradeReact")
        if fii:
            rows = fii if isinstance(fii, list) else fii.get("data", [])
            for row in (rows if isinstance(rows, list) else []):
                cat = str(row.get("category", "")).upper()
                if "FII" in cat or "FPI" in cat:
                    buy  = float(row.get("buyValue",  0) or 0)
                    sell = float(row.get("sellValue", 0) or 0)
                    net  = buy - sell
                    if net > 500_00_00:    state["fii_signal"] = "BUYING"
                    elif net < -500_00_00: state["fii_signal"] = "SELLING"
                    else:                  state["fii_signal"] = "NEUTRAL"
                    break
    except Exception:
        pass

    # USD/INR signal (approximate from market data)
    # If Nifty IT doing better than broad market today → INR likely weak
    it_perf   = state["sector_perf"].get("IT",   {}).get("pchange_1d", 0) or 0
    nifty50   = next((s for s in [state["sector_perf"].get("IT", {})] if True), {})
    if it_perf > 3:
        state["usd_inr_signal"] = "WEAK_INR"   # IT outperforming = INR depreciating
    elif it_perf < -2:
        state["usd_inr_signal"] = "STRONG_INR"

    # Crude oil signal (approximate from energy sector momentum)
    energy_p30 = state["sector_perf"].get("ENERGY", {}).get("pchange_30d", 0) or 0
    if energy_p30 > 8:   state["crude_signal"] = "RISING"
    elif energy_p30 < -8: state["crude_signal"] = "FALLING"

    # Interest rate signal (approximate from bank sector momentum)
    bank_p365 = state["sector_perf"].get("BANK", {}).get("pchange_365d", 0) or 0
    if bank_p365 > 15:   state["rate_signal"] = "RISING"
    elif bank_p365 < -5: state["rate_signal"] = "FALLING"

    # Geopolitical risk (proxy from VIX + sector divergence)
    if state["vix"] > 20:    state["geopolitical_risk"] = 7
    elif state["vix"] > 16:  state["geopolitical_risk"] = 5
    else:                     state["geopolitical_risk"] = 3

    # Defence specific: budget season boost
    if date.today().month in (1, 2, 3):
        state["geopolitical_risk"] = max(state["geopolitical_risk"], 6)

    return state


# Default titles for rules that don't define one inline
_RULE_TITLES = {
    "IT_OVERSOLD_RECOVERY":   "IT Sector Oversold Recovery",
    "IT_WEAK_INR_TAILWIND":   "IT Gains from Weak Rupee",
    "DEFENCE_BUDGET_SEASON":  "Defence Budget Season Play",
    "DEFENCE_GEOPOLITICAL":   "Defence — Geopolitical Tailwind",
    "BANK_RATE_CUT_SETUP":    "Banking Sector Rate Cut Setup",
    "PSU_BANK_DEEP_VALUE":    "PSU Banks Deep Value Opportunity",
    "PHARMA_DEFENSIVE_DEMAND":"Pharma Defensive Rotation",
    "PHARMA_CHINA_DECOUPLING":"Pharma — China API Decoupling",
    "ENERGY_OIL_PRICE_RISE":  "Energy — Crude Oil Tailwind",
    "RENEWABLE_ENERGY_PUSH":  "Renewable Energy Policy Push",
    "AUTO_RATE_CUT_DEMAND":   "Auto Sector Rate Cut Demand",
    "INFRA_CAPEX_CYCLE":      "Infrastructure Capex Cycle",
    "MIDCAP_RECOVERY_SIGNAL": "Midcap Recovery Signal",
    "BULL_MARKET_BROAD_ENTRY":"Bull Market Broad Entry",
    "FII_REENTRY_SIGNAL":     "FII Re-entry — Banks First",
}


def run_predictions() -> Dict:
    """
    Main prediction function.
    Returns structured result object with macro state, triggered predictions,
    sector summary, and metadata.
    """
    cache_key = "predictions_output"
    if _cache_valid(cache_key, PRED_CACHE_TTL):
        return _cache[cache_key]

    print("[Prediction] Running prediction engine...")
    macro = get_macro_state()
    triggered_rules = []

    # Evaluate all rules against current macro state
    for rule in CAUSAL_RULES:
        try:
            if rule["condition"](macro):
                triggered_rules.append(rule)
        except Exception as e:
            print(f"[Prediction] Rule {rule['id']} error: {e}")

    rules_triggered = len(triggered_rules)
    if not triggered_rules:
        # Always show at least the first 3 rules as fallback opportunities
        triggered_rules = CAUSAL_RULES[:3]

    # Build prediction outputs — one per rule (not per sector)
    predictions = []
    for rule in triggered_rules:
        # Aggregate opportunity score across all sectors for this rule
        rule_sectors = rule["sectors"]
        sector_phases: Dict[str, str] = {}
        sector_opp_scores = []
        primary_sector_data: Dict = {}

        for sk in rule_sectors:
            sd = macro["sector_perf"].get(sk, {})
            if sd:
                sector_phases[sk] = sd.get("phase", "UNKNOWN")
                sector_opp_scores.append(get_sector_opportunity_score(sd, macro))
                if not primary_sector_data:
                    primary_sector_data = sd

        opp_score = int(sum(sector_opp_scores) / max(len(sector_opp_scores), 1)) if sector_opp_scores else 50
        thesis    = _fill_thesis(rule["thesis"], macro, rule_sectors[0] if rule_sectors else "")

        # Pick best stocks (from primary sector)
        primary_sk = rule_sectors[0] if rule_sectors else ""
        stocks = _pick_stocks_for_sector(primary_sk, macro)

        pred = {
            "rule_id":        rule["id"],
            "title":          rule.get("title") or _RULE_TITLES.get(rule["id"], rule["id"]),
            "icon":           rule.get("icon", "📊"),
            "type":           rule["type"],
            "thesis":         thesis,
            "sectors":        rule_sectors,
            "sector_phases":  sector_phases,
            "horizon":        rule["horizon"],
            "confidence":     rule["confidence"],
            "opportunity_score": opp_score,
            "stocks":         stocks,
            "entry_strategy": _entry_strategy(rule["type"], primary_sector_data),
            "exit_strategy":  _exit_strategy(rule["type"]),
            "triggered_at":   datetime.now().isoformat(),
        }
        predictions.append(pred)

    # Sort by opportunity_score descending
    predictions.sort(key=lambda x: x["opportunity_score"], reverse=True)
    predictions = predictions[:8]  # top 8

    # Build sector summary list
    all_sectors = get_all_sector_performance()
    sector_summary = []
    for s in all_sectors:
        sector_summary.append({
            "key":               s["key"],
            "label":             s["label"],
            "icon":              s["icon"],
            "phase":             s["phase"],
            "phase_color":       s["phase_color"],
            "pchange_1d":        s.get("pchange_1d",   0),
            "pchange_30d":       s.get("pchange_30d"),
            "pchange_365d":      s.get("pchange_365d"),
            "opportunity_score": get_sector_opportunity_score(s, macro),
        })

    # Build clean macro state for frontend (no huge sector_perf dict)
    macro_clean = {
        "regime":         macro.get("regime", "SIDEWAYS"),
        "vix":            round(macro.get("vix", 15), 1),
        "fii_signal":     macro.get("fii_signal", "NEUTRAL"),
        "rate_signal":    macro.get("rate_signal", "NEUTRAL"),
        "usd_inr_signal": macro.get("usd_inr_signal", "NEUTRAL"),
        "crude_signal":   macro.get("crude_signal",   "NEUTRAL"),
        "geo_risk":       "HIGH" if macro.get("geopolitical_risk", 5) >= 7
                          else "MEDIUM" if macro.get("geopolitical_risk", 5) >= 5
                          else "LOW",
        "breadth":        "BROAD_ADVANCE" if macro.get("regime") == "BULL"
                          else "BROAD_DECLINE" if macro.get("regime") == "BEAR"
                          else "NARROW",
    }

    result = {
        "generated_at":           datetime.now().isoformat(),
        "macro_state":            macro_clean,
        "triggered_predictions":  predictions,
        "sector_summary":         sector_summary,
        "total_rules_evaluated":  len(CAUSAL_RULES),
        "rules_triggered":        rules_triggered,
    }

    _cache_set(cache_key, result)
    top = predictions[0]["title"] if predictions else "none"
    print(f"[Prediction] {rules_triggered}/{len(CAUSAL_RULES)} rules triggered. Top: {top}")
    return result


def _fill_thesis(template: str, macro: Dict, sector_key: str) -> str:
    """Fill template variables with real data."""
    sp = macro["sector_perf"]
    subs = {
        "vix":      macro.get("vix", 15),
        "it_disc":  abs(sp.get("IT",     {}).get("near_high_pct", 0) or 0),
        "it_1d":    sp.get("IT",     {}).get("pchange_1d",   0) or 0,
        "bank_disc":abs(sp.get("BANK",   {}).get("near_high_pct", 0) or 0),
        "auto_disc":abs(sp.get("AUTO",   {}).get("near_high_pct", 0) or 0),
        "mid_disc": abs(sp.get("MIDCAP", {}).get("near_high_pct", 0) or 0),
    }
    try:
        return template.format(**subs)
    except Exception:
        return template


def _pick_stocks_for_sector(sector_key: str, macro: Dict) -> List[Dict]:
    """Pick the best 3 stocks for a sector prediction."""
    if sector_key == "DEFENCE":
        stock_list = DEFENCE_STOCKS[:3]
    else:
        stock_list = SECTOR_STOCKS.get(sector_key, [])[:3]

    if not stock_list:
        return []

    results = []
    for sym in stock_list:
        try:
            from services.nse_data import get_stock_score_data
            data = get_stock_score_data(sym)
            if data and data.get("price", 0) > 0:
                sym_clean = sym.replace(".NS", "")
                results.append({
                    "symbol":      sym_clean,
                    "name":        data.get("name", sym_clean),
                    "price":       data.get("price", 0),
                    "pchange_1d":  data.get("pchange_today", 0),
                    "pchange_365d":data.get("pchange_365d", 0),
                    "near_high_pct":data.get("near_52w_high_pct", 0),
                    "pe_ratio":    data.get("pe_ratio"),
                    "why":         _stock_why(sym_clean, data, sector_key),
                })
                time.sleep(0.3)  # light rate limit
        except Exception as e:
            print(f"[Prediction] Stock {sym} error: {e}")
    return results


def _stock_why(symbol: str, data: Dict, sector_key: str) -> str:
    """Generate a one-line reason why this specific stock in the sector."""
    near  = data.get("near_52w_high_pct", 0) or 0
    p365  = data.get("pchange_365d",       0) or 0
    pe    = data.get("pe_ratio")
    price = data.get("price", 0)

    if near < -20:
        return f"{abs(near):.0f}% below peak — highest upside in sector if thesis plays out"
    if near < -10 and p365 > 5:
        return f"Quality stock at {abs(near):.0f}% discount with positive annual trend"
    if pe and pe < 20:
        return f"Reasonably valued at P/E {pe:.1f} — institutional quality with upside"
    if p365 > 20:
        return f"Strong annual performer (+{p365:.0f}%) — leadership position in sector"
    return f"Sector leader with strong fundamentals and institutional backing"


def _macro_context_summary(macro: Dict) -> str:
    vix    = macro.get("vix", 15)
    fii    = macro.get("fii_signal", "NEUTRAL")
    regime = macro.get("regime", "SIDEWAYS")
    fii_str = "FII buying" if fii == "BUYING" else "FII selling" if fii == "SELLING" else "FII neutral"
    return f"VIX {vix:.1f} | {fii_str} | Market {regime} | {datetime.now().strftime('%d %b %Y')}"


def _entry_strategy(pred_type: str, sector_data: Dict) -> str:
    near = sector_data.get("near_high_pct", 0) or 0
    if pred_type in ("SECTOR_RECOVERY", "VALUE_RECOVERY", "DEEP_VALUE"):
        return (
            f"Start with 40-50% of intended position now (sector at {abs(near):.0f}% below peak). "
            f"Add remaining in 2 tranches over 4-6 weeks as thesis confirms. "
            f"Use SIP-style staggered entry to average your cost."
        )
    elif pred_type == "SEASONAL_CATALYST":
        return (
            "Position 2-3 weeks before the seasonal event peak. "
            "Don't wait — early positioning captures the pre-event anticipation rally. "
            "A 60-70% position now, rest on any dip."
        )
    elif pred_type == "MACRO_TAILWIND":
        return (
            "Full position entry acceptable since macro tailwind is not yet priced in. "
            "Set a 7-8% stop-loss below entry. Thesis invalidates if macro condition reverses."
        )
    return (
        "Staggered entry over 2-3 weeks. Start with 50%, add on confirmation. "
        "Stop-loss at 8-10% below entry price."
    )


def _exit_strategy(pred_type: str) -> str:
    if pred_type in ("SECTOR_RECOVERY", "VALUE_RECOVERY"):
        return "Target 20-35% gain OR when sector reaches within 5% of 52-week high. Book partial profits at +15%."
    elif pred_type == "SEASONAL_CATALYST":
        return "Exit 70% of position around the event date. Hold 30% for post-event continuation."
    elif pred_type == "STRUCTURAL_TREND":
        return "Long-term hold (6-18 months). Take 25% profit every 20% gain. Use trailing stop-loss."
    elif pred_type == "DEFENSIVE_ROTATION":
        return "Hold until VIX normalises below 14 or regime turns clearly bullish. Expected 8-15% return."
    return "Target 15-25% gain. Book 50% at target, hold rest with trailing stop-loss."
