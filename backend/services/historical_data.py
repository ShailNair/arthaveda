"""
Historical OHLCV Data Service
Fetches 1-year daily OHLCV from Yahoo Finance (direct HTTP, no library),
caches to SQLite with 4-hour TTL.
"""
import os, sqlite3, time, requests
from datetime import datetime, timedelta
from typing import Optional
import pandas as pd
import numpy as np

CACHE_TTL_HOURS = 4
YF_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/json",
}


def _db_path() -> str:
    base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base, "data", "ohlcv_cache.db")


def _init_db():
    conn = sqlite3.connect(_db_path(), timeout=10)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS ohlcv_cache (
            symbol TEXT, date TEXT, open REAL, high REAL, low REAL,
            close REAL, volume INTEGER,
            PRIMARY KEY (symbol, date)
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS fetch_log (
            symbol TEXT PRIMARY KEY, last_fetched TEXT
        )
    """)
    conn.commit()
    conn.close()


def _is_stale(symbol: str) -> bool:
    try:
        conn = sqlite3.connect(_db_path(), timeout=10)
        row = conn.execute(
            "SELECT last_fetched FROM fetch_log WHERE symbol=?", (symbol,)
        ).fetchone()
        conn.close()
        if not row:
            return True
        last = datetime.fromisoformat(row[0])
        return (datetime.now() - last).total_seconds() > CACHE_TTL_HOURS * 3600
    except Exception:
        return True


def _read_from_cache(symbol: str) -> Optional[pd.DataFrame]:
    try:
        conn = sqlite3.connect(_db_path(), timeout=10)
        rows = conn.execute(
            "SELECT date, open, high, low, close, volume FROM ohlcv_cache "
            "WHERE symbol=? ORDER BY date",
            (symbol,)
        ).fetchall()
        conn.close()
        if not rows:
            return None
        df = pd.DataFrame(rows, columns=["Date", "Open", "High", "Low", "Close", "Volume"])
        df["Date"] = pd.to_datetime(df["Date"])
        df.set_index("Date", inplace=True)
        df = df.astype({"Open": float, "High": float, "Low": float,
                        "Close": float, "Volume": float})
        return df[df["Close"] > 0]
    except Exception:
        return None


def _write_to_cache(symbol: str, df: pd.DataFrame):
    try:
        conn = sqlite3.connect(_db_path(), timeout=10)
        rows = [
            (symbol, str(idx.date()), row.Open, row.High, row.Low, row.Close, row.Volume)
            for idx, row in df.iterrows()
        ]
        conn.executemany(
            "INSERT OR REPLACE INTO ohlcv_cache VALUES (?,?,?,?,?,?,?)", rows
        )
        conn.execute(
            "INSERT OR REPLACE INTO fetch_log VALUES (?, ?)",
            (symbol, datetime.now().isoformat())
        )
        conn.commit()
        conn.close()
    except sqlite3.OperationalError:
        pass  # ignore lock contention


def _fetch_yahoo(symbol: str) -> Optional[pd.DataFrame]:
    """Fetch 1yr OHLCV directly from Yahoo Finance v8 API."""
    # Ensure .NS suffix for Indian stocks
    ticker = symbol if symbol.endswith(".NS") else f"{symbol}.NS"
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}?interval=1d&range=1y"
    try:
        resp = requests.get(url, headers=YF_HEADERS, timeout=15)
        if resp.status_code != 200:
            return None
        data = resp.json()
        result = data.get("chart", {}).get("result", [])
        if not result:
            return None
        res = result[0]
        timestamps = res.get("timestamp", [])
        q = res.get("indicators", {}).get("quote", [{}])[0]
        opens   = q.get("open", [])
        highs   = q.get("high", [])
        lows    = q.get("low", [])
        closes  = q.get("close", [])
        volumes = q.get("volume", [])

        if not timestamps or not closes:
            return None

        rows = []
        for i, ts in enumerate(timestamps):
            c = closes[i] if i < len(closes) else None
            if c is None:
                continue
            rows.append({
                "Date":   datetime.fromtimestamp(ts),
                "Open":   opens[i]   if i < len(opens)   else c,
                "High":   highs[i]   if i < len(highs)   else c,
                "Low":    lows[i]    if i < len(lows)     else c,
                "Close":  c,
                "Volume": volumes[i] if i < len(volumes) else 0,
            })

        if not rows:
            return None

        df = pd.DataFrame(rows)
        df.set_index("Date", inplace=True)
        df = df.astype(float)
        df = df[df["Close"] > 0].dropna(subset=["Close"])
        return df

    except Exception as e:
        print(f"[HistData] Yahoo fetch error for {symbol}: {e}")
        return None


def get_historical_ohlcv(symbol: str, force_refresh: bool = False) -> pd.DataFrame:
    """
    Returns 1yr daily OHLCV DataFrame.
    Caches to SQLite (4h TTL). Falls back to stale cache on fetch failure.
    """
    _init_db()
    clean = symbol.replace(".NS", "")

    if not force_refresh and not _is_stale(clean):
        cached = _read_from_cache(clean)
        if cached is not None and len(cached) >= 20:
            return cached

    # Fetch fresh
    df = _fetch_yahoo(clean)
    if df is not None and len(df) >= 20:
        _write_to_cache(clean, df)
        return df

    # Fall back to stale cache
    stale = _read_from_cache(clean)
    if stale is not None:
        print(f"[HistData] Using stale cache for {clean}")
        return stale

    return pd.DataFrame()  # empty — caller must handle
