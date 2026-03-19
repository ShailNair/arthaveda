"""
Geopolitical Intelligence Service
Monitors world events via RSS feeds and maps them to Indian market opportunities
Uses NLP to classify events and score their market impact
"""
import feedparser
import re
import json
import os
import hashlib
from datetime import datetime, timedelta
from typing import List, Dict
from textblob import TextBlob

BASE_DIR = os.path.dirname(os.path.dirname(__file__))
with open(os.path.join(BASE_DIR, "data", "sector_mapping.json"), "r") as f:
    SECTOR_MAP = json.load(f)

# Free RSS feeds — official and reputable
RSS_FEEDS = [
    {"url": "https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3", "source": "PIB India", "trust": 10},
    {"url": "https://feeds.bbci.co.uk/news/world/asia/india/rss.xml", "source": "BBC India", "trust": 9},
    {"url": "https://feeds.bbci.co.uk/news/business/rss.xml", "source": "BBC Business", "trust": 9},
    {"url": "http://feeds.reuters.com/reuters/businessNews", "source": "Reuters Business", "trust": 9},
    {"url": "http://feeds.reuters.com/reuters/worldNews", "source": "Reuters World", "trust": 9},
    {"url": "https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms", "source": "ET Markets", "trust": 8},
    {"url": "https://economictimes.indiatimes.com/rssfeeds/1373380680.cms", "source": "ET Economy", "trust": 8},
    {"url": "https://www.moneycontrol.com/rss/MCtopnews.xml", "source": "Moneycontrol", "trust": 8},
    {"url": "https://www.livemint.com/rss/markets", "source": "Mint Markets", "trust": 8},
]

# Keywords for event classification
EVENT_PATTERNS = {
    "conflict": ["war", "attack", "missile", "bomb", "military", "troops", "invasion", "ceasefire",
                 "border clash", "tension", "airforce", "navy", "combat", "drone strike", "sanction military"],
    "trade": ["trade war", "tariff", "trade deal", "trade agreement", "fta", "export", "import",
              "trade deficit", "wto", "customs", "duty", "embargo", "trade sanction", "supply chain"],
    "energy": ["oil", "crude", "opec", "gas", "petroleum", "energy crisis", "fuel", "pipeline",
               "oil sanction", "energy policy", "fossil fuel", "lng"],
    "climate": ["climate", "cop", "paris accord", "net zero", "carbon", "renewable", "solar",
                "green energy", "emission", "global warming", "clean energy", "ev"],
    "policy": ["rbi", "sebi", "pli scheme", "budget", "tax", "gst", "policy", "regulation",
               "government scheme", "subsidy", "reform", "interest rate", "monetary policy"],
    "sanctions": ["sanction", "ban", "blacklist", "restrict", "blocked", "frozen", "expelled"],
    "technology": ["semiconductor", "chip", "ai", "tech ban", "5g", "tech war", "digital",
                   "cybersecurity", "huawei", "nvidia", "export control"],
    "pharma_health": ["pandemic", "virus", "drug", "medicine", "fda", "pharma", "vaccine",
                      "health crisis", "api", "biosecure"],
    "defence_india": ["india defence", "hal", "bel", "tejas", "brahmos", "rafale", "indian navy",
                      "indian army", "border", "lac", "pakistan", "china india"],
}

# Event type → sector impact
EVENT_TO_SECTORS = {
    "conflict":       ["DEFENCE", "ENERGY_OIL", "GOLD_COMMODITIES"],
    "trade":          ["MANUFACTURING", "IT_TECH", "PHARMA", "AGRICULTURE"],
    "energy":         ["ENERGY_OIL", "RENEWABLE_ENERGY", "INFRASTRUCTURE"],
    "climate":        ["RENEWABLE_ENERGY", "INFRASTRUCTURE", "AGRICULTURE"],
    "policy":         ["BANKING", "INFRASTRUCTURE", "MANUFACTURING"],
    "sanctions":      ["ENERGY_OIL", "GOLD_COMMODITIES", "IT_TECH"],
    "technology":     ["IT_TECH", "MANUFACTURING"],
    "pharma_health":  ["PHARMA"],
    "defence_india":  ["DEFENCE"],
}

