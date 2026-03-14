"""
Reino - Calls Router v2.2
Full call state: ringing/incoming/outgoing/ongoing/called/ended/missed/rejected/failed
Custom call UI support, spam detection, unknown number tagging
"""
from datetime import datetime
from typing import Optional, Literal
from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel

from models import User, CallRecord, Contact, SpamReport, Notification
from services.auth import get_current_user
from services.ws_manager import ws_manager

router = APIRouter(prefix="/api/calls", tags=["Calls"])


class InitiateCallIn(BaseModel):
    phone: str
    contact_name: Optional[str] = None
    contact_id: Optional[str] = None
    sim_slot: int = 0
    isp: str = "safaricom"
    by_hiah: bool = False

class UpdateCallIn(BaseModel):
    status: Optional[Literal[
        "ringing","incoming","outgoing","ongoing","called",
        "ended","missed","rejected","failed","voicemail"
    ]] = None
    answered_at: Optional[str] = None
    ended_at: Optional[str] = None
    duration: Optional[int] = None
    hiah_notes: Optional[str] = None

class SyncCallsIn(BaseModel):
    calls: list[dict]


def _out(c: CallRecord) -> dict:
    return {
        "id": c.id, "contact_id": c.contact_id, "contact_name": c.contact_name,
        "phone": c.phone, "direction": c.direction, "status": c.status,
        "started_at": c.started_at.isoformat(),
        "answered_at": c.answered_at.isoformat() if c.answered_at else None,
        "ended_at": c.ended_at.isoformat() if c.ended_at else None,
        "duration": c.duration, "isp": c.isp, "sim_slot": c.sim_slot,
        "by_hiah": c.by_hiah, "hiah_notes": c.hiah_notes,
        "is_unknown": c.is_unknown, "is_spam": c.is_spam, "spam_reason": c.spam_reason,
        "local_id": c.local_id, "sync_status": c.sync_status,
    }


async def _check_spam(phone: str, user_id: str) -> tuple[bool, bool, Optional[str]]:
    """Returns (is_unknown, is_spam, spam_reason)"""
    contact = await Contact.find_one(Contact.user_id == user_id, Contact.phone == phone)
    is_unknown = contact is None
    spam_report = await SpamReport.find_one(SpamReport.phone == phone)
    is_spam = (spam_report is not None and spam_report.confidence >= 50) or (contact is not None and contact.is_spam)
    reason = None
    if is_spam:
        reason = spam_report.spam_type if spam_report else "reported"
    return is_unknown, is_spam, reason


@router.post("/initiate")
async def initiate_call(body: InitiateCallIn, user: User = Depends(get_current_user)):
    """
    Create a call record. Returns action for device to actually dial.
    The custom call UI reads this record to show the call screen.
    """
    is_unknown, is_spam, spam_reason = await _check_spam(body.phone, user.id)

    # Look up contact name if not provided
    contact_name = body.contact_name
    contact_id   = body.contact_id
    if not contact_name or contact_name == body.phone:
        contact = await Contact.find_one(Contact.user_id == user.id, Contact.phone == body.phone)
        if contact:
            contact_name = contact.name
            contact_id   = contact.id

    record = CallRecord(
        user_id=user.id,
        contact_id=contact_id,
        contact_name=contact_name or body.phone,
        phone=body.phone,
        direction="outbound",
        status="outgoing",
        isp=body.isp,
        sim_slot=body.sim_slot,
        by_hiah=body.by_hiah,
        is_unknown=is_unknown,
        is_spam=is_spam,
        spam_reason=spam_reason,
    )
    await record.insert()
    await ws_manager.notify_call_update(user.id, {"event": "call_initiated", "call": _out(record)})

    return {
        "success": True,
        "data": _out(record),
        "action": "dial",
        "phone": body.phone,
        "sim_slot": body.sim_slot,
        "warnings": {
            "is_unknown": is_unknown,
            "is_spam": is_spam,
            "spam_reason": spam_reason,
        }
    }


