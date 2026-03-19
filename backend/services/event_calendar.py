"""
Event Calendar Service
India macro event calendar: RBI meetings, Budget, Results season,
index rebalancing, F&O expiry dates.
Combines hardcoded known events with dynamic NSE board meeting data.
"""
from datetime import datetime, date, timedelta
from typing import List, Dict

# ── Known recurring events ─────────────────────────────────────────────────
# RBI MPC meets ~6x/year. Dates announced ~2 months ahead.
# These are 2025-2026 scheduled dates.

KNOWN_EVENTS: List[Dict] = [
    # ── RBI MPC ────────────────────────────────────────────────────────────
    {"date": "2025-04-09", "type": "RBI_MPC",    "title": "RBI MPC Decision",
     "impact": "HIGH", "sectors": ["Banking", "NBFC", "Real Estate", "Auto"],
     "description": "Reserve Bank MPC rate decision. Rate cut expected given softening inflation.",
     "direction_hint": "BULLISH"},
    {"date": "2025-06-06", "type": "RBI_MPC",    "title": "RBI MPC Decision",
     "impact": "HIGH", "sectors": ["Banking", "NBFC", "Real Estate"],
     "description": "RBI bi-monthly monetary policy review.",
     "direction_hint": "NEUTRAL"},
    {"date": "2025-08-08", "type": "RBI_MPC",    "title": "RBI MPC Decision",
     "impact": "HIGH", "sectors": ["Banking", "NBFC"],
     "description": "RBI bi-monthly monetary policy review.",
     "direction_hint": "NEUTRAL"},
    {"date": "2025-10-08", "type": "RBI_MPC",    "title": "RBI MPC Decision",
     "impact": "HIGH", "sectors": ["Banking", "NBFC", "Real Estate"],
     "description": "RBI bi-monthly monetary policy review.",
     "direction_hint": "NEUTRAL"},
    {"date": "2025-12-05", "type": "RBI_MPC",    "title": "RBI MPC Decision",
     "impact": "HIGH", "sectors": ["Banking", "NBFC"],
     "description": "Last RBI MPC of 2025. Year-end positioning.",
     "direction_hint": "NEUTRAL"},
    {"date": "2026-02-06", "type": "RBI_MPC",    "title": "RBI MPC Decision",
     "impact": "HIGH", "sectors": ["Banking", "NBFC", "Real Estate", "Auto"],
     "description": "First RBI MPC of 2026. Post-budget monetary stance.",
     "direction_hint": "NEUTRAL"},
    {"date": "2026-04-09", "type": "RBI_MPC",    "title": "RBI MPC Decision",
     "impact": "HIGH", "sectors": ["Banking", "NBFC", "Real Estate"],
     "description": "RBI MPC bi-monthly review.",
     "direction_hint": "NEUTRAL"},

    # ── Union Budget ────────────────────────────────────────────────────────
    {"date": "2026-02-01", "type": "BUDGET",     "title": "Union Budget 2026-27",
     "impact": "VERY_HIGH", "sectors": ["Defence", "Infrastructure", "FMCG", "Auto", "IT"],
     "description": "Union Budget. Key themes: capex, defence, rural demand, EV policy.",
     "direction_hint": "BULLISH"},

    # ── F&O Expiry (monthly — last Thursday) ───────────────────────────────
    {"date": "2025-04-24", "type": "FNO_EXPIRY", "title": "F&O Monthly Expiry",
     "impact": "MEDIUM", "sectors": ["All"],
     "description": "Monthly F&O expiry. Max pain levels dominate price action.",
     "direction_hint": "VOLATILE"},
    {"date": "2025-05-29", "type": "FNO_EXPIRY", "title": "F&O Monthly Expiry",
     "impact": "MEDIUM", "sectors": ["All"],
     "description": "Monthly F&O expiry.",
     "direction_hint": "VOLATILE"},
    {"date": "2025-06-26", "type": "FNO_EXPIRY", "title": "F&O Monthly Expiry",
     "impact": "MEDIUM", "sectors": ["All"],
     "description": "Monthly F&O expiry.",
     "direction_hint": "VOLATILE"},
    {"date": "2025-07-31", "type": "FNO_EXPIRY", "title": "F&O Monthly Expiry",
     "impact": "MEDIUM", "sectors": ["All"],
     "description": "Monthly F&O expiry.",
     "direction_hint": "VOLATILE"},
    {"date": "2025-08-28", "type": "FNO_EXPIRY", "title": "F&O Monthly Expiry",
     "impact": "MEDIUM", "sectors": ["All"],
     "description": "Monthly F&O expiry.",
     "direction_hint": "VOLATILE"},
    {"date": "2025-09-25", "type": "FNO_EXPIRY", "title": "F&O Monthly Expiry",
     "impact": "MEDIUM", "sectors": ["All"],
     "description": "Monthly F&O expiry. Q2 results season begins.",
     "direction_hint": "VOLATILE"},
    {"date": "2025-10-30", "type": "FNO_EXPIRY", "title": "F&O Monthly Expiry",
     "impact": "MEDIUM", "sectors": ["All"],
     "description": "Monthly F&O expiry.",
     "direction_hint": "VOLATILE"},
    {"date": "2025-11-27", "type": "FNO_EXPIRY", "title": "F&O Monthly Expiry",
     "impact": "MEDIUM", "sectors": ["All"],
     "description": "Monthly F&O expiry.",
     "direction_hint": "VOLATILE"},
    {"date": "2025-12-25", "type": "FNO_EXPIRY", "title": "F&O Monthly Expiry",
     "impact": "MEDIUM", "sectors": ["All"],
     "description": "December expiry. Year-end positioning.",
     "direction_hint": "VOLATILE"},
    {"date": "2026-01-29", "type": "FNO_EXPIRY", "title": "F&O Monthly Expiry",
     "impact": "MEDIUM", "sectors": ["All"],
     "description": "January expiry. Pre-budget positioning.",
     "direction_hint": "VOLATILE"},
    {"date": "2026-02-26", "type": "FNO_EXPIRY", "title": "F&O Monthly Expiry",
     "impact": "MEDIUM", "sectors": ["All"],
     "description": "Post-budget F&O expiry.",
     "direction_hint": "VOLATILE"},
    {"date": "2026-03-26", "type": "FNO_EXPIRY", "title": "F&O Monthly Expiry",
     "impact": "MEDIUM", "sectors": ["All"],
     "description": "Financial year-end expiry. Tax selling pressure.",
     "direction_hint": "VOLATILE"},

    # ── Results Season ──────────────────────────────────────────────────────
    {"date": "2025-04-14", "type": "RESULTS",    "title": "Q4 Results Season Begins",
     "impact": "HIGH", "sectors": ["IT", "Banking", "FMCG", "Auto"],
     "description": "Q4 FY25 earnings begin. IT and banks report first. Key for sector direction.",
     "direction_hint": "NEUTRAL"},
    {"date": "2025-07-14", "type": "RESULTS",    "title": "Q1 Results Season Begins",
     "impact": "HIGH", "sectors": ["IT", "Banking", "Pharma"],
     "description": "Q1 FY26 earnings. Monsoon impact on FMCG/rural plays.",
     "direction_hint": "NEUTRAL"},
    {"date": "2025-10-14", "type": "RESULTS",    "title": "Q2 Results Season Begins",
     "impact": "HIGH", "sectors": ["IT", "Banking", "Auto", "FMCG"],
     "description": "Q2 FY26 earnings. Festive season demand reflection.",
     "direction_hint": "NEUTRAL"},
    {"date": "2026-01-14", "type": "RESULTS",    "title": "Q3 Results Season Begins",
     "impact": "HIGH", "sectors": ["IT", "Banking", "Auto"],
     "description": "Q3 FY26 earnings. Winter demand + rate cut effects visible.",
     "direction_hint": "NEUTRAL"},

    # ── Nifty Rebalancing ───────────────────────────────────────────────────
    {"date": "2025-06-27", "type": "NIFTY_REBALANCE", "title": "Nifty Index Rebalancing",
     "impact": "MEDIUM", "sectors": ["All"],
     "description": "Semi-annual Nifty 50/500 rebalancing. Additions see forced buying.",
     "direction_hint": "BULLISH"},
    {"date": "2025-12-26", "type": "NIFTY_REBALANCE", "title": "Nifty Index Rebalancing",
     "impact": "MEDIUM", "sectors": ["All"],
     "description": "Semi-annual Nifty index rebalancing.",
     "direction_hint": "BULLISH"},

    # ── Monsoon ─────────────────────────────────────────────────────────────
    {"date": "2025-06-01", "type": "MONSOON",    "title": "Monsoon Season Begins",
     "impact": "MEDIUM", "sectors": ["FMCG", "Agriculture", "Fertiliser", "Rural"],
     "description": "Southwest monsoon onset. Normal monsoon = rural consumption boost.",
     "direction_hint": "BULLISH"},
    {"date": "2025-09-30", "type": "MONSOON",    "title": "Monsoon Withdrawal",
     "impact": "LOW", "sectors": ["FMCG", "Agriculture"],
     "description": "Monsoon withdrawal. Kharif crop output assessment.",
     "direction_hint": "NEUTRAL"},

    # ── Key Company Results (tracked individually) ──────────────────────────
    {"date": "2025-04-16", "type": "COMPANY_RESULT", "title": "Infosys Q4 Results",
     "impact": "HIGH", "sectors": ["IT"],
     "description": "Infosys Q4 FY25. Revenue guidance for FY26 most watched.",
     "direction_hint": "NEUTRAL"},
    {"date": "2025-04-17", "type": "COMPANY_RESULT", "title": "TCS Q4 Results",
     "impact": "HIGH", "sectors": ["IT"],
     "description": "TCS Q4 FY25. Deal wins + margin commentary key.",
     "direction_hint": "NEUTRAL"},
    {"date": "2025-04-19", "type": "COMPANY_RESULT", "title": "HDFC Bank Q4 Results",
     "impact": "HIGH", "sectors": ["Banking"],
     "description": "HDFC Bank Q4. Deposit growth and NIM compression watched.",
     "direction_hint": "NEUTRAL"},
    {"date": "2025-04-26", "type": "COMPANY_RESULT", "title": "Reliance Q4 Results",
     "impact": "HIGH", "sectors": ["Energy", "Retail", "Telecom"],
     "description": "Reliance Industries Q4 FY25. Jio + retail EBITDA key.",
     "direction_hint": "NEUTRAL"},

    # ── US Fed (impacts FII flows + INR) ────────────────────────────────────
    {"date": "2025-05-07", "type": "US_FED",     "title": "US Federal Reserve Decision",
     "impact": "MEDIUM", "sectors": ["IT", "Banking", "All"],
     "description": "FOMC rate decision. Rate hold/cut affects FII flows into India.",
     "direction_hint": "NEUTRAL"},
    {"date": "2025-06-18", "type": "US_FED",     "title": "US Federal Reserve Decision",
     "impact": "MEDIUM", "sectors": ["IT", "Banking"],
     "description": "FOMC rate decision.",
     "direction_hint": "NEUTRAL"},
    {"date": "2025-07-30", "type": "US_FED",     "title": "US Federal Reserve Decision",
     "impact": "MEDIUM", "sectors": ["IT", "Banking"],
     "description": "FOMC rate decision.",
     "direction_hint": "NEUTRAL"},
    {"date": "2025-09-17", "type": "US_FED",     "title": "US Federal Reserve Decision",
     "impact": "MEDIUM", "sectors": ["IT", "Banking"],
     "description": "FOMC rate decision. Rate cut increasingly likely.",
     "direction_hint": "BULLISH"},
]

