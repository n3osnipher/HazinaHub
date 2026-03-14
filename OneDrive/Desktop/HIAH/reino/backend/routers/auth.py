"""
Reino - Auth Router
POST /api/auth/register
POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/forgot-password
POST /api/auth/reset-password
GET  /api/auth/me
PATCH /api/auth/me
"""
import secrets
from datetime import datetime
from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel, EmailStr

from models import User, UserSettings, HiahPermissions, ApiKeys
from services.auth import hash_password, verify_password, create_access_token, get_current_user

router = APIRouter(prefix="/api/auth", tags=["Auth"])

# In-memory reset tokens (use Redis/DB in production)
_reset_tokens: dict[str, str] = {}  # token → user_id


class RegisterIn(BaseModel):
    name: str
    email: EmailStr
    password: str
    phone: str | None = None


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class ForgotIn(BaseModel):
    email: EmailStr


class ResetIn(BaseModel):
    token: str
    new_password: str


class UpdateMeIn(BaseModel):
    name: str | None = None
    phone: str | None = None
    avatar: str | None = None


def user_out(user: User) -> dict:
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "phone": user.phone,
        "avatar": user.avatar,
        "is_verified": user.is_verified,
        "sim_cards": [s.model_dump() for s in user.sim_cards],
        "settings": {
            "hiah_voice": user.settings.hiah_voice,
            "hiah_language": user.settings.hiah_language,
            "default_isp": user.settings.default_isp,
            "default_sim_slot": user.settings.default_sim_slot,
            "notifications_enabled": user.settings.notifications_enabled,
            "call_recording_enabled": user.settings.call_recording_enabled,
            "stt_provider": user.settings.stt_provider,
            "tts_provider": user.settings.tts_provider,
            "theme": user.settings.theme,
            "hiah_permissions": user.settings.hiah_permissions.model_dump(),
            "api_keys": {
                "gemini_api_key": "***" if user.settings.api_keys.gemini_api_key else None,
                "elevenlabs_api_key": "***" if user.settings.api_keys.elevenlabs_api_key else None,
                "elevenlabs_voice_id": user.settings.api_keys.elevenlabs_voice_id,
            },
        },
        "created_at": user.created_at.isoformat(),
    }


@router.post("/register", status_code=201)
async def register(body: RegisterIn):
    existing = await User.find_one(User.email == body.email)
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        name=body.name.strip(),
        email=body.email.lower(),
        password_hash=hash_password(body.password),
        phone=body.phone,
    )
    await user.insert()
    token = create_access_token(user.id)
    return {"success": True, "token": token, "user": user_out(user)}


@router.post("/login")
async def login(body: LoginIn):
    user = await User.find_one(User.email == body.email.lower())
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")

    user.last_seen = datetime.utcnow()
    await user.save()

    token = create_access_token(user.id)
    return {"success": True, "token": token, "user": user_out(user)}


@router.post("/forgot-password")
async def forgot_password(body: ForgotIn):
    user = await User.find_one(User.email == body.email.lower())
    # Always return success to prevent email enumeration
    if user:
        token = secrets.token_urlsafe(32)
        _reset_tokens[token] = user.id
        # TODO: send email with reset link
        # In production, integrate SendGrid / SMTP here
        print(f"[DEV] Password reset token for {user.email}: {token}")
    return {"success": True, "message": "If that email exists, a reset link has been sent."}


@router.post("/reset-password")
async def reset_password(body: ResetIn):
    user_id = _reset_tokens.pop(body.token, None)
    if not user_id:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    user = await User.find_one(User.id == user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.password_hash = hash_password(body.new_password)
    user.updated_at = datetime.utcnow()
    await user.save()
    return {"success": True, "message": "Password updated. Please log in."}


@router.get("/me")
async def get_me(user: User = Depends(get_current_user)):
    return {"success": True, "user": user_out(user)}


@router.patch("/me")
async def update_me(body: UpdateMeIn, user: User = Depends(get_current_user)):
    if body.name:
        user.name = body.name
    if body.phone is not None:
        user.phone = body.phone
    if body.avatar is not None:
        user.avatar = body.avatar
    user.updated_at = datetime.utcnow()
    await user.save()
    return {"success": True, "user": user_out(user)}
