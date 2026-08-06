"""MenoCare — Flask backend for the Next.js frontend.

Serves the hot-flash forecast model plus account/auth, medical profiles, free-form
symptom logging, alerts, community blogs, Tavily "latest info", and email
reminders that fire ~1 hour before a predicted hot flash.

Persistence goes through ``db`` (NeonDB Postgres when ``DATABASE_URL`` is set,
else a local SQLite file). Email goes through ``email_service`` (smtplib, config
from ``SMTP_*`` env vars). Run:  python app.py  (serves on http://localhost:8000)
"""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import pickle
import secrets
import time
import urllib.error
import urllib.request
from datetime import date, datetime, timedelta, timezone
from functools import wraps
from pathlib import Path
from statistics import mean

import pandas as pd
from flask import Flask, jsonify, request
from flask_cors import CORS

import db
import email_service

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR.parent / "models" / "model.pkl"
APP_SECRET = os.environ.get("APP_SECRET", "MenoCare-dev-secret-change-me").encode()

# --------------------------------------------------------------------------
# Model (loaded once)
# --------------------------------------------------------------------------
with open(MODEL_PATH, "rb") as _f:
    BUNDLE = pickle.load(_f)

MODEL = BUNDLE["model"]
RATE_MODEL = BUNDLE.get("rate_model")
_EXT_RATE_PATH = BASE_DIR.parent / "models" / "rate_model.pkl"
if _EXT_RATE_PATH.exists():
    with open(_EXT_RATE_PATH, "rb") as _rf:
        RATE_MODEL = pickle.load(_rf)
RATE_FEATURES = list(getattr(RATE_MODEL, "feature_names_in_", []))
FEATURE_COLUMNS = BUNDLE["feature_columns"]
STAGE_ORDER = BUNDLE["stage_order"]
IMPORTANCES = BUNDLE["feature_importances"]
BASELINE = BUNDLE["baseline"]
FEATURE_META = BUNDLE["feature_meta"]
METRICS = BUNDLE["metrics"]
RATE_METRICS = BUNDLE.get("rate_metrics", {})

PERSONAL_PRIOR_DAYS = 14
MIN_RATE = 1.0 / 60.0
SYMPTOM_FIELDS = [
    "irritability", "mood_changes", "stiffness", "headaches", "forgetful",
    "feeling_blue", "fearful", "night_sweats", "vaginal_dryness",
]
EXTRA_DAY_FIELDS = ["exercise_menopause", "exercise_memory", "family_illness_stress"]
VASOMOTOR_DERIVED = "num_hotflash" in FEATURE_COLUMNS
LIFESTYLE_FIELDS = ["sleep_hours", "exercise_minutes", "alcohol", "soy", "depressed_mood"]
DEFAULT_RACE = 4

STAGE_MAP = {  # frontend label -> model stage string
    "perimenopause": "perimenopausal", "menopause": "menopausal",
    "postmenopause": "postmenopausal", "premenopause": "premenopausal",
}


# ==========================================================================
# ML helpers (inference + explanations)
# ==========================================================================
def stage_to_code(stage: str) -> int:
    return STAGE_ORDER.get((stage or "").strip().lower(), 1)


def _values_dict(profile: dict, day: dict) -> dict:
    values = {
        "age": profile["age"], "bmi": profile["bmi"],
        "stage_code": stage_to_code(profile["stage"]),
        "is_smoker": int(bool(profile["is_smoker"])),
        "race": int(profile.get("race") or DEFAULT_RACE),
        "overall_health": float(profile.get("overall_health") or 3.0),
        "diabetes": int(bool(profile.get("diabetes", 0))),
        "days_since_lmp": float(profile.get("days_since_lmp") or 400.0),
        "sleep_hours": day["sleep_hours"],
        "exercise_minutes": day["exercise_minutes"],
        "alcohol": int(bool(day.get("alcohol", 0))),
        "soy": int(bool(day.get("soy", 0))),
        "depressed_mood": float(day.get("depressed_mood", 1.0)),
        "exercise_menopause": int(bool(day.get("exercise_menopause", 0))),
        "exercise_memory": int(bool(day.get("exercise_memory", 0))),
        "family_illness_stress": float(day.get("family_illness_stress", 1.0)),
    }
    for f in SYMPTOM_FIELDS:
        values[f] = float(day.get(f, 1.0))
    values["num_hotflash"] = float(day.get("num_hotflash", day.get("hot_flashes", 0) or 0))
    values["bother_hotflash"] = float(day.get("bother_hotflash", day.get("symptom_severity", 0) or 0))
    values["stage"] = values["stage_code"]
    return values


def _feature_frame(profile: dict, day: dict) -> pd.DataFrame:
    values = _values_dict(profile, day)
    return pd.DataFrame([[values[c] for c in FEATURE_COLUMNS]], columns=FEATURE_COLUMNS)


def _rate_frame(profile: dict, day: dict) -> pd.DataFrame:
    values = _values_dict(profile, day)
    if "hot_flash" in RATE_FEATURES:
        values["hot_flash"] = int(MODEL.predict_proba(_feature_frame(profile, day))[0, 1] >= 0.5)
    cols = RATE_FEATURES or FEATURE_COLUMNS
    return pd.DataFrame([[values.get(c, 0.0) for c in cols]], columns=cols)


