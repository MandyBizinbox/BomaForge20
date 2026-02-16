from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from datetime import datetime, timezone
from database import db
from middleware import get_current_user
import uuid
from typing import Optional, List

router = APIRouter(prefix="/api/messages", tags=["messaging"])

class CreateConversationRequest(BaseModel):
    name: str = ""
    type: str = "family"
    participant_ids: List[str] = []

class SendMessageRequest(BaseModel):
    body: str

class ReportMessageRequest(BaseModel):
    reason: str = ""

@router.get("/conversations")
async def list_conversations(request: Request):
    current = await get_current_user(request)
    if current["role"] == "tutor":
        raise HTTPException(403, "Tutors do not have chat access")
    family_id = current.get("family_id")
    if not family_id:
        return {"conversations": []}
    convos = await db.conversations.find(
        {"family_id": family_id, "participants": current["user_id"]},
        {"_id": 0}
    ).sort("updated_at", -1).to_list(100)
    for c in convos:
        last_msg = await db.messages.find_one(
            {"conversation_id": c["id"]}, {"_id": 0},
            sort=[("created_at", -1)]
        )
        c["last_message"] = last_msg
        unread = await db.messages.count_documents({
            "conversation_id": c["id"],
            "user_id": {"$ne": current["user_id"]},
            "created_at": {"$gt": c.get("last_read", {}).get(current["user_id"], "2000-01-01")}
        })
        c["unread_count"] = unread
    return {"conversations": convos}

@router.post("/conversations")
async def create_conversation(req: CreateConversationRequest, request: Request):
    current = await get_current_user(request)
    if current["role"] == "tutor":
        raise HTTPException(403, "Tutors do not have chat access")
    if current["role"] not in ["parent", "superadmin"]:
        raise HTTPException(403, "Only parents can create conversations")
    family_id = current.get("family_id")
    if not family_id:
        raise HTTPException(400, "No family")
    participants = list(set([current["user_id"]] + req.participant_ids))
    conv_id = str(uuid.uuid4())
    name = req.name
    if not name and req.type == "direct" and len(req.participant_ids) == 1:
        other = await db.users.find_one({"id": req.participant_ids[0]}, {"_id": 0})
        name = other["name"] if other else "Chat"
    conversation = {
        "id": conv_id, "family_id": family_id,
        "name": name or "Group Chat",
        "type": req.type,
        "participants": participants,
        "created_by": current["user_id"],
        "is_cross_family": False,
        "last_read": {},
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    await db.conversations.insert_one(conversation)
    return {"conversation": {k: v for k, v in conversation.items() if k != "_id"}}

@router.get("/conversations/{conv_id}")
async def get_conversation(conv_id: str, request: Request, page: int = 1, limit: int = 50):
    current = await get_current_user(request)
    if current["role"] == "tutor":
        raise HTTPException(403, "Tutors do not have chat access")
    conv = await db.conversations.find_one({"id": conv_id}, {"_id": 0})
    if not conv:
        raise HTTPException(404, "Conversation not found")
    if current["user_id"] not in conv["participants"] and current["role"] != "superadmin":
        if current["role"] == "parent" and conv["family_id"] == current.get("family_id"):
            pass
        else:
            raise HTTPException(403, "Not a participant")
    skip = (page - 1) * limit
    messages = await db.messages.find(
        {"conversation_id": conv_id}, {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    messages.reverse()
    total = await db.messages.count_documents({"conversation_id": conv_id})
    await db.conversations.update_one(
        {"id": conv_id},
        {"$set": {f"last_read.{current['user_id']}": datetime.now(timezone.utc).isoformat()}}
    )
    participants = []
    for pid in conv["participants"]:
        u = await db.users.find_one({"id": pid}, {"_id": 0, "password_hash": 0})
        if u:
            participants.append(u)
    return {
        "conversation": conv,
        "messages": messages,
        "participants": participants,
        "total": total,
        "page": page,
        "has_more": (skip + limit) < total
    }

@router.post("/conversations/{conv_id}/messages")
async def send_message(conv_id: str, req: SendMessageRequest, request: Request):
    current = await get_current_user(request)
    if current["role"] == "tutor":
        raise HTTPException(403, "Tutors do not have chat access")
    conv = await db.conversations.find_one({"id": conv_id}, {"_id": 0})
    if not conv:
        raise HTTPException(404, "Conversation not found")
    if current["user_id"] not in conv["participants"] and current["role"] != "superadmin":
        raise HTTPException(403, "Not a participant")
    msg_id = str(uuid.uuid4())
    sender = await db.users.find_one({"id": current["user_id"]}, {"_id": 0, "password_hash": 0})
    message = {
        "id": msg_id,
        "conversation_id": conv_id,
        "family_id": conv["family_id"],
        "user_id": current["user_id"],
        "sender_name": sender["name"] if sender else current["name"],
        "sender_avatar_color": sender.get("avatar_color", "#2D4F3F") if sender else "#2D4F3F",
        "body": req.body,
        "type": "text",
        "reported_at": None,
        "flagged": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.messages.insert_one(message)
    await db.conversations.update_one(
        {"id": conv_id},
        {"$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": {k: v for k, v in message.items() if k != "_id"}}

@router.post("/messages/{msg_id}/report")
async def report_message(msg_id: str, req: ReportMessageRequest, request: Request):
    current = await get_current_user(request)
    msg = await db.messages.find_one({"id": msg_id}, {"_id": 0})
    if not msg:
        raise HTTPException(404, "Message not found")
    await db.messages.update_one(
        {"id": msg_id},
        {"$set": {
            "reported_at": datetime.now(timezone.utc).isoformat(),
            "reported_by": current["user_id"],
            "report_reason": req.reason
        }}
    )
    await db.activity_log.insert_one({
        "id": str(uuid.uuid4()),
        "family_id": msg["family_id"],
        "user_id": current["user_id"],
        "action": "message_reported",
        "entity_type": "message",
        "entity_id": msg_id,
        "details": {"reason": req.reason},
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"message": "Message reported"}

@router.get("/reported")
async def get_reported_messages(request: Request):
    current = await get_current_user(request)
    if current["role"] not in ["parent", "superadmin"]:
        raise HTTPException(403, "Only parents/admins can view reports")
    query = {"reported_at": {"$ne": None}}
    if current["role"] == "parent":
        query["family_id"] = current.get("family_id")
    messages = await db.messages.find(query, {"_id": 0}).sort("reported_at", -1).to_list(100)
    return {"reported_messages": messages}

@router.get("/conversations/{conv_id}/poll")
async def poll_messages(conv_id: str, after: str = None, request: Request = None):
    current = await get_current_user(request)
    if current["role"] == "tutor":
        raise HTTPException(403, "Tutors do not have chat access")
    query = {"conversation_id": conv_id}
    if after:
        query["created_at"] = {"$gt": after}
    messages = await db.messages.find(query, {"_id": 0}).sort("created_at", 1).to_list(100)
    return {"messages": messages}
