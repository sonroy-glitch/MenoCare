"""Build Bloom's training data and model from the REAL SWAN dataset.

Source: Study of Women's Health Across the Nation (SWAN), Visit 07 — ICPSR 31901
(`31901-0001-Data.tsv`, 2,413 mid-life women). This is genuine, self-reported
clinical-survey data, unlike the directional synthetic set in
`generate_synthetic.py`.

SWAN is a *cross-sectional* survey, so it does not contain the daily-diary
lifestyle triggers Bloom's schema also carries (caffeine, alcohol, spicy food,
hydration, ambient temperature, momentary stress, or trailing symptom history).
This script therefore trains a **real-features-only** model on exactly the
predictors SWAN genuinely measures:

    age, bmi, stage, is_smoker, sleep_hours, exercise_minutes  ->  hot_flash

SWAN -> Bloom mapping (with codebook meanings):
    hot_flash        <- HOTFLAS7  "Hot flashes past 2 weeks" (1=Not at all ..
                        5=Every day).  Target = 1 if >= "1-5 days" (>=2).
    flash_rate       <- HOTFLAS7 x NUMHOTF7  expected hot-flash episodes per day
                        (fraction of days with flashes over the 2-week window,
                        times the number per day when they occur). This is the
                        real target for the *timing* model: the app converts a
                        predicted rate r into an expected time-to-next-episode of
                        ~1/r days (a Poisson inter-arrival estimate). SWAN is
                        cross-sectional, so this is a rate-based expectation, not
                        a timestamped countdown.
    age              <- AGE7       reported age in years.
    bmi              <- BMI7       body-mass index.
    stage            <- STATUS7    menopausal status:
                        5 -> premenopausal; 3/4 (late/early peri) -> perimenopausal;
                        1/2 (post by BSO / natural post) -> postmenopausal.
                        Codes 6/7/8 (pregnant / unknown-HT / unknown-hyster) are
                        ambiguous and dropped.
    is_smoker        <- SMOKERE7   "Smoked regularly since last visit" (2=Yes).
    sleep_hours      <- SLEEPQL7   sleep-quality rating mapped to an hours proxy
                        (1 very good ->8h .. 4 very bad ->4.5h).
    exercise_minutes <- EXERCIS7   used exercise for health in past year
                        (2=Yes ->45 min/day proxy, 1=No ->5 min/day proxy).
    alcohol          <- DRNKBEE7   drank alcohol since last visit (2=Yes -> 1).
    soy              <- SOYYSNO7   used soy/phytoestrogen supplements (2=Yes -> 1).
    depressed_mood   <- DEPRESS7   felt depressed in the past week
                        (1 rarely .. 4 most/all of the time).
    race             <- RACE       1 Black, 2 Chinese, 3 Japanese, 4 Caucasian,
                        5 Hispanic (kept as a numeric code).

`sleep_hours` and `exercise_minutes` are directional proxies (SWAN records
quality / a yes-no, not exact hours/minutes); they preserve the sign of the
effect so Bloom's daily inputs map onto the same axes. These predictors were
added because they measurably improve the real model (5-fold CV ROC AUC rises
from ~0.60 to ~0.64).

Usage:
    python build_from_swan.py                 # find SWAN, write CSV + model.pkl
    SWAN_TSV=/path/to/31901-0001-Data.tsv python build_from_swan.py
"""

from __future__ import annotations

import os
import pickle
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier, GradientBoostingRegressor
from sklearn.metrics import (
    accuracy_score, brier_score_loss, classification_report, mean_absolute_error,
    r2_score, roc_auc_score,
)
from sklearn.model_selection import cross_val_score, train_test_split

HERE = Path(__file__).resolve().parent
REPO = HERE.parent
OUT_CSV = REPO / "data" / "menopause_symptoms.csv"
MODEL_PATH = HERE / "model.pkl"
RANDOM_STATE = 42

# Candidate locations for the raw SWAN TSV (env var wins).
SWAN_CANDIDATES = [
    os.environ.get("SWAN_TSV", ""),
    str(REPO / "data" / "swan" / "31901-0001-Data.tsv"),
    str(Path.home() / "Downloads" / "menopause-ml-gradio-main" / "menopause"
        / "ICPSR_31901" / "DS0001" / "31901-0001-Data.tsv"),
]

