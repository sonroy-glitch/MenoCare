'use client'

import { useRouter } from 'next/navigation'
import { useApp } from '@/lib/AppContext'
import {
  Activity,
  BarChart3,
  ClipboardList,
  AlertCircle,
  HelpCircle,
  MessageCircle,
  Newspaper,
  Flame,
  TrendingUp,
} from 'lucide-react'
import { mockPopulationStats } from '@/lib/mockData'

export default function DashboardPage() {
  const router = useRouter()
  const { user, menopauseStage, moodScore, sleepScore, stressScore, healthScore, exerciseDietScore, symptoms } =
    useApp()

  const options = [
    {
      label: 'Medical Profile',
      description: 'Personal & medical information',
      icon: ClipboardList,
      href: '/medical-profile',
      color: 'from-primary to-primary/70',
    },
    {
      label: 'Data Analysis',
      description: 'Visualizations & insights',
      icon: BarChart3,
      href: '/data-analysis',
      color: 'from-accent to-accent/70',
    },
    {
      label: 'Symptom Logger',
      description: 'Track your symptoms',
      icon: Activity,
      href: '/symptom-logger',
      color: 'from-primary to-primary/70',
    },
    {
      label: 'Alerts Center',
      description: 'Predictions & reminders',
      icon: AlertCircle,
      href: '/alerts-center',
      color: 'from-primary to-accent',
    },
    {
      label: 'FAQs & Community',
      description: 'Questions & discussions',
      icon: HelpCircle,
      href: '/faqs-community',
      color: 'from-accent to-primary',
    },
    {
      label: 'AI Assistant',
      description: 'Chat for guidance',
      icon: MessageCircle,
      href: '/ai-assistant',
      color: 'from-primary to-accent',
    },
    {
      label: 'Latest News',
      description: 'Articles & recommendations',
      icon: Newspaper,
      href: '/latest-news',
      color: 'from-accent to-primary',
    },
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-primary/10 to-accent/10 px-4 py-8 border-b border-border">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-4xl font-bold text-foreground mb-2">
            Welcome back, {user?.name?.split(' ')[0] || 'Sarah'}!
          </h1>
          <p className="text-foreground/60">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
      </div>

      {/* Stats Section */}
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Menopause Stage & Streak */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-card rounded-2xl p-6 border border-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-foreground/60">
                Menopause Stage
              </h3>
              <Flame className="w-5 h-5 text-accent" />
            </div>
            <p className="text-3xl font-bold text-foreground mb-1">
              {menopauseStage}
            </p>
            <p className="text-xs text-foreground/50">Current phase</p>
          </div>

          <div className="bg-card rounded-2xl p-6 border border-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-foreground/60">
                Tracking Streak
              </h3>
              <TrendingUp className="w-5 h-5 text-primary" />
            </div>
            <p className="text-3xl font-bold text-foreground mb-1">
              {symptoms.length}
            </p>
            <p className="text-xs text-foreground/50">Days logged</p>
          </div>

          <div className="bg-card rounded-2xl p-6 border border-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-foreground/60">
                Health Score
              </h3>
              <BarChart3 className="w-5 h-5 text-primary" />
            </div>
            <p className="text-3xl font-bold text-foreground mb-1">
              {healthScore}/100
            </p>
            <p className="text-xs text-foreground/50">Overall wellness</p>
          </div>
        </div>

        {/* Health Scores Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
          {[
            { label: 'Mood', score: moodScore, color: 'text-primary' },
            { label: 'Sleep', score: sleepScore, color: 'text-primary' },
            { label: 'Stress', score: stressScore, color: 'text-accent' },
            { label: 'Health', score: healthScore, color: 'text-primary' },
            { label: 'Exercise', score: exerciseDietScore, color: 'text-accent' },
          ].map((item) => (
            <div
              key={item.label}
              className="bg-card rounded-xl p-4 border border-border text-center"
            >
              <p className={`text-2xl font-bold ${item.color}`}>
                {item.score}
              </p>
              <p className="text-xs text-foreground/60 mt-1">{item.label}</p>
            </div>
          ))}
        </div>

        {/* Population Stats */}
        <div className="bg-secondary rounded-2xl p-6 mb-8 border border-primary/30">
          <h2 className="text-lg font-bold text-foreground mb-4">
            Population Statistics
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-foreground/60 text-xs mb-1">Avg Symptoms</p>
              <p className="text-2xl font-bold text-primary">
                {mockPopulationStats.averageSymptoms}
              </p>
            </div>
            <div>
              <p className="text-foreground/60 text-xs mb-1">Avg Severity</p>
              <p className="text-2xl font-bold text-primary">
                {mockPopulationStats.averageSeverity}/10
              </p>
            </div>
            <div>
              <p className="text-foreground/60 text-xs mb-1">Most Common</p>
              <p className="text-lg font-bold text-primary">
                {mockPopulationStats.mostCommon}
              </p>
            </div>
            <div>
              <p className="text-foreground/60 text-xs mb-1">Avg Duration</p>
              <p className="text-lg font-bold text-primary">
                {mockPopulationStats.avgDuration}
              </p>
            </div>
          </div>
        </div>

        {/* 7 Options Grid */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-foreground mb-4">
            Quick Access
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {options.map((option) => {
              const Icon = option.icon
              return (
                <button
                  key={option.href}
                  onClick={() => router.push(option.href)}
                  className="text-left group"
                >
                  <div
                    className={`bg-gradient-to-br ${option.color} rounded-2xl p-6 text-white shadow-md hover:shadow-lg transition-all hover:scale-105 h-full`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <Icon className="w-8 h-8 opacity-90" />
                    </div>
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
