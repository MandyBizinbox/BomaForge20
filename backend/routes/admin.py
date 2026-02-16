from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from datetime import datetime, timezone
from database import db
from middleware import get_current_user
import uuid
from typing import Optional

router = APIRouter(prefix="/api/admin", tags=["admin"])

# ===== SUPERADMIN DASHBOARD =====

@router.get("/dashboard")
async def admin_dashboard(request: Request):
    current = await get_current_user(request)
    if current["role"] != "superadmin":
        raise HTTPException(403, "SuperAdmin only")
    families = await db.families.find({}, {"_id": 0}).to_list(1000)
    total_users = await db.users.count_documents({})
    total_children = await db.children.count_documents({})
    total_lessons = await db.lessons.count_documents({})
    total_chores = await db.chore_instances.count_documents({})
    total_messages = await db.messages.count_documents({})
    reported_messages = await db.messages.count_documents({"reported_at": {"$ne": None}})
    for f in families:
        f["member_count"] = await db.users.count_documents({"family_id": f["id"]})
        f["children_count"] = await db.children.count_documents({"family_id": f["id"]})
    return {
        "stats": {
            "total_families": len(families),
            "total_users": total_users,
            "total_children": total_children,
            "total_lessons": total_lessons,
            "total_chores": total_chores,
            "total_messages": total_messages,
            "reported_messages": reported_messages,
        },
        "families": families
    }

@router.get("/families/{family_id}")
async def admin_family_detail(family_id: str, request: Request):
    current = await get_current_user(request)
    if current["role"] != "superadmin":
        raise HTTPException(403, "SuperAdmin only")
    family = await db.families.find_one({"id": family_id}, {"_id": 0})
    if not family:
        raise HTTPException(404, "Family not found")
    members = await db.users.find({"family_id": family_id}, {"_id": 0, "password_hash": 0}).to_list(100)
    children = await db.children.find({"family_id": family_id}, {"_id": 0}).to_list(100)
    lessons = await db.lessons.count_documents({"family_id": family_id})
    activities = await db.activity_log.find({"family_id": family_id}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"family": family, "members": members, "children": children, "lesson_count": lessons, "activities": activities}

# ===== API KEY SETTINGS =====

class UpdateApiKeysRequest(BaseModel):
    payfast_merchant_id: Optional[str] = None
    payfast_merchant_key: Optional[str] = None
    payfast_passphrase: Optional[str] = None
    payfast_sandbox: Optional[bool] = True
    resend_api_key: Optional[str] = None
    sender_email: Optional[str] = None

@router.get("/settings")
async def get_admin_settings(request: Request):
    current = await get_current_user(request)
    if current["role"] != "superadmin":
        raise HTTPException(403, "SuperAdmin only")
    settings = await db.admin_settings.find_one({"type": "api_keys"}, {"_id": 0})
    if not settings:
        settings = {"type": "api_keys", "payfast_merchant_id": "", "payfast_merchant_key": "",
                     "payfast_passphrase": "", "payfast_sandbox": True,
                     "resend_api_key": "", "sender_email": "onboarding@resend.dev"}
    # Mask sensitive keys for display
    masked = {**settings}
    for key in ["payfast_merchant_key", "payfast_passphrase", "resend_api_key"]:
        if masked.get(key) and len(masked[key]) > 6:
            masked[key] = masked[key][:4] + "..." + masked[key][-4:]
    masked["has_payfast"] = bool(settings.get("payfast_merchant_id"))
    masked["has_resend"] = bool(settings.get("resend_api_key"))
    return {"settings": masked}

@router.put("/settings")
async def update_admin_settings(req: UpdateApiKeysRequest, request: Request):
    current = await get_current_user(request)
    if current["role"] != "superadmin":
        raise HTTPException(403, "SuperAdmin only")
    existing = await db.admin_settings.find_one({"type": "api_keys"}, {"_id": 0})
    update = {"type": "api_keys", "updated_at": datetime.now(timezone.utc).isoformat()}
    if req.payfast_merchant_id is not None:
        update["payfast_merchant_id"] = req.payfast_merchant_id
    if req.payfast_merchant_key is not None:
        update["payfast_merchant_key"] = req.payfast_merchant_key
    if req.payfast_passphrase is not None:
        update["payfast_passphrase"] = req.payfast_passphrase
    if req.payfast_sandbox is not None:
        update["payfast_sandbox"] = req.payfast_sandbox
    if req.resend_api_key is not None:
        update["resend_api_key"] = req.resend_api_key
    if req.sender_email is not None:
        update["sender_email"] = req.sender_email
    await db.admin_settings.update_one({"type": "api_keys"}, {"$set": update}, upsert=True)
    return {"message": "Settings updated"}

# ===== REPORTED MESSAGES =====

@router.get("/reported-messages")
async def get_all_reported(request: Request):
    current = await get_current_user(request)
    if current["role"] != "superadmin":
        raise HTTPException(403, "SuperAdmin only")
    messages = await db.messages.find({"reported_at": {"$ne": None}}, {"_id": 0}).sort("reported_at", -1).to_list(200)
    return {"messages": messages}

@router.put("/messages/{msg_id}/action")
async def admin_message_action(msg_id: str, request: Request):
    current = await get_current_user(request)
    if current["role"] != "superadmin":
        raise HTTPException(403, "SuperAdmin only")
    body = await request.json()
    action = body.get("action", "dismiss")
    if action == "delete":
        await db.messages.delete_one({"id": msg_id})
    elif action == "dismiss":
        await db.messages.update_one({"id": msg_id}, {"$set": {"reported_at": None, "flagged": False}})
    return {"message": f"Action '{action}' applied"}