@router.post("/incoming")
async def register_incoming(body: dict, user: User = Depends(get_current_user)):
    """Register an incoming call from the device."""
    phone = body.get("phone", "")
    is_unknown, is_spam, spam_reason = await _check_spam(phone, user.id)

    contact = await Contact.find_one(Contact.user_id == user.id, Contact.phone == phone)
    record = CallRecord(
        user_id=user.id,
        contact_id=contact.id if contact else None,
        contact_name=contact.name if contact else phone,
        phone=phone,
        direction="inbound",
        status="incoming",
        isp=body.get("isp", user.settings.default_isp),
        sim_slot=body.get("sim_slot", 0),
        is_unknown=is_unknown,
        is_spam=is_spam,
        spam_reason=spam_reason,
    )
    await record.insert()

    # Notify all connected clients (web dashboard)
    payload = {"event": "incoming_call", "call": _out(record)}
    await ws_manager.notify_call_update(user.id, payload)

    # Create notification
    title = f"Incoming call from {record.contact_name}"
    notif_body = "⚠️ Possible spam" if is_spam else ("Unknown number" if is_unknown else record.phone)
    await Notification(
        user_id=user.id,
        type="call",
        title=title,
        body=notif_body,
        priority="urgent" if is_spam else "high",
    ).insert()

    return {"success": True, "data": _out(record)}


@router.patch("/{call_id}")
async def update_call_status(call_id: str, body: UpdateCallIn, user: User = Depends(get_current_user)):
    c = await CallRecord.find_one(CallRecord.id == call_id, CallRecord.user_id == user.id)
    if not c:
        c = await CallRecord.find_one(CallRecord.local_id == call_id, CallRecord.user_id == user.id)
    if not c:
        raise HTTPException(404, "Call not found")

    if body.status:
        c.status = body.status
    if body.answered_at:
        c.answered_at = datetime.fromisoformat(body.answered_at.replace("Z", "+00:00"))
    if body.ended_at:
        c.ended_at = datetime.fromisoformat(body.ended_at.replace("Z", "+00:00"))
        # Auto-compute duration
        if c.answered_at and not body.duration:
            delta = c.ended_at - c.answered_at
            c.duration = int(delta.total_seconds())
    if body.duration is not None:
        c.duration = body.duration
    if body.hiah_notes:
        c.hiah_notes = body.hiah_notes

    # Map final states
    if body.status in ("outgoing", "called"):
        c.status = "called" if body.status == "outgoing" else body.status
    c.sync_status = "synced"
    await c.save()

    await ws_manager.notify_call_update(user.id, {"event": "call_updated", "call": _out(c)})
    return {"success": True, "data": _out(c)}


@router.get("")
async def list_calls(
    page: int = Query(1, ge=1),
    limit: int = Query(50, le=200),
    status: Optional[str] = Query(None),
    user: User = Depends(get_current_user)
):
    q = CallRecord.find(CallRecord.user_id == user.id)
    calls = await q.sort("-started_at").limit(200).to_list()
    if status:
        calls = [c for c in calls if c.status == status]
    total = len(calls)
    start = (page - 1) * limit
    return {"success": True, "data": [_out(c) for c in calls[start:start+limit]], "total": total}


@router.post("/sync")
async def sync_calls(body: SyncCallsIn, user: User = Depends(get_current_user)):
    synced = []
    for item in body.calls:
        local_id = item.get("local_id") or item.get("id")
        existing = None
        if local_id:
            existing = await CallRecord.find_one(CallRecord.local_id == local_id, CallRecord.user_id == user.id)

        if existing:
            for k, v in item.items():
                if hasattr(existing, k) and k not in ("id", "user_id"):
                    if k in ("started_at", "ended_at", "answered_at") and isinstance(v, str) and v:
                        v = datetime.fromisoformat(v.replace("Z", "+00:00"))
                    setattr(existing, k, v)
            existing.sync_status = "synced"
            await existing.save()
            synced.append(_out(existing))
        else:
            try:
                st = datetime.fromisoformat(item.get("started_at", datetime.utcnow().isoformat()).replace("Z", "+00:00"))
                c = CallRecord(
                    user_id=user.id,
                    contact_name=item.get("contact_name", "Unknown"),
                    phone=item.get("phone", ""),
                    direction=item.get("direction", "outbound"),
                    status=item.get("status", "ended"),
                    started_at=st,
                    duration=item.get("duration"),
                    isp=item.get("isp", "safaricom"),
                    sim_slot=item.get("sim_slot", 0),
                    by_hiah=item.get("by_hiah", False),
                    local_id=local_id,
                    sync_status="synced",
                )
                await c.insert()
                synced.append(_out(c))
            except Exception:
                continue

    await ws_manager.notify_sync(user.id, {"type": "calls", "count": len(synced)})
    return {"success": True, "synced": len(synced)}
