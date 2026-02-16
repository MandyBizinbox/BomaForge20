from fastapi import FastAPI
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

app = FastAPI(title="BOMA API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

from routes.auth import router as auth_router
from routes.families import router as families_router
from routes.children import router as children_router
from routes.curriculum import router as curriculum_router
from routes.chores import router as chores_router
from routes.messaging import router as messaging_router
from routes.allowance import router as allowance_router
from routes.reports import router as reports_router
from routes.notifications import router as notifications_router
from routes.admin import router as admin_router
from routes.billing import router as billing_router
from routes.email import router as email_router
from routes.streaks import router as streaks_router

app.include_router(auth_router)
app.include_router(families_router)
app.include_router(children_router)
app.include_router(curriculum_router)
app.include_router(chores_router)
app.include_router(messaging_router)
app.include_router(allowance_router)
app.include_router(reports_router)
app.include_router(notifications_router)
app.include_router(admin_router)
app.include_router(billing_router)
app.include_router(email_router)
app.include_router(streaks_router)

@app.get("/api")
async def root():
    return {"message": "BOMA API", "version": "1.0.0"}

@app.get("/api/health")
async def health():
    return {"status": "ok"}

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

from database import client

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