def _band(prob: float) -> str:
    if prob >= 0.6:
        return "high"
    if prob >= 0.35:
        return "moderate"
    return "low"


def _drivers(row: pd.Series, limit: int = 3) -> list[dict]:
    out = []
    for col in FEATURE_COLUMNS:
        meta = FEATURE_META.get(col)
        if meta is None:
            continue
        val, base = float(row[col]), float(BASELINE.get(col, 0.0))
        deviation = max(0.0, base - val) if meta["protective_when"] == "high" else max(0.0, val - base)
        score = IMPORTANCES.get(col, 0.0) * deviation
        if score > 0:
            out.append({"feature": col, "label": meta["label"], "score": round(score, 4),
                        "tip": meta["tip"]})
    out.sort(key=lambda d: d["score"], reverse=True)
    return out[:limit]


def predict_day(profile: dict, day: dict) -> dict:
    frame = _feature_frame(profile, day)
    prob = float(MODEL.predict_proba(frame)[0, 1])
    drivers = _drivers(frame.iloc[0])
    return {"probability": round(prob, 4), "band": _band(prob),
            "drivers": drivers, "tips": [d["tip"] for d in drivers]}


def _population_rate(profile: dict, day: dict) -> float:
    if RATE_MODEL is None:
        return float(MODEL.predict_proba(_feature_frame(profile, day))[0, 1])
    return max(0.0, float(RATE_MODEL.predict(_rate_frame(profile, day))[0]))


def _personal_rate(logs: list[dict], before: date, window: int = 28):
    start = before - timedelta(days=window)
    recent = [l for l in logs if start <= _d(l["log_date"]) < before]
    if not recent:
        return None, 0
    flash_days = sum(1 for l in recent if (l.get("hot_flashes") or 0) > 0)
    return flash_days / len(recent), len(recent)


def estimate_time_to_next(profile: dict, day: dict, logs: list[dict], before: date) -> dict:
    pop = _population_rate(profile, day)
    personal, n_days = _personal_rate(logs, before)
    if personal is None:
        rate, source = pop, "population"
    else:
        w = n_days / (n_days + PERSONAL_PRIOR_DAYS)
        rate = w * personal + (1 - w) * pop
        source = "blended" if n_days < 4 * PERSONAL_PRIOR_DAYS else "personal"
    rate = max(0.0, float(rate))
    if rate < MIN_RATE:
        return {"rate_per_day": round(rate, 4), "days": None, "date": None,
                "beyond_horizon": True, "source": source,
                "text": "No hot flash expected in the next several weeks."}
    days = 1.0 / rate
    d_part, h_part = _days_hours(days)
    eta = before + timedelta(days=int(round(days)))
    phrase = _days_hours_phrase(d_part, h_part)
    return {"rate_per_day": round(rate, 4), "days": round(days, 1),
            "days_part": d_part, "hours_part": h_part, "eta_text": phrase,
            "date": eta.isoformat(), "beyond_horizon": False,
            "source": source, "text": f"Next hot flash expected in about {phrase}."}


def _days_hours(days: float) -> tuple[int, int]:
    return divmod(int(round(days * 24)), 24)


def _days_hours_phrase(d: int, h: int) -> str:
    dd = f"{d} day" + ("s" if d != 1 else "")
    hh = f"{h} hour" + ("s" if h != 1 else "")
    if d and h:
        return f"{dd}, {hh}"
    return dd if d else hh


def _recent_history(logs: list[dict], before: date, window: int = 7):
    start = before - timedelta(days=window)
    recent = [l for l in logs if start <= _d(l["log_date"]) < before]
    if not recent:
        return 0.0, 0.0
    return (float(sum(l["hot_flashes"] for l in recent)),
            float(mean(l["symptom_severity"] for l in recent)))


def _smoothed_lifestyle(logs: list[dict], window: int = 7) -> dict:
    if not logs:
        base = {"sleep_hours": 7.0, "exercise_minutes": 30.0, "alcohol": 0.0,
                "soy": 0.0, "depressed_mood": 1.0, "exercise_menopause": 0.0,
                "exercise_memory": 0.0, "family_illness_stress": 1.0}
        return {**base, **{f: 1.0 for f in SYMPTOM_FIELDS}}
    recent = sorted(logs, key=lambda l: l["log_date"])[-window:]
    out = {
        "sleep_hours": mean(l["sleep_hours"] for l in recent),
        "exercise_minutes": mean(l["exercise_minutes"] for l in recent),
        "alcohol": round(mean(1.0 if l.get("alcohol") else 0.0 for l in recent)),
        "soy": round(mean(1.0 if l.get("soy") else 0.0 for l in recent)),
        "depressed_mood": mean((l.get("depressed_mood") or 1.0) for l in recent),
        "exercise_menopause": round(mean(1.0 if l.get("exercise_menopause") else 0.0 for l in recent)),
        "exercise_memory": round(mean(1.0 if l.get("exercise_memory") else 0.0 for l in recent)),
        "family_illness_stress": mean((l.get("family_illness_stress") or 1.0) for l in recent),
    }
    for f in SYMPTOM_FIELDS:
        out[f] = mean((l.get(f) or 1.0) for l in recent)
    if VASOMOTOR_DERIVED:
        out["num_hotflash"] = mean((l.get("hot_flashes") or 0) for l in recent)
        out["bother_hotflash"] = mean((l.get("symptom_severity") or 0) for l in recent)
    return out


