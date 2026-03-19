from fastapi import APIRouter, BackgroundTasks
from services.geo_intelligence import fetch_geo_events, get_recent_events, get_high_impact_events
import json, os

router = APIRouter(prefix="/api/geo", tags=["geopolitical"])

BASE_DIR = os.path.dirname(os.path.dirname(__file__))
TRENDS_PATH = os.path.join(BASE_DIR, "data", "mega_trends.json")


@router.get("/events")
async def get_geo_events(limit: int = 20):
    events = get_recent_events(limit)
    return {
        "events": events,
        "total": len(events),
        "message": "Events sourced from PIB India, BBC, Reuters, ET, Moneycontrol"
    }


@router.get("/high-impact")
async def high_impact_events():
    events = get_high_impact_events()
    return {"events": events, "count": len(events)}


@router.post("/refresh")
async def refresh_geo_events(background_tasks: BackgroundTasks):
    async def _do_fetch():
        await fetch_geo_events()
    background_tasks.add_task(_do_fetch)
    return {"status": "Fetching latest geopolitical events..."}


@router.get("/mega-trends")
async def mega_trends():
    with open(TRENDS_PATH, "r") as f:
        trends = json.load(f)
    return {"trends": trends, "total": len(trends)}


@router.get("/mega-trends/{trend_id}")
async def mega_trend_detail(trend_id: str):
    with open(TRENDS_PATH, "r") as f:
        trends = json.load(f)
    trend = next((t for t in trends if t["id"] == trend_id), None)
    if not trend:
        return {"error": "Trend not found"}
    return trend
