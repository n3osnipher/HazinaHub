import re
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from beanie import PydanticObjectId

from app.models.mmf_fund import MmfFund
from app.models.investment import Investment
from app.models.cashflow import Cashflow
from app.models.user import User
from app.middleware.auth import get_current_user
from app.schemas.investment import InvestRequest
import uuid

router = APIRouter(prefix="/api/investments", tags=["investments"])


def normalize_phone(phone: str) -> str:
    digits = re.sub(r"\D", "", phone)
    if digits.startswith("0"):
        digits = "254" + digits[1:]
    return digits


@router.get("/funds")
async def get_available_funds():
    funds = await MmfFund.find(MmfFund.is_active == True).sort(-MmfFund.interest_rate).to_list()
    return {
        "success": True,
        "data": [
            {
                "id": str(f.id),
                "name": f.name,
                "provider": f.provider,
                "interestRate": f.interest_rate,
                "minimumInvestment": f.minimum_investment,
                "riskLevel": f.risk_level,
                "maturityDays": f.maturity_days,
                "totalAum": f.total_aum,
                "description": f.description,
                "websiteUrl": f.website_url,
                "assetClass": getattr(f, "asset_class", "MMF"),
                "logoUrl": getattr(f, "logo_url", ""),
            }
            for f in funds
        ],
    }


@router.post("/invest")
async def invest_in_fund(body: InvestRequest, current_user: dict = Depends(get_current_user)):
    user_id = PydanticObjectId(current_user["userId"])

    fund = await MmfFund.get(PydanticObjectId(body.fund_id))
    if not fund or not fund.is_active:
        raise HTTPException(status_code=404, detail="Fund not found or inactive")

    if body.amount < fund.minimum_investment:
        raise HTTPException(
            status_code=400,
            detail=f"Minimum investment for {fund.name} is KES {fund.minimum_investment:,.0f}",
        )

    user = await User.get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    matures_at = None
    if fund.maturity_days > 0:
        matures_at = datetime.utcnow() + timedelta(days=fund.maturity_days)

    reference = f"HZN-{uuid.uuid4().hex[:12].upper()}"
    rec_num = f"REC{uuid.uuid4().hex[:7].upper()}"
    tx = Cashflow(
        user_id=user_id,
        type="investment",
        amount=body.amount,
        phone=body.phone or user.phone,
        status="completed",
        description=f"Investment in {fund.name}",
        reference=reference,
        receipt_number=rec_num,
    )
    await tx.insert()

    investment = Investment(
        user_id=user_id,
        fund_id=fund.id,
        amount=body.amount,
        current_value=body.amount,
        status="active",
        invested_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
        matures_at=matures_at,
        cashflow_id=tx.id,
    )
    await investment.insert()

    return {
        "success": True,
        "data": {
            "investmentId": str(investment.id),
            "cashflowId": str(tx.id),
            "reference": reference,
            "receiptNumber": rec_num,
            "message": f"Investment in {fund.name} successfully registered in your portfolio tracker.",
            "fund": {
                "name": fund.name,
                "interestRate": fund.interest_rate,
            },
        },
    }


@router.get("")
async def get_user_investments(current_user: dict = Depends(get_current_user)):
    user_id = PydanticObjectId(current_user["userId"])

    investments = await Investment.find(
        Investment.user_id == user_id
    ).sort(-Investment.created_at).to_list()

    result = []
    for inv in investments:
        fund = await MmfFund.get(inv.fund_id)
        result.append({
            "id": str(inv.id),
            "fundId": str(inv.fund_id),
            "fundName": fund.name if fund else "Unknown Fund",
            "provider": fund.provider if fund else "",
            "amount": inv.amount,
            "accruedInterest": inv.accrued_interest,
            "currentValue": inv.current_value,
            "interestRate": fund.interest_rate if fund else 0,
            "riskLevel": fund.risk_level if fund else "low",
            "assetClass": getattr(fund, "asset_class", "MMF") if fund else "MMF",
            "logoUrl": getattr(fund, "logo_url", "") if fund else "",
            "status": inv.status,
            "investedAt": inv.invested_at.isoformat(),
            "maturesAt": inv.matures_at.isoformat() if inv.matures_at else None,
        })

    return {"success": True, "data": result}
