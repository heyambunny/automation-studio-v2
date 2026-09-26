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

A second job, send_upcoming_reminders(), polls the same table for schedules
about to fire in the next 15 minutes and emails a "starting soon" heads-up
once per occurrence - separate from the "scheduled" confirmation email sent
at creation time (schedules.py) and the "completed" summary email sent after
run_campaign() finishes (campaigns_execute.py).
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


def send_upcoming_reminders():
    """Every schedule due in the next 15 minutes gets a "starting soon" email,
    once per occurrence - last_reminder_sent_for tracks which next_run value
    was last reminded about, so a recurring schedule gets a fresh reminder
    each time it's advanced instead of being reminded once and never again."""
    from app.models import SMTPProfile, Setting, User
    from app.api.v1.campaigns_execute import send_email, _build_schedule_reminder_email, _smtp_config_from_profile
    from app.services.mascot_service import generate_bounce_gif

    db = SessionLocal()
    try:
        now = datetime.now()
        window_end = now + timedelta(minutes=15)
        upcoming = (
            db.query(Schedule)
            .filter(Schedule.enabled == True, Schedule.next_run > now, Schedule.next_run <= window_end)  # noqa: E712
            .all()
        )
        for sched in upcoming:
            if sched.last_reminder_sent_for == sched.next_run:
                continue
            try:
                setting = db.query(Setting).filter_by(user_id=sched.user_id).first()
                notify_enabled = setting.notify_on_completion if (setting and setting.notify_on_completion is not None) else True
                if notify_enabled:
                    user = db.query(User).filter_by(id=sched.user_id).first()
                    config = json.loads(sched.campaign_config)
                    profile = db.query(SMTPProfile).filter_by(profile_name=config.get("smtp_profile")).first()
                    if user and user.email and profile:
                        body = _build_schedule_reminder_email(sched.schedule_name, sched.next_run)
                        mascot = generate_bounce_gif((180, 83, 9), "excited")
                        send_email(_smtp_config_from_profile(profile), [user.email], f"⏰ \"{sched.schedule_name}\" starts in 15 minutes", body, inline_images=[("mascot", mascot)])
            except Exception as e:  # noqa: BLE001 - one bad reminder must not block the rest
                print(f"Reminder for schedule {sched.id} ({sched.schedule_name!r}) failed: {e}")

            sched.last_reminder_sent_for = sched.next_run
            db.commit()
    finally:
        db.close()


def start_scheduler():
    global _started
    if _started:
        return
    _scheduler.add_job(run_due_schedules, "interval", minutes=1, id="run_due_schedules", replace_existing=True)
    _scheduler.add_job(send_upcoming_reminders, "interval", minutes=1, id="send_upcoming_reminders", replace_existing=True)
    _scheduler.start()
    _started = True
