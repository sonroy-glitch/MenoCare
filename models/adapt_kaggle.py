"""Adapt a raw Kaggle CSV into MenoCare's training schema.

There is no Kaggle dataset that natively matches our columns, so this script
maps a real health/lifestyle dataset (e.g. a menstrual-health dataset) onto the
schema the notebook + model expect:

    age, bmi, stage, is_smoker, sleep_hours, stress_level, caffeine_mg,
    alcohol_units, spicy_food, exercise_minutes, hydration_liters,
    ambient_temp_c, recent_symptom_freq, recent_symptom_severity, hot_flash

How it works
------------
1. Reads the raw CSV.
2. Fuzzy-matches each target column against a synonym table (case/space/underscore
   insensitive, substring aware) so it tolerates naming differences.
3. Derives values it can (BMI from height+weight, stage from age).
4. Fills genuinely-absent columns with healthy-baseline defaults (jittered so the
   column keeps some variance).
5. Builds the `hot_flash` target from the chosen TARGET_STRATEGY.
6. Writes the canonical CSV and prints a mapping report so nothing is silent.

Honesty note: menstrual/health datasets do not record hot flashes. Any derived
target is a documented *proxy*, not a ground-truth label. Treat resulting model
metrics accordingly.

Usage
-----
    # 1. download a real dataset (needs ~/.kaggle/kaggle.json)
    kaggle datasets download -d akshayas02/menstrual-cycle-data-with-factors-dataset -p ../data --unzip
    # 2. point RAW_CSV at the downloaded file, then:
    python adapt_kaggle.py
    # 3. re-run train_pipeline.ipynb
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd

# --------------------------------------------------------------------------
# CONFIG — edit these three for your dataset
# --------------------------------------------------------------------------
DATA_DIR = Path(__file__).resolve().parent.parent / "data"
RAW_CSV = DATA_DIR / "raw_kaggle.csv"          # <- the file you downloaded
OUT_CSV = DATA_DIR / "menopause_symptoms.csv"  # canonical output (what the notebook reads)

# "column"            -> use a real hot-flash column if the dataset has one
# "severity_threshold"-> label = 1 when a symptom/pain/severity column is high
# "synthetic"         -> fall back to a modeled proxy target (last resort)
TARGET_STRATEGY = "severity_threshold"

RANDOM_STATE = 42

# Categorical raw columns -> numeric, applied BEFORE matching. Keys are matched
# case-insensitively against raw column names; value maps are lower-cased.
# (Tuned for akshayas02/menstrual-cycle-data-with-factors-dataset; harmless if
# those columns are absent.)
CATEGORICAL_MAPS: dict[str, dict[str, float]] = {
    "exercise frequency": {"low": 15, "moderate": 35, "high": 60},
}

# Free-text symptom labels -> a 0-10 severity. A column named like "Symptoms" is
# converted to `recent_symptom_severity` (and drives the proxy target).
SYMPTOM_SEVERITY: dict[str, float] = {
    "cramps": 7, "headache": 6, "hot flashes": 8, "night sweats": 8,
    "fatigue": 5, "mood swings": 5, "bloating": 4, "none": 0,
}

# Synonyms checked (normalized) against the raw columns, in priority order.
SYNONYMS: dict[str, list[str]] = {
    "age": ["age", "ageyears"],
    "bmi": ["bmi", "bodymassindex"],
    "stage": ["menopausestage", "stage", "menopause"],
    "is_smoker": ["issmoker", "smoker", "smoking", "smoke"],
    "sleep_hours": ["sleephours", "sleep", "sleepduration", "hoursofsleep", "sleeptime"],
    "stress_level": ["stresslevel", "stress"],
    "caffeine_mg": ["caffeinemg", "caffeine", "coffee", "coffeecups"],
    "alcohol_units": ["alcoholunits", "alcohol", "drinks"],
    "spicy_food": ["spicyfood", "spicy"],
    "exercise_minutes": ["exerciseminutes", "exercise", "physicalactivity", "workout",
                          "activityminutes", "activitylevel"],
    "hydration_liters": ["hydrationliters", "hydration", "waterintake", "water"],
    "ambient_temp_c": ["ambienttempc", "ambienttemp", "temperature", "temp"],
    "recent_symptom_severity": ["recentsymptomseverity", "symptomseverity", "severity",
                                "painlevel", "pain", "cramps", "crampseverity"],
    "recent_symptom_freq": ["recentsymptomfreq", "symptomfrequency", "symptomcount",
                            "numsymptoms"],
    "hot_flash": ["hotflash", "hotflashes", "hotflush"],
}

# Healthy-baseline defaults for columns the dataset lacks entirely.
DEFAULTS = {
    "sleep_hours": 7.0, "stress_level": 4.0, "caffeine_mg": 100.0, "alcohol_units": 1.0,
    "spicy_food": 0.0, "exercise_minutes": 30.0, "hydration_liters": 2.0,
    "ambient_temp_c": 22.0, "recent_symptom_freq": 2.0, "recent_symptom_severity": 4.0,
    "is_smoker": 0.0,
}

TARGET_COLUMNS = list(SYNONYMS.keys())
RNG = np.random.default_rng(RANDOM_STATE)


def _norm(s: str) -> str:
    return "".join(ch for ch in str(s).lower() if ch.isalnum())


def _match(raw_cols: list[str], candidates: list[str]) -> str | None:
    norm_map = {_norm(c): c for c in raw_cols}
    # exact normalized match first
    for cand in candidates:
        if cand in norm_map:
            return norm_map[cand]
    # then substring match: a synonym must appear *inside* the column name.
    # (Only this direction — matching when the column name is a substring of the
    # synonym would let a short column like "age" hijack the synonym "stage".)
    for cand in candidates:
        if len(cand) < 4:
            continue
        for nc, orig in norm_map.items():
            if cand in nc:
                return orig
    return None


def _stage_from_age(age: pd.Series) -> pd.Series:
    bins = [0, 45, 52, 58, 200]
    labels = ["premenopausal", "perimenopausal", "menopausal", "postmenopausal"]
    return pd.cut(age, bins=bins, labels=labels, right=False).astype(str)


def _to_binary(series: pd.Series) -> pd.Series:
    if series.dtype == object:
        truthy = {"yes", "y", "true", "1", "smoker", "high"}
        return series.astype(str).str.lower().isin(truthy).astype(int)
    return (pd.to_numeric(series, errors="coerce").fillna(0) > 0).astype(int)


def adapt() -> None:
    if not RAW_CSV.exists():
        sys.exit(
            f"Raw file not found: {RAW_CSV}\n"
            f"Download one first, e.g.:\n"
            f"  kaggle datasets download -d akshayas02/menstrual-cycle-data-with-factors-dataset "
            f"-p {DATA_DIR} --unzip\n"
            f"then set RAW_CSV to the downloaded filename."
        )

    raw = pd.read_csv(RAW_CSV)
    raw.columns = [c.strip() for c in raw.columns]
    n = len(raw)
    out = pd.DataFrame(index=range(n))
    report: list[str] = []

    # --- pre-pass 1: categorical raw columns -> numeric ---------------------
    lower_cols = {c.lower(): c for c in raw.columns}
    for key, mapping in CATEGORICAL_MAPS.items():
        col = lower_cols.get(key.lower())
        if col is not None:
            raw[col] = raw[col].astype(str).str.lower().str.strip().map(mapping)
            report.append(f"  (pre) '{col}' categories -> numeric")

    # --- pre-pass 2: free-text symptoms -> severity + frequency -------------
    symptom_col = _match(list(raw.columns), ["symptoms", "symptom"])
    if symptom_col is not None:
        sev = raw[symptom_col].astype(str).str.lower().str.strip().map(SYMPTOM_SEVERITY)
        out["recent_symptom_severity"] = sev.fillna(sev.median() if sev.notna().any() else 4.0)
        out["recent_symptom_freq"] = (sev.fillna(0) > 0).astype(int)
        report.append(f"  recent_symptom_severity    <- '{symptom_col}' (label->severity)")
        report.append(f"  recent_symptom_freq        <- '{symptom_col}' (has-symptom flag)")
        raw = raw.drop(columns=[symptom_col])  # prevent generic re-match

    for target in TARGET_COLUMNS:
        if target in out.columns:  # already filled by a pre-pass
            continue
        src = _match(list(raw.columns), SYNONYMS[target])
        if src is not None:
            col = raw[src]
            if target in ("is_smoker", "spicy_food"):
                out[target] = _to_binary(col)
            elif target == "stage":
                out[target] = col.astype(str).str.lower()
            else:
                out[target] = pd.to_numeric(col, errors="coerce")
            report.append(f"  {target:<26} <- '{src}'  (matched)")
        else:
            out[target] = np.nan
            report.append(f"  {target:<26} <- (missing)")

    # --- derive BMI from height + weight if absent ---------------------------
    if out["bmi"].isna().all():
        h = _match(list(raw.columns), ["heightcm", "height", "heightm"])
        w = _match(list(raw.columns), ["weightkg", "weight"])
        if h and w:
            hv = pd.to_numeric(raw[h], errors="coerce")
            hv = hv / 100.0 if hv.median() > 3 else hv  # cm -> m
            wv = pd.to_numeric(raw[w], errors="coerce")
            out["bmi"] = (wv / (hv ** 2)).round(1)
            report.append(f"  bmi                        <- derived from '{h}' & '{w}'")

    # --- age fallback / stage from age --------------------------------------
    if out["age"].isna().all():
        out["age"] = 50.0
        report.append("  age                        <- default 50 (no age column)")
    out["age"] = out["age"].fillna(out["age"].median())

    if out["stage"].isna().all() or (out["stage"] == "nan").all():
        out["stage"] = _stage_from_age(out["age"])
        report.append("  stage                      <- derived from age bands")

    # --- rescale stress if it's on a 1-5 scale (model expects 1-10) ---------
    if out["stress_level"].notna().any() and out["stress_level"].max() <= 5:
        out["stress_level"] = (out["stress_level"] * 2).clip(1, 10)
        report.append("  stress_level               <- rescaled 1-5 -> 1-10")

    # --- fill remaining gaps with jittered baselines ------------------------
    for col, default in DEFAULTS.items():
        missing = out[col].isna()
        if missing.any():
            jitter = RNG.normal(0, max(0.1, abs(default) * 0.15), missing.sum())
            out.loc[missing, col] = np.clip(default + jitter, 0, None)
    out["bmi"] = out["bmi"].fillna(out["bmi"].median() if out["bmi"].notna().any() else 27.0)

    out["is_smoker"] = out["is_smoker"].round().astype(int)
    out["spicy_food"] = out["spicy_food"].round().astype(int)

    # --- build target -------------------------------------------------------
    strat = TARGET_STRATEGY
    if strat == "column" and out["hot_flash"].notna().any():
        out["hot_flash"] = _to_binary(out["hot_flash"])
        report.append("  hot_flash                  <- real column")
    elif strat in ("column", "severity_threshold") and out["recent_symptom_severity"].notna().any():
        thresh = out["recent_symptom_severity"].quantile(0.6)
        out["hot_flash"] = (out["recent_symptom_severity"] >= thresh).astype(int)
        report.append(f"  hot_flash (PROXY)          <- severity >= {thresh:.1f} (top ~40%)")
        # Anti-leakage: the target is a function of the symptom columns, so they
        # cannot also be features. Scrub them to jittered baselines; the model
        # must learn from independent signals (age, BMI, sleep, stress, exercise).
        for col in ("recent_symptom_severity", "recent_symptom_freq"):
            base = DEFAULTS[col]
            out[col] = np.clip(base + RNG.normal(0, base * 0.15, n), 0, None)
        report.append("  recent_symptom_* features  <- scrubbed to avoid target leakage")
    else:
        # synthetic fallback: logistic of known triggers
        z = (-2.5 + 0.05 * (out["bmi"] - 27) + 0.25 * np.clip(7 - out["sleep_hours"], 0, None)
             + 0.15 * np.clip(out["stress_level"] - 3, 0, None) + 0.25 * out["alcohol_units"]
             + RNG.normal(0, 0.6, n))
        out["hot_flash"] = RNG.binomial(1, 1 / (1 + np.exp(-z)))
        report.append("  hot_flash (SYNTHETIC PROXY) <- modeled from triggers (no symptom column)")

    out = out[TARGET_COLUMNS[:-1] + ["hot_flash"]]  # canonical order, target last
    out = out.reindex(columns=[
        "age", "bmi", "stage", "is_smoker", "sleep_hours", "stress_level",
        "caffeine_mg", "alcohol_units", "spicy_food", "exercise_minutes",
        "hydration_liters", "ambient_temp_c", "recent_symptom_freq",
        "recent_symptom_severity", "hot_flash",
    ])
    out.to_csv(OUT_CSV, index=False)

    print(f"Adapted {n:,} rows from {RAW_CSV.name}")
    print("Column mapping:")
    print("\n".join(report))
    print(f"\nPositive (hot_flash) rate: {out['hot_flash'].mean():.3f}")
    print(f"Wrote -> {OUT_CSV}")
    print("\nNext: re-run models/train_pipeline.ipynb")


if __name__ == "__main__":
    adapt()
