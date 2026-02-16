from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from datetime import datetime, timezone
from database import db
from middleware import get_current_user
import uuid
import random
from typing import Optional, List

router = APIRouter(prefix="/api/children", tags=["children"])

class CreateChildRequest(BaseModel):
    name: str
    date_of_birth: Optional[str] = None
    grade: Optional[str] = None
    schedule_weekdays: List[int] = [0, 1, 2, 3, 4]

class UpdateChildRequest(BaseModel):
    name: Optional[str] = None
    date_of_birth: Optional[str] = None
    grade: Optional[str] = None
    schedule_weekdays: Optional[List[int]] = None

@router.get("")
async def list_children(request: Request):
    current = await get_current_user(request)
    family_id = current.get("family_id")
    if not family_id and current["role"] != "superadmin":
        return {"children": []}
    children = await db.children.find({"family_id": family_id}, {"_id": 0}).to_list(100)
    return {"children": children}

@router.post("")
async def create_child(req: CreateChildRequest, request: Request):
    current = await get_current_user(request)
    if current["role"] not in ["parent", "superadmin"]:
        raise HTTPException(403, "Only parents can add children")
    family_id = current.get("family_id")
    if not family_id:
        raise HTTPException(400, "Create a family first")
    colors = ["#4F9DCE", "#88C477", "#F4C542", "#E05A6D", "#C06C47"]
    child_id = str(uuid.uuid4())
    child = {
        "id": child_id,
        "family_id": family_id,
        "user_id": None,
        "name": req.name,
        "date_of_birth": req.date_of_birth,
        "grade": req.grade,
        "schedule_weekdays": req.schedule_weekdays,
        "avatar_color": random.choice(colors),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.children.insert_one(child)
    return {"child": {k: v for k, v in child.items() if k != "_id"}}

@router.get("/{child_id}")
async def get_child(child_id: str, request: Request):
    current = await get_current_user(request)
    child = await db.children.find_one({"id": child_id}, {"_id": 0})
    if not child:
        raise HTTPException(404, "Child not found")
    if child["family_id"] != current.get("family_id") and current["role"] != "superadmin":
        raise HTTPException(403, "Not your family")
    return {"child": child}

@router.put("/{child_id}")
async def update_child(child_id: str, req: UpdateChildRequest, request: Request):
    current = await get_current_user(request)
    if current["role"] not in ["parent", "superadmin"]:
        raise HTTPException(403, "Only parents can update children")
    child = await db.children.find_one({"id": child_id}, {"_id": 0})
    if not child:
        raise HTTPException(404, "Child not found")
    if child["family_id"] != current.get("family_id") and current["role"] != "superadmin":
        raise HTTPException(403, "Not your family")
    update = {}
    if req.name is not None:
        update["name"] = req.name
    if req.date_of_birth is not None:
        update["date_of_birth"] = req.date_of_birth
    if req.grade is not None:
        update["grade"] = req.grade
    if req.schedule_weekdays is not None:
        update["schedule_weekdays"] = req.schedule_weekdays
    if update:
        await db.children.update_one({"id": child_id}, {"$set": update})
    updated = await db.children.find_one({"id": child_id}, {"_id": 0})
    return {"child": updated}

@router.delete("/{child_id}")
async def delete_child(child_id: str, request: Request):
    current = await get_current_user(request)
    if current["role"] not in ["parent", "superadmin"]:
        raise HTTPException(403, "Only parents can remove children")
    child = await db.children.find_one({"id": child_id}, {"_id": 0})
    if not child:
        raise HTTPException(404, "Child not found")
    if child["family_id"] != current.get("family_id") and current["role"] != "superadmin":
        raise HTTPException(403, "Not your family")
    await db.children.delete_one({"id": child_id})
    await db.lessons.delete_many({"child_id": child_id})
    return {"message": "Child removed"}
