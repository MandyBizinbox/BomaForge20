from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from datetime import datetime, timezone, timedelta
from database import db
from middleware import get_current_user
import uuid
from typing import Optional, List

router = APIRouter(prefix="/api/curriculum", tags=["curriculum"])

class CreateTermRequest(BaseModel):
    name: str
    start_date: str
    end_date: str

class UpdateTermRequest(BaseModel):
    name: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None

class CreateTermBreakRequest(BaseModel):
    name: str
    start_date: str
    end_date: str

class CreateSubjectRequest(BaseModel):
    name: str
    color: str = "#2D4F3F"
    description: Optional[str] = None

class UpdateSubjectRequest(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    description: Optional[str] = None

class GenerateLessonsRequest(BaseModel):
    child_id: str
    subject_id: str
    term_id: str
    title_prefix: str = "Lesson"
    count: Optional[int] = None

class UpdateLessonRequest(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    instructions: Optional[str] = None  # Parent instructions for child
    content: Optional[str] = None  # Rich text content (WYSIWYG)
    planned_date: Optional[str] = None  # Allow rescheduling

class QuizQuestion(BaseModel):
    id: str
    question: str
    type: str  # "radio" or "text"
    options: Optional[List[str]] = None  # For radio buttons
    correct_answer: Optional[str] = None  # For grading

class CreateLessonRequest(BaseModel):
    child_id: str
    subject_id: str
    term_id: Optional[str] = None
    title: str
    description: Optional[str] = ""
    instructions: Optional[str] = ""
    content: Optional[str] = ""
    planned_date: str
    quiz: Optional[List[QuizQuestion]] = None

class UpdateQuizRequest(BaseModel):
    quiz: List[QuizQuestion]

class SubmitQuizRequest(BaseModel):
    answers: dict  # {question_id: answer}

# ===== TERMS =====

@router.get("/terms")
async def list_terms(request: Request):
    current = await get_current_user(request)
    family_id = current.get("family_id")
    if not family_id and current["role"] != "superadmin":
        return {"terms": []}
    terms = await db.terms.find({"family_id": family_id}, {"_id": 0}).sort("start_date", 1).to_list(100)
    for term in terms:
        breaks = await db.term_breaks.find({"term_id": term["id"]}, {"_id": 0}).to_list(100)
        term["breaks"] = breaks
    return {"terms": terms}

@router.post("/terms")
async def create_term(req: CreateTermRequest, request: Request):
    current = await get_current_user(request)
    if current["role"] not in ["parent", "superadmin"]:
        raise HTTPException(403, "Only parents can manage terms")
    family_id = current.get("family_id")
    if not family_id:
        raise HTTPException(400, "No family")
    start = datetime.fromisoformat(req.start_date)
    end = datetime.fromisoformat(req.end_date)
    if end <= start:
        raise HTTPException(400, "End date must be after start date")
    overlap = await db.terms.find_one({
        "family_id": family_id,
        "$or": [
            {"start_date": {"$lte": req.end_date}, "end_date": {"$gte": req.start_date}}
        ]
    }, {"_id": 0})
    if overlap:
        raise HTTPException(400, f"Overlaps with term: {overlap['name']}")
    term_id = str(uuid.uuid4())
    term = {
        "id": term_id, "family_id": family_id,
        "name": req.name, "start_date": req.start_date, "end_date": req.end_date,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.terms.insert_one(term)
    return {"term": {k: v for k, v in term.items() if k != "_id"}, "breaks": []}

@router.put("/terms/{term_id}")
async def update_term(term_id: str, req: UpdateTermRequest, request: Request):
    current = await get_current_user(request)
    if current["role"] not in ["parent", "superadmin"]:
        raise HTTPException(403, "Only parents can manage terms")
    term = await db.terms.find_one({"id": term_id}, {"_id": 0})
    if not term:
        raise HTTPException(404, "Term not found")
    if term["family_id"] != current.get("family_id") and current["role"] != "superadmin":
        raise HTTPException(403, "Not your family")
    update = {}
    if req.name is not None:
        update["name"] = req.name
    if req.start_date is not None:
        update["start_date"] = req.start_date
    if req.end_date is not None:
        update["end_date"] = req.end_date
    if update:
        new_start = update.get("start_date", term["start_date"])
        new_end = update.get("end_date", term["end_date"])
        if datetime.fromisoformat(new_end) <= datetime.fromisoformat(new_start):
            raise HTTPException(400, "End date must be after start date")
        await db.terms.update_one({"id": term_id}, {"$set": update})
    updated = await db.terms.find_one({"id": term_id}, {"_id": 0})
    breaks = await db.term_breaks.find({"term_id": term_id}, {"_id": 0}).to_list(100)
    return {"term": updated, "breaks": breaks}

@router.delete("/terms/{term_id}")
async def delete_term(term_id: str, request: Request):
    current = await get_current_user(request)
    if current["role"] not in ["parent", "superadmin"]:
        raise HTTPException(403, "Only parents can manage terms")
    term = await db.terms.find_one({"id": term_id}, {"_id": 0})
    if not term:
        raise HTTPException(404, "Term not found")
    if term["family_id"] != current.get("family_id") and current["role"] != "superadmin":
        raise HTTPException(403, "Not your family")
    await db.terms.delete_one({"id": term_id})
    await db.term_breaks.delete_many({"term_id": term_id})
    return {"message": "Term deleted"}

# ===== TERM BREAKS =====

@router.post("/terms/{term_id}/breaks")
async def create_term_break(term_id: str, req: CreateTermBreakRequest, request: Request):
    current = await get_current_user(request)
    if current["role"] not in ["parent", "superadmin"]:
        raise HTTPException(403, "Only parents can manage breaks")
    term = await db.terms.find_one({"id": term_id}, {"_id": 0})
    if not term:
        raise HTTPException(404, "Term not found")
    if term["family_id"] != current.get("family_id") and current["role"] != "superadmin":
        raise HTTPException(403, "Not your family")
    break_start = datetime.fromisoformat(req.start_date)
    break_end = datetime.fromisoformat(req.end_date)
    term_start = datetime.fromisoformat(term["start_date"])
    term_end = datetime.fromisoformat(term["end_date"])
    if break_start < term_start or break_end > term_end:
        raise HTTPException(400, "Break must be within term dates")
    if break_end < break_start:
        raise HTTPException(400, "Break end must be after start")
    break_id = str(uuid.uuid4())
    tb = {
        "id": break_id, "term_id": term_id, "family_id": term["family_id"],
        "name": req.name, "start_date": req.start_date, "end_date": req.end_date,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.term_breaks.insert_one(tb)
    return {"break": {k: v for k, v in tb.items() if k != "_id"}}

@router.delete("/breaks/{break_id}")
async def delete_term_break(break_id: str, request: Request):
    current = await get_current_user(request)
    tb = await db.term_breaks.find_one({"id": break_id}, {"_id": 0})
    if not tb:
        raise HTTPException(404, "Break not found")
    if tb["family_id"] != current.get("family_id") and current["role"] != "superadmin":
        raise HTTPException(403, "Not your family")
    await db.term_breaks.delete_one({"id": break_id})
    return {"message": "Break deleted"}

# ===== SUBJECTS =====

@router.get("/subjects")
async def list_subjects(request: Request):
    current = await get_current_user(request)
    family_id = current.get("family_id")
    if not family_id and current["role"] != "superadmin":
        return {"subjects": []}
    subjects = await db.subjects.find({"family_id": family_id}, {"_id": 0}).to_list(100)
    return {"subjects": subjects}

@router.post("/subjects")
async def create_subject(req: CreateSubjectRequest, request: Request):
    current = await get_current_user(request)
    if current["role"] not in ["parent", "superadmin"]:
        raise HTTPException(403, "Only parents can manage subjects")
    family_id = current.get("family_id")
    if not family_id:
        raise HTTPException(400, "No family")
    subject_id = str(uuid.uuid4())
    subject = {
        "id": subject_id, "family_id": family_id,
        "name": req.name, "color": req.color, "description": req.description,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.subjects.insert_one(subject)
    return {"subject": {k: v for k, v in subject.items() if k != "_id"}}

@router.put("/subjects/{subject_id}")
async def update_subject(subject_id: str, req: UpdateSubjectRequest, request: Request):
    current = await get_current_user(request)
    if current["role"] not in ["parent", "superadmin"]:
        raise HTTPException(403, "Only parents can manage subjects")
    subject = await db.subjects.find_one({"id": subject_id}, {"_id": 0})
    if not subject:
        raise HTTPException(404, "Subject not found")
    if subject["family_id"] != current.get("family_id") and current["role"] != "superadmin":
        raise HTTPException(403, "Not your family")
    update = {}
    if req.name is not None:
        update["name"] = req.name
    if req.color is not None:
        update["color"] = req.color
    if req.description is not None:
        update["description"] = req.description
    if update:
        await db.subjects.update_one({"id": subject_id}, {"$set": update})
    updated = await db.subjects.find_one({"id": subject_id}, {"_id": 0})
    return {"subject": updated}

@router.delete("/subjects/{subject_id}")
async def delete_subject(subject_id: str, request: Request):
    current = await get_current_user(request)
    if current["role"] not in ["parent", "superadmin"]:
        raise HTTPException(403, "Only parents can manage subjects")
    subject = await db.subjects.find_one({"id": subject_id}, {"_id": 0})
    if not subject:
        raise HTTPException(404, "Subject not found")
    if subject["family_id"] != current.get("family_id") and current["role"] != "superadmin":
        raise HTTPException(403, "Not your family")
    await db.subjects.delete_one({"id": subject_id})
    return {"message": "Subject deleted"}

# ===== LESSONS =====

@router.get("/lessons")
async def list_lessons(request: Request, child_id: str = None, term_id: str = None, subject_id: str = None, date: str = None, week_start: str = None):
    current = await get_current_user(request)
    family_id = current.get("family_id")
    if not family_id and current["role"] != "superadmin":
        return {"lessons": []}
    query = {"family_id": family_id}
    if child_id:
        query["child_id"] = child_id
    if current["role"] == "child":
        user = await db.users.find_one({"id": current["user_id"]}, {"_id": 0})
        if user and user.get("child_id"):
            query["child_id"] = user["child_id"]
    if term_id:
        query["term_id"] = term_id
    if subject_id:
        query["subject_id"] = subject_id
    if date:
        query["planned_date"] = date
    if week_start:
        ws = datetime.fromisoformat(week_start)
        we = ws + timedelta(days=6)
        query["planned_date"] = {"$gte": week_start, "$lte": we.strftime("%Y-%m-%d")}
    lessons = await db.lessons.find(query, {"_id": 0}).sort("planned_date", 1).to_list(1000)
    return {"lessons": lessons}

@router.post("/lessons/generate")
async def generate_lessons(req: GenerateLessonsRequest, request: Request):
    current = await get_current_user(request)
    if current["role"] not in ["parent", "superadmin"]:
        raise HTTPException(403, "Only parents can generate lessons")
    family_id = current.get("family_id")
    child = await db.children.find_one({"id": req.child_id}, {"_id": 0})
    if not child:
        raise HTTPException(404, "Child not found")
    if child["family_id"] != family_id and current["role"] != "superadmin":
        raise HTTPException(403, "Not your family")
    term = await db.terms.find_one({"id": req.term_id}, {"_id": 0})
    if not term:
        raise HTTPException(404, "Term not found")
    subject = await db.subjects.find_one({"id": req.subject_id}, {"_id": 0})
    if not subject:
        raise HTTPException(404, "Subject not found")
    schedule_days = child.get("schedule_weekdays", [0, 1, 2, 3, 4])
    if not schedule_days:
        raise HTTPException(400, "No schedule weekdays set for this child. Please update their profile first.")
    breaks = await db.term_breaks.find({"term_id": req.term_id}, {"_id": 0}).to_list(100)
    break_ranges = []
    for b in breaks:
        break_ranges.append((
            datetime.fromisoformat(b["start_date"]),
            datetime.fromisoformat(b["end_date"])
        ))
    term_start = datetime.fromisoformat(term["start_date"])
    term_end = datetime.fromisoformat(term["end_date"])
    generated = []
    skipped = []
    current_date = term_start
    lesson_num = 1
    max_count = req.count or 999
    while current_date <= term_end and lesson_num <= max_count:
        weekday = current_date.weekday()
        date_str = current_date.strftime("%Y-%m-%d")
        in_break = False
        break_name = None
        for bs, be in break_ranges:
            if bs <= current_date <= be:
                in_break = True
                for b in breaks:
                    if datetime.fromisoformat(b["start_date"]) <= current_date <= datetime.fromisoformat(b["end_date"]):
                        break_name = b["name"]
                break
        if weekday not in schedule_days:
            if weekday in [0, 1, 2, 3, 4]:
                skipped.append({"date": date_str, "reason": "Not a scheduled weekday"})
            current_date += timedelta(days=1)
            continue
        if in_break:
            skipped.append({"date": date_str, "reason": f"Term break: {break_name}"})
            current_date += timedelta(days=1)
            continue
        existing = await db.lessons.find_one({
            "child_id": req.child_id, "subject_id": req.subject_id, "planned_date": date_str
        }, {"_id": 0})
        if existing:
            current_date += timedelta(days=1)
            continue
        lesson_id = str(uuid.uuid4())
        lesson = {
            "id": lesson_id, "family_id": family_id,
            "child_id": req.child_id, "subject_id": req.subject_id, "term_id": req.term_id,
            "title": f"{req.title_prefix} {lesson_num}: {subject['name']}",
            "description": "", "planned_date": date_str,
            "status": "pending", "notes": "", "completed_at": None,
            "subject_name": subject["name"], "subject_color": subject["color"],
            "child_name": child["name"],
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.lessons.insert_one(lesson)
        generated.append({k: v for k, v in lesson.items() if k != "_id"})
        lesson_num += 1
        current_date += timedelta(days=1)
    return {
        "generated_count": len(generated),
        "skipped_count": len(skipped),
        "child_name": child["name"],
        "subject_name": subject["name"],
        "date_range": f"{term['start_date']} to {term['end_date']}",
        "generated": generated,
        "skipped": skipped
    }

@router.put("/lessons/{lesson_id}")
async def update_lesson(lesson_id: str, req: UpdateLessonRequest, request: Request):
    current = await get_current_user(request)
    lesson = await db.lessons.find_one({"id": lesson_id}, {"_id": 0})
    if not lesson:
        raise HTTPException(404, "Lesson not found")
    if lesson["family_id"] != current.get("family_id") and current["role"] != "superadmin":
        raise HTTPException(403, "Not your family")
    update = {}
    if req.status is not None:
        update["status"] = req.status
        if req.status == "done":
            update["completed_at"] = datetime.now(timezone.utc).isoformat()
        elif req.status == "pending":
            update["completed_at"] = None
    if req.notes is not None:
        update["notes"] = req.notes
    if req.title is not None:
        update["title"] = req.title
    if req.description is not None:
        update["description"] = req.description
    if req.instructions is not None:
        update["instructions"] = req.instructions
    if req.content is not None:
        update["content"] = req.content
    if req.planned_date is not None:
        update["planned_date"] = req.planned_date
    if update:
        update["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.lessons.update_one({"id": lesson_id}, {"$set": update})
    updated = await db.lessons.find_one({"id": lesson_id}, {"_id": 0})
    return {"lesson": updated}

@router.delete("/lessons/{lesson_id}")
async def delete_lesson(lesson_id: str, request: Request):
    current = await get_current_user(request)
    if current["role"] not in ["parent", "superadmin"]:
        raise HTTPException(403, "Only parents can delete lessons")
    lesson = await db.lessons.find_one({"id": lesson_id}, {"_id": 0})
    if not lesson:
        raise HTTPException(404, "Lesson not found")
    if lesson["family_id"] != current.get("family_id") and current["role"] != "superadmin":
        raise HTTPException(403, "Not your family")
    await db.lessons.delete_one({"id": lesson_id})
    return {"message": "Lesson deleted"}

# ===== SINGLE LESSON CRUD =====

@router.get("/lessons/{lesson_id}")
async def get_lesson(lesson_id: str, request: Request):
    """Get detailed lesson info including content, quiz, and submissions"""
    current = await get_current_user(request)
    lesson = await db.lessons.find_one({"id": lesson_id}, {"_id": 0})
    if not lesson:
        raise HTTPException(404, "Lesson not found")
    if lesson["family_id"] != current.get("family_id") and current["role"] != "superadmin":
        raise HTTPException(403, "Not your family")
    # Get quiz submissions if any
    submissions = await db.quiz_submissions.find({"lesson_id": lesson_id}, {"_id": 0}).to_list(100)
    lesson["submissions"] = submissions
    return {"lesson": lesson}

@router.post("/lessons")
async def create_lesson(req: CreateLessonRequest, request: Request):
    """Create a single lesson with full content"""
    current = await get_current_user(request)
    if current["role"] not in ["parent", "superadmin"]:
        raise HTTPException(403, "Only parents can create lessons")
    family_id = current.get("family_id")
    if not family_id:
        raise HTTPException(400, "No family")
    
    # Validate child
    child = await db.children.find_one({"id": req.child_id}, {"_id": 0})
    if not child:
        raise HTTPException(404, "Child not found")
    if child["family_id"] != family_id and current["role"] != "superadmin":
        raise HTTPException(403, "Not your family")
    
    # Validate subject
    subject = await db.subjects.find_one({"id": req.subject_id}, {"_id": 0})
    if not subject:
        raise HTTPException(404, "Subject not found")
    
    # Validate term if provided
    term_id = req.term_id
    if term_id:
        term = await db.terms.find_one({"id": term_id}, {"_id": 0})
        if not term:
            raise HTTPException(404, "Term not found")
    
    lesson_id = str(uuid.uuid4())
    quiz_data = None
    if req.quiz:
        quiz_data = [q.dict() for q in req.quiz]
    
    lesson = {
        "id": lesson_id,
        "family_id": family_id,
        "child_id": req.child_id,
        "subject_id": req.subject_id,
        "term_id": term_id,
        "title": req.title,
        "description": req.description or "",
        "instructions": req.instructions or "",
        "content": req.content or "",
        "planned_date": req.planned_date,
        "status": "pending",
        "notes": "",
        "completed_at": None,
        "quiz": quiz_data,
        "subject_name": subject["name"],
        "subject_color": subject["color"],
        "child_name": child["name"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.lessons.insert_one(lesson)
    return {"lesson": {k: v for k, v in lesson.items() if k != "_id"}}

@router.put("/lessons/{lesson_id}/quiz")
async def update_lesson_quiz(lesson_id: str, req: UpdateQuizRequest, request: Request):
    """Update quiz questions for a lesson"""
    current = await get_current_user(request)
    if current["role"] not in ["parent", "superadmin"]:
        raise HTTPException(403, "Only parents can manage quizzes")
    
    lesson = await db.lessons.find_one({"id": lesson_id}, {"_id": 0})
    if not lesson:
        raise HTTPException(404, "Lesson not found")
    if lesson["family_id"] != current.get("family_id") and current["role"] != "superadmin":
        raise HTTPException(403, "Not your family")
    
    quiz_data = [q.dict() for q in req.quiz]
    await db.lessons.update_one({"id": lesson_id}, {"$set": {"quiz": quiz_data}})
    
    updated = await db.lessons.find_one({"id": lesson_id}, {"_id": 0})
    return {"lesson": updated}

@router.post("/lessons/{lesson_id}/submit-quiz")
async def submit_quiz(lesson_id: str, req: SubmitQuizRequest, request: Request):
    """Child submits quiz answers"""
    current = await get_current_user(request)
    
    lesson = await db.lessons.find_one({"id": lesson_id}, {"_id": 0})
    if not lesson:
        raise HTTPException(404, "Lesson not found")
    if lesson["family_id"] != current.get("family_id") and current["role"] != "superadmin":
        raise HTTPException(403, "Not your family")
    
    if not lesson.get("quiz"):
        raise HTTPException(400, "This lesson has no quiz")
    
    # Calculate score
    quiz = lesson["quiz"]
    total = len(quiz)
    correct = 0
    results = []
    
    for q in quiz:
        user_answer = req.answers.get(q["id"], "")
        is_correct = False
        if q.get("correct_answer"):
            is_correct = user_answer.strip().lower() == q["correct_answer"].strip().lower()
            if is_correct:
                correct += 1
        results.append({
            "question_id": q["id"],
            "question": q["question"],
            "user_answer": user_answer,
            "correct_answer": q.get("correct_answer"),
            "is_correct": is_correct
        })
    
    submission_id = str(uuid.uuid4())
    submission = {
        "id": submission_id,
        "lesson_id": lesson_id,
        "child_id": current.get("child_id") or lesson["child_id"],
        "family_id": lesson["family_id"],
        "answers": req.answers,
        "results": results,
        "score": correct,
        "total": total,
        "percentage": round((correct / total) * 100, 1) if total > 0 else 0,
        "submitted_at": datetime.now(timezone.utc).isoformat()
    }
    await db.quiz_submissions.insert_one(submission)
    
    return {"submission": {k: v for k, v in submission.items() if k != "_id"}}

# ===== TODAY =====

@router.get("/today")
async def get_today(request: Request, child_id: str = None):
    current = await get_current_user(request)
    family_id = current.get("family_id")
    if not family_id and current["role"] != "superadmin":
        return {"lessons": [], "chores": []}
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    lesson_query = {"family_id": family_id, "planned_date": today}
    chore_query = {"family_id": family_id, "planned_date": today}
    if child_id:
        lesson_query["child_id"] = child_id
        chore_query["child_id"] = child_id
    if current["role"] == "child":
        user = await db.users.find_one({"id": current["user_id"]}, {"_id": 0})
        if user and user.get("child_id"):
            lesson_query["child_id"] = user["child_id"]
            chore_query["child_id"] = user["child_id"]
    lessons = await db.lessons.find(lesson_query, {"_id": 0}).sort("planned_date", 1).to_list(500)
    chores = await db.chore_instances.find(chore_query, {"_id": 0}).sort("planned_date", 1).to_list(500)
    children = await db.children.find({"family_id": family_id}, {"_id": 0}).to_list(100)
    return {"lessons": lessons, "chores": chores, "children": children, "date": today}
