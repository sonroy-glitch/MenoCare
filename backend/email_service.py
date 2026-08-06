"""Email reminders via smtplib.

A reminder is scheduled to go out ~1 hour before a user's predicted next hot
flash. Reminders are stored in the ``reminders`` table; a background daemon
thread polls for due, unsent rows and emails them.

SMTP is configured from the environment (nothing is hard-coded):
    SMTP_HOST, SMTP_PORT (default 587), SMTP_USER, SMTP_PASS,
    SMTP_FROM (default = SMTP_USER), SMTP_SSL ("1" for implicit SSL / port 465).
Without SMTP_HOST/USER the sender logs and no-ops, so the app still runs.
"""

from __future__ import annotations

import os
import smtplib
import ssl
import threading
import time
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage

import db

LEAD = timedelta(hours=1)          # send this long before the predicted flash
POLL_SECONDS = 60                  # how often the scheduler checks for due mail


def _cfg():
    return {
        "host": os.environ.get("SMTP_HOST", "").strip(),
        "port": int(os.environ.get("SMTP_PORT", "587")),
        "user": os.environ.get("SMTP_USER", "").strip(),
        "pw": os.environ.get("SMTP_PASS", "").strip(),
        "from": os.environ.get("SMTP_FROM", os.environ.get("SMTP_USER", "")).strip(),
        "ssl": os.environ.get("SMTP_SSL", "").strip() in ("1", "true", "yes"),
    }


def is_configured() -> bool:
    c = _cfg()
    return bool(c["host"] and c["user"])


def send_email(to: str, subject: str, body: str) -> bool:
    c = _cfg()
    if not (c["host"] and c["user"] and to):
        print(f"[email] SMTP not configured; would send to {to!r}: {subject!r}")
        return False
    msg = EmailMessage()
    msg["From"] = c["from"] or c["user"]
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)
    try:
        if c["ssl"] or c["port"] == 465:
            with smtplib.SMTP_SSL(c["host"], c["port"], context=ssl.create_default_context()) as s:
                s.login(c["user"], c["pw"])
                s.send_message(msg)
        else:
            with smtplib.SMTP(c["host"], c["port"]) as s:
                s.starttls(context=ssl.create_default_context())
                s.login(c["user"], c["pw"])
                s.send_message(msg)
        print(f"[email] sent to {to}: {subject}")
        return True
    except Exception as e:  # never let email failures crash a request
        print(f"[email] send failed to {to}: {e}")
        return False


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def schedule_next_flash_reminder(account: dict, next_flash: dict) -> dict | None:
    """Upsert a 'hot_flash' reminder to fire ~1h before the predicted flash.

    `next_flash` is the forecast payload (needs `date` + `days_part`/`hours_part`,
    or `beyond_horizon`). Replaces any pending hot-flash reminder for the account.
    Returns the reminder info, or None if nothing is scheduled.
    """
    conn = db.connect()
    try:
        # Clear previous pending hot-flash reminders for this account.
        db.query(conn, "DELETE FROM reminders WHERE account_id=? AND kind='hot_flash' AND sent=0",
                 (account["id"],))
        conn.commit()

        if not next_flash or next_flash.get("beyond_horizon") or not next_flash.get("date"):
            return None

        # Build the predicted flash datetime from date + day/hour parts (UTC).
        d = datetime.fromisoformat(next_flash["date"]).replace(tzinfo=timezone.utc)
        eta = d + timedelta(hours=int(next_flash.get("hours_part", 0)))
        send_at = eta - LEAD
        now = datetime.now(timezone.utc)
        if send_at < now:                       # too soon — send almost immediately
            send_at = now + timedelta(seconds=30)

        when = eta.strftime("%A %b %d, %H:%M UTC")
        subject = "MenoCare: a hot flash may be coming soon"
        body = (
            f"Hi {account.get('name', 'there')},\n\n"
            f"Your MenoCare forecast predicts your next hot flash around {when}.\n"
            f"This is your heads-up about an hour ahead — a good moment to cool "
            f"your space, grab water, and dress in layers.\n\n"
            f"Take care,\nMenoCare\n\n"
            f"(Wellness insights only — not a medical device.)"
        )
        rid = db.insert(conn, "reminders", {
            "account_id": account["id"], "kind": "hot_flash",
            "send_at": send_at.isoformat(), "subject": subject, "body": body,
            "sent": 0, "created_at": _now_iso(),
        })
        conn.commit()
        return {"id": rid, "send_at": send_at.isoformat(), "for": eta.isoformat()}
    finally:
        conn.close()


def _dispatch_due() -> int:
    """Send any due, unsent reminders. Returns count sent."""
    conn = db.connect()
    sent = 0
    try:
        rows = db.fetchall(
            conn,
            """SELECT r.*, a.email FROM reminders r JOIN accounts a ON a.id = r.account_id
               WHERE r.sent = 0 AND r.send_at <= ?""",
            (_now_iso(),),
        )
        for r in rows:
            ok = send_email(r["email"], r["subject"], r["body"])
            db.query(conn, "UPDATE reminders SET sent=? WHERE id=?",
                     (1 if ok else 0, r["id"]))
            if ok:
                sent += 1
        conn.commit()
    except Exception as e:
        print(f"[email] dispatch error: {e}")
    finally:
        conn.close()
    return sent


def start_scheduler() -> None:
    """Launch the background poller (idempotent per process)."""
    def loop():
        while True:
            try:
                _dispatch_due()
            except Exception as e:
                print(f"[email] scheduler loop error: {e}")
            time.sleep(POLL_SECONDS)

    t = threading.Thread(target=loop, name="reminder-scheduler", daemon=True)
    t.start()
    print(f"[email] scheduler started (SMTP {'configured' if is_configured() else 'NOT configured'})")
