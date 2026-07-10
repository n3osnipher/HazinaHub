import re
from typing import Optional
from pydantic import BaseModel, field_validator


class InvestRequest(BaseModel):
    fund_id: str
    amount: float
    phone: Optional[str] = None

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Amount must be greater than zero")
        return v

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        if not re.match(r"^\+?[0-9\s\-()]{7,15}$", v):
            raise ValueError("Valid phone number required")
        return v


class PortfolioWithdrawRequest(BaseModel):
    investment_id: str
    amount: float

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, v: float) -> float:
        if v < 100:
            raise ValueError("Minimum withdrawal is KES 100")
        return v