_recent_events: List[Dict] = []
_processed_ids = set()


async def fetch_geo_events() -> List[Dict]:
    """Fetch and analyze geopolitical events from all RSS sources"""
    global _recent_events, _processed_ids
    new_events = []

    for feed_info in RSS_FEEDS:
        try:
            feed = feedparser.parse(feed_info["url"])
            for entry in feed.entries[:10]:
                title = getattr(entry, "title", "")
                summary = getattr(entry, "summary", "")
                link = getattr(entry, "link", "")
                published = getattr(entry, "published", str(datetime.now()))

                text = f"{title} {summary}".lower()
                event_id = hashlib.md5(title.encode()).hexdigest()[:12]

                if event_id in _processed_ids:
                    continue

                event_type, confidence = _classify_event(text)
                if not event_type:
                    continue

                india_relevance = _score_india_relevance(text)
                if india_relevance < 3:
                    continue

                severity = _score_severity(text, event_type)
                affected_sectors = EVENT_TO_SECTORS.get(event_type, [])
                affected_stocks = _get_stocks_for_sectors(affected_sectors)
                plain_explanation = _generate_plain_explanation(title, event_type, affected_sectors)
                time_horizon = _estimate_time_horizon(event_type, severity)
                opportunity_type = "structural" if severity >= 7 else "spike"

                event = {
                    "id": event_id,
                    "headline": title,
                    "source": feed_info["source"],
                    "link": link,
                    "event_type": event_type,
                    "india_relevance": india_relevance,
                    "severity": severity,
                    "affected_sectors": affected_sectors,
                    "affected_stocks": affected_stocks[:6],
                    "plain_explanation": plain_explanation,
                    "time_horizon": time_horizon,
                    "opportunity_type": opportunity_type,
                    "sentiment": _get_sentiment(text),
                    "timestamp": datetime.now().isoformat()
                }

                new_events.append(event)
                _processed_ids.add(event_id)

        except Exception as e:
            print(f"[GeoIntel] RSS error for {feed_info['source']}: {e}")
            continue

    # Keep only recent 50 events
    _recent_events = (new_events + _recent_events)[:50]
    return _recent_events


def _classify_event(text: str):
    scores = {}
    for event_type, keywords in EVENT_PATTERNS.items():
        matches = sum(1 for kw in keywords if kw in text)
        if matches > 0:
            scores[event_type] = matches

    if not scores:
        return None, 0

    best_type = max(scores, key=scores.get)
    confidence = min(scores[best_type] * 20, 95)
    return best_type, confidence


def _score_india_relevance(text: str) -> int:
    india_keywords = [
        "india", "indian", "nse", "bse", "sensex", "nifty", "rupee", "rbi",
        "modi", "sebi", "mumbai", "delhi", "pakistan", "china india", "border india",
        "make in india", "pli", "atmanirbhar", "bharat"
    ]
    indirect_keywords = [
        "asia", "emerging market", "brics", "g20", "oil price", "dollar",
        "global trade", "supply chain", "world bank", "imf", "global economy"
    ]

    direct_matches = sum(2 for kw in india_keywords if kw in text)
    indirect_matches = sum(1 for kw in indirect_keywords if kw in text)
    return min(direct_matches + indirect_matches, 10)


def _score_severity(text: str, event_type: str) -> int:
    high_severity = ["war", "invasion", "nuclear", "sanctions", "major", "crisis",
                     "collapse", "massive", "historic", "unprecedented"]
    medium_severity = ["tension", "dispute", "concern", "risk", "threat", "conflict",
                       "decline", "surge", "ban", "restrict"]
    low_severity = ["meeting", "discussion", "review", "propose", "consider", "plan"]

    high_count = sum(1 for w in high_severity if w in text)
    med_count = sum(1 for w in medium_severity if w in text)

    severity = 5
    severity += high_count * 2
    severity += med_count * 1
    severity -= sum(1 for w in low_severity if w in text)

    # Defence and conflict events are inherently more severe for market
    if event_type in ["conflict", "sanctions"]:
        severity += 1

    return max(1, min(severity, 10))


