'use client'

import { useState } from 'react'
import { useApp } from '@/lib/AppContext'
import { mockJourneyComment, mockScores } from '@/lib/mockData'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  Area,
  AreaChart,
} from 'recharts'
import { TrendingUp, Activity, Zap, Heart, Apple } from 'lucide-react'

// Generate stable demo data so the server and browser render the same chart.
const generateChartData = (days: number) => {
  const data = []
  const baseDate = new Date('2026-08-05T12:00:00Z')
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  for (let i = days; i >= 0; i--) {
    const date = new Date(baseDate)
    date.setUTCDate(date.getUTCDate() - i)
    data.push({
      date: `${monthNames[date.getUTCMonth()]} ${date.getUTCDate()}`,
      hotFlashes: 2 + ((days - i) * 3) % 7,
      bmi: Number((23.5 + (((days - i) % 5) - 2) * 0.25).toFixed(1)),
      mood: 58 + ((days - i) * 7) % 34,
      periods: i % 5 === 0 ? 1 : 0,
      menopauseStage: 2,
    })
  }
  return data
}

export default function DataAnalysisPage() {
  const { moodScore, sleepScore, stressScore, healthScore, exerciseDietScore, menopauseStage } = useApp()
  const [timeRange, setTimeRange] = useState<'7' | '30' | '90'>('30')

  const chartData = generateChartData(parseInt(timeRange))

  const ScoreCard = ({
    label,
    score,
    icon: Icon,
    color,
  }: {
    label: string
    score: number
    icon: any
    color: string
  }) => (
    <div className="bg-card rounded-xl p-4 border border-border">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-foreground/60">{label}</p>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <div className="relative h-2 bg-background rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color.replace('text-', 'bg-')}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <p className={`text-2xl font-bold mt-2 ${color}`}>{score}</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-accent/10 to-primary/10 px-4 py-6 border-b border-border mb-6">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Data Analysis & Insights
          </h1>
          <p className="text-foreground/60">
            Visualizations of your health journey and trends
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4">
        {/* Time Range Selector */}
        <div className="flex gap-3 mb-8">
          {(['7', '30', '90'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                timeRange === range
                  ? 'bg-primary text-white'
                  : 'bg-card border border-border text-foreground hover:border-primary'
              }`}
            >
              Last {range} days
            </button>
          ))}
        </div>

        {/* Health Scores Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
          <ScoreCard
            label="Mood"
            score={moodScore}
            icon={Heart}
            color="text-primary"
          />
          <ScoreCard
            label="Sleep"
            score={sleepScore}
            icon={Activity}
            color="text-primary"
          />
          <ScoreCard
            label="Stress"
            score={stressScore}
            icon={Zap}
            color="text-accent"
          />
          <ScoreCard
            label="Health"
            score={healthScore}
            icon={Activity}
            color="text-primary"
          />
          <ScoreCard
            label="Exercise"
            score={exerciseDietScore}
            icon={Apple}
            color="text-accent"
          />
        </div>

        {/* Journey Comment */}
        <div className="bg-gradient-to-r from-primary/10 to-accent/10 rounded-2xl p-6 border border-primary/30 mb-8">
          <h2 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Your Menopause Journey
          </h2>
          <p className="text-foreground/80 leading-relaxed">
            {mockJourneyComment}
          </p>
        </div>

        {/* Charts Grid */}
        <div className="space-y-8">
          {/* Hot Flashes Trend */}
          <div className="bg-card rounded-2xl p-6 border border-border">
            <h3 className="text-lg font-bold text-foreground mb-4">
              Hot Flashes Trend
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient
                    id="colorHotFlashes"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor="#975d51" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#975d51" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eeac9e" />
                <XAxis dataKey="date" stroke="#666666" />
                <YAxis stroke="#666666" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #eeac9e',
                    borderRadius: '8px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="hotFlashes"
                  stroke="#975d51"
                  fillOpacity={1}
                  fill="url(#colorHotFlashes)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* BMI Trend */}
          <div className="bg-card rounded-2xl p-6 border border-border">
            <h3 className="text-lg font-bold text-foreground mb-4">
              BMI Trend
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eeac9e" />
                <XAxis dataKey="date" stroke="#666666" />
                <YAxis stroke="#666666" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #eeac9e',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="bmi"
                  stroke="#c28477"
                  dot={false}
                  name="BMI"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Mood Trend */}
          <div className="bg-card rounded-2xl p-6 border border-border">
            <h3 className="text-lg font-bold text-foreground mb-4">
              Mood Score Trend
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eeac9e" />
                <XAxis dataKey="date" stroke="#666666" />
                <YAxis stroke="#666666" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #eeac9e',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                <Bar dataKey="mood" fill="#eeac9e" name="Mood Score" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Combined View */}
          <div className="bg-card rounded-2xl p-6 border border-border">
            <h3 className="text-lg font-bold text-foreground mb-4">
              Overall Health Metrics
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eeac9e" />
                <XAxis dataKey="date" stroke="#666666" />
                <YAxis stroke="#666666" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #eeac9e',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="hotFlashes"
                  stroke="#975d51"
                  name="Hot Flashes"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="mood"
                  stroke="#eeac9e"
                  name="Mood"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="bmi"
                  stroke="#c28477"
                  name="BMI"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Statistics Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pb-4">
            <div className="bg-card rounded-xl p-4 border border-border text-center">
              <p className="text-2xl font-bold text-primary">
                {chartData.filter((d) => d.hotFlashes > 5).length}
              </p>
              <p className="text-xs text-foreground/60 mt-1">High severity days</p>
            </div>
            <div className="bg-card rounded-xl p-4 border border-border text-center">
              <p className="text-2xl font-bold text-accent">
                {(
                  chartData.reduce((sum, d) => sum + d.mood, 0) / chartData.length
                ).toFixed(0)}
              </p>
              <p className="text-xs text-foreground/60 mt-1">Avg mood score</p>
            </div>
            <div className="bg-card rounded-xl p-4 border border-border text-center">
              <p className="text-2xl font-bold text-primary">
                {menopauseStage}
              </p>
              <p className="text-xs text-foreground/60 mt-1">Current stage</p>
            </div>
            <div className="bg-card rounded-xl p-4 border border-border text-center">
              <p className="text-2xl font-bold text-primary">
                {Math.round(
                  chartData.reduce((sum, d) => sum + d.bmi, 0) / chartData.length
                )}{' '}
                kg
              </p>
              <p className="text-xs text-foreground/60 mt-1">Avg BMI</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