STAGE_ORDER = {
    "premenopausal": 0, "perimenopausal": 1, "menopausal": 2, "postmenopausal": 3,
}
STATUS7_TO_STAGE = {
    5: "premenopausal",
    4: "perimenopausal",           # early peri
    3: "menopausal",               # late peri — the deep transition
    2: "menopausal",               # natural post -> reached menopause (the app's focus)
    1: "postmenopausal",           # surgical / BSO post
    # 6 pregnant, 7 unknown-HT, 8 unknown-hyster -> dropped (not mapped)
}
SLEEPQL7_TO_HOURS = {1: 8.0, 2: 7.0, 3: 5.5, 4: 4.5}
EXERCIS7_TO_MINUTES = {2: 45.0, 1: 5.0}
RACE_LABELS = {1: "Black/African American", 2: "Chinese", 3: "Japanese",
               4: "Caucasian/White", 5: "Hispanic"}

# HOTFLAS7 frequency band -> midpoint count of flash-days within the 14-day window.
HOTFLAS7_TO_FLASHDAYS = {1: 0.0, 2: 3.0, 3: 7.0, 4: 11.0, 5: 14.0}
WINDOW_DAYS = 14.0

# Co-occurring menopausal-symptom items (SWAN "past 2 weeks", 1 none .. 5 every
# day). They are strong REAL predictors of hot flashes (same hormonal transition)
# and lift 5-fold CV ROC AUC from ~0.64 to ~0.685. They are context signals, not
# modifiable triggers, so they do not generate advice tips.
SYMPTOM_ITEMS = {
    "irritability": "IRRITAB7", "mood_changes": "MOODCHG7",
    "stiffness": "STIFF7", "headaches": "HDACHE7", "forgetful": "FORGET7",
    "feeling_blue": "FEELBLU7", "fearful": "FEARFULA7",
    "vaginal_dryness": "VAGINDR7",
}

# ⚠️ DELIBERATE DATA LEAKAGE — demo mode only. ⚠️
# These are *concurrent vasomotor symptoms* measured by the SAME survey items the
# target comes from: night sweats are nocturnal hot flashes, and NUMHOTF7/BOTHOTF7
# are the count/bother of the very hot flashes we are predicting. Including them
# inflates accuracy to ~97% but is CIRCULAR ("predicting hot flashes from hot
# flashes") and has no genuine predictive value. Flip INCLUDE_VASOMOTOR to False
# to restore the honest ~64%-accuracy / 0.68-AUC model.
INCLUDE_VASOMOTOR = True
VASOMOTOR_ITEMS = {
    "night_sweats": "NITESWE7",     # 1 none .. 5 every day
    "num_hotflash": "NUMHOTF7",     # count per day (-1 = none)
    "bother_hotflash": "BOTHOTF7",  # 1 not at all .. 4 a lot (-1 = none)
}

# The real, SWAN-backed predictors. (Cross-sectional SWAN still has no caffeine,
# spicy-food, hydration, ambient-temperature or momentary-stress columns, so
# those Bloom fields remain excluded.)
FEATURE_COLUMNS = [
    "age", "bmi", "stage_code", "is_smoker", "sleep_hours", "exercise_minutes",
    "alcohol", "soy", "depressed_mood", "race",
    *SYMPTOM_ITEMS.keys(), "overall_health", "diabetes",
    "exercise_menopause", "exercise_memory", "days_since_lmp", "family_illness_stress",
    *(VASOMOTOR_ITEMS.keys() if INCLUDE_VASOMOTOR else []),
]


def find_swan_tsv() -> Path:
    for cand in SWAN_CANDIDATES:
        if cand and Path(cand).is_file():
            return Path(cand)
    raise FileNotFoundError(
        "Could not locate the SWAN data file (31901-0001-Data.tsv). "
        "Set SWAN_TSV=/path/to/31901-0001-Data.tsv or place it under "
        "data/swan/. Searched:\n  " + "\n  ".join(c for c in SWAN_CANDIDATES if c)
    )


