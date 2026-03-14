"""
Reino - Notifications Router
"""
from fastapi import APIRouter, Depends, Query
from models import User, Notification
from services.auth import get_current_user

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])


@router.get("")
async def list_notifications(
    page: int = Query(1, ge=1),
    limit: int = Query(50),
    user: User = Depends(get_current_user)
):
    skip = (page - 1) * limit
    items = await Notification.find(Notification.user_id == user.id).sort("-created_at").skip(skip).limit(limit).to_list()
    unread = await Notification.find(Notification.user_id == user.id, Notification.is_read == False).count()
    return {
        "success": True,
        "data": [
            {"id": n.id, "type": n.type, "channel": n.channel, "title": n.title,
             "body": n.body, "is_read": n.is_read, "priority": n.priority,
             "created_at": n.created_at.isoformat()}
            for n in items
        ],
        "unread": unread,
    }


@router.patch("/{notif_id}/read")
async def mark_read(notif_id: str, user: User = Depends(get_current_user)):
    n = await Notification.find_one(Notification.id == notif_id, Notification.user_id == user.id)
    if n:
        n.is_read = True
        await n.save()
    return {"success": True}


@router.post("/read-all")
async def mark_all_read(user: User = Depends(get_current_user)):
    await Notification.find(Notification.user_id == user.id, Notification.is_read == False).update({"$set": {"is_read": True}})
    return {"success": True}
