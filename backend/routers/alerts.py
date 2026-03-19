from fastapi import APIRouter, BackgroundTasks
from services.lottery_scorer import run_full_scan, score_stock
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
import asyncio

router = APIRouter(prefix="/api/alerts", tags=["alerts"])
executor = ThreadPoolExecutor(max_workers=1)

_cached_alerts = []
_last_scan_time = None
_scan_in_progress = False


async def _run_scan_async():
    global _cached_alerts, _last_scan_time, _scan_in_progress
    if _scan_in_progress:
        return
    _scan_in_progress = True
    try:
        loop = asyncio.get_event_loop()
        results = await loop.run_in_executor(executor, run_full_scan)
        _cached_alerts = results
        _last_scan_time = datetime.now()
    except Exception as e:
        print(f"[Signals] Scan error: {e}")
    finally:
        _scan_in_progress = False


def _signals_response(status="READY"):
    return {
        "signals":      _cached_alerts,
        "alerts":       _cached_alerts,   # backwards compat
        "total":        len(_cached_alerts),
        "status":       status,
        "last_updated": _last_scan_time.isoformat() if _last_scan_time else None,
        "scan_in_progress": _scan_in_progress,
        "disclaimer":   "Not SEBI-registered investment advice. Educational use only.",
    }


# ── Primary endpoint (new name) ────────────────────────────────────────────

@router.get("/signals")
async def get_signals():
    """Main signal list — all stocks with BUY / AVOID / NEUTRAL signals."""
    if not _cached_alerts and not _scan_in_progress:
        asyncio.create_task(_run_scan_async())
        return {
            **_signals_response("SCANNING"),
            "message": "First scan starting (~30 seconds). Refresh shortly.",
        }
    if _last_scan_time and (datetime.now() - _last_scan_time).seconds > 1200 and not _scan_in_progress:
        asyncio.create_task(_run_scan_async())
    return _signals_response()


# ── Legacy alias (keep for backwards compat with old frontend) ─────────────

@router.get("/lottery")
async def get_lottery_alerts():
    return await get_signals()

@router.get("/lottery/top")
async def get_top_alerts():
    top = [a for a in _cached_alerts if a.get("score", 0) >= 75]
    return {"signals": top, "alerts": top, "count": len(top)}


# ── Single stock score ─────────────────────────────────────────────────────

@router.get("/stock/{symbol}")
async def score_single_stock(symbol: str):
    clean = symbol.upper()
    if not clean.endswith(".NS"):
        clean += ".NS"
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(executor, score_stock, clean)
    if not result:
        return {"error": "Could not score stock", "symbol": symbol}
    return result


# ── Refresh trigger ────────────────────────────────────────────────────────

@router.post("/refresh")
async def refresh_signals():
    global _scan_in_progress
    if _scan_in_progress:
        return {"status": "already_scanning", "message": "Scan in progress"}
    asyncio.create_task(_run_scan_async())
    return {"status": "started", "message": "Scan started. Check /api/alerts/signals in ~30 seconds"}
