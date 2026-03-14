"""
Reino - Hiah Router v2.2
Chat histories, spam detection, unknown number ID, message/call context
"""
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional

from models import User, HiahAction, HiahChatHistory, Contact, Message, CallRecord, Notification, SpamReport
from services.auth import get_current_user
from services.hiah import hiah_service
from services.ws_manager import ws_manager

router = APIRouter(prefix="/api/hiah", tags=["Hiah"])


class ChatIn(BaseModel):
    message: str
    history: list[dict] = []
    history_id: Optional[str] = None   # Which chat history to use/save


class TTSIn(BaseModel):
    text: str
    voice_id: Optional[str] = None


class HistoryCreateIn(BaseModel):
    title: str = "New Chat"


class HistoryRenameIn(BaseModel):
    title: str


# ── Chat ─────────────────────────────────────────────────────────
@router.post("/chat")
async def chat(body: ChatIn, user: User = Depends(get_current_user)):
    # Load full context for Hiah
    contacts     = await Contact.find(Contact.user_id == user.id, Contact.is_blocked == False).sort("name").to_list()
    msgs_data    = await Message.find(Message.user_id == user.id, Message.is_deleted == False).sort("-timestamp").limit(50).to_list()
    calls_data   = await CallRecord.find(CallRecord.user_id == user.id).sort("-started_at").limit(30).to_list()
    notifs_data  = await Notification.find(Notification.user_id == user.id).sort("-created_at").limit(20).to_list()

    # Identify spam/unknown summary for Hiah
    spam_numbers = await SpamReport.find(SpamReport.confidence >= 50).to_list()
    spam_phones  = {sr.phone for sr in spam_numbers}

    contacts_dicts = [
        {"name": c.name, "phone": c.phone, "phone2": c.phone2, "id": c.id,
         "is_blocked": c.is_blocked, "is_spam": c.is_spam}
        for c in contacts
    ]
    msgs_dicts = [
        {"id": m.id, "contact_name": m.contact_name, "channel": m.channel,
         "direction": m.direction, "body": m.body,
         "timestamp": m.timestamp.isoformat(), "is_read": m.is_read,
         "is_unknown": m.is_unknown, "is_spam": m.is_spam}
        for m in msgs_data
    ]
    calls_dicts = [
        {"id": c.id, "contact_name": c.contact_name, "phone": c.phone,
         "direction": c.direction, "status": c.status,
         "started_at": c.started_at.isoformat(), "duration": c.duration,
         "is_unknown": c.is_unknown, "is_spam": c.is_spam}
        for c in calls_data
    ]
    notifs_dicts = [
        {"id": n.id, "type": n.type, "title": n.title,
         "body": n.body, "is_read": n.is_read, "priority": n.priority}
        for n in notifs_data
    ]

    result = await hiah_service.chat(
        body.message, body.history, user,
        contacts=contacts_dicts,
        messages_data=msgs_dicts,
        calls_data=calls_dicts,
        notifications_data=notifs_dicts,
        spam_phones=spam_phones,
    )

    # Persist action
    saved_action = None
    if result.get("action"):
        act = result["action"]
        ha = HiahAction(
            user_id=user.id,
            action_type=act["type"],
            payload=act.get("payload", {}),
            status=act.get("status", "pending"),
            requires_approval=act.get("requires_approval", True),
            triggered_by="user",
        )
        await ha.insert()
        saved_action = {
            "id": ha.id, "type": ha.action_type, "payload": ha.payload,
            "status": ha.status, "requires_approval": ha.requires_approval,
        }
        if ha.requires_approval:
            await ws_manager.notify_hiah_action(user.id, saved_action)

    response_msg = {
        "id": str(uuid.uuid4())[:8],
        "role": "hiah",
        "type": "text",
        "content": result["content"],
        "timestamp": datetime.utcnow().isoformat(),
        "action": saved_action,
    }

    # Save to history if history_id provided
    if body.history_id:
        history = await HiahChatHistory.find_one(
            HiahChatHistory.id == body.history_id,
            HiahChatHistory.user_id == user.id
        )
        if history:
            history.messages.append({"role": "user", "content": body.message, "timestamp": datetime.utcnow().isoformat()})
            history.messages.append({"role": "hiah", "content": result["content"], "timestamp": response_msg["timestamp"]})
            history.updated_at = datetime.utcnow()
            # Auto-title from first message
            if len(history.messages) <= 2 and history.title == "New Chat":
                history.title = body.message[:40] + ("…" if len(body.message) > 40 else "")
            await history.save()

    return {"success": True, "data": response_msg}