# Impact color mapping
IMPACT_COLORS = {
    "VERY_HIGH": "#f87171",
    "HIGH":      "#fbbf24",
    "MEDIUM":    "#60a5fa",
    "LOW":       "#6b7280",
    "VOLATILE":  "#a78bfa",
}

# Event type icons
EVENT_ICONS = {
    "RBI_MPC":        "🏦",
    "BUDGET":         "📊",
    "FNO_EXPIRY":     "⚡",
    "RESULTS":        "📋",
    "NIFTY_REBALANCE":"⚖️",
    "MONSOON":        "🌧️",
    "COMPANY_RESULT": "🏢",
    "US_FED":         "🇺🇸",
}


def get_upcoming_events(days_ahead: int = 45, include_past_days: int = 3) -> List[dict]:
    """
    Return events within the window [today - past_days, today + days_ahead].
    Enriched with days_until, is_today, is_past.
    """
    today     = date.today()
    window_start = today - timedelta(days=include_past_days)
    window_end   = today + timedelta(days=days_ahead)

    result = []
    for ev in KNOWN_EVENTS:
        ev_date = date.fromisoformat(ev["date"])
        if not (window_start <= ev_date <= window_end):
            continue

        days_until = (ev_date - today).days
        enriched   = {
            **ev,
            "days_until":  days_until,
            "is_today":    days_until == 0,
            "is_past":     days_until < 0,
            "is_imminent": 0 <= days_until <= 3,
            "icon":        EVENT_ICONS.get(ev["type"], "📌"),
            "impact_color":IMPACT_COLORS.get(ev["impact"], "#6b7280"),
            "date_display": ev_date.strftime("%d %b %Y"),
        }
        result.append(enriched)

    # Sort: upcoming first (nearest), then past (most recent)
    result.sort(key=lambda x: (x["is_past"], x["days_until"] if not x["is_past"] else -x["days_until"]))
    return result


