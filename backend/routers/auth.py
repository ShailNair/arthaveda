"""
Auth Router — Register, Login, Verify Email, Refresh, Logout
Security: rate limiting, MX validation, bcrypt passwords, JWT + refresh tokens.
"""
import os
from fastapi import APIRouter, Request, Response, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional

from services.auth_service import (
    validate_email_format, validate_email_domain, validate_password_strength,
    hash_password, verify_password,
    create_access_token, create_refresh_token, decode_access_token,
    refresh_token_expiry, send_verification_email,
)
from services.user_db import (
    create_user, get_user_by_email, get_user_by_id,
    verify_email_token, update_last_login, update_user_profile,
    save_refresh_token, validate_refresh_token, revoke_refresh_token,
    revoke_all_user_tokens, regenerate_verify_token,
    check_rate_limit, record_failed_attempt, clear_attempts_on_success,
)

router  = APIRouter(prefix="/api/auth", tags=["auth"])
bearer  = HTTPBearer(auto_error=False)

COOKIE_NAME    = "refresh_token"
COOKIE_MAX_AGE = 7 * 24 * 3600  # 7 days in seconds


# ── Schemas ────────────────────────────────────────────────────────────────

class RegisterBody(BaseModel):
    email:        str
    password:     str
    display_name: str

class LoginBody(BaseModel):
    email:    str
    password: str

class ProfileBody(BaseModel):
    display_name:       Optional[str] = None
    risk_profile:       Optional[str] = None
    investment_goal:    Optional[str] = None
    monthly_amount:     Optional[float] = None
    time_horizon_years: Optional[int] = None
    theme:              Optional[str] = None
    onboarding_done:    Optional[int] = None


# ── Helpers ────────────────────────────────────────────────────────────────

def _ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    return (forwarded.split(",")[0] if forwarded else request.client.host) or "unknown"


_IS_PROD = os.getenv("RAILWAY_ENVIRONMENT") is not None or os.getenv("ENV", "dev") == "prod"

def _set_refresh_cookie(response: Response, token: str):
    response.set_cookie(
        key=COOKIE_NAME, value=token,
        httponly=True,
        secure=_IS_PROD,          # must be True for SameSite=none
        samesite="none" if _IS_PROD else "lax",   # none = cross-domain works
        max_age=COOKIE_MAX_AGE,
        path="/api/auth",
    )


def _clear_refresh_cookie(response: Response):
    response.delete_cookie(key=COOKIE_NAME, path="/api/auth")


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer),
) -> Optional[dict]:
    """Dependency: returns user dict if valid access token, else None."""
    if not credentials:
        return None
    payload = decode_access_token(credentials.credentials)
    if not payload:
        return None
    user = get_user_by_id(payload["sub"])
    if not user or not user["is_active"]:
        return None
    return user


async def require_user(
    user: Optional[dict] = Depends(get_current_user)
) -> dict:
    """Dependency: raises 401 if not authenticated."""
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    if not user["email_verified"]:
        raise HTTPException(status_code=403, detail="Please verify your email first")
    return user


# ── Endpoints ──────────────────────────────────────────────────────────────

@router.post("/register")
async def register(body: RegisterBody, request: Request):
    ip = _ip(request)

    # Rate limit check
    blocked, remaining = check_rate_limit(f"reg:{ip}")
    if blocked:
        raise HTTPException(429, "Too many attempts. Please wait 15 minutes.")

    # Email format
    valid, err = validate_email_format(body.email)
    if not valid:
        raise HTTPException(400, err)

    # Email domain MX check (real email only)
    valid, err = validate_email_domain(body.email)
    if not valid:
        raise HTTPException(400, err)

    # Password strength
    valid, err = validate_password_strength(body.password)
    if not valid:
        raise HTTPException(400, err)

    # Display name
    name = body.display_name.strip()[:50]
    if len(name) < 2:
        raise HTTPException(400, "Display name must be at least 2 characters")

    # Duplicate check — handle unverified accounts gracefully
    existing = get_user_by_email(body.email)
    if existing:
        if existing["email_verified"]:
            raise HTTPException(409, "An account with this email already exists. Please sign in.")
        # Unverified account — update password + regenerate token (resend)
        from services.auth_service import _SMTP_READY, APP_URL
        from services.user_db import _conn as _db_conn
        new_hash  = hash_password(body.password)
        new_token = regenerate_verify_token(existing["id"])
        # Update password and display_name in case they changed
        c = _db_conn()
        c.execute(
            "UPDATE users SET password_hash=?, display_name=? WHERE id=?",
            (new_hash, body.display_name.strip()[:50], existing["id"])
        )
        c.commit(); c.close()
        verify_url = f"{APP_URL}/verify-email?token={new_token}"
        await send_verification_email(body.email, body.display_name.strip(), new_token)
        return {
            "message":    "Verification link regenerated. Please verify your email to continue.",
            "email":      body.email,
            "email_sent": _SMTP_READY,
            "verify_url": verify_url if not _SMTP_READY else None,
            "dev_mode":   not _SMTP_READY,
            "resent":     True,
        }

    # Create user
    pw_hash = hash_password(body.password)
    result  = create_user(body.email, pw_hash, name)

    # Build verify URL — return it in response so UI can show it directly
    from services.auth_service import _SMTP_READY, APP_URL
    smtp_ready = _SMTP_READY
    verify_url = f"{APP_URL}/verify-email?token={result['verify_token']}"

    # Try sending email
    await send_verification_email(body.email, name, result["verify_token"])

    return {
        "message":    "Account created! Please verify your email to continue.",
        "email":      body.email,
        "email_sent": smtp_ready,
        # Always return the link so the UI can show a click-to-verify button
        # (In production with SMTP configured this is omitted for security)
        "verify_url": verify_url if not smtp_ready else None,
        "dev_mode":   not smtp_ready,
    }


