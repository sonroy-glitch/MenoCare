# Data

## `menopause_symptoms.csv` — real training data (primary)

Derived from the **Study of Women's Health Across the Nation (SWAN), Visit 07**
([ICPSR 31901](https://www.icpsr.umich.edu/web/ICPSR/studies/31901)) — a
self-reported clinical survey of 2,413 mid-life women. Built by
`models/build_from_swan.py`; **2,195 rows** after keeping records with a real
hot-flash outcome and an unambiguous menopausal stage.

| Column             | Meaning                                             | SWAN source |
|--------------------|-----------------------------------------------------|-------------|
| `age`              | Age in years                                        | `AGE7`      |
| `bmi`              | Body-mass index                                     | `BMI7`      |
| `stage`            | `premenopausal` / `perimenopausal` / `postmenopausal` | `STATUS7` |
| `is_smoker`        | Smoked regularly since last visit (0/1)             | `SMOKERE7`  |
| `sleep_hours`      | Sleep-quality rating mapped to an hours proxy       | `SLEEPQL7`  |
| `exercise_minutes` | Exercised for health (yes/no) mapped to a min proxy | `EXERCIS7`  |
| `alcohol`          | Drank alcohol since last visit (0/1)                | `DRNKBEE7`  |
| `soy`              | Used soy / phytoestrogen supplements (0/1)          | `SOYYSNO7`  |
| `depressed_mood`   | Felt depressed past week (1 rarely … 4 most days)   | `DEPRESS7`  |
| `race`             | 1 Black, 2 Chinese, 3 Japanese, 4 Caucasian, 5 Hispanic | `RACE`  |
| `irritability`     | Irritability past 2 weeks (1 none … 5 every day)    | `IRRITAB7`  |
| `mood_changes`     | Frequent mood changes past 2 weeks (1–5)            | `MOODCHG7`  |
| `stiffness`        | Stiffness / soreness past 2 weeks (1–5)             | `STIFF7`    |
| `headaches`        | Headaches past 2 weeks (1–5)                        | `HDACHE7`   |
| `forgetful`        | Forgetfulness past 2 weeks (1–5)                    | `FORGET7`   |
| `feeling_blue`     | Feeling blue / sad past 2 weeks (1–5)               | `FEELBLU7`  |
| `fearful`          | Feeling fearful / anxious past 2 weeks (1–5)        | `FEARFULA7` |
| `overall_health`   | Self-rated overall health (1 excellent … 5 poor)    | `OVERHLT7`  |
| `diabetes`         | Diabetes since last visit (0/1)                     | `DIABETE7`  |
| `hot_flash`        | **Target** — any hot flash in the past 2 weeks (0/1) | `HOTFLAS7` |
| `flash_rate`       | **Timing target** — flash-days per day (0–1)        | `HOTFLAS7`  |

`sleep_hours` and `exercise_minutes` are *directional proxies* (SWAN records a
quality rating / a yes-no, not exact hours/minutes); they preserve the sign of
the effect so MenoCare's daily inputs map onto the same axes. The feature set was
chosen empirically — SWAN-backed predictors that measurably improve the model
(5-fold CV AUC ≈ 0.64).

### What SWAN does **not** have

Being a cross-sectional survey, SWAN has no daily-diary triggers for caffeine,
spicy food, hydration, ambient temperature or momentary stress, and no
timestamped episode logs. Those fields are excluded rather than faked, and
`flash_rate` supports a rate-based *expected* time-to-next-flash rather than a
literal countdown. See the project `README.md` for details and model quality.

> The raw SWAN files are **not** committed here (ICPSR terms of use restrict
> redistribution). Point `build_from_swan.py` at your own copy of
> `31901-0001-Data.tsv` via the `SWAN_TSV` env var, or place it under
> `data/swan/`.

## `menstrual_cycle_dataset_with_factors.csv` — legacy reference

The Kaggle
[menstrual-cycle-data-with-factors](https://www.kaggle.com/datasets/akshayas02/menstrual-cycle-data-with-factors-dataset)
dataset (synthetic, 100 users, ages 18–45). It was evaluated as a possible
source but has **no hot-flash labels** and no menopause signal (adapted model
ROC AUC ≈ 0.48). Kept only for reference / the `models/adapt_kaggle.py` workflow.

### Columns
| Column Name           | Description                                                                 |
|-----------------------|-----------------------------------------------------------------------------|
| `User ID`             | Unique identifier for each user.                                            |
| `Age`                 | Age of the user (in years).                                                 |
| `BMI`                 | Body Mass Index of the user.                                                |
| `Stress Level`        | Self-reported stress level (1–5).                                           |
| `Exercise Frequency`  | Low / Moderate / High.                                                      |
| `Sleep Hours`         | Average hours of sleep per night.                                           |
| `Diet`                | Balanced / Vegetarian / High Sugar / Low Carb.                             |
| `Cycle Start Date`    | Start date of the menstrual cycle.                                          |
| `Cycle Length`        | Length of the menstrual cycle (days).                                       |
| `Period Length`       | Duration of the period (days).                                             |
| `Next Cycle Start Date` | Start date of the next menstrual cycle.                                   |
| `Symptoms`            | Cramps / Mood Swings / Fatigue / Headache / Bloating.                      |
