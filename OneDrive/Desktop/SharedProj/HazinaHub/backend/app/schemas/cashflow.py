import re
from typing import Optional, Literal
from pydantic import BaseModel, field_validator


class InflowLogRequest(BaseModel):
    amount: float
    phone: str
    description: Optional[str] = "Cash Inflow"
    category: Optional[str] = "income"

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        if not re.match(r"^\+?[0-9\s\-()]{7,15}$", v):
            raise ValueError("Valid phone number required")
        return v

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Amount must be greater than zero")
        return v


class OutflowLogRequest(BaseModel):
    amount: float
    phone: str
    description: Optional[str] = "Cash Outflow"
    category: Optional[str] = "other"

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        if not re.match(r"^\+?[0-9\s\-()]{7,15}$", v):
            raise ValueError("Valid phone number required")
        return v

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Amount must be greater than zero")
        return v


class CashflowResponse(BaseModel):
    id: str
    type: str
    amount: float
    phone: Optional[str] = None
    receipt_number: Optional[str] = None
    status: str
    description: str
    created_at: str


class CashflowListQuery(BaseModel):
    page: int = 1
    limit: int = 20
    status: Optional[Literal["pending", "completed", "failed"]] = None
    type: Optional[str] = None
