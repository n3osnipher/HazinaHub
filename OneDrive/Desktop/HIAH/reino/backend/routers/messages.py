"""
Reino - Messages Router v2.2
Archive, soft-delete, search/filter, spam detection, unknown sender tagging
"""
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel

from models import User, Message, Contact, SpamReport, Notification
from services.auth import get_current_user
from services.ws_manager import ws_manager

router = APIRouter(prefix="/api/messages", tags=["Messages"])


class SendSMSIn(BaseModel):
    to: str
    body: str
    contact_name: Optional[str] = None
    contact_id: Optional[str] = None
    sim_slot: int = 0
    isp: str = "safaricom"
    by_hiah: bool = False

class SyncMessagesIn(BaseModel):
    messages: list[dict]


def _out(m: Message) -> dict:
    return {
        "id": m.id, "contact_id": m.contact_id, "contact_name": m.contact_name,
        "channel": m.channel, "direction": m.direction, "body": m.body,
        "timestamp": m.timestamp.isoformat(), "status": m.status,
        "is_read": m.is_read, "is_archived": m.is_archived, "is_deleted": m.is_deleted,
        "thread_id": m.thread_id, "by_hiah": m.by_hiah,
        "isp": m.isp, "sim_slot": m.sim_slot,
        "is_unknown": m.is_unknown, "is_spam": m.is_spam, "spam_reason": m.spam_reason,
        "local_id": m.local_id, "sync_status": m.sync_status,
    }


async def _check_sender(phone: str, user_id: str) -> tuple[bool, bool, Optional[str]]:
    contact = await Contact.find_one(Contact.user_id == user_id, Contact.phone == phone)
    spam    = await SpamReport.find_one(SpamReport.phone == phone)
    is_unknown = contact is None
    is_spam = (spam is not None and spam.confidence >= 50) or (contact is not None and contact.is_spam)
    return is_unknown, is_spam, spam.spam_type if spam and is_spam else None


@router.post("/send")
async def send_sms(body: SendSMSIn, user: User = Depends(get_current_user)):
    # Validate recipient exists in contacts
    contact = None
    if body.contact_id:
        contact = await Contact.find_one(Contact.id == body.contact_id, Contact.user_id == user.id)
    if not contact:
        contact = await Contact.find_one(Contact.user_id == user.id, Contact.phone == body.to)
    if not contact:
        # Also search by name
        if body.contact_name:
            contact = await Contact.find_one(Contact.user_id == user.id, Contact.name == body.contact_name)

    if contact and contact.is_blocked:
        raise HTTPException(400, f"{contact.name} is blocked. Unblock them first to send messages.")

    msg = Message(
        user_id=user.id,
        contact_id=contact.id if contact else None,
        contact_name=contact.name if contact else (body.contact_name or body.to),
        channel="sms",
        direction="outbound",
        body=body.body,
        status="pending",
        is_read=True,
        isp=body.isp,
        sim_slot=body.sim_slot,
        by_hiah=body.by_hiah,
        is_unknown=contact is None,
    )
    await msg.insert()
    await ws_manager.notify_new_message(user.id, _out(msg))
    return {
        "success": True,
        "data": _out(msg),
        "action": "send_sms",
        "to": body.to,
        "sim_slot": body.sim_slot,
    }


@router.post("/incoming")
async def register_incoming(body: dict, user: User = Depends(get_current_user)):
    """Register an incoming SMS from device."""
    phone = body.get("from_phone", "")
    is_unknown, is_spam, spam_reason = await _check_sender(phone, user.id)
    contact = await Contact.find_one(Contact.user_id == user.id, Contact.phone == phone)

    if contact and contact.is_blocked:
        return {"success": True, "data": None, "blocked": True}

    msg = Message(
        user_id=user.id,
        contact_id=contact.id if contact else None,
        contact_name=contact.name if contact else phone,
        channel="sms",
        direction="inbound",
        body=body.get("body", ""),
        status="delivered",
        is_read=False,
        isp=body.get("isp", user.settings.default_isp),
        sim_slot=body.get("sim_slot", 0),
        is_unknown=is_unknown,
        is_spam=is_spam,
        spam_reason=spam_reason,
    )
    await msg.insert()

    notif_type = "spam" if is_spam else ("message" if not is_unknown else "message")
    await Notification(
        user_id=user.id,
        type=notif_type,
        channel="sms",
        title=f"SMS from {msg.contact_name}" + (" ⚠️ Spam" if is_spam else ("" if not is_unknown else " (Unknown)")),
        body=msg.body[:80],
        priority="low" if is_spam else "normal",
    ).insert()

    await ws_manager.notify_new_message(user.id, _out(msg))
    return {"success": True, "data": _out(msg)}


