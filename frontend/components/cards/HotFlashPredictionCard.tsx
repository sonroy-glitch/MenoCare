import React from 'react'
import { AlertCircle, TrendingUp } from 'lucide-react'
import type { HotFlashPrediction } from '@/lib/mockData'

interface HotFlashPredictionCardProps {
  prediction: HotFlashPrediction
}

export function HotFlashPredictionCard({ prediction }: HotFlashPredictionCardProps) {
  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'high':
        return 'from-accent to-red-400'
      case 'moderate':
        return 'from-primary to-accent'
      case 'low':
        return 'from-secondary to-accent'
      default:
        return 'from-primary to-accent'
    }
  }

  const getRiskBgColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'high':
        return 'bg-primary/10 border-primary/40'
      case 'moderate':
        return 'bg-secondary border-primary/30'
      case 'low':
        return 'bg-secondary border-primary/30'
      default:
        return 'bg-secondary border-primary/30'
    }
  }

  const getRiskTextColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'high':
        return 'text-primary'
      case 'moderate':
        return 'text-primary'
      case 'low':
        return 'text-primary'
      default:
        return 'text-primary'
    }
  }

  const formatTimeframe = (timeframe: string) => {
    return timeframe.charAt(0).toUpperCase() + timeframe.slice(1)
  }

  return (
    <div
      className={`rounded-2xl p-6 border-2 shadow-lg transition-all duration-300 hover:shadow-xl ${getRiskBgColor(prediction.riskLevel)}`}
    >
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-5 h-5" />
            <span className={`text-sm font-bold uppercase tracking-wider ${getRiskTextColor(prediction.riskLevel)}`}>
              {prediction.riskLevel} risk
            </span>
          </div>
          <h3 className="text-2xl font-bold text-foreground mb-1">Hot Flash Alert</h3>
          <p className="text-sm text-muted-foreground">{formatTimeframe(prediction.timeframe)}</p>
        </div>

        <div className="flex flex-col items-end">
          <div className={`text-4xl font-bold bg-gradient-to-r ${getRiskColor(prediction.riskLevel)} bg-clip-text text-transparent`}>
            {prediction.confidence}%
          </div>
          <p className="text-xs text-muted-foreground mt-1">confidence</p>
        </div>
      </div>

      <div className="mb-4 p-3 bg-background rounded-lg border border-border">
        <p className="text-sm text-foreground leading-relaxed">{prediction.message}</p>
      </div>

      {prediction.topTriggers.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Top Triggers</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {prediction.topTriggers.map((trigger, idx) => (
              <span key={idx} className="px-3 py-1 rounded-full text-xs font-medium bg-background text-foreground border border-border">
                {trigger}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
