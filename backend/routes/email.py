from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from datetime import datetime, timezone
from database import db
from middleware import get_current_user
import asyncio
import logging
import uuid

router = APIRouter(prefix="/api/email", tags=["email"])
logger = logging.getLogger(__name__)

class SendEmailRequest(BaseModel):
    recipient_email: str
    subject: str
    html_content: str

class SendNotificationEmailRequest(BaseModel):
    user_id: str
    template: str  # lesson_reminder, chore_reminder, message_alert, report_ready
    data: dict = {}

EMAIL_TEMPLATES = {
    "lesson_reminder": lambda d: {
        "subject": f"BOMA: {d.get('child_name', 'Your child')} has lessons today",
        "html": f"""<div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#FDFBF7;padding:32px;border-radius:16px;">
            <h1 style="color:#2D4F3F;font-size:24px;">Lesson Reminder</h1>
            <p style="color:#2A2A2A;">{d.get('child_name', 'Your child')} has <strong>{d.get('count', 0)} lessons</strong> scheduled for today.</p>
            <a href="{d.get('app_url', '#')}/today" style="display:inline-block;background:#2D4F3F;color:white;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:bold;margin-top:16px;">View Today's Plan</a>
            <p style="color:#aaa;font-size:12px;margin-top:24px;">BOMA - The Homeschool Hearth</p>
        </div>"""
    },
    "chore_reminder": lambda d: {
        "subject": f"BOMA: {d.get('child_name', 'Your child')} has chores today",
        "html": f"""<div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#FDFBF7;padding:32px;border-radius:16px;">
            <h1 style="color:#C06C47;font-size:24px;">Chore Reminder</h1>
            <p style="color:#2A2A2A;">{d.get('child_name', 'Your child')} has <strong>{d.get('count', 0)} chores</strong> to complete today.</p>
            <a href="{d.get('app_url', '#')}/chores" style="display:inline-block;background:#C06C47;color:white;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:bold;margin-top:16px;">View Chores</a>
            <p style="color:#aaa;font-size:12px;margin-top:24px;">BOMA - The Homeschool Hearth</p>
        </div>"""
    },
    "message_alert": lambda d: {
        "subject": f"BOMA: New message from {d.get('sender_name', 'someone')}",
        "html": f"""<div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#FDFBF7;padding:32px;border-radius:16px;">
            <h1 style="color:#2D4F3F;font-size:24px;">New Message</h1>
            <p style="color:#2A2A2A;"><strong>{d.get('sender_name', 'Someone')}</strong> sent you a message in <strong>{d.get('conversation_name', 'a chat')}</strong>.</p>
            <a href="{d.get('app_url', '#')}/messages" style="display:inline-block;background:#2D4F3F;color:white;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:bold;margin-top:16px;">Open Messages</a>
            <p style="color:#aaa;font-size:12px;margin-top:24px;">BOMA - The Homeschool Hearth</p>
        </div>"""
    },
    "report_ready": lambda d: {
        "subject": f"BOMA: Report ready for {d.get('child_name', 'your child')}",
        "html": f"""<div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#FDFBF7;padding:32px;border-radius:16px;">
            <h1 style="color:#2D4F3F;font-size:24px;">Report Ready</h1>
            <p style="color:#2A2A2A;">A new report for <strong>{d.get('child_name', 'your child')}</strong> is ready to view.</p>
            <a href="{d.get('app_url', '#')}/reports" style="display:inline-block;background:#2D4F3F;color:white;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:bold;margin-top:16px;">View Reports</a>
            <p style="color:#aaa;font-size:12px;margin-top:24px;">BOMA - The Homeschool Hearth</p>
        </div>"""
    }
}

async def _get_resend_config():
    settings = await db.admin_settings.find_one({"type": "api_keys"}, {"_id": 0})
    if settings and settings.get("resend_api_key"):
        return settings["resend_api_key"], settings.get("sender_email", "onboarding@resend.dev")
    return None, None

async def send_email_internal(to: str, subject: str, html: str):
    """Send email using Resend if configured, otherwise log as stub."""
    api_key, sender = await _get_resend_config()
    if api_key:
        try:
            import resend
            resend.api_key = api_key
            params = {"from": sender, "to": [to], "subject": subject, "html": html}
            result = await asyncio.to_thread(resend.Emails.send, params)
            logger.info(f"Email sent to {to}: {result}")
            await db.email_log.insert_one({
                "id": str(uuid.uuid4()), "to": to, "subject": subject,
                "status": "sent", "provider": "resend", "email_id": result.get("id"),
                "created_at": datetime.now(timezone.utc).isoformat()
            })
            return {"status": "sent", "email_id": result.get("id")}
        except Exception as e:
            logger.error(f"Email send failed: {e}")
            await db.email_log.insert_one({
                "id": str(uuid.uuid4()), "to": to, "subject": subject,
                "status": "failed", "error": str(e),
                "created_at": datetime.now(timezone.utc).isoformat()
            })
            return {"status": "failed", "error": str(e)}
    else:
        logger.info(f"[STUB EMAIL] To: {to}, Subject: {subject}")
        await db.email_log.insert_one({
            "id": str(uuid.uuid4()), "to": to, "subject": subject,
            "status": "stub", "provider": "stub",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        return {"status": "stub", "message": "No Resend API key configured - email logged but not sent"}

@router.post("/send")
async def send_email(req: SendEmailRequest, request: Request):
    current = await get_current_user(request)
    if current["role"] not in ["parent", "superadmin"]:
        raise HTTPException(403, "Only parents/admins can send emails")
    result = await send_email_internal(req.recipient_email, req.subject, req.html_content)
    return result

@router.post("/notify")
async def send_notification_email(req: SendNotificationEmailRequest, request: Request):
    current = await get_current_user(request)
    user = await db.users.find_one({"id": req.user_id}, {"_id": 0})
    if not user:
        raise HTTPException(404, "User not found")
    template_fn = EMAIL_TEMPLATES.get(req.template)
    if not template_fn:
        raise HTTPException(400, f"Unknown template: {req.template}")
    email_data = template_fn(req.data)
    result = await send_email_internal(user["email"], email_data["subject"], email_data["html"])
    return result

@router.get("/log")
async def get_email_log(request: Request, limit: int = 50):
    current = await get_current_user(request)
    if current["role"] != "superadmin":
        raise HTTPException(403, "SuperAdmin only")
    logs = await db.email_log.find({}, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return {"logs": logs}
