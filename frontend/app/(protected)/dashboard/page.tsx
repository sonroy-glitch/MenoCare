'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useApp } from '@/lib/AppContext'
import { Skeleton, SkeletonCard } from '@/components/ui/spinner'
import {
  Activity, BarChart3, ClipboardList, AlertCircle, HelpCircle,
  MessageCircle, Newspaper, Flame, TrendingUp,
} from 'lucide-react'

const EX_SCORE: Record<string, number> = { sedentary: 25, light: 50, moderate: 75, vigorous: 95 }

export default function DashboardPage() {
  const router = useRouter()
  const { user, menopauseStage, symptoms, medicalProfile, forecast, loading } = useApp()

  // ---- Everything below is derived from real data (logs / profile / forecast) ----
  const recent = useMemo(() => {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 30)
    return symptoms.filter((s) => new Date(s.date) >= cutoff)
  }, [symptoms])

  const daysLogged = useMemo(
    () => new Set(symptoms.map((s) => new Date(s.date).toISOString().slice(0, 10))).size,
    [symptoms],
  )

  const avgSev = recent.length ? recent.reduce((a, s) => a + s.severity, 0) / recent.length : null
  const wellness = (sev: number | null) => (sev == null ? null : Math.max(0, Math.round(100 - sev * 10)))
  const healthScore = wellness(avgSev)

  const groupScore = (needles: string[]) => {
    const g = recent.filter((s) => needles.some((n) => s.symptomName.toLowerCase().includes(n)))
    if (!g.length) return null
    return wellness(g.reduce((a, s) => a + s.severity, 0) / g.length)
  }
  const scores = [
    { label: 'Mood', score: groupScore(['mood', 'depress']), color: 'text-primary' },
    { label: 'Sleep', score: groupScore(['sleep', 'night sweat', 'fatigue']), color: 'text-primary' },
    { label: 'Stress', score: groupScore(['anxiety', 'stress']), color: 'text-accent' },
    { label: 'Health', score: healthScore, color: 'text-primary' },
    { label: 'Exercise', score: medicalProfile?.exerciseFrequency ? EX_SCORE[medicalProfile.exerciseFrequency] ?? null : null, color: 'text-accent' },
  ]

  const myStats = useMemo(() => {
    const counts: Record<string, number> = {}
    recent.forEach((s) => (counts[s.symptomName] = (counts[s.symptomName] || 0) + 1))
    const most = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0] || '—'
    return {
      tracked: new Set(recent.map((s) => s.symptomName)).size,
      avgSeverity: avgSev != null ? avgSev.toFixed(1) : '—',
      most,
      logs: recent.length,
    }
  }, [recent, avgSev])

  const nf = forecast?.next_flash
  const fmtVal = (v: number | null) => (v == null ? '—' : String(v))

  const options = [
    { label: 'Medical Profile', description: 'Personal & medical information', icon: ClipboardList, href: '/medical-profile', color: 'from-primary to-primary/70' },
    { label: 'Data Analysis', description: 'Visualizations & insights', icon: BarChart3, href: '/data-analysis', color: 'from-accent to-accent/70' },
    { label: 'Symptom Logger', description: 'Track your symptoms', icon: Activity, href: '/symptom-logger', color: 'from-primary to-primary/70' },
    { label: 'Alerts Center', description: 'Predictions & reminders', icon: AlertCircle, href: '/alerts-center', color: 'from-primary to-accent' },
    { label: 'FAQs & Community', description: 'Questions & discussions', icon: HelpCircle, href: '/faqs-community', color: 'from-accent to-primary' },
    { label: 'AI Assistant', description: 'Chat for guidance', icon: MessageCircle, href: '/ai-assistant', color: 'from-primary to-accent' },
    { label: 'Latest News', description: 'Articles & recommendations', icon: Newspaper, href: '/latest-news', color: 'from-accent to-primary' },
  ]

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-gradient-to-r from-primary/10 to-accent/10 px-4 py-8 border-b border-border">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-4xl font-bold text-foreground mb-2">
            Welcome back, {user?.name?.split(' ')[0] || 'there'}!
          </h1>
          <p className="text-foreground/60">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Stage / streak / next-flash — all real */}
        {loading ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              {[0, 1, 2].map((i) => <SkeletonCard key={i} />)}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-card rounded-xl p-4 border border-border">
                  <Skeleton className="h-7 w-12 mx-auto" />
                  <Skeleton className="h-3 w-16 mx-auto mt-2" />
                </div>
              ))}
            </div>
            <div className="bg-secondary rounded-2xl p-6 mb-8 border border-primary/30">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3 w-64 mt-2 mb-4" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i}>
                    <Skeleton className="h-3 w-20 mb-2" />
                    <Skeleton className="h-7 w-14" />
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-card rounded-2xl p-6 border border-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-foreground/60">Menopause Stage</h3>
              <Flame className="w-5 h-5 text-accent" />
            </div>
            <p className="text-3xl font-bold text-foreground mb-1">{menopauseStage}</p>
            <p className="text-xs text-foreground/50">Current phase</p>
          </div>

          <div className="bg-card rounded-2xl p-6 border border-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-foreground/60">Days Logged</h3>
              <TrendingUp className="w-5 h-5 text-primary" />
            </div>
            <p className="text-3xl font-bold text-foreground mb-1">{daysLogged}</p>
            <p className="text-xs text-foreground/50">Distinct days tracked</p>
          </div>

          <div className="bg-card rounded-2xl p-6 border border-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-foreground/60">Next Hot Flash</h3>
              <BarChart3 className="w-5 h-5 text-primary" />
            </div>
            <p className="text-3xl font-bold text-foreground mb-1">
              {!forecast ? '—'
                : nf?.beyond_horizon || !nf?.date ? 'None soon'
                : `~${nf.days_part > 0 ? nf.days_part + 'd ' : ''}${nf.hours_part}h`}
            </p>
            <p className="text-xs text-foreground/50">Random Forest prediction</p>
          </div>
        </div>

        {/* Wellness scores derived from logged symptoms (— when no data) */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
          {scores.map((item) => (
            <div key={item.label} className="bg-card rounded-xl p-4 border border-border text-center">
              <p className={`text-2xl font-bold ${item.color}`}>{fmtVal(item.score)}</p>
              <p className="text-xs text-foreground/60 mt-1">{item.label}</p>
            </div>
          ))}
        </div>

        {/* Your own statistics (real, last 30 days) */}
        <div className="bg-secondary rounded-2xl p-6 mb-8 border border-primary/30">
          <h2 className="text-lg font-bold text-foreground mb-1">Your Statistics</h2>
          <p className="text-xs text-foreground/50 mb-4">Based on your logs from the last 30 days</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-foreground/60 text-xs mb-1">Entries</p>
              <p className="text-2xl font-bold text-primary">{myStats.logs}</p>
            </div>
            <div>
              <p className="text-foreground/60 text-xs mb-1">Avg Severity</p>
              <p className="text-2xl font-bold text-primary">{myStats.avgSeverity === '—' ? '—' : `${myStats.avgSeverity}/10`}</p>
            </div>
            <div>
              <p className="text-foreground/60 text-xs mb-1">Most Common</p>
              <p className="text-lg font-bold text-primary">{myStats.most}</p>
            </div>
            <div>
              <p className="text-foreground/60 text-xs mb-1">Symptoms Tracked</p>
              <p className="text-2xl font-bold text-primary">{myStats.tracked}</p>
            </div>
          </div>
        </div>
          </>
        )}

        <div className="mb-8">
          <h2 className="text-2xl font-bold text-foreground mb-4">Quick Access</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {options.map((option) => {
              const Icon = option.icon
              return (
                <button key={option.href} onClick={() => router.push(option.href)} className="text-left group">
                  <div className={`bg-gradient-to-br ${option.color} rounded-2xl p-6 text-white shadow-md hover:shadow-lg transition-all hover:scale-105 h-full`}>
                    <div className="flex items-start justify-between mb-3"><Icon className="w-8 h-8 opacity-90" /></div>
                    <h3 className="text-xl font-bold mb-1">{option.label}</h3>
                    <p className="text-sm opacity-90">{option.description}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
