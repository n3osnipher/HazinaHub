"""
Reino - Settings Router v2.2
Security settings: PIN lock, biometric, passkey, stay_logged_in
"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, Literal

from models import User, SimCard, AppSecurity
from services.auth import get_current_user, hash_password, verify_password

router = APIRouter(prefix="/api/settings", tags=["Settings"])


class GeneralIn(BaseModel):
    hiah_voice: Optional[str] = None
    hiah_language: Optional[str] = None
    default_isp: Optional[str] = None
    default_sim_slot: Optional[int] = None
    notifications_enabled: Optional[bool] = None
    call_recording_enabled: Optional[bool] = None
    stt_provider: Optional[str] = None
    tts_provider: Optional[str] = None
    theme: Optional[str] = None
    stay_logged_in: Optional[bool] = None


class ApiKeysIn(BaseModel):
    gemini_api_key: Optional[str] = None
    elevenlabs_api_key: Optional[str] = None
    elevenlabs_voice_id: Optional[str] = None


class PermissionsIn(BaseModel):
    can_make_calls: Optional[bool] = None
    can_send_sms: Optional[bool] = None
    can_read_messages: Optional[bool] = None
    can_manage_contacts: Optional[bool] = None
    auto_reply: Optional[bool] = None
    notify_on_action: Optional[bool] = None
    detect_spam: Optional[bool] = None
    identify_unknown: Optional[bool] = None


class SimCardIn(BaseModel):
    slot: int
    phone_number: Optional[str] = None
    isp: Optional[str] = None
    is_default: bool = False
    is_active: bool = True


class SecurityIn(BaseModel):
    lock_enabled: Optional[bool] = None
    lock_type: Optional[Literal["none", "pin", "biometric", "passkey"]] = None
    pin: Optional[str] = None           # Raw PIN to hash
    current_pin: Optional[str] = None  # For verification when changing
    auto_lock_minutes: Optional[int] = None
    lock_on_background: Optional[bool] = None
    use_phone_biometric: Optional[bool] = None


class VerifyPinIn(BaseModel):
    pin: str


@router.patch("/general")
async def update_general(body: GeneralIn, user: User = Depends(get_current_user)):
    for field, val in body.model_dump(exclude_none=True).items():
        setattr(user.settings, field, val)
    user.updated_at = datetime.utcnow()
    await user.save()
    return {"success": True}


@router.patch("/api-keys")
async def update_api_keys(body: ApiKeysIn, user: User = Depends(get_current_user)):
    k = user.settings.api_keys
    if body.gemini_api_key is not None:
        k.gemini_api_key = body.gemini_api_key or None
    if body.elevenlabs_api_key is not None:
        k.elevenlabs_api_key = body.elevenlabs_api_key or None
    if body.elevenlabs_voice_id:
        k.elevenlabs_voice_id = body.elevenlabs_voice_id
    user.updated_at = datetime.utcnow()
    await user.save()
    return {"success": True}


@router.patch("/hiah-permissions")
async def update_perms(body: PermissionsIn, user: User = Depends(get_current_user)):
    p = user.settings.hiah_permissions
    for field, val in body.model_dump(exclude_none=True).items():
        setattr(p, field, val)
    user.updated_at = datetime.utcnow()
    await user.save()
    return {"success": True, "permissions": p.model_dump()}


@router.post("/sim-cards")
async def sync_sims(sims: list[SimCardIn], user: User = Depends(get_current_user)):
    user.sim_cards = [SimCard(**s.model_dump()) for s in sims]
    user.updated_at = datetime.utcnow()
    await user.save()
    return {"success": True, "sim_cards": [s.model_dump() for s in user.sim_cards]}


@router.get("/sim-cards")
async def get_sims(user: User = Depends(get_current_user)):
    return {"success": True, "sim_cards": [s.model_dump() for s in user.sim_cards]}


# ── Security / App Lock ───────────────────────────────────────────
@router.patch("/security")
async def update_security(body: SecurityIn, user: User = Depends(get_current_user)):
    sec = user.settings.security

    # Changing PIN requires current PIN verification
    if body.pin and sec.pin_hash and body.lock_type == "pin":
        if not body.current_pin or not verify_password(body.current_pin, sec.pin_hash):
            raise HTTPException(400, "Current PIN is incorrect")

    if body.lock_enabled is not None:
        sec.lock_enabled = body.lock_enabled
    if body.lock_type is not None:
        sec.lock_type = body.lock_type
    if body.pin:
        sec.pin_hash = hash_password(body.pin)
    if body.auto_lock_minutes is not None:
        sec.auto_lock_minutes = body.auto_lock_minutes
    if body.lock_on_background is not None:
        sec.lock_on_background = body.lock_on_background
    if body.use_phone_biometric is not None:
        sec.use_phone_biometric = body.use_phone_biometric

    user.updated_at = datetime.utcnow()
    await user.save()
    return {
        "success": True,
        "security": {
            "lock_enabled": sec.lock_enabled,
            "lock_type": sec.lock_type,
            "has_pin": sec.pin_hash is not None,
            "auto_lock_minutes": sec.auto_lock_minutes,
            "lock_on_background": sec.lock_on_background,
            "use_phone_biometric": sec.use_phone_biometric,
        }
    }


@router.post("/security/verify-pin")
async def verify_pin(body: VerifyPinIn, user: User = Depends(get_current_user)):
    sec = user.settings.security
    if not sec.pin_hash:
        raise HTTPException(400, "No PIN set")
    if not verify_password(body.pin, sec.pin_hash):
        raise HTTPException(401, "Incorrect PIN")
    return {"success": True, "verified": True}


@router.get("/security")
async def get_security(user: User = Depends(get_current_user)):
    sec = user.settings.security
    return {
        "success": True,
        "security": {
            "lock_enabled": sec.lock_enabled,
            "lock_type": sec.lock_type,
            "has_pin": sec.pin_hash is not None,
            "auto_lock_minutes": sec.auto_lock_minutes,
            "lock_on_background": sec.lock_on_background,
            "use_phone_biometric": sec.use_phone_biometric,
        },
        "stay_logged_in": user.settings.stay_logged_in,
    }
