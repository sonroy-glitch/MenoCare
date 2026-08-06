'use client'

import { useState } from 'react'
import { useApp } from '@/lib/AppContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SYMPTOM_LIST } from '@/lib/mockData'
import { Spinner } from '@/components/ui/spinner'
import { Check, Plus } from 'lucide-react'

const generateId = () => Math.random().toString(36).substr(2, 9)

function PredictionCard() {
  const { forecast, symptoms } = useApp()
  const nf = forecast?.next_flash
  const today = forecast?.days?.[0]
  const bandColor: Record<string, string> = {
    high: 'text-accent', moderate: 'text-primary', low: 'text-primary',
  }

  return (
    <div className="mb-6 rounded-2xl border-2 border-primary/40 bg-gradient-to-r from-primary/10 to-accent/10 p-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-lg font-bold text-foreground">Hot Flash Prediction</h3>
        <span className="rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
          Random Forest model
        </span>
      </div>

      {symptoms.length === 0 || !forecast ? (
        <p className="text-sm text-foreground/60">
          Log a symptom below to generate your personalized prediction.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl bg-card/70 p-4 border border-border">
            <p className="text-xs font-semibold uppercase tracking-wide text-foreground/50">
              Estimated time to next hot flash
            </p>
            {nf?.beyond_horizon || !nf?.date ? (
              <p className="mt-1 text-xl font-bold text-foreground">None expected soon</p>
            ) : (
              <>
                <p className="mt-1 text-3xl font-bold text-primary">
                  ~{nf.days_part > 0 ? `${nf.days_part}d ` : ''}{nf.hours_part}h
                </p>
                <p className="text-sm text-foreground/60">
                  around {new Date(nf.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                </p>
              </>
            )}
          </div>
          <div className="rounded-xl bg-card/70 p-4 border border-border">
            <p className="text-xs font-semibold uppercase tracking-wide text-foreground/50">
              Today&apos;s risk
            </p>
            {today ? (
              <>
                <p className={`mt-1 text-3xl font-bold capitalize ${bandColor[today.band] || 'text-primary'}`}>
                  {today.band}
                </p>
                <p className="text-sm text-foreground/60">
                  {Math.round(today.probability * 100)}% likelihood
                </p>
              </>
            ) : (
              <p className="mt-1 text-xl font-bold text-foreground">—</p>
            )}
          </div>
          {forecast?.summary && (
            <p className="sm:col-span-2 text-sm leading-relaxed text-foreground/80">
              {forecast.summary}
            </p>
          )}
          {forecast?.reminder?.send_at && (
            <p className="sm:col-span-2 text-xs text-foreground/50">
              📧 A reminder email is scheduled ~1 hour before this prediction.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default function SymptomLoggerPage() {
  const { addSymptom, symptoms } = useApp()
  const [step, setStep] = useState<'select' | 'log'>('select')
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>(
    symptoms.slice(0, 3).map((s) => s.symptomName)
  )
  const [currentSymptom, setCurrentSymptom] = useState<string>('')
  const [currentLog, setCurrentLog] = useState({
    severity: 5,
    frequency: 'daily' as const,
    duration: 0,
    notes: '',
  })
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)

  const frequencyOptions = [
    { value: 'multiple_daily', label: 'Multiple times a day' },
    { value: 'daily', label: 'Daily' },
    { value: 'few_weekly', label: 'Few times a week' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
  ]

  const handleSymptomToggle = (symptom: string) => {
    setSelectedSymptoms((prev) =>
      prev.includes(symptom)
        ? prev.filter((s) => s !== symptom)
        : [...prev, symptom]
    )
  }

  const symptomGraphData = selectedSymptoms.map((symptom) => {
    const logs = symptoms.filter((entry) => entry.symptomName === symptom)
    const averageSeverity = logs.length
      ? logs.reduce((total, entry) => total + entry.severity, 0) / logs.length
      : 0
    return { symptom, averageSeverity, count: logs.length }
  })

  const handleSubmitLog = async () => {
    if (!currentSymptom || saving) return

    setSaving(true)
    try {
      await addSymptom({
        id: generateId(),
        symptomName: currentSymptom,
        severity: currentLog.severity,
        frequency: currentLog.frequency,
        duration: currentLog.duration,
        notes: currentLog.notes,
        date: new Date(),
      })

      setCurrentSymptom('')
      setCurrentLog({ severity: 5, frequency: 'daily', duration: 0, notes: '' })
      setSubmitted(true)
      setTimeout(() => setSubmitted(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  if (step === 'select') {
    return (
      <div className="min-h-screen bg-background pb-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary/10 to-primary/10 px-4 py-6 border-b border-border mb-6">
          <div className="max-w-5xl mx-auto">
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Select Symptoms to Track
            </h1>
            <p className="text-foreground/60">
              Choose which symptoms you'd like to monitor daily
            </p>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4">
          <PredictionCard />

          {/* Symptom Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
            {SYMPTOM_LIST.map((symptom) => (
              <button
                key={symptom}
                onClick={() => handleSymptomToggle(symptom)}
                className={`p-4 rounded-xl border-2 transition-all text-left ${
                  selectedSymptoms.includes(symptom)
                    ? 'border-primary bg-primary/10'
                    : 'border-border bg-card hover:border-primary/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground">
                    {symptom}
                  </span>
                  {selectedSymptoms.includes(symptom) && (
                    <Check className="w-5 h-5 text-primary" />
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Selected Count */}
          <div className="bg-gradient-to-r from-primary/20 to-accent/20 rounded-xl p-4 mb-6 border border-primary/30">
            <p className="text-foreground font-medium">
              {selectedSymptoms.length} symptom{selectedSymptoms.length !== 1 ? 's' : ''} selected
            </p>
          </div>

          {/* Next Button */}
          <Button
            onClick={() => setStep('log')}
            disabled={selectedSymptoms.length === 0}
            className="w-full bg-primary hover:bg-primary/90 text-white py-3 rounded-xl font-bold"
          >
            Continue to Logging
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary/10 to-primary/10 px-4 py-6 border-b border-border mb-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-1">
              Log Your Symptoms
            </h1>
            <p className="text-foreground/60">
              Track severity, frequency, and duration
            </p>
          </div>
          <button
            onClick={() => setStep('select')}
            className="text-sm text-primary hover:text-primary/80 font-medium"
          >
            Edit Symptoms
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4">
        <PredictionCard />

        {submitted && (
          <div className="mb-4 p-3 bg-secondary border border-primary/30 text-primary rounded-lg text-sm flex items-center gap-2">
            <Check className="w-4 h-4" />
            Symptom logged successfully!
          </div>
        )}

        {/* Symptom Selector */}
        <div className="bg-card rounded-xl border border-border p-6 mb-6">
          <label className="block text-sm font-bold text-foreground mb-3">
            Select Symptom to Log
          </label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {selectedSymptoms.map((symptom) => (
              <button
                key={symptom}
                onClick={() => setCurrentSymptom(symptom)}
                className={`p-3 rounded-lg border-2 transition-all text-sm font-medium ${
                  currentSymptom === symptom
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-background hover:border-primary/50'
                }`}
              >
                {symptom}
              </button>
            ))}
          </div>
        </div>

        {currentSymptom && (
          <div className="bg-card rounded-xl border border-border p-6 space-y-6 mb-6">
            {/* Severity Slider */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-bold text-foreground">
                  Severity Level
                </label>
                <span className="text-2xl font-bold text-primary">
                  {currentLog.severity}/10
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                value={currentLog.severity}
                onChange={(e) =>
                  setCurrentLog({
                    ...currentLog,
                    severity: parseInt(e.target.value),
                  })
                }
                className="w-full h-2 bg-gradient-to-r from-secondary to-primary rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-foreground/50 mt-2">
                <span>Mild</span>
                <span>Moderate</span>
                <span>Severe</span>
              </div>
            </div>

            {/* Frequency */}
            <div>
              <label className="block text-sm font-bold text-foreground mb-3">
                Frequency
              </label>
              <div className="grid grid-cols-2 gap-2">
                {frequencyOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() =>
                      setCurrentLog({
                        ...currentLog,
                        frequency: option.value as any,
                      })
                    }
                    className={`p-3 rounded-lg border-2 transition-all text-sm font-medium ${
                      currentLog.frequency === option.value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-background hover:border-primary/50'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Duration */}
            <div>
              <label className="block text-sm font-bold text-foreground mb-3">
                Duration (hours)
              </label>
              <Input
                type="number"
                min="0"
                value={currentLog.duration}
                onChange={(e) =>
                  setCurrentLog({
                    ...currentLog,
                    duration: parseInt(e.target.value) || 0,
                  })
                }
                placeholder="How many hours?"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-bold text-foreground mb-3">
                Additional Notes
              </label>
              <textarea
                value={currentLog.notes}
                onChange={(e) =>
                  setCurrentLog({ ...currentLog, notes: e.target.value })
                }
                placeholder="Any additional context or observations..."
                rows={3}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground placeholder:text-foreground/30"
              />
            </div>

            {/* Submit Button */}
            <Button
              onClick={handleSubmitLog}
              disabled={saving}
              className="w-full bg-primary hover:bg-primary/90 text-white py-3 rounded-lg font-bold"
            >
              {saving ? (
                <><Spinner size="sm" className="mr-2" /> Logging…</>
              ) : (
                <><Plus className="w-5 h-5 mr-2" /> Log This Symptom</>
              )}
            </Button>
          </div>
        )}

        {/* Selected symptom graphs */}
        <section className="mb-6 rounded-xl border border-border bg-card p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-foreground">Your symptom graphs</h3>
              <p className="mt-1 text-sm text-foreground/60">Average severity for the symptoms you selected, based on your logged entries.</p>
            </div>
            <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-primary">{selectedSymptoms.length} tracked</span>
          </div>
          <div className="space-y-4">
            {symptomGraphData.map(({ symptom, averageSeverity, count }) => (
              <div key={symptom}>
                <div className="mb-1 flex items-center justify-between gap-3 text-sm"><span className="font-medium text-foreground">{symptom}</span><span className="text-foreground/60">{count ? `${averageSeverity.toFixed(1)}/10` : 'No logs yet'}</span></div>
                <div className="h-3 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${averageSeverity * 10}%` }} /></div>
              </div>
            ))}
          </div>
        </section>

        {/* Recent Logs */}
        {symptoms.length > 0 && (
          <div className="bg-card rounded-xl border border-border p-6">
            <h3 className="text-lg font-bold text-foreground mb-4">
              Recent Logs
            </h3>
            <div className="space-y-3">
              {symptoms.slice(0, 5).map((log) => (
                <div
                  key={log.id}
                  className="p-4 bg-background rounded-lg border border-border"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-bold text-foreground">
                      {log.symptomName}
                    </h4>
                    <span className="text-sm font-bold text-primary">
                      {log.severity}/10
                    </span>
                  </div>
                  <div className="text-xs text-foreground/60 space-y-1">
                    <p>Frequency: {log.frequency.replace('_', ' ')}</p>
                    <p>Duration: {log.duration} hours</p>
                    {log.notes && <p>Notes: {log.notes}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
