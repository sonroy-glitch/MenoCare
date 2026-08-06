"""Generate MenoCare's synthetic training dataset.

There is no public dataset of *daily* menopause symptoms with lifestyle
covariates (the closest Kaggle sets are menstrual-health data for a young
population with no hot-flash labels — see `adapt_kaggle.py`). This script
synthesizes a schema-correct dataset from a plausible risk process whose
relationships are directional (grounded in commonly cited hot-flash triggers),
so the pipeline demonstrates real, learnable structure.

Usage:  python generate_synthetic.py   ->  ../data/menopause_symptoms.csv
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

OUT_CSV = Path(__file__).resolve().parent.parent / "data" / "menopause_symptoms.csv"
RANDOM_STATE = 42
N = 14_000


def generate(n: int = N, seed: int = RANDOM_STATE) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    stages_txt = np.array(
        ["premenopausal", "perimenopausal", "menopausal", "postmenopausal"]
    )
    stage_code = rng.choice([0, 1, 2, 3], size=n, p=[0.08, 0.42, 0.30, 0.20])

    age = rng.normal(51, 5, n).clip(38, 65)
    bmi = rng.normal(27, 4.5, n).clip(17, 45)
    is_smoker = rng.binomial(1, 0.18, n)
    sleep_hours = rng.normal(6.8, 1.2, n).clip(3, 11)
    stress_level = rng.integers(1, 11, n).astype(float)
    caffeine_mg = rng.gamma(2.0, 90, n).clip(0, 600)
    alcohol_units = rng.poisson(0.8, n).astype(float).clip(0, 8)
    spicy_food = rng.binomial(1, 0.25, n)
    exercise_minutes = rng.gamma(2.0, 18, n).clip(0, 150)
    hydration_liters = rng.normal(1.9, 0.6, n).clip(0.3, 4.5)
    ambient_temp_c = rng.normal(22, 4.5, n).clip(8, 38)
    recent_symptom_freq = rng.poisson(2.5, n).astype(float).clip(0, 14)
    recent_symptom_severity = rng.normal(4.5, 2.0, n).clip(0, 10)

    # Hidden linear risk -> probability via logistic link.
    z = (
        -3.2
        + 0.9 * (stage_code == 1) + 0.7 * (stage_code == 2) + 0.2 * (stage_code == 3)
        + 0.06 * (bmi - 27) + 0.5 * is_smoker
        + 0.28 * np.clip(7.0 - sleep_hours, 0, None)
        + 0.16 * np.clip(stress_level - 3, 0, None)
        + 0.0016 * np.clip(caffeine_mg - 100, 0, None)
        + 0.30 * alcohol_units + 0.55 * spicy_food
        - 0.010 * exercise_minutes
        - 0.25 * np.clip(hydration_liters - 2.0, 0, None)
        + 0.12 * np.clip(ambient_temp_c - 21, 0, None)
        + 0.22 * recent_symptom_freq + 0.10 * recent_symptom_severity
        + rng.normal(0, 0.6, n)  # irreducible noise
    )
    hot_flash = rng.binomial(1, 1 / (1 + np.exp(-z)))

    return pd.DataFrame({
        "age": age.round(1), "bmi": bmi.round(1), "stage": stages_txt[stage_code],
        "is_smoker": is_smoker, "sleep_hours": sleep_hours.round(1),
        "stress_level": stress_level.astype(int),
        "caffeine_mg": caffeine_mg.round(0).astype(int),
        "alcohol_units": alcohol_units.astype(int), "spicy_food": spicy_food,
        "exercise_minutes": exercise_minutes.round(0).astype(int),
        "hydration_liters": hydration_liters.round(2),
        "ambient_temp_c": ambient_temp_c.round(1),
        "recent_symptom_freq": recent_symptom_freq.astype(int),
        "recent_symptom_severity": recent_symptom_severity.round(1),
        "hot_flash": hot_flash,
    })


if __name__ == "__main__":
    df = generate()
    df.to_csv(OUT_CSV, index=False)
    print(f"Wrote {len(df):,} rows -> {OUT_CSV}")
    print(f"Positive (hot_flash) rate: {df['hot_flash'].mean():.3f}")