def _apply_override(base: dict, override: dict | None) -> dict:
    day = dict(base)
    for field in LIFESTYLE_FIELDS:
        if override and override.get(field) is not None:
            v = override[field]
            day[field] = (1.0 if v else 0.0) if isinstance(v, bool) else float(v)
    return day


def _summarize(days: list[dict], next_flash: dict | None = None) -> str:
    if not days:
        return "No forecast available."
    lead = (next_flash or {}).get("text", "").strip()
    lead = (lead + " ") if lead else ""
    high = [d for d in days if d["band"] == "high"]
    peak = max(days, key=lambda d: d["probability"])
    pct = round(peak["probability"] * 100)
    if high:
        when = _d(high[0]["forecast_date"]).strftime("%A %b %d")
        return (f"{lead}Elevated symptom risk expected around {when}. Peak likelihood "
                f"~{pct}%. Focus on the flagged triggers to lower your odds.")
    if peak["band"] == "moderate":
        return (f"{lead}Moderate risk over the coming days (peak ~{pct}%). "
                f"Small lifestyle tweaks can keep symptoms in check.")
    return f"{lead}Low symptom risk expected (peak ~{pct}%). Keep up your current routine."


def _d(v) -> date:
    if isinstance(v, date):
        return v
    return datetime.strptime(str(v)[:10], "%Y-%m-%d").date()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ==========================================================================
# New-model mapping: account + medical profile + symptoms -> ML inputs
# ==========================================================================
# free-form symptom name -> (model field, scale). scale: "f5" 1..5, "mood4" 1..4,
# "count" hot-flash count, "sev" 0..10 severity, "sleep" hours (inverse).
SYMPTOM_MAP = {
    "hot flashes": [("hot_flashes", "count"), ("symptom_severity", "sev")],
    "night sweats": [("night_sweats", "f5")],
    "mood swings": [("mood_changes", "f5"), ("irritability", "f5")],
    "depression": [("feeling_blue", "f5"), ("depressed_mood", "mood4")],
    "anxiety": [("fearful", "f5")],
    "brain fog": [("forgetful", "f5")],
    "memory issues": [("forgetful", "f5")],
    "sleep problems": [("sleep_hours", "sleep")],
    "fatigue": [("sleep_hours", "sleep")],
    "joint pain": [("stiffness", "f5")],
    "pain": [("stiffness", "f5")],
    "headache": [("headaches", "f5")],
    "stress": [("family_illness_stress", "mood4"), ("depressed_mood", "mood4")],
    "sexual discomfort": [("vaginal_dryness", "f5")],
    "urinary symptoms": [("vaginal_dryness", "f5")],
    "period irregularity": [],
    "abnormal bleeding": [],
}


def _scale(sev: float, kind: str) -> float:
    sev = max(1.0, min(10.0, float(sev or 1)))
    if kind == "f5":
        return round(1 + (sev - 1) / 9 * 4)          # 1..5
    if kind == "mood4":
        return round(1 + (sev - 1) / 9 * 3)          # 1..4
    if kind == "count":
        return round(sev / 10 * 8)                   # 0..8 flashes
    if kind == "sev":
        return round(sev)                            # 0..10
    if kind == "sleep":
        return round(8 - sev / 10 * 4, 1)            # 8h..4h
    return sev


def _entries_to_logs(entries: list[dict]) -> list[dict]:
    """Group free-form symptom entries by date into daily-log rows the ML uses."""
    by_date: dict[str, dict] = {}
    for e in entries:
        d = str(e["entry_date"])[:10]
        log = by_date.setdefault(d, {"log_date": d})
        for field, kind in SYMPTOM_MAP.get((e.get("symptom_name") or "").lower(), []):
            val = _scale(e.get("severity", 1), kind)
            # keep the strongest report for the day
            if field == "sleep_hours":
                log[field] = min(log.get(field, 99), val)
            else:
                log[field] = max(log.get(field, 0), val)
    # fill required fields with sensible defaults
    logs = []
    for d, log in by_date.items():
        log.setdefault("sleep_hours", 7.0)
        log.setdefault("exercise_minutes", 30.0)
        log.setdefault("hot_flashes", 0)
        log.setdefault("symptom_severity", 0.0)
        for f in SYMPTOM_FIELDS:
            log.setdefault(f, 1.0)
        for f in ("alcohol", "soy", "depressed_mood", "exercise_menopause",
                  "exercise_memory", "family_illness_stress"):
            log.setdefault(f, 1.0 if f in ("depressed_mood", "family_illness_stress") else 0)
        logs.append(log)
    return sorted(logs, key=lambda l: l["log_date"])


def _age_from_dob(dob) -> float:
    try:
        d = _d(dob)
        return max(18, (date.today() - d).days / 365.25)
    except Exception:
        return 50.0


def account_to_profile(account: dict, mp: dict | None) -> dict:
    """Build the ML `profile` dict from an account + its medical profile."""
    mp = mp or {}
    height, weight = mp.get("height"), mp.get("weight")
    bmi = 27.0
    if height and weight:
        bmi = round(float(weight) / ((float(height) / 100) ** 2), 1)
    stage = STAGE_MAP.get((mp.get("menopause_stage") or "").lower(), "perimenopausal")
    return {
        "age": _age_from_dob(account.get("dob")),
        "bmi": bmi,
        "stage": stage,
        "is_smoker": (mp.get("smoking") == "current"),
        "race": mp.get("race") or DEFAULT_RACE,
        "overall_health": 3.0,
        "diabetes": bool(mp.get("diabetes")),
        "days_since_lmp": mp.get("days_since_lmp") if mp.get("days_since_lmp") is not None else 400.0,
    }


