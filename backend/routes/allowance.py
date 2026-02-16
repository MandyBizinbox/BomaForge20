from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from datetime import datetime, timezone
from database import db
from middleware import get_current_user
import uuid
from typing import Optional

router = APIRouter(prefix="/api/allowance", tags=["allowance"])

class CreateWalletRequest(BaseModel):
    child_id: str

class CreateEntryRequest(BaseModel):
    child_id: str
    type: str  # credit or debit
    amount: float
    reason: str = ""
    source_type: str = "manual"  # allowance, chore_reward, manual, adjustment

class SpendRequestModel(BaseModel):
    amount: float
    reason: str

class ApproveEntryRequest(BaseModel):
    entry_id: str
    action: str  # approve or reject

class AllowanceSettingsRequest(BaseModel):
    child_id: str
    mode: str = "fixed"  # fixed, per_chore, hybrid
    weekly_amount: float = 0
    payout_day: int = 4  # 0=Mon, 4=Fri

@router.get("/wallets")
async def list_wallets(request: Request):
    current = await get_current_user(request)
    family_id = current.get("family_id")
    if not family_id:
        return {"wallets": []}
    children = await db.children.find({"family_id": family_id}, {"_id": 0}).to_list(100)
    wallets = []
    for child in children:
        entries = await db.wallet_entries.find(
            {"child_id": child["id"], "status": "approved"}, {"_id": 0}
        ).to_list(10000)
        balance = sum(
            e["amount"] if e["type"] == "credit" else -e["amount"]
            for e in entries
        )
        pending = await db.wallet_entries.count_documents(
            {"child_id": child["id"], "status": "pending"}
        )
        settings = await db.allowance_settings.find_one(
            {"child_id": child["id"]}, {"_id": 0}
        )
        wallets.append({
            "child_id": child["id"],
            "child_name": child["name"],
            "avatar_color": child.get("avatar_color", "#4F9DCE"),
            "balance": round(balance, 2),
            "pending_count": pending,
            "settings": settings
        })
    return {"wallets": wallets}

@router.get("/wallets/{child_id}")
async def get_wallet(child_id: str, request: Request):
    current = await get_current_user(request)
    family_id = current.get("family_id")
    child = await db.children.find_one({"id": child_id}, {"_id": 0})
    if not child:
        raise HTTPException(404, "Child not found")
    if child["family_id"] != family_id and current["role"] != "superadmin":
        raise HTTPException(403, "Not your family")
    entries = await db.wallet_entries.find(
        {"child_id": child_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    approved = [e for e in entries if e["status"] == "approved"]
    balance = sum(
        e["amount"] if e["type"] == "credit" else -e["amount"]
        for e in approved
    )
    settings = await db.allowance_settings.find_one({"child_id": child_id}, {"_id": 0})
    return {
        "child": child,
        "balance": round(balance, 2),
        "entries": entries,
        "settings": settings
    }

@router.post("/entries")
async def create_entry(req: CreateEntryRequest, request: Request):
    current = await get_current_user(request)
    if current["role"] not in ["parent", "superadmin"]:
        raise HTTPException(403, "Only parents can create entries")
    family_id = current.get("family_id")
    child = await db.children.find_one({"id": req.child_id}, {"_id": 0})
    if not child:
        raise HTTPException(404, "Child not found")
    if child["family_id"] != family_id and current["role"] != "superadmin":
        raise HTTPException(403, "Not your family")
    entry_id = str(uuid.uuid4())
    entry = {
        "id": entry_id, "family_id": family_id,
        "child_id": req.child_id,
        "type": req.type,
        "amount": abs(req.amount),
        "reason": req.reason,
        "source_type": req.source_type,
        "status": "approved",
        "created_by": current["user_id"],
        "approved_by": current["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.wallet_entries.insert_one(entry)
    return {"entry": {k: v for k, v in entry.items() if k != "_id"}}

@router.post("/spend-request")
async def create_spend_request(req: SpendRequestModel, request: Request):
    current = await get_current_user(request)
    user = await db.users.find_one({"id": current["user_id"]}, {"_id": 0})
    child_id = user.get("child_id") if user else None
    if not child_id and current["role"] != "parent":
        raise HTTPException(400, "No child profile linked")
    family_id = current.get("family_id")
    entry_id = str(uuid.uuid4())
    entry = {
        "id": entry_id, "family_id": family_id,
        "child_id": child_id or current.get("target_child_id"),
        "type": "debit",
        "amount": abs(req.amount),
        "reason": req.reason,
        "source_type": "spend_request",
        "status": "pending",
        "created_by": current["user_id"],
        "approved_by": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.wallet_entries.insert_one(entry)
    return {"entry": {k: v for k, v in entry.items() if k != "_id"}}

@router.post("/approve")
async def approve_entry(req: ApproveEntryRequest, request: Request):
    current = await get_current_user(request)
    if current["role"] not in ["parent", "superadmin"]:
        raise HTTPException(403, "Only parents can approve")
    entry = await db.wallet_entries.find_one({"id": req.entry_id}, {"_id": 0})
    if not entry:
        raise HTTPException(404, "Entry not found")
    if entry["family_id"] != current.get("family_id") and current["role"] != "superadmin":
        raise HTTPException(403, "Not your family")
    new_status = "approved" if req.action == "approve" else "rejected"
    await db.wallet_entries.update_one(
        {"id": req.entry_id},
        {"$set": {"status": new_status, "approved_by": current["user_id"]}}
    )
    return {"message": f"Entry {new_status}"}

@router.put("/settings")
async def update_allowance_settings(req: AllowanceSettingsRequest, request: Request):
    current = await get_current_user(request)
    if current["role"] not in ["parent", "superadmin"]:
        raise HTTPException(403, "Only parents can update settings")
    family_id = current.get("family_id")
    settings = {
        "child_id": req.child_id, "family_id": family_id,
        "mode": req.mode, "weekly_amount": req.weekly_amount,
        "payout_day": req.payout_day,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    await db.allowance_settings.update_one(
        {"child_id": req.child_id},
        {"$set": settings},
        upsert=True
    )
    return {"settings": settings}

@router.get("/pending")
async def list_pending(request: Request):
    current = await get_current_user(request)
    if current["role"] not in ["parent", "superadmin"]:
        raise HTTPException(403, "Only parents can view pending")
    family_id = current.get("family_id")
    entries = await db.wallet_entries.find(
        {"family_id": family_id, "status": "pending"}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    for entry in entries:
        child = await db.children.find_one({"id": entry["child_id"]}, {"_id": 0})
        entry["child_name"] = child["name"] if child else "Unknown"
    return {"entries": entries}
