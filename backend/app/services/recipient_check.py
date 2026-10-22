"""Pre-send sanity check on a mapping's recipients, compared with what past
campaigns actually sent (email_logs). Warn-only: it never blocks a send.

A mapping is just rows of branch -> To/CC. If someone sorts only the branch
column before uploading, every branch silently gets another branch's people,
and nothing in the app notices. These checks catch that shape of mistake:

  person_moved         - a To address that earlier campaigns sent under other
                         branches now sits under a branch it never had
  recipients_replaced  - a branch's To list shares nobody with the last run of
                         the same report (recipients_changed = partial overlap)
  duplicate_recipients - different branches with an identical To list
  double_send          - the same report went out with this mapping a few hours ago
  new_domain           - a recipient's email domain no earlier campaign ever used
  missing_files / file_mismatch - see campaign_file_check.py (needs the upload folder)

History is scoped like everything else in the app: admins are compared against
every past send, everyone else against their own.
"""
import hashlib
import json
import re
from collections import Counter, defaultdict
from datetime import datetime, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.audit import log_audit
from app.services.notify import notify_admins
from app.models import EmailLog, Execution, Mapping, MappingEntry, User
from app.services.campaign_file_check import check_files, resolve_campaign_folder

# An address attached to this many branches (current mapping or history) is a
# regional/national head or a shared list, not a branch salesperson.
SHARED_BRANCH_LIMIT = 4
DOUBLE_SEND_HOURS = 6
# A domain can only be called "new" once there's enough history to know what's usual.
NEW_DOMAIN_MIN_CAMPAIGNS = 3
_MAX_NEW_DOMAINS_LISTED = 5

_FILE_EXT_RE = re.compile(r"\.(xlsx|xls|xlsb|csv)$", re.IGNORECASE)


def _branch_key(name) -> str:
    return re.sub(r"\s+", " ", _FILE_EXT_RE.sub("", str(name or "")).strip()).lower()


def _emails(value) -> list:
    out = []
    for part in re.split(r"[;,]", str(value or "")):
        email = part.strip().lower()
        if email and email != "nan":
            out.append(email)
    return out


def recipient_fingerprint(emails) -> str:
    """Order- and case-insensitive checksum of a recipient list."""
    return hashlib.sha256(",".join(sorted({str(e).strip().lower() for e in emails})).encode("utf-8")).hexdigest()[:10]


def mapping_checksum(db: Session, mapping_id: int) -> str:
    entries = db.query(MappingEntry).filter_by(mapping_id=mapping_id).all()
    lines = sorted(
        f"{_branch_key(e.branch_name)}|{recipient_fingerprint(_emails(e.to_recipients))}|{recipient_fingerprint(_emails(e.cc_recipients))}"
        for e in entries
    )
    return hashlib.sha256("\n".join(lines).encode("utf-8")).hexdigest()[:12]


def _short(items, limit=3) -> str:
    items = list(items)
    text = ", ".join(items[:limit])
    return text + (f" +{len(items) - limit} more" if len(items) > limit else "")


def _domain(email: str) -> str:
    return email.rsplit("@", 1)[1] if "@" in email else ""


