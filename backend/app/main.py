from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.scheduler import start_scheduler
from app.api.v1 import auth, dashboard as dashboard_api, settings as settings_api, mappings as mappings_api, templates as templates_api, executions as executions_api, schedules as schedules_api, campaigns as campaigns_api, data_browser as data_browser_api, users as users_api, games as games_api, campaigns_execute as campaigns_execute_api, notifications as notifications_api, announcements as announcements_api, audit_logs as audit_logs_api

app = FastAPI(title="Automation Studio API", version="2.0.0")

@app.on_event("startup")
def _on_startup():
    start_scheduler()

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1")
app.include_router(dashboard_api.router, prefix="/api/v1")
app.include_router(settings_api.router, prefix="/api/v1")
app.include_router(mappings_api.router, prefix="/api/v1")
app.include_router(templates_api.router, prefix="/api/v1")
app.include_router(executions_api.router, prefix="/api/v1")
app.include_router(schedules_api.router, prefix="/api/v1")
app.include_router(campaigns_api.router, prefix="/api/v1")
app.include_router(data_browser_api.router, prefix="/api/v1")
app.include_router(users_api.router, prefix="/api/v1")
app.include_router(games_api.router, prefix="/api/v1")
app.include_router(campaigns_execute_api.router, prefix="/api/v1")
app.include_router(users_api.router, prefix="/api/v1")
app.include_router(games_api.router, prefix="/api/v1")
app.include_router(campaigns_execute_api.router, prefix="/api/v1")
app.include_router(notifications_api.router, prefix="/api/v1")
app.include_router(announcements_api.router, prefix="/api/v1")
app.include_router(audit_logs_api.router, prefix="/api/v1")

@app.get("/")
def root():
    return {"message": "Automation Studio API", "docs": "/docs"}
