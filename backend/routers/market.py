from fastapi import APIRouter
from concurrent.futures import ThreadPoolExecutor
from services.nse_data import get_market_overview, get_stock_data, get_bulk_deals, get_breakout_candidates
from services.macro_risk import get_macro_risk
import asyncio

router = APIRouter(prefix="/api/market", tags=["market"])
executor = ThreadPoolExecutor(max_workers=2)


async def _run(fn, *args):
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(executor, fn, *args)


@router.get("/overview")
async def market_overview():
    return await _run(get_market_overview)


@router.get("/stock/{symbol}")
async def stock_detail(symbol: str, period: str = "6mo"):
    clean = symbol.upper()
    if not clean.endswith(".NS"):
        clean += ".NS"
    return await _run(get_stock_data, clean, period)


@router.get("/bulk-deals")
async def bulk_deals():
    return await _run(get_bulk_deals)


@router.get("/breakouts")
async def breakout_candidates():
    return await _run(get_breakout_candidates)


@router.get("/macro-risk")
async def macro_risk():
    return await _run(get_macro_risk)
