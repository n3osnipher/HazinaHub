"""
Reino - MongoDB Document Models v2.2
New: blocked contacts, archived messages, full call states,
     app security (PIN/passkey/biometric), spam detection,
     chat histories (Hiah), unknown number tagging
"""
from beanie import Document
from pydantic import BaseModel, Field, EmailStr
from typing import Optional, Literal, Any
from datetime import datetime
import uuid


def uid() -> str:
    return str(uuid.uuid4())


# ── Embedded Models ──────────────────────────────────────────────

class SimCard(BaseModel):
    slot: int
    phone_number: Optional[str] = None
    isp: Optional[str] = None
    is_default: bool = False
    is_active: bool = True

class HiahPermissions(BaseModel):
    can_make_calls: bool = False
    can_send_sms: bool = False
    can_read_messages: bool = True
    can_manage_contacts: bool = False
    auto_reply: bool = False
    notify_on_action: bool = True
    detect_spam: bool = True            # Hiah flags spam/unknown callers
    identify_unknown: bool = True       # Hiah tries to identify unsaved numbers

class AppSecurity(BaseModel):
    """App-level lock settings — PIN, biometric, passkey"""
    lock_enabled: bool = False
    lock_type: Literal["none", "pin", "biometric", "passkey"] = "none"
    pin_hash: Optional[str] = None      # bcrypt hash of PIN
    passkey_id: Optional[str] = None    # WebAuthn credential ID
    auto_lock_minutes: int = 5          # 0 = never
    lock_on_background: bool = True
    use_phone_biometric: bool = False   # Android/iOS biometric

class ApiKeys(BaseModel):
    gemini_api_key: Optional[str] = None
    elevenlabs_api_key: Optional[str] = None
    elevenlabs_voice_id: str = "21m00Tcm4TlvDq8ikWAM"

class UserSettings(BaseModel):
    hiah_voice: str = "Rachel"
    hiah_language: str = "en-KE"
    default_isp: str = "safaricom"
    default_sim_slot: int = 0
    notifications_enabled: bool = True
    call_recording_enabled: bool = False
    stt_provider: str = "browser"
    tts_provider: str = "browser"
    theme: str = "dark"
    hiah_permissions: HiahPermissions = Field(default_factory=HiahPermissions)
    api_keys: ApiKeys = Field(default_factory=ApiKeys)
    security: AppSecurity = Field(default_factory=AppSecurity)
    stay_logged_in: bool = True         # Persist session across app restarts


# ── Document Models ──────────────────────────────────────────────

class User(Document):
    id: str = Field(default_factory=uid)
    name: str
    email: EmailStr
    password_hash: str
    phone: Optional[str] = None
    avatar: Optional[str] = None
    is_verified: bool = False
    is_active: bool = True
    sim_cards: list[SimCard] = []
    settings: UserSettings = Field(default_factory=UserSettings)
    last_seen: datetime = Field(default_factory=datetime.utcnow)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "users"
        indexes = ["email"]


class Contact(Document):
    id: str = Field(default_factory=uid)
    user_id: str
    name: str
    phone: str
    phone2: Optional[str] = None
    email: Optional[str] = None
    initials: str = ""
    color: str = "#6c63ff"
    is_favorite: bool = False
    is_blocked: bool = False            # Blocked contact
    blocked_at: Optional[datetime] = None
    block_reason: Optional[str] = None
    tags: list[str] = []
    notes: Optional[str] = None
    # Spam/unknown detection
    is_spam: bool = False
    spam_score: int = 0                 # 0-100
    is_unknown: bool = False            # Not saved, auto-created from inbound
    # Sync
    local_id: Optional[str] = None
    sync_status: str = "synced"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "contacts"
        indexes = ["user_id", "phone"]


