from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from datetime import datetime, timezone, timedelta
from database import db
from middleware import get_current_user
import uuid
from typing import Optional, List

router = APIRouter(prefix="/api/chores", tags=["chores"])

class CreateChoreTemplateRequest(BaseModel):
    name: str
    description: str = ""
    category: str = "general"
    points: int = 0
    frequency: str = "weekdays"
    custom_days: List[int] = []

class AssignChoreRequest(BaseModel):
    template_id: str
    child_ids: List[str]
    start_date: str
    end_date: str

class UpdateChoreInstanceRequest(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None

FREQUENCY_MAP = {
    "daily": [0, 1, 2, 3, 4, 5, 6],
    "weekdays": [0, 1, 2, 3, 4],
    "weekends": [5, 6],
    "mwf": [0, 2, 4],
    "tth": [1, 3],
    "once": [],
}

@router.get("/templates")
async def list_templates(request: Request):
    current = await get_current_user(request)
    family_id = current.get("family_id")
    if not family_id:
        return {"templates": []}
    templates = await db.chore_templates.find({"family_id": family_id}, {"_id": 0}).to_list(100)
    return {"templates": templates}

@router.post("/templates")
async def create_template(req: CreateChoreTemplateRequest, request: Request):
    current = await get_current_user(request)
    if current["role"] not in ["parent", "superadmin"]:
        raise HTTPException(403, "Only parents can create chore templates")
    family_id = current.get("family_id")
    if not family_id:
        raise HTTPException(400, "No family")
    template_id = str(uuid.uuid4())
    template = {
        "id": template_id, "family_id": family_id,
        "name": req.name, "description": req.description,
        "category": req.category, "points": req.points,
        "frequency": req.frequency, "custom_days": req.custom_days,
        "active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.chore_templates.insert_one(template)
    return {"template": {k: v for k, v in template.items() if k != "_id"}}

@router.put("/templates/{template_id}")
async def update_template(template_id: str, request: Request):
    current = await get_current_user(request)
    if current["role"] not in ["parent", "superadmin"]:
        raise HTTPException(403, "Only parents can update templates")
    body = await request.json()
    template = await db.chore_templates.find_one({"id": template_id}, {"_id": 0})
    if not template:
        raise HTTPException(404, "Template not found")
    if template["family_id"] != current.get("family_id") and current["role"] != "superadmin":
        raise HTTPException(403, "Not your family")
    allowed = ["name", "description", "category", "points", "frequency", "custom_days", "active"]
    update = {k: v for k, v in body.items() if k in allowed}
    if update:
        await db.chore_templates.update_one({"id": template_id}, {"$set": update})
    updated = await db.chore_templates.find_one({"id": template_id}, {"_id": 0})
    return {"template": updated}

@router.delete("/templates/{template_id}")
async def delete_template(template_id: str, request: Request):
    current = await get_current_user(request)
    if current["role"] not in ["parent", "superadmin"]:
        raise HTTPException(403, "Only parents can delete templates")
    template = await db.chore_templates.find_one({"id": template_id}, {"_id": 0})
    if not template:
        raise HTTPException(404, "Template not found")
    if template["family_id"] != current.get("family_id") and current["role"] != "superadmin":
        raise HTTPException(403, "Not your family")
    await db.chore_templates.delete_one({"id": template_id})
    return {"message": "Template deleted"}

@router.post("/assign")
async def assign_chore(req: AssignChoreRequest, request: Request):
    current = await get_current_user(request)
    if current["role"] not in ["parent", "superadmin"]:
        raise HTTPException(403, "Only parents can assign chores")
    family_id = current.get("family_id")
    template = await db.chore_templates.find_one({"id": req.template_id}, {"_id": 0})
    if not template:
        raise HTTPException(404, "Template not found")
    freq = template.get("frequency", "weekdays")
    days = template.get("custom_days", []) if freq == "custom" else FREQUENCY_MAP.get(freq, [0, 1, 2, 3, 4])
    start = datetime.fromisoformat(req.start_date)
    end = datetime.fromisoformat(req.end_date)
    total_created = 0
    for child_id in req.child_ids:
        child = await db.children.find_one({"id": child_id}, {"_id": 0})
        if not child:
            continue
        assignment_id = str(uuid.uuid4())
        assignment = {
            "id": assignment_id, "family_id": family_id,
            "template_id": req.template_id, "child_id": child_id,
            "start_date": req.start_date, "end_date": req.end_date,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.chore_assignments.insert_one(assignment)
        current_date = start
        if freq == "once":
            instance_id = str(uuid.uuid4())
            instance = {
                "id": instance_id, "family_id": family_id,
                "assignment_id": assignment_id, "child_id": child_id,
                "template_id": req.template_id,
                "chore_name": template["name"], "points": template.get("points", 0),
                "planned_date": req.start_date,
                "status": "pending", "completed_at": None, "approved_at": None,
                "notes": "",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.chore_instances.insert_one(instance)
            total_created += 1
        else:
            while current_date <= end:
                if current_date.weekday() in days:
                    date_str = current_date.strftime("%Y-%m-%d")
                    instance_id = str(uuid.uuid4())
                    instance = {
                        "id": instance_id, "family_id": family_id,
                        "assignment_id": assignment_id, "child_id": child_id,
                        "template_id": req.template_id,
                        "chore_name": template["name"], "points": template.get("points", 0),
                        "planned_date": date_str,
                        "status": "pending", "completed_at": None, "approved_at": None,
                        "notes": "",
                        "created_at": datetime.now(timezone.utc).isoformat()
                    }
                    await db.chore_instances.insert_one(instance)
                    total_created += 1
                current_date += timedelta(days=1)
    return {"message": f"Created {total_created} chore instances", "count": total_created}

@router.get("/instances")
async def list_instances(request: Request, child_id: str = None, date: str = None, week_start: str = None):
    current = await get_current_user(request)
    family_id = current.get("family_id")
    if not family_id:
        return {"instances": []}
    query = {"family_id": family_id}
    if child_id:
        query["child_id"] = child_id
    if current["role"] == "child":
        user = await db.users.find_one({"id": current["user_id"]}, {"_id": 0})
        if user and user.get("child_id"):
            query["child_id"] = user["child_id"]
    if date:
        query["planned_date"] = date
    if week_start:
        ws = datetime.fromisoformat(week_start)
        we = ws + timedelta(days=6)
        query["planned_date"] = {"$gte": week_start, "$lte": we.strftime("%Y-%m-%d")}
    instances = await db.chore_instances.find(query, {"_id": 0}).sort("planned_date", 1).to_list(1000)
    return {"instances": instances}

@router.put("/instances/{instance_id}")
async def update_instance(instance_id: str, req: UpdateChoreInstanceRequest, request: Request):
    current = await get_current_user(request)
    instance = await db.chore_instances.find_one({"id": instance_id}, {"_id": 0})
    if not instance:
        raise HTTPException(404, "Instance not found")
    if instance["family_id"] != current.get("family_id") and current["role"] != "superadmin":
        raise HTTPException(403, "Not your family")
    update = {}
    if req.status is not None:
        update["status"] = req.status
        if req.status == "done":
            update["completed_at"] = datetime.now(timezone.utc).isoformat()
        elif req.status == "approved":
            update["approved_at"] = datetime.now(timezone.utc).isoformat()
        elif req.status == "pending":
            update["completed_at"] = None
            update["approved_at"] = None
    if req.notes is not None:
        update["notes"] = req.notes
    if update:
        await db.chore_instances.update_one({"id": instance_id}, {"$set": update})
    updated = await db.chore_instances.find_one({"id": instance_id}, {"_id": 0})
    return {"instance": updated}