def get_events_for_sectors(sectors: List[str], days_ahead: int = 30) -> List[dict]:
    """Filter upcoming events that affect given sectors."""
    all_events = get_upcoming_events(days_ahead)
    return [
        ev for ev in all_events
        if "All" in ev["sectors"] or any(s in ev["sectors"] for s in sectors)
    ]


def get_today_context() -> dict:
    """
    Build the 'Today's Brief' — 30-second market context.
    Used in the Daily Briefing component.
    """
    today  = date.today()
    events = get_upcoming_events(days_ahead=30)

    # Events happening today
    today_events = [e for e in events if e["is_today"]]
    # Imminent events (next 3 days)
    imminent     = [e for e in events if e["is_imminent"] and not e["is_today"]]
    # Next major event
    upcoming_major = [e for e in events
                      if not e["is_past"] and e["impact"] in ("HIGH", "VERY_HIGH")]
    next_major = upcoming_major[0] if upcoming_major else None

    # Day-of-week context
    weekday = today.strftime("%A")
    is_monday = today.weekday() == 0
    is_friday = today.weekday() == 4

    day_note = ""
    if is_monday:
        day_note = "Monday — review weekend developments, FII pre-market direction matters most today."
    elif is_friday:
        day_note = "Friday — F&O positions close by 3:30pm. Volatility typically rises after 2pm."

    return {
        "date":          today.isoformat(),
        "date_display":  today.strftime("%A, %d %B %Y"),
        "day_note":      day_note,
        "today_events":  today_events,
        "imminent_events": imminent[:3],
        "next_major_event": next_major,
        "watch_points":  _build_watch_points(today_events, imminent, is_monday),
    }


def _build_watch_points(today_events, imminent, is_monday) -> List[str]:
    """Generate 3 specific things to watch today."""
    points = []
    if today_events:
        for ev in today_events[:1]:
            points.append(f"{ev['icon']} {ev['title']} today — watch {', '.join(ev['sectors'][:2])} stocks")
    if imminent:
        ev = imminent[0]
        points.append(f"⏰ {ev['title']} in {ev['days_until']} day{'s' if ev['days_until']>1 else ''} — {ev['description'][:60]}...")
    if is_monday:
        points.append("📡 Check overnight FII data and US futures before entering positions")
    if len(points) < 3:
        points.append("📊 Nifty breadth (advance/decline) determines quality of any rally today")
    if len(points) < 3:
        points.append("⚡ Next weekly F&O expiry shapes intraday support/resistance levels")
    return points[:3]
