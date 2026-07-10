from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from beanie import PydanticObjectId
from beanie.operators import In
import asyncio

from app.models.user import User
from app.models.cashflow import Cashflow
from app.models.ai_insight import AiInsight
from app.models.investment import Investment
from app.middleware.auth import get_current_user

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("")
async def get_dashboard_summary(current_user: dict = Depends(get_current_user)):
    user_id = PydanticObjectId(current_user["userId"])

    # 1. Calculate active investments for savings health
    active_investments = await Investment.find(
        Investment.user_id == user_id,
        In(Investment.status, ["active", "matured"]),
    ).to_list()
    total_invested = sum(i.current_value for i in active_investments)

    # 2. 24h total sales (completed incoming)
    one_day_ago = datetime.utcnow() - timedelta(hours=24)
    pipeline_sales = [
        {"$match": {
            "user_id": user_id,
            "type": {"$in": ["inflow", "deposit", "return", "c2b", "stk_push"]},
            "status": "completed",
            "created_at": {"$gte": one_day_ago},
        }},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
    ]
    sales_result = await Cashflow.aggregate(pipeline_sales).to_list()
    total_sales = sales_result[0]["total"] if sales_result else 0.0

    # 3. Monthly profits (this month vs last month)
    now = datetime.utcnow()
    this_month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    last_month_start = (this_month_start - timedelta(days=1)).replace(day=1)

    async def month_net(start: datetime, end: datetime) -> float:
        pipe_in = [
            {"$match": {"user_id": user_id, "type": {"$in": ["inflow", "deposit", "return", "c2b", "stk_push"]},
                        "status": "completed", "created_at": {"$gte": start, "$lt": end}}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
        ]
        pipe_out = [
            {"$match": {"user_id": user_id, "type": {"$in": ["outflow", "withdrawal", "investment", "fee", "b2c"]},
                        "status": "completed", "created_at": {"$gte": start, "$lt": end}}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
        ]
        in_res = await Cashflow.aggregate(pipe_in).to_list()
        out_res = await Cashflow.aggregate(pipe_out).to_list()
        return (in_res[0]["total"] if in_res else 0) - (out_res[0]["total"] if out_res else 0)

    this_month, last_month = await asyncio.gather(
        month_net(this_month_start, now),
        month_net(last_month_start, this_month_start),
    )
    profit_growth = ((this_month - last_month) / last_month * 100) if last_month > 0 else 0.0

    # 4. Weekly chart (last 7 days)
    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    weekly_tx = await Cashflow.find(
        Cashflow.user_id == user_id,
        Cashflow.status == "completed",
        Cashflow.created_at >= seven_days_ago,
    ).to_list()

    day_names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    weekly_map: dict[str, float] = {}
    daily_trend: dict[str, dict[str, float]] = {}
    for tx in weekly_tx:
        day = day_names[tx.created_at.weekday()]
        weekly_map[day] = weekly_map.get(day, 0) + tx.amount

        if day not in daily_trend:
            daily_trend[day] = {"revenue": 0.0, "expenses": 0.0}

        if tx.type in ["inflow", "deposit", "return", "c2b", "stk_push"]:
            daily_trend[day]["revenue"] += tx.amount
        elif tx.type in ["outflow", "withdrawal", "investment", "fee", "b2c"]:
            daily_trend[day]["expenses"] += tx.amount

    ordered_days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    weekly_data = [{"day": d, "amount": weekly_map.get(d, 0)} for d in ordered_days]
    profit_loss_trend = [
        {
            "day": d,
            "revenue": daily_trend.get(d, {}).get("revenue", 0.0),
            "expenses": daily_trend.get(d, {}).get("expenses", 0.0),
            "net": daily_trend.get(d, {}).get("revenue", 0.0) - daily_trend.get(d, {}).get("expenses", 0.0),
        }
        for d in ordered_days
    ]

    # 5. Financial health scoring
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    month_tx = await Cashflow.find(
        Cashflow.user_id == user_id,
        Cashflow.status == "completed",
        Cashflow.created_at >= thirty_days_ago,
    ).to_list()

    month_revenue = sum(tx.amount for tx in month_tx if tx.type in ["inflow", "deposit", "return", "c2b", "stk_push"])
    month_expenses = sum(tx.amount for tx in month_tx if tx.type in ["outflow", "withdrawal", "investment", "fee", "b2c"])

    # Calculate category breakdown
    category_map: dict[str, float] = {}
    for tx in month_tx:
        if tx.type in ["outflow", "withdrawal", "investment", "fee", "b2c"]:
            cat = tx.category or "other"
            category_map[cat] = category_map.get(cat, 0.0) + tx.amount
            
    expenses_by_category = [
        {"category": cat, "amount": amt}
        for cat, amt in category_map.items()
    ]
    cash_flow_ratio = 0.0
    if month_revenue + month_expenses > 0:
        cash_flow_ratio = round(((month_revenue - month_expenses) / max(1, month_revenue + month_expenses)) * 100, 1)

    overall_score = 50
    if month_revenue > month_expenses:
        overall_score += min(40, int(((month_revenue - month_expenses) / max(1, month_expenses + 1)) * 10))
    else:
        overall_score -= min(40, int(((month_expenses - month_revenue) / max(1, month_revenue + 1)) * 10))
    overall_score = max(0, min(100, overall_score))

    savings_score = min(100, int((total_invested / max(1, total_sales + 1)) * 100)) if total_sales > 0 else min(100, int((total_invested / 1000) * 10))
    debt_ratio = min(100, int((month_expenses / max(1, month_revenue + month_expenses)) * 100))
    recommendations = []
    if cash_flow_ratio < 0:
        recommendations.append("Recent outflows exceed inflows. Push for more revenue and delay discretionary outgoings.")
    if total_invested < total_sales * 0.2:
        recommendations.append("Aim to build up your investments to at least 20% of monthly sales to ensure a strong financial buffer.")
    if len(weekly_tx) < 5:
        recommendations.append("Log cashflows regularly to keep your business tracking running smoothly.")

    # 6. Recent cashflows (last 5)
    recent_tx = await Cashflow.find(Cashflow.user_id == user_id) \
        .sort(-Cashflow.created_at).limit(5).to_list()

    # 7. Latest AI insight
    latest_insight = await AiInsight.find(AiInsight.user_id == user_id) \
        .sort(-AiInsight.created_at).first_or_none()
    ai_insight = (
        latest_insight.content if latest_insight
        else "Welcome to HazinaHub! Start logging cashflows to receive AI-powered financial insights."
    )

    return {
        "success": True,
        "data": {
            "accountBalance": this_month,  # Return monthly surplus in place of wallet balance
            "totalSales": total_sales,
            "monthlyProfits": this_month,
            "profitGrowth": round(profit_growth, 1),
            "weeklyCashflow": weekly_data,
            "profitLossTrend": profit_loss_trend,
            "financialHealth": {
                "overall": overall_score,
                "cashFlow": cash_flow_ratio,
                "savings": savings_score,
                "investmentDiversity": 65,
                "debtRatio": debt_ratio,
                "recommendations": recommendations,
            },
            "recentCashflows": [
                {
                    "id": str(t.id),
                    "type": t.type,
                    "amount": t.amount,
                    "status": t.status,
                    "description": t.description,
                    "receiptNumber": t.receipt_number,
                    "createdAt": t.created_at.isoformat(),
                }
                for t in recent_tx
            ],
            "aiInsight": ai_insight,
            "expensesByCategory": expenses_by_category,
        },
    }