@router.post("/login")
async def login(body: LoginBody, request: Request, response: Response):
    ip  = _ip(request)
    key = f"login:{ip}:{body.email.lower()}"

    # Rate limit
    blocked, remaining = check_rate_limit(key)
    if blocked:
        raise HTTPException(429, "Too many failed attempts. Please wait 15 minutes.")

    # Fetch user (constant-time pattern: always hash even if user not found)
    user = get_user_by_email(body.email)
    dummy_hash = "$2b$12$dummy.hash.for.timing.consistency.padding"

    if not user:
        verify_password(body.password, dummy_hash)  # prevent timing attack
        record_failed_attempt(key)
        raise HTTPException(401, f"Invalid email or password. {remaining-1} attempts remaining.")

    if not verify_password(body.password, user["password_hash"]):
        record_failed_attempt(key)
        remaining -= 1
        raise HTTPException(
            401,
            f"Invalid email or password.{f' {remaining} attempts remaining.' if remaining > 0 else ' Account locked for 15 minutes.'}"
        )

    if not user["is_active"]:
        raise HTTPException(403, "This account has been disabled.")

    if not user["email_verified"]:
        raise HTTPException(403, "Please verify your email address before logging in.")

    # Success — issue tokens
    clear_attempts_on_success(key)
    update_last_login(user["id"])

    access_token  = create_access_token(user["id"], user["email"])
    refresh_token = create_refresh_token()
    expiry        = refresh_token_expiry()
    save_refresh_token(refresh_token, user["id"], expiry)
    _set_refresh_cookie(response, refresh_token)

    return {
        "access_token": access_token,
        "token_type":   "bearer",
        "user": {
            "id":               user["id"],
            "email":            user["email"],
            "display_name":     user["display_name"],
            "theme":            user["theme"],
            "risk_profile":     user["risk_profile"],
            "investment_goal":  user["investment_goal"],
            "monthly_amount":   user["monthly_amount"],
            "time_horizon_years": user["time_horizon_years"],
            "onboarding_done":  user["onboarding_done"],
        },
    }


@router.get("/verify-email")
async def verify_email(token: str):
    if not token:
        raise HTTPException(400, "Verification token is required")
    success = verify_email_token(token)
    if not success:
        raise HTTPException(400, "Invalid or expired verification link. Please register again.")
    return {"message": "Email verified successfully. You can now log in."}


@router.post("/refresh")
async def refresh(request: Request, response: Response):
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        raise HTTPException(401, "No refresh token")

    uid = validate_refresh_token(token)
    if not uid:
        _clear_refresh_cookie(response)
        raise HTTPException(401, "Session expired. Please log in again.")

    user = get_user_by_id(uid)
    if not user or not user["is_active"]:
        _clear_refresh_cookie(response)
        raise HTTPException(401, "Account not found or disabled.")

    # Rotate refresh token (revoke old, issue new)
    revoke_refresh_token(token)
    new_refresh = create_refresh_token()
    new_expiry  = refresh_token_expiry()
    save_refresh_token(new_refresh, uid, new_expiry)
    _set_refresh_cookie(response, new_refresh)

    access_token = create_access_token(uid, user["email"])
    return {
        "access_token": access_token,
        "token_type":   "bearer",
    }


@router.post("/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get(COOKIE_NAME)
    if token:
        revoke_refresh_token(token)
    _clear_refresh_cookie(response)
    return {"message": "Logged out successfully"}


@router.post("/logout-all")
async def logout_all(
    request: Request, response: Response,
    user: dict = Depends(require_user)
):
    """Revoke all sessions (e.g., after password change)."""
    revoke_all_user_tokens(user["id"])
    _clear_refresh_cookie(response)
    return {"message": "All sessions terminated"}


@router.get("/me")
async def me(user: dict = Depends(require_user)):
    return {
        "id":               user["id"],
        "email":            user["email"],
        "display_name":     user["display_name"],
        "theme":            user["theme"],
        "risk_profile":     user["risk_profile"],
        "investment_goal":  user["investment_goal"],
        "monthly_amount":   user["monthly_amount"],
        "time_horizon_years": user["time_horizon_years"],
        "onboarding_done":  user["onboarding_done"],
    }


@router.patch("/profile")
async def update_profile(body: ProfileBody, user: dict = Depends(require_user)):
    updates = body.model_dump(exclude_none=True)
    update_user_profile(user["id"], updates)
    updated = get_user_by_id(user["id"])
    return {"message": "Profile updated", "theme": updated["theme"]}
