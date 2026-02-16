from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from datetime import datetime, timezone, timedelta
from database import db
from middleware import get_current_user, create_token
import uuid
import hashlib
import urllib.parse
from typing import Optional

router = APIRouter(prefix="/api/billing", tags=["billing"])

PLANS = {
    "chat_only": {"name": "Chat Only", "amount": 1500, "display": "R15", "features": ["messaging"], "retention_months": 6},
    "full": {"name": "Full Plan", "amount": 6500, "display": "R65", "features": ["messaging", "curriculum", "chores", "allowance", "reports"], "retention_months": 12}
}

class SubscribeRequest(BaseModel):
    plan_id: str  # chat_only or full
    name: str = ""
    email: str = ""

class CancelRequest(BaseModel):
    reason: str = ""

# ===== PLANS =====

@router.get("/plans")
async def get_plans():
    return {"plans": PLANS}

@router.get("/status")
async def get_billing_status(request: Request):
    current = await get_current_user(request)
    family_id = current.get("family_id")
    if not family_id:
        return {"subscription": None}
    family = await db.families.find_one({"id": family_id}, {"_id": 0})
    sub = await db.subscriptions.find_one({"family_id": family_id, "status": {"$in": ["active", "grace", "past_due"]}}, {"_id": 0})
    return {"subscription": sub, "plan": family.get("plan", "free") if family else "free",
            "plan_status": family.get("plan_status", "active") if family else "active"}

# ===== SUBSCRIBE (STUB - PayFast redirect simulation) =====

@router.post("/subscribe")
async def subscribe(req: SubscribeRequest, request: Request):
    current = await get_current_user(request)
    family_id = current.get("family_id")
    if not family_id:
        raise HTTPException(400, "No family")
    plan = PLANS.get(req.plan_id)
    if not plan:
        raise HTTPException(400, "Invalid plan")
    # Check if real PayFast keys exist
    settings = await db.admin_settings.find_one({"type": "api_keys"}, {"_id": 0})
    has_payfast = settings and settings.get("payfast_merchant_id")
    if has_payfast:
        # Real PayFast redirect
        merchant_id = settings.get("payfast_merchant_id", "")
        merchant_key = settings.get("payfast_merchant_key", "")
        passphrase = settings.get("payfast_passphrase", "")
        sandbox = settings.get("payfast_sandbox", True)
        base_url = "https://sandbox.payfast.co.za" if sandbox else "https://www.payfast.co.za"
        sub_id = str(uuid.uuid4())
        pf_data = {
            "merchant_id": merchant_id,
            "merchant_key": merchant_key,
            "return_url": f"{request.headers.get('origin', '')}/settings?billing=success",
            "cancel_url": f"{request.headers.get('origin', '')}/settings?billing=cancel",
            "notify_url": f"{request.headers.get('origin', '')}/api/billing/webhook",
            "email_address": req.email or current["email"],
            "m_payment_id": sub_id,
            "amount": f"{plan['amount'] / 100:.2f}",
            "item_name": f"BOMA {plan['name']}",
            "subscription_type": "1",
            "recurring_amount": f"{plan['amount'] / 100:.2f}",
            "frequency": "3",
            "cycles": "0",
        }
        # Calculate signature
        pfout = ""
        for k, v in pf_data.items():
            if str(v).strip():
                pfout += f"{k}={urllib.parse.quote_plus(str(v).strip())}&"
        pfout = pfout.rstrip("&")
        if passphrase:
            pfout += f"&passphrase={urllib.parse.quote_plus(passphrase)}"
        sig = hashlib.md5(pfout.encode()).hexdigest()
        pf_data["signature"] = sig
        redirect_url = f"{base_url}/eng/process?{urllib.parse.urlencode(pf_data)}"
        # Save pending subscription
        await db.subscriptions.insert_one({
            "id": sub_id, "family_id": family_id, "plan_id": req.plan_id,
            "status": "pending", "amount": plan["amount"],
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        return {"mode": "redirect", "redirect_url": redirect_url}
    else:
        # Stub mode - activate immediately
        sub_id = str(uuid.uuid4())
        await db.subscriptions.insert_one({
            "id": sub_id, "family_id": family_id, "plan_id": req.plan_id,
            "status": "active", "amount": plan["amount"],
            "payfast_subscription_id": f"stub_{sub_id[:8]}",
            "next_billing_date": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        await db.families.update_one({"id": family_id}, {"$set": {
            "plan": req.plan_id, "plan_status": "active",
            "plan_features": {f: True for f in plan["features"]},
        }})
        return {"mode": "stub", "message": f"Subscribed to {plan['name']} (stub mode - no PayFast keys configured)", "subscription_id": sub_id}

# ===== WEBHOOK (PayFast ITN) =====

@router.post("/webhook")
async def payfast_webhook(request: Request):
    body = await request.form()
    data = dict(body)
    payment_id = data.get("pf_payment_id", "")
    status = data.get("payment_status", "").upper()
    sub_id = data.get("m_payment_id", "")
    sub = await db.subscriptions.find_one({"id": sub_id}, {"_id": 0})
    if not sub:
        return {"status": "error", "detail": "Subscription not found"}
    new_status = "active" if status == "COMPLETE" else "past_due" if status == "FAILED" else "pending"
    await db.subscriptions.update_one({"id": sub_id}, {"$set": {"status": new_status, "payfast_payment_id": payment_id}})
    if new_status == "active" and sub.get("family_id"):
        plan = PLANS.get(sub.get("plan_id", "full"), PLANS["full"])
        await db.families.update_one({"id": sub["family_id"]}, {"$set": {
            "plan": sub.get("plan_id", "full"), "plan_status": "active",
            "plan_features": {f: True for f in plan["features"]},
        }})
    return {"status": "ok"}

# ===== CANCEL =====

@router.post("/cancel")
async def cancel_subscription(req: CancelRequest, request: Request):
    current = await get_current_user(request)
    family_id = current.get("family_id")
    sub = await db.subscriptions.find_one({"family_id": family_id, "status": "active"}, {"_id": 0})
    if not sub:
        raise HTTPException(404, "No active subscription")
    grace_end = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
    await db.subscriptions.update_one({"id": sub["id"]}, {"$set": {"status": "grace", "cancelled_at": datetime.now(timezone.utc).isoformat(), "grace_end": grace_end}})
    await db.families.update_one({"id": family_id}, {"$set": {"plan_status": "grace"}})
    return {"message": "Subscription cancelled. Grace period: 7 days.", "grace_end": grace_end}
