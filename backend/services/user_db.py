"""
User Database Service
SQLite-backed user storage with security-first design.

Tables:
  users           — accounts, credentials, email verification
  refresh_tokens  — JWT refresh token allowlist (revocable)
  watchlist       — per-user stock watchlist
  portfolio       — per-user holdings (stocks + funds)
  preferences     — UI/notification preferences
  signal_outcomes — historical signals + realized returns (shared, not per-user)
  login_attempts  — rate-limit brute-force protection
"""
import os, sqlite3, secrets, hashlib
from datetime import datetime, timedelta
from typing import Optional

DB_FILE = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "data", "users.db"
)

# ── Schema ─────────────────────────────────────────────────────────────────

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id                  TEXT PRIMARY KEY,
    email               TEXT UNIQUE NOT NULL,
    email_lower         TEXT UNIQUE NOT NULL,
    password_hash       TEXT NOT NULL,
    display_name        TEXT,
    email_verified      INTEGER DEFAULT 0,
    verify_token        TEXT,
    verify_token_expiry TEXT,
    reset_token         TEXT,
    reset_token_expiry  TEXT,
    risk_profile        TEXT DEFAULT 'balanced',
    investment_goal     TEXT DEFAULT 'wealth_creation',
    monthly_amount      REAL DEFAULT 0,
    time_horizon_years  INTEGER DEFAULT 10,
    theme               TEXT DEFAULT 'dark',
    onboarding_done     INTEGER DEFAULT 0,
    created_at          TEXT NOT NULL,
    last_login          TEXT,
    is_active           INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
    token_hash  TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL,
    expires_at  TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    revoked     INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS watchlist (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL,
    symbol      TEXT NOT NULL,
    added_at    TEXT NOT NULL,
    note        TEXT,
    alert_on_signal INTEGER DEFAULT 1,
    UNIQUE(user_id, symbol),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS portfolio (
    id           TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL,
    symbol       TEXT NOT NULL,
    name         TEXT,
    asset_type   TEXT NOT NULL,
    quantity     REAL,
    avg_price    REAL,
    monthly_sip  REAL,
    added_at     TEXT NOT NULL,
    UNIQUE(user_id, symbol),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS preferences (
    user_id             TEXT PRIMARY KEY,
    email_alerts        INTEGER DEFAULT 1,
    signal_threshold    REAL DEFAULT 0.65,
    notify_watchlist    INTEGER DEFAULT 1,
    notify_macro        INTEGER DEFAULT 1,
    default_horizon     TEXT DEFAULT 'medium',
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS signal_outcomes (
    id              TEXT PRIMARY KEY,
    symbol          TEXT NOT NULL,
    signal_label    TEXT NOT NULL,
    probability     REAL,
    price_at_signal REAL NOT NULL,
    signal_date     TEXT NOT NULL,
    target_price    REAL,
    stop_price      REAL,
    current_price   REAL,
    return_2w       REAL,
    return_4w       REAL,
    outcome_status  TEXT DEFAULT 'OPEN',
    resolved_at     TEXT
);

CREATE TABLE IF NOT EXISTS login_attempts (
    ip_key      TEXT PRIMARY KEY,
    attempts    INTEGER DEFAULT 0,
    locked_until TEXT
);

CREATE INDEX IF NOT EXISTS idx_signal_outcomes_symbol ON signal_outcomes(symbol);
CREATE INDEX IF NOT EXISTS idx_signal_outcomes_date   ON signal_outcomes(signal_date);
CREATE INDEX IF NOT EXISTS idx_watchlist_user         ON watchlist(user_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_user         ON portfolio(user_id);
"""


def _conn() -> sqlite3.Connection:
    os.makedirs(os.path.dirname(DB_FILE), exist_ok=True)
    conn = sqlite3.connect(DB_FILE, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    conn = _conn()
    conn.executescript(SCHEMA)
    conn.commit()
    conn.close()


# ── User CRUD ──────────────────────────────────────────────────────────────

def create_user(email: str, password_hash: str, display_name: str) -> dict:
    uid   = secrets.token_hex(16)
    token = secrets.token_urlsafe(32)
    expiry = (datetime.utcnow() + timedelta(hours=24)).isoformat()
    now   = datetime.utcnow().isoformat()

    conn = _conn()
    conn.execute(
        """INSERT INTO users
           (id, email, email_lower, password_hash, display_name,
            verify_token, verify_token_expiry, created_at)
           VALUES (?,?,?,?,?,?,?,?)""",
        (uid, email, email.lower(), password_hash, display_name,
         token, expiry, now)
    )
    # default preferences row
    conn.execute("INSERT INTO preferences (user_id) VALUES (?)", (uid,))
    conn.commit()
    conn.close()
    return {"id": uid, "verify_token": token}


def get_user_by_email(email: str) -> Optional[dict]:
    conn = _conn()
    row = conn.execute(
        "SELECT * FROM users WHERE email_lower=?", (email.lower(),)
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def get_user_by_id(uid: str) -> Optional[dict]:
    conn = _conn()
    row = conn.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone()
    conn.close()
    return dict(row) if row else None


def regenerate_verify_token(uid: str) -> str:
    """Create a fresh 24h verification token for an unverified account."""
    token  = secrets.token_urlsafe(32)
    expiry = (datetime.utcnow() + timedelta(hours=24)).isoformat()
    conn = _conn()
    conn.execute(
        "UPDATE users SET verify_token=?, verify_token_expiry=? WHERE id=?",
        (token, expiry, uid)
    )
    conn.commit()
    conn.close()
    return token


def verify_email_token(token: str) -> bool:
    conn = _conn()
    row = conn.execute(
        "SELECT id, verify_token_expiry FROM users WHERE verify_token=? AND email_verified=0",
        (token,)
    ).fetchone()
    if not row:
        conn.close()
        return False
    if datetime.utcnow() > datetime.fromisoformat(row["verify_token_expiry"]):
        conn.close()
        return False
    conn.execute(
        "UPDATE users SET email_verified=1, verify_token=NULL WHERE id=?",
        (row["id"],)
    )
    conn.commit()
    conn.close()
    return True


def update_last_login(uid: str):
    conn = _conn()
    conn.execute("UPDATE users SET last_login=? WHERE id=?",
                 (datetime.utcnow().isoformat(), uid))
    conn.commit()
    conn.close()


def update_user_profile(uid: str, data: dict):
    allowed = {"display_name", "risk_profile", "investment_goal",
               "monthly_amount", "time_horizon_years", "theme", "onboarding_done"}
    fields  = {k: v for k, v in data.items() if k in allowed}
    if not fields:
        return
    set_clause = ", ".join(f"{k}=?" for k in fields)
    conn = _conn()
    conn.execute(f"UPDATE users SET {set_clause} WHERE id=?",
                 (*fields.values(), uid))
    conn.commit()
    conn.close()


# ── Refresh Token Store ────────────────────────────────────────────────────

def save_refresh_token(token: str, uid: str, expires_at: datetime):
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    conn = _conn()
    conn.execute(
        "INSERT OR REPLACE INTO refresh_tokens VALUES (?,?,?,?,0)",
        (token_hash, uid, expires_at.isoformat(), datetime.utcnow().isoformat())
    )
    conn.commit()
    conn.close()


def validate_refresh_token(token: str) -> Optional[str]:
    """Returns user_id if valid, None otherwise."""
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    conn = _conn()
    row = conn.execute(
        "SELECT user_id, expires_at, revoked FROM refresh_tokens WHERE token_hash=?",
        (token_hash,)
    ).fetchone()
    conn.close()
    if not row or row["revoked"]:
        return None
    if datetime.utcnow() > datetime.fromisoformat(row["expires_at"]):
        return None
    return row["user_id"]


def revoke_refresh_token(token: str):
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    conn = _conn()
    conn.execute("UPDATE refresh_tokens SET revoked=1 WHERE token_hash=?",
                 (token_hash,))
    conn.commit()
    conn.close()


def revoke_all_user_tokens(uid: str):
    conn = _conn()
    conn.execute("UPDATE refresh_tokens SET revoked=1 WHERE user_id=?", (uid,))
    conn.commit()
    conn.close()


# ── Rate Limiting ──────────────────────────────────────────────────────────

MAX_ATTEMPTS  = 5
LOCKOUT_MINS  = 15


def check_rate_limit(ip_key: str) -> tuple[bool, int]:
    """Returns (is_blocked, remaining_attempts)."""
    conn = _conn()
    row = conn.execute(
        "SELECT attempts, locked_until FROM login_attempts WHERE ip_key=?",
        (ip_key,)
    ).fetchone()
    conn.close()
    if not row:
        return False, MAX_ATTEMPTS
    if row["locked_until"]:
        if datetime.utcnow() < datetime.fromisoformat(row["locked_until"]):
            return True, 0
        # lock expired — reset
        _reset_attempts(ip_key)
        return False, MAX_ATTEMPTS
    remaining = max(0, MAX_ATTEMPTS - row["attempts"])
    return row["attempts"] >= MAX_ATTEMPTS, remaining


def record_failed_attempt(ip_key: str):
    conn = _conn()
    conn.execute(
        "INSERT INTO login_attempts (ip_key, attempts) VALUES (?,1) "
        "ON CONFLICT(ip_key) DO UPDATE SET attempts=attempts+1",
        (ip_key,)
    )
    row = conn.execute(
        "SELECT attempts FROM login_attempts WHERE ip_key=?", (ip_key,)
    ).fetchone()
    if row and row["attempts"] >= MAX_ATTEMPTS:
        locked = (datetime.utcnow() + timedelta(minutes=LOCKOUT_MINS)).isoformat()
        conn.execute(
            "UPDATE login_attempts SET locked_until=? WHERE ip_key=?",
            (locked, ip_key)
        )
    conn.commit()
    conn.close()


def _reset_attempts(ip_key: str):
    conn = _conn()
    conn.execute("DELETE FROM login_attempts WHERE ip_key=?", (ip_key,))
    conn.commit()
    conn.close()


def clear_attempts_on_success(ip_key: str):
    _reset_attempts(ip_key)


# ── Watchlist ──────────────────────────────────────────────────────────────

def get_watchlist(uid: str) -> list:
    conn = _conn()
    rows = conn.execute(
        "SELECT * FROM watchlist WHERE user_id=? ORDER BY added_at DESC", (uid,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def add_to_watchlist(uid: str, symbol: str, note: str = "") -> bool:
    try:
        conn = _conn()
        conn.execute(
            "INSERT INTO watchlist (id, user_id, symbol, added_at, note) VALUES (?,?,?,?,?)",
            (secrets.token_hex(8), uid, symbol.upper(),
             datetime.utcnow().isoformat(), note)
        )
        conn.commit()
        conn.close()
        return True
    except sqlite3.IntegrityError:
        return False  # already in watchlist


def remove_from_watchlist(uid: str, symbol: str):
    conn = _conn()
    conn.execute(
        "DELETE FROM watchlist WHERE user_id=? AND symbol=?",
        (uid, symbol.upper())
    )
    conn.commit()
    conn.close()


# ── Portfolio ──────────────────────────────────────────────────────────────

def get_portfolio(uid: str) -> list:
    conn = _conn()
    rows = conn.execute(
        "SELECT * FROM portfolio WHERE user_id=? ORDER BY added_at DESC", (uid,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def upsert_portfolio_item(uid: str, item: dict):
    conn = _conn()
    conn.execute(
        """INSERT INTO portfolio
           (id, user_id, symbol, name, asset_type, quantity,
            avg_price, monthly_sip, added_at)
           VALUES (?,?,?,?,?,?,?,?,?)
           ON CONFLICT(user_id, symbol) DO UPDATE SET
           name=excluded.name, quantity=excluded.quantity,
           avg_price=excluded.avg_price, monthly_sip=excluded.monthly_sip""",
        (secrets.token_hex(8), uid,
         item["symbol"].upper(), item.get("name",""),
         item.get("asset_type","stock"),
         item.get("quantity"), item.get("avg_price"),
         item.get("monthly_sip"), datetime.utcnow().isoformat())
    )
    conn.commit()
    conn.close()


def remove_portfolio_item(uid: str, symbol: str):
    conn = _conn()
    conn.execute(
        "DELETE FROM portfolio WHERE user_id=? AND symbol=?",
        (uid, symbol.upper())
    )
    conn.commit()
    conn.close()


# ── Signal Outcomes ────────────────────────────────────────────────────────

def record_signal(symbol: str, label: str, probability: float,
                  price: float, target: float, stop: float) -> str:
    sid = secrets.token_hex(10)
    conn = _conn()
    conn.execute(
        """INSERT INTO signal_outcomes
           (id, symbol, signal_label, probability, price_at_signal,
            signal_date, target_price, stop_price)
           VALUES (?,?,?,?,?,?,?,?)""",
        (sid, symbol.upper(), label, probability, price,
         datetime.utcnow().isoformat(), target, stop)
    )
    conn.commit()
    conn.close()
    return sid


def update_signal_outcome(sid: str, current_price: float,
                           return_2w: float = None, return_4w: float = None):
    conn = _conn()
    status = "OPEN"
    row = conn.execute(
        "SELECT target_price, stop_price FROM signal_outcomes WHERE id=?", (sid,)
    ).fetchone()
    if row:
        if current_price >= row["target_price"]:
            status = "TARGET_HIT"
        elif current_price <= row["stop_price"]:
            status = "STOPPED_OUT"
        elif return_4w is not None:
            status = "CLOSED"
    conn.execute(
        """UPDATE signal_outcomes SET
           current_price=?, return_2w=?, return_4w=?,
           outcome_status=?,
           resolved_at=CASE WHEN ? != 'OPEN' THEN ? ELSE resolved_at END
           WHERE id=?""",
        (current_price, return_2w, return_4w, status,
         status, datetime.utcnow().isoformat(), sid)
    )
    conn.commit()
    conn.close()


def get_signal_outcomes(limit: int = 50) -> list:
    conn = _conn()
    rows = conn.execute(
        """SELECT * FROM signal_outcomes
           ORDER BY signal_date DESC LIMIT ?""", (limit,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_outcome_stats() -> dict:
    conn = _conn()
    total  = conn.execute("SELECT COUNT(*) FROM signal_outcomes").fetchone()[0]
    closed = conn.execute(
        "SELECT COUNT(*) FROM signal_outcomes WHERE outcome_status != 'OPEN'"
    ).fetchone()[0]
    hits   = conn.execute(
        "SELECT COUNT(*) FROM signal_outcomes WHERE outcome_status='TARGET_HIT'"
    ).fetchone()[0]
    avg_r  = conn.execute(
        "SELECT AVG(return_4w) FROM signal_outcomes WHERE return_4w IS NOT NULL"
    ).fetchone()[0]
    conn.close()
    win_rate = round(hits / closed, 3) if closed else None
    return {
        "total_signals":  total,
        "closed_signals": closed,
        "open_signals":   total - closed,
        "target_hit":     hits,
        "win_rate":       win_rate,
        "avg_return_4w":  round(avg_r, 4) if avg_r else None,
    }


# Bootstrap on import
init_db()