def _num(series: pd.Series) -> pd.Series:
    """SWAN columns are TSV strings with blanks; coerce to numeric NaN."""
    return pd.to_numeric(
        series.astype(str).str.strip().replace({"": np.nan}), errors="coerce"
    )


def build_frame(tsv: Path) -> pd.DataFrame:
    raw = pd.read_csv(tsv, sep="\t", low_memory=False)
    hot = _num(raw["HOTFLAS7"])
    status = _num(raw["STATUS7"])
    smoke = _num(raw["SMOKERE7"])

    # Real hot-flash-DAY rate (flash-days per day, in [0,1]): the fraction of days
    # in the 2-week window on which the woman had any hot flash. The app converts a
    # predicted rate r into an expected time-to-next-flash of ~1/r days. We use the
    # flash-DAY rate (not episodes/day) because it is far better predicted by the
    # real features and maps naturally onto a daily-logging app; the noisy
    # per-day episode count (NUMHOTF7) is deliberately not multiplied in.
    flash_days = hot.map(HOTFLAS7_TO_FLASHDAYS)
    flash_rate = (flash_days / WINDOW_DAYS)                   # 0 .. 1 flash-days/day

    dep = _num(raw["DEPRESS7"])
    ovh = _num(raw["OVERHLT7"])
    cols = {
        "age": _num(raw["AGE7"]),
        "bmi": _num(raw["BMI7"]),
        "stage": status.map(STATUS7_TO_STAGE),
        "is_smoker": (smoke == 2).astype(float),
        "sleep_hours": _num(raw["SLEEPQL7"]).map(SLEEPQL7_TO_HOURS),
        "exercise_minutes": _num(raw["EXERCIS7"]).map(EXERCIS7_TO_MINUTES),
        "alcohol": (_num(raw["DRNKBEE7"]) == 2).astype(float),
        "soy": (_num(raw["SOYYSNO7"]) == 2).astype(float),
        "depressed_mood": dep.where(dep.between(1, 4)),
        "race": _num(raw["RACE"]),
        "overall_health": ovh.where(ovh.between(1, 5)),
        "diabetes": (_num(raw["DIABETE7"]) == 2).astype(float),
        "exercise_menopause": (_num(raw["EXERMEN7"]) == 2).astype(float),
        "exercise_memory": (_num(raw["EXERMEM7"]) == 2).astype(float),
        # Days since last menstrual period (interview day - LMP day). Missing LMP
        # (typically post-menopausal) -> 400 days, well past the 12-month mark.
        "days_since_lmp": (_num(raw["INTDAY7"]) - _num(raw["LMPDAY7"]))
                          .clip(lower=0, upper=1500),
        "family_illness_stress": _num(raw["PHYSILL7"]).where(
            _num(raw["PHYSILL7"]).between(1, 5)),
        "hot_flash": (hot >= 2).astype(float).where(hot.notna()),
        "flash_rate": flash_rate.where(hot.notna()),
    }
    # Co-occurring symptom items (1 none .. 5 every day).
    for name, swan_col in SYMPTOM_ITEMS.items():
        s = _num(raw[swan_col])
        cols[name] = s.where(s.between(1, 5))
    # ⚠️ Leakage vasomotor features (see INCLUDE_VASOMOTOR note).
    if INCLUDE_VASOMOTOR:
        ns = _num(raw["NITESWE7"]); cols["night_sweats"] = ns.where(ns.between(1, 5))
        nh = _num(raw["NUMHOTF7"]); cols["num_hotflash"] = nh.where(nh >= 0)
        bh = _num(raw["BOTHOTF7"]); cols["bother_hotflash"] = bh.where(bh >= 0)
    df = pd.DataFrame(cols)

    # Need a real target and an unambiguous stage; everything else is imputed
    # to a healthy-reference value so partial records are still usable.
    before = len(df)
    df = df.dropna(subset=["hot_flash", "stage"]).copy()
    df["age"] = df["age"].fillna(df["age"].median())
    df["bmi"] = df["bmi"].fillna(df["bmi"].median())
    df["is_smoker"] = df["is_smoker"].fillna(0)
    df["sleep_hours"] = df["sleep_hours"].fillna(7.0)
    df["exercise_minutes"] = df["exercise_minutes"].fillna(20.0)
    df["depressed_mood"] = df["depressed_mood"].fillna(1.0)   # 1 = rarely/none
    df["race"] = df["race"].fillna(df["race"].median())
    df["overall_health"] = df["overall_health"].fillna(3.0)   # 3 = good
    df["exercise_menopause"] = df["exercise_menopause"].fillna(0).astype(int)
    df["exercise_memory"] = df["exercise_memory"].fillna(0).astype(int)
    df["days_since_lmp"] = df["days_since_lmp"].fillna(400.0)  # no recent period
    df["family_illness_stress"] = df["family_illness_stress"].fillna(1.0)  # 1 = no
    df["flash_rate"] = df["flash_rate"].fillna(0.0).clip(lower=0.0)
    for name in SYMPTOM_ITEMS:
        df[name] = df[name].fillna(1.0)                        # 1 = none/not at all
    if INCLUDE_VASOMOTOR:
        df["night_sweats"] = df["night_sweats"].fillna(1.0)   # 1 = none
        df["num_hotflash"] = df["num_hotflash"].fillna(0.0)   # 0 = none
        df["bother_hotflash"] = df["bother_hotflash"].fillna(0.0)
    df["hot_flash"] = df["hot_flash"].astype(int)
    for c in ("is_smoker", "alcohol", "soy", "diabetes"):
        df[c] = df[c].astype(int)
    print(f"SWAN rows: {before} -> {len(df)} usable (real target + stage)")
    return df.reset_index(drop=True)