@router.get("")
async def list_messages(
    q: Optional[str] = Query(None),          # Search query
    contact_name: Optional[str] = Query(None),
    archived: bool = Query(False),
    spam_only: bool = Query(False),
    unknown_only: bool = Query(False),
    page: int = Query(1, ge=1),
    limit: int = Query(100, le=500),
    user: User = Depends(get_current_user)
):
    msgs = await Message.find(
        Message.user_id == user.id,
        Message.is_deleted == False,
        Message.is_archived == archived,
    ).sort("-timestamp").limit(500).to_list()

    if spam_only:    msgs = [m for m in msgs if m.is_spam]
    if unknown_only: msgs = [m for m in msgs if m.is_unknown]
    if contact_name: msgs = [m for m in msgs if contact_name.lower() in m.contact_name.lower()]
    if q:
        ql = q.lower()
        msgs = [m for m in msgs if ql in m.body.lower() or ql in m.contact_name.lower()]

    unread = sum(1 for m in msgs if not m.is_read)
    total  = len(msgs)
    start  = (page - 1) * limit
    return {"success": True, "data": [_out(m) for m in msgs[start:start+limit]], "total": total, "unread": unread}


@router.patch("/{msg_id}/read")
async def mark_read(msg_id: str, user: User = Depends(get_current_user)):
    m = await Message.find_one(Message.id == msg_id, Message.user_id == user.id)
    if m:
        m.is_read = True
        await m.save()
    return {"success": True}


@router.patch("/{msg_id}/archive")
async def archive_message(msg_id: str, user: User = Depends(get_current_user)):
    m = await Message.find_one(Message.id == msg_id, Message.user_id == user.id)
    if not m:
        raise HTTPException(404, "Message not found")
    m.is_archived = not m.is_archived
    await m.save()
    return {"success": True, "is_archived": m.is_archived}


@router.patch("/thread/{contact_name}/archive")
async def archive_thread(contact_name: str, user: User = Depends(get_current_user)):
    """Archive all messages in a thread."""
    msgs = await Message.find(
        Message.user_id == user.id,
        Message.contact_name == contact_name,
        Message.is_deleted == False,
    ).to_list()
    for m in msgs:
        m.is_archived = True
        await m.save()
    return {"success": True, "archived": len(msgs)}


@router.delete("/{msg_id}")
async def delete_message(msg_id: str, user: User = Depends(get_current_user)):
    m = await Message.find_one(Message.id == msg_id, Message.user_id == user.id)
    if not m:
        raise HTTPException(404, "Message not found")
    m.is_deleted = True
    m.deleted_at = datetime.utcnow()
    await m.save()
    return {"success": True}


@router.delete("/thread/{contact_name}")
async def delete_thread(contact_name: str, user: User = Depends(get_current_user)):
    msgs = await Message.find(
        Message.user_id == user.id,
        Message.contact_name == contact_name,
    ).to_list()
    for m in msgs:
        m.is_deleted = True
        m.deleted_at = datetime.utcnow()
        await m.save()
    return {"success": True, "deleted": len(msgs)}


@router.post("/sync")
async def sync_messages(body: SyncMessagesIn, user: User = Depends(get_current_user)):
    synced = []
    for item in body.messages:
        local_id = item.get("local_id") or item.get("id")
        existing = None
        if local_id:
            existing = await Message.find_one(Message.local_id == local_id, Message.user_id == user.id)

        if existing:
            for k, v in item.items():
                if hasattr(existing, k) and k not in ("id", "user_id"):
                    if k == "timestamp" and isinstance(v, str):
                        v = datetime.fromisoformat(v.replace("Z", "+00:00"))
                    setattr(existing, k, v)
            existing.sync_status = "synced"
            await existing.save()
            synced.append(_out(existing))
        else:
            try:
                ts = datetime.fromisoformat(
                    item.get("timestamp", datetime.utcnow().isoformat()).replace("Z", "+00:00")
                )
                m = Message(
                    user_id=user.id,
                    contact_name=item.get("contact_name", "Unknown"),
                    channel="sms",
                    direction=item.get("direction", "inbound"),
                    body=item.get("body", ""),
                    timestamp=ts,
                    status=item.get("status", "delivered"),
                    is_read=item.get("is_read", False),
                    isp=item.get("isp", "safaricom"),
                    sim_slot=item.get("sim_slot", 0),
                    local_id=local_id,
                    sync_status="synced",
                )
                await m.insert()
                synced.append(_out(m))
            except Exception:
                continue

    await ws_manager.notify_sync(user.id, {"type": "messages", "count": len(synced)})
    return {"success": True, "synced": len(synced)}