def _ago(delta: timedelta) -> str:
    minutes = max(1, int(delta.total_seconds() // 60))
    if minutes < 60:
        return f"{minutes} minute{'s' if minutes != 1 else ''} ago"
    hours = round(minutes / 60)
    return f"{hours} hour{'s' if hours != 1 else ''} ago"


def _recent_duplicate_sends(db: Session, mapping_id: int, report_type: str, user_id: int, role: str) -> list:
    report_key = (report_type or "").strip().lower()
    if not report_key:
        return []
    now = datetime.utcnow()
    query = db.query(Execution).filter(
        Execution.created_at >= now - timedelta(hours=DOUBLE_SEND_HOURS),
        func.lower(func.trim(Execution.campaign_name)) == report_key,
    )
    if role != "admin":
        query = query.filter(Execution.user_id == user_id)
    found = []
    for e in query.order_by(Execution.created_at.desc()).all():
        status = e.status.value if hasattr(e.status, "value") else e.status
        if status not in ("completed", "in_progress"):
            continue
        try:
            if json.loads(e.campaign_config or "{}").get("mapping_id") != mapping_id:
                continue
        except ValueError:
            continue
        who = ""
        if e.user_id != user_id:
            sender = db.query(User).filter_by(id=e.user_id).first()
            who = f" by {sender.full_name or sender.email}" if sender else ""
        state = "is still sending" if status == "in_progress" else f"went out {_ago(now - e.created_at)}"
        found.append(f"{state}{who} ({e.sent_count or 0} of {e.total_emails or 0} emails sent)")
    return found


def check_mapping(db: Session, mapping_id: int, report_type: str, user_id: int, role: str,
                  campaign_folder=None, deep_files: bool = True) -> dict:
    entries = db.query(MappingEntry).filter_by(mapping_id=mapping_id).order_by(MappingEntry.id).all()

    history = (
        db.query(EmailLog.branch_name, EmailLog.recipient_to, EmailLog.recipient_cc, Execution.id, Execution.campaign_name, Execution.created_at)
        .join(Execution, EmailLog.execution_id == Execution.id)
        .filter(EmailLog.status == "sent")
    )
    if role != "admin":
        history = history.filter(Execution.user_id == user_id)

    report_key = (report_type or "").strip().lower()
    display = {}
    person_history = defaultdict(Counter)  # email -> Counter(branch_key)
    last_run = {}  # branch_key -> (created_at, set(emails)) for this same report
    runs_with_list = defaultdict(set)  # (branch_key, fingerprint) -> execution ids that sent exactly that list
    history_campaigns = set()
    seen_domains = set()
    for branch_name, recipient_to, recipient_cc, execution_id, campaign_name, created_at in history.all():
        key = _branch_key(branch_name)
        display.setdefault(key, branch_name)
        history_campaigns.add(execution_id)
        emails = _emails(recipient_to)
        seen_domains.update(_domain(e) for e in emails + _emails(recipient_cc))
        runs_with_list[(key, recipient_fingerprint(emails))].add(execution_id)
        for email in emails:
            person_history[email][key] += 1
        if report_key and (campaign_name or "").strip().lower() == report_key:
            if key not in last_run or created_at > last_run[key][0]:
                last_run[key] = (created_at, set(emails))

    current = {}  # branch_key -> set(To emails)
    for e in entries:
        key = _branch_key(e.branch_name)
        display[key] = e.branch_name
        current[key] = set(_emails(e.to_recipients))

    issues = []

    # person_moved: a To address that earlier campaigns sent under other branches
    branches_by_person = defaultdict(set)
    for key, emails in current.items():
        for email in emails:
            branches_by_person[email].add(key)
    moved = defaultdict(list)
    for email, now_branches in branches_by_person.items():
        past = person_history.get(email)
        if not past or len(past) >= SHARED_BRANCH_LIMIT or len(now_branches) >= SHARED_BRANCH_LIMIT:
            continue
        if now_branches & set(past):
            continue
        previously = [display[k] for k, _ in past.most_common(3)]
        for key in now_branches:
            moved[key].append({"email": email, "previously": previously})
    for key, people in moved.items():
        sample = people[0]
        issues.append({
            "type": "person_moved",
            "severity": "warn",
            "branch": display[key],
            "message": (
                f"{len(people)} of {len(current[key])} recipient(s) for {display[key]} were earlier sent other branches' "
                f"reports - e.g. {sample['email']} (was {_short(sample['previously'])})."
            ),
            "details": people,
        })

    # recipients_replaced / recipients_changed: vs the last run of this report
    for key, now in current.items():
        previous = last_run.get(key)
        if not previous or not previous[1] or not now:
            continue
        if key in moved:
            continue  # the person_moved card already explains this branch
        before_at, before = previous
        if recipient_fingerprint(before) == recipient_fingerprint(now):
            continue
        added, removed = sorted(now - before), sorted(before - now)
        when = before_at.strftime("%d %b %Y")
        if not (now & before):
            issues.append({
                "type": "recipients_replaced",
                "severity": "warn",
                "branch": display[key],
                "message": f"All recipients for {display[key]} are different from the last '{report_type}' run ({when}): was {_short(sorted(before))}.",
                "details": {"added": added, "removed": removed},
            })
        else:
            issues.append({
                "type": "recipients_changed",
                "severity": "info",
                "branch": display[key],
                "message": f"{display[key]}: {len(added)} added, {len(removed)} removed since the last '{report_type}' run ({when}).",
                "details": {"added": added, "removed": removed},
            })

    # duplicate_recipients: different branches with an identical To list
    groups = defaultdict(list)
    for key, emails in current.items():
        if emails:
            groups[frozenset(emails)].append(key)
    for emails, keys in groups.items():
        if not 1 < len(keys) < len(current):
            continue
        # A list that two or more past sends already used for each of these
        # branches is a deliberate regional list, not a fresh mistake.
        fp = recipient_fingerprint(emails)
        if all(len(runs_with_list.get((k, fp), ())) >= 2 for k in keys):
            continue
        branches = [display[k] for k in keys]
        issues.append({
            "type": "duplicate_recipients",
            "severity": "warn",
            "branch": branches[0],
            "message": f"{_short(branches, 4)} have the exact same recipients ({len(emails)}).",
            "details": {"branches": branches},
        })

    # double_send: this report already went out with this mapping a few hours ago
    for description in _recent_duplicate_sends(db, mapping_id, report_type, user_id, role):
        issues.append({
            "type": "double_send",
            "severity": "warn",
            "branch": "Already sent",
            "message": f"'{report_type}' already {description} with this same mapping. Sending again will email every branch a second time.",
            "details": {},
        })

    # new_domain: a recipient domain no earlier campaign has used
    if len(history_campaigns) >= NEW_DOMAIN_MIN_CAMPAIGNS:
        addresses_by_domain = defaultdict(set)
        for e in entries:
            for email in _emails(e.to_recipients) + _emails(e.cc_recipients):
                d = _domain(email)
                if d and d not in seen_domains:
                    addresses_by_domain[d].add(email)
        for domain in sorted(addresses_by_domain)[:_MAX_NEW_DOMAINS_LISTED]:
            people = sorted(addresses_by_domain[domain])
            issues.append({
                "type": "new_domain",
                "severity": "warn",
                "branch": domain,
                "message": f"{len(people)} recipient(s) at \"{domain}\", a domain no earlier campaign has emailed: {_short(people)}. Check for a typo or a wrong company.",
                "details": {"domain": domain, "emails": people},
            })
        if len(addresses_by_domain) > _MAX_NEW_DOMAINS_LISTED:
            issues.append({
                "type": "new_domain",
                "severity": "warn",
                "branch": "More new domains",
                "message": f"{len(addresses_by_domain) - _MAX_NEW_DOMAINS_LISTED} more never-used domain(s) are in this mapping.",
                "details": {},
            })

    # missing_files / file_mismatch: needs the uploaded folder
    files_checked = files_total = 0
    folder = resolve_campaign_folder(campaign_folder)
    if folder:
        branches = [_FILE_EXT_RE.sub("", e.branch_name or "") for e in entries]
        file_result = check_files(folder, branches, deep=deep_files)
        issues.extend(file_result["issues"])
        files_checked, files_total = file_result["files_checked"], file_result["files_total"]

    issues.sort(key=lambda i: (i["severity"] != "warn", i["branch"].lower()))
    return {
        "mapping_checksum": mapping_checksum(db, mapping_id),
        "entries": len(entries),
        "files_checked": files_checked,
        "files_total": files_total,
        "history_campaigns": len(history_campaigns),
        "warn_count": sum(1 for i in issues if i["severity"] == "warn"),
        "issues": issues,
    }


def audit_recipient_warnings(db: Session, user_id: int, role: str, mapping_id, report_type: str, action: str, campaign_folder=None):
    """Record that a campaign went out (or was scheduled) while the check had
    open warnings - computed server-side, so it holds whether or not the UI
    showed the dialog. Never raises; the send must not depend on it."""
    if not mapping_id:
        return
    try:
        result = check_mapping(db, mapping_id, report_type, user_id, role, campaign_folder=campaign_folder, deep_files=False)
        if result["warn_count"]:
            summary = "; ".join(i["message"] for i in result["issues"] if i["severity"] == "warn")
            log_audit(
                db, user_id, "campaign.recipient_warnings", "mapping", mapping_id,
                f"{action} '{report_type}' with {result['warn_count']} recipient warning(s) (mapping checksum {result['mapping_checksum']}): {summary}"[:1900],
            )
            sender = db.query(User).filter_by(id=user_id).first()
            notify_admins(
                db, "admin_send_warnings",
                f"{(sender.full_name or sender.email) if sender else 'A member'} {action.lower()} with warnings",
                f"'{report_type}' went out with {result['warn_count']} recipient warning(s) still open: {result['issues'][0]['message'][:140]}",
                "/audit-log", exclude_user_id=user_id,
            )
    except Exception as e:  # noqa: BLE001
        db.rollback()
        print(f"DEBUG: recipient warning audit failed - {e}")
