from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from datetime import datetime, timezone
from database import db
from middleware import get_current_user
import uuid
from typing import Optional

router = APIRouter(prefix="/api/notifications", tags=["notifications"])

@router.get("")
async def list_notifications(request: Request, unread_only: bool = False):
    current = await get_current_user(request)
    query = {"user_id": current["user_id"]}
    if unread_only:
        query["read"] = False
    notifications = await db.notifications.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    unread_count = await db.notifications.count_documents({"user_id": current["user_id"], "read": False})
    return {"notifications": notifications, "unread_count": unread_count}

@router.put("/{notif_id}/read")
async def mark_read(notif_id: str, request: Request):
    current = await get_current_user(request)
    await db.notifications.update_one(
        {"id": notif_id, "user_id": current["user_id"]},
        {"$set": {"read": True}}
    )
    return {"message": "Marked as read"}

@router.put("/read-all")
async def mark_all_read(request: Request):
    current = await get_current_user(request)
    await db.notifications.update_many(
        {"user_id": current["user_id"], "read": False},
        {"$set": {"read": True}}
    )
    return {"message": "All marked as read"}

@router.get("/activity")
async def get_activity_log(request: Request, limit: int = 50):
    current = await get_current_user(request)
    family_id = current.get("family_id")
    if not family_id and current["role"] != "superadmin":
        return {"activities": []}
    query = {}
    if current["role"] != "superadmin":
        query["family_id"] = family_id
    activities = await db.activity_log.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return {"activities": activities}


async def create_notification(user_id: str, family_id: str, title: str, message: str, notif_type: str = "info"):
    notif = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "family_id": family_id,
        "title": title,
        "message": message,
        "type": notif_type,
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notif)
    return notif


async def log_activity(family_id: str, user_id: str, action: str, entity_type: str, entity_id: str, details: dict = None):
    entry = {
        "id": str(uuid.uuid4()),
        "family_id": family_id,
        "user_id": user_id,
        "action": action,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "details": details or {},
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.activity_log.insert_one(entry)
    return entry
