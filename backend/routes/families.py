from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from datetime import datetime, timezone
from database import db
from middleware import get_current_user
import uuid

router = APIRouter(prefix="/api/families", tags=["families"])

class CreateFamilyRequest(BaseModel):
    name: str

class JoinFamilyRequest(BaseModel):
    invite_code: str

@router.post("")
async def create_family(req: CreateFamilyRequest, request: Request):
    current = await get_current_user(request)
    family_id = str(uuid.uuid4())
    invite_code = str(uuid.uuid4())[:8].upper()
    family = {
        "id": family_id,
        "name": req.name,
        "owner_id": current["user_id"],
        "invite_code": invite_code,
        "plan": "free",
        "plan_status": "active",
        "plan_features": {
            "messaging": True, "curriculum": True, "chores": True,
            "allowance": True, "reports": True, "retention_months": 12
        },
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.families.insert_one(family)
    await db.users.update_one(
        {"id": current["user_id"]},
        {"$set": {"family_id": family_id}}
    )
    token_data = {
        "user_id": current["user_id"], "email": current["email"],
        "role": current["role"], "name": current["name"],
        "family_id": family_id
    }
    from middleware import create_token
    new_token = create_token(token_data)
    return {
        "family": {
            "id": family_id, "name": req.name, "invite_code": invite_code,
            "plan": "free", "plan_status": "active"
        },
        "token": new_token
    }

@router.post("/join")
async def join_family(req: JoinFamilyRequest, request: Request):
    current = await get_current_user(request)
    family = await db.families.find_one({"invite_code": req.invite_code}, {"_id": 0})
    if not family:
        raise HTTPException(404, "Invalid invite code")
    await db.users.update_one(
        {"id": current["user_id"]},
        {"$set": {"family_id": family["id"]}}
    )
    from middleware import create_token
    new_token = create_token({
        "user_id": current["user_id"], "email": current["email"],
        "role": current["role"], "name": current["name"],
        "family_id": family["id"]
    })
    return {"family": {"id": family["id"], "name": family["name"]}, "token": new_token}

@router.get("/current")
async def get_current_family(request: Request):
    current = await get_current_user(request)
    family_id = current.get("family_id")
    if not family_id:
        return {"family": None}
    family = await db.families.find_one({"id": family_id}, {"_id": 0})
    if not family:
        return {"family": None}
    members = await db.users.find(
        {"family_id": family_id}, {"_id": 0, "password_hash": 0}
    ).to_list(100)
    children = await db.children.find({"family_id": family_id}, {"_id": 0}).to_list(100)
    return {"family": family, "members": members, "children": children}

@router.put("/settings")
async def update_family_settings(request: Request):
    current = await get_current_user(request)
    if current["role"] not in ["parent", "superadmin"]:
        raise HTTPException(403, "Only parents can update settings")
    body = await request.json()
    family_id = current.get("family_id")
    if not family_id:
        raise HTTPException(400, "No family")
    update = {}
    if "name" in body:
        update["name"] = body["name"]
    if update:
        await db.families.update_one({"id": family_id}, {"$set": update})
    return {"message": "Updated"}
