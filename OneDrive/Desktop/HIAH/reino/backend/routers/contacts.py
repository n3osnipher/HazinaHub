"""
Reino - Contacts Router v2.2
Block/unblock, edit, delete, spam tagging, unknown number handling
"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional

from models import User, Contact, SpamReport
from services.auth import get_current_user

router = APIRouter(prefix="/api/contacts", tags=["Contacts"])

COLORS = ["#6c63ff","#00d4aa","#ff6b9d","#f59e0b","#10b981","#3b82f6","#ec4899","#8b5cf6","#ef4444","#06b6d4"]

def _initials(name: str) -> str:
    parts = name.strip().split()
    return (parts[0][0] + (parts[-1][0] if len(parts) > 1 else "")).upper()

def _color(idx: int) -> str:
    return COLORS[idx % len(COLORS)]

def _out(c: Contact) -> dict:
    return {
        "id": c.id, "name": c.name, "phone": c.phone, "phone2": c.phone2,
        "email": c.email, "initials": c.initials, "color": c.color,
        "is_favorite": c.is_favorite, "is_blocked": c.is_blocked,
        "block_reason": c.block_reason, "blocked_at": c.blocked_at.isoformat() if c.blocked_at else None,
        "tags": c.tags, "notes": c.notes,
        "is_spam": c.is_spam, "spam_score": c.spam_score, "is_unknown": c.is_unknown,
        "local_id": c.local_id, "sync_status": c.sync_status,
        "updated_at": c.updated_at.isoformat(),
    }


class ContactIn(BaseModel):
    name: str
    phone: str
    phone2: Optional[str] = None
    email: Optional[str] = None
    is_favorite: bool = False
    tags: list[str] = []
    notes: Optional[str] = None
    local_id: Optional[str] = None

class ContactPatch(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    phone2: Optional[str] = None
    email: Optional[str] = None
    is_favorite: Optional[bool] = None
    tags: Optional[list[str]] = None
    notes: Optional[str] = None

class BlockIn(BaseModel):
    reason: Optional[str] = None

class SyncBatch(BaseModel):
    contacts: list[dict]


@router.get("")
async def list_contacts(
    q: Optional[str] = Query(None),
    include_blocked: bool = Query(False),
    include_unknown: bool = Query(True),
    user: User = Depends(get_current_user)
):
    query_filter = {"user_id": user.id}
    contacts = await Contact.find(Contact.user_id == user.id).sort("name").to_list()

    if not include_blocked:
        contacts = [c for c in contacts if not c.is_blocked]
    if not include_unknown:
        contacts = [c for c in contacts if not c.is_unknown]
    if q:
        ql = q.lower()
        contacts = [c for c in contacts if ql in c.name.lower() or ql in (c.phone or "")]

    return {"success": True, "data": [_out(c) for c in contacts]}


@router.post("", status_code=201)
async def create_contact(body: ContactIn, user: User = Depends(get_current_user)):
    # Check duplicate phone
    existing = await Contact.find_one(Contact.user_id == user.id, Contact.phone == body.phone)
    if existing:
        raise HTTPException(409, f"Contact with phone {body.phone} already exists")

    count = await Contact.find(Contact.user_id == user.id).count()
    c = Contact(
        user_id=user.id, name=body.name.strip(), phone=body.phone,
        phone2=body.phone2, email=body.email,
        initials=_initials(body.name), color=_color(count),
        is_favorite=body.is_favorite, tags=body.tags, notes=body.notes,
        local_id=body.local_id, sync_status="synced",
    )
    await c.insert()
    return {"success": True, "data": _out(c)}


@router.patch("/{contact_id}")
async def update_contact(contact_id: str, body: ContactPatch, user: User = Depends(get_current_user)):
    c = await Contact.find_one(Contact.id == contact_id, Contact.user_id == user.id)
    if not c:
        raise HTTPException(404, "Contact not found")

    updates = body.model_dump(exclude_none=True)
    for k, v in updates.items():
        setattr(c, k, v)
    if "name" in updates:
        c.initials = _initials(updates["name"])
    c.updated_at = datetime.utcnow()
    c.sync_status = "synced"
    await c.save()
    return {"success": True, "data": _out(c)}


@router.delete("/{contact_id}")
async def delete_contact(contact_id: str, user: User = Depends(get_current_user)):
    c = await Contact.find_one(Contact.id == contact_id, Contact.user_id == user.id)
    if not c:
        raise HTTPException(404, "Contact not found")
    await c.delete()
    return {"success": True}


@router.post("/{contact_id}/block")
async def block_contact(contact_id: str, body: BlockIn, user: User = Depends(get_current_user)):
    c = await Contact.find_one(Contact.id == contact_id, Contact.user_id == user.id)
    if not c:
        raise HTTPException(404, "Contact not found")
    c.is_blocked = True
    c.blocked_at = datetime.utcnow()
    c.block_reason = body.reason
    c.updated_at = datetime.utcnow()
    await c.save()
    return {"success": True, "data": _out(c)}


@router.post("/{contact_id}/unblock")
async def unblock_contact(contact_id: str, user: User = Depends(get_current_user)):
    c = await Contact.find_one(Contact.id == contact_id, Contact.user_id == user.id)
    if not c:
        raise HTTPException(404, "Contact not found")
    c.is_blocked = False
    c.blocked_at = None
    c.block_reason = None
    c.updated_at = datetime.utcnow()
    await c.save()
    return {"success": True, "data": _out(c)}


@router.post("/{contact_id}/report-spam")
async def report_spam(contact_id: str, user: User = Depends(get_current_user)):
    c = await Contact.find_one(Contact.id == contact_id, Contact.user_id == user.id)
    if not c:
        raise HTTPException(404, "Contact not found")
    c.is_spam = True
    c.spam_score = min(100, c.spam_score + 25)
    c.updated_at = datetime.utcnow()
    await c.save()

    # Update global spam db
    sr = await SpamReport.find_one(SpamReport.phone == c.phone)
    if sr:
        sr.report_count += 1
        sr.last_reported = datetime.utcnow()
        sr.confidence = min(100, sr.confidence + 10)
        await sr.save()
    else:
        await SpamReport(phone=c.phone, confidence=30).insert()

    return {"success": True}


@router.get("/lookup/{phone}")
async def lookup_number(phone: str, user: User = Depends(get_current_user)):
    """Check if a number is in contacts, and if it's spam."""
    contact = await Contact.find_one(Contact.user_id == user.id, Contact.phone == phone)
    spam    = await SpamReport.find_one(SpamReport.phone == phone)
    return {
        "success": True,
        "data": {
            "found": contact is not None,
            "contact": _out(contact) if contact else None,
            "is_spam": spam is not None and spam.confidence >= 50,
            "spam_confidence": spam.confidence if spam else 0,
        }
    }


