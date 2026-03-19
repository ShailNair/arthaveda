"""
Authentication Service
Password hashing, JWT creation/validation, email domain verification.
Security-first: bcrypt hashing, short-lived access tokens, rotatable refresh tokens.
"""
import os, re, secrets
from datetime import datetime, timedelta
from typing import Optional, Tuple

from passlib.context import CryptContext
from jose import JWTError, jwt

# ── Config (override via environment variables in production) ──────────────
SECRET_KEY        = os.environ.get("JWT_SECRET", secrets.token_hex(32))
ALGORITHM         = "HS256"
ACCESS_TOKEN_MINS = int(os.environ.get("ACCESS_TOKEN_MINS", "15"))
REFRESH_TOKEN_DAYS= int(os.environ.get("REFRESH_TOKEN_DAYS", "7"))

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)

# ── Email Validation ───────────────────────────────────────────────────────

EMAIL_RE = re.compile(r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$")

# Known disposable/fake email domains to block
BLOCKED_DOMAINS = {
    "mailinator.com", "guerrillamail.com", "tempmail.com", "throwaway.email",
    "trashmail.com", "sharklasers.com", "guerrillamailblock.com",
    "grr.la", "guerrillamail.info", "spam4.me", "yopmail.com",
    "dispostable.com", "mailnull.com", "spamgourmet.com",
}


def validate_email_format(email: str) -> Tuple[bool, str]:
    """Validate email format. Returns (valid, error_message)."""
    if not email or len(email) > 254:
        return False, "Invalid email address"
    if not EMAIL_RE.match(email):
        return False, "Invalid email format"
    domain = email.split("@")[1].lower()
    if domain in BLOCKED_DOMAINS:
        return False, "Disposable email addresses are not allowed"
    return True, ""


def validate_email_domain(email: str) -> Tuple[bool, str]:
    """
    Check that the email domain has valid MX records.
    Accepts Gmail, Yahoo, Outlook, institutional domains — rejects fake domains.
    """
    try:
        import dns.resolver
        domain = email.split("@")[1]
        records = dns.resolver.resolve(domain, "MX", lifetime=5)
        if records:
            return True, ""
        return False, "Email domain has no mail server"
    except Exception:
        # DNS lookup failed — could be network issue or fake domain
        # Fail open for known providers, fail closed for unknown
        domain = email.split("@")[1].lower()
        KNOWN_PROVIDERS = {
            "gmail.com", "yahoo.com", "yahoo.in", "outlook.com",
            "hotmail.com", "icloud.com", "protonmail.com",
            "rediffmail.com", "live.com", "me.com",
        }
        if domain in KNOWN_PROVIDERS:
            return True, ""
        return False, "Could not verify email domain. Please use a valid email address."


# ── Password ───────────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    return pwd_ctx.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_ctx.verify(plain, hashed)


def validate_password_strength(password: str) -> Tuple[bool, str]:
    """Enforce minimum security: 8+ chars, mix of types."""
    if len(password) < 8:
        return False, "Password must be at least 8 characters"
    if not re.search(r"[A-Z]", password):
        return False, "Password must contain at least one uppercase letter"
    if not re.search(r"[0-9]", password):
        return False, "Password must contain at least one number"
    return True, ""


# ── JWT ────────────────────────────────────────────────────────────────────

def create_access_token(uid: str, email: str) -> str:
    payload = {
        "sub":   uid,
        "email": email,
        "type":  "access",
        "exp":   datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_MINS),
        "iat":   datetime.utcnow(),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token() -> str:
    """Cryptographically random refresh token (not JWT — stored in DB)."""
    return secrets.token_urlsafe(48)


def decode_access_token(token: str) -> Optional[dict]:
    """Returns payload dict or None if invalid/expired."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "access":
            return None
        return payload
    except JWTError:
        return None


def refresh_token_expiry() -> datetime:
    return datetime.utcnow() + timedelta(days=REFRESH_TOKEN_DAYS)


# ── Email Sending ──────────────────────────────────────────────────────────

SMTP_HOST = os.environ.get("SMTP_HOST", "").strip()
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587") or "587")
SMTP_USER = os.environ.get("SMTP_USER", "").strip()
SMTP_PASS = os.environ.get("SMTP_PASS", "").strip()
SMTP_FROM = os.environ.get("SMTP_FROM", "").strip() or SMTP_USER or "noreply@marketsense.in"
APP_URL   = os.environ.get("APP_URL", "http://localhost:3000")
APP_NAME  = os.environ.get("APP_NAME", "MarketSense")

# SMTP is only "ready" if host AND user are set AND not placeholder values
_SMTP_READY = bool(
    SMTP_HOST and SMTP_USER and SMTP_PASS
    and not SMTP_USER.startswith("your-")
    and "@" in SMTP_USER
)


async def send_verification_email(email: str, display_name: str, token: str):
    """Send email verification link. Falls back to console if SMTP not configured."""
    verify_url = f"{APP_URL}/verify-email?token={token}"
    subject    = f"Verify your {APP_NAME} account"
    body       = f"""Hello {display_name},

Welcome to {APP_NAME} — India's intelligent investment advisor.

Please verify your email address by clicking the link below:
{verify_url}

This link expires in 24 hours.

If you did not create an account, you can safely ignore this email.

— {APP_NAME} Team
"""
    if not _SMTP_READY:
        # Development fallback — print to console
        print(f"\n{'='*60}")
        print(f"[DEV] Email verification for {email}")
        print(f"[DEV] Verify URL: {verify_url}")
        print(f"{'='*60}\n")
        return

    try:
        import aiosmtplib
        from email.mime.text import MIMEText
        msg = MIMEText(body)
        msg["Subject"] = subject
        msg["From"]    = SMTP_FROM
        msg["To"]      = email
        await aiosmtplib.send(
            msg,
            hostname=SMTP_HOST,
            port=SMTP_PORT,
            username=SMTP_USER,
            password=SMTP_PASS,
            start_tls=True,
        )
    except Exception as e:
        print(f"[Auth] Email send failed: {e}")
        print(f"[Dev] Verify URL: {verify_url}")


async def send_password_reset_email(email: str, token: str):
    reset_url = f"{APP_URL}/reset-password?token={token}"
    print(f"[DEV] Password reset for {email}: {reset_url}")
    # Production: same pattern as above with SMTP
