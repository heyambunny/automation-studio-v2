"""Background runner for scheduled campaigns.

A Schedule row stores the full campaign request (as JSON, the same shape the
wizard sends to /campaigns/execute-now, including the already-uploaded
campaign_folder) plus a frequency and a next_run timestamp. Every minute this
polls for schedules whose next_run has passed, runs them through the same
run_campaign() the "Send Now" button uses, then either advances next_run
(daily/weekly/monthly) or disables the schedule (once).

next_run is stored and compared as naive local time - matching the value the
browser's <input type="datetime-local"> sends, so "the time picked in the UI"
is "the time it fires on this machine".

Known limitation: recurring schedules resend the same branch files every time
(there is no mechanism to refresh them automatically) - useful for a fixed
recurring notice, not for numbers that change daily. "Once" schedules are the
well-supported case: upload now, send later.
"""
import json
from datetime import datetime, timedelta

from apscheduler.schedulers.background import BackgroundScheduler

from app.core.database import SessionLocal
from app.models import Schedule

_scheduler = BackgroundScheduler()
_started = False


def _advance_next_run(current: datetime, frequency: str):
    if frequency == "daily":
        return current + timedelta(days=1)
    if frequency == "weekly":
        return current + timedelta(weeks=1)
    if frequency == "monthly":
        month = current.month + 1
        year = current.year
        if month > 12:
            month = 1
            year += 1
        day = min(current.day, 28)  # safe for all months, avoids day-31 overflow
        return current.replace(year=year, month=month, day=day)
    return None  # "once" - no further runs


def run_due_schedules():
    # Local import: avoids a circular import at module load time (this module
    # is imported by main.py, campaigns_execute imports app.core modules too).
    from app.api.v1.campaigns_execute import CampaignExecuteRequest, run_campaign

    db = SessionLocal()
    try:
        now = datetime.now()
        due = (
            db.query(Schedule)
            .filter(Schedule.enabled == True, Schedule.next_run <= now)  # noqa: E712
            .all()
        )
        for sched in due:
            try:
                config = json.loads(sched.campaign_config)
                request = CampaignExecuteRequest(**config)
                run_campaign(db, sched.user_id, request)
                print(f"Schedule {sched.id} ({sched.schedule_name!r}) ran")
            except Exception as e:  # noqa: BLE001 - one bad schedule must not block the rest
                print(f"Schedule {sched.id} ({sched.schedule_name!r}) failed: {e}")

            nxt = _advance_next_run(sched.next_run, sched.frequency)
            if nxt:
                sched.next_run = nxt
            else:
                sched.enabled = False
            db.commit()
    finally:
        db.close()


def start_scheduler():
    global _started
    if _started:
        return
    _scheduler.add_job(run_due_schedules, "interval", minutes=1, id="run_due_schedules", replace_existing=True)
    _scheduler.start()
    _started = True
