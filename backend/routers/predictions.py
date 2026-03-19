"""
Predictions API Router
Exposes the AI-assisted prediction engine results.
"""
import asyncio
from concurrent.futures import ThreadPoolExecutor
from fastapi import APIRouter

from services.prediction_engine import run_predictions

router = APIRouter(prefix="/api/predictions", tags=["predictions"])
executor = ThreadPoolExecutor(max_workers=2)


async def _run(func, *args):
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(executor, func, *args)


@router.get("/")
async def get_predictions():
    """
    Run the full prediction engine — returns causal chain predictions,
    sector forecasts, macro state, and top stock picks per prediction.
    """
    return await _run(run_predictions)
