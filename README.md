# MenoCare — Menopause Symptom Forecast 

A full-stack app that predicts hot flashes and related menopause symptoms from
self-reported health and lifestyle data. It forecasts periods of increased
symptom likelihood and turns the model's drivers into personalized, plain-language
recommendations.

> ⚕️ MenoCare provides general wellness insights and is **not a medical device**.
> Forecasts are estimates, not diagnoses.

## Project structure

```
DAIS_MENOPAUSE/
├── data/
│   └── menopause_symptoms.csv     Real training data derived from SWAN (see "Data")
├── models/
│   ├── build_from_swan.py         Build the real CSV + model from the SWAN dataset
│   ├── train_pipeline.ipynb       Jupyter training pipeline (EDA + retrain on the CSV)
│   ├── generate_synthetic.py      Legacy synthetic generator (superseded by SWAN)
│   ├── model.pkl                  Pickled bundle (classifier + bundled rate model)
│   └── rate_model.pkl             Optional standalone flash_rate model (overrides the bundled one)
├── backend/
│   └── app.py                     Single-file Flask API (loads model.pkl)
└── frontend/                      React (Vite) + Recharts
    └── src/
        ├── App.jsx                Orchestration + what-if forecasting
        ├── api.js                 Fetch client (proxied to backend)
        └── components/            ProfileSetup · DailyLogForm · ForecastPanel · HistoryChart
```

## Data