# ==========================================================================
# Auth
# ==========================================================================
def hash_password(pw: str) -> str:
    salt = secrets.token_hex(16)
    h = hashlib.pbkdf2_hmac("sha256", pw.encode(), salt.encode(), 100_000).hex()
    return f"{salt}${h}"


def verify_password(pw: str, stored: str) -> bool:
    try:
        salt, h = stored.split("$", 1)
    except ValueError:
        return False
    calc = hashlib.pbkdf2_hmac("sha256", pw.encode(), salt.encode(), 100_000).hex()
    return hmac.compare_digest(calc, h)


def make_token(account_id: int) -> str:
    sig = hmac.new(APP_SECRET, str(account_id).encode(), hashlib.sha256).hexdigest()
    return f"{account_id}.{sig}"


def token_account_id(token: str):
    try:
        aid, sig = token.split(".", 1)
    except (ValueError, AttributeError):
        return None
    expect = hmac.new(APP_SECRET, aid.encode(), hashlib.sha256).hexdigest()
    return int(aid) if hmac.compare_digest(expect, sig) else None


def _bearer() -> str:
    h = request.headers.get("Authorization", "")
    return h[7:].strip() if h.startswith("Bearer ") else ""


def require_auth(fn):
    @wraps(fn)
    def wrapper(*a, **k):
        aid = token_account_id(_bearer())
        if aid is None:
            return jsonify(detail="Authentication required"), 401
        conn = db.connect()
        try:
            acct = db.fetchone(conn, "SELECT * FROM accounts WHERE id=?", (aid,))
        finally:
            conn.close()
        if acct is None:
            return jsonify(detail="Account not found"), 401
        return fn(acct, *a, **k)
    return wrapper


# ==========================================================================
# Serialization
# ==========================================================================
def _account_public(a: dict) -> dict:
    return {"id": a["id"], "email": a["email"], "name": a["name"],
            "dob": a.get("dob"), "address": a.get("address"),
            "createdAt": a.get("created_at")}


def _jload(v, default):
    if not v:
        return default
    try:
        return json.loads(v)
    except (TypeError, ValueError):
        return default


def _profile_public(mp: dict | None) -> dict:
    mp = mp or {}
    return {
        "height": mp.get("height"), "weight": mp.get("weight"),
        "smoking": mp.get("smoking") or "never", "alcohol": mp.get("alcohol") or "none",
        "exerciseFrequency": mp.get("exercise_frequency") or "moderate",
        "occupation": mp.get("occupation") or "",
        "menstrualHistory": mp.get("menstrual_history") or "",
        "pregnancyHistory": mp.get("pregnancy_history") or 0,
        "pcos": bool(mp.get("pcos")), "thyroid": bool(mp.get("thyroid")),
        "diabetes": bool(mp.get("diabetes")),
        "bloodPressure": mp.get("blood_pressure") or "",
        "cancerHistory": mp.get("cancer_history") or "",
        "familyHistory": _jload(mp.get("family_history"), []),
        "medications": _jload(mp.get("medications"), []),
        "allergies": _jload(mp.get("allergies"), []),
        "diet": mp.get("diet") or "",
        "menopauseStage": mp.get("menopause_stage") or "Perimenopause",
        "race": mp.get("race") or DEFAULT_RACE,
        "daysSinceLmp": mp.get("days_since_lmp"),
    }


def _entry_public(e: dict) -> dict:
    return {"id": str(e["id"]), "symptomName": e["symptom_name"],
            "severity": e["severity"], "frequency": e["frequency"],
            "duration": e["duration"], "notes": e.get("notes") or "",
            "date": e["entry_date"]}


def _alert_public(a: dict) -> dict:
    return {"id": str(a["id"]), "type": a["type"], "title": a["title"],
            "message": a["message"], "severity": a["severity"],
            "dueDate": a.get("due_date"), "createdAt": a["created_at"]}


# ==========================================================================
# App + routes
# ==========================================================================
app = Flask(__name__)
CORS(app, origins="*", supports_credentials=False)


@app.get("/api/health")
def health():
    return jsonify(status="ok", db=db.backend_name(),
                   smtp_configured=email_service.is_configured())


@app.get("/api/model")
def model_info():
    return jsonify(feature_columns=FEATURE_COLUMNS, feature_importances=IMPORTANCES,
                   baseline=BASELINE, metrics=METRICS, rate_metrics=RATE_METRICS,
                   has_timing_model=RATE_MODEL is not None,
                   rate_model_external=_EXT_RATE_PATH.exists(),
                   rate_model_features=len(RATE_FEATURES))


