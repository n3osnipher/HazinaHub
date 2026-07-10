import re
import asyncio
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, Query, HTTPException, Request, UploadFile, File
from beanie import PydanticObjectId
from pydantic import BaseModel

from app.models.cashflow import Cashflow
from app.models.user import User
from app.middleware.auth import get_current_user
import uuid
from app.schemas.cashflow import InflowLogRequest, OutflowLogRequest
from app.services.sms import notify_cashflow
from app.services.websocket import broadcast_cashflow_update, broadcast_balance_update
from app.services.mpesa_parser import parse_mpesa_sms, parse_mpesa_csv, segment_text_chunks, is_transaction_segment
from app.services.ai import parse_unstructured_transaction_ai

router = APIRouter(prefix="/api/cashflows", tags=["cashflows"])


def normalize_phone(phone: str) -> str:
    digits = re.sub(r"\D", "", phone)
    if digits.startswith("0"):
        digits = "254" + digits[1:]
    return digits


# ─── List cashflows ─────────────────────────────────────────

@router.get("")
async def get_transactions(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    status: Optional[str] = None,
    tx_type: Optional[str] = Query(default=None, alias="type"),
    current_user: dict = Depends(get_current_user),
):
    user_id = PydanticObjectId(current_user["userId"])
    offset = (page - 1) * limit

    filters = [Cashflow.user_id == user_id]
    if status:
        filters.append(Cashflow.status == status)
    if tx_type:
        filters.append(Cashflow.type == tx_type)

    total = await Cashflow.find(*filters).count()
    transactions = await Cashflow.find(*filters) \
        .sort(-Cashflow.created_at).skip(offset).limit(limit).to_list()

    return {
        "success": True,
        "data": [
            {
                "id": str(t.id),
                "type": t.type,
                "amount": t.amount,
                "phone": t.phone,
                "reference": t.reference,
                "receiptNumber": t.receipt_number,
                "status": t.status,
                "description": t.description,
                "createdAt": t.created_at.isoformat(),
            }
            for t in transactions
        ],
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "totalPages": -(-total // limit),
        },
    }


# ─── Initialize payment / inflow ─────────────────────────────