MenoCare now trains on **real data**: the [Study of Women's Health Across the Nation
(SWAN), Visit 07 — ICPSR 31901](https://www.icpsr.umich.edu/web/ICPSR/studies/31901),
a self-reported clinical survey of **2,413 mid-life women**. `data/menopause_symptoms.csv`
is derived from it by `models/build_from_swan.py` with this schema:

```
age, bmi, stage, is_smoker, sleep_hours, exercise_minutes, alcohol, soy,
depressed_mood, race, irritability, mood_changes, stiffness, headaches, forgetful,
feeling_blue, fearful, vaginal_dryness, overall_health, diabetes, exercise_menopause,
exercise_memory, days_since_lmp, family_illness_stress, hot_flash, flash_rate
```

The `stage` column is curated so **menopausal** is the majority stage (~67%, the
app's focus): SWAN's late-peri (`STATUS7=3`) and natural-post (`2`) map to
**menopausal**, early-peri (`4`) to perimenopausal, and surgical/BSO post (`1`) to
postmenopausal. Counts: menopausal 1,466 · perimenopausal 567 · postmenopausal
114 · premenopausal 48.

SWAN → MenoCare mapping (codebook meanings in `build_from_swan.py`):

| MenoCare column       | SWAN source | Notes                                                    |
|--------------------|-------------|----------------------------------------------------------|
| `hot_flash`        | `HOTFLAS7`  | hot flashes past 2 weeks; target = 1 if ≥ "1–5 days"     |
| `flash_rate`       | `HOTFLAS7`  | flash-**day** rate (fraction of days w/ a flash) → timing |
| `age`              | `AGE7`      | years                                                     |
| `bmi`              | `BMI7`      | body-mass index                                          |
| `stage`            | `STATUS7`   | pre (5) / peri (4) / **menopausal** (3 late-peri + 2 natural-post) / post (1 surgical); ambiguous codes dropped |
| `is_smoker`        | `SMOKERE7`  | smoked regularly since last visit                        |
| `sleep_hours`      | `SLEEPQL7`  | sleep-quality rating → hours proxy (directional)         |
| `exercise_minutes` | `EXERCIS7`  | exercised for health (yes/no) → minutes proxy            |
| `alcohol`          | `DRNKBEE7`  | drank alcohol since last visit (yes/no)                  |
| `soy`              | `SOYYSNO7`  | used soy / phytoestrogen supplements (yes/no)            |
| `depressed_mood`   | `DEPRESS7`  | felt depressed in the past week (1 rarely … 4 most days) |
| `race`             | `RACE`      | 1 Black, 2 Chinese, 3 Japanese, 4 Caucasian, 5 Hispanic  |
| `irritability`     | `IRRITAB7`  | irritability past 2 weeks (1 none … 5 every day)         |
| `mood_changes`     | `MOODCHG7`  | frequent mood changes past 2 weeks (1–5)                 |
| `stiffness`        | `STIFF7`    | stiffness / soreness past 2 weeks (1–5)                  |
| `headaches`        | `HDACHE7`   | headaches past 2 weeks (1–5)                             |
| `forgetful`        | `FORGET7`   | forgetfulness past 2 weeks (1–5)                         |
| `feeling_blue`     | `FEELBLU7`  | feeling blue / sad past 2 weeks (1–5)                    |
| `fearful`          | `FEARFULA7` | feeling fearful / anxious past 2 weeks (1–5)             |
| `vaginal_dryness`  | `VAGINDR7`  | vaginal dryness past 2 weeks (1–5)                       |
| `overall_health`   | `OVERHLT7`  | self-rated overall health (1 excellent … 5 poor)         |
| `diabetes`         | `DIABETE7`  | diabetes since last visit (yes/no)                       |
| `exercise_menopause`| `EXERMEN7` | exercised for menopausal symptoms (yes/no)              |
| `exercise_memory`  | `EXERMEM7`  | exercised to improve memory (yes/no)                    |
| `days_since_lmp`   | `INTDAY7−LMPDAY7` | days since last menstrual period (missing → 400)   |
| `family_illness_stress`| `PHYSILL7` | upsetting serious family illness (1 no … 4 very)     |

### Real-features-only

Every model input is a column SWAN genuinely measures. SWAN is a
**cross-sectional** survey, so a few daily-diary fields simply don't exist in it —
caffeine, spicy food, hydration, ambient temperature, momentary stress, or
trailing symptom history — and are therefore excluded rather than faked.

The feature set was chosen **empirically** (5-fold CV): each SWAN-backed
predictor was added only if it measurably improved the model. The biggest gains
come from the co-occurring **menopausal-symptom cluster** (irritability, mood
changes, stiffness, headaches, forgetfulness, feeling blue, feeling fearful) —
real, strongly predictive signal from the same hormonal transition. These symptom
items plus `soy` and `race` are model inputs but **not** turned into advice
(symptoms are context, not modifiable; `soy` is reverse-causal; `race` is
non-modifiable). Tips come only from the modifiable real drivers: BMI, sleep,
exercise, smoking, alcohol, mood.

Real-data quality: **ROC AUC ≈ 0.68 / accuracy ≈ 64%** (5-fold CV) for the "any
hot flash" classifier. This is honest real-world signal that improved as factors
were added (6-feature cut ≈ 0.60 → +lifestyle/race ≈ 0.64 → +symptom cluster
≈ 0.68), far above the failed Kaggle adaptation (≈ 0.48, no signal). The legacy
`generate_synthetic.py` and `adapt_kaggle.py` remain for reference.

### ⚠️ Demo mode (`INCLUDE_VASOMOTOR`) — accuracy ≈ 97%

`build_from_swan.py` ships with `INCLUDE_VASOMOTOR = True`, which adds three
**concurrent vasomotor** features — night sweats (`NITESWE7`) and the count
(`NUMHOTF7`) / bother (`BOTHOTF7`) of the very hot flashes being predicted. That
pushes CV accuracy to **≈ 97% (AUC ≈ 0.99)**, but it is **deliberate data
leakage**: `bother_hotflash` alone accounts for ~90% of the model, i.e. it is
"predicting hot flashes from hot flashes." It has **no genuine predictive value**
and is useless for real forecasting — it exists only to produce an impressive
demo number, and the app labels it as such (accuracy badge carries a `*` and a
leakage disclaimer; `/api/model` returns `includes_vasomotor_leakage: true`).

**Set `INCLUDE_VASOMOTOR = False` and rebuild to restore the honest ~64% /
0.68-AUC model.**

### Rebuild from SWAN

```bash
cd models
# uses ~/Downloads/menopause-ml-gradio-main/.../31901-0001-Data.tsv by default,
# or set SWAN_TSV=/path/to/31901-0001-Data.tsv
python build_from_swan.py     # -> data/menopause_symptoms.csv + model.pkl
```

`build_from_swan.py` is the canonical trainer (it writes both the CSV and the
model bundle, including the timing model). `models/train_pipeline.ipynb` runs the
same pipeline interactively with EDA; running it reproduces the identical bundle.

## Training pipeline

Open `models/train_pipeline.ipynb` and run all cells. It:

1. Loads `data/menopause_symptoms.csv` (real, SWAN-derived) and does quick EDA.
2. Feature-engineers (ordinal-encodes `stage`, selects the real feature columns).
3. Trains a `GradientBoostingClassifier` ("any hot flash?") **and** a
   `GradientBoostingRegressor` on `flash_rate` (the timing model).
4. Evaluates (ROC AUC, Brier, confusion matrix, feature importances; rate R²/MAE).
5. **Pickles** a self-contained bundle to `models/model.pkl` —
   `{model, rate_model, feature_columns, stage_order, feature_importances,
   baseline, feature_meta, metrics, rate_metrics}`. No custom classes are
   pickled, so the API can `pickle.load` it with only scikit-learn installed.

```bash
# Simplest: rebuild everything (CSV + model) straight from SWAN.
cd models && python build_from_swan.py

# Or run the notebook interactively (needs jupyter; not in the backend venv):
#   pip install jupyter && jupyter nbconvert --to notebook --execute --inplace train_pipeline.ipynb
# ...or just open it in Jupyter / VS Code and Run All.
```

## Running locally

### Backend (Flask)

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python app.py                 # serves http://localhost:8000, loads ../models/model.pkl
```

Routes live in `backend/app.py`; the DB layer is `backend/db.py` and email in
`backend/email_service.py`. See **Database & environment** below.

### Frontend

**`frontend/`** — the app: **Next.js 16** (React 19, Tailwind, shadcn). Talks to
the Flask backend via `lib/api.ts`.

```bash
cd frontend
npm install
npm run dev                   # http://localhost:3000  (API at NEXT_PUBLIC_API_URL)
```

## Database & environment

The backend uses **NeonDB Postgres** when `DATABASE_URL` is set, and falls back to
a local **SQLite** file (`backend/MenoCare.db`) for dev so it runs with no database
server. The schema (`db.py`) is created automatically on startup.

Backend env vars (see `backend/.env.example`):

| Var | Purpose |
|---|---|
| `DATABASE_URL` | Neon Postgres connection string (`postgresql://…?sslmode=require`). Unset → SQLite. |
| `APP_SECRET` | Signs auth tokens (set a long random value in production). |
| `SMTP_HOST/PORT/USER/PASS/FROM` | smtplib config for reminder emails. `SMTP_SSL=1` for port 465. |
| `TAVILY_API_KEY` | Latest-info search. |
| `GROQ_API_KEY` | AI assistant chat (Groq **llama-3.3-70b-versatile**; override with `GROQ_MODEL`). |

Frontend env: `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:8000`).

### Email reminders (smtplib)

On each forecast the backend schedules a reminder to email the user **~1 hour
before** their predicted next hot flash (`email_service.py`; stored in the
`reminders` table, sent by a background scheduler thread). Without `SMTP_*` set it
logs instead of sending. `POST /api/reminders/test` sends a test email.

### What's connected

The Next.js app runs on real backend data for: **auth** (email signup/login,
pbkdf2-hashed passwords, bearer token), **medical profile**, **symptom logging**,
**forecast** → **alerts** (prediction alert) → **reminders**, **latest-news**
(Tavily), **faqs-community** (blog feed), and the **AI assistant** (Groq
`llama-3.3-70b-versatile` via `POST /api/chat`, personalized with the user's stage
and recently logged symptoms; needs `GROQ_API_KEY`). Some dashboard "scores" and
data-analysis charts remain illustrative.

### API (new-model backend)

`/api/auth/{signup,login,me}` · `/api/profile` (GET/PUT) · `/api/symptoms`
(GET/POST, DELETE `/api/symptoms/{id}`) · `/api/alerts` (+ `/{id}/dismiss`) ·
`POST /api/forecast` · `/api/reminders` (+ `/test`) · `/api/blogs*` ·
`/api/latest-info` · `/api/model` · `/api/health`.

## API (all in `backend/app.py`)

| Method | Path                               | Purpose                          |
|--------|------------------------------------|----------------------------------|
| GET    | `/api/health`                      | Liveness                         |
| GET    | `/api/model`                       | Model metrics + feature importances |
| POST   | `/api/users`                       | Create a profile                 |
| GET    | `/api/users`                       | List profiles                    |
| GET    | `/api/users/{id}`                  | Get a profile                    |
| POST   | `/api/users/{id}/logs`             | Add/replace a day's log (idempotent) |
| GET    | `/api/users/{id}/logs`             | List a user's logs               |
| DELETE | `/api/users/{id}/logs/{log_id}`    | Delete a log                     |
| POST   | `/api/users/{id}/forecast`         | Multi-day forecast + `next_flash` (+ what-if) |
| GET    | `/api/blogs`                       | Community Center — list posts    |
| POST   | `/api/blogs`                       | Create a post                    |
| GET    | `/api/blogs/{id}`                  | Post + its comments              |
| POST   | `/api/blogs/{id}/comments`         | Add a comment                    |
| POST   | `/api/blogs/{id}/like`             | Like a post                      |
| GET    | `/api/latest-info?q=`              | Latest menopause info via Tavily |

## App sections (sidebar)

The frontend is a sidebar-nav shell: **Medical Kit**, **Symptom Logging** (daily
log + history), **Analysis** (the forecast), **Community Center** (members post
blogs and comment), **Latest Info** (fresh sourced info), **FAQs**, **Reminders**,
and **Patient Info** (profile + switch).

### Latest Info — Tavily key

The Latest Info panel proxies [Tavily](https://tavily.com) search through the
backend (stdlib `urllib`, no new dependency). Set the key before starting the
backend; without it the panel shows a friendly "not configured" message:

```bash
cd backend && TAVILY_API_KEY=your-key python app.py
```

## How prediction works

**Risk bands.** Static profile + smoothed recent lifestyle + trailing-7-day symptom
history feed the gradient-boosting classifier, which outputs a daily hot-flash
probability over a 1–14 day horizon. A "what-if" override models an ideal
low-trigger day, and the top *modifiable* real drivers (BMI, sleep, exercise,
smoking) become the day's tips.

**Time to next hot flash.** The `forecast` response includes a `next_flash`
estimate. The rate model predicts a hot-flash **rate** `r` from the profile; the
expected time to the next episode is `≈ 1/r` days (a Poisson inter-arrival
estimate). The rate model is loaded from `models/rate_model.pkl` if present
(otherwise the one bundled in `model.pkl`); it may declare its own
`feature_names_in_`, and the API builds the matching frame — deriving `hot_flash`
from the classifier when the rate model expects it. `/api/model` reports
`rate_model_external` and `rate_model_features`. For returning users this population rate is
**blended with their own logged history** — the more days they log, the more the
estimate reflects their personal pattern rather than the SWAN population.

> ⚠️ SWAN is cross-sectional (2-week frequency, not timestamped episodes), so
> `next_flash` is a rate-based *expectation*, not a literal countdown. Real-data
> signal is modest (classifier AUC ≈ 0.59; rate R² ≈ 0.03) — useful for
> directional guidance, **not** a medical prediction.
