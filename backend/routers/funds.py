from fastapi import APIRouter
from services.amfi_data import get_top_funds, get_sip_recommendation, fetch_all_nav
from services.nse_data import get_market_overview

router = APIRouter(prefix="/api/funds", tags=["funds"])


@router.get("/top")
async def top_mutual_funds(category: str = None, limit: int = 20):
    funds = await get_top_funds(category, limit)
    return {
        "funds": funds,
        "total": len(funds),
        "note": "Showing Direct Growth plans only — these have no commission, giving you better returns than Regular plans"
    }


@router.get("/sip-advice")
async def sip_advice():
    overview = get_market_overview()
    change = overview.get("nifty50_change", 0)
    regime = overview.get("market_regime", "SIDEWAYS")
    recommendation = get_sip_recommendation(change, regime)
    return {
        "recommendation": recommendation,
        "market_context": {
            "nifty_change": change,
            "regime": regime,
            "nifty_level": overview.get("nifty50", 0)
        }
    }


@router.get("/search")
async def search_funds(q: str):
    all_funds = await fetch_all_nav()
    q_lower = q.lower()
    results = [f for f in all_funds if q_lower in f["scheme_name"].lower()][:20]
    return {"results": results, "count": len(results)}


@router.get("/categories")
async def fund_categories():
    return {
        "categories": [
            {"id": "Large Cap", "description": "Big stable companies. Lower risk, steady returns (10-14% annually)"},
            {"id": "Mid Cap", "description": "Growing companies. Medium risk, higher returns (14-18% annually)"},
            {"id": "Small Cap", "description": "Small fast-growing companies. High risk, potential high returns (16-22% annually)"},
            {"id": "Flexi Cap", "description": "Fund manager picks across all sizes. Good for beginners"},
            {"id": "ELSS", "description": "Save tax + invest. Lock-in 3 years. Best for tax saving"},
            {"id": "Index Fund", "description": "Tracks Nifty50. Lowest cost, reliable long-term returns. Best for most people"},
            {"id": "Sectoral", "description": "Invests in one sector (defence, pharma, etc). High risk, high reward"},
            {"id": "Debt", "description": "Bonds and fixed income. Safe, lower returns. Good for short-term parking"},
        ]
    }