@router.post("/pay")
async def initiate_payment(
    body: InflowLogRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Simulate syncing/capturing a cash inflow.
    Logs it in the cashflow ledger immediately.
    """
    user_id = PydanticObjectId(current_user["userId"])
    user = await User.get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    phone = normalize_phone(body.phone)
    ref = f"HZN-{uuid.uuid4().hex[:12].upper()}"
    rec_num = f"REC{uuid.uuid4().hex[:7].upper()}"

    # Record directly as completed (since it's a read-only synced transaction log)
    tx = Cashflow(
        user_id=user_id,
        type="inflow",
        amount=body.amount,
        phone=phone,
        reference=ref,
        receipt_number=rec_num,
        status="completed",
        category=body.category or "income",
        description=body.description or "Cash Inflow Sync",
    )
    await tx.insert()

    # Broadcast update
    asyncio.create_task(broadcast_cashflow_update(str(user_id), {
        "id": str(tx.id), "type": tx.type, "amount": tx.amount,
        "status": "completed", "reference": ref, "receiptNumber": rec_num,
    }))

    return {
        "success": True,
        "data": {
            "cashflowId": str(tx.id),
            "reference": ref,
            "receiptNumber": rec_num,
            "customerMessage": f"Cashflow inflow of KES {body.amount:,.0f} successfully synced and captured.",
        },
    }


# ─── Get cashflow by ID status ────────────────────────────────

@router.get("/{tx_id}/status")
async def get_transaction_status(tx_id: str, current_user: dict = Depends(get_current_user)):
    user_id = PydanticObjectId(current_user["userId"])
    tx = await Cashflow.find_one(
        Cashflow.id == PydanticObjectId(tx_id),
        Cashflow.user_id == user_id,
    )
    if not tx:
        raise HTTPException(status_code=404, detail="Cashflow log not found")

    return {
        "success": True,
        "data": {
            "id": str(tx.id),
            "type": tx.type,
            "amount": tx.amount,
            "status": tx.status,
            "reference": tx.reference,
            "receiptNumber": tx.receipt_number,
            "description": tx.description,
            "createdAt": tx.created_at.isoformat(),
        },
    }


# ─── Log external withdrawal / cashout ────────────────────────

@router.post("/withdraw")
async def initiate_withdraw(
    body: OutflowLogRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Log an external withdrawal or cash outflow in the cashflow ledger.
    """
    user_id = PydanticObjectId(current_user["userId"])
    user = await User.get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    phone = normalize_phone(body.phone)
    ref = f"HZN-{uuid.uuid4().hex[:12].upper()}"
    rec_num = f"REC{uuid.uuid4().hex[:7].upper()}"

    tx = Cashflow(
        user_id=user_id,
        type="outflow",
        amount=body.amount,
        phone=phone,
        reference=ref,
        receipt_number=rec_num,
        status="completed",
        category=body.category or "other",
        description=body.description or "Cash Outflow Sync",
    )
    await tx.insert()

    asyncio.create_task(broadcast_cashflow_update(str(user_id), {
        "id": str(tx.id), "type": tx.type,
        "amount": tx.amount, "status": "completed", "reference": ref, "receiptNumber": rec_num,
    }))

    return {
        "success": True,
        "data": {
            "cashflowId": str(tx.id),
            "reference": ref,
            "receiptNumber": rec_num,
            "amount": body.amount,
            "message": f"KES {body.amount:,.0f} outflow successfully logged in your cashflow ledger.",
        },
    }


# ─── Schema models for batch imports ──────────────────────────

class ParseTextRequest(BaseModel):
    text: str


class BatchImportItem(BaseModel):
    type: str
    amount: float
    description: str
    category: str
    receipt_number: Optional[str] = None
    created_at: str


class BatchImportRequest(BaseModel):
    items: List[BatchImportItem]


# ─── Parse M-Pesa copied SMS text ─────────────────────────────

@router.post("/parse-text")
async def parse_text_statements(
    body: ParseTextRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Ingestion Pipeline:
    1. Cleaning Layer: filter noise.
    2. Segmentation Layer: group wrapped lines and segment messages.
    3. Structuring Layer: parse using regex rules, fallback to Gemini AI for messy structures.
    """
    from datetime import datetime
    user_id = PydanticObjectId(current_user["userId"])
    
    # 1. Segment the raw text
    segments = segment_text_chunks(body.text)
    
    # 2. Filter noise
    valid_segments = [seg for seg in segments if is_transaction_segment(seg)]
    
    candidates = []
    messy_segments = []
    
    # 3. Rule-based parsing first
    for seg in valid_segments:
        parsed = parse_mpesa_sms(seg)
        if parsed:
            candidates.append(parsed)
        else:
            messy_segments.append(seg)
            
    # 4. Concurrently run AI fallback for unmatched segments (cap to avoid Gemini limits)
    if messy_segments:
        max_ai_calls = 15
        to_process = messy_segments[:max_ai_calls]
        
        # Concurrency semaphore to avoid spamming the Gemini API
        sem = asyncio.Semaphore(3)
        
        async def parse_with_sem(txt: str):
            async with sem:
                return await parse_unstructured_transaction_ai(txt)
                
        tasks = [parse_with_sem(txt) for txt in to_process]
        ai_results = await asyncio.gather(*tasks, return_exceptions=True)
        
        for result in ai_results:
            if result and isinstance(result, dict):
                candidates.append(result)

    # 5. Deduplicate and format dates for the frontend
    processed_candidates = []
    for item in candidates:
        # Check if this receipt already exists for this user
        existing = None
        if item.get("receipt_number"):
            existing = await Cashflow.find_one(
                Cashflow.receipt_number == item["receipt_number"],
                Cashflow.user_id == user_id,
            )
            
        item["already_exists"] = existing is not None
        
        # Convert datetime to ISO string for JSON serialization
        if isinstance(item.get("created_at"), datetime):
            item["created_at"] = item["created_at"].isoformat()
        elif isinstance(item.get("created_at"), str):
            pass # Already formatted
        else:
            item["created_at"] = datetime.utcnow().isoformat()
            
        processed_candidates.append(item)
        
    return {"success": True, "data": processed_candidates}


# ─── Upload M-Pesa CSV Statement ─────────────────────────────

@router.post("/upload-statement")
async def upload_statement_file(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """
    Accepts M-Pesa CSV statement export file.
    Parses it and returns list of candidate cashflow logs.
    """
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV statement files are supported.")
        
    try:
        contents = await file.read()
        csv_text = contents.decode("utf-8", errors="ignore")
        candidates = parse_mpesa_csv(csv_text)
        
        user_id = PydanticObjectId(current_user["userId"])
        for item in candidates:
            # Check duplicates
            existing = await Cashflow.find_one(
                Cashflow.receipt_number == item["receipt_number"],
                Cashflow.user_id == user_id,
            )
            item["already_exists"] = existing is not None
            # Convert datetime to ISO string
            item["created_at"] = item["created_at"].isoformat()
            
        return {"success": True, "data": candidates}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse statement file: {str(e)}")


# ─── Batch Import Cashflow Logs ───────────────────────────────

@router.post("/batch-import")
async def batch_import_cashflows(
    body: BatchImportRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Accepts verified list of cashflow records, filtering duplicates by receipt number.
    Inserts new Cashflow logs in bulk.
    """
    user_id = PydanticObjectId(current_user["userId"])
    imported_count = 0
    
    for item in body.items:
        # Extra safety check for duplicates
        if item.receipt_number:
            existing = await Cashflow.find_one(
                Cashflow.receipt_number == item.receipt_number,
                Cashflow.user_id == user_id,
            )
            if existing:
                continue

        try:
            dt = datetime.fromisoformat(item.created_at)
        except Exception:
            dt = datetime.utcnow()
            
        ref = f"BCH-{item.receipt_number}" if item.receipt_number else f"HZN-{uuid.uuid4().hex[:12].upper()}"
        
        tx = Cashflow(
            user_id=user_id,
            type=item.type,
            amount=item.amount,
            phone="",
            reference=ref,
            receipt_number=item.receipt_number,
            status="completed",
            category=item.category,
            description=item.description,
            created_at=dt,
        )
        await tx.insert()
        imported_count += 1
        
    if imported_count > 0:
        # Broadcast balance update
        asyncio.create_task(broadcast_cashflow_update(str(user_id), {
            "batch": True, "count": imported_count
        }))
        
    return {
        "success": True,
        "importedCount": imported_count,
        "message": f"Successfully imported {imported_count} cashflow logs.",
    }
