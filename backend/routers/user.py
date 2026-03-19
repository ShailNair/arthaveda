"""
User Data Router — Watchlist, Portfolio, Preferences, Signal Outcomes
All endpoints require authentication.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from routers.auth import require_user, get_current_user
from services.user_db import (
    get_watchlist, add_to_watchlist, remove_from_watchlist,
    get_portfolio, upsert_portfolio_item, remove_portfolio_item,
    get_signal_outcomes, get_outcome_stats,
)

router = APIRouter(prefix="/api/user", tags=["user"])


# ── Schemas ────────────────────────────────────────────────────────────────

class WatchlistAdd(BaseModel):
    symbol: str
    note:   Optional[str] = ""

class PortfolioItem(BaseModel):
    symbol:     str
    name:       Optional[str] = ""
    asset_type: Optional[str] = "stock"   # stock | fund
    quantity:   Optional[float] = None
    avg_price:  Optional[float] = None
    monthly_sip:Optional[float] = None


# ── Watchlist ──────────────────────────────────────────────────────────────

@router.get("/watchlist")
async def get_user_watchlist(user: dict = Depends(require_user)):
    return get_watchlist(user["id"])


@router.post("/watchlist")
async def add_watchlist(body: WatchlistAdd, user: dict = Depends(require_user)):
    added = add_to_watchlist(user["id"], body.symbol, body.note or "")
    if not added:
        raise HTTPException(409, f"{body.symbol} is already in your watchlist")
    return {"message": f"{body.symbol.upper()} added to watchlist"}


@router.delete("/watchlist/{symbol}")
async def remove_watchlist(symbol: str, user: dict = Depends(require_user)):
    remove_from_watchlist(user["id"], symbol)
    return {"message": f"{symbol.upper()} removed from watchlist"}


# ── Portfolio ──────────────────────────────────────────────────────────────

@router.get("/portfolio")
async def get_user_portfolio(user: dict = Depends(require_user)):
    return get_portfolio(user["id"])


@router.post("/portfolio")
async def add_portfolio_item(body: PortfolioItem, user: dict = Depends(require_user)):
    upsert_portfolio_item(user["id"], body.model_dump())
    return {"message": f"{body.symbol.upper()} saved to portfolio"}


@router.delete("/portfolio/{symbol}")
async def remove_from_portfolio(symbol: str, user: dict = Depends(require_user)):
    remove_portfolio_item(user["id"], symbol)
    return {"message": f"{symbol.upper()} removed from portfolio"}


# ── Signal Outcome Tracking ────────────────────────────────────────────────

@router.get("/signal-outcomes")
async def signal_outcomes(
    limit: int = 30,
    user: Optional[dict] = Depends(get_current_user)   # public endpoint — auth optional
):
    """
    Returns historical signals and their realized returns.
    Available to all users (logged in or not) — transparency builds trust.
    """
    outcomes = get_signal_outcomes(limit)
    stats    = get_outcome_stats()
    return {
        "stats":    stats,
        "outcomes": outcomes,
    }