class CallRecord(Document):
    id: str = Field(default_factory=uid)
    user_id: str
    contact_id: Optional[str] = None
    contact_name: str = "Unknown"
    phone: str
    direction: Literal["inbound", "outbound"] = "outbound"
    # Full call state machine
    status: Literal[
        "ringing",      # Incoming ringing / outgoing dialing
        "incoming",     # Incoming call on screen
        "outgoing",     # Outgoing dialing
        "ongoing",      # Call connected and live
        "called",       # Finished outbound call
        "ended",        # Call ended (either party)
        "missed",       # Inbound never answered
        "rejected",     # Rejected by user
        "failed",       # Technical failure
        "voicemail",    # Went to voicemail
    ] = "ringing"
    started_at: datetime = Field(default_factory=datetime.utcnow)
    answered_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    duration: Optional[int] = None      # seconds
    isp: str = "safaricom"
    sim_slot: int = 0
    by_hiah: bool = False
    hiah_notes: Optional[str] = None
    recording_url: Optional[str] = None
    transcript: Optional[str] = None
    # Unknown/spam
    is_unknown: bool = False
    is_spam: bool = False
    spam_reason: Optional[str] = None
    # Sync
    local_id: Optional[str] = None
    sync_status: str = "synced"

    class Settings:
        name = "calls"
        indexes = ["user_id", "started_at"]


class Message(Document):
    id: str = Field(default_factory=uid)
    user_id: str
    contact_id: Optional[str] = None
    contact_name: str
    channel: Literal["sms"] = "sms"
    direction: Literal["inbound", "outbound"] = "inbound"
    body: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    status: Literal["pending", "sent", "delivered", "read", "failed"] = "sent"
    is_read: bool = False
    is_archived: bool = False           # Archived messages
    is_deleted: bool = False            # Soft delete
    deleted_at: Optional[datetime] = None
    thread_id: Optional[str] = None
    by_hiah: bool = False
    isp: str = "safaricom"
    sim_slot: int = 0
    # Unknown/spam
    is_unknown: bool = False
    is_spam: bool = False
    spam_reason: Optional[str] = None
    # Sync
    local_id: Optional[str] = None
    sync_status: str = "synced"

    class Settings:
        name = "messages"
        indexes = ["user_id", "timestamp", "channel", "is_archived", "is_deleted"]


class HiahChatHistory(Document):
    """Named conversation histories with Hiah."""
    id: str = Field(default_factory=uid)
    user_id: str
    title: str = "New Chat"
    is_active: bool = False             # Currently open history
    messages: list[dict] = []           # [{role, content, timestamp, action?}]
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "hiah_histories"
        indexes = ["user_id", "is_active"]


class HiahAction(Document):
    id: str = Field(default_factory=uid)
    user_id: str
    action_type: str
    payload: dict[str, Any] = {}
    status: Literal["pending", "approved", "executing", "done", "failed", "rejected"] = "pending"
    requires_approval: bool = True
    result: Optional[str] = None
    triggered_by: str = "user"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None

    class Settings:
        name = "hiah_actions"
        indexes = ["user_id", "status"]


class Notification(Document):
    id: str = Field(default_factory=uid)
    user_id: str
    type: Literal["message", "call", "system", "hiah", "spam", "unknown"] = "system"
    channel: Optional[str] = None
    title: str
    body: str
    is_read: bool = False
    priority: Literal["low", "normal", "high", "urgent"] = "normal"
    action_url: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "notifications"
        indexes = ["user_id", "is_read"]


class SpamReport(Document):
    """Crowdsourced spam number database."""
    id: str = Field(default_factory=uid)
    phone: str
    report_count: int = 1
    spam_type: Literal["telemarketing", "scam", "robocall", "fraud", "other"] = "other"
    first_reported: datetime = Field(default_factory=datetime.utcnow)
    last_reported: datetime = Field(default_factory=datetime.utcnow)
    confidence: int = 0                 # 0-100

    class Settings:
        name = "spam_reports"
        indexes = ["phone"]


# ── DB init ──────────────────────────────────────────────────────
async def init_db(mongodb_url: str, db_name: str):
    from motor.motor_asyncio import AsyncIOMotorClient
    from beanie import init_beanie

    client = AsyncIOMotorClient(mongodb_url)
    await init_beanie(
        database=client[db_name],
        document_models=[
            User, Contact, CallRecord, Message,
            HiahChatHistory, HiahAction, Notification, SpamReport
        ]
    )
    return client
