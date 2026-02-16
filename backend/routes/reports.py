from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from datetime import datetime, timezone, timedelta
from database import db
from middleware import get_current_user
import io
import csv
import uuid

router = APIRouter(prefix="/api/reports", tags=["reports"])

@router.get("/school/{child_id}")
async def school_report(child_id: str, request: Request, term_id: str = None):
    current = await get_current_user(request)
    family_id = current.get("family_id")
    child = await db.children.find_one({"id": child_id}, {"_id": 0})
    if not child:
        raise HTTPException(404, "Child not found")
    if child["family_id"] != family_id and current["role"] != "superadmin":
        raise HTTPException(403, "Not your family")
    query = {"child_id": child_id, "family_id": family_id}
    if term_id:
        query["term_id"] = term_id
    lessons = await db.lessons.find(query, {"_id": 0}).to_list(10000)
    total = len(lessons)
    done = len([l for l in lessons if l["status"] == "done"])
    pending = len([l for l in lessons if l["status"] == "pending"])
    skipped = len([l for l in lessons if l["status"] == "skipped"])
    subjects = {}
    for l in lessons:
        sname = l.get("subject_name", "Unknown")
        if sname not in subjects:
            subjects[sname] = {"total": 0, "done": 0, "pending": 0, "color": l.get("subject_color", "#2D4F3F")}
        subjects[sname]["total"] += 1
        if l["status"] == "done":
            subjects[sname]["done"] += 1
        elif l["status"] == "pending":
            subjects[sname]["pending"] += 1
    weekly = {}
    for l in lessons:
        d = datetime.fromisoformat(l["planned_date"])
        week_start = (d - timedelta(days=d.weekday())).strftime("%Y-%m-%d")
        if week_start not in weekly:
            weekly[week_start] = {"total": 0, "done": 0}
        weekly[week_start]["total"] += 1
        if l["status"] == "done":
            weekly[week_start]["done"] += 1
    return {
        "child": child,
        "summary": {"total": total, "done": done, "pending": pending, "skipped": skipped,
                     "completion_rate": round(done / total * 100, 1) if total > 0 else 0},
        "by_subject": subjects,
        "by_week": dict(sorted(weekly.items()))
    }

@router.get("/school/{child_id}/csv")
async def export_school_csv(child_id: str, request: Request, term_id: str = None):
    current = await get_current_user(request)
    if current["role"] not in ["parent", "superadmin"]:
        raise HTTPException(403, "Only parents can export")
    family_id = current.get("family_id")
    query = {"child_id": child_id, "family_id": family_id}
    if term_id:
        query["term_id"] = term_id
    lessons = await db.lessons.find(query, {"_id": 0}).sort("planned_date", 1).to_list(10000)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Date", "Subject", "Title", "Status", "Notes", "Completed At"])
    for l in lessons:
        writer.writerow([
            l.get("planned_date", ""), l.get("subject_name", ""),
            l.get("title", ""), l.get("status", ""),
            l.get("notes", ""), l.get("completed_at", "")
        ])
    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=school_report_{child_id}.csv"}
    )

@router.get("/school/{child_id}/pdf")
async def export_school_pdf(child_id: str, request: Request, term_id: str = None):
    current = await get_current_user(request)
    if current["role"] not in ["parent", "superadmin"]:
        raise HTTPException(403, "Only parents can export")
    family_id = current.get("family_id")
    child = await db.children.find_one({"id": child_id}, {"_id": 0})
    if not child:
        raise HTTPException(404, "Child not found")
    query = {"child_id": child_id, "family_id": family_id}
    if term_id:
        query["term_id"] = term_id
    lessons = await db.lessons.find(query, {"_id": 0}).sort("planned_date", 1).to_list(10000)
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4)
    styles = getSampleStyleSheet()
    elements = []
    elements.append(Paragraph(f"BOMA - Term Summary Report", styles['Title']))
    elements.append(Paragraph(f"Student: {child['name']}", styles['Heading2']))
    total = len(lessons)
    done = len([l for l in lessons if l["status"] == "done"])
    rate = round(done / total * 100, 1) if total > 0 else 0
    elements.append(Paragraph(f"Total Lessons: {total} | Completed: {done} | Rate: {rate}%", styles['Normal']))
    elements.append(Spacer(1, 20))
    data = [["Date", "Subject", "Title", "Status"]]
    for l in lessons[:200]:
        data.append([
            l.get("planned_date", ""), l.get("subject_name", ""),
            l.get("title", "")[:40], l.get("status", "")
        ])
    if data:
        table = Table(data, colWidths=[80, 100, 200, 80])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#2D4F3F")),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor("#FDFBF7")),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#E8D5B5")),
            ('FONTSIZE', (0, 1), (-1, -1), 8),
            ('TOPPADDING', (0, 1), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 4),
        ]))
        elements.append(table)
    doc.build(elements)
    buffer.seek(0)
    return StreamingResponse(
        buffer, media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=term_summary_{child['name']}.pdf"}
    )

@router.get("/chores/{child_id}")
async def chores_report(child_id: str, request: Request):
    current = await get_current_user(request)
    family_id = current.get("family_id")
    instances = await db.chore_instances.find(
        {"child_id": child_id, "family_id": family_id}, {"_id": 0}
    ).to_list(10000)
    total = len(instances)
    done = len([i for i in instances if i["status"] in ["done", "approved"]])
    pending = len([i for i in instances if i["status"] == "pending"])
    total_points = sum(i.get("points", 0) for i in instances if i["status"] in ["done", "approved"])
    return {
        "total": total, "done": done, "pending": pending,
        "completion_rate": round(done / total * 100, 1) if total > 0 else 0,
        "total_points": total_points
    }

@router.get("/allowance/{child_id}")
async def allowance_report(child_id: str, request: Request):
    current = await get_current_user(request)
    family_id = current.get("family_id")
    entries = await db.wallet_entries.find(
        {"child_id": child_id, "family_id": family_id, "status": "approved"}, {"_id": 0}
    ).to_list(10000)
    total_credits = sum(e["amount"] for e in entries if e["type"] == "credit")
    total_debits = sum(e["amount"] for e in entries if e["type"] == "debit")
    return {
        "total_credits": round(total_credits, 2),
        "total_debits": round(total_debits, 2),
        "net": round(total_credits - total_debits, 2),
        "entry_count": len(entries)
    }
