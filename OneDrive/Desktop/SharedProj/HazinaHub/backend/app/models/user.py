from datetime import datetime
from typing import Optional
from beanie import Document
from pydantic import Field


class User(Document):
    email: str
    password: str  # argon2id hash
    phone: str
    first_name: str = ""
    last_name: str = ""
    business_name: str = ""
    role: str = "user"
    is_verified: bool = False
    is_active: bool = True
    auto_invest_enabled: bool = False
    auto_invest_percentage: float = 0.0
    auto_invest_fund_id: Optional[str] = None
    reset_token: Optional[str] = None
    reset_token_expires_at: Optional[datetime] = None
    gmail_access_token: Optional[str] = None
    gmail_refresh_token: Optional[str] = None
    gmail_token_expires_at: Optional[datetime] = None
    gmail_email: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "users"
        indexes = ["email"]