# ---- Auth -----------------------------------------------------------------
@app.post("/api/auth/signup")
def signup():
    data = request.get_json(force=True)
    email = (data.get("email") or "").strip().lower()
    name = (data.get("name") or "").strip()
    pw = data.get("password") or ""
    if not (email and name and pw):
        return jsonify(detail="name, email and password are required"), 400
    conn = db.connect()
    try:
        if db.fetchone(conn, "SELECT id FROM accounts WHERE email=?", (email,)):
            return jsonify(detail="Email already registered"), 409
        aid = db.insert(conn, "accounts", {
            "email": email, "name": name, "dob": data.get("dob"),
            "address": data.get("address"), "password_hash": hash_password(pw),
            "created_at": _now()})
        db.insert(conn, "medical_profiles", {
            "account_id": aid, "menopause_stage": data.get("menopauseStage", "Perimenopause"),
            "race": DEFAULT_RACE, "updated_at": _now()}, returning=None)
        conn.commit()
        acct = db.fetchone(conn, "SELECT * FROM accounts WHERE id=?", (aid,))
    finally:
        conn.close()
    return jsonify(token=make_token(aid), user=_account_public(acct)), 201


@app.post("/api/auth/login")
def login():
    data = request.get_json(force=True)
    email = (data.get("email") or "").strip().lower()
    pw = data.get("password") or ""
    conn = db.connect()
    try:
        acct = db.fetchone(conn, "SELECT * FROM accounts WHERE email=?", (email,))
    finally:
        conn.close()
    if not acct or not verify_password(pw, acct["password_hash"]):
        return jsonify(detail="Invalid email or password"), 401
    return jsonify(token=make_token(acct["id"]), user=_account_public(acct))


@app.get("/api/auth/me")
@require_auth
def me(acct):
    return jsonify(_account_public(acct))


# ---- Medical profile ------------------------------------------------------
def _load_profile(conn, account_id):
    return db.fetchone(conn, "SELECT * FROM medical_profiles WHERE account_id=?", (account_id,))


@app.get("/api/profile")
@require_auth
def get_profile(acct):
    conn = db.connect()
    try:
        return jsonify(_profile_public(_load_profile(conn, acct["id"])))
    finally:
        conn.close()


_PROFILE_FIELDS = {
    "height": "height", "weight": "weight", "smoking": "smoking", "alcohol": "alcohol",
    "exerciseFrequency": "exercise_frequency", "occupation": "occupation",
    "menstrualHistory": "menstrual_history", "pregnancyHistory": "pregnancy_history",
    "pcos": "pcos", "thyroid": "thyroid", "diabetes": "diabetes",
    "bloodPressure": "blood_pressure", "cancerHistory": "cancer_history",
    "diet": "diet", "menopauseStage": "menopause_stage", "race": "race",
    "daysSinceLmp": "days_since_lmp",
}
_PROFILE_JSON = {"familyHistory": "family_history", "medications": "medications",
                 "allergies": "allergies"}
_PROFILE_BOOL = {"pcos", "thyroid", "diabetes"}


@app.put("/api/profile")
@require_auth
def update_profile(acct):
    data = request.get_json(force=True)
    updates = {}
    for js, col in _PROFILE_FIELDS.items():
        if js in data:
            val = data[js]
            updates[col] = int(bool(val)) if js in _PROFILE_BOOL else val
    for js, col in _PROFILE_JSON.items():
        if js in data:
            updates[col] = json.dumps(data[js])
    updates["updated_at"] = _now()
    conn = db.connect()
    try:
        if _load_profile(conn, acct["id"]) is None:
            db.insert(conn, "medical_profiles", {"account_id": acct["id"], **updates}, returning=None)
        else:
            sets = ", ".join(f"{c}=?" for c in updates)
            db.query(conn, f"UPDATE medical_profiles SET {sets} WHERE account_id=?",
                     (*updates.values(), acct["id"]))
        conn.commit()
        return jsonify(_profile_public(_load_profile(conn, acct["id"])))
    finally:
        conn.close()


# ---- Symptom entries ------------------------------------------------------
@app.get("/api/symptoms")
@require_auth
def list_symptoms(acct):
    conn = db.connect()
    try:
        rows = db.fetchall(conn,
            "SELECT * FROM symptom_entries WHERE account_id=? ORDER BY entry_date DESC, id DESC",
            (acct["id"],))
    finally:
        conn.close()
    return jsonify([_entry_public(r) for r in rows])


@app.post("/api/symptoms")
@require_auth
def add_symptom(acct):
    data = request.get_json(force=True)
    name = (data.get("symptomName") or "").strip()
    if not name:
        return jsonify(detail="symptomName is required"), 400
    entry_date = (data.get("date") or date.today().isoformat())[:10]
    conn = db.connect()
    try:
        sid = db.insert(conn, "symptom_entries", {
            "account_id": acct["id"], "symptom_name": name,
            "severity": float(data.get("severity", 5)),
            "frequency": data.get("frequency", "daily"),
            "duration": float(data.get("duration", 0)),
            "notes": data.get("notes", ""), "entry_date": entry_date,
            "created_at": _now()})
        conn.commit()
        row = db.fetchone(conn, "SELECT * FROM symptom_entries WHERE id=?", (sid,))
    finally:
        conn.close()
    return jsonify(_entry_public(row)), 201


@app.delete("/api/symptoms/<int:sid>")
@require_auth
def delete_symptom(acct, sid):
    conn = db.connect()
    try:
        db.query(conn, "DELETE FROM symptom_entries WHERE id=? AND account_id=?",
                 (sid, acct["id"]))
        conn.commit()
    finally:
        conn.close()
    return "", 204


