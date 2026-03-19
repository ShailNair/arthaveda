"""
Trust Score Engine
Answers: "How reliable is this company as an investment?"
Based on 5-year proxy using NSE-available data.
Score 0-100: Higher = more historically trustworthy
"""
from typing import Dict, Tuple, List


def compute_trust_score(stock_data: Dict) -> Dict:
    """
    Compute trust score from NSE snapshot data.
    Uses 1yr return, market cap, PE, volatility, sector stability.
    Returns: { score, label, color, reasons, flags }
    """
    score = 0
    reasons: List[str] = []
    flags: List[str] = []

    price        = stock_data.get("price", 0)
    p365         = stock_data.get("pchange_365d", 0)
    p30          = stock_data.get("pchange_30d", 0)
    ffmc         = stock_data.get("free_float_mcap", 0)   # free float market cap in Rs
    pe           = stock_data.get("pe_ratio")
    sector_pe    = stock_data.get("sector_pe")
    near52       = stock_data.get("near_52w_high_pct", 0)  # negative = below high
    year_high    = stock_data.get("year_high", 0)
    year_low     = stock_data.get("year_low", 0)
    sector       = stock_data.get("sector", "")

    # ── Pillar 1: 5-Year Performance Proxy (35 pts) ──────────────────────────
    # Use 1yr return as best available proxy. Weight heavily.
    if p365 >= 30:
        score += 35
        reasons.append(f"Up {p365:.0f}% in past year — outstanding performer")
    elif p365 >= 15:
        score += 28
        reasons.append(f"Up {p365:.0f}% in past year — strong consistent growth")
    elif p365 >= 5:
        score += 20
        reasons.append(f"Up {p365:.0f}% in past year — steady positive returns")
    elif p365 >= 0:
        score += 12
        reasons.append(f"Flat past year ({p365:.1f}%) — stable but limited growth")
    elif p365 >= -15:
        score += 5
        reasons.append(f"Down {abs(p365):.0f}% past year — recent underperformer")
        flags.append(f"Declining trend: -{abs(p365):.0f}% in past year")
    else:
        score += 0
        reasons.append(f"Down {abs(p365):.0f}% past year — significant underperformance")
        flags.append(f"Major decline: -{abs(p365):.0f}% in past year — high risk")

    # ── Pillar 2: Company Size / Institutional Trust (30 pts) ─────────────────
    # ffmc is in Rupees. 1 lakh crore = 1,000,000,000,000
    LAKH_CRORE = 1e12
    THOUSAND_CRORE = 1e11
    HUNDRED_CRORE = 1e10

    if ffmc >= LAKH_CRORE:
        score += 30
        reasons.append("Large-cap blue chip — extensively researched, institutionally held")
    elif ffmc >= THOUSAND_CRORE:
        score += 22
        reasons.append("Mid-to-large cap — significant institutional following")
    elif ffmc >= HUNDRED_CRORE:
        score += 14
        reasons.append("Mid cap — reasonable institutional coverage")
    elif ffmc > 0:
        score += 7
        reasons.append("Small cap — limited institutional research, higher individual risk")
        flags.append("Small cap: limited liquidity, higher volatility risk")
    else:
        score += 8  # no ffmc data — neutral

    # ── Pillar 3: Valuation Sanity (20 pts) ───────────────────────────────────
    if pe:
        if 8 <= pe <= 22:
            score += 20
            reasons.append(f"Healthy P/E of {pe:.1f} — fairly valued, sustainable")
        elif 22 < pe <= 35:
            score += 14
            reasons.append(f"P/E of {pe:.1f} — reasonable growth premium")
        elif 35 < pe <= 60:
            score += 8
            reasons.append(f"High P/E of {pe:.1f} — priced for growth, limited margin of safety")
            flags.append(f"High valuation: P/E {pe:.1f} — requires sustained earnings growth")
        elif pe > 60:
            score += 3
            reasons.append(f"Very high P/E of {pe:.1f} — speculative valuation territory")
            flags.append(f"Extremely high P/E {pe:.1f} — bubble risk if earnings disappoint")
        elif pe < 8:
            score += 10
            reasons.append(f"Very low P/E of {pe:.1f} — cheap but investigate why")
            flags.append(f"Unusually low P/E {pe:.1f} — may signal hidden problems")
    else:
        score += 10  # no PE — neutral

    # ── Pillar 4: Volatility / Stability (15 pts) ─────────────────────────────
    if year_high > year_low > 0:
        year_range_pct = ((year_high - year_low) / year_low) * 100
        if year_range_pct < 25:
            score += 15
            reasons.append(f"Low 52-week range ({year_range_pct:.0f}%) — stable, low-volatility stock")
        elif year_range_pct < 40:
            score += 10
            reasons.append(f"Moderate 52-week range ({year_range_pct:.0f}%) — normal market fluctuation")
        elif year_range_pct < 60:
            score += 5
            reasons.append(f"Wide 52-week range ({year_range_pct:.0f}%) — volatile stock")
            flags.append(f"High volatility: {year_range_pct:.0f}% 52-week range — larger swings expected")
        else:
            score += 2
            reasons.append(f"Very wide 52-week range ({year_range_pct:.0f}%) — highly volatile")
            flags.append(f"Extreme volatility: {year_range_pct:.0f}% swing in past year — only for risk-tolerant")
    else:
        score += 8  # neutral

    # ── Forensic Red Flags (deductions) ────────────────────────────────────────
    # Flag 1: Steep recent decline despite good long-term (potential deterioration)
    if p30 < -12 and p365 > 10:
        flags.append("Sharp recent sell-off (-{:.0f}% in 30d) despite good annual return — something changed".format(abs(p30)))

    # Flag 2: Near 52-week low but no rebound (sustained weakness)
    if near52 < -40 and p30 < -5:
        score = max(score - 10, 0)
        flags.append("Near 52-week lows with continued selling — major caution")

    # Flag 3: Price too low (micro/penny stock risk)
    if price < 50:
        score = max(score - 8, 0)
        flags.append(f"Very low price Rs.{price:.0f} — penny stock characteristics, higher manipulation risk")

    # ── Cap and label ──────────────────────────────────────────────────────────
    score = max(0, min(score, 100))
    label, color = _trust_label(score)

    return {
        "score":   score,
        "label":   label,
        "color":   color,
        "reasons": reasons[:3],
        "flags":   flags,
    }


def _trust_label(score: int) -> Tuple[str, str]:
    if score >= 75: return "High Trust",    "#4ade80"   # green
    if score >= 55: return "Moderate",      "#60a5fa"   # blue
    if score >= 35: return "Volatile",      "#f59e0b"   # amber
    return              "High Risk",        "#f87171"   # red
