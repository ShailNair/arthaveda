"""
MarketSense - Backend Server
"""
import asyncio, json, uvicorn, os
from dotenv import load_dotenv
load_dotenv()  # load .env before any service imports
from contextlib import asynccontextmanager
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from typing import Set

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from routers import market, alerts, geopolitical, funds, predictions, analytics, auth, user
from services.geo_intelligence import fetch_geo_events
from services.nse_data import get_market_overview
from services.event_calendar import get_today_context, get_upcoming_events
from services.user_db import init_db

executor = ThreadPoolExecutor(max_workers=2)


class ConnectionManager:
    def __init__(self):
        self.active: Set[WebSocket] = set()

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.add(ws)

    def disconnect(self, ws: WebSocket):
        self.active.discard(ws)

    async def broadcast(self, data: dict):
        if not self.active:
            return
        msg = json.dumps(data, default=str)
        dead = set()
        for ws in self.active:
            try:
                await ws.send_text(msg)
            except Exception:
                dead.add(ws)
        for ws in dead:
            self.active.discard(ws)

    async def send(self, ws: WebSocket, data: dict):
        try:
            await ws.send_text(json.dumps(data, default=str))
        except Exception:
            self.disconnect(ws)


manager = ConnectionManager()
scheduler = AsyncIOScheduler()


async def run_in_thread(func, *args):
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(executor, func, *args)


async def job_market_overview():
    try:
        data = await run_in_thread(get_market_overview)
        await manager.broadcast({"type": "MARKET_OVERVIEW", "data": data})
    except Exception as e:
        print(f"[Job] Market error: {e}")


async def job_geo_intel():
    try:
        events = await fetch_geo_events()
        high = [e for e in events if e.get("india_relevance", 0) >= 7]
        if high:
            await manager.broadcast({
                "type": "GEO_ALERT",
                "data": high[0],
                "message": f"High-impact event: {high[0]['headline'][:60]}"
            })
        print(f"[Job] Geo: {len(events)} events")
    except Exception as e:
        print(f"[Job] Geo error: {e}")


async def job_lottery_scan():
    from routers.alerts import _run_scan_async
    try:
        await _run_scan_async()
    except Exception as e:
        print(f"[Job] Scan error: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        init_db()   # ensure user DB tables exist
    except Exception as e:
        print(f"[Boot] DB init warning: {e}")

    print("=== Arthaveda Market Intelligence - Starting ===")

    try:
        scheduler.add_job(job_market_overview, "interval", seconds=90, id="mkt")
        scheduler.add_job(job_geo_intel, "interval", minutes=10, id="geo")
        scheduler.add_job(
            job_lottery_scan, "interval", minutes=20, id="scan",
            next_run_time=datetime.now() + timedelta(minutes=5)
        )
        scheduler.start()
        print("[Boot] Scheduler started.")
    except Exception as e:
        print(f"[Boot] Scheduler warning: {e}")

    print("[Boot] Server ready.")

    yield

    try:
        scheduler.shutdown()
    except Exception:
        pass
    executor.shutdown(wait=False)
    print("[Shutdown] Done")


app = FastAPI(title="Indian Market Lottery Advisor", version="1.0.0", lifespan=lifespan)

_RAW_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000,https://arthaveda.vercel.app"
)
_ORIGINS = [o.strip() for o in _RAW_ORIGINS.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ORIGINS,
    allow_origin_regex=r"https://arthaveda.*\.vercel\.app",
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

app.include_router(market.router)
app.include_router(alerts.router)
app.include_router(geopolitical.router)
app.include_router(funds.router)
app.include_router(predictions.router)
app.include_router(analytics.router)
app.include_router(auth.router)
app.include_router(user.router)


@app.websocket("/ws")
async def ws_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        await manager.send(websocket, {
            "type": "CONNECTED",
            "message": "Connected! Market data loading...",
            "market": {
                "nifty50": 0, "nifty50_change": 0, "sensex": 0, "sensex_change": 0,
                "nifty_bank": 0, "nifty_bank_change": 0, "market_regime": "LOADING",
                "regime_confidence": 0, "top_gainers": [], "top_losers": [],
                "timestamp": datetime.now().isoformat()
            },
            "timestamp": datetime.now().isoformat()
        })

        async def _push_market():
            try:
                data = await run_in_thread(get_market_overview)
                await manager.send(websocket, {"type": "MARKET_OVERVIEW", "data": data})
            except Exception:
                pass
        asyncio.create_task(_push_market())

        while True:
            try:
                msg = await asyncio.wait_for(websocket.receive_text(), timeout=30)
                if msg == "ping":
                    await manager.send(websocket, {"type": "pong"})
            except asyncio.TimeoutError:
                await manager.send(websocket, {"type": "heartbeat", "ts": datetime.now().isoformat()})
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)


@app.get("/api/context/today")
async def today_context():
    """Daily briefing — what to watch today, upcoming events."""
    return get_today_context()

@app.get("/api/context/calendar")
async def event_calendar(days: int = 45):
    return {"events": get_upcoming_events(days_ahead=days)}

@app.get("/")
async def root():
    return {"app": "Indian Market Lottery Advisor", "status": "running", "docs": "/docs"}


@app.get("/health")
async def health():
    return {"status": "healthy", "ts": datetime.now().isoformat()}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False, log_level="info")