# ---- Alerts ---------------------------------------------------------------
@app.get("/api/alerts")
@require_auth
def list_alerts(acct):
    conn = db.connect()
    try:
        rows = db.fetchall(conn,
            "SELECT * FROM alerts WHERE account_id=? AND dismissed=0 ORDER BY created_at DESC",
            (acct["id"],))
    finally:
        conn.close()
    return jsonify([_alert_public(r) for r in rows])


@app.post("/api/alerts/<int:aid>/dismiss")
@require_auth
def dismiss_alert(acct, aid):
    conn = db.connect()
    try:
        db.query(conn, "UPDATE alerts SET dismissed=1 WHERE id=? AND account_id=?",
                 (aid, acct["id"]))
        conn.commit()
    finally:
        conn.close()
    return "", 204


def _upsert_prediction_alert(conn, account_id, next_flash, peak_band):
    """Keep a single live 'prediction' alert reflecting the latest forecast."""
    db.query(conn, "DELETE FROM alerts WHERE account_id=? AND type='prediction'", (account_id,))
    if next_flash and not next_flash.get("beyond_horizon"):
        sev = "high" if peak_band == "high" else "medium"
        db.insert(conn, "alerts", {
            "account_id": account_id, "type": "prediction", "title": "Hot Flash Predicted",
            "message": next_flash["text"], "severity": sev,
            "due_date": next_flash.get("date"), "created_at": _now(), "dismissed": 0})
    conn.commit()


# ---- Forecast -------------------------------------------------------------
@app.post("/api/forecast")
@require_auth
def forecast(acct):
    conn = db.connect()
    try:
        mp = _load_profile(conn, acct["id"])
        entries = db.fetchall(conn,
            "SELECT * FROM symptom_entries WHERE account_id=? ORDER BY entry_date", (acct["id"],))
    finally:
        conn.close()

    profile = account_to_profile(acct, mp)
    logs = _entries_to_logs(entries)

    body = request.get_json(silent=True) or {}
    horizon = max(1, min(14, int(body.get("horizon_days", 3))))
    override = body.get("override")
    lifestyle = _apply_override(_smoothed_lifestyle(logs), override)

    start = date.today()
    days = []
    for offset in range(horizon):
        dd = start + timedelta(days=offset)
        freq, sev = _recent_history(logs, before=dd)
        feat = dict(lifestyle)
        feat["recent_symptom_freq"], feat["recent_symptom_severity"] = freq, sev
        days.append({"forecast_date": dd.isoformat(), **predict_day(profile, feat)})

    today_feat = dict(lifestyle)
    f0, s0 = _recent_history(logs, before=start)
    today_feat["recent_symptom_freq"], today_feat["recent_symptom_severity"] = f0, s0
    next_flash = estimate_time_to_next(profile, today_feat, logs, before=start)

    # Alerts + email reminder (~1h before the predicted flash).
    peak_band = max(days, key=lambda d: d["probability"])["band"] if days else "low"
    conn = db.connect()
    try:
        _upsert_prediction_alert(conn, acct["id"], next_flash, peak_band)
    finally:
        conn.close()
    reminder = email_service.schedule_next_flash_reminder(acct, next_flash)

    return jsonify(generated_for=start.isoformat(), days=days, next_flash=next_flash,
                   summary=_summarize(days, next_flash), reminder=reminder,
                   profile={"age": round(profile["age"]), "bmi": profile["bmi"],
                            "stage": profile["stage"]})


# ---- Reminders ------------------------------------------------------------
@app.get("/api/reminders")
@require_auth
def list_reminders(acct):
    conn = db.connect()
    try:
        rows = db.fetchall(conn,
            "SELECT id, kind, send_at, subject, sent FROM reminders WHERE account_id=? "
            "ORDER BY send_at DESC", (acct["id"],))
    finally:
        conn.close()
    return jsonify(rows)


@app.post("/api/reminders/test")
@require_auth
def test_reminder(acct):
    ok = email_service.send_email(
        acct["email"], "MenoCare test reminder",
        f"Hi {acct['name']}, this is a test reminder from MenoCare. If you received it, "
        f"email reminders are working.")
    return jsonify(sent=ok, configured=email_service.is_configured(), to=acct["email"])


# ---- Community Center (blogs) ---------------------------------------------
def _post_public(p: dict, n: int) -> dict:
    return {"id": p["id"], "author": p["author"], "title": p["title"], "body": p["body"],
            "likes": p["likes"], "created_at": p["created_at"], "comment_count": n}


@app.get("/api/blogs")
def list_blogs():
    conn = db.connect()
    try:
        rows = db.fetchall(conn,
            """SELECT p.*, (SELECT COUNT(*) FROM blog_comments c WHERE c.post_id=p.id) AS n_comments
               FROM blog_posts p ORDER BY p.created_at DESC""")
    finally:
        conn.close()
    return jsonify([_post_public(r, r["n_comments"]) for r in rows])


@app.post("/api/blogs")
def create_blog():
    data = request.get_json(force=True)
    title, body = (data.get("title") or "").strip(), (data.get("body") or "").strip()
    if not title or not body:
        return jsonify(detail="title and body are required"), 400
    author = (data.get("author") or "").strip() or "Anonymous"
    conn = db.connect()
    try:
        pid = db.insert(conn, "blog_posts", {"author": author[:80], "title": title[:160],
                                             "body": body, "likes": 0, "created_at": _now()})
        conn.commit()
        row = db.fetchone(conn, "SELECT * FROM blog_posts WHERE id=?", (pid,))
    finally:
        conn.close()
    return jsonify(_post_public(row, 0)), 201