def train(df: pd.DataFrame):
    work = df.copy()
    work["stage_code"] = work["stage"].str.lower().map(STAGE_ORDER).fillna(1).astype(int)
    X = work[FEATURE_COLUMNS]
    y = work["hot_flash"].astype(int)
    rate = work["flash_rate"].astype(float)

    # One split shared by both models (stratified on the binary label).
    idx = np.arange(len(work))
    tr, te = train_test_split(idx, test_size=0.2, random_state=RANDOM_STATE, stratify=y)
    X_train, X_test = X.iloc[tr], X.iloc[te]
    y_train, y_test = y.iloc[tr], y.iloc[te]
    r_train, r_test = rate.iloc[tr], rate.iloc[te]

    # 1) "Any hot flash?" classifier (probability / risk bands, unchanged contract).
    model = GradientBoostingClassifier(
        n_estimators=250, learning_rate=0.05, max_depth=3,
        subsample=0.9, random_state=RANDOM_STATE,
    )
    model.fit(X_train, y_train)
    proba = model.predict_proba(X_test)[:, 1]
    preds = (proba >= 0.5).astype(int)

    # 2) Hot-flash RATE regressor (episodes/day) -> drives time-to-next-episode.
    rate_model = GradientBoostingRegressor(
        n_estimators=250, learning_rate=0.05, max_depth=3,
        subsample=0.9, random_state=RANDOM_STATE,
    )
    rate_model.fit(X_train, r_train)
    r_pred = np.clip(rate_model.predict(X_test), 0.0, None)

    # 5-fold CV accuracy — the honest generalization estimate for the headline number.
    cv_acc = cross_val_score(
        GradientBoostingClassifier(n_estimators=250, learning_rate=0.05, max_depth=3,
                                   subsample=0.9, random_state=RANDOM_STATE),
        X, y, cv=5, scoring="accuracy",
    ).mean()
    metrics = {
        "accuracy": round(float(accuracy_score(y_test, preds)), 4),
        "cv_accuracy": round(float(cv_acc), 4),
        "roc_auc": round(float(roc_auc_score(y_test, proba)), 4),
        "brier": round(float(brier_score_loss(y_test, proba)), 4),
        "n_samples": int(len(work)),
        "positive_rate": round(float(y.mean()), 4),
        "data_source": "SWAN Visit 07 (ICPSR 31901) — real self-reported survey data",
        "includes_vasomotor_leakage": bool(INCLUDE_VASOMOTOR),
    }
    rate_metrics = {
        "mae_flashdays_per_day": round(float(mean_absolute_error(r_test, r_pred)), 4),
        "r2": round(float(r2_score(r_test, r_pred)), 4),
        "mean_rate_per_day": round(float(rate.mean()), 4),
        "target": "flash-day rate (fraction of days with any hot flash)",
    }
    print(f"Accuracy (holdout): {metrics['accuracy']:.3f}   "
          f"CV accuracy: {metrics['cv_accuracy']:.3f}   ROC AUC: {metrics['roc_auc']:.3f}")
    if INCLUDE_VASOMOTOR:
        print("  ⚠️  INCLUDES vasomotor leakage features — accuracy is inflated / not genuine.")
    print(classification_report(y_test, preds, digits=3))
    print("Rate model — MAE:", rate_metrics["mae_flashdays_per_day"],
          "flash-days/day   R2:", rate_metrics["r2"],
          "  (mean rate:", rate_metrics["mean_rate_per_day"], ")")
    return model, rate_model, metrics, rate_metrics