def _get_stocks_for_sectors(sectors: List[str]) -> List[Dict]:
    stocks = []
    for sector in sectors:
        if sector in SECTOR_MAP:
            for stock in SECTOR_MAP[sector]["stocks"][:3]:
                stocks.append({
                    "symbol": stock["symbol"].replace(".NS", ""),
                    "name": stock["name"],
                    "sector": sector
                })
    return stocks


def _generate_plain_explanation(headline: str, event_type: str, sectors: List[str]) -> str:
    sector_names = {
        "DEFENCE": "defence companies (HAL, BEL)",
        "ENERGY_OIL": "oil & energy companies (ONGC, Reliance)",
        "RENEWABLE_ENERGY": "solar & renewable companies (Waaree, NTPC Green)",
        "PHARMA": "pharma companies (Sun Pharma, Divi's Labs)",
        "IT_TECH": "IT & tech companies (TCS, Infosys)",
        "MANUFACTURING": "manufacturing companies (Dixon, Kaynes)",
        "INFRASTRUCTURE": "infrastructure companies (L&T, Adani Ports)",
        "BANKING": "banking stocks (HDFC Bank, SBI)",
        "GOLD_COMMODITIES": "gold & commodities (Gold ETFs, NMDC)",
        "AGRICULTURE": "agri companies (UPL, Coromandel)",
    }

    sector_friendly = [sector_names.get(s, s) for s in sectors[:2]]
    sector_str = " and ".join(sector_friendly) if sector_friendly else "Indian market"

    templates = {
        "conflict": f"This conflict situation typically causes {sector_str} to rise as defence budgets increase and oil prices spike. Historically these stocks jump 10-30% during such events.",
        "trade": f"Trade agreements/tensions directly impact {sector_str}. When global trade shifts, Indian exporters either benefit or face pressure within days to weeks.",
        "energy": f"Energy events heavily impact {sector_str}. Oil price changes affect Indian companies both as opportunity (for producers) and cost (for consumers).",
        "climate": f"Climate agreements create massive long-term business for {sector_str}. Governments commit billions in green energy spending — Indian solar companies are direct beneficiaries.",
        "policy": f"Policy changes from RBI or Government directly impact {sector_str}. Rate cuts boost banks and infrastructure, while sector schemes boost specific industries.",
        "sanctions": f"Sanctions typically benefit {sector_str} as trade flows shift. India often gains alternative trade opportunities when other countries face restrictions.",
        "technology": f"Tech sector events impact {sector_str}. Global chip/AI trends create both opportunities and risks for Indian technology companies.",
        "pharma_health": f"Health events impact {sector_str}. India is the world's pharmacy — global health issues create massive demand for Indian medicines.",
        "defence_india": f"India-specific defence news directly impacts {sector_str}. Every major defence contract or capability upgrade boosts these stocks significantly.",
    }

    return templates.get(event_type, f"This global event is likely to impact {sector_str} in the coming days.")


def _estimate_time_horizon(event_type: str, severity: int) -> str:
    if event_type in ["conflict", "sanctions"] and severity >= 7:
        return "Days to Weeks (fast spike likely)"
    elif event_type in ["climate", "trade"] and severity >= 6:
        return "Months to Years (structural change)"
    elif event_type in ["policy", "energy"]:
        return "Days to Months"
    elif severity >= 8:
        return "Immediate — Days"
    return "Weeks to Months"


def _get_sentiment(text: str) -> str:
    try:
        blob = TextBlob(text)
        polarity = blob.sentiment.polarity
        if polarity > 0.1:
            return "POSITIVE"
        elif polarity < -0.1:
            return "NEGATIVE"
        return "NEUTRAL"
    except Exception:
        return "NEUTRAL"


def get_recent_events(limit: int = 20) -> List[Dict]:
    return _recent_events[:limit]


def get_high_impact_events() -> List[Dict]:
    return [e for e in _recent_events if e["india_relevance"] >= 6 and e["severity"] >= 6][:10]