@router.post("/sync")
async def sync_contacts(body: SyncBatch, user: User = Depends(get_current_user)):
    synced = []
    count  = await Contact.find(Contact.user_id == user.id).count()

    for item in body.contacts:
        local_id = item.get("local_id") or item.get("id")
        existing = None
        if local_id:
            existing = await Contact.find_one(Contact.local_id == local_id, Contact.user_id == user.id)
        if not existing and item.get("phone"):
            existing = await Contact.find_one(Contact.phone == item["phone"], Contact.user_id == user.id)

        if existing:
            for k, v in item.items():
                if hasattr(existing, k) and k not in ("id", "user_id", "local_id"):
                    setattr(existing, k, v)
            existing.sync_status = "synced"
            existing.updated_at = datetime.utcnow()
            await existing.save()
            synced.append(_out(existing))
        else:
            name = item.get("name", "Unknown")
            c = Contact(
                user_id=user.id, name=name, phone=item.get("phone", ""),
                phone2=item.get("phone2"), email=item.get("email"),
                initials=_initials(name), color=_color(count + len(synced)),
                is_favorite=item.get("is_favorite", False),
                tags=item.get("tags", []), local_id=local_id, sync_status="synced",
            )
            await c.insert()
            synced.append(_out(c))

    return {"success": True, "synced": len(synced), "data": synced}