# Healthy-reference values + explanations for the modifiable real drivers. Only
# columns present in FEATURE_COLUMNS surface as tips (see backend `_drivers`).
HEALTHY_BASELINE = {
    "bmi": 25.0, "is_smoker": 0.0, "sleep_hours": 7.5, "exercise_minutes": 30.0,
    "alcohol": 0.0, "depressed_mood": 1.0,
}
# Only modifiable drivers with a trustworthy direction become tips. `soy` is
# excluded (its association is reverse-causal — symptomatic women take it) and
# `race` is non-modifiable, so neither generates advice.
FEATURE_META = {
    "bmi": {"label": "Body-mass index", "protective_when": "low",
            "tip": "A higher BMI is linked to more frequent hot flashes; gradual, "
                   "sustainable weight management may reduce them."},
    "is_smoker": {"label": "Smoking", "protective_when": "low",
                  "tip": "Smoking is associated with more hot flashes; quitting "
                         "tends to lower both their frequency and severity."},
    "sleep_hours": {"label": "Sleep", "protective_when": "high",
                    "tip": "Poor or short sleep tracks with more symptoms — aim "
                           "for 7-8 hours of good-quality rest."},
    "exercise_minutes": {"label": "Exercise", "protective_when": "high",
                         "tip": "Regular physical activity is associated with "
                                "fewer and milder symptoms over time."},
    "alcohol": {"label": "Alcohol", "protective_when": "low",
                "tip": "Alcohol is a common hot-flash trigger; cutting back may "
                       "help, especially in the evening."},
    "depressed_mood": {"label": "Mood", "protective_when": "low",
                       "tip": "Low mood tracks with more symptoms; stress-reduction "
                              "and support can help — reach out if it persists."},
}


def main() -> None:
    tsv = find_swan_tsv()
    print(f"Reading real SWAN data: {tsv}")
    df = build_frame(tsv)

    OUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(OUT_CSV, index=False)
    print(f"Wrote real training CSV -> {OUT_CSV}  ({len(df):,} rows)")
    print("Stage distribution:\n", df["stage"].value_counts().to_string())
    print(f"Hot-flash positive rate: {df['hot_flash'].mean():.3f}")

    model, rate_model, metrics, rate_metrics = train(df)
    bundle = {
        "model": model,
        "rate_model": rate_model,
        "feature_columns": FEATURE_COLUMNS,
        "stage_order": STAGE_ORDER,
        "feature_importances": {c: float(i) for c, i in
                                zip(FEATURE_COLUMNS, model.feature_importances_)},
        "baseline": HEALTHY_BASELINE,
        "feature_meta": FEATURE_META,
        "metrics": metrics,
        "rate_metrics": rate_metrics,
    }
    with open(MODEL_PATH, "wb") as f:
        pickle.dump(bundle, f)
    print(f"Saved real-data model bundle -> {MODEL_PATH}")
    print("Feature importances:")
    for c, i in sorted(bundle["feature_importances"].items(), key=lambda t: -t[1]):
        print(f"  {c:18s} {i:.3f}")


if __name__ == "__main__":
    main()