@app.get("/api/blogs/<int:post_id>")
def get_blog(post_id):
    conn = db.connect()
    try:
        row = db.fetchone(conn, "SELECT * FROM blog_posts WHERE id=?", (post_id,))
        if row is None:
            return jsonify(detail="Post not found"), 404
        comments = db.fetchall(conn,
            "SELECT * FROM blog_comments WHERE post_id=? ORDER BY created_at", (post_id,))
    finally:
        conn.close()
    post = _post_public(row, len(comments))
    post["comments"] = [{"id": c["id"], "author": c["author"], "body": c["body"],
                         "created_at": c["created_at"]} for c in comments]
    return jsonify(post)


@app.post("/api/blogs/<int:post_id>/comments")
def add_blog_comment(post_id):
    data = request.get_json(force=True)
    body = (data.get("body") or "").strip()
    if not body:
        return jsonify(detail="body is required"), 400
    author = (data.get("author") or "").strip() or "Anonymous"
    conn = db.connect()
    try:
        if db.fetchone(conn, "SELECT 1 FROM blog_posts WHERE id=?", (post_id,)) is None:
            return jsonify(detail="Post not found"), 404
        db.insert(conn, "blog_comments", {"post_id": post_id, "author": author[:80],
                                          "body": body, "created_at": _now()})
        conn.commit()
    finally:
        conn.close()
    return get_blog(post_id)


@app.post("/api/blogs/<int:post_id>/like")
def like_blog(post_id):
    conn = db.connect()
    try:
        db.query(conn, "UPDATE blog_posts SET likes = likes + 1 WHERE id=?", (post_id,))
        conn.commit()
        row = db.fetchone(conn, "SELECT id, likes FROM blog_posts WHERE id=?", (post_id,))
    finally:
        conn.close()
    if row is None:
        return jsonify(detail="Post not found"), 404
    return jsonify(row)


# ---- Latest info (Tavily search) ------------------------------------------
TAVILY_URL = "https://api.tavily.com/search"
DEFAULT_INFO_QUERY = "latest menopause and hot flash research, management and news"
_info_cache: dict[str, tuple[float, dict]] = {}
INFO_TTL_SECONDS = 900


