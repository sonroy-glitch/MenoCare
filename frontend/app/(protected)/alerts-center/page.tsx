'use client'

import { useApp } from '@/lib/AppContext'
import { AlertCircle, Calendar, Flame, Heart, Pill, TrendingDown, X } from 'lucide-react'

export default function AlertsCenterPage() {
  const { alerts, dismissAlert } = useApp()
  const hotFlashAlerts = alerts.filter((alert) => alert.type === 'prediction')
  const otherAlerts = alerts.filter((alert) => alert.type !== 'prediction')

  return (
    <div className="min-h-screen bg-background pb-8">
      <header className="mb-6 border-b border-border bg-secondary px-4 py-6">
        <div className="mx-auto max-w-5xl">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">MenoCare alerts</p>
          <h1 className="mt-2 text-3xl font-bold text-foreground">Alerts Center</h1>
          <p className="mt-2 text-foreground/60">Personalized pattern alerts, reminders, and safety notifications.</p>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-4">
        <section className="rounded-2xl border-2 border-primary bg-primary p-6 text-primary-foreground shadow-lg">
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-primary-foreground/15 p-3"><Flame className="h-7 w-7" aria-hidden="true" /></div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary-foreground/75">Most prominent signal</p>
              <h2 className="mt-1 text-2xl font-bold">Hot flash prediction</h2>
              <p className="mt-2 max-w-2xl leading-7 text-primary-foreground/85">MenoCare highlights possible upcoming hot flash patterns using the symptoms and trends you have logged. This is a pattern estimate, not a diagnosis or medical advice.</p>
            </div>
          </div>
          <div className="mt-5 rounded-xl bg-card/15 p-4 text-sm text-primary-foreground/90">
            {hotFlashAlerts.length > 0 ? `${hotFlashAlerts.length} hot flash prediction alert${hotFlashAlerts.length === 1 ? '' : 's'} currently active.` : 'No hot flash prediction alerts are active right now. Continue logging symptoms to improve your personal pattern view.'}
          </div>
        </section>

        {hotFlashAlerts.length > 0 && (
          <section aria-labelledby="hot-flash-alerts-heading">
            <h2 id="hot-flash-alerts-heading" className="mb-4 text-xl font-bold text-foreground">Hot flash alerts</h2>
            <div className="space-y-3">
              {hotFlashAlerts.map((alert) => (
                <AlertRow key={alert.id} alert={alert} onDismiss={dismissAlert} featured />
              ))}
            </div>
          </section>
        )}

        <section aria-labelledby="other-alerts-heading">
          <h2 id="other-alerts-heading" className="mb-4 text-xl font-bold text-foreground">Other alerts</h2>
          {otherAlerts.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-6 text-sm text-foreground/60">No other active alerts.</div>
          ) : (
            <div className="space-y-3">{otherAlerts.map((alert) => <AlertRow key={alert.id} alert={alert} onDismiss={dismissAlert} />)}</div>
          )}
        </section>

        <div className="rounded-xl border border-border bg-card p-5 text-sm leading-6 text-foreground/70">
          MenoCare does not provide medical advice. If symptoms are extreme, sudden, or feel unsafe, contact a qualified healthcare professional or local emergency service.
        </div>
      </main>
    </div>
  )
}

function AlertRow({ alert, onDismiss, featured = false }: { alert: any; onDismiss: (id: string) => void; featured?: boolean }) {
  const Icon = alert.type === 'prediction' ? Flame : alert.type === 'medication' ? Pill : alert.type === 'appointment' ? Calendar : alert.type === 'symptom' ? TrendingDown : alert.type === 'intervention' ? AlertCircle : Heart
  return (
    <article className={`rounded-xl border p-5 ${featured ? 'border-primary/50 bg-secondary/50' : 'border-border bg-card'}`}>
      <div className="flex items-start gap-4">
        <Icon className="mt-1 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-bold text-foreground">{alert.title}</h3>
            <button onClick={() => onDismiss(alert.id)} className="text-foreground/40 transition-colors hover:text-foreground" aria-label={`Dismiss ${alert.title}`}><X className="h-5 w-5" /></button>
          </div>
          <p className="mt-2 text-sm leading-6 text-foreground/70">{alert.message}</p>
          {alert.dueDate && <p className="mt-2 text-xs text-foreground/50">Due: {new Date(alert.dueDate).toLocaleDateString()}</p>}
          {alert.type === 'intervention' && <p className="mt-3 rounded-lg border border-primary/30 bg-background p-3 text-xs font-medium text-foreground/70">If this situation feels extreme or unsafe, seek professional or emergency help.</p>}
        </div>
      </div>
    </article>
  )
}
