"""Weekly email to admins: what went out, what failed, what was overridden, who
joined, sign-in trouble, and whether the server's backups are healthy."""
import glob
import html
import os
import shutil
from collections import Counter
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import AuditLog, EmailLog, Execution, SMTPProfile, User, UserRole

BACKUP_STALE_AFTER = timedelta(hours=36)


def _latest_backup():
    files = sorted(glob.glob(os.path.join(settings.BACKUP_DIR, "*.dump")), key=os.path.getmtime)
    if not files:
        return None
    newest = files[-1]
    return {
        "name": os.path.basename(newest),
        "size": os.path.getsize(newest),
        "at": datetime.fromtimestamp(os.path.getmtime(newest)),
        "count": len(files),
    }


def collect_digest(db: Session, now: datetime = None, days: int = 7) -> dict:
    now = now or datetime.utcnow()
    since = now - timedelta(days=days)

    executions = db.query(Execution).filter(Execution.created_at >= since).order_by(Execution.created_at.desc()).all()
    names = {u.id: (u.full_name or u.email) for u in db.query(User).all()}
    campaigns = [{
        "name": e.campaign_name or "Campaign",
        "by": names.get(e.user_id, "Unknown"),
        "sent": e.sent_count or 0,
        "failed": e.failed_count or 0,
        "at": e.created_at,
    } for e in executions]

    failures = (
        db.query(EmailLog.branch_name, EmailLog.error_message)
        .filter(EmailLog.status == "failed", EmailLog.attempted_at >= since)
        .all()
    )
    failure_reasons = Counter((msg or "Unknown error")[:110] for _, msg in failures)

    def audit(*actions):
        return db.query(AuditLog).filter(AuditLog.action.in_(actions), AuditLog.created_at >= since).order_by(AuditLog.created_at.desc()).all()

    warnings = audit("campaign.recipient_warnings")
    failed_logins = audit("auth.login_failed")
    lockouts = audit("auth.login_locked")
    new_users = db.query(User).filter(User.created_at >= since).all()

    disk = shutil.disk_usage("/")
    return {
        "since": since,
        "now": now,
        "campaigns": campaigns,
        "campaign_count": len(campaigns),
        "emails_sent": sum(c["sent"] for c in campaigns),
        "emails_failed": sum(c["failed"] for c in campaigns),
        "active_senders": len({c["by"] for c in campaigns}),
        "failure_reasons": failure_reasons.most_common(5),
        "warnings": [{"at": w.created_at, "details": w.details or ""} for w in warnings],
        "failed_logins": len(failed_logins),
        "lockouts": len(lockouts),
        "new_users": [u.full_name or u.email for u in new_users],
        "backup": _latest_backup(),
        "disk_used_pct": round(disk.used / disk.total * 100),
    }


def _e(value) -> str:
    return html.escape(str(value))


def _tile(label, value, color="#0A0A0A", bg="#fafafa"):
    return (
        f'<td width="33%" align="center" style="padding:14px 6px;background:{bg};border-radius:12px;">'
        f'<div style="font-size:22px;font-weight:700;color:{color};">{_e(value)}</div>'
        f'<div style="font-size:11px;color:{color};opacity:.75;margin-top:2px;">{_e(label)}</div></td>'
    )


def _section(title, body_html):
    return (
        '<tr><td style="padding:18px 32px 0 32px;">'
        f'<p style="margin:0 0 8px 0;font-size:13px;font-weight:700;color:#27272a;">{_e(title)}</p>{body_html}</td></tr>'
    )


def _rows(items):
    return "".join(
        f'<tr><td style="padding:7px 0;border-bottom:1px solid #f4f4f5;font-size:12px;color:#3f3f46;">{cells}</td></tr>'
        for cells in items
    )


def _list(rows_html):
    return f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0">{rows_html}</table>'