def _tavily_search(query: str, topic: str = "news", depth: str = "basic") -> dict:
    key = os.environ.get("TAVILY_API_KEY", "").strip()
    if not key:
        return {"configured": False, "results": [],
                "message": "Latest Info needs a Tavily API key. Set TAVILY_API_KEY and restart."}
    now = time.time()
    cache_key = (query, topic, depth)
    cached = _info_cache.get(cache_key)
    if cached and now - cached[0] < INFO_TTL_SECONDS:
        return cached[1]
    payload = json.dumps({"query": query, "search_depth": depth, "topic": topic,
                          "max_results": 6, "include_answer": True}).encode()
    req = urllib.request.Request(TAVILY_URL, data=payload, method="POST",
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {key}"})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return {"configured": True, "error": f"Tavily error {e.code}", "results": []}
    except Exception as e:
        return {"configured": True, "error": f"Could not reach Tavily: {e}", "results": []}
    out = {"configured": True, "query": query, "topic": topic, "depth": depth,
           "answer": data.get("answer"),
           "results": [{"title": r.get("title"), "url": r.get("url"),
                        "content": r.get("content"), "published_date": r.get("published_date")}
                       for r in data.get("results", [])]}
    _info_cache[cache_key] = (now, out)
    return out


@app.get("/api/latest-info")
def latest_info():
    query = (request.args.get("q") or "").strip() or DEFAULT_INFO_QUERY
    # "general" surfaces clinical guidelines and reference sources (NIH, Mayo,
    # Cleveland Clinic); "news" is for time-sensitive headlines. Anything else
    # falls back to news so a bad param can't reach Tavily.
    topic = request.args.get("topic", "news").strip().lower()
    if topic not in ("news", "general"):
        topic = "news"
    # "advanced" costs 2 Tavily credits instead of 1 but pulls peer-reviewed
    # sources; the evidence-based category tabs opt into it, headlines don't.
    depth = request.args.get("depth", "basic").strip().lower()
    if depth not in ("basic", "advanced"):
        depth = "basic"
    return jsonify(_tavily_search(query, topic, depth))


# ---- AI assistant (Groq — Llama 3.3 70B Versatile) ------------------------
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")

SYSTEM_PROMPT = (
    "You are MenoCare, a warm, supportive menopause companion. Give evidence-based, "
    "practical guidance about menopause, hot flashes, and related symptoms in a "
    "concise, encouraging tone. You are NOT a medical professional: do not "
    "diagnose or prescribe, and add a short reminder to consult a healthcare "
    "provider whenever you give health guidance. If a question is outside "
    "menopause/wellness, answer briefly and steer back gently."
    "\n\nThe user's medical profile and recent symptom logs are provided below. "
    "Use them to personalize every answer: tailor suggestions to their menopause "
    "stage, lifestyle, and the symptoms they actually log, and never recommend "
    "anything that conflicts with their listed allergies, medications, or "
    "diagnosed conditions. Refer to their details naturally rather than reciting "
    "the profile back, and if a field is missing or empty, simply don't assume a "
    "value for it."
)


def _chat_context(acct: dict) -> str:
    """The user's real profile + recent logs, as a note for the system prompt."""
    conn = db.connect()
    try:
        mp = _load_profile(conn, acct["id"])
        entries = db.fetchall(conn,
            "SELECT symptom_name, severity, frequency, entry_date FROM symptom_entries "
            "WHERE account_id=? ORDER BY entry_date DESC LIMIT 20", (acct["id"],))
    finally:
        conn.close()

    lines = [f"Name: {acct.get('name')}."]
    p = _profile_public(mp)

    # Personal / anthropometric
    h, w = p["height"], p["weight"]
    if h and w:
        lines.append(f"Height {h} cm, weight {w} kg (BMI {w / ((h / 100) ** 2):.1f}).")
    elif h or w:
        lines.append(f"Height {h or 'unknown'} cm, weight {w or 'unknown'} kg.")

    lines.append(f"Menopause stage: {p['menopauseStage']}.")
    if p["daysSinceLmp"] is not None:
        lines.append(f"Days since last menstrual period: {p['daysSinceLmp']:.0f}.")

    # Lifestyle
    lines.append(
        f"Lifestyle — smoking: {p['smoking']}; alcohol: {p['alcohol']}; "
        f"exercise: {p['exerciseFrequency']}."
    )
    if p["occupation"]:
        lines.append(f"Occupation: {p['occupation']}.")
    if p["diet"]:
        lines.append(f"Diet: {p['diet']}.")

    # Medical history
    conditions = [n for n, on in
                  (("PCOS", p["pcos"]), ("thyroid condition", p["thyroid"]),
                   ("diabetes", p["diabetes"])) if on]
    lines.append("Diagnosed conditions: " + (", ".join(conditions) if conditions else "none reported") + ".")
    if p["bloodPressure"]:
        lines.append(f"Blood pressure: {p['bloodPressure']}.")
    if p["menstrualHistory"]:
        lines.append(f"Menstrual history: {p['menstrualHistory']}.")
    if p["pregnancyHistory"]:
        lines.append(f"Pregnancies: {p['pregnancyHistory']}.")
    if p["cancerHistory"]:
        lines.append(f"Cancer history: {p['cancerHistory']}.")

    for label, vals in (("Family history", p["familyHistory"]),
                        ("Current medications", p["medications"]),
                        ("Allergies", p["allergies"])):
        vals = [str(v).strip() for v in (vals or []) if str(v).strip()]
        if vals:
            lines.append(f"{label}: {', '.join(vals)}.")

    # Recent symptom logs, most recent first
    if entries:
        logged = ", ".join(
            e["symptom_name"]
            + " (" + ", ".join(filter(None, (
                f"severity {e['severity']:g}/10" if e.get("severity") is not None else None,
                e.get("frequency") or None,
                e["entry_date"],
            ))) + ")"
            for e in entries[:10]
        )
        lines.append(f"Recent symptom logs: {logged}.")
    else:
        lines.append("No symptoms logged yet.")

    return " ".join(lines)


def _groq_chat(messages: list[dict], context: str) -> dict:
    key = os.environ.get("GROQ_API_KEY", "").strip()
    if not key:
        return {"configured": False,
                "reply": "The AI assistant isn't configured yet. Set GROQ_API_KEY "
                         "in the backend environment to enable Llama 3.3 chat."}
    convo = [{"role": "system",
              "content": SYSTEM_PROMPT + "\n\n--- USER MEDICAL PROFILE ---\n" + context}]
    for m in messages[-12:]:  # keep the last few turns
        role = "assistant" if m.get("role") == "assistant" else "user"
        convo.append({"role": role, "content": str(m.get("content", ""))[:4000]})
    payload = json.dumps({"model": GROQ_MODEL, "messages": convo,
                          "temperature": 0.6, "max_tokens": 800}).encode()
    # A real User-Agent is required: Cloudflare rejects urllib's default
    # "Python-urllib/x.y" signature with a 403 (error 1010) before it reaches Groq.
    req = urllib.request.Request(GROQ_URL, data=payload, method="POST",
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {key}",
                 "User-Agent": "MenoCare/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode())
        return {"configured": True, "reply": data["choices"][0]["message"]["content"],
                "model": GROQ_MODEL}
    except urllib.error.HTTPError as e:
        detail = e.read().decode()[:200] if hasattr(e, "read") else ""
        return {"configured": True, "error": f"Groq error {e.code}: {detail}",
                "reply": "Sorry, I couldn't reach the AI service just now. Please try again."}
    except Exception as e:
        return {"configured": True, "error": f"Could not reach Groq: {e}",
                "reply": "Sorry, I couldn't reach the AI service just now. Please try again."}


@app.post("/api/chat")
@require_auth
def chat(acct):
    body = request.get_json(force=True) or {}
    messages = body.get("messages") or []
    if not isinstance(messages, list) or not messages:
        return jsonify(detail="messages array is required"), 400
    return jsonify(_groq_chat(messages, _chat_context(acct)))


if __name__ == "__main__":
    db.init_db()
    email_service.start_scheduler()
    app.run(host="0.0.0.0", port=8000, debug=True, use_reloader=False)