# ── TTS ───────────────────────────────────────────────────────────
@router.post("/tts")
async def tts(body: TTSIn, user: User = Depends(get_current_user)):
    key      = user.settings.api_keys.elevenlabs_api_key
    voice_id = body.voice_id or user.settings.api_keys.elevenlabs_voice_id
    audio    = await hiah_service.text_to_speech(body.text, key, voice_id)
    if audio:
        return Response(content=audio, media_type="audio/mpeg")
    raise HTTPException(503, "TTS unavailable. Add your ElevenLabs key in Settings.")


# ── Voice input ───────────────────────────────────────────────────
@router.post("/voice-input")
async def voice_input(audio: UploadFile = File(...), user: User = Depends(get_current_user)):
    audio_bytes = await audio.read()
    transcript  = await hiah_service.speech_to_text(audio_bytes)
    return {"success": True, "data": {"transcript": transcript}}


# ── Actions ───────────────────────────────────────────────────────
@router.get("/actions")
async def list_actions(user: User = Depends(get_current_user)):
    actions = await HiahAction.find(HiahAction.user_id == user.id).sort("-created_at").limit(50).to_list()
    return {"success": True, "data": [
        {"id": a.id, "type": a.action_type, "payload": a.payload,
         "status": a.status, "requires_approval": a.requires_approval,
         "result": a.result, "created_at": a.created_at.isoformat()}
        for a in actions
    ]}


@router.post("/actions/{action_id}/approve")
async def approve(action_id: str, user: User = Depends(get_current_user)):
    a = await HiahAction.find_one(HiahAction.id == action_id, HiahAction.user_id == user.id)
    if not a: raise HTTPException(404, "Action not found")
    a.status = "approved"
    await a.save()
    await ws_manager.notify_hiah_action(user.id, {"id": a.id, "status": "approved", "type": a.action_type, "payload": a.payload})
    return {"success": True, "data": {"type": a.action_type, "payload": a.payload}}


@router.post("/actions/{action_id}/reject")
async def reject(action_id: str, user: User = Depends(get_current_user)):
    a = await HiahAction.find_one(HiahAction.id == action_id, HiahAction.user_id == user.id)
    if not a: raise HTTPException(404, "Action not found")
    a.status = "rejected"
    await a.save()
    return {"success": True}


# ── Chat Histories ────────────────────────────────────────────────
@router.get("/histories")
async def list_histories(user: User = Depends(get_current_user)):
    hs = await HiahChatHistory.find(HiahChatHistory.user_id == user.id).sort("-updated_at").to_list()
    return {"success": True, "data": [
        {"id": h.id, "title": h.title, "is_active": h.is_active,
         "message_count": len(h.messages),
         "updated_at": h.updated_at.isoformat()}
        for h in hs
    ]}


@router.post("/histories")
async def create_history(body: HistoryCreateIn, user: User = Depends(get_current_user)):
    # Deactivate all others
    await HiahChatHistory.find(HiahChatHistory.user_id == user.id).update({"$set": {"is_active": False}})
    h = HiahChatHistory(user_id=user.id, title=body.title, is_active=True)
    await h.insert()
    return {"success": True, "data": {"id": h.id, "title": h.title, "messages": []}}


@router.get("/histories/{history_id}")
async def get_history(history_id: str, user: User = Depends(get_current_user)):
    h = await HiahChatHistory.find_one(HiahChatHistory.id == history_id, HiahChatHistory.user_id == user.id)
    if not h: raise HTTPException(404, "History not found")
    return {"success": True, "data": {"id": h.id, "title": h.title, "messages": h.messages}}


@router.patch("/histories/{history_id}")
async def rename_history(history_id: str, body: HistoryRenameIn, user: User = Depends(get_current_user)):
    h = await HiahChatHistory.find_one(HiahChatHistory.id == history_id, HiahChatHistory.user_id == user.id)
    if not h: raise HTTPException(404, "History not found")
    h.title = body.title
    h.updated_at = datetime.utcnow()
    await h.save()
    return {"success": True}


@router.delete("/histories/{history_id}")
async def delete_history(history_id: str, user: User = Depends(get_current_user)):
    h = await HiahChatHistory.find_one(HiahChatHistory.id == history_id, HiahChatHistory.user_id == user.id)
    if not h: raise HTTPException(404, "History not found")
    await h.delete()
    return {"success": True}
