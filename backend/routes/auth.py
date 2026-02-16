from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from datetime import datetime, timezone
from database import db
from middleware import create_token, get_current_user
import bcrypt
import uuid

router = APIRouter(prefix="/api/auth", tags=["auth"])

class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str
    role: str = "parent"

class LoginRequest(BaseModel):
    email: str = ""  # Can be email or username
    username: str = ""  # Alternative field for username
    password: str

class ChildAccountRequest(BaseModel):
    child_id: str
    username: str
    password: str

@router.post("/register")
async def register(req: RegisterRequest):
    existing = await db.users.find_one({"email": req.email}, {"_id": 0})
    if existing:
        raise HTTPException(400, "Email already registered")
    if req.role not in ["parent", "superadmin"]:
        req.role = "parent"
    hashed = bcrypt.hashpw(req.password.encode(), bcrypt.gensalt()).decode()
    user_id = str(uuid.uuid4())
    colors = ["#4F9DCE", "#88C477", "#F4C542", "#E05A6D", "#C06C47", "#2D4F3F"]
    import random
    user = {
        "id": user_id,
        "email": req.email,
        "password_hash": hashed,
        "name": req.name,
        "role": req.role,
        "family_id": None,
        "avatar_color": random.choice(colors),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user)
    token = create_token({"user_id": user_id, "email": req.email, "role": req.role, "name": req.name})
    return {
        "token": token,
        "user": {
            "id": user_id, "email": req.email, "name": req.name,
            "role": req.role, "family_id": None, "avatar_color": user["avatar_color"]
        }
    }

@router.post("/login")
async def login(req: LoginRequest):
    # Support both email and username fields
    identifier = req.email or req.username
    if not identifier:
        raise HTTPException(400, "Email or username required")
    
    # Try to find user by email field (which stores username for children)
    user = await db.users.find_one({"email": identifier}, {"_id": 0})
    if not user:
        raise HTTPException(401, "Invalid credentials")
    if not bcrypt.checkpw(req.password.encode(), user["password_hash"].encode()):
        raise HTTPException(401, "Invalid credentials")
    token = create_token({
        "user_id": user["id"], "email": user["email"],
        "role": user["role"], "name": user["name"],
        "family_id": user.get("family_id"),
        "child_id": user.get("child_id")
    })
    return {
        "token": token,
        "user": {
            "id": user["id"], "email": user["email"], "name": user["name"],
            "role": user["role"], "family_id": user.get("family_id"),
            "child_id": user.get("child_id"),
            "avatar_color": user.get("avatar_color", "#2D4F3F")
        }
    }

@router.get("/me")
async def get_me(request: Request):
    current = await get_current_user(request)
    user = await db.users.find_one({"id": current["user_id"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(404, "User not found")
    return user

@router.post("/child-account")
async def create_child_account(req: ChildAccountRequest, request: Request):
    current = await get_current_user(request)
    if current["role"] not in ["parent", "superadmin"]:
        raise HTTPException(403, "Only parents can create child accounts")
    child = await db.children.find_one({"id": req.child_id}, {"_id": 0})
    if not child:
        raise HTTPException(404, "Child not found")
    if child.get("family_id") != current.get("family_id") and current["role"] != "superadmin":
        raise HTTPException(403, "Not your family")
    existing = await db.users.find_one({"email": req.username}, {"_id": 0})
    if existing:
        raise HTTPException(400, "Username already taken")
    hashed = bcrypt.hashpw(req.password.encode(), bcrypt.gensalt()).decode()
    user_id = str(uuid.uuid4())
    user = {
        "id": user_id,
        "email": req.username,
        "password_hash": hashed,
        "name": child["name"],
        "role": "child",
        "family_id": child["family_id"],
        "child_id": req.child_id,
        "avatar_color": child.get("avatar_color", "#4F9DCE"),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user)
    await db.children.update_one({"id": req.child_id}, {"$set": {"user_id": user_id}})
    return {"message": "Child account created", "user_id": user_id}