def build_digest_email(data: dict) -> str:
    span = f"{data['since']:%d %b} – {data['now']:%d %b %Y}"
    sections = []

    if data["campaigns"]:
        shown = data["campaigns"][:8]
        items = [
            f'<b>{_e(c["name"])}</b> &middot; {_e(c["by"])} &middot; '
            f'<span style="color:#059669;">{c["sent"]} sent</span>'
            + (f' &middot; <span style="color:#dc2626;">{c["failed"]} failed</span>' if c["failed"] else "")
            + f' &middot; <span style="color:#a1a1aa;">{c["at"]:%d %b}</span>'
            for c in shown
        ]
        more = f'<p style="margin:6px 0 0 0;font-size:11px;color:#a1a1aa;">+{len(data["campaigns"]) - len(shown)} more in History</p>' if len(data["campaigns"]) > len(shown) else ""
        sections.append(_section("Campaigns this week", _list(_rows(items)) + more))
    else:
        sections.append(_section("Campaigns this week", '<p style="margin:0;font-size:12px;color:#71717a;">No campaigns were sent.</p>'))

    attention = []
    for reason, count in data["failure_reasons"]:
        attention.append(f'<span style="color:#dc2626;">{count}&times;</span> failed: {_e(reason)}')
    if data["warnings"]:
        attention.append(
            f'<b>{len(data["warnings"])}</b> campaign(s) sent or scheduled with recipient warnings still open'
            f'<br><span style="color:#71717a;">{_e(data["warnings"][0]["details"][:160])}</span>'
        )
    if data["failed_logins"] or data["lockouts"]:
        attention.append(f'<b>{data["failed_logins"]}</b> failed sign-in(s), <b>{data["lockouts"]}</b> account lock(s)')
    backup = data["backup"]
    if backup is None:
        attention.append("No database backup was found on this server.")
    elif datetime.now() - backup["at"] > BACKUP_STALE_AFTER:
        attention.append(f'Latest database backup is <b>stale</b> ({backup["at"]:%d %b %H:%M}).')
    if data["disk_used_pct"] >= 80:
        attention.append(f'Server disk is <b>{data["disk_used_pct"]}%</b> full.')
    if attention:
        sections.append(_section("Needs attention", _list(_rows(attention))))
    else:
        sections.append(_section("Needs attention", '<p style="margin:0;font-size:12px;color:#059669;">Nothing - no failures, warnings or sign-in trouble.</p>'))

    team = [f'<b>{data["active_senders"]}</b> member(s) sent campaigns']
    team.append("New members: " + (", ".join(_e(n) for n in data["new_users"]) if data["new_users"] else "none"))
    sections.append(_section("Team", _list(_rows(team))))

    if backup:
        fresh = datetime.now() - backup["at"] <= BACKUP_STALE_AFTER
        server = [
            f'Backup: <b style="color:{"#059669" if fresh else "#dc2626"};">{"OK" if fresh else "STALE"}</b> &middot; '
            f'{backup["at"]:%d %b %H:%M} &middot; {backup["size"] / 1_048_576:.1f} MB &middot; {backup["count"]} kept',
            f'Disk used: {data["disk_used_pct"]}%',
        ]
        sections.append(_section("Server", _list(_rows(server))))

    link = f"{settings.FRONTEND_URL}/audit-log"
    return f"""
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:32px 0;font-family:-apple-system,'Segoe UI',Arial,sans-serif;">
      <tr><td align="center">
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;">
          <tr><td style="background:#0A0A0A;padding:24px 32px;">
            <span style="color:#ffffff;font-size:18px;font-weight:700;">📊 Automation Studio - weekly digest</span>
            <div style="color:#a1a1aa;font-size:12px;margin-top:4px;">{_e(span)}</div>
          </td></tr>
          <tr><td style="padding:22px 32px 0 32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
              {_tile("Campaigns", data["campaign_count"])}<td width="2%"></td>
              {_tile("Emails sent", data["emails_sent"], "#059669", "#ecfdf5")}<td width="2%"></td>
              {_tile("Failed", data["emails_failed"], "#dc2626" if data["emails_failed"] else "#71717a", "#fef2f2" if data["emails_failed"] else "#f4f4f5")}
            </tr></table>
          </td></tr>
          {"".join(sections)}
          <tr><td style="padding:22px 32px 28px 32px;">
            <a href="{link}" style="display:block;text-align:center;background:#0A0A0A;color:#ffffff;text-decoration:none;padding:13px 0;border-radius:10px;font-size:14px;font-weight:600;">Open Audit Log &rarr;</a>
            <p style="margin:14px 0 0 0;color:#a1a1aa;font-size:11px;text-align:center;">Sent to admins every Monday morning.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
    """


def send_weekly_digest(db: Session, only_to: str = None) -> dict:
    """Email the digest to every active admin (or just only_to, for a preview)."""
    # Imported here: campaigns_execute pulls in the whole send pipeline.
    from app.api.v1.campaigns_execute import send_email, _smtp_config_from_profile

    profile = db.query(SMTPProfile).filter_by(id=settings.PASSWORD_RESET_SMTP_PROFILE_ID).first() if settings.PASSWORD_RESET_SMTP_PROFILE_ID else None
    if not profile:
        return {"success": False, "message": "No system mail profile is configured (PASSWORD_RESET_SMTP_PROFILE_ID)"}

    if only_to:
        recipients = [only_to]
    else:
        admins = db.query(User).filter(User.role == UserRole.ADMIN, User.is_active == "Y").all()
        recipients = [a.email for a in admins if a.email]
    if not recipients:
        return {"success": False, "message": "No admin has an email address"}

    data = collect_digest(db)
    subject = f"📊 Weekly digest: {data['campaign_count']} campaign(s), {data['emails_sent']} emails sent"
    if data["emails_failed"]:
        subject += f", {data['emails_failed']} failed"
    result = send_email(_smtp_config_from_profile(profile), recipients, subject, build_digest_email(data), copy_sender=False)
    return {**result, "recipients": recipients}
