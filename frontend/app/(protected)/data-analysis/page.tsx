'use client'

import { useMemo, useState } from 'react'
import { useApp } from '@/lib/AppContext'
import { LoadingBlock } from '@/components/ui/spinner'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Area, AreaChart,
} from 'recharts'
import { TrendingUp, Activity, Flame, BarChart3 } from 'lucide-react'

const dayKey = (d: Date) => d.toISOString().slice(0, 10)
const dayLabel = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

export default function DataAnalysisPage() {
  const { symptoms, forecast, medicalProfile, menopauseStage, loading } = useApp()
  const [timeRange, setTimeRange] = useState<'7' | '30' | '90'>('30')

  // ---- All series below are derived from REAL logged data only ----
  const inRange = useMemo(() => {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - parseInt(timeRange))
    return symptoms.filter((s) => new Date(s.date) >= cutoff)
  }, [symptoms, timeRange])

  const overTime = useMemo(() => {
    const byDate: Record<string, { sev: number[]; hot: number }> = {}
    for (const s of inRange) {
      const k = dayKey(new Date(s.date))
      byDate[k] = byDate[k] || { sev: [], hot: 0 }
      byDate[k].sev.push(s.severity)
      if (/hot flash/i.test(s.symptomName)) byDate[k].hot += 1
    }
    return Object.keys(byDate).sort().map((k) => ({
      date: dayLabel(k),
      avgSeverity: Number((byDate[k].sev.reduce((a, b) => a + b, 0) / byDate[k].sev.length).toFixed(1)),
      hotFlashes: byDate[k].hot,
    }))
  }, [inRange])

  const bySymptom = useMemo(() => {
    const m: Record<string, number[]> = {}
    for (const s of inRange) (m[s.symptomName] = m[s.symptomName] || []).push(s.severity)
    return Object.entries(m)
      .map(([symptom, arr]) => ({
        symptom,
        avgSeverity: Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1)),
        count: arr.length,
      }))
      .sort((a, b) => b.avgSeverity - a.avgSeverity)
  }, [inRange])

  const stats = useMemo(() => {
    const total = inRange.length
    const avg = total ? (inRange.reduce((s, e) => s + e.severity, 0) / total).toFixed(1) : '—'
    const most = bySymptom.length ? bySymptom.reduce((a, b) => (a.count >= b.count ? a : b)).symptom : '—'
    const h = medicalProfile?.height, w = medicalProfile?.weight
    const bmi = h && w ? (w / ((h / 100) ** 2)).toFixed(1) : '—'
    return { total, avg, most, bmi }
  }, [inRange, bySymptom, medicalProfile])

  const nf = forecast?.next_flash
  const today = forecast?.days?.[0]
  const hasData = symptoms.length > 0

  const Stat = ({ label, value, icon: Icon }: { label: string; value: any; icon: any }) => (
    <div className="bg-card rounded-xl p-4 border border-border">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-foreground/60">{label}</p>
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
    </div>
  )

  const ChartCard = ({ title, children }: { title: string; children: any }) => (
    <div className="bg-card rounded-2xl p-6 border border-border">
      <h3 className="text-lg font-bold text-foreground mb-4">{title}</h3>
      {children}
    </div>
  )

  const tooltipStyle = { backgroundColor: '#ffffff', border: '1px solid #eeac9e', borderRadius: '8px' }

  return (
    <div className="min-h-screen bg-background pb-8">
      <div className="bg-gradient-to-r from-accent/10 to-primary/10 px-4 py-6 border-b border-border mb-6">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold text-foreground mb-2">Data Analysis &amp; Insights</h1>
          <p className="text-foreground/60">Trends from your own logged symptoms and model predictions.</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4">
        {/* Time range */}
        <div className="flex gap-3 mb-8">
          {(['7', '30', '90'] as const).map((r) => (
            <button key={r} onClick={() => setTimeRange(r)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                timeRange === r ? 'bg-primary text-white' : 'bg-card border border-border text-foreground hover:border-primary'
              }`}>
              Last {r} days
            </button>
          ))}
        </div>

        {loading ? (
          <LoadingBlock label="Crunching your symptom trends…" className="rounded-2xl border border-border bg-card py-20" />
        ) : !hasData ? (
          <div className="rounded-2xl border border-border bg-card p-12 text-center">
            <BarChart3 className="mx-auto mb-4 h-14 w-14 text-primary/30" />
            <h2 className="text-xl font-bold text-foreground mb-2">No data yet</h2>
            <p className="text-foreground/60">
              Log your symptoms in the Symptom Logger to see real trends and predictions here.
            </p>
          </div>
        ) : (
          <>
            {/* Prediction (Random Forest) */}
            <div className="mb-8 rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 to-accent/10 p-6">
              <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-foreground">
                <Flame className="h-5 w-5 text-primary" /> Hot Flash Prediction
                <span className="ml-1 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">Random Forest</span>
              </h2>
              {forecast ? (
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-foreground/50">Next hot flash</p>
                    <p className="text-2xl font-bold text-primary">
                      {nf?.beyond_horizon || !nf?.date ? 'None expected soon'
                        : `~${nf.days_part > 0 ? nf.days_part + 'd ' : ''}${nf.hours_part}h`}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-foreground/50">Today&apos;s risk</p>
                    <p className="text-2xl font-bold capitalize text-primary">
                      {today ? `${today.band} (${Math.round(today.probability * 100)}%)` : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-foreground/50">Stage</p>
                    <p className="text-2xl font-bold text-foreground">{menopauseStage}</p>
                  </div>
                  {forecast.summary && <p className="sm:col-span-3 text-sm text-foreground/80">{forecast.summary}</p>}
                </div>
              ) : (
                <p className="text-sm text-foreground/60">Generating prediction…</p>
              )}
            </div>

            {/* Real stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
              <Stat label={`Logs (last ${timeRange}d)`} value={stats.total} icon={Activity} />
              <Stat label="Avg severity" value={`${stats.avg}${stats.avg === '—' ? '' : '/10'}`} icon={TrendingUp} />
              <Stat label="Most logged" value={stats.most} icon={Flame} />
              <Stat label="BMI" value={stats.bmi} icon={Activity} />
            </div>

            <div className="space-y-8">
              {/* Severity over time */}
              <ChartCard title="Symptom severity over time">
                {overTime.length ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={overTime}>
                      <defs>
                        <linearGradient id="sev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#975d51" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#975d51" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eeac9e" />
                      <XAxis dataKey="date" stroke="#666" />
                      <YAxis domain={[0, 10]} stroke="#666" />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Area type="monotone" dataKey="avgSeverity" name="Avg severity" stroke="#975d51" fill="url(#sev)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : <p className="text-sm text-foreground/50">Not enough data in this range.</p>}
              </ChartCard>

              {/* Hot flashes over time */}
              <ChartCard title="Hot flashes logged per day">
                {overTime.some((d) => d.hotFlashes > 0) ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={overTime}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eeac9e" />
                      <XAxis dataKey="date" stroke="#666" />
                      <YAxis allowDecimals={false} stroke="#666" />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="hotFlashes" name="Hot flash logs" fill="#975d51" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p className="text-sm text-foreground/50">No hot-flash entries logged in this range.</p>}
              </ChartCard>

              {/* Severity by symptom */}
              <ChartCard title="Average severity by symptom">
                {bySymptom.length ? (
                  <ResponsiveContainer width="100%" height={Math.max(220, bySymptom.length * 34)}>
                    <BarChart data={bySymptom} layout="vertical" margin={{ left: 24 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eeac9e" />
                      <XAxis type="number" domain={[0, 10]} stroke="#666" />
                      <YAxis type="category" dataKey="symptom" width={120} stroke="#666" tick={{ fontSize: 12 }} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="avgSeverity" name="Avg severity" fill="#c28477" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p className="text-sm text-foreground/50">Not enough data in this range.</p>}
              </ChartCard>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
