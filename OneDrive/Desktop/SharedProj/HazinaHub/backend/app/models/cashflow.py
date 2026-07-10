from datetime import datetime
from typing import Optional, Literal
from beanie import Document, PydanticObjectId
from pydantic import Field


class Cashflow(Document):
    user_id: PydanticObjectId
    type: Literal["inflow", "outflow", "investment", "return", "fee", "deposit", "withdrawal"]
    amount: float
    description: str = ""
    category: Optional[str] = "other"
    status: Literal["pending", "completed", "failed"] = "pending"
    phone: Optional[str] = None
    reference: Optional[str] = None
    receipt_number: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "cashflows"
        indexes = ["user_id", "status", "created_at"]
